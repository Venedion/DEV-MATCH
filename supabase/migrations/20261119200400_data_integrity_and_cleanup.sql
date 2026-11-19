-- Data integrity, performance and cleanup (audit items 3, 16-21, 28).
begin;

-- 18. Old function versions that ignore the active workspace.
drop function if exists public.save_notification_preferences(jsonb);
drop function if exists public.get_dashboard_metrics();

-- 3 + 20. Developer directory: same columns as before (including the view and
-- favorite counts the Find Developers page reads), but every count is computed
-- once per owner instead of once per row.
create index if not exists projects_owner_kind_status_idx
  on public.projects (owner_id, project_kind, status);

create or replace view public.directory_people
with (security_barrier = true)
as
with workspace_profiles as (
  select id, username, account_role, display_name, profile_data, onboarding_complete
  from public.profiles
  union all
  select p.id, p.username, w.role, w.display_name, w.profile_data, w.onboarding_complete
  from public.account_workspaces w
  join public.profiles p on p.id = w.user_id
  where w.role <> p.account_role
),
project_counts as (
  select owner_id,
    count(*) filter (where project_kind = 'portfolio' and status = 'published') as published_portfolios,
    count(*) filter (where project_kind = 'request' and status = 'open') as open_requests
  from public.projects
  group by owner_id
),
published_portfolio_views as (
  select p.owner_id, count(*) as total
  from public.projects p
  join public.project_views v on v.project_id = p.id
  where p.project_kind = 'portfolio' and p.status = 'published'
  group by p.owner_id
),
published_portfolio_favorites as (
  select p.owner_id, count(*) as total
  from public.projects p
  join public.favorites f on f.item_type = 'project' and f.item_id = p.id
  where p.project_kind = 'portfolio' and p.status = 'published'
  group by p.owner_id
)
select
  p.id,
  p.display_name,
  p.username,
  p.account_role,
  jsonb_strip_nulls(jsonb_build_object(
    'city', p.profile_data->'city',
    'bio', p.profile_data->'bio',
    'specialty', p.profile_data->'specialty',
    'specialtyOther', p.profile_data->'specialtyOther',
    'skills', p.profile_data->'skills',
    'hourlyRate', p.profile_data->'hourlyRate',
    'minProjectPrice', p.profile_data->'minProjectPrice',
    'contractTypes', p.profile_data->'contractTypes',
    'availability', p.profile_data->'availability',
    'companyName', p.profile_data->'companyName',
    'industry', p.profile_data->'industry'
  )) as profile_data,
  coalesce(counts.published_portfolios, 0) as published_portfolio_count,
  coalesce(counts.open_requests, 0) as open_request_count,
  coalesce(views.total, 0) as published_portfolio_views_count,
  coalesce(favorites.total, 0) as published_portfolio_favorites_count
from workspace_profiles p
left join project_counts counts on counts.owner_id = p.id
left join published_portfolio_views views on views.owner_id = p.id
left join published_portfolio_favorites favorites on favorites.owner_id = p.id
where p.onboarding_complete = true;

revoke all on public.directory_people from public, anon, authenticated;
grant select on public.directory_people to authenticated;
grant select on public.directory_people to service_role;

-- 19. Comment author names follow the workspace the comment was written in.
create or replace function public.sync_project_comment_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := coalesce(nullif(btrim(new.display_name), ''), nullif(btrim(new.username), ''));
  v_parts text[];
begin
  if v_name is null then
    return new;
  end if;
  v_parts := regexp_split_to_array(v_name, '\s+');
  update public.comments
  set author_name = v_name,
      author_initials = upper(left(v_parts[1], 1) || coalesce(left(v_parts[2], 1), ''))
  where user_id = new.id
    and workspace_role = new.account_role
    and author_name is distinct from v_name;
  return new;
end;
$$;
revoke all on function public.sync_project_comment_display_name() from public, anon, authenticated;

create or replace function private.sync_workspace_comment_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_parts text[];
begin
  select coalesce(nullif(btrim(new.display_name), ''), nullif(btrim(p.username), ''))
  into v_name
  from public.profiles p
  where p.id = new.user_id;
  if v_name is null then
    return new;
  end if;
  v_parts := regexp_split_to_array(v_name, '\s+');
  update public.comments
  set author_name = v_name,
      author_initials = upper(left(v_parts[1], 1) || coalesce(left(v_parts[2], 1), ''))
  where user_id = new.user_id
    and workspace_role = new.role
    and author_name is distinct from v_name;
  return new;
