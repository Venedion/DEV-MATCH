begin;

create table public.client_profile_views (
  client_id uuid not null references auth.users(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_on date not null,
  primary key (client_id, viewer_id, viewed_on),
  check (client_id <> viewer_id)
);

alter table public.client_profile_views enable row level security;
revoke all on public.client_profile_views from public, anon, authenticated;

create index if not exists favorites_client_profile_count_idx
  on public.favorites (item_id)
  where item_type = 'client' and workspace_role = 'dev';

create function public.record_client_profile_view(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required to record a client profile view'
      using errcode = '28000';
  end if;
  if not public.has_account_workspace('dev') then
    raise exception 'Developer workspace access denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_client_id and p.account_role = 'client' and p.onboarding_complete
    union all
    select 1 from public.account_workspaces w
    where w.user_id = p_client_id and w.role = 'client' and w.onboarding_complete
  ) then
    raise exception 'The client profile is not publicly available'
      using errcode = '22023';
  end if;
  if current_user_id <> p_client_id then
    insert into public.client_profile_views (client_id, viewer_id, viewed_on)
    values (p_client_id, current_user_id, (timezone('utc', now()))::date)
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.record_client_profile_view(uuid) from public, anon;
grant execute on function public.record_client_profile_view(uuid) to authenticated;

create function public.get_client_profile_metrics(p_client_id uuid)
returns table (views bigint, favorites bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to read client profile metrics'
      using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_client_id and p.account_role = 'client' and p.onboarding_complete
    union all
    select 1 from public.account_workspaces w
    where w.user_id = p_client_id and w.role = 'client' and w.onboarding_complete
  ) then
    raise exception 'The client profile is not publicly available'
      using errcode = '22023';
  end if;

  return query
    select
      (select count(*) from public.client_profile_views v where v.client_id = p_client_id),
      (select count(*) from public.favorites f
        where f.item_type = 'client'
          and f.item_id = p_client_id::text
          and f.workspace_role = 'dev');
end;
$$;

revoke all on function public.get_client_profile_metrics(uuid) from public, anon;
grant execute on function public.get_client_profile_metrics(uuid) to authenticated;

drop policy if exists "Client profile owners read metric updates" on realtime.messages;
create policy "Client profile owners read metric updates"
  on realtime.messages for select to authenticated
  using (
    topic = realtime.topic()
    and topic = 'devmatch-client-profile-metrics:' || (select auth.uid())::text
  );

create function public.broadcast_client_profile_metrics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_client_id uuid;
begin
  if tg_table_name = 'client_profile_views' then
    target_client_id := case when tg_op = 'DELETE' then old.client_id else new.client_id end;
  elsif tg_op = 'DELETE' then
    if old.item_type = 'client' and old.workspace_role = 'dev'
      and old.item_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      target_client_id := old.item_id::uuid;
    end if;
  elsif new.item_type = 'client' and new.workspace_role = 'dev'
    and new.item_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    target_client_id := new.item_id::uuid;
  end if;

  if target_client_id is not null then
    perform realtime.send(
      '{}'::jsonb,
      'refresh',
      'devmatch-client-profile-metrics:' || target_client_id::text,
      true
    );
  end if;
  return null;
end;
$$;

revoke all on function public.broadcast_client_profile_metrics() from public, anon, authenticated;
create trigger client_profile_metrics_views
  after insert on public.client_profile_views
  for each row execute function public.broadcast_client_profile_metrics();
create trigger client_profile_metrics_favorites
  after insert or delete on public.favorites
  for each row execute function public.broadcast_client_profile_metrics();

commit;
