begin;

-- Preserve existing history in its original workspace. Project chats have an
-- explicit role from the project; direct chats without role history use each
-- participant's original account role, never duplicate into a new workspace.
alter table public.conversations
  add column participant_a_role text check (participant_a_role in ('client','dev')),
  add column participant_b_role text check (participant_b_role in ('client','dev'));
update public.conversations c set
  participant_a_role = coalesce((select case when p.owner_id=c.participant_a_id
    then case p.project_kind when 'portfolio' then 'dev' else 'client' end
    else case p.project_kind when 'portfolio' then 'client' else 'dev' end end
    from public.projects p where p.id=c.project_id),
    (select account_role from public.profiles where id=c.participant_a_id)),
  participant_b_role = coalesce((select case when p.owner_id=c.participant_b_id
    then case p.project_kind when 'portfolio' then 'dev' else 'client' end
    else case p.project_kind when 'portfolio' then 'client' else 'dev' end end
    from public.projects p where p.id=c.project_id),
    (select account_role from public.profiles where id=c.participant_b_id));
alter table public.conversations alter column participant_a_role set not null,
  alter column participant_b_role set not null;
drop index public.conversations_participants_unique_idx;
create unique index conversations_workspace_participants_unique_idx on public.conversations (
  least(participant_a_id,participant_b_id), greatest(participant_a_id,participant_b_id),
  (case when participant_a_id<participant_b_id then participant_a_role else participant_b_role end),
  (case when participant_a_id<participant_b_id then participant_b_role else participant_a_role end),
  coalesce(project_id,''));
create index conversations_a_workspace_idx on public.conversations(participant_a_id,participant_a_role,last_message_at desc);
create index conversations_b_workspace_idx on public.conversations(participant_b_id,participant_b_role,last_message_at desc);

create function private.validate_conversation_workspaces() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_owner_role text;
begin
  select owner_id,case project_kind when 'portfolio' then 'dev' else 'client' end
    into v_owner,v_owner_role from public.projects where id=new.project_id;
  new.participant_a_role := coalesce(new.participant_a_role,
    case when v_owner is not null then case when new.participant_a_id=v_owner then v_owner_role
      when v_owner_role='dev' then 'client' else 'dev' end end,
    (select account_role from public.profiles where id=new.participant_a_id));
  new.participant_b_role := coalesce(new.participant_b_role,
    case when v_owner is not null then case when new.participant_b_id=v_owner then v_owner_role
      when v_owner_role='dev' then 'client' else 'dev' end end,
    (select account_role from public.profiles where id=new.participant_b_id));
  if not exists(select 1 from public.profiles where id=new.participant_a_id and account_role=new.participant_a_role)
     and not exists(select 1 from public.account_workspaces where user_id=new.participant_a_id and role=new.participant_a_role)
    or not exists(select 1 from public.profiles where id=new.participant_b_id and account_role=new.participant_b_role)
     and not exists(select 1 from public.account_workspaces where user_id=new.participant_b_id and role=new.participant_b_role)
  then raise exception 'Conversation workspace does not exist' using errcode='42501'; end if;
  if new.participant_a_role=new.participant_b_role then
    raise exception 'Chat requires a client and a developer workspace' using errcode='22023';
  end if;
  return new;
end; $$;
revoke all on function private.validate_conversation_workspaces() from public,anon,authenticated;
create trigger validate_conversation_workspaces_before_insert before insert on public.conversations
for each row execute function private.validate_conversation_workspaces();

alter table public.favorites add column workspace_role text check(workspace_role in ('client','dev'));
-- Existing people favorites identify their origin; project favorites follow the
-- original account unless that account only has the other applicable workspace.
update public.favorites f set workspace_role=(select case
  when f.item_type='developer' and (p.account_role='client' or exists(select 1 from public.account_workspaces w where w.user_id=p.id and w.role='client')) then 'client'
  when f.item_type='client' and (p.account_role='dev' or exists(select 1 from public.account_workspaces w where w.user_id=p.id and w.role='dev')) then 'dev'
  else p.account_role end from public.profiles p where p.id=f.user_id);
alter table public.favorites alter column workspace_role set not null;
alter table public.favorites drop constraint favorites_pkey;
alter table public.favorites add primary key(user_id,workspace_role,item_type,item_id);
alter policy "Read own favorites" on public.favorites using ((select auth.uid())=user_id and public.has_account_workspace(workspace_role));
alter policy "Create own favorites" on public.favorites with check ((select auth.uid())=user_id and public.has_account_workspace(workspace_role));
alter policy "Delete own favorites" on public.favorites using ((select auth.uid())=user_id and public.has_account_workspace(workspace_role));

