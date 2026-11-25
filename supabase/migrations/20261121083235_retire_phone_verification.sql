begin;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, account_role)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'username', ''),
    case when new.raw_user_meta_data->>'account_role' = 'client' then 'client' else 'dev' end
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke update (phone) on public.profiles from anon, authenticated;

revoke execute on function public.start_whatsapp_phone_verification(),
  public.is_whatsapp_phone_verified(),
  public.confirm_whatsapp_phone_verification(uuid, text),
  public.reserve_whatsapp_otp(uuid, uuid, text, text),
  public.verify_whatsapp_otp(uuid, uuid, text, text)
from public, anon, authenticated, service_role;

commit;
;
