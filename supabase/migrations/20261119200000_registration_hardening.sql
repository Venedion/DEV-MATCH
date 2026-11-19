-- Registration hardening (audit items 2, 8, 25, 27).
-- * Reinstalls the signup trigger that 20261114162904 left out in production.
-- * OAuth/SSO sign-ups and users created by an administrator no longer need a permit.
-- * Proof-of-work challenges can be redeemed only once.
-- * Clear error when a username is already taken, plus an availability RPC.
begin;

create schema if not exists private;

create table if not exists private.registration_network_attempts (
  network cidr not null,
  attempted_at timestamptz not null default now()
);
create index if not exists registration_network_attempts_window_idx
  on private.registration_network_attempts (network, attempted_at desc);
create index if not exists registration_network_attempts_cleanup_idx
  on private.registration_network_attempts (attempted_at);

create table if not exists private.registration_permits (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  email text not null,
  expires_at timestamptz not null
);
create index if not exists registration_permits_expiry_idx
  on private.registration_permits (expires_at);

create table if not exists private.registration_used_challenges (
  challenge_hash text primary key check (challenge_hash ~ '^[0-9a-f]{64}$'),
  used_at timestamptz not null default now()
);
create index if not exists registration_used_challenges_used_idx
  on private.registration_used_challenges (used_at);

revoke all on private.registration_network_attempts from public, anon, authenticated;
revoke all on private.registration_permits from public, anon, authenticated;
revoke all on private.registration_used_challenges from public, anon, authenticated;

-- New signature: the challenge hash is optional so an Edge Function deployed
-- before this migration keeps working until it is redeployed.
drop function if exists public.issue_registration_permit(text, inet, text);

create or replace function public.issue_registration_permit(
  p_email text,
  p_ip inet,
  p_token_hash text,
  p_challenge_hash text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_network cidr;
  v_attempt_count integer;
  v_email_count integer;
begin
  if p_email is null or char_length(p_email) > 254 or p_ip is null
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or (p_challenge_hash is not null and p_challenge_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Invalid registration permit request' using errcode = '22023';
  end if;

  if p_challenge_hash is not null then
    delete from private.registration_used_challenges
    where used_at < now() - interval '2 hours';
    insert into private.registration_used_challenges (challenge_hash)
    values (p_challenge_hash)
    on conflict (challenge_hash) do nothing;
    if not found then
      raise exception 'Registration challenge was already used' using errcode = '23505';
    end if;
  end if;

  v_network := set_masklen(p_ip, case family(p_ip) when 4 then 24 else 64 end)::cidr;
  perform pg_advisory_xact_lock(hashtextextended(v_network::text, 0));

  delete from private.registration_network_attempts
  where attempted_at < now() - interval '24 hours';
  delete from private.registration_permits
  where expires_at <= now();

  select count(*) into v_attempt_count
  from private.registration_network_attempts
  where network = v_network
    and attempted_at > now() - interval '1 hour';

  select count(*) into v_email_count
  from private.registration_permits
  where email = lower(trim(p_email));

  if v_attempt_count >= 5 or v_email_count >= 3 then
    return false;
  end if;

  insert into private.registration_network_attempts (network) values (v_network);
  insert into private.registration_permits (token_hash, email, expires_at)
  values (p_token_hash, lower(trim(p_email)), now() + interval '10 minutes');

  return true;
end;
$$;

revoke all on function public.issue_registration_permit(text, inet, text, text)
  from public, anon, authenticated;
grant execute on function public.issue_registration_permit(text, inet, text, text)
  to service_role;

create or replace function private.require_registration_permit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_permit text;
  v_token_hash text;
  v_provider text := coalesce(new.raw_app_meta_data->>'provider', 'email');
begin
  -- OAuth / SSO identities are vetted by their identity provider.
  if v_provider not in ('email', 'phone') or coalesce(new.is_sso_user, false) then
    return new;
  end if;

  -- Invited users and users an administrator created already confirmed
  -- (Dashboard "Add user", auth.admin.createUser with email_confirm) are trusted.
  -- Self sign-ups always start unconfirmed because email confirmation is on.
  if new.invited_at is not null or new.email_confirmed_at is not null then
    return new;
  end if;

  v_permit := new.raw_user_meta_data->>'registration_permit';
  if v_permit is null or char_length(v_permit) > 128 then
    raise exception 'Registration verification is required' using errcode = '42501';
  end if;

  v_token_hash := encode(sha256(convert_to(v_permit, 'UTF8')), 'hex');

  delete from private.registration_permits
  where token_hash = v_token_hash
    and email = lower(new.email)
    and expires_at > now();

  if not found then
    raise exception 'Registration verification is invalid or expired' using errcode = '42501';
  end if;

  new.raw_user_meta_data :=
    coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'registration_permit';
  return new;
end;
$$;

revoke all on function private.require_registration_permit() from public, anon, authenticated;

drop trigger if exists require_registration_permit_before_signup on auth.users;
create trigger require_registration_permit_before_signup
  before insert on auth.users
  for each row execute function private.require_registration_permit();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := nullif(btrim(new.raw_user_meta_data->>'username'), '');
begin
  if v_username is not null and exists (
    select 1 from public.profiles where lower(username) = lower(v_username)
  ) then
    raise exception 'Username is already taken' using errcode = '23505';
  end if;

  insert into public.profiles (id, username, phone, account_role)
  values (
    new.id,
    v_username,
    nullif(new.raw_user_meta_data->>'phone', ''),
    case when new.raw_user_meta_data->>'account_role' = 'client' then 'client' else 'dev' end
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_username ~ '^[A-Za-z0-9_.]{3,24}$', false)
    and not exists (
      select 1 from public.profiles where lower(username) = lower(p_username)
    );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

commit;
