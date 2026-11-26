begin;

alter table public.profiles
  add column if not exists username_changed_at timestamptz;

update public.profiles
set username = lower(username)
where username is not null
  and username <> lower(username);

update public.profiles
set username_changed_at = created_at
where username is not null
  and username_changed_at is null;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

create or replace function private.enforce_profile_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.username is not null then
    new.username := lower(new.username);
  end if;

  if tg_op = 'UPDATE' then
    if new.username is not distinct from old.username then
      new.username_changed_at := old.username_changed_at;
      return new;
    end if;
  end if;

  if new.username is null or char_length(new.username) < 3 then
    raise exception using
      message = 'Username must be at least 3 characters.',
      errcode = '23514';
  end if;

  if char_length(new.username) > 20 then
    raise exception using
      message = 'Username cannot exceed 20 characters.',
      errcode = '23514';
  end if;

  if new.username ~ '[[:space:]]' then
    raise exception using
      message = 'Username cannot contain spaces.',
      errcode = '23514';
  end if;

  if new.username !~ '^[a-z0-9._]+$' then
    raise exception using
      message = 'Username can only contain letters, numbers, periods (.), and underscores (_).',
      errcode = '23514';
  end if;

  if new.username ~ '^\.' or new.username ~ '\.$' then
    raise exception using
      message = 'Username cannot start or end with a period.',
      errcode = '23514';
  end if;

  if new.username ~ '\.\.' then
    raise exception using
      message = 'Username cannot contain consecutive periods.',
      errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and old.username is not null
    and now() < coalesce(old.username_changed_at, old.created_at) + interval '7 days' then
    raise exception using
      message = 'You can change your username again after 7 days.',
      errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.profiles existing
    where existing.id <> new.id
      and lower(existing.username) = new.username
  ) then
    raise exception using
      message = 'This username is already taken.',
      errcode = '23505';
  end if;

  new.username_changed_at := now();
  return new;
end;
$$;

revoke all on function private.enforce_profile_username() from public, anon, authenticated;

drop trigger if exists enforce_profile_username on public.profiles;
create trigger enforce_profile_username
before insert or update of username on public.profiles
for each row
execute function private.enforce_profile_username();

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_username is not null
    and char_length(lower(p_username)) between 3 and 20
    and lower(p_username) !~ '[[:space:]]'
    and lower(p_username) ~ '^[a-z0-9._]+$'
    and lower(p_username) !~ '^\.'
    and lower(p_username) !~ '\.$'
    and lower(p_username) !~ '\.\.'
    and not exists (
      select 1
      from public.profiles existing
      where existing.id is distinct from auth.uid()
        and lower(existing.username) = lower(p_username)
    ),
    false
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.change_username(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_username text;
begin
  if current_user_id is null then
    raise exception using message = 'Authentication is required.', errcode = '42501';
  end if;

  update public.profiles
  set username = p_username
  where id = current_user_id
  returning username into saved_username;

  if not found then
    raise exception using message = 'The profile could not be found.', errcode = 'P0002';
  end if;

  return saved_username;
exception
  when unique_violation then
    raise exception using
      message = 'This username is already taken.',
      errcode = '23505';
end;
$$;

revoke all on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;

commit;
