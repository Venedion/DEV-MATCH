const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {PGlite} = require('@electric-sql/pglite');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const ROOT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CHILD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NEW_ROOT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NEW_CHILD = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

test('chat visibility migration preserves thread writes, filters SELECT and rolls back additively', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;

      create table public.projects (
        id text primary key,
        project_kind text not null
      );
      create table public.conversations (
        id uuid primary key,
        participant_a_id uuid not null,
        participant_b_id uuid not null,
        merged_into uuid,
        is_active boolean not null default false
      );
      alter table public.conversations enable row level security;
      grant select on public.conversations to authenticated;
      grant all on public.conversations to service_role;
      create policy "Read own conversations" on public.conversations
        for select to authenticated
        using (auth.uid() in (participant_a_id, participant_b_id));

      create table public.messages (
        id uuid primary key default gen_random_uuid(),
        conversation_id uuid not null references public.conversations(id),
        sender_id uuid not null,
        ciphertext text not null,
        nonce text not null,
        key_version smallint not null,
        project_id text,
        read_at timestamptz
      );
      alter table public.messages enable row level security;
      grant select, insert, update on public.messages to authenticated;
      grant all on public.messages to service_role;
      create policy "Read conversation messages" on public.messages
        for select to authenticated
        using (exists (
          select 1 from public.conversations c
          where c.id = conversation_id
            and auth.uid() in (c.participant_a_id, c.participant_b_id)
        ));

      insert into public.projects(id, project_kind)
      values ('request-id', 'request'), ('portfolio-id', 'portfolio');
      insert into public.conversations(id, participant_a_id, participant_b_id, is_active)
      values
        ('${ROOT}', '${A}', '${B}', false),
        ('${CHILD}', '${A}', '${B}', true);
      update public.conversations set merged_into='${ROOT}' where id='${CHILD}';
      insert into public.messages(conversation_id, sender_id, ciphertext, nonce, key_version, project_id)
      values ('${CHILD}', '${B}', 'ciphertext', 'nonce', 1, 'request-id');
    `);

    const before = (await db.query('select count(*)::int as n from public.messages')).rows[0].n;
    const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261120192400_chat_visibility_and_project_context.sql'), 'utf8');
    await db.exec(migration);
    assert.equal((await db.query('select count(*)::int as n from public.messages')).rows[0].n, before);
    assert.equal((await db.query(`select project_kind from public.messages where conversation_id='${CHILD}'`)).rows[0].project_kind, 'request');

    await db.exec(`reset role; set role service_role;
      insert into public.conversations(id, participant_a_id, participant_b_id, is_active)
      values ('${NEW_ROOT}', '${A}', '${B}', false);
      insert into public.messages(conversation_id, sender_id, ciphertext, nonce, key_version)
      values ('${NEW_ROOT}', '${B}', 'first message', 'nonce', 1);
      insert into public.conversations(id, participant_a_id, participant_b_id, merged_into, is_active)
      values ('${NEW_CHILD}', '${A}', '${B}', '${NEW_ROOT}', false);
      insert into public.messages(conversation_id, sender_id, ciphertext, nonce, key_version)
      values ('${NEW_CHILD}', '${B}', 'merged source', 'nonce', 1);
    `);
    assert.equal((await db.query(`select is_active from public.conversations where id='${NEW_ROOT}'`)).rows[0].is_active, true);
    assert.equal((await db.query(`select is_active from public.conversations where id='${NEW_CHILD}'`)).rows[0].is_active, false);

    await db.exec(`reset role; set role authenticated;
      select set_config('request.jwt.claim.sub', '${A}', false);`);
    const visibleConversations = (await db.query('select id from public.conversations')).rows.map(row => row.id);
    assert.deepEqual(visibleConversations.sort(), [NEW_ROOT]);
    const visibleMessages = (await db.query('select conversation_id from public.messages')).rows.map(row => row.conversation_id);
    assert.deepEqual(visibleMessages, [NEW_ROOT]);
    await db.exec('reset role; set role service_role;');
    await db.exec(`update public.messages set read_at=now() where conversation_id='${CHILD}'`);
    assert.ok((await db.query(`select read_at from public.messages where conversation_id='${CHILD}'`)).rows[0].read_at);
    await assert.rejects(db.exec(`insert into public.messages(conversation_id,sender_id,ciphertext,nonce,key_version,project_kind)
      values ('${NEW_ROOT}','${A}','x','n',1,'unknown')`));

    await db.exec('reset role;');
    await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/rollback/20261120192400_chat_visibility_and_project_context.down.sql'), 'utf8'));
    assert.equal((await db.query('select count(*)::int as n from public.conversations')).rows[0].n, 4);
    assert.equal((await db.query(`select project_kind from public.messages where conversation_id='${CHILD}'`)).rows[0].project_kind, 'request');
    await db.exec(`set role authenticated;
      select set_config('request.jwt.claim.sub', '${A}', false);`);
    const restoredConversations = (await db.query('select id from public.conversations')).rows.map(row => row.id);
    assert.equal(restoredConversations.length, 4);
    assert(restoredConversations.includes(CHILD));
  } finally {
    await db.close();
  }
});
