begin;

create table if not exists public.payment_rooms (
  conversation_id uuid not null references public.conversations(id),
  project_id text not null references public.projects(id),
  version integer not null default 1,
  state jsonb not null,
  primary key (conversation_id, project_id)
);

create table if not exists public.payment_order_refs (
  order_id text primary key,
  conversation_id uuid not null,
  project_id text not null,
  foreign key (conversation_id, project_id) references public.payment_rooms(conversation_id, project_id)
);

create table if not exists public.payment_dispute_reviewers (
  conversation_id uuid not null references public.conversations(id),
  project_id text not null references public.projects(id),
  reviewer_id uuid not null references auth.users(id),
  primary key (conversation_id, project_id, reviewer_id)
);

alter table public.payment_rooms enable row level security;
alter table public.payment_order_refs enable row level security;
alter table public.payment_dispute_reviewers enable row level security;
revoke all on public.payment_rooms, public.payment_order_refs, public.payment_dispute_reviewers from public, anon, authenticated;
grant select, insert, update on public.payment_rooms, public.payment_order_refs to service_role;
grant select on public.payment_dispute_reviewers to service_role;

create or replace function public.payment_room_context(p_user uuid, p_conversation uuid, p_project text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'role', case
      when c.participant_a_id = p_user then case c.participant_a_role when 'dev' then 'developer' else c.participant_a_role end
      when c.participant_b_id = p_user then case c.participant_b_role when 'dev' then 'developer' else c.participant_b_role end
      when r.reviewer_id is not null then 'reviewer'
    end,
    'version', coalesce(s.version, 0), 'state', s.state
  )
  from public.conversations c
  join public.projects p on p.id = p_project and c.project_id = p.id
  left join public.payment_rooms s on (s.conversation_id, s.project_id) = (c.id, p.id)
  left join public.payment_dispute_reviewers r
    on (r.conversation_id, r.project_id, r.reviewer_id) = (c.id, p.id, p_user)
  where c.id = p_conversation
    and ((c.participant_a_role = 'dev' and c.participant_b_role = 'client')
      or (c.participant_a_role = 'client' and c.participant_b_role = 'dev'))
    and p.owner_id = case
      when (p.project_kind = 'portfolio' and c.participant_a_role = 'dev')
        or (p.project_kind = 'request' and c.participant_a_role = 'client') then c.participant_a_id
      else c.participant_b_id
    end
    and (p_user in (c.participant_a_id, c.participant_b_id) or r.reviewer_id is not null)
$$;

create or replace function public.payment_reviewer_rooms(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'conversationId', r.conversation_id, 'projectId', r.project_id, 'title', p.title
  ) order by p.title), '[]'::jsonb)
  from public.payment_dispute_reviewers r
  join public.projects p on p.id = r.project_id
  join public.payment_rooms s using (project_id)
  where s.conversation_id = r.conversation_id and r.reviewer_id = p_user
    and s.state->'room'->'dispute'->>'status' = 'NEEDS_REVIEW'
    and public.payment_room_context(p_user, r.conversation_id, r.project_id)->>'role' = 'reviewer'
$$;

create or replace function public.payment_save_room(
  p_conversation uuid, p_project text, p_version integer, p_state jsonb, p_order_id text default null
) returns boolean language plpgsql set search_path = '' as $$
begin
  if p_version = 0 then
    insert into public.payment_rooms (conversation_id, project_id, state)
      values (p_conversation, p_project, p_state) on conflict do nothing;
  else
    update public.payment_rooms set state = p_state, version = p_version + 1
      where conversation_id = p_conversation and project_id = p_project and version = p_version;
  end if;
  if not found then return false; end if;
  if p_order_id is not null then
    insert into public.payment_order_refs values (p_order_id, p_conversation, p_project);
  end if;
  return true;
end;
$$;

revoke all on function public.payment_room_context(uuid, uuid, text),
  public.payment_reviewer_rooms(uuid),
  public.payment_save_room(uuid, text, integer, jsonb, text) from public, anon, authenticated;
grant execute on function public.payment_room_context(uuid, uuid, text),
  public.payment_reviewer_rooms(uuid),
  public.payment_save_room(uuid, text, integer, jsonb, text) to service_role;

commit;
