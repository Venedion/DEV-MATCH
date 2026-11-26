begin;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.project_agreements(id) on delete cascade,
  payer_id uuid not null references auth.users(id) on delete cascade,
  payee_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('dp', 'remaining')),
  amount bigint not null check (amount > 0),
  midtrans_order_id text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'failed', 'cancelled')),
  snap_token text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  last_midtrans_status text,
  checkout_claim_id uuid,
  checkout_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payer_id <> payee_id),
  check ((status = 'paid') = (paid_at is not null))
);

create unique index if not exists payments_one_pending_kind_per_agreement_idx
  on public.payments (agreement_id, kind)
  where status = 'pending';
create index if not exists payments_payer_created_idx
  on public.payments (payer_id, created_at desc);
create index if not exists payments_payee_created_idx
  on public.payments (payee_id, created_at desc);

alter table public.payments enable row level security;
revoke all on public.payments from public, anon, authenticated;
grant select on public.payments to authenticated;
grant select, insert, update on public.payments to service_role;

drop policy if exists "Participants can read their payments" on public.payments;
create policy "Participants can read their payments" on public.payments
  for select to authenticated
  using ((select auth.uid()) in (payer_id, payee_id));

alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('comment', 'reply', 'favorite', 'message', 'payment'));

create or replace function public.payments_claim_dp_transaction(
  p_agreement_id uuid,
  p_payer_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agreement public.project_agreements%rowtype;
  v_room public.payment_agreement_rooms%rowtype;
  v_payment public.payments%rowtype;
  v_claim_id uuid := gen_random_uuid();
begin
  select a.*
    into v_agreement
    from public.project_agreements a
    join public.project_proposals p on p.id = a.proposal_id and p.status = 'accepted'
   where a.id = p_agreement_id
   for update of a;

  if not found then
    raise exception 'Agreement not found' using errcode = 'P0002';
  end if;
  if v_agreement.client_id <> p_payer_id then
    raise exception 'Only the agreement client can pay the DP' using errcode = '42501';
  end if;
  if v_agreement.payment_status <> 'pending' then
    raise exception 'The agreement is no longer awaiting DP' using errcode = '23514';
  end if;

  select r.* into v_room
    from public.payment_agreement_rooms r
   where r.agreement_id = p_agreement_id
   for update;
  if found and (
    coalesce(v_room.state #>> '{room,project}', '') <> 'NOT_STARTED'
    or coalesce(v_room.state #>> '{room,escrow}', '') <> 'AWAITING_DP'
  ) then
    raise exception 'The agreement is no longer awaiting DP' using errcode = '23514';
  end if;

  select p.* into v_payment
    from public.payments p
   where p.agreement_id = p_agreement_id
     and p.kind = 'dp'
     and p.status = 'pending'
   order by p.created_at desc
   limit 1
   for update;

  if found then
    if v_payment.expires_at <= now() then
      return jsonb_build_object('payment', to_jsonb(v_payment), 'expired_checkout', true);
    end if;
    if v_payment.snap_token is not null then
      return jsonb_build_object('payment', to_jsonb(v_payment), 'needs_snap', false);
    end if;
    if v_payment.checkout_claimed_at is not null
      and v_payment.checkout_claimed_at > now() - interval '5 minutes' then
      return jsonb_build_object('payment', to_jsonb(v_payment), 'needs_snap', false, 'creating', true);
    end if;

    update public.payments
       set checkout_claim_id = v_claim_id,
           checkout_claimed_at = now(),
           updated_at = now()
     where id = v_payment.id
     returning * into v_payment;
    return jsonb_build_object(
      'payment', to_jsonb(v_payment), 'needs_snap', true, 'claim_id', v_claim_id
    );
  end if;

  insert into public.payments (
    agreement_id, payer_id, payee_id, kind, amount, midtrans_order_id,
    status, expires_at, checkout_claim_id, checkout_claimed_at
  ) values (
    p_agreement_id, v_agreement.client_id, v_agreement.developer_id, 'dp',
    v_agreement.dp_amount, 'devmatch-dp-' || gen_random_uuid()::text,
    'pending', now() + interval '48 hours', v_claim_id, now()
  )
  returning * into v_payment;

  return jsonb_build_object(
    'payment', to_jsonb(v_payment), 'needs_snap', true, 'claim_id', v_claim_id
  );
end;
$$;

create or replace function public.payments_store_snap_token(
  p_payment_id uuid,
  p_claim_id uuid,
  p_snap_token text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
begin
  update public.payments
     set snap_token = p_snap_token,
         checkout_claim_id = null,
         checkout_claimed_at = null,
         updated_at = now()
   where id = p_payment_id
     and checkout_claim_id = p_claim_id
     and status = 'pending'
     and expires_at > now()
   returning * into v_payment;

  if not found then
    raise exception 'Payment checkout claim is no longer valid' using errcode = '23514';
  end if;
  return to_jsonb(v_payment);
end;
$$;

create or replace function public.payments_release_checkout_claim(
  p_payment_id uuid,
  p_claim_id uuid
) returns void
language sql
security definer
set search_path = ''
as $$
  update public.payments
     set checkout_claim_id = null,
         checkout_claimed_at = null,
         updated_at = now()
   where id = p_payment_id
     and checkout_claim_id = p_claim_id
     and snap_token is null
$$;

create or replace function public.payments_apply_midtrans_status(
  p_order_id text,
  p_gross_amount numeric,
  p_status text,
  p_midtrans_status text,
  p_initial_state jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_agreement public.project_agreements%rowtype;
  v_room public.payment_agreement_rooms%rowtype;
  v_state jsonb;
  v_payments jsonb;
  v_paid_at timestamptz;
  v_expired_at timestamptz;
  v_changed boolean := false;
  v_became_paid boolean := false;
  v_became_expired boolean := false;
begin
  if p_status not in ('pending', 'paid', 'expired', 'failed', 'cancelled') then
    raise exception 'Invalid Midtrans payment status' using errcode = '22023';
  end if;

  select * into v_payment
    from public.payments
   where midtrans_order_id = p_order_id;
  if not found then
    raise exception 'Payment order not found' using errcode = 'P0002';
  end if;

  select * into v_agreement
    from public.project_agreements
   where id = v_payment.agreement_id
   for update;

  select * into v_payment
    from public.payments
   where id = v_payment.id
   for update;
  if p_gross_amount <> v_payment.amount then
    raise exception 'Midtrans amount does not match' using errcode = '22023';
  end if;

  if v_payment.status <> 'paid'
    and (p_status = 'paid' or (v_payment.status = 'pending' and p_status <> 'pending')) then
    v_paid_at := case when p_status = 'paid' then now() else null end;
    update public.payments
       set status = p_status,
           paid_at = v_paid_at,
           last_midtrans_status = left(p_midtrans_status, 64),
           updated_at = now()
     where id = v_payment.id
     returning * into v_payment;
    v_changed := true;
    v_became_paid := p_status = 'paid';
    v_became_expired := p_status = 'expired' and v_payment.status = 'expired';
  elsif v_payment.status = 'pending' and p_status = 'pending'
    and v_payment.last_midtrans_status is distinct from p_midtrans_status then
    update public.payments
       set last_midtrans_status = left(p_midtrans_status, 64),
           updated_at = now()
     where id = v_payment.id
     returning * into v_payment;
    v_changed := true;
  end if;

  if (v_became_paid or v_became_expired) and v_payment.kind = 'dp' then
    select * into v_room
      from public.payment_agreement_rooms
     where agreement_id = v_payment.agreement_id
     for update;

    if not found then
      if p_initial_state is null then
        raise exception 'Agreement payment state is unavailable' using errcode = '23514';
      end if;
      insert into public.payment_agreement_rooms (agreement_id, state)
      values (v_payment.agreement_id, p_initial_state)
      returning * into v_room;
    end if;

    v_state := v_room.state;
    if v_became_expired
      and v_state #>> '{room,project}' = 'NOT_STARTED'
      and v_state #>> '{room,escrow}' = 'AWAITING_DP' then
      v_expired_at := now();
      v_state := jsonb_set(v_state, '{room,project}', '"CANCELLED"'::jsonb, true);
      v_state := jsonb_set(v_state, '{room,cancellationReason}', '"DP_EXPIRED"'::jsonb, true);
      v_state := jsonb_set(
        v_state,
        '{room,timeline}',
        coalesce(v_state #> '{room,timeline}', '{}'::jsonb)
          || jsonb_build_object('dpExpiredAt', v_expired_at),
        true
      );
      update public.payment_agreement_rooms
         set state = v_state, version = version + 1
       where agreement_id = v_payment.agreement_id;
    elsif v_became_paid and (
      (
        v_state #>> '{room,project}' = 'NOT_STARTED'
        and v_state #>> '{room,escrow}' = 'AWAITING_DP'
      )
      or (
        v_state #>> '{room,project}' = 'CANCELLED'
        and v_state #>> '{room,cancellationReason}' = 'DP_EXPIRED'
      )
    ) then
      v_paid_at := coalesce(v_payment.paid_at, now());
      v_state := jsonb_set(v_state, '{room,project}', '"IN_PROGRESS"'::jsonb, true);
      v_state := jsonb_set(v_state, '{room,escrow}', '"DP_HELD"'::jsonb, true);
      v_state := v_state #- '{room,cancellationReason}';
      v_state := jsonb_set(
        v_state,
        '{room,timeline}',
        coalesce(v_state #> '{room,timeline}', '{}'::jsonb)
          || jsonb_build_object('dpPaidAt', v_paid_at),
        true
      );
      v_payments := coalesce(v_state #> '{payments}', '[]'::jsonb);
      if jsonb_typeof(v_payments) <> 'array' then v_payments := '[]'::jsonb; end if;
      if not exists (
        select 1 from jsonb_array_elements(v_payments) item
        where item->>'order_id' = v_payment.midtrans_order_id
      ) then
        v_payments := v_payments || jsonb_build_array(jsonb_build_object(
          'order_id', v_payment.midtrans_order_id,
          'kind', 'DP',
          'amount', v_payment.amount,
          'status', 'PAID',
          'paid_at', v_paid_at
        ));
      end if;
      v_state := jsonb_set(v_state, '{payments}', v_payments, true);
      update public.payment_agreement_rooms
         set state = v_state, version = version + 1
       where agreement_id = v_payment.agreement_id;
      update public.project_agreements
         set payment_status = 'paid'
       where id = v_payment.agreement_id;

      insert into public.notifications (
        recipient_id, recipient_role, actor_id, actor_role, kind, project_id, conversation_id
      )
      select a.client_id, 'client', a.client_id, 'client', 'payment', c.project_id, a.conversation_id
        from public.project_agreements a
        join public.conversations c on c.id = a.conversation_id
       where a.id = v_payment.agreement_id;
      insert into public.notifications (
        recipient_id, recipient_role, actor_id, actor_role, kind, project_id, conversation_id
      )
      select a.developer_id, 'dev', a.client_id, 'client', 'payment', c.project_id, a.conversation_id
        from public.project_agreements a
        join public.conversations c on c.id = a.conversation_id
       where a.id = v_payment.agreement_id;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_payment.id,
    'status', v_payment.status,
    'changed', v_changed,
    'became_paid', v_became_paid
  );
end;
$$;

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
  perform 1
    from public.project_agreements
   where id = p_agreement
   for update;
  if not found then return false; end if;

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
      when p_state->'room'->>'escrow' in (
        'DP_HELD', 'DP_RELEASED', 'REMAINING_HELD',
        'FULL_PAYMENT_HELD', 'RELEASE_PENDING', 'RELEASED'
      ) then 'paid'
      else 'pending'
    end
    where id = p_agreement;

  return true;
end;
$$;

revoke all on function public.payments_claim_dp_transaction(uuid, uuid),
  public.payments_store_snap_token(uuid, uuid, text),
  public.payments_release_checkout_claim(uuid, uuid),
  public.payments_apply_midtrans_status(text, numeric, text, text, jsonb),
  public.payment_agreement_save(uuid, integer, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.payments_claim_dp_transaction(uuid, uuid),
  public.payments_store_snap_token(uuid, uuid, text),
  public.payments_release_checkout_claim(uuid, uuid),
  public.payments_apply_midtrans_status(text, numeric, text, text, jsonb),
  public.payment_agreement_save(uuid, integer, jsonb, text)
  to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'payments'
    ) then
    execute 'alter publication supabase_realtime add table public.payments';
  end if;
end;
$$;

commit;
