begin;

create function public.get_public_request_card_metrics(p_project_ids text[])
returns table (
  project_id text,
  favorite_count bigint,
  comment_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to load public request metrics'
      using errcode = '28000';
  end if;

  if not public.has_account_workspace('dev') then
    raise exception 'Developer workspace access is required to load public request metrics'
      using errcode = '42501';
  end if;

  if p_project_ids is null or cardinality(p_project_ids) > 100
    or exists (
      select 1
      from unnest(p_project_ids) as requested(project_id)
      where requested.project_id is null
        or char_length(requested.project_id) not between 1 and 160
    )
  then
    raise exception 'Between 1 and 100 valid project IDs are required'
      using errcode = '22023';
  end if;

  return query
  select
    p.id,
    coalesce(favorite_counts.total, 0)::bigint,
    coalesce(comment_counts.total, 0)::bigint
  from public.projects p
  left join (
    select f.item_id, count(*) as total
    from public.favorites f
    where f.item_type = 'project'
      and f.item_id = any(p_project_ids)
    group by f.item_id
  ) favorite_counts on favorite_counts.item_id = p.id
  left join (
    select c.project_id, count(*) as total
    from public.comments c
    where c.project_id = any(p_project_ids)
    group by c.project_id
  ) comment_counts on comment_counts.project_id = p.id
  where p.id = any(p_project_ids)
    and p.project_kind = 'request'
    and p.status = 'open';
end;
$$;

revoke all on function public.get_public_request_card_metrics(text[]) from public, anon;
grant execute on function public.get_public_request_card_metrics(text[]) to authenticated;

commit;
