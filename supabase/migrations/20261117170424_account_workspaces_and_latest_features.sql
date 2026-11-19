create function public.get_owned_project_metrics()
returns table (
  project_id text,
  views bigint,
  favorites bigint,
  comments bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    p.id as project_id,
    coalesce(view_counts.total, 0)::bigint as views,
    coalesce(favorite_counts.total, 0)::bigint as favorites,
    coalesce(comment_counts.total, 0)::bigint as comments
  from public.projects p
  left join (
    select pv.project_id, count(*) as total
    from public.project_views pv
    group by pv.project_id
  ) view_counts on view_counts.project_id = p.id
  left join (
    select f.item_id, count(*) as total
    from public.favorites f
    where f.item_type = 'project'
    group by f.item_id
  ) favorite_counts on favorite_counts.item_id = p.id
  left join (
    select c.project_id, count(*) as total
    from public.comments c
    group by c.project_id
  ) comment_counts on comment_counts.project_id = p.id
  where p.owner_id = (select auth.uid())
    and p.project_kind = 'portfolio';
$$;

revoke all on function public.get_owned_project_metrics() from public, anon;
grant execute on function public.get_owned_project_metrics() to authenticated;


alter table public.comments
  add column if not exists parent_comment_id uuid
  references public.comments(id) on delete cascade;

create index if not exists comments_parent_created_idx
  on public.comments (parent_comment_id, created_at);

create or replace function public.can_reply_to_project_comment(
  p_project_id text,
  p_parent_comment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.comments parent
    join public.projects p on p.id = parent.project_id
    where parent.id = p_parent_comment_id
      and parent.project_id = p_project_id
      and parent.user_id <> (select auth.uid())
      and p.owner_id = (select auth.uid())
  );
$$;

revoke all on function public.can_reply_to_project_comment(text, uuid) from public, anon;
grant execute on function public.can_reply_to_project_comment(text, uuid) to authenticated;

drop policy if exists "Read public project comments" on public.comments;
create policy "Read public project comments" on public.comments
  for select to anon, authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and (
          p.status in ('published', 'open')
          or p.owner_id = (select auth.uid())
        )
    )
  );

drop policy if exists "Create own comments on public projects" on public.comments;
create policy "Create own comments and owner replies" on public.comments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      (
        parent_comment_id is null
        and exists (
          select 1
          from public.projects p
          where p.id = project_id
            and p.status in ('published', 'open')
        )
      )
      or (
        parent_comment_id is not null
        and public.can_reply_to_project_comment(project_id, parent_comment_id)
      )
    )
  );

alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('comment', 'reply', 'favorite', 'message'));

create or replace function public.notify_project_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_recipient uuid;
  notification_kind text;
begin
  if new.parent_comment_id is not null then
    select parent.user_id
    into notification_recipient
    from public.comments parent
    where parent.id = new.parent_comment_id
      and parent.project_id = new.project_id;
    notification_kind := 'reply';
  else
    select p.owner_id
    into notification_recipient
    from public.projects p
    where p.id = new.project_id;
    notification_kind := 'comment';
  end if;

  if notification_recipient is not null
    and notification_recipient <> new.user_id
    and not exists (
      select 1
      from public.profiles profile
      where profile.id = notification_recipient
        and profile.profile_data->'notificationPreferences'->>'comments' = 'false'
    )
  then
    insert into public.notifications (recipient_id, actor_id, kind, project_id)
    values (notification_recipient, new.user_id, notification_kind, new.project_id);
  end if;

  return new;
end;
$$;

revoke all on function public.notify_project_comment() from public, anon, authenticated;


create policy "Read projects linked to own conversations" on public.projects
  for select to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.project_id = public.projects.id
        and (select auth.uid()) in (c.participant_a_id, c.participant_b_id)
    )
  );

create table public.project_engagements (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  project_id text references public.projects(id) on delete set null,
  client_id uuid not null references auth.users(id) on delete cascade,
  developer_id uuid not null references auth.users(id) on delete cascade,
  client_completed_at timestamptz,
  developer_completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (client_id <> developer_id)
);

