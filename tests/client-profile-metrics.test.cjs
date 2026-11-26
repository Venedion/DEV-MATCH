const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');

const root=path.join(__dirname,'..');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261126172641_client_profile_metrics.sql'),'utf8');

test('client profile view and developer favorites are counted in Supabase and broadcast to the owner',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create schema realtime;
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function realtime.topic() returns text language sql stable
        as $$ select current_setting('realtime.topic',true) $$;
      create table auth.users(id uuid primary key);
      create table public.profiles(id uuid primary key,account_role text,onboarding_complete boolean);
      create table public.account_workspaces(user_id uuid,role text,onboarding_complete boolean);
      create table public.favorites(
        user_id uuid,workspace_role text,item_type text,item_id text,
        primary key(user_id,workspace_role,item_type,item_id)
      );
      create table realtime.messages(topic text);
      create table realtime.events(payload jsonb,event text,topic text,is_private boolean);
      create function realtime.send(jsonb,text,text,boolean) returns void
        language plpgsql as $$
        begin insert into realtime.events values($1,$2,$3,$4); end
        $$;
      create function public.has_account_workspace(p_role text) returns boolean
        language sql stable as $$
          select exists(select 1 from public.profiles p where p.id=auth.uid()
            and p.account_role=p_role)
            or exists(select 1 from public.account_workspaces w where w.user_id=auth.uid()
              and w.role=p_role)
        $$;
      insert into auth.users values
        ('11111111-1111-4111-8111-111111111111'),
        ('22222222-2222-4222-8222-222222222222'),
        ('33333333-3333-4333-8333-333333333333');
      insert into public.profiles values
        ('11111111-1111-4111-8111-111111111111','dev',true),
        ('22222222-2222-4222-8222-222222222222','dev',true),
        ('33333333-3333-4333-8333-333333333333','client',true);
      grant usage on schema public,realtime to authenticated;
      grant insert on public.favorites to authenticated;
    `);
    await db.exec(migration);
    await db.exec(`
      set role authenticated;
      select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
      select public.record_client_profile_view('33333333-3333-4333-8333-333333333333');
      select public.record_client_profile_view('33333333-3333-4333-8333-333333333333');
      insert into public.favorites values
        ('11111111-1111-4111-8111-111111111111','dev','client','33333333-3333-4333-8333-333333333333'),
        ('22222222-2222-4222-8222-222222222222','dev','client','33333333-3333-4333-8333-333333333333'),
        ('11111111-1111-4111-8111-111111111111','client','client','33333333-3333-4333-8333-333333333333');
      reset role;
    `);
    const {rows}=await db.query(`
      select * from public.get_client_profile_metrics('33333333-3333-4333-8333-333333333333')
    `);
    assert.deepEqual(rows,[{views:1,favorites:2}]);
    const {rows:events}=await db.query(`
      select event,topic,is_private from realtime.events
      where topic='devmatch-client-profile-metrics:33333333-3333-4333-8333-333333333333'
    `);
    assert.equal(events.length,3);
    assert.ok(events.every(event=>event.event==='refresh'&&event.is_private));
    await assert.rejects(
      db.exec(`
        set role authenticated;
        select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
        select public.record_client_profile_view('33333333-3333-4333-8333-333333333333');
      `),
      /Developer workspace access denied/
    );
  }finally{
    await db.close();
  }
});

test('client profile displays database metrics and subscribes to live updates',()=>{
  const owner=fs.readFileSync(path.join(root,'assets/js/my-profile.js'),'utf8');
  const visitor=fs.readFileSync(path.join(root,'assets/js/client-profile.js'),'utf8');
  const backend=fs.readFileSync(path.join(root,'assets/js/backend.js'),'utf8');
  assert.match(owner,/loadClientProfileMetrics\(userId\)/);
  assert.match(owner,/devmatch-client-profile-metrics:\$\{user\.id\}/);
  assert.match(owner,/\.on\('broadcast',\{event:'refresh'\}/);
  assert.match(visitor,/recordClientProfileView\(clientId\)/);
  assert.match(visitor,/loadClientProfileMetrics\(clientId\)/);
  assert.match(backend,/record_client_profile_view/);
  assert.match(backend,/get_client_profile_metrics/);
});
