begin;

create extension if not exists pgcrypto with schema extensions;

create table private.registration_network_attempts (
  network cidr not null,
  attempted_at timestamptz not null default now()
);

create index registration_network_attempts_window_idx
  on private.registration_network_attempts (network, attempted_at desc);
create index registration_network_attempts_cleanup_idx
  on private.registration_network_attempts (attempted_at);

create table private.registration_permits (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  email text not null,
  expires_at timestamptz not null
);

create index registration_permits_expiry_idx
  on private.registration_permits (expires_at);

revoke all on private.registration_network_attempts from public, anon, authenticated;
revoke all on private.registration_permits from public, anon, authenticated;

create function public.issue_registration_permit(
  p_email text,
  p_ip inet,
  p_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_network cidr;
  v_attempt_count integer;
begin
  if p_email is null or char_length(p_email) > 254 or p_ip is null
    or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid registration permit request'
      using errcode = '22023';
  end if;

  v_network := set_masklen(p_ip, case family(p_ip) when 4 then 24 else 64 end)::cidr;
  perform pg_advisory_xact_lock(hashtextextended(v_network::text, 0));

  delete from private.registration_network_attempts
  where attempted_at < now() - interval '24 hours';
  delete from private.registration_permits
  where expires_at <= now();

  delete from private.registration_network_attempts
  where network = v_network
    and attempted_at <= now() - interval '1 hour';

  select count(*) into v_attempt_count
  from private.registration_network_attempts
  where network = v_network
    and attempted_at > now() - interval '1 hour';

  if v_attempt_count >= 5 then
    return false;
  end if;

  insert into private.registration_network_attempts (network) values (v_network);
  insert into private.registration_permits (token_hash, email, expires_at)
  values (p_token_hash, lower(trim(p_email)), now() + interval '10 minutes');

  return true;
end;
$$;

revoke all on function public.issue_registration_permit(text, inet, text)
  from public, anon, authenticated;
grant execute on function public.issue_registration_permit(text, inet, text)
  to service_role;

create function private.require_registration_permit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_permit text;
  v_token_hash text;
begin
  v_permit := new.raw_user_meta_data->>'registration_permit';
  if v_permit is null or char_length(v_permit) > 128 then
    raise exception 'Registration verification is required'
      using errcode = '42501';
  end if;

  v_token_hash := encode(
    extensions.digest(convert_to(v_permit, 'UTF8'), 'sha256'),
    'hex'
  );

  delete from private.registration_permits
  where token_hash = v_token_hash
    and email = lower(new.email)
    and expires_at > now();

  if not found then
    raise exception 'Registration verification is invalid or expired'
      using errcode = '42501';
  end if;

  new.raw_user_meta_data :=
    coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'registration_permit';
  return new;
end;
$$;

revoke all on function private.require_registration_permit()
  from public, anon, authenticated;

create trigger require_registration_permit_before_signup
  before insert on auth.users
  for each row execute function private.require_registration_permit();

commit;
