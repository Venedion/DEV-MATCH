begin;

create table public.projects (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_kind text not null check (project_kind in ('portfolio', 'request')),
  legacy_id text,
  title text not null default '' check (char_length(title) <= 160),
  project_type text not null default '' check (char_length(project_type) <= 80),
  category text not null default '' check (char_length(category) <= 100),
  price text not null default '' check (char_length(price) <= 160),
  price_type text not null default '' check (char_length(price_type) <= 80),
  cover_image text not null default '',
  status text not null default 'draft',
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, project_kind, legacy_id),
  check (
    (project_kind = 'portfolio' and status in ('draft', 'published'))
    or (project_kind = 'request' and status in ('draft', 'open', 'closed'))
  )
);

create index projects_public_listing_idx
  on public.projects (project_kind, status, updated_at desc);
create index projects_owner_listing_idx
  on public.projects (owner_id, project_kind, updated_at desc);

alter table public.projects enable row level security;
revoke all on public.projects from public, anon, authenticated;
grant select on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;

create policy "Read public projects and own drafts" on public.projects
  for select to anon, authenticated
  using (
    status in ('published', 'open')
    or (select auth.uid()) = owner_id
  );
create policy "Create own projects" on public.projects
  for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and account_role = case project_kind
          when 'portfolio' then 'dev'
          when 'request' then 'client'
        end
    )
  );
create policy "Update own projects" on public.projects
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and account_role = case project_kind
          when 'portfolio' then 'dev'
          when 'request' then 'client'
        end
    )
  );
create policy "Delete own projects" on public.projects
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id text not null check (char_length(project_id) between 1 and 160),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 5000),
  author_name text not null default '',
  author_initials text not null default '',
  created_at timestamptz not null default now()
);

create index comments_project_created_idx
  on public.comments (project_id, created_at);

alter table public.comments enable row level security;
revoke all on public.comments from public, anon, authenticated;
grant select on public.comments to anon, authenticated;
grant insert, delete on public.comments to authenticated;

create policy "Read project comments" on public.comments
  for select to anon, authenticated
  using (true);
create policy "Create own project comments" on public.comments
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Delete own project comments" on public.comments
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create function public.set_project_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
  name_parts text[];
begin
  select nullif(trim(display_name), '')
  into profile_name
  from public.profiles
  where id = new.user_id;

  if profile_name is null then
    raise exception 'A profile name is required to comment'
      using errcode = '23514';
  end if;

  name_parts := regexp_split_to_array(profile_name, '\s+');
  new.author_name := profile_name;
  new.author_initials := upper(left(name_parts[1], 1) || coalesce(left(name_parts[2], 1), ''));
  return new;
end;
$$;

revoke all on function public.set_project_comment_author() from public, anon, authenticated;
create trigger set_project_comment_author_before_insert
  before insert on public.comments
  for each row execute function public.set_project_comment_author();

create function public.delete_project_comments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.comments where project_id = old.id;
  return old;
end;
$$;

revoke all on function public.delete_project_comments() from public, anon, authenticated;
create trigger delete_comments_after_project_delete
  after delete on public.projects
  for each row execute function public.delete_project_comments();

commit;
