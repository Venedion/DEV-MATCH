begin;

do $$
begin
  if exists (select 1 from public.messages limit 1) then
    raise exception 'public.messages contains plaintext rows; encrypt or export them before applying the chat security migration';
  end if;
end;
$$;

alter table public.messages drop column text;
alter table public.messages drop column metadata;
alter table public.messages
  add column ciphertext text not null
    check (char_length(ciphertext) between 22 and 40000
      and ciphertext ~ '^[A-Za-z0-9_-]+$'),
  add column nonce text not null
    check (char_length(nonce) = 16 and nonce ~ '^[A-Za-z0-9_-]+$'),
  add column key_version smallint not null
    check (key_version between 1 and 32767);

drop policy "Create own conversation messages" on public.messages;
drop policy "Update own conversation messages" on public.messages;
drop policy "Delete own conversation messages" on public.messages;
drop policy "Read conversation messages" on public.messages;

create policy "Read conversation messages" on public.messages
  for select to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.participant_a_id, c.participant_b_id)
    )
  );

revoke all on public.messages from public, anon, authenticated;
grant select on public.messages to authenticated;
grant all on public.messages to service_role;
grant select on public.profiles, public.directory_people, public.projects to service_role;

drop policy "Create conversation for self" on public.conversations;
revoke all on public.conversations from public, anon, authenticated;
grant select on public.conversations to authenticated;
grant all on public.conversations to service_role;

create function private.validate_chat_message_sender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.conversations c
    where c.id = new.conversation_id
      and new.sender_id in (c.participant_a_id, c.participant_b_id)
  ) then
    raise exception 'Message sender must belong to the conversation'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_chat_message_sender()
  from public, anon, authenticated;

create trigger validate_chat_message_sender_before_insert
  before insert on public.messages
  for each row execute function private.validate_chat_message_sender();

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'Supabase Realtime publication is missing';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end;
$$;

commit;
