const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');

const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261126170716_public_connected_apps.sql'),'utf8');

test('public client profiles expose connected-app status without exposing phone or account email',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create schema private;
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table auth.users(id uuid,email text);
      create table public.profiles(
        id uuid,
        account_role text,
        username text,
        display_name text,
        profile_data jsonb,
        onboarding_complete boolean
      );
      create table public.account_workspaces(user_id uuid,role text,profile_data jsonb,display_name text);
      create function private.read_directory_people() returns table(
        id uuid,
        display_name text,
        username text,
        account_role text,
        profile_data jsonb,
        published_portfolio_count bigint,
        open_request_count bigint,
        published_portfolio_views_count bigint,
        published_portfolio_favorites_count bigint
      ) language sql stable as $$
        select p.id,p.display_name,p.username,p.account_role,
          jsonb_strip_nulls(jsonb_build_object(
            'city',p.profile_data->'city',
            'bio',p.profile_data->'bio',
            'githubUsername',p.profile_data->'githubUsername',
            'linkedinUrl',p.profile_data->'linkedinUrl'
          )),
          0::bigint,0::bigint,0::bigint,0::bigint
        from public.profiles p
        where p.onboarding_complete
      $$;
      create view public.directory_people as select * from private.read_directory_people();
      insert into public.profiles values
        ('11111111-1111-4111-8111-111111111111','client','client-a','Client A',
            '{"city":"Medan","country":"Indonesia","whatsapp":"+628123456789","whatsappConnected":false,"googleEmail":"private@example.invalid","googleConnected":false,"instagram":"client.ig","instagramConnected":false,"githubUsername":"client-gh","githubConnected":true,"linkedinUrl":"https://www.linkedin.com/in/client","linkedinConnected":false}',
          true),
        ('22222222-2222-4222-8222-222222222222','client','client-b','Client B',
            '{"city":"Denpasar","country":"Indonesia","whatsapp":"+628987654321","googleEmail":"private-b@example.invalid","instagram":"client_b","githubUsername":"client-b","linkedinUrl":"https://www.linkedin.com/in/client-b"}',
          true),
        ('33333333-3333-4333-8333-333333333333','client','client-c','Client C','{}',true);
      insert into auth.users values
        ('33333333-3333-4333-8333-333333333333','client-c@gmail.com');
    `);
    await db.exec(migration);

    const {rows}=await db.query('select display_name,profile_data from public.directory_people order by display_name');
    const explicit=rows[0].profile_data;
    assert.deepEqual(
      ['whatsappConnected','googleConnected','instagramConnected','githubConnected','linkedinConnected']
        .map(field=>explicit[field]),
      [true,true,true,true,false]
    );
    assert.equal(explicit.city,'Medan');
    assert.equal(explicit.country,'Indonesia');
    assert.equal(explicit.instagram,'client.ig');
    assert.equal(explicit.whatsapp,undefined);
    assert.equal(explicit.googleEmail,undefined);

    const inferred=rows[1].profile_data;
    assert.deepEqual(
      ['whatsappConnected','googleConnected','instagramConnected','githubConnected','linkedinConnected']
        .map(field=>inferred[field]),
      [true,true,true,true,true]
    );
    assert.equal(inferred.city,'Denpasar');
    assert.equal(inferred.country,'Indonesia');
    assert.equal(inferred.instagram,'client_b');
    assert.equal(inferred.whatsapp,undefined);
    assert.equal(inferred.googleEmail,undefined);

    const gmailAccount=rows[2].profile_data;
    assert.equal(gmailAccount.googleConnected,true);
    assert.equal(gmailAccount.whatsappConnected,false);
    assert.equal(gmailAccount.instagramConnected,false);
  }finally{
    await db.close();
  }
});
