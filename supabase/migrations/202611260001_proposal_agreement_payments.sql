begin;

comment on table public.project_agreements is
  'Immutable accepted snapshot of a project proposal. Agreement-linked payment state is stored separately.';

create table public.payment_agreement_rooms (
  agreement_id uuid primary key references public.project_agreements(id) on delete cascade,
  version integer not null default 1,
  state jsonb not null
);

create table public.payment_agreement_order_refs (
  order_id text primary key,
  agreement_id uuid not null references public.project_agreements(id) on delete cascade
);

create table public.payment_agreement_dispute_reviewers (
  agreement_id uuid not null references public.project_agreements(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  primary key (agreement_id, reviewer_id)
);

alter table public.payment_agreement_rooms enable row level security;
alter table public.payment_agreement_order_refs enable row level security;
alter table public.payment_agreement_dispute_reviewers enable row level security;
revoke all on public.payment_agreement_rooms, public.payment_agreement_order_refs,
  public.payment_agreement_dispute_reviewers from public, anon, authenticated;
grant select, insert, update on public.payment_agreement_rooms,
  public.payment_agreement_order_refs to service_role;
grant select on public.payment_agreement_dispute_reviewers to service_role;

create function public.payment_agreement_context(p_user uuid, p_agreement uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'role', case
      when a.client_id = p_user then 'client'
      when a.developer_id = p_user then 'developer'
      when r.reviewer_id is not null then 'reviewer'
    end,
    'conversationId', a.conversation_id,
    'agreement', to_jsonb(a),
    'version', coalesce(s.version, 0),
    'state', s.state
  )
  from public.project_agreements a
  join public.project_proposals p on p.id = a.proposal_id and p.status = 'accepted'
  join public.conversations c on c.id = a.conversation_id
  left join public.payment_agreement_rooms s on s.agreement_id = a.id
  left join public.payment_agreement_dispute_reviewers r
    on r.agreement_id = a.id and r.reviewer_id = p_user
  where a.id = p_agreement
    and (p_user in (a.client_id, a.developer_id) or r.reviewer_id is not null)
    and (
      (c.participant_a_id = a.developer_id and c.participant_a_role = 'dev'
        and c.participant_b_id = a.client_id and c.participant_b_role = 'client')
      or
      (c.participant_b_id = a.developer_id and c.participant_b_role = 'dev'
        and c.participant_a_id = a.client_id and c.participant_a_role = 'client')
    )
$$;

create function public.payment_agreement_review_rooms(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'agreementId', a.id,
    'conversationId', a.conversation_id,
    'title', a.terms->'terms'->>'projectName'
  ) order by a.created_at desc), '[]'::jsonb)
  from public.payment_agreement_dispute_reviewers r
  join public.project_agreements a on a.id = r.agreement_id
  join public.payment_agreement_rooms s on s.agreement_id = a.id
  where r.reviewer_id = p_user
    and s.state->'room'->'dispute'->>'status' = 'NEEDS_REVIEW'
    and public.payment_agreement_context(p_user, a.id)->>'role' = 'reviewer'
$$;

create function public.payment_agreement_save(
  p_agreement uuid, p_version integer, p_state jsonb, p_order_id text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
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

revoke all on function public.payment_agreement_context(uuid, uuid),
  public.payment_agreement_review_rooms(uuid),
  public.payment_agreement_save(uuid, integer, jsonb, text) from public, anon, authenticated;
grant execute on function public.payment_agreement_context(uuid, uuid),
  public.payment_agreement_review_rooms(uuid),
  public.payment_agreement_save(uuid, integer, jsonb, text) to service_role;

commit;
