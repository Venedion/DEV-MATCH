-- Applied to hosted DEV-MATCH after the initial account_profiles migration.
alter table public.profiles
  add column username text check (username ~ '^[A-Za-z0-9_.]{3,24}$'),
  add column phone text check (phone ~ '^\+[1-9][0-9]{8,14}$'),
  add column account_role text not null default 'dev' check (account_role in ('dev','client')),
  add column profile_data jsonb not null default '{}'::jsonb check (jsonb_typeof(profile_data) = 'object'),
  add column onboarding_complete boolean not null default false;
create unique index profiles_username_unique on public.profiles (lower(username)) where username is not null;
grant update (display_name, phone, profile_data, onboarding_complete) on public.profiles to authenticated;
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id,username,phone,account_role)
  values (new.id, nullif(new.raw_user_meta_data->>'username',''),
    nullif(new.raw_user_meta_data->>'phone',''),
    case when new.raw_user_meta_data->>'account_role' = 'client' then 'client' else 'dev' end);
  return new;
end;
$$;
