begin;

create or replace function public.can_upload_agreement_final_video(p_agreement text, p_user uuid, p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(p_path, '/', 3) ~ '^final-[[:alnum:]]'
    and exists (
      select 1
      from public.project_agreements a
      join public.payment_agreement_rooms r on r.agreement_id = a.id
      where a.id::text = p_agreement
        and a.developer_id = p_user
        and r.state #>> '{room,project}' in ('IN_PROGRESS', 'REVISION')
        and r.state #>> '{room,escrow}' = 'DP_RELEASED'
        and coalesce(r.state #>> '{room,progressReview,approvedAt}', '') <> ''
        and coalesce(r.state #>> '{room,dispute,status}', '') <> 'NEEDS_REVIEW'
    )
$$;

revoke all on function public.can_upload_agreement_final_video(text, uuid, text) from public, anon;
grant execute on function public.can_upload_agreement_final_video(text, uuid, text) to authenticated;

drop policy if exists "Upload agreement final video" on storage.objects;
create policy "Upload agreement final video" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'agreement-progress'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and lower(storage.extension(name)) in ('mp4', 'mov', 'webm')
    and public.can_upload_agreement_final_video(
      (storage.foldername(name))[1], (select auth.uid()), name
    )
  );

create or replace function public.can_delete_agreement_progress_media(p_agreement text, p_user uuid, p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_agreements a
    join public.payment_agreement_rooms r on r.agreement_id = a.id
    where a.id::text = p_agreement
      and a.developer_id = p_user
      and coalesce(r.state #>> '{room,delivery,video,path}', '') <> p_path
      and not (coalesce(r.state #> '{room,deliveredVideoPaths}', '[]'::jsonb) ? p_path)
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(r.state #> '{room,progress}', '[]'::jsonb)) as item(progress)
        where item.progress #>> '{video,path}' = p_path
          or exists (
            select 1
            from jsonb_array_elements(coalesce(item.progress->'screenshots', '[]'::jsonb)) as screenshot(file)
            where screenshot.file->>'path' = p_path
          )
      )
  )
$$;

commit;

