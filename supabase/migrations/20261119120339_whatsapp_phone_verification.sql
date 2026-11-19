begin;

create table private.whatsapp_phone_challenges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null,
  code_hash bytea not null unique,
  expires_at timestamptz not null,
  verified_at timestamptz
);
alter table private.whatsapp_phone_challenges enable row level security;
revoke all on private.whatsapp_phone_challenges from public, anon, authenticated;

create function public.start_whatsapp_phone_verification()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  account_id uuid := (select auth.uid());
  account_phone text;
  code uuid := gen_random_uuid();
begin
  select p.phone into account_phone
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = account_id and u.email_confirmed_at is not null
  for update of p;

  if account_phone is null or account_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'A confirmed account with a valid phone is required' using errcode = '42501';
  end if;

  insert into private.whatsapp_phone_challenges as challenge (user_id, phone, code_hash, expires_at)
  values (account_id, account_phone, sha256(convert_to(code::text, 'UTF8')), now() + interval '10 minutes')
  on conflict (user_id) do update
  set phone = excluded.phone, code_hash = excluded.code_hash,
      expires_at = excluded.expires_at, verified_at = null
  where challenge.phone is distinct from excluded.phone
     or (challenge.verified_at is null and challenge.expires_at < now() + interval '9 minutes');

  if not found then raise exception 'Already verified or recently requested' using errcode = '22023'; end if;
  return code;
end;
$$;

create function public.is_whatsapp_phone_verified()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.whatsapp_phone_challenges c join public.profiles p on p.id = c.user_id
    where c.user_id = (select auth.uid()) and c.phone = p.phone and c.verified_at is not null
  );
$$;

create function public.confirm_whatsapp_phone_verification(p_code uuid, p_sender text)
returns boolean language sql security definer set search_path = '' as $$
  with confirmed as (
    update private.whatsapp_phone_challenges c
    set verified_at = now()
    from public.profiles p
    where p.id = c.user_id and p.phone = c.phone
      and c.code_hash = sha256(convert_to(p_code::text, 'UTF8'))
      and c.phone = p_sender and c.expires_at > now() and c.verified_at is null
    returning c.user_id
  )
  select exists (select 1 from confirmed);
$$;

revoke all on function public.start_whatsapp_phone_verification(), public.is_whatsapp_phone_verified(),
  public.confirm_whatsapp_phone_verification(uuid, text) from public, anon, authenticated;
grant execute on function public.start_whatsapp_phone_verification(), public.is_whatsapp_phone_verified() to authenticated;
grant execute on function public.confirm_whatsapp_phone_verification(uuid, text) to service_role;

commit;
