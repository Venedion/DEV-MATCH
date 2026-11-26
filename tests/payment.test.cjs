const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {test} = require('node:test');
const {PGlite} = require('@electric-sql/pglite');

const conversationId = '11111111-1111-4111-8111-111111111111';
const developer = '22222222-2222-4222-8222-222222222222';
const client = '33333333-3333-4333-8333-333333333333';
const reviewer = '44444444-4444-4444-8444-444444444444';
const stranger = '55555555-5555-4555-8555-555555555555';
const projectId = 'test-project';
const agreementId = '66666666-6666-4666-8666-666666666666';
const proposalId = '77777777-7777-4777-8777-777777777777';
const proposal = {
  name: 'Website', description: 'Test', scope: 'UI', deliverables: 'Code',
  revisions: 'One', duration: 'Two weeks', total: 100001, dpPercent: 25
};

async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets (
      id text primary key, name text not null, public boolean not null,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (bucket_id text not null, name text not null);
    create function storage.foldername(text) returns text[] language sql immutable
      as $$ select array['agreement', 'user']::text[] $$;
    create table public.projects (id text primary key, owner_id uuid not null, project_kind text not null, title text not null);
    create table public.conversations (id uuid primary key, project_id text, participant_a_id uuid not null,
      participant_b_id uuid not null, participant_a_role text not null, participant_b_role text not null,
      merged_into uuid, created_at timestamptz default now());
    create table public.messages (conversation_id uuid, project_id text, project_reference_id text);
    create table public.project_proposals (id uuid primary key, status text not null);
    create table public.project_agreements (id uuid primary key, proposal_id uuid not null,
      conversation_id uuid not null, developer_id uuid not null, client_id uuid not null,
      terms jsonb not null, total_price numeric(16, 0) not null, dp_amount numeric(16, 0) not null,
      payment_status text not null default 'pending', created_at timestamptz default now());
  `);
  const path = join(__dirname, '../supabase/migrations/20261124120000_midtrans_sandbox_payments.sql');
  await db.exec(readFileSync(path, 'utf8'));
  await db.exec(readFileSync(join(__dirname, '../supabase/migrations/20261125140000_payment_room_chat_context.sql'), 'utf8'));
  await db.exec(readFileSync(join(__dirname, '../supabase/migrations/202611260001_proposal_agreement_payments.sql'), 'utf8'));
  await db.exec(readFileSync(join(__dirname, '../supabase/migrations/202611260002_project_payment_timeline.sql'), 'utf8'));
  await db.exec(readFileSync(join(__dirname, '../supabase/migrations/202611260005_agreement_progress_uploads.sql'), 'utf8'));
  await db.query('insert into auth.users values ($1), ($2), ($3)', [developer, client, reviewer]);
  await db.query("insert into public.projects values ($1, $2, 'portfolio', 'Project')", [projectId, developer]);
  await db.query(`insert into public.conversations
    (id, project_id, participant_a_id, participant_b_id, participant_a_role, participant_b_role)
    values ($1, $2, $3, $4, 'dev', 'client')`,
    [conversationId, projectId, developer, client]);
  await db.query('insert into public.payment_dispute_reviewers values ($1, $2, $3)', [conversationId, projectId, reviewer]);
  const row = async (sql, args) => (await db.query(sql, args)).rows[0];
  const args = ref => [ref.conversationId, ref.projectId];
  const store = {
    context: async (user, ref) => ref.agreementId
      ? (await row('select public.payment_agreement_context($1, $2) as data', [user, ref.agreementId])).data
      : (await row('select public.payment_room_context($1, $2, $3) as data', [user, ...args(ref)])).data,
    reviewerRooms: async user => {
      const projects = (await row('select public.payment_reviewer_rooms($1) as data', [user])).data;
      const agreements = (await row('select public.payment_agreement_review_rooms($1) as data', [user])).data;
      return [...projects, ...agreements];
    },
    save: async (ref, version, state, orderId = null) => ref.agreementId
      ? (await row('select public.payment_agreement_save($1, $2, $3, $4) as saved',
        [ref.agreementId, version, JSON.stringify(state), orderId])).saved
      : (await row('select public.payment_save_room($1, $2, $3, $4, $5) as saved',
        [...args(ref), version, JSON.stringify(state), orderId])).saved,
    processDue: async ref => (await row(
      'select public.payment_process_due_agreements($1, $2) as processed',
      [ref.agreementId, new Date().toISOString()]
    )).processed,
    state: async ref => ref.agreementId
      ? await row('select version, state from public.payment_agreement_rooms where agreement_id=$1',
        [ref.agreementId]) || {version: 0, state: null}
      : await row('select version, state from public.payment_rooms where conversation_id=$1 and project_id=$2',
        args(ref)) || {version: 0, state: null},
    orderRef: async orderId => await row(
      'select agreement_id from public.payment_agreement_order_refs where order_id=$1', [orderId])
      .then(agreement => agreement && ({agreementId: agreement.agreement_id}))
      || row('select conversation_id as "conversationId", project_id as "projectId" from public.payment_order_refs where order_id=$1',
        [orderId])
  };
  const {sandboxGateway} = await import('../supabase/functions/payment-api/midtrans.mjs');
  const {paymentService} = await import('../supabase/functions/payment-api/service.mjs');
  const key = 'SB-Mid-server-fixture';
  const orders = new Map();
  const gateway = sandboxGateway({serverKey: key, clientKey: 'SB-Mid-client-fixture', returnOrigin: 'https://devm4tch.vercel.app',
    request: async (url, options) => {
      assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from(key + ':').toString('base64'));
      if (options.method === 'POST') {
        const {transaction_details, callbacks, expiry, page_expiry} = JSON.parse(options.body);
        assert.deepEqual(page_expiry, {duration: 10, unit: 'minute'});
        assert.equal(expiry.duration, 10);
        assert.equal(expiry.unit, 'minute');
        assert.match(expiry.start_time, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d \+0700$/);
        const {order_id, gross_amount} = transaction_details;
        const finish = new URL(callbacks.finish);
        assert.equal(finish.origin, 'https://devm4tch.vercel.app');
        assert.equal(finish.searchParams.get('conversation'), conversationId);
        if (finish.searchParams.get('paymentAgreement')) {
          assert.equal(finish.searchParams.get('paymentAgreement'), agreementId);
          assert.equal(finish.searchParams.has('paymentProject'), false);
        } else {
          assert.equal(finish.searchParams.get('paymentProject'), projectId);
        }
        assert.ok(!orders.has(order_id), 'order must be created once');
        orders.set(order_id, {order_id, gross_amount: gross_amount + '.00'});
        return Response.json({token: order_id, redirect_url: 'https://app.sandbox.midtrans.com/snap/v3/redirection/' + order_id});
      }
      const id = new URL(url).pathname.split('/')[2];
      const order = orders.get(id);
      return order?.transaction_status ? Response.json(order) : Response.json({}, {status: 404});
    }});
  const service = paymentService(store, gateway);
  const handle = (user, operation, body) => service.handle(user, {conversationId, projectId, operation, ...body});
  const apply = (user, action, fields) => handle(user, 'apply', {action, ...fields});
  const event = (order, extra) => {
    const notification = {transaction_id: 'provider-test-id', status_code: '200', ...order, ...extra};
    notification.signature_key = createHash('sha512').update(
      notification.order_id + notification.status_code + notification.gross_amount + key).digest('hex');
    return notification;
  };
  return {db, store, handle, apply, service, orders, event};
}

test('Supabase room participants and reviewers have isolated payment permissions', async t => {
  const {db, handle, apply} = await fixture(t);
  assert.equal((await handle(developer, 'snapshot')).role, 'developer');
  assert.equal((await handle(client, 'snapshot')).role, 'client');
  await assert.rejects(handle(stranger, 'snapshot'), {status: 403});
  await assert.rejects(apply(client, 'propose', proposal), {status: 403});
  await assert.rejects(handle(developer, 'checkout', {kind: 'DP', role: 'client'}), {status: 400});
  await assert.rejects(handle(developer, 'checkout', {kind: 'DP'}), {status: 403});
  await apply(developer, 'propose', proposal);
  await apply(client, 'accept');
  await apply(client, 'dispute', {reason: 'Needs review'});
  assert.deepEqual(await handle(stranger, 'reviews'), []);
  assert.equal((await handle(reviewer, 'reviews'))[0].conversationId, conversationId);
  await assert.rejects(apply(client, 'resolve-dispute', {}), {status: 403});
  assert.equal((await apply(reviewer, 'resolve-dispute', {outcome: 'FULL_REFUND', decision: 'Cancel'})).room.project, 'CANCELLED');
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select state from public.payment_rooms'), {code: '42501'});
  await assert.rejects(db.query('select public.payment_room_context($1, $2, $3)', [client, conversationId, projectId]), {code: '42501'});
});

test('a project reference on a grouped chat shares one payment room across both participants', async t => {
  const {db, service, handle, apply} = await fixture(t);
  const alias = '66666666-6666-4666-8666-666666666666';
  await db.query('update public.conversations set project_id=null where id=$1', [conversationId]);
  await db.query(`insert into public.conversations
    (id, participant_a_id, participant_b_id, participant_a_role, participant_b_role, merged_into)
    values ($1,$2,$3,'client','dev',$4)`, [alias, client, developer, conversationId]);
  await assert.rejects(apply(developer, 'propose', proposal), {status: 403});
  await db.query('insert into public.messages (conversation_id, project_reference_id) values ($1, $2)', [alias, projectId]);
  await service.handle(developer, {operation: 'apply', action: 'propose', conversationId: alias, projectId, ...proposal});
  assert.equal((await handle(client, 'snapshot')).room.proposal.name, proposal.name);
  assert.equal((await db.query('select conversation_id from public.payment_rooms')).rows[0].conversation_id, conversationId);
});

test('Expired Snap sessions can be retried while a pending payment keeps its order', async t => {
  const {handle, apply, store, orders} = await fixture(t);
  await apply(developer, 'propose', proposal);
  await apply(client, 'accept');
  const first = await handle(client, 'checkout', {kind: 'DP'});
  const ref = {conversationId, projectId};
  const expired = await store.state(ref);
  const firstOrder = expired.state.payments[0];
  assert.equal(firstOrder.snapExpiresAt - firstOrder.snapCreatedAt, 10 * 60_000);
  firstOrder.snapCreatedAt = Date.now() - 11 * 60_000;
  firstOrder.snapExpiresAt = firstOrder.snapCreatedAt + 10 * 60_000;
  assert.ok(await store.save(ref, expired.version, expired.state));
  const second = await handle(client, 'checkout', {kind: 'DP'});
  assert.notEqual(second.token, first.token);
  assert.equal((await handle(client, 'snapshot')).payments[0].status, 'EXPIRED');

  const legacy = await store.state(ref);
  const legacyOrder = legacy.state.payments[1];
  legacyOrder.snapCreatedAt = Date.now() - 11 * 60_000;
  delete legacyOrder.snapExpiresAt;
  delete legacyOrder.snapToken;
  assert.ok(await store.save(ref, legacy.version, legacy.state));
  assert.equal((await handle(client, 'checkout', {kind: 'DP'})).token, second.token);

  orders.get(second.token).transaction_status = 'pending';
  assert.equal((await handle(client, 'checkout', {kind: 'DP'})).token, second.token);

  orders.get(second.token).transaction_status = 'expire';
  const refreshed = await handle(client, 'refresh');
  assert.deepEqual(refreshed.payments.map(order => order.status), ['EXPIRED', 'EXPIRED']);
  const retry = await handle(client, 'checkout', {kind: 'DP'});
  assert.equal(orders.size, 3);
  assert.notEqual(retry.token, second.token);
  assert.equal(orders.get(retry.token).gross_amount, orders.get(first.token).gross_amount);
});

test('Snap checkout verifies authoritative status and records ledger once on concurrent webhook delivery', async t => {
  const {handle, apply, service, orders, event} = await fixture(t);
  await apply(developer, 'propose', proposal);
  await apply(client, 'accept');
  await assert.rejects(handle(client, 'checkout', {kind: 'REMAINING'}), {status: 409});
  const checkouts = await Promise.allSettled([handle(client, 'checkout', {kind: 'DP', amount: 1}), handle(client, 'checkout', {kind: 'DP'})]);
  assert.ok(checkouts.some(result => result.status === 'fulfilled'));
  assert.equal(orders.size, 1);
  const checkout = await handle(client, 'checkout', {kind: 'DP'});
  const [dp] = orders.values();
  assert.match(checkout.redirectUrl, /app\.sandbox\.midtrans\.com/);
  assert.equal(checkout.token, dp.order_id);
  assert.equal(checkout.clientKey, 'SB-Mid-client-fixture');
  assert.equal(dp.gross_amount, '25001.00');
  await assert.rejects(service.webhook({...event(dp), signature_key: '0'.repeat(128)}), {status: 401});
  Object.assign(dp, {transaction_status: 'pending'});
  await assert.rejects(service.webhook(event(dp, {gross_amount: '1.00'})), {status: 422});
  await service.webhook(event(dp, {transaction_status: 'settlement'}));
  assert.equal((await handle(client, 'snapshot')).payments[0].status, 'PROCESSING');
  dp.transaction_status = 'settlement';
  await Promise.all([service.webhook(event(dp)), service.webhook(event(dp))]);
  const downPayment = await handle(developer, 'snapshot');
  assert.equal(downPayment.room.project, 'IN_PROGRESS');
  assert.deepEqual(downPayment.ledger.map(entry => entry.entry), ['DP_HELD']);
  assert.equal(downPayment.payments[0].checkoutUrl, undefined);
  assert.equal(downPayment.payments[0].snapToken, undefined);

  await handle(client, 'checkout', {kind: 'REMAINING'});
  const balance = [...orders.values()][1];
  assert.equal(balance.gross_amount, '75000.00');
  Object.assign(balance, {transaction_status: 'capture', fraud_status: 'challenge'});
  assert.equal((await handle(client, 'refresh')).payments[1].status, 'PROCESSING');
  balance.fraud_status = 'accept';
  await handle(client, 'refresh');
  await apply(developer, 'deliver', {links: 'https://example.test/delivery', notes: 'Final'});
  await assert.rejects(apply(client, 'approve'), {status: 409});
  await apply(developer, 'verify-payout');
  await apply(client, 'approve');
  const finish = await apply(developer, 'complete-payout');
  assert.equal(finish.room.project, 'COMPLETED');
  assert.deepEqual(finish.ledger.map(entry => entry.entry), ['DP_HELD', 'FULL_PAYMENT_HELD', 'RELEASE_PENDING', 'RELEASED']);
});

test('accepted project agreements use the proposal terms for sandbox payments and project completion', async t => {
  const {db, service, orders, event} = await fixture(t);
  const terms = {
    projectName: 'Proposal flow', description: 'Agreement-backed project', totalPrice: 100000,
    dpPercent: 25, dpAmount: 25000, remainingAmount: 75000, deadline: '2027-01-15',
    scope: ['Design the interface', 'Deliver the source'], revisionCount: 1, revisionNotes: 'One revision round'
  };
  await db.query("insert into public.project_proposals (id,status) values ($1,'accepted')", [proposalId]);
  await db.query(`insert into public.project_agreements
    (id,proposal_id,conversation_id,developer_id,client_id,terms,total_price,dp_amount)
    values ($1,$2,$3,$4,$5,$6,$7,$8)`,
  [agreementId, proposalId, conversationId, developer, client,
    JSON.stringify({terms, attachments: []}), terms.totalPrice, terms.dpAmount]);
  await db.query('insert into public.payment_agreement_dispute_reviewers values ($1,$2)', [agreementId, reviewer]);
  const handle = (user, operation, body = {}) =>
    service.handle(user, {agreementId, operation, ...body});
  const apply = (user, action, fields = {}) => handle(user, 'apply', {action, ...fields});

  assert.equal((await handle(client, 'snapshot')).room.proposal.agreementId, agreementId);
  assert.equal((await handle(developer, 'snapshot')).role, 'developer');
  await assert.rejects(handle(stranger, 'snapshot'), {status: 403});
  await assert.rejects(handle(developer, 'checkout', {kind: 'DP'}), {status: 403});

  const checkout = await handle(client, 'checkout', {kind: 'DP'});
  assert.match(checkout.redirectUrl, /app\.sandbox\.midtrans\.com/);
  const [dpOrder] = orders.values();
  assert.equal(dpOrder.gross_amount, '25000.00');
  assert.equal((await handle(client, 'checkout', {kind: 'DP'})).redirectUrl, checkout.redirectUrl);
  await assert.rejects(handle(client, 'checkout', {kind: 'REMAINING'}), {status: 409});
  dpOrder.transaction_status = 'settlement';
  await service.webhook(event(dpOrder));
  const dpPaid = await handle(developer, 'snapshot');
  assert.equal(dpPaid.room.project, 'IN_PROGRESS');
  assert.equal(dpPaid.room.timeline.dpPaidAt, dpPaid.payments[0].paid_at);
  const progressVideo = {
    path: `${agreementId}/${developer}/video.mp4`,
    name: 'progress.mp4',
    type: 'video/mp4',
    size: 1024,
    durationSeconds: 90
  };
  const progressScreenshot = {
    path: `${agreementId}/${developer}/screen.png`,
    name: 'screen.png',
    type: 'image/png',
    size: 512
  };
  await assert.rejects(apply(developer, 'progress', {
    video: {...progressVideo, path: `${agreementId}/${client}/video.mp4`},
    notes: 'Initial work is ready for review.',
    scope: [terms.scope[0]]
  }), {status: 400});
  await assert.rejects(apply(developer, 'progress', {
    video: {...progressVideo, durationSeconds: 301},
    notes: 'Initial work is ready for review.',
    scope: [terms.scope[0]]
  }), {status: 400});
  await apply(developer, 'progress', {
    video: progressVideo,
    screenshots: [progressScreenshot],
    notes: 'Initial work is ready for review.',
    scope: [terms.scope[0]]
  });
  const progressSubmitted = await handle(client, 'snapshot');
  assert.equal(progressSubmitted.room.project, 'AWAITING_PROGRESS_REVIEW');
  assert.equal(progressSubmitted.room.progressReview.status, 'PENDING');
  assert.equal(progressSubmitted.room.progress[0].video.path, progressVideo.path);
  assert.deepEqual(progressSubmitted.room.progress[0].scope, [terms.scope[0]]);
  assert.equal(progressSubmitted.room.progress[0].screenshots[0].name, progressScreenshot.name);
  await assert.rejects(apply(developer, 'progress', {
    title: 'Second milestone',
    notes: 'This stage has already been submitted.'
  }), {status: 409});
  const requestedUpdate = await apply(client, 'request-progress-update', {
    reason: 'Please include the source code section in the walkthrough.'
  });
  assert.equal(requestedUpdate.room.progressReview.status, 'UPDATE_REQUESTED');
  assert.equal(requestedUpdate.room.progressReview.requestReason,
    'Please include the source code section in the walkthrough.');
  assert.equal(requestedUpdate.room.project, 'IN_PROGRESS');
  assert.equal(requestedUpdate.room.escrow, 'DP_HELD');
  assert.equal(requestedUpdate.room.timeline.progressSubmittedAt, null);
  await assert.rejects(apply(client, 'request-progress-update', {reason: 'Another update.'}), {status: 409});
  await apply(developer, 'progress', {
    video: {...progressVideo, path: `${agreementId}/${developer}/progress-updated.mp4`},
    notes: 'Added the requested source code section.',
    scope: [terms.scope[0], terms.scope[1]]
  });
  const progressResubmitted = await handle(client, 'snapshot');
  assert.equal(progressResubmitted.room.project, 'AWAITING_PROGRESS_REVIEW');
  assert.equal(progressResubmitted.room.progressReview.status, 'PENDING');
  assert.equal(progressResubmitted.room.progress.length, 2);
  assert.deepEqual(progressResubmitted.room.progress[1].scope, terms.scope);
  await assert.rejects(handle(client, 'checkout', {kind: 'REMAINING'}), {status: 409});
  await apply(client, 'approve-progress');
  const progressApproved = await handle(developer, 'snapshot');
  assert.equal(progressApproved.room.escrow, 'DP_RELEASED');
  assert.equal(progressApproved.room.timeline.dpReleasedAt, progressApproved.room.timeline.progressApprovedAt);
  await assert.rejects(handle(client, 'checkout', {kind: 'REMAINING'}), {status: 409});

  await apply(developer, 'deliver', {links: 'https://example.test/finish', notes: 'Final video shared.'});
  const balanceCheckout = await handle(client, 'checkout', {kind: 'REMAINING'});
  const balanceOrder = [...orders.values()][1];
  assert.equal(balanceOrder.gross_amount, '75000.00');
  assert.match(balanceCheckout.redirectUrl, /app\.sandbox\.midtrans\.com/);
  balanceOrder.transaction_status = 'settlement';
  await service.webhook(event(balanceOrder));
  const remainingPaid = await handle(developer, 'snapshot');
  assert.equal(remainingPaid.room.escrow, 'REMAINING_HELD');
  assert.ok(remainingPaid.room.timeline.remainingPaidAt);
  await apply(developer, 'handover', {notes: 'System credentials and source delivered.'});
  const handedOver = await handle(client, 'snapshot');
  assert.equal(handedOver.room.handover.status, 'AWAITING_CLIENT');
  await apply(client, 'accept-result');
  const completed = await handle(developer, 'snapshot');
  assert.equal(completed.room.project, 'COMPLETED');
  assert.equal(completed.room.escrow, 'RELEASED');
  assert.deepEqual(completed.room.releases.map(release => release.kind), ['DP', 'REMAINING']);
  assert.deepEqual(completed.ledger.map(entry => entry.entry),
    ['DP_HELD', 'DP_RELEASED', 'REMAINING_HELD', 'REMAINING_RELEASED']);
  await apply(client, 'rate', {rating: 5, text: 'Great work.'});
  await assert.rejects(apply(client, 'rate', {rating: 4}), {status: 409});
  await apply(developer, 'rate', {rating: 5, text: 'Great collaboration.'});
  const rated = await handle(client, 'snapshot');
  assert.ok(rated.room.timeline.ratings.clientAt);
  assert.ok(rated.room.timeline.ratings.developerAt);
  assert.deepEqual(await handle(reviewer, 'reviews'), []);
  const agreement = await db.query('select payment_status from public.project_agreements where id=$1', [agreementId]);
  assert.equal(agreement.rows[0].payment_status, 'paid');
  const refs = await db.query('select agreement_id from public.payment_agreement_order_refs order by order_id');
  assert.equal(refs.rows.length, 2);
  assert.ok(refs.rows.every(row => row.agreement_id === agreementId));
});

test('agreement review and handover deadlines advance once and release only the matching escrow', async t => {
  const {db, store, service, orders, event} = await fixture(t);
  const terms = {
    projectName: 'Timed agreement', description: 'Deadline test', totalPrice: 100000,
    dpPercent: 25, dpAmount: 25000, remainingAmount: 75000, deadline: '2027-01-15',
    scope: ['Deliver the system'], revisionCount: 1
  };
  await db.query("insert into public.project_proposals (id,status) values ($1,'accepted')", [proposalId]);
  await db.query(`insert into public.project_agreements
    (id,proposal_id,conversation_id,developer_id,client_id,terms,total_price,dp_amount)
    values ($1,$2,$3,$4,$5,$6,$7,$8)`,
  [agreementId, proposalId, conversationId, developer, client,
    JSON.stringify({terms, attachments: []}), terms.totalPrice, terms.dpAmount]);
  const handle = (user, operation, body = {}) =>
    service.handle(user, {agreementId, operation, ...body});
  const apply = (user, action, fields = {}) => handle(user, 'apply', {action, ...fields});

  const checkout = await handle(client, 'checkout', {kind: 'DP'});
  const [dpOrder] = orders.values();
  assert.ok(checkout.redirectUrl);
  dpOrder.transaction_status = 'settlement';
  await service.webhook(event(dpOrder));
  await apply(developer, 'progress', {title: 'Milestone', notes: 'Ready for review.'});

  let stored = await store.state({agreementId});
  let nextState = JSON.parse(JSON.stringify(stored.state));
  const progressDeadline = nextState.room.progressReview.deadlineAt;
  assert.equal(Date.parse(progressDeadline) - Date.parse(nextState.room.progressReview.submittedAt),
    5 * 24 * 60 * 60 * 1000);
  nextState.room.progressReview.deadlineAt = new Date(Date.now() - 1000).toISOString();
  assert.equal(await store.save({agreementId}, stored.version, nextState), true);

  const autoApproved = await handle(client, 'snapshot');
  assert.equal(autoApproved.room.progressReview.status, 'AUTO_APPROVED');
  assert.equal(autoApproved.room.escrow, 'DP_RELEASED');
  assert.equal(autoApproved.room.releases.filter(release => release.kind === 'DP').length, 1);
  const versionAfterProgress = (await store.state({agreementId})).version;
  await handle(developer, 'snapshot');
  assert.equal((await store.state({agreementId})).version, versionAfterProgress);

  await apply(developer, 'deliver', {links: 'https://example.test/video', notes: 'Final video.'});
  await handle(client, 'checkout', {kind: 'REMAINING'});
  const balanceOrder = [...orders.values()][1];
  balanceOrder.transaction_status = 'settlement';
  await service.webhook(event(balanceOrder));
  await apply(developer, 'handover', {notes: 'Handover complete.'});

  stored = await store.state({agreementId});
  nextState = JSON.parse(JSON.stringify(stored.state));
  const handoverDeadline = nextState.room.handover.deadlineAt;
  assert.equal(Date.parse(handoverDeadline) - Date.parse(nextState.room.handover.at),
    7 * 24 * 60 * 60 * 1000);
  nextState.room.handover.deadlineAt = new Date(Date.now() - 1000).toISOString();
  assert.equal(await store.save({agreementId}, stored.version, nextState), true);

  const autoAccepted = await handle(client, 'snapshot');
  assert.equal(autoAccepted.room.handover.status, 'AUTO_ACCEPTED');
  assert.equal(autoAccepted.room.project, 'COMPLETED');
  assert.equal(autoAccepted.room.escrow, 'RELEASED');
  assert.equal(autoAccepted.room.releases.length, 2);
  assert.equal(autoAccepted.ledger.filter(entry => entry.entry === 'REMAINING_RELEASED').length, 1);
  const versionAfterHandover = (await store.state({agreementId})).version;
  await handle(client, 'snapshot');
  assert.equal((await store.state({agreementId})).version, versionAfterHandover);
});

test('a reported agreement problem freezes the handover deadline transition', async t => {
  const {db} = await fixture(t);
  const terms = {
    projectName: 'Disputed agreement', description: 'Dispute deadline test', totalPrice: 100000,
    dpPercent: 25, dpAmount: 25000, remainingAmount: 75000, deadline: '2027-01-15',
    scope: ['Deliver the system'], revisionCount: 1
  };
  await db.query("insert into public.project_proposals (id,status) values ($1,'accepted')", [proposalId]);
  await db.query(`insert into public.project_agreements
    (id,proposal_id,conversation_id,developer_id,client_id,terms,total_price,dp_amount)
    values ($1,$2,$3,$4,$5,$6,$7,$8)`,
  [agreementId, proposalId, conversationId, developer, client,
    JSON.stringify({terms, attachments: []}), terms.totalPrice, terms.dpAmount]);
  const due = '2026-01-01T00:00:00.000Z';
  const state = {
    room: {
      timelineVersion: 2,
      project: 'DISPUTED',
      escrow: 'REMAINING_HELD',
      proposal: {dp: 25000, remaining: 75000},
      progressReview: null,
      handover: {status: 'AWAITING_CLIENT', deadlineAt: due},
      dispute: {status: 'NEEDS_REVIEW', at: '2025-12-25T00:00:00.000Z'},
      releases: [{kind: 'DP', amount: 25000, at: '2025-12-20T00:00:00.000Z'}],
      timeline: {handoverAt: '2025-12-24T00:00:00.000Z'}
    },
    payments: [],
    ledger: [{entry: 'DP_RELEASED', amount: 25000, recorded_at: '2025-12-20T00:00:00.000Z'}]
  };
  await db.query('insert into public.payment_agreement_rooms (agreement_id,state) values ($1,$2)',
    [agreementId, JSON.stringify(state)]);

  const result = await db.query(
    'select public.payment_process_due_agreements($1, $2) as processed',
    [agreementId, new Date().toISOString()]
  );
  assert.equal(result.rows[0].processed, 0);
  const stored = await db.query('select state from public.payment_agreement_rooms where agreement_id=$1', [agreementId]);
  assert.equal(stored.rows[0].state.room.handover.status, 'AWAITING_CLIENT');
  assert.equal(stored.rows[0].state.room.escrow, 'REMAINING_HELD');
  assert.equal(stored.rows[0].state.room.project, 'DISPUTED');
  assert.equal(stored.rows[0].state.ledger.some(entry => entry.entry === 'REMAINING_RELEASED'), false);
});

test('a Client can report an agreement problem after DP and freeze later project actions', async t => {
  const {db, service, orders, event} = await fixture(t);
  const terms = {
    projectName: 'Reported agreement', description: 'Problem report test', totalPrice: 100000,
    dpPercent: 25, dpAmount: 25000, remainingAmount: 75000, deadline: '2027-01-15',
    scope: ['Deliver the system'], revisionCount: 1
  };
  await db.query("insert into public.project_proposals (id,status) values ($1,'accepted')", [proposalId]);
  await db.query(`insert into public.project_agreements
    (id,proposal_id,conversation_id,developer_id,client_id,terms,total_price,dp_amount)
    values ($1,$2,$3,$4,$5,$6,$7,$8)`,
  [agreementId, proposalId, conversationId, developer, client,
    JSON.stringify({terms, attachments: []}), terms.totalPrice, terms.dpAmount]);
  const handle = (user, operation, body = {}) =>
    service.handle(user, {agreementId, operation, ...body});
  const apply = (user, action, fields = {}) => handle(user, 'apply', {action, ...fields});

  await handle(client, 'checkout', {kind: 'DP'});
  const [dpOrder] = orders.values();
  dpOrder.transaction_status = 'settlement';
  await service.webhook(event(dpOrder));
  const reported = await apply(client, 'dispute', {reason: 'The agreed scope is unclear.'});

  assert.equal(reported.room.project, 'DISPUTED');
  assert.ok(reported.room.timeline.problemReportedAt);
  assert.equal(reported.room.escrow, 'DP_HELD');
  await assert.rejects(handle(client, 'checkout', {kind: 'REMAINING'}), {status: 409});
  await assert.rejects(apply(developer, 'progress', {title: 'Milestone', notes: 'Ready.'}), {status: 409});
});
