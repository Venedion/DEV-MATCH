begin;

create table public.notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_id text not null check (char_length(notification_id) between 1 and 160),
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

alter table public.notification_reads enable row level security;
revoke all on public.notification_reads from public, anon, authenticated;
grant select, insert, update on public.notification_reads to authenticated;

create policy "Read own notification state" on public.notification_reads
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Mark own notifications read" on public.notification_reads
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own notification state" on public.notification_reads
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('project', 'developer', 'client')),
  item_id text not null check (char_length(item_id) between 1 and 160),
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

alter table public.favorites enable row level security;
revoke all on public.favorites from public, anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;

create policy "Read own favorites" on public.favorites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own favorites" on public.favorites
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Delete own favorites" on public.favorites
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.save_notification_preferences(p_preferences jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_profile_data jsonb;
begin
  if jsonb_typeof(p_preferences) is distinct from 'object'
    or exists (
      select 1
      from jsonb_each(p_preferences) as preference
      where preference.key not in ('comments', 'messages', 'favorites', 'ratings')
        or jsonb_typeof(preference.value) is distinct from 'boolean'
    )
  then
    raise exception 'Notification preferences must contain supported boolean values'
      using errcode = '22023';
  end if;

  update public.profiles
  set profile_data = profile_data || jsonb_build_object('notificationPreferences', p_preferences)
  where id = (select auth.uid())
  returning profile_data into updated_profile_data;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  return updated_profile_data;
end;
$$;

revoke all on function public.save_notification_preferences(jsonb) from public, anon;
grant execute on function public.save_notification_preferences(jsonb) to authenticated;


create table public.projects (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_kind text not null check (project_kind in ('portfolio', 'request')),
  legacy_id text,
  title text not null default '' check (char_length(title) <= 160),
  project_type text not null default '' check (char_length(project_type) <= 80),
  category text not null default '' check (char_length(category) <= 100),
  price text not null default '' check (char_length(price) <= 160),
  price_type text not null default '' check (char_length(price_type) <= 80),
  cover_image text not null default '',
  status text not null default 'draft',
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, project_kind, legacy_id),
  check (
    (project_kind = 'portfolio' and status in ('draft', 'published'))
    or (project_kind = 'request' and status in ('draft', 'open', 'closed'))
  )
);

create index projects_public_listing_idx
  on public.projects (project_kind, status, updated_at desc);
create index projects_owner_listing_idx
  on public.projects (owner_id, project_kind, updated_at desc);

alter table public.projects enable row level security;
revoke all on public.projects from public, anon, authenticated;
grant select on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;

create policy "Read public projects and own drafts" on public.projects
  for select to anon, authenticated
  using (
    status in ('published', 'open')
    or (select auth.uid()) = owner_id
  );
create policy "Create own projects" on public.projects
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and account_role = case project_kind
          when 'portfolio' then 'dev'
          when 'request' then 'client'
        end
    )
  );
create policy "Update own projects" on public.projects
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and account_role = case project_kind
          when 'portfolio' then 'dev'
          when 'request' then 'client'
        end
    )
  );
create policy "Delete own projects" on public.projects
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id text not null check (char_length(project_id) between 1 and 160),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 5000),
  author_name text not null default '',
  author_initials text not null default '',
  created_at timestamptz not null default now()
);

create index comments_project_created_idx
  on public.comments (project_id, created_at);

alter table public.comments enable row level security;
revoke all on public.comments from public, anon, authenticated;
grant select on public.comments to anon, authenticated;
grant insert, delete on public.comments to authenticated;

create policy "Read project comments" on public.comments
  for select to anon, authenticated
  using (true);
create policy "Create own project comments" on public.comments
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Delete own project comments" on public.comments
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create function public.set_project_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
  name_parts text[];
begin
  select nullif(trim(display_name), '')
  into profile_name
  from public.profiles
  where id = new.user_id;

  if profile_name is null then
    raise exception 'A profile name is required to comment'
      using errcode = '23514';
  end if;

  name_parts := regexp_split_to_array(profile_name, '\s+');
  new.author_name := profile_name;
  new.author_initials := upper(left(name_parts[1], 1) || coalesce(left(name_parts[2], 1), ''));
  return new;
end;
$$;

revoke all on function public.set_project_comment_author() from public, anon, authenticated;
create trigger set_project_comment_author_before_insert
  before insert on public.comments
  for each row execute function public.set_project_comment_author();

create function public.delete_project_comments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.comments where project_id = old.id;
  return old;
end;
$$;

