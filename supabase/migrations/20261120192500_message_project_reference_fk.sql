-- Supersedes the no-FK message.project_id retention strategy by pairing a live
-- FK with an immutable per-message ID that survives project deletion.
-- No message ciphertext or message rows are deleted or rewritten.

begin;

create temporary table message_project_reference_count_before (
  message_count bigint not null
) on commit drop;

insert into pg_temp.message_project_reference_count_before
select count(*) from public.messages;

alter table public.messages
  add column project_reference_id text;

update public.messages
set project_reference_id = project_id
where project_id is not null;

update public.messages m
set project_id = null
where project_id is not null
  and not exists (
    select 1
    from public.projects p
    where p.id = m.project_id
  );

create function public.preserve_message_project_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.project_reference_id := new.project_id;
  else
    new.project_reference_id := coalesce(
      old.project_reference_id,
      old.project_id,
      new.project_id
    );
  end if;
  return new;
end;
$$;

revoke all on function public.preserve_message_project_reference()
  from public, anon, authenticated;
grant execute on function public.preserve_message_project_reference()
  to service_role;

create trigger messages_preserve_project_reference
  before insert or update of project_id, project_reference_id
  on public.messages
  for each row execute function public.preserve_message_project_reference();

create policy "Project references require chat API"
  on public.messages
  as restrictive
  for insert
  to authenticated
  with check (project_id is null and project_reference_id is null);

create policy "Project references are immutable to participants"
  on public.messages
  as restrictive
  for update
  to authenticated
  using (project_id is null and project_reference_id is null)
  with check (project_id is null and project_reference_id is null);

alter table public.messages
  add constraint messages_project_id_fkey
    foreign key (project_id)
    references public.projects(id)
    on delete set null,
  add constraint messages_project_reference_matches_id_check
    check (project_id is null or project_reference_id = project_id);

comment on column public.messages.project_reference_id is
  'Immutable text reference for the project attached to this message. Preserved when the nullable project_id foreign key is cleared after project deletion.';

do $$
declare
  message_count_before bigint;
  message_count_after bigint;
begin
  select message_count
  into message_count_before
  from pg_temp.message_project_reference_count_before;

  select count(*)
  into message_count_after
  from public.messages;

  if message_count_before <> message_count_after then
    raise exception 'Project-reference migration changed message count (% -> %)',
      message_count_before, message_count_after;
  end if;

  if exists (
    select 1
    from public.messages
    where project_id is not null
      and project_reference_id is distinct from project_id
  ) then
    raise exception 'A live project reference was not preserved';
  end if;
end;
$$;

commit;
