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
    create schema auth; create schema storage; create schema extensions; create schema realtime;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,storage,realtime to anon,authenticated;
    create table realtime.messages(topic text not null);
    alter table realtime.messages enable row level security;
    grant select,insert on realtime.messages to authenticated;
    create function realtime.topic() returns text language sql stable as $$ select current_setting('request.realtime.topic',true) $$;
    create function realtime.send(jsonb, text, text, boolean) returns void language sql as $$ select pg_catalog.pg_sleep(0) $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
    create publication supabase_realtime;
  `);
  const dir = path.join(__dirname, '../supabase/migrations');
  let isolationMigration; let activityMigration; let separationMigration;
  let commentAuthorMigration;
  const paymentMigrations = [];
  const laterMigrations = [];
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    // Registration uses external proof-of-work and pgcrypto, tested separately.
    if (file.includes('registration_protection')) continue;
    if (/^2026110(8070937|8071658|8092159|8100953)/.test(file)) continue;
    if (/^20261114(131159|162904)/.test(file)) continue;
    if (file === '20261117170424_account_workspaces_and_latest_features.sql') continue;
    if (file === '20261118085659_realtime_notifications.sql') continue;
    if (file === '202611190002_public_developer_work_terms.sql') continue;
    if (file.includes('chat_presence_and_receipts')) {activityMigration=fs.readFileSync(path.join(dir,file),'utf8');continue;}
    if (file.includes('workspace_data_isolation')) { isolationMigration=fs.readFileSync(path.join(dir,file),'utf8'); continue; }
    if (file.includes('separate_chat_workspace_threads')) { separationMigration=fs.readFileSync(path.join(dir,file),'utf8'); continue; }
    if (file === '202611260001_proposal_agreement_payments.sql' || file === '202611260002_username_validation.sql') {
      laterMigrations.push(fs.readFileSync(path.join(dir,file),'utf8'));
      continue;
    }
    if (file.includes('midtrans_sandbox_payments') || file.includes('payment_room_chat_context')) {
      paymentMigrations.push(fs.readFileSync(path.join(dir,file),'utf8'));
      continue;
    }
    if (file === '202611190001_sync_project_comment_display_names.sql') {commentAuthorMigration=fs.readFileSync(path.join(dir,file),'utf8');continue;}
    try { await db.exec(fs.readFileSync(path.join(dir, file), 'utf8')); }
    catch (error) { throw new Error(`${file}: ${error.message}`); }
  }
  await db.exec(`
    insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    ('${A}','a@example.invalid',now(),'{"account_role":"client","username":"ShareD_A"}'),
    ('${B}','b@example.invalid',now(),'{"account_role":"dev","username":"developer_b"}'),
    ('${C}','c@example.invalid',null,'{"account_role":"client","username":"client_c"}');
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
  await db.exec(separationMigration);
  for (const migration of paymentMigrations) await db.exec(migration);
  for (const migration of laterMigrations) await db.exec(migration);
  assert.equal((await db.query("select participant_a_role from public.conversations")).rows[0].participant_a_role,'client');
  assert.equal((await db.query("select workspace_role from public.favorites")).rows[0].workspace_role,'client');
  assert.equal((await db.query("select recipient_role from public.notifications")).rows[0].recipient_role,'client');
  assert.equal((await db.query("select workspace_role from public.notification_reads")).rows[0].workspace_role,'client');
  const asUser = async id => db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`);
  const scalar = async sql => (await db.query(sql)).rows[0];
  await asUser(A);
  assert.equal((await scalar(`select username from public.profiles where id='${A}'`)).username, 'shared_a');
  assert.equal((await scalar("select public.is_username_available('SHARED_A') available")).available, true);
  assert.equal((await scalar("select public.is_username_available('DEVELOPER_B') available")).available, false);
  for (const [candidate, message] of [
    ['ab', 'Username must be at least 3 characters.'],
    ['a'.repeat(21), 'Username cannot exceed 20 characters.'],
    ['ab c', 'Username cannot contain spaces.'],
    ['ab@c', 'Username can only contain letters, numbers, periods (.), and underscores (_).'],
    ['.abc', 'Username cannot start or end with a period.'],
    ['abc.', 'Username cannot start or end with a period.'],
    ['a..b', 'Username cannot contain consecutive periods.']
  ]) {
    await assert.rejects(db.query('select public.change_username($1)', [candidate]), new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  await assert.rejects(db.query("select public.switch_account_workspace('dev',false)"));
  await assert.rejects(db.query(`insert into public.projects(owner_id,project_kind) values ('${A}','portfolio')`));
  let row = await scalar("select account_role,profile_data,onboarding_complete from public.switch_account_workspace('dev',true)");
  assert.equal(row.account_role, 'dev'); assert.equal(row.onboarding_complete, false); assert.deepEqual(row.profile_data, {});
  await db.exec("select public.switch_account_workspace('dev',true)");
  assert.equal((await scalar('select count(*)::int n from public.account_workspaces')).n, 1);
  await db.exec(`update public.account_workspaces set display_name='Developer A',onboarding_complete=true,profile_data='{"bio":"developer data","npwp":"PRIVATE","bankName":"PRIVATE","hourlyRate":"Rp 150.000","minProjectPrice":"Rp 1.000.000","contractTypes":["Fixed-price","Hourly"],"githubUsername":"dev-a","linkedinUrl":"https://www.linkedin.com/in/dev-a","experiences":[{"title":"Engineer","company":"Acme","period":"2020 - Present","link":"https://example.invalid","files":["private.pdf"],"filePaths":["private/experience.pdf"]}]}' where user_id='${A}' and role='dev';`);
  row = await scalar("select account_role,profile_data from public.switch_account_workspace('client',false)");
  assert.equal(row.account_role, 'client'); assert.equal(row.profile_data.bio, 'client data');
  row = await scalar(`select account_role,profile_data from public.profiles where id='${A}'`);
  assert.equal(row.account_role, 'client'); assert.equal(row.profile_data.bio, 'client data');
  row = await scalar("select profile_data from public.switch_account_workspace('dev',false)");
  assert.equal(row.profile_data.bio, 'developer data');
  const directory = await db.query(`select account_role,profile_data from public.directory_people where id='${A}'`);
  assert.equal(directory.rows.length, 2);
  const developerDirectory = directory.rows.find(person => person.account_role === 'dev');
  assert.equal(developerDirectory.profile_data.hourlyRate, 'Rp 150.000');
  assert.equal(developerDirectory.profile_data.minProjectPrice, 'Rp 1.000.000');
  assert.deepEqual(developerDirectory.profile_data.contractTypes, ['Fixed-price', 'Hourly']);
  assert.equal(developerDirectory.profile_data.githubUsername, 'dev-a');
  assert.equal(developerDirectory.profile_data.linkedinUrl, 'https://www.linkedin.com/in/dev-a');
  assert.deepEqual(developerDirectory.profile_data.experiences, [{
    title: 'Engineer', company: 'Acme', period: '2020 - Present', link: 'https://example.invalid'
  }]);
  for (const person of directory.rows) {
    assert.equal(person.profile_data.accountNumber, undefined);
    assert.equal(person.profile_data.npwp, undefined);
    assert.equal(person.profile_data.bankName, undefined);
  }
  await db.exec('reset role');
  await db.exec(`insert into public.projects(id,owner_id,project_kind,status) values ('portfolio-a','${A}','portfolio','published'),('request-a','${A}','request','open')`);
  await asUser(A);
  for (const role of ['client','dev']) assert.equal((await scalar(`select public.get_dashboard_metrics('${role}') m`)).m.projects, 1);
  await assert.rejects(db.query(`update public.account_workspaces set user_id='${B}' where user_id='${A}'`));
  await assert.rejects(db.query(`update public.profiles set account_role='dev' where id='${A}'`));
  await asUser(B);
  assert.equal((await scalar(`select count(*)::int n from public.account_workspaces where user_id='${A}'`)).n, 0);
  assert.equal((await db.query(`update public.account_workspaces set display_name='HACK' where user_id='${A}' returning user_id`)).rows.length, 0);
  await assert.rejects(db.query(`insert into public.projects(owner_id,project_kind) values ('${A}','portfolio')`));
  await db.exec("select public.switch_account_workspace('client',true)");
  await db.exec(`update public.account_workspaces set onboarding_complete=true where user_id='${B}' and role='client'`);
  await db.exec(`reset role; insert into public.conversations(id,participant_a_id,participant_b_id,project_id,merged_into,is_primary) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${A}','${B}','portfolio-a','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false)`);
  await db.exec(`insert into realtime.messages(topic) values ('devmatch-user-presence:${B}'),('devmatch-user-presence:${C}')`);
  await asUser(A);
  await db.exec(`select set_config('request.realtime.topic','devmatch-user-presence:${B}',false)`);
  assert.equal((await scalar(`select count(*)::int n from realtime.messages where topic='devmatch-user-presence:${B}'`)).n, 1);
  await db.exec(`select set_config('request.realtime.topic','devmatch-user-presence:${C}',false)`);
  assert.equal((await scalar(`select count(*)::int n from realtime.messages where topic='devmatch-user-presence:${C}'`)).n, 0);
  await db.exec(`select set_config('request.realtime.topic','devmatch-user-presence:${A}',false)`);
  await db.exec(`insert into realtime.messages(topic) values ('devmatch-user-presence:${A}')`);
  await db.exec(`select set_config('request.realtime.topic','devmatch-user-presence:${B}',false)`);
  await assert.rejects(db.exec(`insert into realtime.messages(topic) values ('devmatch-user-presence:${B}')`));
  await db.exec(`select set_config('request.realtime.topic','',false)`);
  const engagement = await scalar("select public.start_project_engagement('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') id");
  row = await scalar(`select client_id,developer_id from public.project_engagements where id='${engagement.id}'`);
  assert.equal(row.developer_id,A); assert.equal(row.client_id,B);
  await db.exec(`reset role;
    insert into public.comments(id,project_id,user_id,text,author_name,author_initials)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','request-a','${A}','Existing comment','old username','OU');
    update public.comments
    set author_name='old username',author_initials='OU'
    where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  `);
  await db.exec(commentAuthorMigration);
  row = await scalar(`select author_name,author_initials from public.comments where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'`);
  assert.equal(row.author_name, 'Original client');
  assert.equal(row.author_initials, 'OC');
  await asUser(A);
  await db.exec(`update public.profiles set display_name='Updated Client' where id='${A}'`);
  row = await scalar(`select author_name,author_initials from public.comments where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'`);
  assert.equal(row.author_name, 'Updated Client');
  assert.equal(row.author_initials, 'UC');
  await db.exec(`insert into public.comments(id,project_id,parent_comment_id,user_id,workspace_role,text,author_name,author_initials)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','request-a','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${A}','client','Reply to my own comment','Updated Client','UC')`);
  row = await scalar(`select parent_comment_id,user_id,text from public.comments where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'`);
  assert.equal(row.parent_comment_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  assert.equal(row.user_id, A);
  assert.equal(row.text, 'Reply to my own comment');
  await db.exec(`reset role;
    insert into public.favorites(user_id,item_type,item_id)
    values ('${B}','project','request-a'),('${B}','project','portfolio-a');
  `);
  await asUser(B);
  row = await scalar(`select project_id,favorite_count,comment_count
    from public.get_public_request_card_metrics(array['request-a','portfolio-a'])
    where project_id='request-a'`);
  assert.equal(row.project_id, 'request-a');
  assert.equal(Number(row.favorite_count), 1);
  assert.equal(Number(row.comment_count), 2);
  assert.equal((await scalar(`select count(*)::int n
    from public.get_public_request_card_metrics(array['request-a','portfolio-a'])`)).n, 1);
  await asUser(C);
  await assert.rejects(db.query(`select * from public.get_public_request_card_metrics(array['request-a'])`));
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
    insert into public.conversations(id,participant_a_id,participant_b_id,participant_a_role,participant_b_role,merged_into,is_primary)
      values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','${A}','${B}','dev','client','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
    insert into public.messages(conversation_id,sender_id,ciphertext,nonce,key_version) values
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${B}',repeat('a',22),repeat('b',16),1),
      ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','${B}',repeat('a',22),repeat('b',16),1);
  `);
  assert.equal((await scalar(`select count(*)::int n from public.notifications where recipient_id='${A}' and recipient_role='client'`)).n,2);
  assert.equal((await scalar(`select count(*)::int n from public.notifications where recipient_id='${A}' and recipient_role='dev'`)).n,2);
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
  await db.exec(`reset role; update public.profiles set phone='+6281234567890' where id='${A}'`);
  await asUser(A);
  await assert.rejects(db.query('select public.start_whatsapp_phone_verification()'));
  const whatsappChallenge = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const whatsappPhone = '+6281234567890';
  const whatsappDigest = 'a'.repeat(64);
  await assert.rejects(db.query('select public.reserve_whatsapp_otp($1,$2,$3,$4)',[A,whatsappChallenge,whatsappPhone,whatsappDigest]));
  await assert.rejects(db.query('select public.verify_whatsapp_otp($1,$2,$3,$4)',[A,whatsappChallenge,whatsappPhone,whatsappDigest]));
  await db.exec('reset role; set role service_role');
  assert.equal((await db.query('select public.reserve_whatsapp_otp($1,$2,$3,$4) ok',[A,whatsappChallenge,whatsappPhone,whatsappDigest])).rows[0].ok,true);
  assert.equal((await db.query('select public.reserve_whatsapp_otp($1,$2,$3,$4) ok',[A,whatsappChallenge,whatsappPhone,whatsappDigest])).rows[0].ok,false);
  assert.equal((await db.query('select public.verify_whatsapp_otp($1,$2,$3,$4) result',[A,whatsappChallenge,whatsappPhone,'b'.repeat(64)])).rows[0].result,'invalid');
  assert.equal((await db.query('select public.verify_whatsapp_otp($1,$2,$3,$4) result',[A,whatsappChallenge,whatsappPhone,whatsappDigest])).rows[0].result,'verified');
  assert.equal((await db.query('select public.verify_whatsapp_otp($1,$2,$3,$4) result',[A,whatsappChallenge,whatsappPhone,whatsappDigest])).rows[0].result,'expired');
  await assert.rejects(db.query('select public.confirm_whatsapp_phone_verification($1,$2)',[whatsappChallenge,whatsappPhone]));
  await asUser(A);
  const verifiedProfile = await scalar(`select phone,verified_phone,phone_verified_at from public.profiles where id='${A}'`);
  assert.equal(verifiedProfile.phone, whatsappPhone);
  assert.equal(verifiedProfile.verified_phone, whatsappPhone);
  assert.ok(verifiedProfile.phone_verified_at);
  await asUser(B);
  const unverifiedProfile = await scalar(`select phone_verified_at,verified_phone from public.profiles where id='${B}'`);
  assert.equal(unverifiedProfile.phone_verified_at, null);
  assert.equal(unverifiedProfile.verified_phone, null);
  await db.exec(`reset role;
    insert into public.project_views(project_id,viewer_id,viewed_on) values('portfolio-a','${C}',current_date);
    insert into public.favorites(user_id,workspace_role,item_type,item_id)
      values('${C}','client','project','portfolio-a');
  `);
  const developerMetrics = await scalar(`select published_portfolio_count,published_portfolio_views_count,published_portfolio_favorites_count
    from public.directory_people where id='${A}' and account_role='dev'`);
  assert.equal(Number(developerMetrics.published_portfolio_count), 1);
  assert.equal(Number(developerMetrics.published_portfolio_views_count), 1);
  assert.equal(Number(developerMetrics.published_portfolio_favorites_count), 2);
  await db.exec(`reset role; update public.profiles set username_changed_at=now()-interval '8 days' where id='${C}'`);
  await asUser(C);
  assert.equal((await scalar("select public.change_username('Client_New') username")).username, 'client_new');
  assert.equal((await scalar("select public.is_username_available('CLIENT_NEW') available")).available, true);
  await assert.rejects(db.query("select public.change_username('another_name')"), /You can change your username again after 7 days\./);
  console.log('PASS: full schema, username validation and cooldown, legacy history retained, shared identity, workspace profile isolation, dual-role projects/directory/metrics/reviews, role-aware chat/presence, favorites/notifications/read preferences, RLS and comment features');
  await db.close();
})().catch(error => { console.error(error.message); process.exitCode = 1; });
