begin;
set local search_path = pg_catalog;

-- Reuse the current explicitly selected public fields, including changes already
-- applied to the production directory. Keep the privileged query outside PostgREST.
do $migration$
declare
  columns text;
  projection text;
begin
  select string_agg(format('%I %s', attname, format_type(atttypid, atttypmod)), ', ' order by attnum)
  into columns
  from pg_attribute
  where attrelid = 'public.directory_people'::regclass and attnum > 0 and not attisdropped;

  projection := regexp_replace(pg_get_viewdef('public.directory_people'::regclass), ';[[:space:]]*$', '');
  execute format(
    'create function private.read_directory_people() returns table (%s) language sql stable security definer set search_path = '''' as %L',
    columns,
    'select directory.* from (' || projection || ') as directory where '
      || 'auth.uid() is not null or current_setting(''role'', true) = ''service_role'' '
      || 'or (session_user in (''postgres'', ''supabase_admin'') '
      || 'and current_setting(''role'', true) in (''none'', ''postgres'', ''supabase_admin''))'
  );
end;
$migration$;

revoke all on function private.read_directory_people() from public, anon, authenticated, service_role;
grant execute on function private.read_directory_people() to authenticated, service_role;

create or replace view public.directory_people
with (security_invoker = true, security_barrier = true)
as select * from private.read_directory_people();

revoke select on public.directory_people from public, anon;
grant select on public.directory_people to authenticated, service_role;

commit;