end;
$$;
revoke all on function private.sync_workspace_comment_display_name() from public, anon, authenticated;

drop trigger if exists sync_workspace_comment_display_name_after_update on public.account_workspaces;
create trigger sync_workspace_comment_display_name_after_update
  after update of display_name on public.account_workspaces
  for each row
  when (old.display_name is distinct from new.display_name)
  execute function private.sync_workspace_comment_display_name();

-- Repair names that the old trigger overwrote with the wrong workspace.
update public.comments c
set author_name = fixed.name,
    author_initials = upper(left(fixed.parts[1], 1) || coalesce(left(fixed.parts[2], 1), ''))
from (
  select c2.id, names.name, regexp_split_to_array(names.name, '\s+') as parts
  from public.comments c2
  join public.profiles p on p.id = c2.user_id
  left join public.account_workspaces w on w.user_id = p.id and w.role = c2.workspace_role
  cross join lateral (
    select coalesce(
      nullif(btrim(case when p.account_role = c2.workspace_role then p.display_name else w.display_name end), ''),
      nullif(btrim(p.username), '')
    ) as name
  ) names
  where names.name is not null
) fixed
where fixed.id = c.id
  and c.author_name is distinct from fixed.name;

-- 21. Referential integrity.
-- Comments already require an existing project on insert; NOT VALID keeps any
-- historic orphan rows from blocking the migration while enforcing new rows.
delete from public.comments c
where not exists (select 1 from public.projects p where p.id = c.project_id);
alter table public.comments drop constraint if exists comments_project_id_fkey;
alter table public.comments add constraint comments_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete cascade not valid;

-- Favorites point at projects or people, so a foreign key is not possible.
-- Validate on insert and clean up when the target disappears.
create or replace function private.validate_favorite_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.item_type = 'project' then
    if not exists (
      select 1 from public.projects p
      where (p.id = new.item_id or p.legacy_id = new.item_id)
        and (p.status in ('published', 'open') or p.owner_id = new.user_id)
    ) then
      raise exception 'This project is not available' using errcode = '23503';
    end if;
  elsif new.item_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or not exists (select 1 from public.profiles where id = new.item_id::uuid) then
    raise exception 'This profile is not available' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_favorite_target() from public, anon, authenticated;

drop trigger if exists validate_favorite_target_before_insert on public.favorites;
create trigger validate_favorite_target_before_insert before insert on public.favorites
  for each row execute function private.validate_favorite_target();

create or replace function private.delete_favorites_for_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.favorites
  where item_type = 'project' and item_id in (old.id, coalesce(old.legacy_id, old.id));
  return old;
end;
$$;
revoke all on function private.delete_favorites_for_project() from public, anon, authenticated;

drop trigger if exists delete_favorites_after_project_delete on public.projects;
create trigger delete_favorites_after_project_delete after delete on public.projects
  for each row execute function private.delete_favorites_for_project();

create or replace function private.delete_favorites_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.favorites
  where item_type in ('developer', 'client') and item_id = old.id::text;
  return old;
end;
$$;
revoke all on function private.delete_favorites_for_profile() from public, anon, authenticated;

drop trigger if exists delete_favorites_after_profile_delete on public.profiles;
create trigger delete_favorites_after_profile_delete after delete on public.profiles
  for each row execute function private.delete_favorites_for_profile();

delete from public.favorites f
where (f.item_type = 'project' and not exists (
        select 1 from public.projects p where p.id = f.item_id or p.legacy_id = f.item_id))
   or (f.item_type in ('developer', 'client') and not exists (
        select 1 from public.profiles p where p.id::text = f.item_id));

-- 17. One message notification per conversation instead of one per message.
create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conversations;
  v_user uuid;
  v_role text;
  v_actor_role text;