alter table public.comments add column workspace_role text check(workspace_role in ('client','dev'));
update public.comments c set workspace_role=(select account_role from public.profiles where id=c.user_id);
alter table public.comments alter column workspace_role set not null;
create function private.set_owned_workspace() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  new.workspace_role := coalesce(new.workspace_role,(select account_role from public.profiles where id=new.user_id));
  if not exists(select 1 from public.profiles where id=new.user_id and account_role=new.workspace_role)
    and not exists(select 1 from public.account_workspaces where user_id=new.user_id and role=new.workspace_role)
  then raise exception 'Workspace does not exist' using errcode='42501'; end if;
  if tg_op='UPDATE' and (new.user_id<>old.user_id or new.workspace_role<>old.workspace_role) then
    raise exception 'Workspace ownership cannot change' using errcode='42501';
  end if;
  return new;
end; $$;
revoke all on function private.set_owned_workspace() from public,anon,authenticated;
create trigger set_favorite_workspace before insert or update on public.favorites for each row execute function private.set_owned_workspace();
create trigger set_comment_workspace before insert or update on public.comments for each row execute function private.set_owned_workspace();

alter table public.notifications add column recipient_role text check(recipient_role in ('client','dev')),
  add column actor_role text check(actor_role in ('client','dev'));
update public.notifications n set
  recipient_role=coalesce((select case when c.participant_a_id=n.recipient_id then c.participant_a_role else c.participant_b_role end
    from public.conversations c where c.id=n.conversation_id),
    (select case project_kind when 'portfolio' then 'dev' else 'client' end from public.projects where id=n.project_id and owner_id=n.recipient_id),
    (select account_role from public.profiles where id=n.recipient_id)),
  actor_role=coalesce((select case when c.participant_a_id=n.actor_id then c.participant_a_role else c.participant_b_role end
    from public.conversations c where c.id=n.conversation_id),
    (select account_role from public.profiles where id=n.actor_id));
alter table public.notifications alter column recipient_role set not null;
create index notifications_recipient_workspace_created_idx on public.notifications(recipient_id,recipient_role,created_at desc);

alter table public.notification_reads add column workspace_role text check(workspace_role in ('client','dev'));
update public.notification_reads r set workspace_role=coalesce(
  (select recipient_role from public.notifications where id::text=r.notification_id and recipient_id=r.user_id),
  (select account_role from public.profiles where id=r.user_id));
alter table public.notification_reads alter column workspace_role set not null;
alter table public.notification_reads drop constraint notification_reads_pkey;
alter table public.notification_reads add primary key(user_id,workspace_role,notification_id);
create trigger set_notification_read_workspace before insert or update on public.notification_reads for each row execute function private.set_owned_workspace();
alter policy "Mark own notifications read" on public.notification_reads with check (
  user_id=(select auth.uid()) and public.has_account_workspace(workspace_role) and exists (
    select 1 from public.notifications n where n.id::text=notification_id and n.recipient_id=user_id and n.recipient_role=workspace_role));
alter policy "Update own notification state" on public.notification_reads
  using(user_id=(select auth.uid()) and public.has_account_workspace(workspace_role))
  with check(user_id=(select auth.uid()) and exists (
    select 1 from public.notifications n where n.id::text=notification_id and n.recipient_id=user_id and n.recipient_role=workspace_role));

create function public.save_notification_preferences(p_preferences jsonb,p_role text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_data jsonb;
begin
  if not public.has_account_workspace(p_role) then raise exception 'Workspace does not exist' using errcode='42501'; end if;
  if jsonb_typeof(p_preferences) is distinct from 'object' or exists (
    select 1 from jsonb_each(p_preferences) p where p.key not in ('comments','messages','favorites','ratings') or jsonb_typeof(p.value)<>'boolean')
  then raise exception 'Unsupported notification preferences' using errcode='22023'; end if;
  update public.profiles set profile_data=profile_data||jsonb_build_object('notificationPreferences',p_preferences)
    where id=(select auth.uid()) and account_role=p_role returning profile_data into v_data;
  if not found then
    update public.account_workspaces set profile_data=profile_data||jsonb_build_object('notificationPreferences',p_preferences)
      where user_id=(select auth.uid()) and role=p_role returning profile_data into v_data;
  end if;
  return v_data;
end; $$;
revoke all on function public.save_notification_preferences(jsonb,text) from public,anon;
grant execute on function public.save_notification_preferences(jsonb,text) to authenticated;

-- Internal-only helper: callers cannot inspect someone else's private profile.
create function private.workspace_notification_enabled(p_user uuid,p_role text,p_kind text)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select profile_data->'notificationPreferences'->>p_kind from public.profiles where id=p_user and account_role=p_role),
    (select profile_data->'notificationPreferences'->>p_kind from public.account_workspaces where user_id=p_user and role=p_role),'true')<>'false';
