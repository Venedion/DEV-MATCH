begin;

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

commit;
