const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {stripTypeScriptTypes} = require('node:module');
const {join} = require('node:path');
const vm = require('node:vm');

const source = stripTypeScriptTypes(readFileSync(join(__dirname, '../supabase/functions/whatsapp-otp/index.ts'), 'utf8'));
const expectedDevice = {status: true, device_status: 'connect', device: '6285373117073', package: 'Free', quota: '1000'};

function setup({device = expectedDevice, secret = 'test-only-signing-secret-at-least-32', enabled = 'true'} = {}) {
  const sends = [];
  let handler;
  let reservation;
  const env = {
    SUPABASE_URL: 'https://project.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'test-only-service-key',
    FONNTE_DEVICE_TOKEN: 'test-only-device-token',
    WHATSAPP_OTP_SIGNING_SECRET: secret,
    WHATSAPP_OTP_ENABLED: enabled
  };
  const fetch = async (url, init) => {
    if (url.endsWith('/auth/v1/user')) return Response.json({id: 'test-user', email_confirmed_at: 'today'});
    if (url === 'https://api.fonnte.com/device') return Response.json(device);
    if (url.endsWith('/reserve_whatsapp_otp')) {
      reservation = JSON.parse(init.body);
      return Response.json(true);
    }
    if (url === 'https://api.fonnte.com/send') {
      sends.push(init.body);
      return Response.json({status: true, id: ['test-message']});
    }
    if (url.endsWith('/verify_whatsapp_otp')) {
      const input = JSON.parse(init.body);
      return Response.json(input.p_digest === reservation?.p_digest ? 'verified' : 'invalid');
    }
    throw Error('Unexpected HTTP request');
  };
  vm.runInNewContext(source, {
    Deno: {env: {get: name => env[name]}, serve: callback => { handler = callback; }},
    fetch, crypto, TextEncoder, AbortSignal, FormData, Headers, Response
  });
  return {
    sends,
    reservation: () => reservation,
    post: payload => handler(new Request('https://edge.invalid', {
      method: 'POST',
      headers: {Authorization: 'Bearer qa'},
      body: JSON.stringify({phone: '+6281200009999', ...payload})
    }))
  };
}

test('Fonnte delivers a six-digit code to the selected recipient and only the matching code verifies', async () => {
  const h = setup();
  const send = await h.post({action: 'send'});
  assert.equal(send.status, 200);
  const {challenge} = await send.json();
  assert.equal(h.sends.length, 1);
  assert.equal(h.sends[0].get('target'), '6281200009999');
  const code = h.sends[0].get('message').match(/\b\d{6}\b/)[0];
  assert.match(h.reservation().p_digest, /^[a-f0-9]{64}$/);
  assert.equal(Object.values(h.reservation()).includes(code), false);
  const wrong = await h.post({action: 'verify', challenge, code: code === '000000' ? '111111' : '000000'});
  assert.equal(wrong.status, 400);
  const verified = await h.post({action: 'verify', challenge, code});
  assert.deepEqual(await verified.json(), {verified: true});
});

test('Fonnte rejects sending on a paid plan, wrong device, disconnected device, depleted quota or inactive configuration', async () => {
  const options = [
    {device: {...expectedDevice, package: 'Lite'}},
    {device: {...expectedDevice, device: '6289999999999'}},
    {device: {...expectedDevice, device_status: 'disconnect'}},
    {device: {...expectedDevice, quota: '0'}},
    {enabled: 'false'}
  ];
  for (const option of options) {
    const h = setup(option);
    const response = await h.post({action: 'send'});
    assert.equal(response.status, 503);
    assert.equal(h.sends.length, 0);
    assert.equal(h.reservation(), undefined);
  }
});
