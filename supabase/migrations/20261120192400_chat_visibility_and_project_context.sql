begin;

create temporary table chat_visibility_message_count_before (
  message_count bigint not null
) on commit drop;

insert into pg_temp.chat_visibility_message_count_before
select count(*) from public.messages;

alter table public.messages
  add column project_kind text
    check (project_kind in ('request', 'portfolio'));

comment on column public.messages.project_kind is
  'Server-validated type of the project context identified by project_id. Kept when a project is deleted so the UI can use a safe unavailable label.';

update public.messages m
set project_kind = p.project_kind
from public.projects p
where m.project_id = p.id
  and p.project_kind in ('request', 'portfolio');

create function public.activate_root_conversation_after_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.conversations
  set is_active = true
  where id = new.conversation_id
    and merged_into is null
    and is_active = false;
  return new;
end;
$$;

revoke all on function public.activate_root_conversation_after_message()
  from public, anon, authenticated;
grant execute on function public.activate_root_conversation_after_message()
  to service_role;

create trigger messages_activate_root_conversation_after_insert
  after insert on public.messages
  for each row execute function public.activate_root_conversation_after_message();

create policy "Read only active root conversations"
  on public.conversations
  as restrictive
  for select
  to authenticated
  using (merged_into is null and is_active);

create policy "Read only messages in active root conversations"
  on public.messages
  as restrictive
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and c.merged_into is null
        and c.is_active
    )
  );

do $$
declare
  message_count_before bigint;
  message_count_after bigint;
begin
  select message_count
  into message_count_before
  from pg_temp.chat_visibility_message_count_before;

  select count(*)
  into message_count_after
  from public.messages;

  if message_count_before <> message_count_after then
    raise exception 'Chat visibility migration changed message count (% -> %)',
      message_count_before, message_count_after;
  end if;
end;
$$;

commit;

-- Verification queries (run only against an explicitly approved staging ref):
-- Before migration:
-- SELECT count(*) AS message_count_before FROM public.messages;
-- After migration:
-- SELECT count(*) AS message_count_after FROM public.messages;
-- SELECT c.id
-- FROM public.conversations c
-- WHERE NOT c.is_active
--   AND EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id);
-- The second query should return no rows.
