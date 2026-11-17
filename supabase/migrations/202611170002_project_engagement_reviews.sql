begin;

create policy "Read projects linked to own conversations" on public.projects
  for select to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.project_id = public.projects.id
        and (select auth.uid()) in (c.participant_a_id, c.participant_b_id)
    )
  );

create table public.project_engagements (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  project_id text references public.projects(id) on delete set null,
  client_id uuid not null references auth.users(id) on delete cascade,
  developer_id uuid not null references auth.users(id) on delete cascade,
  client_completed_at timestamptz,
  developer_completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (client_id <> developer_id)
);

alter table public.project_engagements enable row level security;
revoke all on public.project_engagements from public, anon, authenticated;
grant select on public.project_engagements to authenticated;

create policy "Read own project engagements" on public.project_engagements
  for select to authenticated
  using ((select auth.uid()) in (client_id, developer_id));

create table public.project_reviews (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.project_engagements(id) on delete cascade,
  project_id text references public.projects(id) on delete set null,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewed_user_id uuid not null references auth.users(id) on delete cascade,
  reviewer_name text not null,
  reviewer_initials text not null,
  project_title text not null,
  rating smallint not null check (rating between 1 and 5),
  text text not null default '' check (char_length(text) <= 2000),
  created_at timestamptz not null default now(),
  unique (engagement_id, reviewer_id),
  check (reviewer_id <> reviewed_user_id)
);

create index project_reviews_recipient_created_idx
  on public.project_reviews (reviewed_user_id, created_at desc);

alter table public.project_reviews enable row level security;
revoke all on public.project_reviews from public, anon, authenticated;

