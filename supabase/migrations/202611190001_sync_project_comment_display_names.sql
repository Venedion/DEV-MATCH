begin;

update public.comments c
set
  author_name = btrim(p.display_name),
  author_initials = upper(left(name_parts.parts[1], 1) || coalesce(left(name_parts.parts[2], 1), ''))
from public.profiles p
cross join lateral (
  select regexp_split_to_array(btrim(p.display_name), '\s+') as parts
) as name_parts
where c.user_id = p.id
  and nullif(btrim(p.display_name), '') is not null
  and (
    c.author_name is distinct from btrim(p.display_name)
    or c.author_initials is distinct from upper(left(name_parts.parts[1], 1) || coalesce(left(name_parts.parts[2], 1), ''))
  );

create function public.sync_project_comment_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
  name_parts text[];
begin
  profile_name := nullif(btrim(new.display_name), '');
  if profile_name is null then
    return new;
  end if;

  name_parts := regexp_split_to_array(profile_name, '\s+');
  update public.comments
  set
    author_name = profile_name,
    author_initials = upper(left(name_parts[1], 1) || coalesce(left(name_parts[2], 1), ''))
  where user_id = new.id
    and (
      author_name is distinct from profile_name
      or author_initials is distinct from upper(left(name_parts[1], 1) || coalesce(left(name_parts[2], 1), ''))
    );
  return new;
end;
$$;

revoke all on function public.sync_project_comment_display_name() from public, anon, authenticated;

create trigger sync_project_comment_display_name_after_profile_update
  after update of display_name on public.profiles
  for each row
  when (old.display_name is distinct from new.display_name)
  execute function public.sync_project_comment_display_name();

commit;
