begin;

drop function public.get_landing_featured_projects();

create function public.get_landing_featured_projects()
returns table (
  id text,
  title text,
  project_type text,
  category text,
  price text,
  cover_image text,
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
    p.cover_image,
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

notify pgrst, 'reload schema';

commit;
