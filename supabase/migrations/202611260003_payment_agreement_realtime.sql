begin;

create or replace function public.can_receive_payment_agreement_updates(p_agreement uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_agreements a
    where a.id = p_agreement
      and (
        (select auth.uid()) in (a.client_id, a.developer_id)
        or exists (
          select 1
          from public.payment_agreement_dispute_reviewers r
          where r.agreement_id = a.id and r.reviewer_id = (select auth.uid())
        )
      )
  )
$$;

revoke all on function public.can_receive_payment_agreement_updates(uuid) from public, anon;
grant execute on function public.can_receive_payment_agreement_updates(uuid) to authenticated;

drop policy if exists "Participants can receive agreement payment updates" on realtime.messages;
create policy "Participants can receive agreement payment updates"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.topic() ~ '^payment-agreement:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and (select public.can_receive_payment_agreement_updates(
      substring(realtime.topic()
        from '^payment-agreement:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$')::uuid
    ))
  );

create or replace function public.broadcast_payment_agreement_room_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('version', new.version),
    'refresh',
    'payment-agreement:' || new.agreement_id::text,
    true
  );
  return null;
end;
$$;

revoke all on function public.broadcast_payment_agreement_room_update() from public, anon, authenticated;

drop trigger if exists payment_agreement_rooms_broadcast_updates on public.payment_agreement_rooms;
create trigger payment_agreement_rooms_broadcast_updates
  after insert or update on public.payment_agreement_rooms
  for each row execute function public.broadcast_payment_agreement_room_update();

commit;
