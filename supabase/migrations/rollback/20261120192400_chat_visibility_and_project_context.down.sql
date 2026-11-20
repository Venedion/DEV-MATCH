begin;

drop policy if exists "Read only messages in active root conversations"
  on public.messages;
drop policy if exists "Read only active root conversations"
  on public.conversations;
drop trigger if exists messages_activate_root_conversation_after_insert
  on public.messages;
drop function if exists public.activate_root_conversation_after_message();

-- Keep messages.project_kind and its backfilled metadata on rollback.

commit;