revoke all on function public.delete_project_comments() from public, anon, authenticated;
create trigger delete_comments_after_project_delete
  after delete on public.projects
  for each row execute function public.delete_project_comments();


create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_a_id uuid not null references auth.users(id) on delete cascade,
  participant_b_id uuid not null references auth.users(id) on delete cascade,
  project_id text check (char_length(project_id) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  check (participant_a_id <> participant_b_id)
);

create unique index conversations_participants_unique_idx
  on public.conversations (
    least(participant_a_id, participant_b_id),
    greatest(participant_a_id, participant_b_id),
    coalesce(project_id, '')
  );

create index conversations_participant_a_idx
  on public.conversations (participant_a_id, updated_at desc);
create index conversations_participant_b_idx
  on public.conversations (participant_b_id, updated_at desc);

alter table public.conversations enable row level security;
revoke all on public.conversations from public, anon, authenticated;
grant select, insert on public.conversations to authenticated;

create policy "Read own conversations" on public.conversations
  for select to authenticated
  using (
    (select auth.uid()) in (participant_a_id, participant_b_id)
  );

create policy "Create conversation for self" on public.conversations
  for insert to authenticated
  with check (
    (select auth.uid()) in (participant_a_id, participant_b_id)
    and participant_a_id <> participant_b_id
  );

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 5000),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);
create index messages_sender_created_idx
  on public.messages (sender_id, created_at desc);

alter table public.messages enable row level security;
revoke all on public.messages from public, anon, authenticated;
grant select, insert, update, delete on public.messages to authenticated;

create policy "Read conversation messages" on public.messages
  for select to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.participant_a_id, c.participant_b_id)
    )
  );

create policy "Create own conversation messages" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.participant_a_id, c.participant_b_id)
    )
  );

create policy "Update own conversation messages" on public.messages
  for update to authenticated
  using (sender_id = (select auth.uid()))
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.participant_a_id, c.participant_b_id)
    )
  );

create policy "Delete own conversation messages" on public.messages
  for delete to authenticated
  using (sender_id = (select auth.uid()));

create function public.touch_conversation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set updated_at = now(),
      last_message_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function public.touch_conversation_updated_at() from public, anon, authenticated;

create trigger conversations_touch_on_insert
  after insert on public.messages
  for each row execute function public.touch_conversation_updated_at();

create or replace view public.directory_people as
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
    'availability', p.profile_data->'availability',
    'companyName', p.profile_data->'companyName',
    'industry', p.profile_data->'industry'
  )) as profile_data,
  coalesce((
    select count(*)
    from public.projects prj
    where prj.owner_id = p.id
      and prj.project_kind = 'portfolio'
      and prj.status = 'published'
  ), 0) as published_portfolio_count,
  coalesce((
    select count(*)
    from public.projects prj
    where prj.owner_id = p.id
      and prj.project_kind = 'request'
      and prj.status = 'open'
  ), 0) as open_request_count
from public.profiles p
where p.onboarding_complete = true;

revoke all on public.directory_people from public, anon, authenticated;
grant select on public.directory_people to authenticated;


drop index if exists public.conversations_participants_unique_idx;
create unique index conversations_participants_unique_idx
  on public.conversations (
    least(participant_a_id, participant_b_id),
    greatest(participant_a_id, participant_b_id),
    coalesce(project_id, '')
  );

drop policy if exists "Read project comments" on public.comments;
create policy "Read public project comments" on public.comments
  for select to anon, authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.status in ('published', 'open')
    )
  );

drop policy if exists "Create own project comments" on public.comments;
create policy "Create own comments on public projects" on public.comments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.status in ('published', 'open')
    )
  );


alter table public.profiles enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  loop
    execute format('drop policy %I on public.profiles', existing_policy.policyname);
  end loop;
end;
$$;

revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, phone, profile_data, onboarding_complete)
  on public.profiles to authenticated;

create policy "Read own profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "Update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace view public.directory_people
with (security_barrier = true)
as
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
    'availability', p.profile_data->'availability',
    'companyName', p.profile_data->'companyName',
    'industry', p.profile_data->'industry'
  )) as profile_data,
  coalesce((
    select count(*)
    from public.projects prj
    where prj.owner_id = p.id
      and prj.project_kind = 'portfolio'
      and prj.status = 'published'
  ), 0) as published_portfolio_count,
  coalesce((
    select count(*)
    from public.projects prj
    where prj.owner_id = p.id
      and prj.project_kind = 'request'
      and prj.status = 'open'
  ), 0) as open_request_count
from public.profiles p
where p.onboarding_complete = true;

revoke all on public.directory_people from public, anon, authenticated;
grant select on public.directory_people to authenticated;


