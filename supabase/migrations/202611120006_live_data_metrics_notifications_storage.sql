begin;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('comment', 'favorite', 'message')),
  project_id text references public.projects(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (project_id is not null or conversation_id is not null)
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;

create policy "Read own notifications" on public.notifications
  for select to authenticated
  using ((select auth.uid()) = recipient_id);

create table public.project_views (
  project_id text not null references public.projects(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_on date not null,
  primary key (project_id, viewer_id, viewed_on)
);

create index project_views_project_idx on public.project_views (project_id);

alter table public.project_views enable row level security;
revoke all on public.project_views from public, anon, authenticated;
grant select on public.project_views to authenticated;

create policy "Project owners read view counts" on public.project_views
  for select to authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_views.project_id
        and p.owner_id = (select auth.uid())
    )
  );

create function public.record_project_view(p_project_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  view_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to record a project view'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.status in ('published', 'open')
  ) then
    raise exception 'The project is not publicly available'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.owner_id = current_user_id
  ) then
    insert into public.project_views (project_id, viewer_id, viewed_on)
    values (p_project_id, current_user_id, (timezone('utc', now()))::date)
    on conflict do nothing;
    return null;
  end if;

  select count(*)::integer
  into view_count
  from public.project_views
  where project_id = p_project_id;

  return view_count;
end;
$$;

revoke all on function public.record_project_view(text) from public, anon;
grant execute on function public.record_project_view(text) to authenticated;

create function public.get_dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  metric_projects integer;
  metric_views integer;
  metric_favorites integer;
  metric_comments integer;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to load dashboard metrics'
      using errcode = '28000';
  end if;

  select count(*)::integer
  into metric_projects
  from public.projects p
  where p.owner_id = current_user_id
    and p.project_kind = case
      when exists (
        select 1 from public.profiles profile
        where profile.id = current_user_id and profile.account_role = 'client'
      ) then 'request'
      else 'portfolio'
    end;

  select count(*)::integer
  into metric_views
  from public.project_views v
  join public.projects p on p.id = v.project_id
  where p.owner_id = current_user_id;

  select count(*)::integer
  into metric_favorites
  from public.favorites f
  join public.projects p on p.id = f.item_id
  where p.owner_id = current_user_id
    and f.item_type = 'project';

  select count(*)::integer
  into metric_comments
  from public.comments c
  join public.projects p on p.id = c.project_id
  where p.owner_id = current_user_id;

  return jsonb_build_object(
    'projects', metric_projects,
    'views', metric_views,
    'favorites', metric_favorites,
    'comments', metric_comments
  );
end;
$$;

revoke all on function public.get_dashboard_metrics() from public, anon;
grant execute on function public.get_dashboard_metrics() to authenticated;

create function public.notify_project_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_owner uuid;
begin
  select p.owner_id
  into project_owner
  from public.projects p
  where p.id = new.project_id;

  if project_owner is not null
    and project_owner <> new.user_id
    and not exists (
      select 1
      from public.profiles profile
      where profile.id = project_owner
        and profile.profile_data->'notificationPreferences'->>'comments' = 'false'
    )
  then
    insert into public.notifications (recipient_id, actor_id, kind, project_id)
    values (project_owner, new.user_id, 'comment', new.project_id);
  end if;

  return new;
end;
$$;

revoke all on function public.notify_project_comment() from public, anon, authenticated;
create trigger notify_project_comment_after_insert
  after insert on public.comments
  for each row execute function public.notify_project_comment();

create function public.notify_project_favorite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_owner uuid;
begin
  if new.item_type <> 'project' then
    return new;
  end if;

  select p.owner_id
  into project_owner
  from public.projects p
  where p.id = new.item_id;

  if project_owner is not null
    and project_owner <> new.user_id
    and not exists (
      select 1
      from public.profiles profile
      where profile.id = project_owner
        and profile.profile_data->'notificationPreferences'->>'favorites' = 'false'
    )
  then
    insert into public.notifications (recipient_id, actor_id, kind, project_id)
    values (project_owner, new.user_id, 'favorite', new.item_id);
  end if;

  return new;
end;
$$;

revoke all on function public.notify_project_favorite() from public, anon, authenticated;
create trigger notify_project_favorite_after_insert
  after insert on public.favorites
  for each row execute function public.notify_project_favorite();

create function public.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  other_participant uuid;
begin
  select case
    when c.participant_a_id = new.sender_id then c.participant_b_id
    else c.participant_a_id
  end
  into other_participant
  from public.conversations c
  where c.id = new.conversation_id
    and new.sender_id in (c.participant_a_id, c.participant_b_id);

  if other_participant is not null
    and not exists (
      select 1
      from public.profiles profile
      where profile.id = other_participant
        and profile.profile_data->'notificationPreferences'->>'messages' = 'false'
    )
  then
    insert into public.notifications (recipient_id, actor_id, kind, project_id, conversation_id)
    select other_participant, new.sender_id, 'message', c.project_id, c.id
    from public.conversations c
    where c.id = new.conversation_id;
  end if;

  return new;
end;
$$;

revoke all on function public.notify_chat_message() from public, anon, authenticated;
create trigger notify_chat_message_after_insert
  after insert on public.messages
  for each row execute function public.notify_chat_message();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('project-media', 'project-media', true, 52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']),
  ('private-uploads', 'private-uploads', false, 10485760,
    array['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/webp']),
  ('chat-attachments', 'chat-attachments', false, 3145728,
    array['application/octet-stream'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Read public project media" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'project-media');

create policy "Upload own project media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Update own project media" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Delete own project media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Read authorized private uploads" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'private-uploads'
    and (
      (
        (storage.foldername(name))[1] = 'experience'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or (
        (storage.foldername(name))[1] = 'request'
        and exists (
          select 1
          from public.projects p
          where p.id = (storage.foldername(name))[3]
            and p.owner_id::text = (storage.foldername(name))[2]
            and (
              p.owner_id = (select auth.uid())
              or (
                p.project_kind = 'request'
                and p.status = 'open'
                and exists (
                  select 1 from public.profiles profile
                  where profile.id = (select auth.uid())
                    and profile.account_role = 'dev'
                )
              )
            )
        )
      )
    )
  );

create policy "Upload own private files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'private-uploads'
    and (
      (
        (storage.foldername(name))[1] = 'experience'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or (
        (storage.foldername(name))[1] = 'request'
        and (storage.foldername(name))[2] = (select auth.uid())::text
        and exists (
          select 1
          from public.projects p
          where p.id = (storage.foldername(name))[3]
            and p.owner_id = (select auth.uid())
            and p.project_kind = 'request'
        )
      )
    )
  );

create policy "Update own private files" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'private-uploads'
    and (
      ((storage.foldername(name))[1] = 'experience'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'request'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
    )
  )
  with check (
    bucket_id = 'private-uploads'
    and (
      ((storage.foldername(name))[1] = 'experience'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'request'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
    )
  );

create policy "Read encrypted chat attachments" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-attachments'
    and exists (
      select 1
      from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (c.participant_a_id, c.participant_b_id)
        and (storage.foldername(name))[2] in (
          c.participant_a_id::text,
          c.participant_b_id::text
        )
    )
  );

create policy "Delete own private files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'private-uploads'
    and (
      ((storage.foldername(name))[1] = 'experience'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'request'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
    )
  );

commit;