create function public.get_profile_reviews(p_profile_id uuid)
returns table (
  id uuid,
  reviewer_name text,
  reviewer_initials text,
  project_title text,
  rating smallint,
  text text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.reviewer_name, r.reviewer_initials, r.project_title, r.rating, r.text, r.created_at
  from public.project_reviews r
  where r.reviewed_user_id = p_profile_id
  order by r.created_at desc;
$$;

revoke all on function public.get_profile_reviews(uuid) from public, anon, authenticated;
grant execute on function public.get_profile_reviews(uuid) to anon, authenticated;

create function public.get_my_project_review(p_engagement_id uuid)
returns table (
  id uuid,
  reviewer_name text,
  reviewer_initials text,
  project_title text,
  rating smallint,
  text text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.reviewer_name, r.reviewer_initials, r.project_title, r.rating, r.text, r.created_at
  from public.project_reviews r
  where r.engagement_id = p_engagement_id
    and r.reviewer_id = (select auth.uid());
$$;

revoke all on function public.get_my_project_review(uuid) from public, anon, authenticated;
grant execute on function public.get_my_project_review(uuid) to authenticated;

create function public.start_project_engagement(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
  v_owner_id uuid;
  v_project_kind text;
  v_project_status text;
  v_role_a text;
  v_role_b text;
  v_client_id uuid;
  v_developer_id uuid;
  v_engagement_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  select *
  into v_conversation
  from public.conversations
  where id = p_conversation_id;

  if not found or auth.uid() not in (v_conversation.participant_a_id, v_conversation.participant_b_id) then
    raise exception 'A conversation participant is required'
      using errcode = '42501';
  end if;

  if v_conversation.project_id is null then
    raise exception 'A project-linked conversation is required'
      using errcode = '23514';
  end if;

  select id
  into v_engagement_id
  from public.project_engagements
  where conversation_id = v_conversation.id;

  if found then
    return v_engagement_id;
  end if;

  select owner_id, project_kind, status
  into v_owner_id, v_project_kind, v_project_status
  from public.projects
  where id = v_conversation.project_id;

  if not found or v_project_status = 'draft' then
    raise exception 'The linked project is not available for review'
      using errcode = '23514';
  end if;

  select account_role into v_role_a
  from public.profiles
  where id = v_conversation.participant_a_id;
  select account_role into v_role_b
  from public.profiles
  where id = v_conversation.participant_b_id;

  if v_role_a = 'client' and v_role_b = 'dev' then
    v_client_id := v_conversation.participant_a_id;
    v_developer_id := v_conversation.participant_b_id;
  elsif v_role_a = 'dev' and v_role_b = 'client' then
    v_client_id := v_conversation.participant_b_id;
    v_developer_id := v_conversation.participant_a_id;
  else
    raise exception 'Reviews require one client and one developer'
      using errcode = '23514';
  end if;

  if v_owner_id not in (v_client_id, v_developer_id)
    or (v_project_kind = 'portfolio' and v_owner_id <> v_developer_id)
    or (v_project_kind = 'request' and v_owner_id <> v_client_id) then
    raise exception 'The linked project does not belong to a conversation participant'
      using errcode = '23514';
  end if;

  insert into public.project_engagements (conversation_id, project_id, client_id, developer_id)
  values (v_conversation.id, v_conversation.project_id, v_client_id, v_developer_id)
  on conflict (conversation_id) do nothing;

  select id
  into v_engagement_id
  from public.project_engagements
  where conversation_id = v_conversation.id;

  return v_engagement_id;
end;
$$;

revoke all on function public.start_project_engagement(uuid) from public, anon, authenticated;
grant execute on function public.start_project_engagement(uuid) to authenticated;

create function public.confirm_project_engagement(p_engagement_id uuid)
returns public.project_engagements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_engagement public.project_engagements%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  update public.project_engagements
  set client_completed_at = case
        when client_id = auth.uid() then coalesce(client_completed_at, now())
        else client_completed_at
      end,
      developer_completed_at = case
        when developer_id = auth.uid() then coalesce(developer_completed_at, now())
        else developer_completed_at
      end
  where id = p_engagement_id
    and auth.uid() in (client_id, developer_id)
  returning * into v_engagement;

  if not found then
    raise exception 'Project engagement not found or access denied'
      using errcode = '42501';
  end if;

  return v_engagement;
end;
$$;

revoke all on function public.confirm_project_engagement(uuid) from public, anon, authenticated;
grant execute on function public.confirm_project_engagement(uuid) to authenticated;

create function public.submit_project_review(
  p_engagement_id uuid,
  p_rating smallint,
  p_text text default ''
)
returns table (
  id uuid,
  reviewer_name text,
  reviewer_initials text,
  project_title text,
  rating smallint,
  text text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_engagement public.project_engagements%rowtype;
  v_review public.project_reviews%rowtype;
  v_profile_name text;
  v_name_parts text[];
  v_reviewed_user_id uuid;
  v_project_title text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if p_rating is null or p_rating not between 1 and 5
    or char_length(coalesce(p_text, '')) > 2000 then
    raise exception 'A rating from 1 to 5 and a comment up to 2000 characters are required'
      using errcode = '23514';
  end if;

  select *
  into v_engagement
  from public.project_engagements
  where id = p_engagement_id;

  if not found
    or v_engagement.client_completed_at is null
    or v_engagement.developer_completed_at is null then
    raise exception 'Both participants must confirm completion before reviewing'
      using errcode = '23514';
  end if;

  if auth.uid() = v_engagement.client_id then
    v_reviewed_user_id := v_engagement.developer_id;
  elsif auth.uid() = v_engagement.developer_id then
    v_reviewed_user_id := v_engagement.client_id;
  else
    raise exception 'Only an engagement participant can submit a review'
      using errcode = '42501';
  end if;

  select nullif(trim(display_name), '')
  into v_profile_name
  from public.profiles
  where id = auth.uid();

  if v_profile_name is null then
    raise exception 'A profile name is required to submit a review'
      using errcode = '23514';
  end if;

  select title
  into v_project_title
  from public.projects
  where id = v_engagement.project_id;

  v_name_parts := regexp_split_to_array(v_profile_name, '\s+');
  insert into public.project_reviews (
    engagement_id,
    project_id,
    reviewer_id,
    reviewed_user_id,
    reviewer_name,
    reviewer_initials,
    project_title,
    rating,
    text
  )
  values (
    v_engagement.id,
    v_engagement.project_id,
    auth.uid(),
    v_reviewed_user_id,
    v_profile_name,
    upper(left(v_name_parts[1], 1) || coalesce(left(v_name_parts[2], 1), '')),
    coalesce(v_project_title, ''),
    p_rating,
    trim(coalesce(p_text, ''))
  )
  returning * into v_review;

  return query
  select v_review.id, v_review.reviewer_name, v_review.reviewer_initials,
    v_review.project_title, v_review.rating, v_review.text, v_review.created_at;
end;
$$;

revoke all on function public.submit_project_review(uuid, smallint, text) from public, anon, authenticated;
grant execute on function public.submit_project_review(uuid, smallint, text) to authenticated;

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
      and tablename = 'project_engagements'
  ) then
    execute 'alter publication supabase_realtime add table public.project_engagements';
  end if;
end;
$$;

commit;
