-- This migration preserves all message rows and ciphertext. It adds metadata
-- for virtual grouping only; messages remain bound to their original conversation_id.
--
-- projects.id is text and project deletion is a hard DELETE. messages.project_id
-- intentionally has no FK so a deleted or unpublished project can render as
-- "Project unavailable" while retaining its original identifier. Authenticated
-- users cannot insert or update projects.id; privileged admin/service access
-- can still explicitly reuse a deleted ID, which is an accepted residual risk.
-- The current application uses these projects columns:
--   id, owner_id, project_kind, legacy_id, title, project_type, category,
--   price, price_type, cover_image, status, data, created_at, updated_at.
-- The authenticated grants below preserve access to every column except id.
-- Future send-message handling must accept messages.project_id only when it
-- identifies an existing published portfolio project. New messages store the
-- reference on messages.project_id, never on conversations.project_id. Render
-- project details only for an existing published portfolio; otherwise render
-- "Project unavailable" without project title, price, or image.
-- Application-created IDs use gen_random_uuid() and authenticated callers
-- cannot supply/update id; privileged admin/service access and an extremely
-- unlikely random UUID collision remain outside that guarantee.
--
-- Later get_or_create_conversation routing must:
--   * use pair_key independent of participant order and workspace role;
--   * select the existing primary, or select the oldest empty conversation
--     (created_at, id) when the pair has only empty conversations;
--   * serialize creation/activation per pair and make the chosen conversation
--     primary only when its first message is committed.
--
-- Message-count verification is asserted in this transaction. For a manual
-- before/after check, record this result before applying and compare afterward:
--   SELECT count(*) AS message_count_before FROM public.messages;
-- After applying:
--   SELECT count(*) AS message_count_after FROM public.messages;
--
-- Expected to return no rows before the unique index is created:
--   SELECT pair_key, count(*) AS primary_count
--   FROM public.conversations
--   WHERE is_primary
--   GROUP BY pair_key
--   HAVING count(*) > 1;
--
-- Post-migration checks (each should return no violations):
--   SELECT pair_key, count(*)
--   FROM public.conversations
--   WHERE is_primary
--   GROUP BY pair_key
--   HAVING count(*) > 1;
--   SELECT c.id
--   FROM public.conversations c
--   WHERE NOT c.is_active
--     AND EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id);
--
-- Dry run: pairs with multiple source conversations, total message count,
-- and the oldest nonempty conversation candidate (created_at, then id).
-- This does not move or alter any messages.
-- WITH per_conversation AS (
--   SELECT
--     c.id,
--     c.created_at,
--     least(c.participant_a_id, c.participant_b_id) AS pair_user_1,
--     greatest(c.participant_a_id, c.participant_b_id) AS pair_user_2,
--     count(m.id)::bigint AS message_count
--   FROM public.conversations c
--   LEFT JOIN public.messages m ON m.conversation_id = c.id
--   GROUP BY c.id
-- ),
-- pairs AS (
--   SELECT
--     pair_user_1,
--     pair_user_2,
--     count(*) AS conversation_count,
--     sum(message_count) AS total_message_count,
--     array_agg(id ORDER BY created_at, id) AS source_conversation_ids
--   FROM per_conversation
--   GROUP BY pair_user_1, pair_user_2
--   HAVING count(*) > 1
-- ),
-- ranked_nonempty AS (
--   SELECT
--     id,
--     pair_user_1,
--     pair_user_2,
--     row_number() OVER (
--       PARTITION BY pair_user_1, pair_user_2
--       ORDER BY created_at ASC, id ASC
--     ) AS position
--   FROM per_conversation
--   WHERE message_count > 0
-- )
-- SELECT
--   p.pair_user_1,
--   p.pair_user_2,
--   p.conversation_count,
--   p.total_message_count,
--   p.source_conversation_ids,
--   r.id AS main_conversation_candidate
-- FROM pairs p
-- LEFT JOIN ranked_nonempty r
--   ON r.pair_user_1 = p.pair_user_1
--  AND r.pair_user_2 = p.pair_user_2
--  AND r.position = 1
-- ORDER BY p.conversation_count DESC, p.pair_user_1, p.pair_user_2;

begin;

create temp table if not exists virtual_conversation_message_count_before (
  message_count bigint not null
) on commit drop;
truncate table pg_temp.virtual_conversation_message_count_before;
insert into pg_temp.virtual_conversation_message_count_before (message_count)
select count(*) from public.messages;

alter table public.conversations
  add column if not exists pair_key text
    generated always as (
      least(participant_a_id, participant_b_id)::text || ':' ||
      greatest(participant_a_id, participant_b_id)::text
    ) stored,
  add column if not exists is_primary boolean not null default false,
  add column if not exists is_active boolean not null default true;

alter table public.messages
  add column if not exists project_id text;

comment on column public.messages.project_id is
  'Nullable project reference for this message. Intentionally has no FK so hard-deleted or unavailable projects retain their ID for an unavailable-card fallback.';
comment on column public.conversations.pair_key is
  'Stable sorted participant user IDs, independent of participant order and workspace roles.';
comment on column public.conversations.is_primary is
  'Marks the canonical conversation row for a virtual user-pair thread; source message rows remain in their original conversations.';
comment on column public.conversations.is_active is
  'False for conversations with no messages; retained rather than deleted.';

revoke insert, update on table public.projects from authenticated;
revoke insert (id), update (id) on table public.projects from authenticated;

grant insert (
  owner_id,
  project_kind,
  legacy_id,
  title,
  project_type,
  category,
  price,
  price_type,
  cover_image,
  status,
  data,
  created_at,
  updated_at
) on table public.projects to authenticated;

grant update (
  owner_id,
  project_kind,
  legacy_id,
  title,
  project_type,
  category,
  price,
  price_type,
  cover_image,
  status,
  data,
  created_at,
  updated_at
) on table public.projects to authenticated;

update public.conversations c
set is_active = exists (
      select 1
      from public.messages m
      where m.conversation_id = c.id
    ),
    is_primary = false;

with ranked_nonempty as (
  select
    c.id,
    row_number() over (
      partition by c.pair_key
      order by c.created_at asc, c.id asc
    ) as pair_position
  from public.conversations c
  where exists (
    select 1
    from public.messages m
    where m.conversation_id = c.id
  )
)
update public.conversations c
set is_primary = true
from ranked_nonempty r
where r.id = c.id
  and r.pair_position = 1;

do $$
declare
  message_count_before bigint;
  message_count_after bigint;
begin
  select message_count
  into message_count_before
  from pg_temp.virtual_conversation_message_count_before;

  select count(*)
  into message_count_after
  from public.messages;

  if message_count_before <> message_count_after then
    raise exception 'Message count changed during virtual conversation migration (% -> %)',
      message_count_before, message_count_after;
  end if;

  if exists (
    select 1
    from public.conversations
    where is_primary
    group by pair_key
    having count(*) > 1
  ) then
    raise exception 'More than one primary conversation exists for a user pair';
  end if;

  if exists (
    select 1
    from public.conversations c
    where not c.is_active
      and exists (
        select 1
        from public.messages m
        where m.conversation_id = c.id
      )
  ) then
    raise exception 'A conversation with messages is marked inactive';
  end if;
end;
$$;

create unique index if not exists conversations_single_primary_pair_idx
  on public.conversations (pair_key)
  where is_primary;

commit;
