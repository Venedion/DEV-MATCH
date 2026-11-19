begin;

create index if not exists favorites_project_item_idx
  on public.favorites (item_id)
  where item_type = 'project';

create or replace view public.directory_people
with (security_barrier = true)
as
with workspace_profiles as (
  select id,username,account_role,display_name,profile_data,onboarding_complete
  from public.profiles
  union all
  select p.id,p.username,w.role,w.display_name,w.profile_data,w.onboarding_complete
  from public.account_workspaces w
  join public.profiles p on p.id = w.user_id
  where w.role <> p.account_role
),
published_portfolio_views as (
  select p.owner_id,count(*) as total
  from public.projects p
  join public.project_views v on v.project_id = p.id
  where p.project_kind = 'portfolio'
    and p.status = 'published'
  group by p.owner_id
),
published_portfolio_favorites as (
  select p.owner_id,count(*) as total
  from public.projects p
  join public.favorites f on f.item_type = 'project' and f.item_id = p.id
  where p.project_kind = 'portfolio'
    and p.status = 'published'
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
  ), 0) as open_request_count,
  coalesce(views.total, 0) as published_portfolio_views_count,
  coalesce(favorites.total, 0) as published_portfolio_favorites_count
from workspace_profiles p
left join published_portfolio_views views on views.owner_id = p.id
left join published_portfolio_favorites favorites on favorites.owner_id = p.id
where p.onboarding_complete = true;

revoke all on public.directory_people from public, anon, authenticated;
grant select on public.directory_people to authenticated;

commit;
