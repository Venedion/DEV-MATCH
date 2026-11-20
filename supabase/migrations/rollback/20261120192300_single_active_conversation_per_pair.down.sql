begin;

lock table public.conversations in share row exclusive mode;

create temp table rollback_conversation_message_count (
  message_count bigint not null
) on commit drop;

insert into pg_temp.rollback_conversation_message_count
select count(*) from public.messages;

drop index if exists public.conversations_single_active_pair_idx;
drop index if exists public.conversations_merged_into_idx;

update public.conversations
set merged_into = null,
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
    select 1 from public.messages m where m.conversation_id = c.id
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
  from pg_temp.rollback_conversation_message_count;

  select count(*)
  into message_count_after
  from public.messages;

  if message_count_before <> message_count_after then
    raise exception 'Message count changed during single-active-conversation rollback (% -> %)',
      message_count_before, message_count_after;
  end if;
end;
$$;

commit;
