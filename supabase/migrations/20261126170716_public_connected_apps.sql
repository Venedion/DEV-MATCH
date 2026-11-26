begin;
set local search_path = pg_catalog;

create or replace function private.read_directory_people_with_connected_apps()
returns table (
  id uuid,
  display_name text,
  username text,
  account_role text,
  profile_data jsonb,
  published_portfolio_count bigint,
  open_request_count bigint,
  published_portfolio_views_count bigint,
  published_portfolio_favorites_count bigint
)
language sql
stable
security definer
set search_path = ''
as $function$
  with workspace_profiles as (
    select p.id,p.account_role,p.profile_data,u.email as account_email
    from public.profiles p
    left join auth.users u on u.id = p.id
    union all
    select w.user_id,w.role,w.profile_data,u.email
    from public.account_workspaces w
    join public.profiles p on p.id = w.user_id
    left join auth.users u on u.id = w.user_id
    where w.role <> p.account_role
  )
  select
    directory.id,
    directory.display_name,
    directory.username,
    directory.account_role,
    directory.profile_data || jsonb_strip_nulls(jsonb_build_object(
      'country', source.profile_data->'country',
      'whatsappConnected', case
        when nullif(regexp_replace(coalesce(source.profile_data->>'whatsapp',''), '[^0-9]', '', 'g'), '') is not null
          then 'true'::jsonb
        when jsonb_typeof(source.profile_data->'whatsappConnected') = 'boolean'
          then source.profile_data->'whatsappConnected'
        else 'false'::jsonb
      end,
      'githubConnected', case
        when jsonb_typeof(source.profile_data->'githubConnected') = 'boolean'
          then source.profile_data->'githubConnected'
        else to_jsonb(coalesce(
          nullif(btrim(
            coalesce(source.profile_data->>'github','')
            || coalesce(source.profile_data->>'githubUrl','')
            || coalesce(source.profile_data->>'githubUsername','')
          ), '') is not null,
          false
        ))
      end,
      'googleConnected', case
        when nullif(btrim(source.profile_data->>'googleEmail'), '') is not null
          or coalesce(source.account_email ~* '^[A-Z0-9._%+-]+@gmail\.com$', false)
          then 'true'::jsonb
        when jsonb_typeof(source.profile_data->'googleConnected') = 'boolean'
          then source.profile_data->'googleConnected'
        else 'false'::jsonb
      end,
      'instagramConnected', case
        when nullif(btrim(source.profile_data->>'instagram'), '') is not null
          then 'true'::jsonb
        when jsonb_typeof(source.profile_data->'instagramConnected') = 'boolean'
          then source.profile_data->'instagramConnected'
        else 'false'::jsonb
      end,
      'linkedinConnected', case
        when jsonb_typeof(source.profile_data->'linkedinConnected') = 'boolean'
          then source.profile_data->'linkedinConnected'
        else to_jsonb(coalesce(
          nullif(btrim(
            coalesce(source.profile_data->>'linkedin','')
            || coalesce(source.profile_data->>'linkedinUrl','')
          ), '') is not null,
          false
        ))
      end,
      'instagram', case
        when nullif(btrim(source.profile_data->>'instagram'), '') is not null
          or source.profile_data->'instagramConnected' = 'true'::jsonb
          then source.profile_data->'instagram'
      end
    )),
    directory.published_portfolio_count,
    directory.open_request_count,
    directory.published_portfolio_views_count,
    directory.published_portfolio_favorites_count
  from private.read_directory_people() directory
  join workspace_profiles source
    on source.id = directory.id
    and source.account_role = directory.account_role
  where auth.uid() is not null
    or current_setting('role', true) = 'service_role'
    or (
      session_user in ('postgres', 'supabase_admin')
      and current_setting('role', true) in ('none', 'postgres', 'supabase_admin')
    );
$function$;

revoke all on function private.read_directory_people_with_connected_apps() from public, anon, authenticated, service_role;
grant execute on function private.read_directory_people_with_connected_apps() to authenticated, service_role;

create or replace view public.directory_people
with (security_invoker = true, security_barrier = true)
as select * from private.read_directory_people_with_connected_apps();

revoke select on public.directory_people from public, anon;
grant select on public.directory_people to authenticated, service_role;

commit;
