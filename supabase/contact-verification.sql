-- Already applied to DEV-MATCH. Apply once after account-registration.sql
-- when provisioning a fresh project.
alter table public.profiles add column email_verified_at timestamptz,
  add column phone_verified_at timestamptz, add column verified_phone text;
alter table public.profiles add column account_verified boolean generated always as
  (email_verified_at is not null and phone_verified_at is not null
   and phone is not null and verified_phone is not null and phone=verified_phone) stored;

create function private.sync_contact_verification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.profiles set email_verified_at=new.email_confirmed_at,
    phone_verified_at=new.phone_confirmed_at,
    verified_phone=case when nullif(new.phone,'') is not null
      then '+'||ltrim(new.phone,'+') else null end where id=new.id;
  return new;
end; $$;
revoke all on function private.sync_contact_verification() from public,anon,authenticated;
create trigger sync_contact_verification after insert or update of
  email,email_confirmed_at,phone,phone_confirmed_at on auth.users
  for each row execute function private.sync_contact_verification();
update public.profiles p set email_verified_at=u.email_confirmed_at,
  phone_verified_at=u.phone_confirmed_at,
  verified_phone=case when nullif(u.phone,'') is not null then '+'||ltrim(u.phone,'+') else null end
  from auth.users u where p.id=u.id;

create function private.require_verified_onboarding() returns trigger
language plpgsql set search_path='' as $$
begin
  if current_user='authenticated' and new.onboarding_complete
    and (not old.onboarding_complete or new.profile_data is distinct from old.profile_data
      or new.display_name is distinct from old.display_name)
    and not (new.email_verified_at is not null and new.phone_verified_at is not null
      and new.phone is not null and new.verified_phone=new.phone)
  then raise exception 'Verify your email and phone before completing your profile'
    using errcode='42501'; end if;
  return new;
end; $$;
revoke all on function private.require_verified_onboarding() from public,anon,authenticated;
create trigger require_verified_onboarding before update on public.profiles
  for each row execute function private.require_verified_onboarding();
