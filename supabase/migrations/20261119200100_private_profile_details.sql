-- Bank account and NPWP details (audit item 4).
-- They used to be stored in plain text inside profiles.profile_data, the same
-- column that feeds workspace queries and caches. They now live in an
-- owner-only table, encrypted with a key kept in Supabase Vault, and are only
-- reachable through two RPCs that check the caller's workspace.
begin;

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'profile_private_details_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'profile_private_details_key',
      'Encrypts bank account and NPWP details in private.profile_private_details'
    );
  end if;
end;
$$;

create table if not exists private.profile_private_details (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_role text not null check (workspace_role in ('client', 'dev')),
  encrypted_details bytea not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_role)
);
alter table private.profile_private_details enable row level security;
revoke all on private.profile_private_details from public, anon, authenticated;

create or replace function private.profile_private_details_key()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'profile_private_details_key';
  if v_key is null then
    raise exception 'Private profile encryption is not configured' using errcode = '55000';
  end if;
  return v_key;
end;
$$;
revoke all on function private.profile_private_details_key() from public, anon, authenticated;

create or replace function public.get_private_profile_details(p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload bytea;
begin
  if auth.uid() is null or p_role is null or not public.has_account_workspace(p_role) then
    raise exception 'Workspace access denied' using errcode = '42501';
  end if;
  select encrypted_details into v_payload
  from private.profile_private_details
  where user_id = auth.uid() and workspace_role = p_role;
  if v_payload is null then
    return '{}'::jsonb;
  end if;
  return extensions.pgp_sym_decrypt(v_payload, private.profile_private_details_key())::jsonb;
end;
$$;

create or replace function public.save_private_profile_details(p_role text, p_details jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clean jsonb := '{}'::jsonb;
  v_key text;
  v_value text;
begin
  if auth.uid() is null or p_role is null or not public.has_account_workspace(p_role) then
    raise exception 'Workspace access denied' using errcode = '42501';
  end if;
  if jsonb_typeof(p_details) is distinct from 'object' or exists (
    select 1 from jsonb_each(p_details) e
    where e.key not in ('bankName', 'accountNumber', 'accountHolder', 'npwp')
       or jsonb_typeof(e.value) not in ('string', 'null')
  ) then
    raise exception 'Unsupported private profile fields' using errcode = '22023';
  end if;

  for v_key, v_value in
    select e.key, btrim(e.value #>> '{}') from jsonb_each(p_details) e
  loop
    continue when v_value is null or v_value = '';
    if v_key in ('bankName', 'accountHolder') and char_length(v_value) > 100 then
      raise exception 'Bank name and account holder must be at most 100 characters' using errcode = '22023';
    elsif v_key = 'accountNumber' and v_value !~ '^[0-9][0-9 -]{3,40}[0-9]$' then
      raise exception 'Account number must contain only digits' using errcode = '22023';
    elsif v_key = 'npwp' and regexp_replace(v_value, '[^0-9]', '', 'g') !~ '^[0-9]{15,16}$' then
      raise exception 'NPWP must contain 15 or 16 digits' using errcode = '22023';
    end if;
    v_clean := v_clean || jsonb_build_object(v_key, v_value);
  end loop;

  if v_clean = '{}'::jsonb then
    delete from private.profile_private_details
    where user_id = auth.uid() and workspace_role = p_role;
    return v_clean;
  end if;

  insert into private.profile_private_details (user_id, workspace_role, encrypted_details, updated_at)
  values (
    auth.uid(),
    p_role,
    extensions.pgp_sym_encrypt(v_clean::text, private.profile_private_details_key()),
    now()
  )
  on conflict (user_id, workspace_role) do update
  set encrypted_details = excluded.encrypted_details,
      updated_at = excluded.updated_at;
  return v_clean;
end;
$$;

revoke all on function public.get_private_profile_details(text) from public, anon;
revoke all on function public.save_private_profile_details(text, jsonb) from public, anon;
grant execute on function public.get_private_profile_details(text) to authenticated;
grant execute on function public.save_private_profile_details(text, jsonb) to authenticated;

-- Only client requests need the email-confirmation gate. Without this, the
-- maintenance updates below (run without a user session) could be rejected.
create or replace function private.require_verified_onboarding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.onboarding_complete
    and (not old.onboarding_complete
      or new.profile_data is distinct from old.profile_data
      or new.display_name is distinct from old.display_name)
    and not exists (
      select 1 from auth.users u where u.id = new.id and u.email_confirmed_at is not null
    ) then
    raise exception 'Verify your email before completing your profile' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.require_verified_onboarding() from public, anon, authenticated;

-- Move existing plaintext values into the encrypted table, then remove them.
do $$
declare
  v_fields text[] := array['bankName', 'accountNumber', 'accountHolder', 'npwp'];
  v_key text;
begin
  if exists (select 1 from public.profiles where profile_data ?| v_fields)
    or exists (select 1 from public.account_workspaces where profile_data ?| v_fields) then
    v_key := private.profile_private_details_key();

    insert into private.profile_private_details (user_id, workspace_role, encrypted_details)
    select source.user_id, source.workspace_role,
      extensions.pgp_sym_encrypt(source.details::text, v_key)
    from (
      select id as user_id, account_role as workspace_role,
        jsonb_strip_nulls(jsonb_build_object(
          'bankName', profile_data->'bankName',
          'accountNumber', profile_data->'accountNumber',
          'accountHolder', profile_data->'accountHolder',
          'npwp', profile_data->'npwp')) as details
      from public.profiles
      where profile_data ?| v_fields
      union all
      select user_id, role,
        jsonb_strip_nulls(jsonb_build_object(
          'bankName', profile_data->'bankName',
          'accountNumber', profile_data->'accountNumber',
          'accountHolder', profile_data->'accountHolder',
          'npwp', profile_data->'npwp'))
      from public.account_workspaces
      where profile_data ?| v_fields
    ) source
    on conflict (user_id, workspace_role) do nothing;

    update public.profiles set profile_data = profile_data - v_fields
    where profile_data ?| v_fields;
    update public.account_workspaces set profile_data = profile_data - v_fields
    where profile_data ?| v_fields;
  end if;
end;
$$;

-- From now on these keys can never be written to profile_data again.
create or replace function private.strip_private_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.profile_data := coalesce(new.profile_data, '{}'::jsonb)
    - array['bankName', 'accountNumber', 'accountHolder', 'npwp'];
  return new;
end;
$$;
revoke all on function private.strip_private_profile_fields() from public, anon, authenticated;

drop trigger if exists strip_private_profile_fields on public.profiles;
create trigger strip_private_profile_fields
  before insert or update of profile_data on public.profiles
  for each row execute function private.strip_private_profile_fields();

drop trigger if exists strip_private_profile_fields on public.account_workspaces;
create trigger strip_private_profile_fields
  before insert or update of profile_data on public.account_workspaces
  for each row execute function private.strip_private_profile_fields();

commit;
