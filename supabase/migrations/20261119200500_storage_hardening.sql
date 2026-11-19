-- Storage hardening (audit items 7 and 22).
-- * Public project media: 20 MB per file (images are limited to 10 MB by the
--   app), at most 60 uploads per hour and 500 MB in total per account.
-- * Private uploads get the same per-account limits.
-- * A request attachment can only be moved inside a request project you own.
-- * Request attachments are readable by developer workspaces (primary or
--   secondary) that finished onboarding, not by every account with role dev.
begin;

update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
where id = 'project-media';

-- Lives in public because storage policies run as the requesting user, who has
-- no access to the private schema. It only reports on the caller's own files.
create or replace function public.storage_upload_allowed(p_bucket text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_recent integer;
  v_total bigint;
begin
  if auth.uid() is null then
    return false;
  end if;
  select count(*) filter (where o.created_at > now() - interval '1 hour'),
         coalesce(sum(case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 0 end), 0)
  into v_recent, v_total
  from storage.objects o
  where o.bucket_id = p_bucket and o.owner = auth.uid();
  return v_recent < 60 and v_total < 524288000;
end;
$$;
revoke all on function public.storage_upload_allowed(text) from public, anon;
grant execute on function public.storage_upload_allowed(text) to authenticated;

create or replace function public.has_completed_dev_workspace()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and account_role = 'dev' and onboarding_complete
  ) or exists (
    select 1 from public.account_workspaces
    where user_id = auth.uid() and role = 'dev' and onboarding_complete
  );
$$;
revoke all on function public.has_completed_dev_workspace() from public, anon;
grant execute on function public.has_completed_dev_workspace() to authenticated;

drop policy if exists "Upload own project media" on storage.objects;
create policy "Upload own project media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.storage_upload_allowed(bucket_id)
  );

drop policy if exists "Upload own private files" on storage.objects;
create policy "Upload own private files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'private-uploads'
    and public.storage_upload_allowed(bucket_id)
    and (
      (
        (storage.foldername(name))[1] = 'experience'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or (
        (storage.foldername(name))[1] = 'request'
        and (storage.foldername(name))[2] = (select auth.uid())::text
        and exists (
          select 1 from public.projects p
          where p.id = (storage.foldername(name))[3]
            and p.owner_id = (select auth.uid())
            and p.project_kind = 'request'
        )
      )
    )
  );

drop policy if exists "Update own private files" on storage.objects;
create policy "Update own private files" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'private-uploads'
    and (
      ((storage.foldername(name))[1] = 'experience'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'request'
        and (storage.foldername(name))[2] = (select auth.uid())::text)
    )
  )
  with check (
    bucket_id = 'private-uploads'
    and (
      (
        (storage.foldername(name))[1] = 'experience'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or (
        (storage.foldername(name))[1] = 'request'
        and (storage.foldername(name))[2] = (select auth.uid())::text
        and exists (
          select 1 from public.projects p
          where p.id = (storage.foldername(name))[3]
            and p.owner_id = (select auth.uid())
            and p.project_kind = 'request'
        )
      )
    )
  );

drop policy if exists "Read authorized private uploads" on storage.objects;
create policy "Read authorized private uploads" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'private-uploads'
    and (
      (
        (storage.foldername(name))[1] = 'experience'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or (
        (storage.foldername(name))[1] = 'request'
        and exists (
          select 1 from public.projects p
          where p.id = (storage.foldername(name))[3]
            and p.owner_id::text = (storage.foldername(name))[2]
            and (
              p.owner_id = (select auth.uid())
              or (
                p.project_kind = 'request'
                and p.status = 'open'
                and public.has_completed_dev_workspace()
              )
            )
        )
      )
    )
  );

commit;
