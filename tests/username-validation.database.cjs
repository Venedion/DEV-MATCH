const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const C='33333333-3333-4333-8333-333333333333';
const D='44444444-4444-4444-8444-444444444444';
const migration=fs.readFileSync(
  path.join(__dirname,'../supabase/migrations/202611260002_username_validation.sql'),
  'utf8'
);

test('database usernames are normalized, unique, validated, and restricted to one change per seven days',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema private;
      create schema auth;
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated;
      grant usage on schema public to anon,authenticated;
      create table public.profiles(
        id uuid primary key,
        username text,
        created_at timestamptz not null default now()
      );
      insert into public.profiles(id,username,created_at) values
        ('${A}','Legacy_User',now()-interval '30 days');
    `);
    await db.exec(migration);
    const scalar=async sql=>(await db.query(sql)).rows[0];
    let profile=await scalar(`select username,username_changed_at,created_at from public.profiles where id='${A}'`);
    assert.equal(profile.username,'legacy_user');
    assert.equal(profile.username_changed_at.toISOString(),profile.created_at.toISOString());

    await db.exec(`
      insert into public.profiles(id,username) values ('${B}','Taken_Name');
      set role authenticated;
      select set_config('request.jwt.claim.sub','${A}',false);
    `);
    assert.equal((await scalar("select public.is_username_available('LEGACY_USER') available")).available,true);
    assert.equal((await scalar("select public.is_username_available('taken_name') available")).available,false);
    for(const [candidate,message] of [
      ['ab','Username must be at least 3 characters.'],
      ['a'.repeat(21),'Username cannot exceed 20 characters.'],
      ['ab c','Username cannot contain spaces.'],
      ['ab@c','Username can only contain letters, numbers, periods (.), and underscores (_).'],
      ['.abc','Username cannot start or end with a period.'],
      ['abc.','Username cannot start or end with a period.'],
      ['a..b','Username cannot contain consecutive periods.']
    ]){
      await assert.rejects(
        db.query('select public.change_username($1)',[candidate]),
        new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))
      );
    }

    assert.equal((await scalar("select public.change_username('New_Name') username")).username,'new_name');
    await db.exec('reset role');
    profile=await scalar(`select username,username_changed_at from public.profiles where id='${A}'`);
    assert.equal(profile.username,'new_name');
    assert.ok(Date.now()-profile.username_changed_at.getTime()<60_000);
    await db.exec('set role authenticated');
    assert.equal((await scalar("select public.is_username_available('NEW_NAME') available")).available,true);
    await assert.rejects(
      db.query("select public.change_username('another_name')"),
      /You can change your username again after 7 days\./
    );

    await db.exec(`reset role; insert into public.profiles(id,username) values ('${C}','Client_New')`);
    profile=await scalar(`select username,username_changed_at from public.profiles where id='${C}'`);
    assert.equal(profile.username,'client_new');
    assert.ok(profile.username_changed_at);
    await assert.rejects(
      db.query(`insert into public.profiles(id,username) values ('${D}','TAKEN_NAME')`),
      /This username is already taken\./
    );

    await db.exec(`update public.profiles set username_changed_at=now()-interval '8 days' where id='${A}'; set role authenticated;`);
    await assert.rejects(
      db.query("select public.change_username('taken_name')"),
      /This username is already taken\./
    );
    await db.exec(`reset role; set role anon; select set_config('request.jwt.claim.sub','',false);`);
    assert.equal((await scalar("select public.is_username_available('TAKEN_NAME') available")).available,false);
  }finally{
    await db.close();
  }
});
