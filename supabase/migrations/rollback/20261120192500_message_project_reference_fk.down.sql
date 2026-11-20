begin;

drop policy if exists "Project references are immutable to participants"
  on public.messages;
drop policy if exists "Project references require chat API"
  on public.messages;
drop trigger if exists messages_preserve_project_reference
  on public.messages;
drop function if exists public.preserve_message_project_reference();
alter table public.messages
  drop constraint if exists messages_project_reference_matches_id_check,
  drop constraint if exists messages_project_id_fkey;

-- Keep project_reference_id; dropping it would discard references for deleted projects.

commit;
