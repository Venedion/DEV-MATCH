-- Applied to hosted DEV-MATCH. Run after the initial and registration SQL on a fresh project.
-- Phone ownership remains UNVERIFIED; this release requires email confirmation only.
begin;
create or replace function private.require_verified_onboarding()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.onboarding_complete and
    (not old.onboarding_complete or new.profile_data is distinct from old.profile_data
      or new.display_name is distinct from old.display_name)
    and not exists(select 1 from auth.users u where u.id=new.id and u.email_confirmed_at is not null)
  then raise exception 'Verify your email before completing your profile' using errcode='42501';
  end if;
  return new;
end; $$;
revoke all on function private.require_verified_onboarding() from public,anon,authenticated;
drop trigger if exists require_verified_onboarding on public.profiles;
create trigger require_verified_onboarding before update on public.profiles
  for each row execute function private.require_verified_onboarding();
commit;
