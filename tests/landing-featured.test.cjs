const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');

const migration=fs.readFileSync(
  path.join(__dirname,'../supabase/migrations/202611280002_landing_featured_rankings.sql'),
  'utf8'
);
const projectImagesMigration=fs.readFileSync(
  path.join(__dirname,'../supabase/migrations/202611280003_landing_featured_project_images.sql'),
  'utf8'
);

test('Landing feature queries return only the most viewed projects and most favorited developers',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function public.has_account_workspace(requested_role text) returns boolean
        language sql stable as $$ select current_setting('app.workspace', true) = requested_role $$;
      create table public.projects(
        id text primary key,title text,project_type text,category text,price text,cover_image text,data jsonb,
        created_at timestamptz,updated_at timestamptz,project_kind text,status text
      );
      create table public.project_views(project_id text);
      create table public.favorites(user_id uuid,item_type text,item_id text,workspace_role text);
      create table public.directory_people(
        id uuid,display_name text,account_role text,profile_data jsonb,published_portfolio_count bigint
      );
    `);
    await db.exec(migration);
    await db.exec(projectImagesMigration);
    await db.exec(`
      insert into public.projects values
        ('p1','Project 1','Website','Web','Rp 1','','{}',now(),now(),'portfolio','published'),
        ('p2','Project 2','Web App','App','Rp 2','https://yxwktllqbmhustmhdaqi.supabase.co/storage/v1/object/public/project-media/dev/p2/cover.png','{}',now(),now(),'portfolio','published'),
        ('p3','Project 3','Desktop App','Desktop','Rp 3','','{}',now(),now(),'portfolio','published'),
        ('p4','Project 4','Website','Web','Rp 4','','{}',now(),now(),'portfolio','published'),
        ('p5','Project 5','Website','Web','Rp 5','','{}',now(),now(),'portfolio','published'),
        ('hidden','Hidden','Website','Web','Rp 6','','{}',now(),now(),'portfolio','draft');
      insert into public.project_views(project_id) values
        ('p1'),('p1'),('p1'),('p2'),('p2'),('p2'),('p2'),('p2'),
        ('p3'),('p3'),('p4');
      insert into public.directory_people values
        ('11111111-1111-4111-8111-111111111111','Developer 1','dev','{}',1),
        ('22222222-2222-4222-8222-222222222222','Developer 2','dev','{}',2),
        ('33333333-3333-4333-8333-333333333333','Developer 3','dev','{}',3),
        ('44444444-4444-4444-8444-444444444444','Developer 4','dev','{}',4),
        ('55555555-5555-4555-8555-555555555555','Developer 5','dev','{}',5),
        ('66666666-6666-4666-8666-666666666666','Client','client','{}',0);
      insert into public.favorites values
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','developer','11111111-1111-4111-8111-111111111111','client'),
        ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','developer','22222222-2222-4222-8222-222222222222','client'),
        ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','developer','22222222-2222-4222-8222-222222222222','client'),
        ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','developer','33333333-3333-4333-8333-333333333333','client'),
        ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','developer','33333333-3333-4333-8333-333333333333','client'),
        ('ffffffff-ffff-4fff-8fff-ffffffffffff','developer','33333333-3333-4333-8333-333333333333','client'),
        ('99999999-9999-4999-8999-999999999999','developer','44444444-4444-4444-8444-444444444444','dev');
    `);

    const projects=(await db.query(
      'select id,views,cover_image from public.get_landing_featured_projects()'
    )).rows;
    assert.deepEqual(projects.map(row=>[row.id,Number(row.views)]),
      [['p2',5],['p1',3],['p3',2],['p4',1]]);
    assert.equal(projects[0].cover_image,
      'https://yxwktllqbmhustmhdaqi.supabase.co/storage/v1/object/public/project-media/dev/p2/cover.png');

    await assert.rejects(db.query('select * from public.get_landing_featured_developers()'),
      /Authentication is required/);
    await db.exec(`
      select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
      select set_config('app.workspace','client',false);
    `);
    const developers=(await db.query(
      'select id,favorite_count from public.get_landing_featured_developers()'
    )).rows;
    assert.deepEqual(developers.map(row=>[row.id,Number(row.favorite_count)]),[
      ['33333333-3333-4333-8333-333333333333',3],
      ['22222222-2222-4222-8222-222222222222',2],
      ['11111111-1111-4111-8111-111111111111',1],
      ['44444444-4444-4444-8444-444444444444',0]
    ]);

    await db.exec("select set_config('app.workspace','dev',false)");
    await assert.rejects(db.query('select * from public.get_landing_featured_developers()'),
      /Client workspace access is required/);
  }finally{
    await db.close();
  }
});

test('Landing projects hide category filters and safely wrap long card text',()=>{
  const landing=fs.readFileSync(path.join(__dirname,'../devmatch-landing.html'),'utf8');
  const script=fs.readFileSync(path.join(__dirname,'../assets/js/landing.js'),'utf8');
  const styles=fs.readFileSync(path.join(__dirname,'../assets/css/landing.css'),'utf8');

  assert.doesNotMatch(landing,/id="chips"/);
  assert.match(landing,/<span class="badge"><svg class="client-mode-icon"[^>]*>[\s\S]*?<\/svg> Client Mode<\/span>/);
  assert.match(script,/rpc\('get_landing_featured_projects'\)/);
  assert.match(script,/rpc\('get_landing_featured_developers'\)/);
  assert.match(script,/row\.cover_image/);
  assert.match(script,/class="landing-project-image"/);
  assert.match(styles,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles,/#developers \.wrap\{max-width:1760px\}/);
  assert.match(styles,/#devGrid\{align-items:stretch\}/);
  assert.match(styles,/\.dh \.av\{width:52px;height:52px;font-size:20px\}/);
  assert.match(styles,/\.dh>div>span\{[^}]*display:flex/);
  assert.match(styles,/\.bcard \.badge \.client-mode-icon\{width:1em;height:1em;flex:none\}/);
  assert.match(styles,/\.acts \.btn[^}]*white-space:nowrap/);
  assert.match(styles,/\.pbody h3[^}]*overflow-wrap:anywhere/);
  assert.match(styles,/\.pbody p[^}]*overflow-wrap:anywhere/);
});