do $$
begin
  if exists (select 1 from public.messages limit 1) then
    raise exception 'public.messages contains plaintext rows; encrypt or export them before applying the chat security migration';
  end if;
end;
$$;

alter table public.messages drop column text;
alter table public.messages drop column metadata;
alter table public.messages
  add column ciphertext text not null
    check (char_length(ciphertext) between 22 and 40000
      and ciphertext ~ '^[A-Za-z0-9_-]+$'),
  add column nonce text not null
    check (char_length(nonce) = 16 and nonce ~ '^[A-Za-z0-9_-]+$'),
  add column key_version smallint not null
    check (key_version between 1 and 32767);

drop policy "Create own conversation messages" on public.messages;
drop policy "Update own conversation messages" on public.messages;
drop policy "Delete own conversation messages" on public.messages;
drop policy "Read conversation messages" on public.messages;

create policy "Read conversation messages" on public.messages
  for select to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.participant_a_id, c.participant_b_id)
    )
  );

revoke all on public.messages from public, anon, authenticated;
grant select on public.messages to authenticated;
grant all on public.messages to service_role;
grant select on public.profiles, public.directory_people, public.projects to service_role;

drop policy "Create conversation for self" on public.conversations;
revoke all on public.conversations from public, anon, authenticated;
grant select on public.conversations to authenticated;
grant all on public.conversations to service_role;

create function private.validate_chat_message_sender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.conversations c
    where c.id = new.conversation_id
      and new.sender_id in (c.participant_a_id, c.participant_b_id)
  ) then
    raise exception 'Message sender must belong to the conversation'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_chat_message_sender()
  from public, anon, authenticated;

create trigger validate_chat_message_sender_before_insert
  before insert on public.messages
  for each row execute function private.validate_chat_message_sender();

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'Supabase Realtime publication is missing';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end;
$$;


create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('comment', 'favorite', 'message')),
  project_id text references public.projects(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (project_id is not null or conversation_id is not null)
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;

create policy "Read own notifications" on public.notifications
  for select to authenticated
  using ((select auth.uid()) = recipient_id);

create table public.project_views (
  project_id text not null references public.projects(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_on date not null,
  primary key (project_id, viewer_id, viewed_on)
);

create index project_views_project_idx on public.project_views (project_id);

alter table public.project_views enable row level security;
revoke all on public.project_views from public, anon, authenticated;
grant select on public.project_views to authenticated;

create policy "Project owners read view counts" on public.project_views
  for select to authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_views.project_id
        and p.owner_id = (select auth.uid())
    )
  );

create function public.record_project_view(p_project_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  view_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to record a project view'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.status in ('published', 'open')
  ) then
    raise exception 'The project is not publicly available'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.owner_id = current_user_id
  ) then
    insert into public.project_views (project_id, viewer_id, viewed_on)
    values (p_project_id, current_user_id, (timezone('utc', now()))::date)
    on conflict do nothing;
    return null;
  end if;

  select count(*)::integer
  into view_count
  from public.project_views
  where project_id = p_project_id;

  return view_count;
end;
$$;

revoke all on function public.record_project_view(text) from public, anon;
grant execute on function public.record_project_view(text) to authenticated;

create function public.get_dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  metric_projects integer;
  metric_views integer;
  metric_favorites integer;
  metric_comments integer;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to load dashboard metrics'
      using errcode = '28000';
  end if;

  select count(*)::integer
  into metric_projects
  from public.projects p
  where p.owner_id = current_user_id
    and p.project_kind = case
      when exists (
        select 1 from public.profiles profile
        where profile.id = current_user_id and profile.account_role = 'client'
      ) then 'request'
      else 'portfolio'
    end;

  select count(*)::integer
  into metric_views
  from public.project_views v
  join public.projects p on p.id = v.project_id
  where p.owner_id = current_user_id;

  select count(*)::integer
  into metric_favorites
  from public.favorites f
  join public.projects p on p.id = f.item_id
  where p.owner_id = current_user_id
    and f.item_type = 'project';

  select count(*)::integer
  into metric_comments
  from public.comments c
  join public.projects p on p.id = c.project_id
  where p.owner_id = current_user_id;

  return jsonb_build_object(
    'projects', metric_projects,
    'views', metric_views,
    'favorites', metric_favorites,
    'comments', metric_comments
  );
end;
$$;

revoke all on function public.get_dashboard_metrics() from public, anon;
grant execute on function public.get_dashboard_metrics() to authenticated;

