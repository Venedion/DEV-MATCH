const {test} = require('node:test');
const assert = require('node:assert/strict');
const {webcrypto} = require('node:crypto');
const registration = import('../supabase/functions/_shared/registration.mjs');

const secret = 'test-secret-with-at-least-thirty-two-bytes';

test('Registration challenge signatures reject modified payloads', async () => {
  const {signPayload, verifyPayload} = await registration;
  const payload = '1234567890123.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const signature = await signPayload(payload, secret, webcrypto);

  assert.equal(await verifyPayload(payload, signature, secret, webcrypto), true);
  assert.equal(await verifyPayload(`${payload}.changed`, signature, secret, webcrypto), false);
});

test('Proof-of-work accepts a valid counter and rejects an out-of-range counter', async () => {
  const {hasValidProof} = await registration;
  const input = 'registration-challenge';
  let counter = 0;
  while (!await hasValidProof(input, counter, 8, webcrypto)) counter += 1;

  assert.equal(await hasValidProof(input, counter, 8, webcrypto), true);
  assert.equal(await hasValidProof(input, counter + 0x100000000, 8, webcrypto), false);
});
