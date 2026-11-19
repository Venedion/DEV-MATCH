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
    'contractTypes', p.profile_data->'contractTypes',
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
