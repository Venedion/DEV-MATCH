begin;

create function public.get_dashboard_metrics_for_range(
  p_role text,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  metric_project_kind text;
  range_start timestamptz;
  range_end timestamptz;
  metric_projects integer;
  metric_views integer;
  metric_favorites integer;
  metric_comments integer;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to load dashboard metrics'
      using errcode = '28000';
  end if;

  if not public.has_account_workspace(p_role) then
    raise exception 'Workspace access denied' using errcode = '42501';
  end if;

  if (p_start_date is null) is distinct from (p_end_date is null)
    or (p_start_date is not null and p_end_date is not null and p_start_date > p_end_date) then
    raise exception 'A valid dashboard date range is required'
      using errcode = '22023';
  end if;

  metric_project_kind := case p_role when 'client' then 'request' else 'portfolio' end;
  if p_start_date is not null then
    range_start := p_start_date::timestamp at time zone 'UTC';
    range_end := (p_end_date + 1)::timestamp at time zone 'UTC';
  end if;

  select count(*)::integer
  into metric_projects
  from public.projects p
  where p.owner_id = current_user_id
    and p.project_kind = metric_project_kind
    and (range_start is null or p.created_at >= range_start)
    and (range_end is null or p.created_at < range_end);

  select count(*)::integer
  into metric_views
  from public.project_views v
  join public.projects p on p.id = v.project_id
  where p.owner_id = current_user_id
    and p.project_kind = metric_project_kind
    and (p_start_date is null or v.viewed_on >= p_start_date)
    and (p_end_date is null or v.viewed_on <= p_end_date);

  select count(*)::integer
  into metric_favorites
  from public.favorites f
  join public.projects p on p.id = f.item_id
  where p.owner_id = current_user_id
    and p.project_kind = metric_project_kind
    and f.item_type = 'project'
    and (range_start is null or f.created_at >= range_start)
    and (range_end is null or f.created_at < range_end);

  select count(*)::integer
  into metric_comments
  from public.comments c
  join public.projects p on p.id = c.project_id
  where p.owner_id = current_user_id
    and p.project_kind = metric_project_kind
    and (range_start is null or c.created_at >= range_start)
    and (range_end is null or c.created_at < range_end);

  return jsonb_build_object(
    'projects', metric_projects,
    'views', metric_views,
    'favorites', metric_favorites,
    'comments', metric_comments
  );
end;
$$;

revoke all on function public.get_dashboard_metrics_for_range(text, date, date) from public, anon;
grant execute on function public.get_dashboard_metrics_for_range(text, date, date) to authenticated;

commit;
;
