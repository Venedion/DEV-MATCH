begin;
create or replace function public.can_reply_to_project_comment(p_project_id text, p_parent_comment_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.comments parent
    join public.projects project on project.id = parent.project_id
    where parent.id = p_parent_comment_id
      and parent.project_id = p_project_id
      and (project.status in ('published', 'open') or project.owner_id = (select auth.uid()))
  );
$$;
commit;
;
