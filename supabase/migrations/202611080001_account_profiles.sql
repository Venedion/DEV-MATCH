-- Run on a new Supabase project. Supabase Auth manages email and password hashes
-- in auth.users. Never create plaintext password columns in public tables.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy "Read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create function private.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

-- Include users created before this migration.
insert into public.profiles (id)
select id from auth.users on conflict (id) do nothing;

commit;

-- View accounts as project owner in Authentication > Users.
-- Safe owner-only SQL inspection (does not expose password hashes):
-- select id, email, created_at, email_confirmed_at, last_sign_in_at
-- from auth.users order by created_at desc;

