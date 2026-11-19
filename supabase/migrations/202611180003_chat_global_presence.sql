begin;

create policy "Chat participants can read user presence"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.topic() ~ '^devmatch-user-presence:[0-9a-fA-F-]{36}$'
    and (
      lower(substring(realtime.topic()
        from '^devmatch-user-presence:([0-9a-fA-F-]{36})$')) = auth.uid()::text
      or exists (
        select 1
        from public.conversations c
        where auth.uid() in (c.participant_a_id, c.participant_b_id)
          and lower(substring(realtime.topic()
            from '^devmatch-user-presence:([0-9a-fA-F-]{36})$'))
            in (c.participant_a_id::text, c.participant_b_id::text)
      )
    )
  );

create policy "Users can publish their own presence"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.topic() ~ '^devmatch-user-presence:[0-9a-fA-F-]{36}$'
    and lower(substring(realtime.topic()
      from '^devmatch-user-presence:([0-9a-fA-F-]{36})$')) = auth.uid()::text
  );

commit;
