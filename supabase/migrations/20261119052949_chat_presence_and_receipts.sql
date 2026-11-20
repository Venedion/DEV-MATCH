begin;
create table private.chat_activity (
 user_id uuid references auth.users(id) on delete cascade,
 role text not null check(role in ('client','dev')),
 last_seen timestamptz not null default now(), primary key(user_id,role)
);
create table private.chat_receipts (
 conversation_id uuid references public.conversations(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 read_at timestamptz not null, primary key(conversation_id,user_id)
);
revoke all on private.chat_activity,private.chat_receipts from public,anon,authenticated;
create function public.sync_chat_activity(p_role text,p_conversation uuid default null,p_read_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); c public.conversations; peer uuid; peer_role text; seen timestamptz; receipt timestamptz;
begin
 if u is null or not public.has_account_workspace(p_role) then raise exception 'Workspace access denied' using errcode='42501'; end if;
 if p_conversation is not null then
  select * into c from public.conversations where id=p_conversation;
  if c.participant_a_id=u and c.participant_a_role=p_role then peer:=c.participant_b_id;peer_role:=c.participant_b_role;
  elsif c.participant_b_id=u and c.participant_b_role=p_role then peer:=c.participant_a_id;peer_role:=c.participant_a_role;
  else raise exception 'Conversation not found' using errcode='42501'; end if;
  if p_read_at is not null then
   insert into private.chat_receipts values(p_conversation,u,least(p_read_at,now()))
   on conflict(conversation_id,user_id) do update set read_at=greatest(chat_receipts.read_at,excluded.read_at);
  end if;
  select last_seen into seen from private.chat_activity where user_id=peer and role=peer_role;
  select read_at into receipt from private.chat_receipts where conversation_id=p_conversation and user_id=peer;
 end if;
 insert into private.chat_activity values(u,p_role,now()) on conflict(user_id,role) do update set last_seen=excluded.last_seen;
 return jsonb_build_object('online',coalesce(seen>now()-interval '35 seconds',false),'read_at',receipt);
end; $$;
revoke all on function public.sync_chat_activity(text,uuid,timestamptz) from public,anon;
grant execute on function public.sync_chat_activity(text,uuid,timestamptz) to authenticated;
create or replace function public.set_project_comment_author() returns trigger
language plpgsql security definer set search_path='' as $$
declare n text; parts text[];
begin
 new.workspace_role:=coalesce(new.workspace_role,(select account_role from public.profiles where id=new.user_id));
 select coalesce(nullif(trim(case when p.account_role=new.workspace_role then p.display_name else w.display_name end),''),p.username)
 into n from public.profiles p left join public.account_workspaces w on w.user_id=p.id and w.role=new.workspace_role where p.id=new.user_id;
 if n is null then raise exception 'Account name required'; end if;
 new.author_name:=n;parts:=regexp_split_to_array(n,'\s+');new.author_initials:=upper(left(parts[1],1)||coalesce(left(parts[2],1),''));return new;
end; $$;
update public.comments c set author_name=coalesce(nullif(trim(case when p.account_role=c.workspace_role then p.display_name else w.display_name end),''),p.username)
from public.profiles p left join public.account_workspaces w on w.user_id=p.id where c.user_id=p.id and (w.role=c.workspace_role or p.account_role=c.workspace_role);
commit;

;