create function public.notify_project_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_owner uuid;
begin
  select p.owner_id
  into project_owner
  from public.projects p
  where p.id = new.project_id;

  if project_owner is not null
    and project_owner <> new.user_id
    and not exists (
      select 1
      from public.profiles profile
      where profile.id = project_owner
        and profile.profile_data->'notificationPreferences'->>'comments' = 'false'
    )
  then
    insert into public.notifications (recipient_id, actor_id, kind, project_id)
    values (project_owner, new.user_id, 'comment', new.project_id);
  end if;

  return new;
end;
$$;

revoke all on function public.notify_project_comment() from public, anon, authenticated;
create trigger notify_project_comment_after_insert
  after insert on public.comments
  for each row execute function public.notify_project_comment();

create function public.notify_project_favorite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_owner uuid;
begin
  if new.item_type <> 'project' then
    return new;
  end if;

  select p.owner_id
  into project_owner
  from public.projects p
  where p.id = new.item_id;

  if project_owner is not null
    and project_owner <> new.user_id
    and not exists (
      select 1
      from public.profiles profile
      where profile.id = project_owner
        and profile.profile_data->'notificationPreferences'->>'favorites' = 'false'
    )
  then
    insert into public.notifications (recipient_id, actor_id, kind, project_id)
    values (project_owner, new.user_id, 'favorite', new.item_id);
  end if;

  return new;
end;
$$;

revoke all on function public.notify_project_favorite() from public, anon, authenticated;
create trigger notify_project_favorite_after_insert
  after insert on public.favorites
  for each row execute function public.notify_project_favorite();

create function public.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  other_participant uuid;
begin
  select case
    when c.participant_a_id = new.sender_id then c.participant_b_id
    else c.participant_a_id
  end
  into other_participant
  from public.conversations c
  where c.id = new.conversation_id
    and new.sender_id in (c.participant_a_id, c.participant_b_id);

  if other_participant is not null
    and not exists (
      select 1
      from public.profiles profile
      where profile.id = other_participant
        and profile.profile_data->'notificationPreferences'->>'messages' = 'false'
    )
  then
    insert into public.notifications (recipient_id, actor_id, kind, project_id, conversation_id)
    select other_participant, new.sender_id, 'message', c.project_id, c.id
    from public.conversations c
    where c.id = new.conversation_id;
  end if;

  return new;
end;
$$;

revoke all on function public.notify_chat_message() from public, anon, authenticated;
create trigger notify_chat_message_after_insert
  after insert on public.messages
  for each row execute function public.notify_chat_message();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('project-media', 'project-media', true, 52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']),
  ('private-uploads', 'private-uploads', false, 10485760,
    array['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/webp']),
  ('chat-attachments', 'chat-attachments', false, 3145728,
    array['application/octet-stream'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Read public project media" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'project-media');

create policy "Upload own project media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Update own project media" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Delete own project media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Read authorized private uploads" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'private-uploads'
    and (
      (
        (storage.foldername(name))[1] = 'experience'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or (
        (storage.foldername(name))[1] = 'request'
        and exists (
          select 1
          from public.projects p
          where p.id = (storage.foldername(name))[3]
            and p.owner_id::text = (storage.foldername(name))[2]
            and (
              p.owner_id = (select auth.uid())
              or (
                p.project_kind = 'request'
                and p.status = 'open'
                and exists (
                  select 1 from public.profiles profile
                  where profile.id = (select auth.uid())
                    and profile.account_role = 'dev'
                )
              )
            )
        )
      )
    )
  );

create policy "Upload own private files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'private-uploads'
    and (
      (
        (storage.foldername(name))[1] = 'experience'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or (
        (storage.foldername(name))[1] = 'request'
        and (storage.foldername(name))[2] = (select auth.uid())::text
        and exists (
          select 1
          from public.projects p
          where p.id = (storage.foldername(name))[3]
            and p.owner_id = (select auth.uid())
            and p.project_kind = 'request'
        )
      )
    )
  );

create policy "Update own private files" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'private-uploads'
    and (
      ((storage.foldername(name))[1] = 'experience'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'request'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
    )
  )
  with check (
    bucket_id = 'private-uploads'
    and (
      ((storage.foldername(name))[1] = 'experience'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'request'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
    )
  );

create policy "Read encrypted chat attachments" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-attachments'
    and exists (
      select 1
      from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (c.participant_a_id, c.participant_b_id)
        and (storage.foldername(name))[2] in (
          c.participant_a_id::text,
          c.participant_b_id::text
        )
    )
  );

create policy "Delete own private files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'private-uploads'
    and (
      ((storage.foldername(name))[1] = 'experience'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'request'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
    )
  );


commit;;
