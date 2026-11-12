begin;

drop index if exists public.conversations_participants_unique_idx;
create unique index conversations_participants_unique_idx
  on public.conversations (
    least(participant_a_id, participant_b_id),
    greatest(participant_a_id, participant_b_id),
    coalesce(project_id, '')
  );

drop policy if exists "Read project comments" on public.comments;
create policy "Read public project comments" on public.comments
  for select to anon, authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.status in ('published', 'open')
    )
  );

drop policy if exists "Create own project comments" on public.comments;
create policy "Create own comments on public projects" on public.comments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.status in ('published', 'open')
    )
  );

commit;
