const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {PGlite} = require('@electric-sql/pglite');

const migrationPath = path.join(__dirname, '../supabase/migrations/20261120192500_message_project_reference_fk.sql');
const rollbackPath = path.join(__dirname, '../supabase/migrations/rollback/20261120192500_message_project_reference_fk.down.sql');

test('message project FK clears the live ID but preserves the per-message reference', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create function auth.uid() returns uuid
        language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table public.projects (id text primary key);
      create table public.conversations (
        id uuid primary key,
        participant_a_id uuid not null,
        participant_b_id uuid not null
      );
      create table public.messages (
        id uuid primary key default gen_random_uuid(),
        conversation_id uuid not null references public.conversations(id),
        sender_id uuid not null,
        ciphertext text not null,
        nonce text not null,
        key_version smallint not null,
        project_id text,
        project_kind text
      );
      grant usage on schema public, auth to authenticated;
      grant execute on function auth.uid() to authenticated;
      grant select on public.conversations to authenticated;
      grant select, insert, update on public.messages to authenticated;
      grant all on public.messages to service_role;
      alter table public.messages enable row level security;
      create policy "Read conversation messages" on public.messages
        for select to authenticated
        using (
          exists (
            select 1 from public.conversations c
            where c.id = conversation_id
              and auth.uid() in (c.participant_a_id, c.participant_b_id)
          )
        );
      create policy "Create own conversation messages" on public.messages
        for insert to authenticated
        with check (
          sender_id = auth.uid()
          and exists (
            select 1 from public.conversations c
            where c.id = conversation_id
              and auth.uid() in (c.participant_a_id, c.participant_b_id)
          )
        );
      create policy "Update own conversation messages" on public.messages
        for update to authenticated
        using (sender_id = auth.uid())
        with check (sender_id = auth.uid());
      insert into public.projects(id) values ('project-live');
      insert into public.conversations(id, participant_a_id, participant_b_id)
      values (
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333'
      );
      insert into public.messages(conversation_id, sender_id, ciphertext, nonce, key_version, project_id)
      values
        ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'ciphertext', 'nonce', 1, 'project-live'),
        ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'ciphertext', 'nonce', 1, 'project-deleted-before-migration');
    `);

    await db.exec(fs.readFileSync(migrationPath, 'utf8'));
    const migrated = (await db.query(`
      select project_id, project_reference_id
      from public.messages
    `)).rows;
    const liveReference = migrated.find(row => row.project_reference_id === 'project-live');
    const deletedReference = migrated.find(row => row.project_reference_id === 'project-deleted-before-migration');
    assert.equal(liveReference.project_id, 'project-live');
    assert.equal(deletedReference.project_id, null);

    await db.exec(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
    `);
    const visibleReferences = (await db.query(`
      select project_reference_id
      from public.messages
      where project_reference_id='project-live'
    `)).rows;
    assert.equal(visibleReferences.length, 1);
    await assert.rejects(db.exec(`
      insert into public.messages(conversation_id, sender_id, ciphertext, nonce, key_version, project_id)
      values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'ciphertext', 'nonce', 1, 'project-live');
    `));
    await db.exec(`reset role`);

    await db.exec(`delete from public.projects where id='project-live'`);
    const deleted = (await db.query(`
      select project_id, project_reference_id
      from public.messages
      where project_reference_id='project-live'
    `)).rows[0];
    assert.equal(deleted.project_id, null);
    assert.equal(deleted.project_reference_id, 'project-live');

    await db.exec(`
      insert into public.projects(id) values ('project-new');
      insert into public.messages(conversation_id, sender_id, ciphertext, nonce, key_version, project_id)
      values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'ciphertext', 'nonce', 1, 'project-new');
    `);
    const inserted = (await db.query(`
      select project_reference_id
      from public.messages
      where project_id='project-new'
    `)).rows[0];
    assert.equal(inserted.project_reference_id, 'project-new');
    await db.exec(`
      update public.messages
      set project_reference_id='tampered-reference'
      where project_id='project-new'
    `);
    assert.equal((await db.query(`
      select project_reference_id
      from public.messages
      where project_id='project-new'
    `)).rows[0].project_reference_id, 'project-new');
    await assert.rejects(db.exec(`
      insert into public.messages(conversation_id, sender_id, ciphertext, nonce, key_version, project_id)
      values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'ciphertext', 'nonce', 1, 'missing-project');
    `));

    await db.exec(fs.readFileSync(rollbackPath, 'utf8'));
    const afterRollback = (await db.query(`
      select project_reference_id
      from public.messages
      where project_reference_id='project-live'
    `)).rows[0];
    assert.equal(afterRollback.project_reference_id, 'project-live');
  } finally {
    await db.close();
  }
});
