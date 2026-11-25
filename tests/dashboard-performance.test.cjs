const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {test} = require('node:test');
const {PGlite} = require('@electric-sql/pglite');

const developer = '11111111-1111-4111-8111-111111111111';
const otherDeveloper = '22222222-2222-4222-8222-222222222222';
const client = '33333333-3333-4333-8333-333333333333';

test('project performance filters views and favorites, ranks owned projects, and broadcasts privately', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema realtime;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid', true), '')::uuid
    $$;
    create function public.has_account_workspace(role text) returns boolean language sql stable as $$
      select role = 'dev' and auth.uid() in ('${developer}', '${otherDeveloper}')
    $$;
    create table realtime.messages(topic text, event text, private boolean);
    create function realtime.topic() returns text language sql stable as $$ select current_setting('test.topic', true) $$;
    create function realtime.send(jsonb, text, text, boolean) returns void language sql as $$
      insert into realtime.messages values ($3, $2, $4)
    $$;
    alter table realtime.messages enable row level security;
    grant usage on schema auth, realtime to authenticated;
    grant select on realtime.messages to authenticated;
    create table public.projects (id text primary key, owner_id uuid not null, project_kind text, title text, project_type text, cover_image text);
    create table public.project_views (project_id text, viewer_id uuid, viewed_on date);
    create table public.favorites (item_id text, item_type text, created_at timestamptz);
  `);
  const migration = join(__dirname, '../supabase/migrations/20261125130000_developer_project_performance.sql');
  await db.exec(readFileSync(migration, 'utf8'));
  await db.exec(`
    insert into public.projects values ('a','${developer}','portfolio','Website','Website','https://example.test/a.png'),
      ('b','${developer}','portfolio','App','Web App',null), ('c','${otherDeveloper}','portfolio','Other','Website',null),
      ('req','${developer}','request','Request','Website',null);
    insert into public.project_views values
      ('a','${client}','2026-10-09'), ('a','${client}','2026-10-10'), ('a','${client}','2026-10-11'),
      ('b','${client}','2026-10-12'), ('b','${client}','2026-10-13'),
      ('c','${client}','2026-10-10'), ('req','${client}','2026-10-10');
    insert into public.favorites values ('a','project','2026-10-10T01:00:00Z'), ('b','project','2026-10-12T23:59:59Z'),
      ('b','project','2026-10-13T00:00:00Z'), ('a','developer','2026-10-11T00:00:00Z');
    set role authenticated;
  `);
  await db.query("select set_config('test.uid',$1,false), set_config('test.topic',$2,false)",
    [developer, `devmatch-project-performance:${developer}`]);
  const {rows: [{data}]} = await db.query("select public.get_developer_project_performance('2026-10-10','2026-10-12') data");
  assert.equal(data.views, 3);
  assert.equal(data.previous_views, 1);
  assert.deepEqual(data.series.map(row => [row.start_date, row.views, row.favorites]),
    [['2026-10-10', 1, 1], ['2026-10-11', 1, 0], ['2026-10-12', 1, 1]]);
  assert.deepEqual(data.ranking.map(row => [row.title, row.project_type, row.views]), [['Website', 'Website', 2], ['App', 'Web App', 1]]);
  const lifetime = (await db.query('select public.get_developer_project_performance(null,null) data')).rows[0].data;
  assert.equal(lifetime.views, 5);
  assert.equal(lifetime.previous_views, null);
  assert.ok(lifetime.series.length <= 31);
  const messages = (await db.query('select topic,event,private from realtime.messages')).rows;
  assert.equal(messages.length, 10);
  assert.ok(messages.every(row => row.topic.endsWith(developer) && row.event === 'refresh' && row.private));
  await db.query("select set_config('test.topic',$1,false)", [`devmatch-project-performance:${otherDeveloper}`]);
  assert.equal((await db.query('select * from realtime.messages')).rows.length, 0);
  await assert.rejects(db.query("select public.get_developer_project_performance('2026-10-10', null)"), {code: '22023'});
  await db.query("select set_config('test.uid',$1,false)", [client]);
  await assert.rejects(db.query('select public.get_developer_project_performance(null,null)'), {code: '42501'});
});
