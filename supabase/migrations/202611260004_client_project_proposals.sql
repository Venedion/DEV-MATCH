alter table public.project_proposals
  add column creator_id uuid references auth.users(id) on delete cascade;

update public.project_proposals
set creator_id = developer_id
where creator_id is null;

alter table public.project_proposals
  alter column creator_id set not null;

alter table public.project_proposals
  add constraint project_proposals_creator_participant_check
  check (creator_id in (developer_id, client_id));

create index project_proposals_creator_created_idx
  on public.project_proposals (creator_id, created_at desc);

comment on table public.project_proposals is
  'Client- or Developer-authored proposal terms shared with the other participant in a conversation.';

create or replace function public.create_project_proposal(
  p_proposal_id uuid,
  p_message_id uuid,
  p_conversation_id uuid,
  p_actor_id uuid,
  p_workspace_role text,
  p_terms jsonb,
  p_attachments jsonb,
  p_ciphertext text,
  p_nonce text,
  p_key_version smallint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
  v_developer_id uuid;
  v_client_id uuid;
  v_total_price numeric(16, 0);
  v_dp_percent integer;
  v_dp_amount numeric(16, 0);
  v_revision_count integer;
  v_scope_item jsonb;
  v_attachment jsonb;
  v_attachment_bytes bigint := 0;
  v_terms jsonb;
begin
  if p_actor_id is null or p_workspace_role not in ('dev', 'client')
    or p_proposal_id is null or p_message_id is null
    or p_conversation_id is null then
    raise exception 'A Client or Developer workspace and valid proposal are required'
      using errcode = '22023';
  end if;

  select *
  into v_conversation
  from public.conversations
  where id = p_conversation_id
    and merged_into is null;

  if not found then
    raise exception 'The conversation is not available'
      using errcode = '42501';
  end if;

  if v_conversation.participant_a_id = p_actor_id
    and v_conversation.participant_a_role = p_workspace_role
    and v_conversation.participant_b_role in ('dev', 'client')
    and v_conversation.participant_b_role <> p_workspace_role then
    if p_workspace_role = 'dev' then
      v_developer_id := v_conversation.participant_a_id;
      v_client_id := v_conversation.participant_b_id;
    else
      v_developer_id := v_conversation.participant_b_id;
      v_client_id := v_conversation.participant_a_id;
    end if;
  elsif v_conversation.participant_b_id = p_actor_id
    and v_conversation.participant_b_role = p_workspace_role
    and v_conversation.participant_a_role in ('dev', 'client')
    and v_conversation.participant_a_role <> p_workspace_role then
    if p_workspace_role = 'dev' then
      v_developer_id := v_conversation.participant_b_id;
      v_client_id := v_conversation.participant_a_id;
    else
      v_developer_id := v_conversation.participant_a_id;
      v_client_id := v_conversation.participant_b_id;
    end if;
  else
    raise exception 'Only a participant in a Client-Developer conversation can create a proposal'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_terms) is distinct from 'object'
    or length(trim(coalesce(p_terms->>'projectName', ''))) not between 1 and 80
    or length(trim(coalesce(p_terms->>'description', ''))) not between 1 and 1000
    or coalesce(p_terms->>'totalPrice', '') !~ '^[1-9][0-9]{0,15}$'
    or coalesce(p_terms->>'dpPercent', '') not in ('25', '50')
    or coalesce(p_terms->>'deadline', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or coalesce(p_terms->>'revisionCount', '') !~ '^(0|[1-9][0-9]?)$'
    or length(coalesce(p_terms->>'revisionNotes', '')) > 300
    or jsonb_typeof(p_terms->'scope') is distinct from 'array'
    or jsonb_array_length(p_terms->'scope') not between 1 and 20 then
    raise exception 'The proposal terms are invalid'
      using errcode = '22023';
  end if;

  v_total_price := (p_terms->>'totalPrice')::numeric;
  v_dp_percent := (p_terms->>'dpPercent')::integer;
  v_revision_count := (p_terms->>'revisionCount')::integer;
  if (p_terms->>'deadline')::date < current_date then
    raise exception 'The proposal deadline must be today or later'
      using errcode = '22023';
  end if;

  for v_scope_item in select value from jsonb_array_elements(p_terms->'scope')
  loop
    if jsonb_typeof(v_scope_item) <> 'string'
      or length(trim(v_scope_item #>> '{}')) not between 1 and 300 then
      raise exception 'Every scope point must contain 1 to 300 characters'
        using errcode = '22023';
    end if;
  end loop;

  if jsonb_typeof(p_attachments) is distinct from 'array'
    or jsonb_array_length(p_attachments) > 5 then
    raise exception 'The proposal attachments are invalid'
      using errcode = '22023';
  end if;

  for v_attachment in select value from jsonb_array_elements(p_attachments)
  loop
    if jsonb_typeof(v_attachment) is distinct from 'object'
      or coalesce(v_attachment->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or v_attachment->>'path' is distinct from (
        'chat-attachments/project-proposals/' || p_proposal_id::text || '/' ||
        (v_attachment->>'id') || '.bin'
      )
      or coalesce(v_attachment->>'type', '') not in (
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/webp'
      )
      or coalesce(v_attachment->>'name', '') = ''
      or length(v_attachment->>'name') > 180
      or coalesce(v_attachment->>'size', '') !~ '^[1-9][0-9]{0,6}$'
      or (v_attachment->>'size')::integer > 2097152
      or coalesce(v_attachment->>'nonce', '') !~ '^[A-Za-z0-9_-]{16}$'
      or coalesce(v_attachment->>'key_version', '') !~ '^[1-9][0-9]{0,4}$'
      or (v_attachment->>'key_version')::integer > 32767 then
      raise exception 'A proposal attachment is invalid'
        using errcode = '22023';
    end if;
    v_attachment_bytes := v_attachment_bytes + (v_attachment->>'size')::bigint;
  end loop;

  if v_attachment_bytes > 2097152 then
    raise exception 'Proposal attachments must total no more than 2 MB'
      using errcode = '22023';
  end if;

  v_dp_amount := round(v_total_price * v_dp_percent / 100);
  v_terms := p_terms || jsonb_build_object(
    'totalPrice', v_total_price,
    'dpPercent', v_dp_percent,
    'dpAmount', v_dp_amount,
    'remainingAmount', v_total_price - v_dp_amount,
    'revisionCount', v_revision_count
  );

  insert into public.project_proposals (
    id, conversation_id, developer_id, client_id, creator_id, terms, attachments
  ) values (
    p_proposal_id, p_conversation_id, v_developer_id, v_client_id, p_actor_id, v_terms, p_attachments
  );

  insert into public.messages (
    id, conversation_id, sender_id, ciphertext, nonce, key_version, proposal_id
  ) values (
    p_message_id, p_conversation_id, p_actor_id, p_ciphertext, p_nonce, p_key_version, p_proposal_id
  );

  return jsonb_build_object(
    'proposal_id', p_proposal_id,
    'message_id', p_message_id,
    'conversation_id', p_conversation_id
  );
end;
$$;

create or replace function public.accept_project_proposal(
  p_proposal_id uuid,
  p_actor_id uuid,
  p_workspace_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.project_proposals%rowtype;
  v_conversation public.conversations%rowtype;
  v_agreement public.project_agreements%rowtype;
  v_recipient_id uuid;
  v_recipient_role text;
  v_total_price numeric(16, 0);
  v_dp_amount numeric(16, 0);
begin
  if p_actor_id is null or p_workspace_role not in ('dev', 'client') then
    raise exception 'A valid recipient workspace is required to accept a proposal'
      using errcode = '42501';
  end if;

  select *
  into v_proposal
  from public.project_proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposal not found'
      using errcode = 'P0002';
  end if;

  if v_proposal.creator_id = v_proposal.developer_id then
    v_recipient_id := v_proposal.client_id;
    v_recipient_role := 'client';
  else
    v_recipient_id := v_proposal.developer_id;
    v_recipient_role := 'dev';
  end if;
  if v_recipient_id <> p_actor_id or v_recipient_role <> p_workspace_role then
    raise exception 'Only the proposal recipient can accept it'
      using errcode = '42501';
  end if;
  if v_proposal.status <> 'pending' then
    raise exception 'This proposal is no longer awaiting approval'
      using errcode = '23514';
  end if;

  select *
  into v_conversation
  from public.conversations
  where id = v_proposal.conversation_id
    and merged_into is null;
  if not found
    or not (
      (v_conversation.participant_a_id = p_actor_id and v_conversation.participant_a_role = p_workspace_role)
      or (v_conversation.participant_b_id = p_actor_id and v_conversation.participant_b_role = p_workspace_role)
    ) then
    raise exception 'The conversation is not available'
      using errcode = '42501';
  end if;

  v_total_price := (v_proposal.terms->>'totalPrice')::numeric;
  v_dp_amount := (v_proposal.terms->>'dpAmount')::numeric;

  update public.project_proposals
  set status = 'accepted',
      accepted_at = now(),
      updated_at = now()
  where id = v_proposal.id
  returning * into v_proposal;

  insert into public.project_agreements (
    proposal_id, conversation_id, developer_id, client_id, terms, total_price, dp_amount
  ) values (
    v_proposal.id,
    v_proposal.conversation_id,
    v_proposal.developer_id,
    v_proposal.client_id,
    jsonb_build_object('terms', v_proposal.terms, 'attachments', v_proposal.attachments),
    v_total_price,
    v_dp_amount
  )
  returning * into v_agreement;

  return jsonb_build_object(
    'proposal', to_jsonb(v_proposal),
    'agreement', to_jsonb(v_agreement)
  );
end;
$$;

create or replace function public.withdraw_project_proposal(
  p_proposal_id uuid,
  p_actor_id uuid,
  p_workspace_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.project_proposals%rowtype;
begin
  if p_actor_id is null or p_workspace_role not in ('dev', 'client') then
    raise exception 'A valid proposal creator workspace is required to withdraw a proposal'
      using errcode = '42501';
  end if;

  update public.project_proposals
  set status = 'withdrawn',
      withdrawn_at = now(),
      updated_at = now()
  where id = p_proposal_id
    and creator_id = p_actor_id
    and (developer_id = p_actor_id and p_workspace_role = 'dev'
      or client_id = p_actor_id and p_workspace_role = 'client')
    and status = 'pending'
  returning * into v_proposal;

  if not found then
    raise exception 'This proposal cannot be withdrawn'
      using errcode = '23514';
  end if;
  return to_jsonb(v_proposal);
end;
$$;
