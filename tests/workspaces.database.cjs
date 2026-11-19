// Runs the real migrations in embedded PostgreSQL, with Supabase system tables stubbed.
const {PGlite} = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema extensions;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,storage to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
    create publication supabase_realtime;
  `);
  const dir = path.join(__dirname, '../supabase/migrations');
  let isolationMigration; let activityMigration;
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    // Registration uses external proof-of-work and pgcrypto, tested separately.
    if (file.includes('registration_protection')) continue;
    if (file.includes('chat_presence_and_receipts')) {activityMigration=fs.readFileSync(path.join(dir,file),'utf8');continue;}
    if (file.includes('workspace_data_isolation')) { isolationMigration=fs.readFileSync(path.join(dir,file),'utf8'); continue; }
    try { await db.exec(fs.readFileSync(path.join(dir, file), 'utf8')); }
    catch (error) { throw new Error(`${file}: ${error.message}`); }
  }
  await db.exec(`
    insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    ('${A}','a@example.invalid',now(),'{"account_role":"client"}'),
    ('${B}','b@example.invalid',now(),'{"account_role":"dev"}'),
    ('${C}','c@example.invalid',null,'{"account_role":"client"}');
    update public.profiles set display_name='Original client',onboarding_complete=true,profile_data='{"bio":"client data","accountNumber":"PRIVATE"}' where id='${A}';
    update public.profiles set display_name='Developer B',onboarding_complete=true where id='${B}';
  `);
  // Seed rows using the old schema before migrating; no history is copied or deleted.
  await db.exec(`
    update public.profiles set username='shared_a',phone='+628123456789' where id='${A}';
    insert into public.conversations(id,participant_a_id,participant_b_id) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${A}','${B}');
    insert into public.favorites(user_id,item_type,item_id) values('${A}','project','legacy-saved');
    insert into public.notifications(id,recipient_id,actor_id,kind,conversation_id) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','${A}','${B}','message','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    insert into public.notification_reads(user_id,notification_id) values('${A}','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  `);
  await db.exec(isolationMigration);
  await db.exec(activityMigration);
  assert.equal((await db.query("select participant_a_role from public.conversations")).rows[0].participant_a_role,'client');
  assert.equal((await db.query("select workspace_role from public.favorites")).rows[0].workspace_role,'client');
  assert.equal((await db.query("select recipient_role from public.notifications")).rows[0].recipient_role,'client');
  assert.equal((await db.query("select workspace_role from public.notification_reads")).rows[0].workspace_role,'client');
  const asUser = async id => db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`);
  const scalar = async sql => (await db.query(sql)).rows[0];
  await asUser(A);
  await assert.rejects(db.query("select public.switch_account_workspace('dev',false)"));
  await assert.rejects(db.query(`insert into public.projects(owner_id,project_kind) values ('${A}','portfolio')`));
  let row = await scalar("select account_role,profile_data,onboarding_complete from public.switch_account_workspace('dev',true)");
  assert.equal(row.account_role, 'dev'); assert.equal(row.onboarding_complete, false); assert.deepEqual(row.profile_data, {});
  await db.exec("select public.switch_account_workspace('dev',true)");
  assert.equal((await scalar('select count(*)::int n from public.account_workspaces')).n, 1);
  await db.exec(`update public.account_workspaces set display_name='Developer A',onboarding_complete=true,profile_data='{"bio":"developer data","npwp":"PRIVATE"}' where user_id='${A}' and role='dev';`);
  row = await scalar("select account_role,profile_data from public.switch_account_workspace('client',false)");
  assert.equal(row.account_role, 'client'); assert.equal(row.profile_data.bio, 'client data');
  row = await scalar(`select account_role,profile_data from public.profiles where id='${A}'`);
  assert.equal(row.account_role, 'client'); assert.equal(row.profile_data.bio, 'client data');
  row = await scalar("select profile_data from public.switch_account_workspace('dev',false)");
  assert.equal(row.profile_data.bio, 'developer data');
  const directory = await db.query(`select account_role,profile_data from public.directory_people where id='${A}'`);
  assert.equal(directory.rows.length, 2);
  for (const person of directory.rows) { assert.equal(person.profile_data.accountNumber, undefined); assert.equal(person.profile_data.npwp, undefined); }
  await db.exec(`insert into public.projects(id,owner_id,project_kind,status) values ('portfolio-a','${A}','portfolio','published'),('request-a','${A}','request','open')`);
  for (const role of ['client','dev']) assert.equal((await scalar(`select public.get_dashboard_metrics('${role}') m`)).m.projects, 1);
  await assert.rejects(db.query(`update public.account_workspaces set user_id='${B}' where user_id='${A}'`));
  await assert.rejects(db.query(`update public.profiles set account_role='dev' where id='${A}'`));
  await asUser(B);
  assert.equal((await scalar(`select count(*)::int n from public.account_workspaces where user_id='${A}'`)).n, 0);
  assert.equal((await db.query(`update public.account_workspaces set display_name='HACK' where user_id='${A}' returning user_id`)).rows.length, 0);
  await assert.rejects(db.query(`insert into public.projects(owner_id,project_kind) values ('${A}','portfolio')`));
  await db.exec("select public.switch_account_workspace('client',true)");
  await db.exec(`update public.account_workspaces set onboarding_complete=true where user_id='${B}' and role='client'`);
  await db.exec(`reset role; insert into public.conversations(id,participant_a_id,participant_b_id,project_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${A}','${B}','portfolio-a')`);
  await asUser(A);
  const engagement = await scalar("select public.start_project_engagement('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') id");
  row = await scalar(`select client_id,developer_id from public.project_engagements where id='${engagement.id}'`);
  assert.equal(row.developer_id,A); assert.equal(row.client_id,B);
  await asUser(C);
  await assert.rejects(db.query("select public.switch_account_workspace('dev',true)"));
  await asUser('');
  await assert.rejects(db.query("select public.switch_account_workspace('dev',true)"));
  await asUser(A);
  await assert.rejects(db.query("select public.switch_account_workspace('admin',true)"));
  // The same identity has independent favorites, read states and preferences.
  await asUser(A);
  for(const role of ['client','dev']) {
    const identity=await scalar(`select username,phone from public.switch_account_workspace('${role}',false)`);
    assert.equal(identity.username,'shared_a');assert.equal(identity.phone,'+628123456789');
    await db.exec(`insert into public.favorites(user_id,workspace_role,item_type,item_id) values('${A}','${role}','project','same-project')`);
  }
  await db.exec(`delete from public.favorites where user_id='${A}' and workspace_role='dev' and item_id='same-project'`);
  assert.equal((await scalar("select count(*)::int n from public.favorites where workspace_role='client' and item_id='same-project'")).n,1);
  await db.exec("select public.save_notification_preferences('{\"messages\":false}', 'client'); select public.save_notification_preferences('{\"messages\":true}', 'dev');");
  assert.equal((await scalar("select profile_data from public.switch_account_workspace('client',false)")).profile_data.notificationPreferences.messages,false);
  assert.equal((await scalar("select profile_data from public.switch_account_workspace('dev',false)")).profile_data.notificationPreferences.messages,true);
  await assert.rejects(db.exec(`insert into public.notification_reads(user_id,workspace_role,notification_id) values('${A}','dev','cccccccc-cccc-4ccc-8ccc-cccccccccccc')`));
  await db.exec(`reset role;
    insert into public.conversations(id,participant_a_id,participant_b_id,participant_a_role,participant_b_role)
      values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','${A}','${B}','dev','client');
    insert into public.messages(conversation_id,sender_id,ciphertext,nonce,key_version) values
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${B}',repeat('a',22),repeat('b',16),1),
      ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','${B}',repeat('a',22),repeat('b',16),1);
  `);
  assert.equal((await scalar(`select count(*)::int n from public.notifications where recipient_id='${A}' and recipient_role='client'`)).n,1);
  assert.equal((await scalar(`select count(*)::int n from public.notifications where recipient_id='${A}' and recipient_role='dev'`)).n,1);
  await asUser(B);
  assert.equal((await scalar(`select count(*)::int n from public.favorites where user_id='${A}'`)).n,0);
  await asUser(C);
  await assert.rejects(db.exec(`insert into public.favorites(user_id,workspace_role,item_type,item_id) values('${C}','dev','project','forbidden')`));
  await asUser(A);
  const beforeRead=(await scalar("select public.sync_chat_activity('client','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now()) s")).s;
  assert.equal(beforeRead.online,false);
  await asUser(B);
  const afterRead=(await scalar("select public.sync_chat_activity('dev','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null) s")).s;
  assert.equal(afterRead.online,true);assert.ok(afterRead.read_at);
  await assert.rejects(db.query("select public.sync_chat_activity('client','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now())"));
  await asUser(C);
  await assert.rejects(db.query("select public.sync_chat_activity('client','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now())"));
  console.log('PASS: legacy history retained, shared identity, isolated workspace profiles/favorites/notifications/preferences, role-aware conversations, RLS and existing project features');
  await db.close();
})().catch(error => { console.error(error.message); process.exitCode = 1; });
