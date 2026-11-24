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
    create table auth.users (id uuid primary key);
    create table public.projects (id text primary key, owner_id uuid not null, project_kind text not null, title text not null);
    create table public.conversations (id uuid primary key, project_id text, participant_a_id uuid not null,
      participant_b_id uuid not null, participant_a_role text not null, participant_b_role text not null);
  `);
  const path = join(__dirname, '../supabase/migrations/20261124120000_midtrans_sandbox_payments.sql');
  await db.exec(readFileSync(path, 'utf8'));
  await db.query('insert into auth.users values ($1), ($2), ($3)', [developer, client, reviewer]);
  await db.query("insert into public.projects values ($1, $2, 'portfolio', 'Project')", [projectId, developer]);
  await db.query("insert into public.conversations values ($1, $2, $3, $4, 'dev', 'client')",
    [conversationId, projectId, developer, client]);
  await db.query('insert into public.payment_dispute_reviewers values ($1, $2, $3)', [conversationId, projectId, reviewer]);
  const row = async (sql, args) => (await db.query(sql, args)).rows[0];
  const args = ref => [ref.conversationId, ref.projectId];
  const store = {
    context: async (user, ref) => (await row('select public.payment_room_context($1, $2, $3) as data',
      [user, ...args(ref)])).data,
    reviewerRooms: async user => (await row('select public.payment_reviewer_rooms($1) as data', [user])).data,
    save: async (ref, version, state, orderId = null) => (await row(
      'select public.payment_save_room($1, $2, $3, $4, $5) as saved',
      [...args(ref), version, JSON.stringify(state), orderId])).saved,
    state: async ref => await row('select version, state from public.payment_rooms where conversation_id=$1 and project_id=$2',
      args(ref)) || {version: 0, state: null},
    orderRef: orderId => row('select conversation_id as "conversationId", project_id as "projectId" from public.payment_order_refs where order_id=$1',
      [orderId])
  };
  const {sandboxGateway} = await import('../supabase/functions/payment-api/midtrans.mjs');
  const {paymentService} = await import('../supabase/functions/payment-api/service.mjs');
  const key = 'SB-Mid-server-fixture';
  const orders = new Map();
  const gateway = sandboxGateway({serverKey: key, returnOrigin: 'https://devm4tch.vercel.app',
    request: async (url, options) => {
      assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from(key + ':').toString('base64'));
      if (options.method === 'POST') {
        const {transaction_details, callbacks} = JSON.parse(options.body);
        const {order_id, gross_amount} = transaction_details;
        const finish = new URL(callbacks.finish);
        assert.equal(finish.origin, 'https://devm4tch.vercel.app');
        assert.equal(finish.searchParams.get('conversation'), conversationId);
        assert.ok(!orders.has(order_id), 'order must be created once');
        orders.set(order_id, {order_id, gross_amount: gross_amount + '.00'});
        return Response.json({redirect_url: 'https://app.sandbox.midtrans.com/snap/v3/redirection/' + order_id});
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

test('Hosted checkout verifies authoritative status and records ledger once on concurrent webhook delivery', async t => {
  const {handle, apply, service, orders, event} = await fixture(t);
  await apply(developer, 'propose', proposal);
  await apply(client, 'accept');
  await assert.rejects(handle(client, 'checkout', {kind: 'REMAINING'}), {status: 409});
  const checkouts = await Promise.allSettled([handle(client, 'checkout', {kind: 'DP', amount: 1}), handle(client, 'checkout', {kind: 'DP'})]);
  assert.ok(checkouts.some(result => result.status === 'fulfilled'));
  assert.equal(orders.size, 1);
  assert.match((await handle(client, 'checkout', {kind: 'DP'})).redirectUrl, /app\.sandbox\.midtrans\.com/);
  const [dp] = orders.values();
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