alter table public.project_engagements enable row level security;
revoke all on public.project_engagements from public, anon, authenticated;
grant select on public.project_engagements to authenticated;

create policy "Read own project engagements" on public.project_engagements
  for select to authenticated
  using ((select auth.uid()) in (client_id, developer_id));

create table public.project_reviews (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.project_engagements(id) on delete cascade,
  project_id text references public.projects(id) on delete set null,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewed_user_id uuid not null references auth.users(id) on delete cascade,
  reviewer_name text not null,
  reviewer_initials text not null,
  project_title text not null,
  rating smallint not null check (rating between 1 and 5),
  text text not null default '' check (char_length(text) <= 2000),
  created_at timestamptz not null default now(),
  unique (engagement_id, reviewer_id),
  check (reviewer_id <> reviewed_user_id)
);

create index project_reviews_recipient_created_idx
  on public.project_reviews (reviewed_user_id, created_at desc);

alter table public.project_reviews enable row level security;
revoke all on public.project_reviews from public, anon, authenticated;

create function public.get_profile_reviews(p_profile_id uuid)
returns table (
  id uuid,
  reviewer_name text,
  reviewer_initials text,
  project_title text,
  rating smallint,
  text text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.reviewer_name, r.reviewer_initials, r.project_title, r.rating, r.text, r.created_at
  from public.project_reviews r
  where r.reviewed_user_id = p_profile_id
  order by r.created_at desc;
$$;

revoke all on function public.get_profile_reviews(uuid) from public, anon, authenticated;
grant execute on function public.get_profile_reviews(uuid) to anon, authenticated;

create function public.get_my_project_review(p_engagement_id uuid)
returns table (
  id uuid,
  reviewer_name text,
  reviewer_initials text,
  project_title text,
  rating smallint,
  text text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.reviewer_name, r.reviewer_initials, r.project_title, r.rating, r.text, r.created_at
  from public.project_reviews r
  where r.engagement_id = p_engagement_id
    and r.reviewer_id = (select auth.uid());
$$;

revoke all on function public.get_my_project_review(uuid) from public, anon, authenticated;
grant execute on function public.get_my_project_review(uuid) to authenticated;

create function public.start_project_engagement(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
  v_owner_id uuid;
  v_project_kind text;
  v_project_status text;
  v_role_a text;
  v_role_b text;
  v_client_id uuid;
  v_developer_id uuid;
  v_engagement_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  select *
  into v_conversation
  from public.conversations
  where id = p_conversation_id;

  if not found or auth.uid() not in (v_conversation.participant_a_id, v_conversation.participant_b_id) then
    raise exception 'A conversation participant is required'
      using errcode = '42501';
  end if;

  if v_conversation.project_id is null then
    raise exception 'A project-linked conversation is required'
      using errcode = '23514';
  end if;

  select id
  into v_engagement_id
  from public.project_engagements
  where conversation_id = v_conversation.id;

  if found then
    return v_engagement_id;
  end if;

  select owner_id, project_kind, status
  into v_owner_id, v_project_kind, v_project_status
  from public.projects
  where id = v_conversation.project_id;

  if not found or v_project_status = 'draft' then
    raise exception 'The linked project is not available for review'
      using errcode = '23514';
  end if;

  select account_role into v_role_a
  from public.profiles
  where id = v_conversation.participant_a_id;
  select account_role into v_role_b
  from public.profiles
  where id = v_conversation.participant_b_id;

  if v_role_a = 'client' and v_role_b = 'dev' then
    v_client_id := v_conversation.participant_a_id;
    v_developer_id := v_conversation.participant_b_id;
  elsif v_role_a = 'dev' and v_role_b = 'client' then
    v_client_id := v_conversation.participant_b_id;
    v_developer_id := v_conversation.participant_a_id;
  else
    raise exception 'Reviews require one client and one developer'
      using errcode = '23514';
  end if;

  if v_owner_id not in (v_client_id, v_developer_id)
    or (v_project_kind = 'portfolio' and v_owner_id <> v_developer_id)
    or (v_project_kind = 'request' and v_owner_id <> v_client_id) then
    raise exception 'The linked project does not belong to a conversation participant'
      using errcode = '23514';
  end if;

  insert into public.project_engagements (conversation_id, project_id, client_id, developer_id)
  values (v_conversation.id, v_conversation.project_id, v_client_id, v_developer_id)
  on conflict (conversation_id) do nothing;

  select id
  into v_engagement_id
  from public.project_engagements
  where conversation_id = v_conversation.id;

  return v_engagement_id;
end;
$$;

revoke all on function public.start_project_engagement(uuid) from public, anon, authenticated;
grant execute on function public.start_project_engagement(uuid) to authenticated;

create function public.confirm_project_engagement(p_engagement_id uuid)
returns public.project_engagements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_engagement public.project_engagements%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  update public.project_engagements
  set client_completed_at = case
        when client_id = auth.uid() then coalesce(client_completed_at, now())
        else client_completed_at
      end,
      developer_completed_at = case
        when developer_id = auth.uid() then coalesce(developer_completed_at, now())
        else developer_completed_at
      end
  where id = p_engagement_id
    and auth.uid() in (client_id, developer_id)
  returning * into v_engagement;

  if not found then
    raise exception 'Project engagement not found or access denied'
      using errcode = '42501';
  end if;

  return v_engagement;
end;
$$;

revoke all on function public.confirm_project_engagement(uuid) from public, anon, authenticated;
grant execute on function public.confirm_project_engagement(uuid) to authenticated;

create function public.submit_project_review(
  p_engagement_id uuid,
  p_rating smallint,
  p_text text default ''
)
returns table (
  id uuid,
  reviewer_name text,
  reviewer_initials text,
  project_title text,
  rating smallint,
  text text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_engagement public.project_engagements%rowtype;
  v_review public.project_reviews%rowtype;
  v_profile_name text;
  v_name_parts text[];
  v_reviewed_user_id uuid;
  v_project_title text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if p_rating is null or p_rating not between 1 and 5
    or char_length(coalesce(p_text, '')) > 2000 then
    raise exception 'A rating from 1 to 5 and a comment up to 2000 characters are required'
      using errcode = '23514';
  end if;

  select *
  into v_engagement
  from public.project_engagements
  where id = p_engagement_id;

  if not found
    or v_engagement.client_completed_at is null
    or v_engagement.developer_completed_at is null then
    raise exception 'Both participants must confirm completion before reviewing'
      using errcode = '23514';
  end if;

  if auth.uid() = v_engagement.client_id then
    v_reviewed_user_id := v_engagement.developer_id;
  elsif auth.uid() = v_engagement.developer_id then
    v_reviewed_user_id := v_engagement.client_id;
  else
    raise exception 'Only an engagement participant can submit a review'
      using errcode = '42501';
  end if;

  select nullif(trim(display_name), '')
  into v_profile_name
  from public.profiles
  where id = auth.uid();

  if v_profile_name is null then
    raise exception 'A profile name is required to submit a review'
      using errcode = '23514';
  end if;

  select title
  into v_project_title
  from public.projects
  where id = v_engagement.project_id;

  v_name_parts := regexp_split_to_array(v_profile_name, '\s+');
  insert into public.project_reviews (
    engagement_id,
    project_id,
    reviewer_id,
    reviewed_user_id,
    reviewer_name,
    reviewer_initials,
    project_title,
    rating,
    text
  )
  values (
    v_engagement.id,
    v_engagement.project_id,
    auth.uid(),
    v_reviewed_user_id,
    v_profile_name,
    upper(left(v_name_parts[1], 1) || coalesce(left(v_name_parts[2], 1), '')),
    coalesce(v_project_title, ''),
    p_rating,
    trim(coalesce(p_text, ''))
  )
  returning * into v_review;

  return query
  select v_review.id, v_review.reviewer_name, v_review.reviewer_initials,
    v_review.project_title, v_review.rating, v_review.text, v_review.created_at;
end;
$$;

revoke all on function public.submit_project_review(uuid, smallint, text) from public, anon, authenticated;
grant execute on function public.submit_project_review(uuid, smallint, text) to authenticated;

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
      and tablename = 'project_engagements'
  ) then
    execute 'alter publication supabase_realtime add table public.project_engagements';
  end if;
end;
$$;


-- Original profiles remain canonical for their initial role; no global active role.
create table public.account_workspaces (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('client','dev')),
  display_name text not null default '',
  profile_data jsonb not null default '{}'::jsonb check (jsonb_typeof(profile_data) = 'object'),
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id,role)
);
alter table public.account_workspaces enable row level security;
revoke all on public.account_workspaces from public, anon, authenticated;
grant select on public.account_workspaces to authenticated;
grant update (display_name,profile_data,onboarding_complete) on public.account_workspaces to authenticated;
create policy "Read own workspaces" on public.account_workspaces
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Update own workspaces" on public.account_workspaces
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.has_account_workspace(p_role text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and account_role = p_role)
    or exists (select 1 from public.account_workspaces where user_id = (select auth.uid()) and role = p_role);
$$;
revoke all on function public.has_account_workspace(text) from public, anon;
grant execute on function public.has_account_workspace(text) to authenticated;

create function public.switch_account_workspace(p_role text, p_create boolean default false)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_target public.account_workspaces;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_role is null or p_role not in ('client','dev') then raise exception 'Invalid workspace' using errcode = '22023'; end if;
  select * into strict v_profile from public.profiles where id = v_user;
  if v_profile.account_role = p_role then return v_profile; end if;
  if p_create then
    if not exists (select 1 from auth.users where id = v_user and email_confirmed_at is not null) then
      raise exception 'Verify your email first' using errcode = '42501';
    end if;
    insert into public.account_workspaces (user_id,role,display_name)
      values (v_user,p_role,v_profile.display_name) on conflict (user_id,role) do nothing;
  end if;
  select * into v_target from public.account_workspaces where user_id = v_user and role = p_role;
  if not found then raise exception 'Workspace does not exist' using errcode = 'P0002'; end if;
  v_profile.account_role := v_target.role;
  v_profile.display_name := v_target.display_name;
  v_profile.profile_data := v_target.profile_data;
  v_profile.onboarding_complete := v_target.onboarding_complete;
  return v_profile;
end;
$$;
revoke all on function public.switch_account_workspace(text,boolean) from public, anon;
grant execute on function public.switch_account_workspace(text,boolean) to authenticated;

alter policy "Create own projects" on public.projects with check (
  owner_id = (select auth.uid()) and public.has_account_workspace(case project_kind when 'portfolio' then 'dev' when 'request' then 'client' end)
);
alter policy "Update own projects" on public.projects with check (
  owner_id = (select auth.uid()) and public.has_account_workspace(case project_kind when 'portfolio' then 'dev' when 'request' then 'client' end)
);

create or replace view public.directory_people
with (security_barrier = true)
as
with workspace_profiles as (
  select id,username,account_role,display_name,profile_data,onboarding_complete from public.profiles
  union all
  select p.id,p.username,w.role,w.display_name,w.profile_data,w.onboarding_complete
  from public.account_workspaces w join public.profiles p on p.id = w.user_id
  where w.role <> p.account_role
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
from workspace_profiles p
where p.onboarding_complete = true;

revoke all on public.directory_people from public, anon, authenticated;
grant select on public.directory_people to authenticated;


drop policy "Read authorized private uploads" on storage.objects;
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
                and public.has_account_workspace('dev')
              )
            )
        )
      )
    )
  );


