begin;

create index if not exists favorites_client_developer_count_idx
  on public.favorites (item_id)
  where item_type = 'developer' and workspace_role = 'client';

create function public.get_landing_featured_projects()
returns table (
  id text,
  title text,
  project_type text,
  category text,
  price text,
  data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  views bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.title,
    p.project_type,
    p.category,
    p.price,
    p.data,
    p.created_at,
    p.updated_at,
    count(v.project_id)::bigint as views
  from public.projects p
  left join public.project_views v on v.project_id = p.id
  where p.project_kind = 'portfolio'
    and p.status = 'published'
  group by p.id
  order by count(v.project_id) desc, p.updated_at desc, p.id
  limit 4;
$$;

revoke all on function public.get_landing_featured_projects() from public;
grant execute on function public.get_landing_featured_projects() to anon, authenticated;

create function public.get_landing_featured_developers()
returns table (
  id uuid,
  display_name text,
  account_role text,
  profile_data jsonb,
  published_portfolio_count bigint,
  favorite_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to load featured developers'
      using errcode = '28000';
  end if;
  if not public.has_account_workspace('client') then
    raise exception 'Client workspace access is required to load featured developers'
      using errcode = '42501';
  end if;

  return query
    select
      directory.id,
      directory.display_name,
      directory.account_role,
      directory.profile_data,
      directory.published_portfolio_count,
      count(favorite.user_id)::bigint as favorite_count
    from public.directory_people directory
    left join public.favorites favorite
      on favorite.item_type = 'developer'
      and favorite.item_id = directory.id::text
      and favorite.workspace_role = 'client'
    where directory.account_role = 'dev'
    group by directory.id, directory.display_name, directory.account_role,
      directory.profile_data, directory.published_portfolio_count
    order by count(favorite.user_id) desc, directory.display_name, directory.id
    limit 4;
end;
$$;

revoke all on function public.get_landing_featured_developers() from public, anon;
grant execute on function public.get_landing_featured_developers() to authenticated;

commit;
