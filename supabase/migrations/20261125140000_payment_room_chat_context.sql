begin;

create or replace function public.payment_room_context(p_user uuid, p_conversation uuid, p_project text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with requested as (
    select c.*, p.owner_id, p.project_kind
    from public.conversations c
    join public.projects p on p.id = p_project
    where c.id = p_conversation
      and ((c.participant_a_role = 'dev' and c.participant_b_role = 'client')
        or (c.participant_a_role = 'client' and c.participant_b_role = 'dev'))
      and p.owner_id = case
        when (p.project_kind = 'portfolio' and c.participant_a_role = 'dev')
          or (p.project_kind = 'request' and c.participant_a_role = 'client') then c.participant_a_id
        else c.participant_b_id
      end
  ),
  sources as materialized (
    select c.id, c.project_id, c.merged_into, c.created_at
    from public.conversations c cross join requested r
    where ((c.participant_a_id, c.participant_a_role, c.participant_b_id, c.participant_b_role)
      = (r.participant_a_id, r.participant_a_role, r.participant_b_id, r.participant_b_role))
      or ((c.participant_a_id, c.participant_a_role, c.participant_b_id, c.participant_b_role)
      = (r.participant_b_id, r.participant_b_role, r.participant_a_id, r.participant_a_role))
  ),
  target as (
    select s.id, stored.version, stored.state
    from sources s
    left join public.payment_rooms stored on stored.conversation_id = s.id and stored.project_id = p_project
    order by (stored.conversation_id is not null) desc, (s.merged_into is null) desc, s.created_at, s.id
    limit 1
  ),
  membership as (
    select case
      when r.participant_a_id = p_user then case r.participant_a_role when 'dev' then 'developer' else r.participant_a_role end
      when r.participant_b_id = p_user then case r.participant_b_role when 'dev' then 'developer' else r.participant_b_role end
      when exists (select 1 from public.payment_dispute_reviewers reviewer
        join sources s on s.id = reviewer.conversation_id
        where reviewer.reviewer_id = p_user and reviewer.project_id = p_project) then 'reviewer'
    end as role
    from requested r
  )
  select jsonb_build_object('role', m.role, 'conversationId', t.id,
    'version', coalesce(t.version, 0), 'state', t.state)
  from target t cross join membership m
  where m.role is not null and (
    t.state is not null
    or exists (select 1 from sources s where s.project_id = p_project)
    or exists (select 1 from public.messages message join sources s on s.id = message.conversation_id
      where message.project_reference_id = p_project or message.project_id = p_project)
  )
$$;

create or replace function public.payment_reviewer_rooms(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(assignment) order by assignment.title), '[]'::jsonb)
  from (
    select distinct context.data->>'conversationId' as "conversationId", r.project_id as "projectId", p.title
    from public.payment_dispute_reviewers r
    join public.projects p on p.id = r.project_id
    cross join lateral (select public.payment_room_context(p_user, r.conversation_id, r.project_id) as data) context
    where r.reviewer_id = p_user and context.data->>'role' = 'reviewer'
      and context.data->'state'->'room'->'dispute'->>'status' = 'NEEDS_REVIEW'
  ) assignment
$$;

commit;