create function public.get_dashboard_metrics(p_role text)
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

  if not public.has_account_workspace(p_role) then raise exception 'Workspace access denied' using errcode = '42501'; end if;

  select count(*)::integer
  into metric_projects
  from public.projects p
  where p.owner_id = current_user_id
    and p.project_kind = case p_role when 'client' then 'request' else 'portfolio' end;

  select count(*)::integer
  into metric_views
  from public.project_views v
  join public.projects p on p.id = v.project_id
  where p.owner_id = current_user_id
    and p.project_kind = case p_role when 'client' then 'request' else 'portfolio' end;

  select count(*)::integer
  into metric_favorites
  from public.favorites f
  join public.projects p on p.id = f.item_id
  where p.owner_id = current_user_id
    and f.item_type = 'project'
    and p.project_kind = case p_role when 'client' then 'request' else 'portfolio' end;

  select count(*)::integer
  into metric_comments
  from public.comments c
  join public.projects p on p.id = c.project_id
  where p.owner_id = current_user_id
    and p.project_kind = case p_role when 'client' then 'request' else 'portfolio' end;

  return jsonb_build_object(
    'projects', metric_projects,
    'views', metric_views,
    'favorites', metric_favorites,
    'comments', metric_comments
  );
end;
$$;

revoke all on function public.get_dashboard_metrics(text) from public, anon;
grant execute on function public.get_dashboard_metrics(text) to authenticated;


