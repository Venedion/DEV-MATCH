import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from './index.mjs';
import { midtransSandbox } from './midtrans.mjs';
import { openPayments } from './payments.mjs';
import { openAccounts } from './accounts.mjs';

const serverKey = 'SB-Mid-server-fixture';
const clientKey = 'SB-Mid-client-fixture';
const signatureSecret = 'fixture-signature-secret';
const password = 'Fixture-Password1';
const proposal = {
  name: 'Test website', total: 100001, dpPercent: 25, description: 'Checkout demo',
  scope: 'Payment and chat', deliverables: 'Repository and docs', revisions: 'One revision', duration: '2 weeks'
};

async function fixture(t) {
  const orders = new Map();
  const gateway = midtransSandbox({ serverKey, clientKey, signatureSecret, request: async (url, options) => {
    assert.equal(options.headers.Authorization, `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`);
    if (options.method === 'POST') {
      assert.equal(url, 'https://app.sandbox.midtrans.com/snap/v1/transactions');
      const { order_id, gross_amount } = JSON.parse(options.body).transaction_details;
      assert.ok(!orders.has(order_id));
      orders.set(order_id, { order_id, gross_amount: `${gross_amount}.00`, currency: 'IDR' });
      await new Promise(resolve => setTimeout(resolve, 25));
      return Response.json({ token: `token-${order_id}` }, { status: 201 });
    }
    assert.match(url, /^https:\/\/api\.sandbox\.midtrans\.com\/v2\/.+\/status$/);
    const order = orders.get(new URL(url).pathname.split('/')[2]);
    return order?.transaction_status ? Response.json(order) : Response.json({ status_code: '404' }, { status: 404 });
  } });
  const payments = openPayments(':memory:', gateway);
  const accounts = openAccounts(':memory:');
  const server = createApp(payments, accounts).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    payments.close();
    accounts.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const roomPath = '/api/rooms/test-room/payment';
  const cookies = new Map();
  async function api(path = '', body, { anonymous = false, expected = 200, origin, actor = 'client' } = {}) {
    const cookie = cookies.get(actor);
    const response = await fetch(base + (path.startsWith('/api/') ? path : roomPath + path), {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(!anonymous && cookie && { Cookie: cookie }),
        ...(body && { 'Content-Type': 'application/json' }),
        ...(origin && { Origin: origin })
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    assert.equal(response.status, expected, JSON.stringify(data));
    const newCookie = response.headers.get('set-cookie')?.split(';')[0];
    if (!anonymous && newCookie) cookies.set(actor, newCookie);
    return data;
  }
  const register = (actor, role, number, expected = 201) => api('/api/auth/register', {
    username: actor, email: `${actor}@example.test`, phone: `812345678${number}`, password, role, terms: true
  }, { actor, expected });
  await register('developer', 'developer', 1);
  await register('client', 'client', 2);
  await register('reviewer', 'developer', 3);
  accounts.promoteReviewer('reviewer@example.test');
  accounts.assignRoom('test-room', 'developer@example.test', 'client@example.test', 'reviewer@example.test');
  const change = (role, action, body, options) => api('', { action, ...body }, { actor: role, ...options });
  const checkout = (kind, options) => api('/checkout', { kind, amount: 1 }, options);
  function notification(order, extra) {
    const event = { transaction_id: 'fixture-transaction', status_code: '200', ...order, ...extra };
    event.signature_key = createHash('sha512')
      .update(event.order_id + event.status_code + event.gross_amount + signatureSecret).digest('hex');
    return event;
  }
  const notify = (body, expected) => api('/api/payments/midtrans/webhook', body, { anonymous: true, expected });
  return { orders, api, change, checkout, notification, notify, register };
}

test('Room Chat checkout verifies DP and balance before completing simulated payout', async t => {
  const { orders, api, change, checkout, notification, notify } = await fixture(t);
  assert.equal((await api()).room, null);
  await change('client', 'propose', proposal, { expected: 403 });
  await change('developer', 'propose', proposal, { expected: 403, origin: 'https://elsewhere.invalid' });
  await change('developer', 'propose', proposal);
  await api('', undefined, { anonymous: true, expected: 401 });
  await checkout('DP', { expected: 409 });
  await change('client', 'accept');
  await checkout('REMAINING', { expected: 409 });

  const [first, second] = await Promise.all([checkout('DP'), checkout('DP')]);
  assert.deepEqual(first, second);
  assert.equal(first.clientKey, clientKey);
  assert.equal(orders.size, 1);
  const dp = [...orders.values()][0];
  assert.equal(dp.gross_amount, '25001.00');
  assert.equal((await api('/refresh', {})).payments[0].status, 'PENDING');
  await notify({ ...notification(dp), signature_key: '0'.repeat(128) }, 401);
  await notify(notification(dp, { order_id: 'unknown' }), 404);
  await notify(notification(dp, { gross_amount: '1.00' }), 422);
  Object.assign(dp, { transaction_status: 'pending' });
  await notify(notification(dp, { transaction_status: 'settlement' }));
  assert.equal((await api()).payments[0].status, 'PROCESSING');
  assert.equal((await api()).ledger.length, 0);
  Object.assign(dp, { transaction_status: 'settlement' });
  const paid = notification(dp);
  await Promise.all([notify(paid), notify(paid)]);
  const afterDp = await api();
  assert.equal(afterDp.room.project, 'IN_PROGRESS');
  assert.deepEqual(afterDp.ledger.map(entry => entry.entry), ['DP_HELD']);
  assert.ok(!JSON.stringify(afterDp).includes(first.token));

  await change('developer', 'progress', { title: 'Initial milestone', notes: 'Complete' });
  await change('developer', 'deliver', { links: 'https://example.test/delivery', notes: 'First version' });
  await change('client', 'approve', null, { expected: 409 });
  await change('client', 'revision', { reason: 'Please update docs' });
  await change('developer', 'deliver', { links: 'https://example.test/revised', notes: 'Second version' });

  await checkout('REMAINING');
  const balance = [...orders.values()][1];
  assert.equal(balance.gross_amount, '75000.00');
  Object.assign(balance, { transaction_status: 'capture', fraud_status: 'challenge' });
  assert.equal((await api('/refresh', {})).payments[1].status, 'PROCESSING');
  balance.fraud_status = 'accept';
  assert.equal((await api('/refresh', {})).payments[1].status, 'PAID');
  await change('client', 'approve', null, { expected: 409 });
  await change('developer', 'verify-payout');
  assert.equal((await change('client', 'approve')).room.payout.status, 'PROCESSING');
  await change('client', 'revision', { reason: 'Late revision' }, { expected: 409 });
  const result = await change('developer', 'complete-payout');
  assert.equal(result.room.project, 'COMPLETED');
  assert.deepEqual(result.ledger.map(entry => entry.entry), ['DP_HELD', 'FULL_PAYMENT_HELD', 'RELEASE_PENDING', 'RELEASED']);
  await change('developer', 'complete-payout', null, { expected: 409 });
});

test('A failed attempt reuses Snap; expiration allows a new order and dispute freezes checkout', async t => {
  const { orders, api, change, checkout, notification, notify } = await fixture(t);
  await api();
  await change('developer', 'propose', proposal);
  await change('client', 'decline');
  await change('developer', 'propose', proposal);
  await change('client', 'accept');
  const first = await checkout('DP');
  const expired = [...orders.values()][0];
  Object.assign(expired, { transaction_status: 'deny', status_code: '407' });
  await notify(notification(expired));
  assert.equal((await api()).payments[0].status, 'FAILED');
  assert.deepEqual(await checkout('DP'), first);
  expired.transaction_status = 'expire';
  await notify(notification(expired));
  assert.equal((await api()).payments[0].status, 'EXPIRED');
  assert.notEqual((await checkout('DP')).token, first.token);
  const next = [...orders.values()][1];
  next.transaction_status = 'settlement';
  await notify(notification(next));

  await change('developer', 'verify-payout');
  const disputed = await change('client', 'dispute', { reason: 'Deliverables need review' });
  assert.equal(disputed.room.dispute.status, 'NEEDS_REVIEW');
  await checkout('REMAINING', { expected: 409 });
  await change('developer', 'complete-payout', null, { expected: 409 });
  await change('client', 'resolve-dispute', {}, { expected: 403 });
  const resolved = await change('reviewer', 'resolve-dispute', {
    outcome: 'PARTIAL_REFUND', partialRefund: 10000, decision: 'Partial work accepted'
  });
  assert.equal(resolved.room.payout.net, 15001);
  assert.deepEqual(resolved.ledger.map(entry => entry.entry), ['DP_HELD', 'PARTIAL_REFUND', 'DISPUTE_RELEASE_PENDING']);
  assert.equal((await change('developer', 'complete-payout')).room.escrow, 'RELEASED');
});

test('An unused Snap page expires even when Midtrans has no charge status', async t => {
  const { api, change, checkout } = await fixture(t);
  await api();
  await change('developer', 'propose', proposal);
  await change('client', 'accept');
  const first = await checkout('DP');
  const afterExpiry = Date.now() + 25 * 3600000;
  t.mock.method(Date, 'now', () => afterExpiry);
  assert.equal((await api('/refresh', {})).payments[0].status, 'EXPIRED');
  assert.notEqual((await checkout('DP')).token, first.token);
});

test('Payment permissions follow the signed-in account and room membership', async t => {
  const { api, change, checkout, register } = await fixture(t);
  await register('intruder', 'reviewer', 4, 400);
  await register('intruder', 'client', 4);
  await register('intruder', 'client', 4, 409);
  await api('', undefined, { actor: 'intruder', expected: 403 });
  await api('/api/rooms/other-room/payment', undefined, { actor: 'developer', expected: 403 });
  const state = await change('developer', 'propose', proposal);
  assert.equal(state.role, 'developer');
  assert.equal((await api()).room.proposal.name, proposal.name);
  await change('developer', 'accept', {}, { expected: 403 });
  await change('developer', 'accept', { role: 'client' }, { expected: 400 });
  await checkout('DP', { actor: 'developer', expected: 403 });
  await api('/api/auth/logout', {}, { actor: 'developer' });
  await api('', undefined, { actor: 'developer', expected: 401 });
  await api('/api/auth/login', { identifier: '08123456781', password: 'wrong' }, { actor: 'developer', expected: 401 });
  const signedIn = await api('/api/auth/login', { identifier: '08123456781', password, role: 'client' }, { actor: 'developer' });
  assert.equal(signedIn.account.role, 'developer');
  assert.equal((await api('', undefined, { actor: 'reviewer' })).role, 'reviewer');
  await change('reviewer', 'accept', {}, { expected: 403 });
});
