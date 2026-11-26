const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {test} = require('node:test');
const {PGlite} = require('@electric-sql/pglite');

const client1 = '11111111-1111-4111-8111-111111111111';
const developer1 = '22222222-2222-4222-8222-222222222222';
const client2 = '33333333-3333-4333-8333-333333333333';
const developer2 = '44444444-4444-4444-8444-444444444444';
const reporter = '55555555-5555-4555-8555-555555555555';
const moderator = '66666666-6666-4666-8666-666666666666';
const conversation1 = '77777777-7777-4777-8777-777777777777';
const conversation2 = '88888888-8888-4888-8888-888888888888';
const engagement1 = '99999999-9999-4999-8999-999999999999';
const agreement1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const agreement2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const agreement3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const agreement4 = 'dddddddd-dddd-4ddd-8ddd-ddddddddddde';

async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profiles (
      id uuid primary key,
      account_role text not null,
      display_name text not null,
      profile_data jsonb not null default '{}'::jsonb
    );
    create table public.projects (id text primary key);
    create table public.conversations (id uuid primary key);
    create table public.project_engagements (
      id uuid primary key, conversation_id uuid not null, project_id text,
      client_id uuid not null, developer_id uuid not null
    );
    create table public.project_reviews (
      id uuid primary key, engagement_id uuid not null, project_id text,
      reviewer_id uuid not null, reviewed_user_id uuid not null,
      reviewer_name text not null, reviewer_initials text not null,
      project_title text not null, rating smallint not null, text text not null,
      created_at timestamptz not null default now()
    );
    create table public.project_agreements (
      id uuid primary key, conversation_id uuid not null,
      developer_id uuid not null, client_id uuid not null,
      payment_status text not null default 'paid',
      created_at timestamptz not null default now()
    );
    create table public.payment_agreement_rooms (
      agreement_id uuid primary key, state jsonb not null, version integer not null default 1
    );
    create table public.payments (
      agreement_id uuid not null, kind text not null, status text not null
    );
    create table public.notifications (
      id uuid primary key default gen_random_uuid(),
      recipient_id uuid not null, actor_id uuid, kind text not null,
      project_id text, conversation_id uuid, created_at timestamptz not null default now()
    );
  `);
  const userIds = [client1, developer1, client2, developer2, reporter, moderator];
  await db.query('insert into auth.users (id) select unnest($1::uuid[])', [userIds]);
  await db.query(`insert into public.profiles (id, account_role, display_name) values
    ($1, 'client', 'Client One'), ($2, 'dev', 'Developer One'),
    ($3, 'client', 'Client Two'), ($4, 'dev', 'Developer Two'),
    ($5, 'client', 'Reporter'), ($6, 'dev', 'Moderator')`,
  [client1, developer1, client2, developer2, reporter, moderator]);
  await db.query('insert into public.conversations values ($1), ($2)', [conversation1, conversation2]);
  await db.query(`insert into public.project_engagements
    (id, conversation_id, project_id, client_id, developer_id)
    values ($1, $2, 'legacy-project', $3, $4)`,
  [engagement1, conversation1, client1, developer1]);
  await db.query(`insert into public.project_reviews
    (id, engagement_id, project_id, reviewer_id, reviewed_user_id, reviewer_name,
      reviewer_initials, project_title, rating, text)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', $1, 'legacy-project', $2, $3,
      'Client One', 'CO', 'Legacy work', 5, 'Legacy comment')`,
  [engagement1, client1, developer1]);

  const completedState = () => ({
    room: {
      timelineVersion: 2,
      project: 'COMPLETED',
      escrow: 'RELEASED',
      result: {acceptedAt: new Date().toISOString()},
      proposal: {name: 'Website', deadline: '2026-11-25'},
      handover: {at: '2026-11-24T12:00:00.000Z'}
    }
  });
  await db.query(`insert into public.project_agreements
    (id, conversation_id, client_id, developer_id, payment_status, created_at)
    values ($1, $2, $3, $4, 'paid', now() - interval '30 days')`,
  [agreement1, conversation1, client1, developer1]);
  await db.query('insert into public.payments values ($1, $2, $3), ($1, $4, $3)',
    [agreement1, 'dp', 'paid', 'remaining']);
  const initialState = completedState();
  initialState.room.ratings = {
    client: {rating: 5, text: 'Old profile review', at: new Date().toISOString()},
    developer: {rating: 4, text: 'Old agreement review', at: new Date().toISOString()}
  };
  await db.query('insert into public.payment_agreement_rooms (agreement_id, state) values ($1, $2)',
    [agreement1, JSON.stringify(initialState)]);

  const migration = readFileSync(join(__dirname,
    '../supabase/migrations/202611280001_agreement_rating_system.sql'), 'utf8');
  await db.exec(migration);

  const insertAgreement = async (id, conversationId, clientId, developerId, {
    state = completedState(), remainingStatus = 'paid'
  } = {}) => {
    await db.query(`insert into public.project_agreements
      (id, conversation_id, client_id, developer_id, payment_status)
      values ($1, $2, $3, $4, 'paid')`,
    [id, conversationId, clientId, developerId]);
    await db.query('insert into public.payments values ($1, $2, $3), ($1, $4, $5)',
      [id, 'dp', 'paid', 'remaining', remainingStatus]);
    await db.query('insert into public.payment_agreement_rooms (agreement_id, state) values ($1, $2)',
      [id, JSON.stringify(state)]);
  };
  await insertAgreement(agreement2, conversation2, client2, developer2);

  const setUser = userId => db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  return {db, insertAgreement, setUser, completedState};
}

test('legacy reviews migrate without invented criteria and cannot be duplicated by an agreement review', async t => {
  const {db, setUser} = await fixture(t);
  const {rows: imported} = await db.query(`select source, legacy_rating, quality_of_work, agreement_id
    from public.agreement_reviews where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'`);
  assert.deepEqual(imported[0], {
    source: 'legacy',
    legacy_rating: 5,
    quality_of_work: null,
    agreement_id: agreement1
  });
  const {rows: summary} = await db.query(
    "select * from public.get_public_rating_summary($1, 'developer')", [developer1]);
  assert.equal(Number(summary[0].review_count), 1);
  assert.equal(Number(summary[0].overall_rating), 5);
  assert.equal(summary[0].quality_of_work, null);
  const {rows: migratedAgreementRatings} = await db.query(`select reviewer_role, legacy_rating, comment
    from public.agreement_reviews where agreement_id = $1 order by reviewer_role`,
  [agreement1]);
  assert.deepEqual(migratedAgreementRatings, [
    {reviewer_role: 'client', legacy_rating: 5, comment: 'Legacy comment'},
    {reviewer_role: 'developer', legacy_rating: 4, comment: 'Old agreement review'}
  ]);
  const {rows: clientSummary} = await db.query(
    "select * from public.get_public_rating_summary($1, 'client')", [client1]);
  assert.equal(Number(clientSummary[0].overall_rating), 4);
  await setUser(client1);
  const {rows: state} = await db.query(
    'select public.get_my_agreement_review_state($1) as data', [agreement1]);
  assert.equal(state[0].data.canReview, false);
  assert.equal(state[0].data.hasSubmitted, true);
  await assert.rejects(db.query(`select public.submit_agreement_review($1, $2::jsonb, '')`,
    [agreement1, JSON.stringify({qualityOfWork: 4, communication: 4, meetingDeadline: 4})]),
  /legacy review already exists/i);
});

