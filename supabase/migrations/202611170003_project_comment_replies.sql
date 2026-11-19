begin;

alter table public.comments
  add column if not exists parent_comment_id uuid
  references public.comments(id) on delete cascade;

create index if not exists comments_parent_created_idx
  on public.comments (parent_comment_id, created_at);

create or replace function public.can_reply_to_project_comment(
  p_project_id text,
  p_parent_comment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.comments parent
    join public.projects p on p.id = parent.project_id
    where parent.id = p_parent_comment_id
      and parent.project_id = p_project_id
      and parent.user_id <> (select auth.uid())
      and p.owner_id = (select auth.uid())
  );
$$;

revoke all on function public.can_reply_to_project_comment(text, uuid) from public, anon;
grant execute on function public.can_reply_to_project_comment(text, uuid) to authenticated;

drop policy if exists "Read public project comments" on public.comments;
create policy "Read public project comments" on public.comments
  for select to anon, authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and (
          p.status in ('published', 'open')
          or p.owner_id = (select auth.uid())
        )
    )
  );

drop policy if exists "Create own comments on public projects" on public.comments;
create policy "Create own comments and owner replies" on public.comments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      (
        parent_comment_id is null
        and exists (
          select 1
          from public.projects p
          where p.id = project_id
            and p.status in ('published', 'open')
        )
      )
      or (
        parent_comment_id is not null
        and public.can_reply_to_project_comment(project_id, parent_comment_id)
      )
    )
  );

alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('comment', 'reply', 'favorite', 'message'));

create or replace function public.notify_project_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_recipient uuid;
  notification_kind text;
begin
  if new.parent_comment_id is not null then
    select parent.user_id
    into notification_recipient
    from public.comments parent
    where parent.id = new.parent_comment_id
      and parent.project_id = new.project_id;
    notification_kind := 'reply';
  else
    select p.owner_id
    into notification_recipient
    from public.projects p
    where p.id = new.project_id;
    notification_kind := 'comment';
  end if;

  if notification_recipient is not null
    and notification_recipient <> new.user_id
    and not exists (
      select 1
      from public.profiles profile
      where profile.id = notification_recipient
        and profile.profile_data->'notificationPreferences'->>'comments' = 'false'
    )
  then
    insert into public.notifications (recipient_id, actor_id, kind, project_id)
    values (notification_recipient, new.user_id, notification_kind, new.project_id);
  end if;

  return new;
end;
$$;

revoke all on function public.notify_project_comment() from public, anon, authenticated;

commit;
