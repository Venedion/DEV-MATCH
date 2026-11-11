begin;

create table public.notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_id text not null check (char_length(notification_id) between 1 and 160),
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

alter table public.notification_reads enable row level security;
revoke all on public.notification_reads from public, anon, authenticated;
grant select, insert, update on public.notification_reads to authenticated;

create policy "Read own notification state" on public.notification_reads
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Mark own notifications read" on public.notification_reads
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own notification state" on public.notification_reads
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('project', 'developer', 'client')),
  item_id text not null check (char_length(item_id) between 1 and 160),
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

alter table public.favorites enable row level security;
revoke all on public.favorites from public, anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;

create policy "Read own favorites" on public.favorites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own favorites" on public.favorites
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Delete own favorites" on public.favorites
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.save_notification_preferences(p_preferences jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_profile_data jsonb;
begin
  if jsonb_typeof(p_preferences) is distinct from 'object'
    or exists (
      select 1
      from jsonb_each(p_preferences) as preference
      where preference.key not in ('comments', 'messages', 'favorites', 'ratings')
        or jsonb_typeof(preference.value) is distinct from 'boolean'
    )
  then
    raise exception 'Notification preferences must contain supported boolean values'
      using errcode = '22023';
  end if;

  update public.profiles
  set profile_data = profile_data || jsonb_build_object('notificationPreferences', p_preferences)
  where id = (select auth.uid())
  returning profile_data into updated_profile_data;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  return updated_profile_data;
end;
$$;

revoke all on function public.save_notification_preferences(jsonb) from public, anon;
grant execute on function public.save_notification_preferences(jsonb) to authenticated;

commit;
