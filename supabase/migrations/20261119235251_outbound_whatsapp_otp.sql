begin;

alter table public.profiles add column if not exists phone_verified_at timestamptz,
  add column if not exists verified_phone text,
  add column if not exists email_verified_at timestamptz;
revoke update (phone) on public.profiles from authenticated;

-- Preserve proof from the previous WhatsApp flow.
update public.profiles p
set verified_phone = p.phone, phone_verified_at = c.verified_at
from private.whatsapp_phone_challenges c
where c.user_id = p.id and c.phone = p.phone and c.verified_at is not null
  and (p.phone_verified_at is null or p.verified_phone is distinct from p.phone);
revoke execute on function public.start_whatsapp_phone_verification() from authenticated;
revoke execute on function public.confirm_whatsapp_phone_verification(uuid, text) from service_role;

create or replace function private.sync_contact_verification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles p set
    email_verified_at = new.email_confirmed_at,
    phone_verified_at = case when p.phone = p.verified_phone and p.phone_verified_at is not null
      then p.phone_verified_at else new.phone_confirmed_at end,
    verified_phone = case when p.phone = p.verified_phone and p.phone_verified_at is not null
      then p.verified_phone when nullif(new.phone, '') is not null then '+' || ltrim(new.phone, '+') end
  where p.id = new.id;
  return new;
end;
$$;
revoke all on function private.sync_contact_verification() from public, anon, authenticated;

create table private.whatsapp_otp (
  user_id uuid primary key references auth.users(id) on delete cascade,
  challenge_id uuid not null,
  phone text not null check (phone ~ '^\+[1-9][0-9]{8,14}$'),
  digest text not null check (digest ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz not null,
  attempts smallint not null default 0,
  used_at timestamptz
);
create index whatsapp_otp_phone_recent_idx on private.whatsapp_otp (phone, issued_at);
alter table private.whatsapp_otp enable row level security;
revoke all on private.whatsapp_otp from public, anon, authenticated;

create function public.reserve_whatsapp_otp(p_user uuid, p_challenge uuid, p_phone text, p_digest text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  issued timestamptz;
begin
  perform 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = p_user and u.email_confirmed_at is not null for update of p;
  if not found then return false; end if;

  perform pg_advisory_xact_lock(hashtextextended('dev-match-whatsapp:' || p_phone, 0));
  issued := clock_timestamp();
  if exists (select 1 from private.whatsapp_otp
      where user_id = p_user and issued_at > issued - interval '60 seconds')
    or exists (select 1 from private.whatsapp_otp
      where phone = p_phone and issued_at > issued - interval '60 seconds') then
    return false;
  end if;

  insert into private.whatsapp_otp(user_id, challenge_id, phone, digest, issued_at)
  values (p_user, p_challenge, p_phone, p_digest, issued)
  on conflict (user_id) do update set
    challenge_id = excluded.challenge_id, phone = excluded.phone, digest = excluded.digest,
    issued_at = excluded.issued_at, attempts = 0, used_at = null;
  return true;
end;
$$;

create function public.verify_whatsapp_otp(p_user uuid, p_challenge uuid, p_phone text, p_digest text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  challenge private.whatsapp_otp%rowtype;
begin
  perform 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = p_user and u.email_confirmed_at is not null for update of p;
  if not found then return 'invalid'; end if;

  select * into challenge from private.whatsapp_otp where user_id = p_user for update;
  if not found or challenge.challenge_id <> p_challenge or challenge.phone <> p_phone
    or challenge.used_at is not null or challenge.issued_at <= clock_timestamp() - interval '5 minutes' then
    return 'expired';
  end if;
  if challenge.attempts >= 5 then return 'locked'; end if;

  if challenge.digest is distinct from p_digest then
    update private.whatsapp_otp set attempts = attempts + 1 where user_id = p_user;
    return case when challenge.attempts = 4 then 'locked' else 'invalid' end;
  end if;

  update private.whatsapp_otp set used_at = clock_timestamp() where user_id = p_user;
  update public.profiles set phone = challenge.phone, verified_phone = challenge.phone,
    phone_verified_at = clock_timestamp() where id = p_user;
  return 'verified';
end;
$$;

revoke all on function public.reserve_whatsapp_otp(uuid, uuid, text, text),
  public.verify_whatsapp_otp(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.reserve_whatsapp_otp(uuid, uuid, text, text),
  public.verify_whatsapp_otp(uuid, uuid, text, text) to service_role;

commit;
;
