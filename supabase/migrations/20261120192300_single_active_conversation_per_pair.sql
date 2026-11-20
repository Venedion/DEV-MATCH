begin;

lock table public.conversations in share row exclusive mode;

create temp table conversation_message_count_before (
  message_count bigint not null
) on commit drop;

insert into pg_temp.conversation_message_count_before
select count(*) from public.messages;

alter table public.conversations
  add column if not exists merged_into uuid;

comment on column public.conversations.merged_into is
  'Virtual-thread metadata. Messages remain in their original conversation and retain their original encryption context.';

with ranked as (
  select
    c.id,
    first_value(c.id) over (
      partition by c.pair_key
      order by
        case when exists (
          select 1 from public.messages m where m.conversation_id = c.id
        ) then 0 else 1 end,
        c.created_at asc,
        c.id asc
    ) as parent_id,
    row_number() over (
      partition by c.pair_key
      order by
        case when exists (
          select 1 from public.messages m where m.conversation_id = c.id
        ) then 0 else 1 end,
        c.created_at asc,
        c.id asc
    ) as position
  from public.conversations c
)
update public.conversations c
set merged_into = case when r.position = 1 then null else r.parent_id end,
    is_primary = (r.position = 1)
from ranked r
where c.id = r.id;

do $$
declare
  message_count_before bigint;
  message_count_after bigint;
begin
  select message_count
  into message_count_before
  from pg_temp.conversation_message_count_before;

  select count(*)
  into message_count_after
  from public.messages;

  if message_count_before <> message_count_after then
    raise exception 'Message count changed during single-active-conversation migration (% -> %)',
      message_count_before, message_count_after;
  end if;

  if exists (
    select 1
    from public.conversations
    where merged_into is null
    group by pair_key
    having count(*) > 1
  ) then
    raise exception 'More than one unmerged conversation exists for a user pair';
  end if;

  if exists (
    select 1
    from public.conversations c
    where c.merged_into is not null
      and not exists (
        select 1
        from public.conversations parent
        where parent.id = c.merged_into
          and parent.pair_key = c.pair_key
          and parent.merged_into is null
      )
  ) then
    raise exception 'A merged conversation does not point to its pair primary';
  end if;
end;
$$;

create index if not exists conversations_merged_into_idx
  on public.conversations (merged_into)
  where merged_into is not null;

create unique index if not exists conversations_single_active_pair_idx
  on public.conversations (pair_key)
  where merged_into is null;

alter policy "Read own conversations" on public.conversations
  to authenticated
  using ((select auth.uid()) in (participant_a_id, participant_b_id));

create function public.get_or_create_conversation(
  p_peer_id uuid,
  p_user_role text,
  p_peer_role text,
  p_project_id text default null
)
returns table (
  id uuid,
  participant_a_id uuid,
  participant_b_id uuid,
  participant_a_role text,
  participant_b_role text,
  project_id text,
  updated_at timestamptz,
  last_message_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_pair_key text;
  v_project_owner uuid;
  v_project_kind text;
  v_project_status text;
  v_user_is_a boolean;
  v_conversation public.conversations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_peer_id is null or p_peer_id = v_user_id then
    raise exception 'A different conversation participant is required' using errcode = '22023';
  end if;
  if p_user_role is null
    or p_peer_role is null
    or p_user_role not in ('client', 'dev')
    or p_peer_role not in ('client', 'dev')
    or p_user_role = p_peer_role then
    raise exception 'A client and developer workspace are required' using errcode = '22023';
  end if;
  if not public.has_account_workspace(p_user_role) then
    raise exception 'Workspace access denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_peer_id and p.account_role = p_peer_role
    union all
    select 1 from public.account_workspaces w
    where w.user_id = p_peer_id and w.role = p_peer_role
  ) then
    raise exception 'The other participant workspace does not exist' using errcode = '42501';
  end if;

  if p_project_id is not null then
    select p.owner_id, p.project_kind, p.status
    into v_project_owner, v_project_kind, v_project_status
    from public.projects p
    where p.id = p_project_id;

    if not found
      or v_project_owner is distinct from p_peer_id
      or v_project_status not in ('published', 'open')
      or (
        v_project_kind = 'portfolio'
        and (p_user_role <> 'client' or p_peer_role <> 'dev')
      )
      or (
        v_project_kind is distinct from 'portfolio'
        and (p_user_role <> 'dev' or p_peer_role <> 'client')
      ) then
      raise exception 'The project is not available for this conversation' using errcode = '42501';
    end if;
  end if;

  v_pair_key :=
    least(v_user_id, p_peer_id)::text || ':' ||
    greatest(v_user_id, p_peer_id)::text;

  perform pg_advisory_xact_lock(hashtextextended(v_pair_key, 0));

  select c.*
  into v_conversation
  from public.conversations c
  where c.pair_key = v_pair_key
    and c.merged_into is null
  order by c.is_primary desc, c.created_at asc, c.id asc
  limit 1
  for update;

  if not found then
    v_user_is_a := v_user_id < p_peer_id;

    insert into public.conversations (
      participant_a_id,
      participant_b_id,
      participant_a_role,
      participant_b_role,
      project_id,
      is_primary,
      is_active
    )
    values (
      least(v_user_id, p_peer_id),
      greatest(v_user_id, p_peer_id),
      case when v_user_is_a then p_user_role else p_peer_role end,
      case when v_user_is_a then p_peer_role else p_user_role end,
      p_project_id,
      true,
      false
    )
    returning * into v_conversation;
  end if;

  return query
  select
    c.id,
    c.participant_a_id,
    c.participant_b_id,
    c.participant_a_role,
    c.participant_b_role,
    c.project_id,
    c.updated_at,
    c.last_message_at
  from public.conversations c
  where c.id = v_conversation.id;
end;
$$;

revoke all on function public.get_or_create_conversation(uuid, text, text, text)
  from public, anon;
grant execute on function public.get_or_create_conversation(uuid, text, text, text)
  to authenticated;

commit;
