begin;

create function public.get_owned_project_metrics()
returns table (
  project_id text,
  views bigint,
  favorites bigint,
  comments bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    p.id as project_id,
    coalesce(view_counts.total, 0)::bigint as views,
    coalesce(favorite_counts.total, 0)::bigint as favorites,
    coalesce(comment_counts.total, 0)::bigint as comments
  from public.projects p
  left join (
    select pv.project_id, count(*) as total
    from public.project_views pv
    group by pv.project_id
  ) view_counts on view_counts.project_id = p.id
  left join (
    select f.item_id, count(*) as total
    from public.favorites f
    where f.item_type = 'project'
    group by f.item_id
  ) favorite_counts on favorite_counts.item_id = p.id
  left join (
    select c.project_id, count(*) as total
    from public.comments c
    group by c.project_id
  ) comment_counts on comment_counts.project_id = p.id
  where p.owner_id = (select auth.uid())
    and p.project_kind = 'portfolio';
$$;

revoke all on function public.get_owned_project_metrics() from public, anon;
grant execute on function public.get_owned_project_metrics() to authenticated;

commit;
