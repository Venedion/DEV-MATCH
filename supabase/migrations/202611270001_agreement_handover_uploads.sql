begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agreement-handover',
  'agreement-handover',
  false,
  52428800,
  array[
    'application/zip', 'application/x-zip-compressed', 'application/x-7z-compressed',
    'application/vnd.rar', 'application/x-rar-compressed', 'application/x-tar',
    'application/gzip', 'application/x-gzip', 'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'text/markdown'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_access_agreement_handover_media(p_agreement text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_agreements a
    where a.id::text = p_agreement
      and (
        p_user in (a.client_id, a.developer_id)
        or exists (
          select 1
          from public.payment_agreement_dispute_reviewers r
          where r.agreement_id = a.id and r.reviewer_id = p_user
        )
      )
  )
$$;

create or replace function public.can_upload_agreement_handover_media(p_agreement text, p_user uuid)
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
      and r.state #>> '{room,project}' = 'AWAITING_HANDOVER'
      and r.state #>> '{room,escrow}' = 'REMAINING_HELD'
      and coalesce(r.state #>> '{room,dispute,status}', '') <> 'NEEDS_REVIEW'
      and coalesce(r.state #>> '{room,handover,status}', '') = ''
  )
$$;

create or replace function public.can_delete_unsubmitted_agreement_handover_media(
  p_agreement text,
  p_user uuid,
  p_path text
)
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
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(r.state #> '{room,handover,files}', '[]'::jsonb)) as item(file)
        where item.file->>'path' = p_path
      )
  )
$$;

revoke all on function public.can_access_agreement_handover_media(text, uuid),
  public.can_upload_agreement_handover_media(text, uuid),
  public.can_delete_unsubmitted_agreement_handover_media(text, uuid, text) from public, anon;
grant execute on function public.can_access_agreement_handover_media(text, uuid),
  public.can_upload_agreement_handover_media(text, uuid),
  public.can_delete_unsubmitted_agreement_handover_media(text, uuid, text) to authenticated;

drop policy if exists "Read agreement handover files" on storage.objects;
create policy "Read agreement handover files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'agreement-handover'
    and array_length(storage.foldername(name), 1) = 2
    and public.can_access_agreement_handover_media(
      (storage.foldername(name))[1],
      (select auth.uid())
    )
  );

drop policy if exists "Upload agreement handover files" on storage.objects;
create policy "Upload agreement handover files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'agreement-handover'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.can_upload_agreement_handover_media(
      (storage.foldername(name))[1],
      (select auth.uid())
    )
  );

drop policy if exists "Delete unsubmitted agreement handover files" on storage.objects;
create policy "Delete unsubmitted agreement handover files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'agreement-handover'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.can_delete_unsubmitted_agreement_handover_media(
      (storage.foldername(name))[1],
      (select auth.uid()),
      name
    )
  );

commit;
