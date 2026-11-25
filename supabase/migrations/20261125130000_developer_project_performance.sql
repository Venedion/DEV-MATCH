begin;

create or replace function public.get_developer_project_performance(p_start_date date, p_end_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner uuid := (select auth.uid());
  today_utc date := (now() at time zone 'UTC')::date;
begin
  if owner is null or not public.has_account_workspace('dev') then
    raise exception 'Developer workspace access denied' using errcode = '42501';
  end if;
  if (p_start_date is null) <> (p_end_date is null)
    or (p_start_date is not null and (p_start_date < date '1900-01-01'
      or p_end_date > today_utc or p_start_date > p_end_date)) then
    raise exception 'A valid dashboard date range is required' using errcode = '22023';
  end if;

  return (
    with owned as materialized (
      select p.id, p.title, p.project_type, p.cover_image from public.projects p
      where p.owner_id = owner and p.project_kind = 'portfolio'
    ),
    views_by_day as materialized (
      select v.project_id, v.viewed_on as day, count(*) as total
      from public.project_views v join owned o on o.id = v.project_id
      where p_start_date is null or v.viewed_on between p_start_date and p_end_date
      group by v.project_id, v.viewed_on
    ),
    favorites_by_day as materialized (
      select (f.created_at at time zone 'UTC')::date as day, count(*) as total
      from public.favorites f join owned o on o.id = f.item_id
      where f.item_type = 'project' and (p_start_date is null or (
        f.created_at >= p_start_date::timestamp at time zone 'UTC'
        and f.created_at < (p_end_date + 1)::timestamp at time zone 'UTC'))
      group by 1
    ),
    date_bounds as (
      select coalesce(p_start_date, least(
        (select min(day) from views_by_day), (select min(day) from favorites_by_day)), today_utc) as first_day,
        coalesce(p_end_date, today_utc) as last_day
    ),
    bucket_bounds as (
      select *, case when last_day - first_day < 31 then 1
        when last_day - first_day < 92 then 7
        else greatest(7, ceil((last_day - first_day + 1) / 30.0)::integer) end as bucket_days
      from date_bounds
    ),
    buckets as (
      select first_day + offset_days as start_date,
        least(first_day + offset_days + bucket_days - 1, last_day) as end_date
      from bucket_bounds cross join lateral generate_series(0, last_day - first_day, bucket_days) as step(offset_days)
    ),
    series as (
      select b.start_date, b.end_date,
        coalesce((select sum(v.total) from views_by_day v where v.day between b.start_date and b.end_date), 0) as views,
        coalesce((select sum(f.total) from favorites_by_day f where f.day between b.start_date and b.end_date), 0) as favorites
      from buckets b
    ),
    ranking as (
      select o.id, o.title, o.project_type, o.cover_image, sum(v.total) as views
      from views_by_day v join owned o on o.id = v.project_id
      group by o.id, o.title, o.project_type, o.cover_image
      order by views desc, o.id limit 4
    ),
    previous_range as (
      select count(*) as views from public.project_views v join owned o on o.id = v.project_id
      where p_start_date is not null and v.viewed_on >= p_start_date - (p_end_date - p_start_date + 1)
        and v.viewed_on < p_start_date
    )
    select jsonb_build_object(
      'views', coalesce((select sum(total) from views_by_day), 0),
      'previous_views', case when p_start_date is not null then (select views from previous_range) end,
      'series', coalesce((select jsonb_agg(to_jsonb(s) order by s.start_date) from series s), '[]'::jsonb),
      'ranking', coalesce((select jsonb_agg(to_jsonb(r) order by r.views desc, r.id) from ranking r), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_developer_project_performance(date, date) from public, anon;
grant execute on function public.get_developer_project_performance(date, date) to authenticated;

drop policy if exists "Developer reads own project performance updates" on realtime.messages;
create policy "Developer reads own project performance updates"
  on realtime.messages for select to authenticated
  using (topic = realtime.topic() and topic = 'devmatch-project-performance:' || (select auth.uid())::text);

create or replace function public.broadcast_developer_project_performance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_owner uuid;
  tracked_project text;
begin
  if tg_table_name = 'projects' then
    if tg_op = 'DELETE' then
      if OLD.project_kind = 'portfolio' then project_owner := OLD.owner_id; end if;
    elsif NEW.project_kind = 'portfolio' then
      project_owner := NEW.owner_id;
    end if;
  else
    if tg_table_name = 'project_views' then
      tracked_project := case when tg_op = 'DELETE' then OLD.project_id else NEW.project_id end;
    elsif tg_op = 'DELETE' then
      if OLD.item_type = 'project' then tracked_project := OLD.item_id; end if;
    elsif NEW.item_type = 'project' then
      tracked_project := NEW.item_id;
    end if;
    select p.owner_id into project_owner from public.projects p
      where p.project_kind = 'portfolio' and p.id = tracked_project;
  end if;
  if project_owner is not null then
    perform realtime.send('{}'::jsonb, 'refresh', 'devmatch-project-performance:' || project_owner::text, true);
  end if;
  return null;
end;
$$;

revoke all on function public.broadcast_developer_project_performance() from public, anon, authenticated;
create or replace trigger dashboard_project_performance_views
  after insert or delete on public.project_views
  for each row execute function public.broadcast_developer_project_performance();
create or replace trigger dashboard_project_performance_favorites
  after insert or delete on public.favorites
  for each row execute function public.broadcast_developer_project_performance();
create or replace trigger dashboard_project_performance_projects
  after insert or delete or update of title, project_type, cover_image on public.projects
  for each row execute function public.broadcast_developer_project_performance();

commit;
