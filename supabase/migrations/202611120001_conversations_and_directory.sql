begin;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_a_id uuid not null references auth.users(id) on delete cascade,
  participant_b_id uuid not null references auth.users(id) on delete cascade,
  project_id text check (char_length(project_id) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  check (participant_a_id <> participant_b_id)
);

create unique index conversations_participants_unique_idx
  on public.conversations (
    least(participant_a_id, participant_b_id),
    greatest(participant_a_id, participant_b_id),
    coalesce(project_id, '')
  );

create index conversations_participant_a_idx
  on public.conversations (participant_a_id, updated_at desc);
create index conversations_participant_b_idx
  on public.conversations (participant_b_id, updated_at desc);

alter table public.conversations enable row level security;
revoke all on public.conversations from public, anon, authenticated;
grant select, insert on public.conversations to authenticated;

create policy "Read own conversations" on public.conversations
  for select to authenticated
  using (
    (select auth.uid()) in (participant_a_id, participant_b_id)
  );

create policy "Create conversation for self" on public.conversations
  for insert to authenticated
  with check (
    (select auth.uid()) in (participant_a_id, participant_b_id)
    and participant_a_id <> participant_b_id
  );

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 5000),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);
create index messages_sender_created_idx
  on public.messages (sender_id, created_at desc);

alter table public.messages enable row level security;
revoke all on public.messages from public, anon, authenticated;
grant select, insert, update, delete on public.messages to authenticated;

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

create policy "Create own conversation messages" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.participant_a_id, c.participant_b_id)
    )
  );

create policy "Update own conversation messages" on public.messages
  for update to authenticated
  using (sender_id = (select auth.uid()))
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.participant_a_id, c.participant_b_id)
    )
  );

create policy "Delete own conversation messages" on public.messages
  for delete to authenticated
  using (sender_id = (select auth.uid()));

create function public.touch_conversation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set updated_at = now(),
      last_message_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function public.touch_conversation_updated_at() from public, anon, authenticated;

create trigger conversations_touch_on_insert
  after insert on public.messages
  for each row execute function public.touch_conversation_updated_at();

create or replace view public.directory_people as
select
  p.id,
  p.display_name,
  p.username,
  p.account_role,
  jsonb_strip_nulls(jsonb_build_object(
    'city', p.profile_data->'city',
    'bio', p.profile_data->'bio',
    'specialty', p.profile_data->'specialty',
    'specialtyOther', p.profile_data->'specialtyOther',
    'skills', p.profile_data->'skills',
    'hourlyRate', p.profile_data->'hourlyRate',
    'minProjectPrice', p.profile_data->'minProjectPrice',
    'availability', p.profile_data->'availability',
    'companyName', p.profile_data->'companyName',
    'industry', p.profile_data->'industry'
  )) as profile_data,
  coalesce((
    select count(*)
    from public.projects prj
    where prj.owner_id = p.id
      and prj.project_kind = 'portfolio'
      and prj.status = 'published'
  ), 0) as published_portfolio_count,
  coalesce((
    select count(*)
    from public.projects prj
    where prj.owner_id = p.id
      and prj.project_kind = 'request'
      and prj.status = 'open'
  ), 0) as open_request_count
from public.profiles p
where p.onboarding_complete = true;

revoke all on public.directory_people from public, anon, authenticated;
grant select on public.directory_people to authenticated;

commit;
