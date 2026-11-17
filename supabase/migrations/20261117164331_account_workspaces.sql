begin;

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


commit;
