-- Abuse limits and server-side validation (audit items 6, 9, 10).
begin;

-- Rate limiting -------------------------------------------------------------

create table if not exists private.rate_limit_hits (
  subject uuid not null,
  action text not null,
  hit_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_lookup_idx
  on private.rate_limit_hits (subject, action, hit_at desc);
create index if not exists rate_limit_hits_cleanup_idx
  on private.rate_limit_hits (hit_at);
revoke all on private.rate_limit_hits from public, anon, authenticated;

-- Raises SQLSTATE PT429, which PostgREST returns as HTTP 429.
create or replace function private.enforce_rate_limit(
  p_subject uuid,
  p_action text,
  p_limit integer,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_subject is null then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject::text || ':' || p_action, 0));
  delete from private.rate_limit_hits
  where subject = p_subject and action = p_action and hit_at < now() - p_window;
  select count(*) into v_count
  from private.rate_limit_hits
  where subject = p_subject and action = p_action;
  if v_count >= p_limit then
    raise exception 'Too many requests. Please slow down and try again later.'
      using errcode = 'PT429';
  end if;
  insert into private.rate_limit_hits (subject, action) values (p_subject, p_action);
end;
$$;
revoke all on function private.enforce_rate_limit(uuid, text, integer, interval)
  from public, anon, authenticated;

-- Trigger arguments: subject column, label, limit, window.
create or replace function private.rate_limit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit(
    (to_jsonb(new) ->> tg_argv[0])::uuid,
    tg_table_name || ':' || tg_argv[1],
    tg_argv[2]::integer,
    tg_argv[3]::interval
  );
  return new;
end;
$$;
revoke all on function private.rate_limit_trigger() from public, anon, authenticated;

drop trigger if exists rate_limit_messages_minute on public.messages;
create trigger rate_limit_messages_minute before insert on public.messages
  for each row execute function private.rate_limit_trigger('sender_id', 'minute', '30', '1 minute');
drop trigger if exists rate_limit_messages_day on public.messages;
create trigger rate_limit_messages_day before insert on public.messages
  for each row execute function private.rate_limit_trigger('sender_id', 'day', '2000', '1 day');

drop trigger if exists rate_limit_comments_minute on public.comments;
create trigger rate_limit_comments_minute before insert on public.comments
  for each row execute function private.rate_limit_trigger('user_id', 'minute', '5', '1 minute');
drop trigger if exists rate_limit_comments_day on public.comments;
create trigger rate_limit_comments_day before insert on public.comments
  for each row execute function private.rate_limit_trigger('user_id', 'day', '200', '1 day');

drop trigger if exists rate_limit_favorites_hour on public.favorites;
create trigger rate_limit_favorites_hour before insert on public.favorites
  for each row execute function private.rate_limit_trigger('user_id', 'hour', '120', '1 hour');

drop trigger if exists rate_limit_projects_day on public.projects;
create trigger rate_limit_projects_day before insert on public.projects
  for each row execute function private.rate_limit_trigger('owner_id', 'day', '30', '1 day');

-- Used by chat-api before it creates a conversation (it runs with the service role).
create or replace function public.consume_chat_rate_limit(p_user uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_action = 'start-conversation' then
    perform private.enforce_rate_limit(p_user, 'chat:start-conversation', 20, interval '1 hour');
  else
    raise exception 'Unknown chat rate limit' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.consume_chat_rate_limit(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_chat_rate_limit(uuid, text) to service_role;

-- Server-side validation ----------------------------------------------------

-- NOT VALID: enforced for every new write without rejecting existing rows.
alter table public.profiles drop constraint if exists profiles_profile_data_size;
alter table public.profiles add constraint profiles_profile_data_size
  check (pg_column_size(profile_data) <= 262144) not valid;
alter table public.account_workspaces drop constraint if exists account_workspaces_profile_data_size;
alter table public.account_workspaces add constraint account_workspaces_profile_data_size
  check (pg_column_size(profile_data) <= 262144) not valid;
alter table public.profiles drop constraint if exists profiles_display_name_length;
alter table public.profiles add constraint profiles_display_name_length
  check (char_length(display_name) <= 100) not valid;
alter table public.account_workspaces drop constraint if exists account_workspaces_display_name_length;
alter table public.account_workspaces add constraint account_workspaces_display_name_length
  check (char_length(display_name) <= 100) not valid;

alter table public.projects drop constraint if exists projects_data_size;
alter table public.projects add constraint projects_data_size
  check (pg_column_size(data) <= 131072) not valid;
alter table public.projects drop constraint if exists projects_cover_image_url;
alter table public.projects add constraint projects_cover_image_url
  check (cover_image = '' or (cover_image ~ '^https://[^\s<>"'']+$' and char_length(cover_image) <= 2048)) not valid;

-- Clients cannot choose their own timestamps.
create or replace function private.force_server_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  if tg_table_name = 'projects' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.force_server_timestamps() from public, anon, authenticated;

drop trigger if exists force_server_timestamps on public.projects;
create trigger force_server_timestamps before insert or update on public.projects
  for each row execute function private.force_server_timestamps();
drop trigger if exists force_server_timestamps on public.comments;
create trigger force_server_timestamps before insert or update on public.comments
  for each row execute function private.force_server_timestamps();
drop trigger if exists force_server_timestamps on public.favorites;
create trigger force_server_timestamps before insert or update on public.favorites
  for each row execute function private.force_server_timestamps();

-- Reviews: only after a real collaboration between two verified accounts ----

create or replace function private.validate_project_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_engagement public.project_engagements%rowtype;
  v_client_messages integer;
  v_developer_messages integer;
begin
  select * into v_engagement from public.project_engagements where id = new.engagement_id;
  if not found then
    raise exception 'Project engagement not found' using errcode = '42501';
  end if;
  if v_engagement.created_at > now() - interval '24 hours' then
    raise exception 'Reviews open 24 hours after the collaboration starts' using errcode = '42501';
  end if;
  select count(*) filter (where sender_id = v_engagement.client_id),
         count(*) filter (where sender_id = v_engagement.developer_id)
  into v_client_messages, v_developer_messages
  from public.messages
  where conversation_id = v_engagement.conversation_id;
  if v_client_messages < 3 or v_developer_messages < 3 then
    raise exception 'Both participants need to exchange messages before reviewing' using errcode = '42501';
  end if;
  if not private.has_verified_phone(new.reviewer_id)
    or not private.has_verified_phone(new.reviewed_user_id) then
    raise exception 'Both accounts need a verified phone number before reviewing' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_project_review() from public, anon, authenticated;

drop trigger if exists validate_project_review_before_insert on public.project_reviews;
create trigger validate_project_review_before_insert before insert on public.project_reviews
  for each row execute function private.validate_project_review();

commit;
