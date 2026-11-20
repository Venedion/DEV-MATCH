const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const ROOT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEV_ROOT='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PROJECT_ROOT='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DIRECT_ROOT='dddddddd-dddd-4ddd-8ddd-dddddddddddd';

test('workspace thread migration splits legacy virtual roots by role and project without moving messages',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table public.profiles(id uuid primary key,account_role text not null);
      create table public.account_workspaces(user_id uuid not null,role text not null,primary key(user_id,role));
      create function public.has_account_workspace(p_role text) returns boolean
        language sql stable as $$
          select exists(select 1 from public.profiles where id=auth.uid() and account_role=p_role)
            or exists(select 1 from public.account_workspaces where user_id=auth.uid() and role=p_role)
        $$;
      create table public.projects(id text primary key,owner_id uuid,project_kind text,status text);
      create table public.conversations(
        id uuid primary key default gen_random_uuid(),
        participant_a_id uuid not null,
        participant_b_id uuid not null,
        participant_a_role text not null,
        participant_b_role text not null,
        project_id text,
        pair_key text generated always as (
          least(participant_a_id,participant_b_id)::text || ':' ||
          greatest(participant_a_id,participant_b_id)::text
        ) stored,
        is_primary boolean not null default false,
        is_active boolean not null default true,
        merged_into uuid,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        last_message_at timestamptz
      );
      create table public.messages(
        id uuid primary key default gen_random_uuid(),
        conversation_id uuid not null references public.conversations(id),
        sender_id uuid not null
      );
      create unique index conversations_single_active_pair_idx
        on public.conversations(pair_key) where merged_into is null;
      create unique index conversations_single_primary_pair_idx
        on public.conversations(pair_key) where is_primary;
      create unique index conversations_workspace_participants_unique_idx on public.conversations(
        least(participant_a_id,participant_b_id),
        greatest(participant_a_id,participant_b_id),
        (case when participant_a_id<participant_b_id then participant_a_role else participant_b_role end),
        (case when participant_a_id<participant_b_id then participant_b_role else participant_a_role end),
        coalesce(project_id,'')
      );
      insert into public.profiles(id,account_role) values('${A}','client'),('${B}','dev');
      insert into public.account_workspaces(user_id,role) values('${A}','dev'),('${B}','client');
      insert into public.projects(id,owner_id,project_kind,status) values
        ('portfolio-one','${B}','portfolio','published'),
        ('portfolio-two','${B}','portfolio','published'),
        ('request-one','${B}','request','open');
      insert into public.conversations(
        id,participant_a_id,participant_b_id,participant_a_role,participant_b_role,
        project_id,is_primary,is_active,merged_into
      ) values
        ('${ROOT}','${A}','${B}','client','dev','portfolio-one',true,true,null),
        ('${DEV_ROOT}','${A}','${B}','dev','client','request-one',false,true,'${ROOT}'),
        ('${PROJECT_ROOT}','${A}','${B}','client','dev','portfolio-two',false,true,'${ROOT}'),
        ('${DIRECT_ROOT}','${A}','${B}','client','dev',null,false,true,'${ROOT}');
      insert into public.messages(conversation_id,sender_id) values
        ('${ROOT}','${A}'),('${DEV_ROOT}','${B}'),('${PROJECT_ROOT}','${A}'),('${DIRECT_ROOT}','${B}');
    `);

    const migration=fs.readFileSync(
      path.join(__dirname,'../supabase/migrations/202611210001_separate_chat_workspace_threads.sql'),
      'utf8'
    );
    await db.exec(migration);

    assert.equal((await db.query('select count(*)::int as n from public.messages')).rows[0].n,4);
    const separated=(await db.query(`
      select id,participant_a_role,participant_b_role,project_id,merged_into,is_primary,workspace_pair_key
      from public.conversations order by id
    `)).rows;
    assert.equal(separated.length,4);
    assert.equal(separated.filter(row=>row.merged_into===null).length,4);
    assert.equal(separated.filter(row=>row.is_primary).length,4);
    assert.equal(new Set(separated.map(row=>row.workspace_pair_key)).size,4);
    assert.equal(separated.find(row=>row.id===DEV_ROOT).participant_a_role,'dev');
    assert.equal(separated.find(row=>row.id===DEV_ROOT).project_id,'request-one');

    await db.exec(`select set_config('request.jwt.claim.sub','${A}',false)`);
    const getConversation=async(role,peerRole,projectId=null)=>(await db.query(
      'select id from public.get_or_create_conversation($1,$2,$3,$4)',
      [B,role,peerRole,projectId]
    )).rows[0].id;
    assert.equal(await getConversation('client','dev','portfolio-one'),ROOT);
    assert.equal(await getConversation('dev','client','request-one'),DEV_ROOT);
    assert.equal(await getConversation('client','dev','portfolio-two'),PROJECT_ROOT);
    assert.equal(await getConversation('client','dev',null),DIRECT_ROOT);
    const distinctRoleThread=await getConversation('dev','client',null);
    assert.notEqual(distinctRoleThread,DIRECT_ROOT);
    assert.equal(await getConversation('dev','client',null),distinctRoleThread);
  }finally{
    await db.close();
  }
});
