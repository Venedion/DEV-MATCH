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
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    // Registration uses external proof-of-work and pgcrypto, tested separately.
    if (file.includes('registration_protection')) continue;
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
  console.log('PASS: full schema, idempotent connect, profile isolation, dual-role projects/directory/metrics/reviews, RLS isolation, invalid and unverified access');
  await db.close();
})().catch(error => { console.error(error.message); process.exitCode = 1; });
