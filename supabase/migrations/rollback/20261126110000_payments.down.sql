begin;

drop function if exists public.payments_apply_midtrans_status(text, numeric, text, text, jsonb);
drop function if exists public.payments_release_checkout_claim(uuid, uuid);
drop function if exists public.payments_store_snap_token(uuid, uuid, text);
drop function if exists public.payments_claim_dp_transaction(uuid, uuid);

update public.payment_agreement_rooms
   set state = jsonb_set(state, '{room,project}', '"NOT_STARTED"'::jsonb, true)
       #- '{room,cancellationReason}'
       #- '{room,timeline,dpExpiredAt}',
       version = version + 1
 where state #>> '{room,project}' = 'CANCELLED'
   and state #>> '{room,cancellationReason}' = 'DP_EXPIRED';

create or replace function public.payment_agreement_save(
  p_agreement uuid,
  p_version integer,
  p_state jsonb,
  p_order_id text default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saved boolean := false;
begin
  if p_version = 0 then
    insert into public.payment_agreement_rooms (agreement_id, state)
      values (p_agreement, p_state) on conflict do nothing;
    v_saved := found;
  else
    update public.payment_agreement_rooms
      set state = p_state, version = p_version + 1
      where agreement_id = p_agreement and version = p_version;
    v_saved := found;
  end if;
  if not v_saved then return false; end if;

  if p_order_id is not null then
    insert into public.payment_agreement_order_refs (order_id, agreement_id)
      values (p_order_id, p_agreement);
  end if;

  update public.project_agreements
    set payment_status = case
      when p_state->'room'->>'escrow' in ('FULL_PAYMENT_HELD', 'RELEASE_PENDING', 'RELEASED')
        then 'paid'
      else 'pending'
    end
    where id = p_agreement;

  return true;
end;
$$;

revoke all on function public.payment_agreement_save(uuid, integer, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.payment_agreement_save(uuid, integer, jsonb, text)
  to service_role;

delete from public.notifications where kind = 'payment';
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('comment', 'reply', 'favorite', 'message'));

do $$
begin
  if exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'payments'
  ) then
    execute 'alter publication supabase_realtime drop table public.payments';
  end if;
end;
$$;

drop table if exists public.payments;

commit;