$$;
revoke all on function private.workspace_notification_enabled(uuid,text,text) from public,anon,authenticated;

create or replace function public.notify_project_comment() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_user uuid; v_role text; v_kind text;
begin
  if new.parent_comment_id is not null then
    select user_id,workspace_role into v_user,v_role from public.comments where id=new.parent_comment_id and project_id=new.project_id;
    v_kind:='reply';
  else
    select owner_id,case project_kind when 'portfolio' then 'dev' else 'client' end into v_user,v_role from public.projects where id=new.project_id;
    v_kind:='comment';
  end if;
  if v_user is not null and v_user<>new.user_id and private.workspace_notification_enabled(v_user,v_role,'comments') then
    insert into public.notifications(recipient_id,recipient_role,actor_id,actor_role,kind,project_id)
      values(v_user,v_role,new.user_id,new.workspace_role,v_kind,new.project_id);
  end if;
  return new;
end; $$;

create or replace function public.notify_project_favorite() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_user uuid; v_role text;
begin
  if new.item_type<>'project' then return new; end if;
  select owner_id,case project_kind when 'portfolio' then 'dev' else 'client' end into v_user,v_role from public.projects where id=new.item_id;
  if v_user is not null and v_user<>new.user_id and private.workspace_notification_enabled(v_user,v_role,'favorites') then
    insert into public.notifications(recipient_id,recipient_role,actor_id,actor_role,kind,project_id)
      values(v_user,v_role,new.user_id,new.workspace_role,'favorite',new.item_id);
  end if;
  return new;
end; $$;

create or replace function public.notify_chat_message() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.conversations; v_user uuid; v_role text; v_actor_role text;
begin
  select * into strict c from public.conversations where id=new.conversation_id;
  if c.participant_a_id=new.sender_id then
    v_user:=c.participant_b_id; v_role:=c.participant_b_role; v_actor_role:=c.participant_a_role;
  else
    v_user:=c.participant_a_id; v_role:=c.participant_a_role; v_actor_role:=c.participant_b_role;
  end if;
  if private.workspace_notification_enabled(v_user,v_role,'messages') then
    insert into public.notifications(recipient_id,recipient_role,actor_id,actor_role,kind,project_id,conversation_id)
      values(v_user,v_role,new.sender_id,v_actor_role,'message',c.project_id,c.id);
  end if;
  return new;
end; $$;
revoke all on function public.notify_project_comment(),public.notify_project_favorite(),public.notify_chat_message() from public,anon,authenticated;

create or replace function public.switch_account_workspace(p_role text, p_create boolean default false)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_target public.account_workspaces;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_role is null or p_role not in ('client','dev') then raise exception 'Invalid workspace' using errcode = '22023'; end if;
  select * into strict v_profile from public.profiles where id = v_user;
  if v_profile.account_role = p_role then return v_profile; end if;
  if p_create then
    if not exists (select 1 from auth.users where id = v_user and email_confirmed_at is not null) then
      raise exception 'Verify your email first' using errcode = '42501';
    end if;
    insert into public.account_workspaces (user_id,role,display_name)
      values (v_user,p_role,'') on conflict (user_id,role) do nothing;
  end if;
  select * into v_target from public.account_workspaces where user_id = v_user and role = p_role;
  if not found then raise exception 'Workspace does not exist' using errcode = 'P0002'; end if;
  v_profile.account_role := v_target.role;
  v_profile.display_name := v_target.display_name;
  v_profile.profile_data := v_target.profile_data;
  v_profile.onboarding_complete := v_target.onboarding_complete;
  return v_profile;
end;
$$;
revoke all on function public.switch_account_workspace(text,boolean) from public, anon;
grant execute on function public.switch_account_workspace(text,boolean) to authenticated;

create or replace function public.set_project_comment_author() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_name text; v_role text; v_parts text[];
begin
  v_role:=coalesce(new.workspace_role,(select account_role from public.profiles where id=new.user_id));
  select coalesce(nullif(trim(username),''),nullif(trim(display_name),'')) into v_name from public.profiles where id=new.user_id;
  if v_name is null then raise exception 'An account name is required to comment' using errcode='23514'; end if;
  new.author_name:=v_name; v_parts:=regexp_split_to_array(v_name,'\s+');
  new.author_initials:=upper(left(v_parts[1],1)||coalesce(left(v_parts[2],1),''));
  return new;
end; $$;
revoke all on function public.set_project_comment_author() from public,anon,authenticated;

commit;
