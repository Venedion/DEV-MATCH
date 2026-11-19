-- Phone verification (audit item 5).
-- * One verified phone number belongs to one account.
-- * The phone format matches the profiles.phone column check ({8,14} digits).
-- * WhatsApp verification and profiles.phone_verified_at / verified_phone are
--   now one system: confirming over WhatsApp fills the profile columns, and the
--   auth.users sync no longer erases a WhatsApp verification.
begin;

-- Keep the earliest verification when the same number was verified twice.
update private.whatsapp_phone_challenges c
set verified_at = null
where c.verified_at is not null
  and exists (
    select 1 from private.whatsapp_phone_challenges o
    where o.phone = c.phone
      and o.user_id <> c.user_id
      and o.verified_at is not null
      and (o.verified_at < c.verified_at
        or (o.verified_at = c.verified_at and o.user_id < c.user_id))
  );

create unique index if not exists whatsapp_phone_challenges_verified_phone_unique
  on private.whatsapp_phone_challenges (phone)
  where verified_at is not null;

create or replace function public.start_whatsapp_phone_verification()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := (select auth.uid());
  account_phone text;
  code uuid := gen_random_uuid();
begin
  select p.phone into account_phone
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = account_id and u.email_confirmed_at is not null
  for update of p;

  if account_phone is null or account_phone !~ '^\+[1-9][0-9]{8,14}$' then
    raise exception 'A confirmed account with a valid phone is required' using errcode = '42501';
  end if;

  if exists (
    select 1 from private.whatsapp_phone_challenges c
    where c.phone = account_phone and c.verified_at is not null and c.user_id <> account_id
  ) then
    raise exception 'This phone number is already verified on another account' using errcode = '23505';
  end if;

  insert into private.whatsapp_phone_challenges as challenge (user_id, phone, code_hash, expires_at)
  values (account_id, account_phone, sha256(convert_to(code::text, 'UTF8')), now() + interval '10 minutes')
  on conflict (user_id) do update
  set phone = excluded.phone,
      code_hash = excluded.code_hash,
      expires_at = excluded.expires_at,
      verified_at = null
  where challenge.phone is distinct from excluded.phone
     or (challenge.verified_at is null and challenge.expires_at < now() + interval '9 minutes');

  if not found then
    raise exception 'Already verified or recently requested' using errcode = '22023';
  end if;
  return code;
end;
$$;

create or replace function public.is_whatsapp_phone_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.phone is not null
      and p.phone_verified_at is not null
      and p.verified_phone = p.phone
  ) or exists (
    select 1
    from private.whatsapp_phone_challenges c
    join public.profiles p on p.id = c.user_id
    where c.user_id = (select auth.uid())
      and c.phone = p.phone
      and c.verified_at is not null
  );
$$;

create or replace function public.confirm_whatsapp_phone_verification(p_code uuid, p_sender text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_phone text;
begin
  select c.user_id, c.phone into v_user, v_phone
  from private.whatsapp_phone_challenges c
  join public.profiles p on p.id = c.user_id and p.phone = c.phone
  where c.code_hash = sha256(convert_to(p_code::text, 'UTF8'))
    and c.phone = p_sender
    and c.expires_at > now()
    and c.verified_at is null
  for update of c;

  if v_user is null then
    return false;
  end if;

  -- Another account already owns this number: refuse instead of failing on the
  -- unique index, so the webhook does not keep retrying.
  if exists (
    select 1 from private.whatsapp_phone_challenges
    where phone = v_phone and verified_at is not null and user_id <> v_user
  ) then
    return false;
  end if;

  update private.whatsapp_phone_challenges set verified_at = now() where user_id = v_user;
  update public.profiles
  set phone_verified_at = now(), verified_phone = v_phone
  where id = v_user;
  return true;
end;
$$;

revoke all on function public.start_whatsapp_phone_verification(), public.is_whatsapp_phone_verified(),
  public.confirm_whatsapp_phone_verification(uuid, text) from public, anon, authenticated;
grant execute on function public.start_whatsapp_phone_verification(), public.is_whatsapp_phone_verified()
  to authenticated;
grant execute on function public.confirm_whatsapp_phone_verification(uuid, text) to service_role;

-- Auth phone confirmations still count, but no longer wipe a WhatsApp result.
create or replace function private.sync_contact_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email_verified_at = new.email_confirmed_at,
      phone_verified_at = case
        when new.phone_confirmed_at is not null and nullif(new.phone, '') is not null
          then new.phone_confirmed_at
        else phone_verified_at
      end,
      verified_phone = case
        when new.phone_confirmed_at is not null and nullif(new.phone, '') is not null
          then '+' || ltrim(new.phone, '+')
        else verified_phone
      end
  where id = new.id;
  return new;
end;
$$;
revoke all on function private.sync_contact_verification() from public, anon, authenticated;

-- Backfill: WhatsApp verifications that happened before this migration.
update public.profiles p
set phone_verified_at = c.verified_at, verified_phone = c.phone
from private.whatsapp_phone_challenges c
where c.user_id = p.id
  and c.verified_at is not null
  and c.phone = p.phone
  and (p.verified_phone is distinct from c.phone or p.phone_verified_at is null);

create or replace function private.has_verified_phone(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.phone is not null
      and p.phone_verified_at is not null
      and p.verified_phone = p.phone
  );
$$;
revoke all on function private.has_verified_phone(uuid) from public, anon, authenticated;

commit;