test('agreement reviews stay private until mutual submission, then aggregate and support replies, reports, and moderation', async t => {
  const {db, setUser, insertAgreement} = await fixture(t);
  const inProgressId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const incompleteState = {
    room: {timelineVersion: 2, project: 'IN_PROGRESS', escrow: 'RELEASED'}
  };
  await insertAgreement(inProgressId, conversation2, client2, developer2, {state: incompleteState});
  await setUser(client2);
  const {rows: inProgressState} = await db.query(
    'select public.get_my_agreement_review_state($1) as data', [inProgressId]);
  assert.equal(inProgressState[0].data.canReview, false);
  await assert.rejects(db.query('select public.submit_agreement_review($1, $2::jsonb, $3)', [
    inProgressId, JSON.stringify({qualityOfWork: 5, communication: 5, meetingDeadline: 5}), ''
  ]), /completed, paid agreements/i);

  await setUser(client2);
  const {rows: initialState} = await db.query(
    'select public.get_my_agreement_review_state($1) as data', [agreement2]);
  assert.equal(initialState[0].data.canReview, true);
  const clientReview = {qualityOfWork: 5, communication: 4, meetingDeadline: 3};
  await db.query('select public.submit_agreement_review($1, $2::jsonb, $3)', [
    agreement2, JSON.stringify(clientReview), 'Well delivered'
  ]);
  const {rows: hidden} = await db.query(
    'select status from public.agreement_reviews where agreement_id = $1', [agreement2]);
  assert.deepEqual(hidden.map(row => row.status), ['hidden']);
  const {rows: hiddenProfile} = await db.query(
    "select * from public.get_profile_reviews($1, 'developer')", [developer2]);
  assert.equal(hiddenProfile.length, 0);
  const {rows: hiddenSummary} = await db.query(
    "select * from public.get_public_rating_summary($1, 'developer')", [developer2]);
  assert.equal(hiddenSummary.length, 0);
  const {rows: privateEvents} = await db.query(
    'select event, count(*)::int as count from public.agreement_review_notification_events where agreement_id=$1 group by event',
    [agreement2]);
  assert.equal(privateEvents.find(row => row.event === 'opened').count, 2);
  assert.equal(privateEvents.some(row => row.event === 'published'), false);

  await setUser(developer2);
  const developerReview = {clarityOfBrief: 3, responsiveness: 4, respectingScope: 5};
  await db.query('select public.submit_agreement_review($1, $2::jsonb, $3)', [
    agreement2, JSON.stringify(developerReview), ''
  ]);
  const {rows: published} = await db.query(
    'select status, delivery_badge from public.agreement_reviews where agreement_id = $1 order by reviewer_role',
    [agreement2]);
  assert.equal(published.length, 2);
  assert.ok(published.every(row => row.status === 'published'));
  assert.ok(published.some(row => row.delivery_badge === 'Delivered on time'));
  const {rows: publishedEvents} = await db.query(
    'select count(*)::int as count from public.agreement_review_notification_events where agreement_id=$1 and event=$2',
    [agreement2, 'published']);
  assert.equal(publishedEvents[0].count, 2);
  const {rows: summary} = await db.query(
    "select * from public.get_public_rating_summary($1, 'developer')", [developer2]);
  assert.equal(Number(summary[0].review_count), 1);
  assert.equal(Number(summary[0].overall_rating), 4);
  assert.equal(Number(summary[0].adjusted_rating), 4);
  assert.equal(Number(summary[0].quality_of_work), 5);
  const {rows: reviews} = await db.query(
    "select rating, quality_of_work, reply, source from public.get_profile_reviews($1, 'developer')",
    [developer2]);
  assert.equal(reviews.length, 1);
  assert.equal(Number(reviews[0].rating), 4);
  assert.equal(reviews[0].source, 'agreement');
  const {rows: clientReviews} = await db.query(
    "select rating, clarity_of_brief from public.get_profile_reviews($1, 'client')",
    [client2]);
  assert.equal(Number(clientReviews[0].rating), 4);
  assert.equal(clientReviews[0].clarity_of_brief, 3);

  await setUser(client2);
  await assert.rejects(db.query('select public.submit_agreement_review($1, $2::jsonb, $3)', [
    agreement2, JSON.stringify(clientReview), ''
  ]), /unique|duplicate/i);
  const {rows: replyTarget} = await db.query(
    'select id from public.agreement_reviews where agreement_id = $1 and reviewee_id = $2',
    [agreement2, developer2]);
  await setUser(developer2);
  await db.query('select public.add_agreement_review_reply($1, $2)', [replyTarget[0].id, 'Thank you']);
  const {rows: replied} = await db.query(
    "select reply from public.get_profile_reviews($1, 'developer')", [developer2]);
  assert.equal(replied[0].reply, 'Thank you');

  await setUser(reporter);
  await db.query('select public.report_agreement_review($1, $2)', [replyTarget[0].id, 'Contains personal data']);
  await db.query('insert into public.agreement_review_moderators (user_id) values ($1)', [moderator]);
  await setUser(moderator);
  const {rows: reports} = await db.query('select * from public.get_agreement_review_reports()');
  assert.equal(reports.length, 1);
  await db.query('select public.moderate_agreement_review($1, $2)', [replyTarget[0].id, 'hide']);
  const {rows: hiddenAfterModeration} = await db.query(
    "select * from public.get_public_rating_summary($1, 'developer')", [developer2]);
  assert.equal(hiddenAfterModeration.length, 0);

  await insertAgreement(agreement3, conversation2, client2, developer2);
  await setUser(client2);
  await db.query('select public.submit_agreement_review($1, $2::jsonb, $3)', [
    agreement3, JSON.stringify(clientReview), ''
  ]);
  await db.query(`update public.agreement_review_windows
    set opens_at = now() - interval '12 days', closes_at = now() + interval '2 days'
    where agreement_id = $1`, [agreement3]);
  await db.query('select public.process_due_agreement_reviews(now())');
  const {rows: reminders} = await db.query(
    'select recipient_id from public.agreement_review_notification_events where agreement_id=$1 and event=$2',
    [agreement3, 'reminder']);
  assert.deepEqual(reminders.map(row => row.recipient_id), [developer2]);
  await db.query(`update public.agreement_review_windows
    set opens_at = now() - interval '14 days', closes_at = now()
    where agreement_id = $1`, [agreement3]);
  const {rows: publishedCount} = await db.query(
    'select public.process_due_agreement_reviews(now()) as count');
  assert.equal(Number(publishedCount[0].count), 1);
  const {rows: expiredReview} = await db.query(
    'select status from public.agreement_reviews where agreement_id = $1', [agreement3]);
  assert.equal(expiredReview[0].status, 'published');

  const resolvedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  await insertAgreement(agreement4, conversation2, client2, developer2, {
    state: {
      room: {
        timelineVersion: 2,
        project: 'DISPUTE_RESOLVED',
        escrow: 'RELEASED',
        result: {acceptedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()},
        dispute: {status: 'RESOLVED', resolvedAt}
      }
    }
  });
  const {rows: disputeWindow} = await db.query(
    'select opens_at, closes_at from public.agreement_review_windows where agreement_id = $1',
    [agreement4]);
  assert.equal(new Date(disputeWindow[0].opens_at).getTime(), new Date(resolvedAt).getTime());
  assert.equal(new Date(disputeWindow[0].closes_at).getTime(),
    new Date(resolvedAt).getTime() + 14 * 24 * 60 * 60 * 1000);
});