create or replace function public.start_project_engagement(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
  v_owner_id uuid;
  v_project_kind text;
  v_project_status text;
  v_role_a text;
  v_role_b text;
  v_client_id uuid;
  v_developer_id uuid;
  v_engagement_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  select *
  into v_conversation
  from public.conversations
  where id = p_conversation_id;

  if not found or auth.uid() not in (v_conversation.participant_a_id, v_conversation.participant_b_id) then
    raise exception 'A conversation participant is required'
      using errcode = '42501';
  end if;

  if v_conversation.project_id is null then
    raise exception 'A project-linked conversation is required'
      using errcode = '23514';
  end if;

  select id
  into v_engagement_id
  from public.project_engagements
  where conversation_id = v_conversation.id;

  if found then
    return v_engagement_id;
  end if;

  select owner_id, project_kind, status
  into v_owner_id, v_project_kind, v_project_status
  from public.projects
  where id = v_conversation.project_id;

  if not found or v_project_status = 'draft' then
    raise exception 'The linked project is not available for review'
      using errcode = '23514';
  end if;

  if v_project_kind = 'portfolio' then
    v_developer_id := v_owner_id;
    v_client_id := case when v_conversation.participant_a_id = v_owner_id then v_conversation.participant_b_id else v_conversation.participant_a_id end;
  else
    v_client_id := v_owner_id;
    v_developer_id := case when v_conversation.participant_a_id = v_owner_id then v_conversation.participant_b_id else v_conversation.participant_a_id end;
  end if;
  if not exists (select 1 from public.directory_people where id = v_client_id and account_role = 'client')
    or not exists (select 1 from public.directory_people where id = v_developer_id and account_role = 'dev') then
    raise exception 'Reviews require completed client and developer profiles' using errcode = '23514';
  end if;

  if v_owner_id not in (v_client_id, v_developer_id)
    or (v_project_kind = 'portfolio' and v_owner_id <> v_developer_id)
    or (v_project_kind = 'request' and v_owner_id <> v_client_id) then
    raise exception 'The linked project does not belong to a conversation participant'
      using errcode = '23514';
  end if;

  insert into public.project_engagements (conversation_id, project_id, client_id, developer_id)
  values (v_conversation.id, v_conversation.project_id, v_client_id, v_developer_id)
  on conflict (conversation_id) do nothing;

  select id
  into v_engagement_id
  from public.project_engagements
  where conversation_id = v_conversation.id;

  return v_engagement_id;
end;
$$;

revoke all on function public.start_project_engagement(uuid) from public, anon, authenticated;
grant execute on function public.start_project_engagement(uuid) to authenticated;


;