begin
  select * into strict c from public.conversations where id = new.conversation_id;
  if c.participant_a_id = new.sender_id then
    v_user := c.participant_b_id; v_role := c.participant_b_role; v_actor_role := c.participant_a_role;
  else
    v_user := c.participant_a_id; v_role := c.participant_a_role; v_actor_role := c.participant_b_role;
  end if;
  if private.workspace_notification_enabled(v_user, v_role, 'messages') then
    with replaced as (
      delete from public.notifications
      where recipient_id = v_user
        and recipient_role = v_role
        and kind = 'message'
        and conversation_id = c.id
      returning id
    )
    delete from public.notification_reads r
    using replaced
    where r.user_id = v_user and r.notification_id = replaced.id::text;

    insert into public.notifications (recipient_id, recipient_role, actor_id, actor_role, kind, project_id, conversation_id)
    values (v_user, v_role, new.sender_id, v_actor_role, 'message', c.project_id, c.id);
  end if;
  return new;
end;
$$;
revoke all on function public.notify_chat_message() from public, anon, authenticated;

-- 16. One read-receipt system: reading a conversation through
-- sync_chat_activity also marks the individual messages as read. chat-api no
-- longer marks messages as read just because they were fetched.
create or replace function public.sync_chat_activity(
  p_role text,
  p_conversation uuid default null,
  p_read_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := (select auth.uid());
  c public.conversations;
  peer uuid;
  peer_role text;
  seen timestamptz;
  receipt timestamptz;
  v_read_at timestamptz;
begin
  if u is null or not public.has_account_workspace(p_role) then
    raise exception 'Workspace access denied' using errcode = '42501';
  end if;
  if p_conversation is not null then
    select * into c from public.conversations where id = p_conversation;
    if c.participant_a_id = u and c.participant_a_role = p_role then
      peer := c.participant_b_id; peer_role := c.participant_b_role;
    elsif c.participant_b_id = u and c.participant_b_role = p_role then
      peer := c.participant_a_id; peer_role := c.participant_a_role;
    else
      raise exception 'Conversation not found' using errcode = '42501';
    end if;
    if p_read_at is not null then
      v_read_at := least(p_read_at, now());
      insert into private.chat_receipts values (p_conversation, u, v_read_at)
      on conflict (conversation_id, user_id) do update
      set read_at = greatest(chat_receipts.read_at, excluded.read_at);
      update public.messages
      set read_at = now()
      where conversation_id = p_conversation
        and sender_id <> u
        and read_at is null
        and created_at <= v_read_at;
    end if;
    select last_seen into seen from private.chat_activity where user_id = peer and role = peer_role;
    select read_at into receipt from private.chat_receipts where conversation_id = p_conversation and user_id = peer;
  end if;
  insert into private.chat_activity values (u, p_role, now())
  on conflict (user_id, role) do update set last_seen = excluded.last_seen;
  return jsonb_build_object('online', coalesce(seen > now() - interval '35 seconds', false), 'read_at', receipt);
end;
$$;
revoke all on function public.sync_chat_activity(text, uuid, timestamptz) from public, anon;
grant execute on function public.sync_chat_activity(text, uuid, timestamptz) to authenticated;

-- 28. Visitors who are not logged in no longer receive comment author user IDs.
revoke select on public.comments from anon;
grant select (id, project_id, parent_comment_id, text, author_name, author_initials, workspace_role, created_at)
  on public.comments to anon;

-- 17. Periodic cleanup of data that only grows.
create or replace function private.cleanup_old_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications where created_at < now() - interval '90 days';
  delete from public.notification_reads r
  where not exists (select 1 from public.notifications n where n.id::text = r.notification_id);
  delete from private.rate_limit_hits where hit_at < now() - interval '2 days';
  delete from private.registration_network_attempts where attempted_at < now() - interval '1 day';
  delete from private.registration_permits where expires_at <= now();
  delete from private.registration_used_challenges where used_at < now() - interval '2 hours';
  delete from private.whatsapp_phone_challenges where verified_at is null and expires_at < now() - interval '1 day';
  delete from private.chat_activity where last_seen < now() - interval '30 days';
end;
$$;
revoke all on function private.cleanup_old_data() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('devmatch-cleanup-old-data', '17 3 * * *', 'select private.cleanup_old_data()');
    exception when others then
      raise notice 'pg_cron is not available (%). Schedule private.cleanup_old_data() manually.', sqlerrm;
    end;
  end if;
end;
$$;

commit;
