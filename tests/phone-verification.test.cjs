const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/js/phone-verification.js'), 'utf8');

async function setup(available) {
  const elements = new Map(), calls = [];
  let verified = false;
  function element(id) {
    if (id === 'continuePhoneSetup') return null;
    if (!elements.has(id)) elements.set(id, {
      disabled: true, hidden: true, focus() {}, addEventListener(name, fn) { this[name] = fn; }
    });
    return elements.get(id);
  }
  const backend = {
    ready: Promise.resolve({email_confirmed_at: 'today'}),
    loadProfile: async () => ({phone: '+6281234567890', verified_phone: '+6281234567890', phone_verified_at: true}),
    client: {
      supabaseUrl: 'https://example.invalid',
      functions: {
        async invoke(_, {body}) {
          calls.push({...body});
          if (body.action === 'send') return {data: {challenge: 'challenge-id'}};
          return verified ? {data: {verified: true}} : {
            error: {context: {json: async () => ({error: 'invalid'})}}
          };
        }
      }
    }
  };
  vm.runInNewContext(source, {
    window: {devMatchBackend: backend, setTimeout() {}, clearTimeout() {}},
    document: {getElementById: element},
    fetch: async () => ({ok: true, json: async () => ({available})})
  });
  await new Promise(setImmediate);
  return {element, calls, allowCode() { verified = true; }};
}

test('WhatsApp sending stays disabled without production configuration', async () => {
  const h = await setup(false);
  assert.equal(h.element('startWhatsAppVerification').disabled, true);
  await h.element('startWhatsAppVerification').click();
  assert.deepEqual(h.calls, []);
});

test('Settings retains the old phone until the new phone is verified', async () => {
  const h = await setup(true);
  h.element('settingsPhone').value = '0812 000 09999';
  await h.element('startWhatsAppVerification').click();
  assert.deepEqual(h.calls[0], {action: 'send', phone: '+6281200009999'});
  assert.equal(h.element('startWhatsAppVerification').disabled, true);
  assert.match(h.element('whatsappOtpDestination').textContent, /\+6281200009999/);
  assert.match(h.element('activeAccountPhone').textContent, /\+6281234567890 · Terverifikasi/);
  h.element('whatsappOtpCode').value = '123456';
  await h.element('checkWhatsAppVerification').click();
  assert.match(h.element('phoneVerificationStatus').textContent, /Incorrect code/);
  h.allowCode();
  await h.element('checkWhatsAppVerification').click();
  assert.deepEqual(h.calls[2], {action: 'verify', challenge: 'challenge-id', phone: '+6281200009999', code: '123456'});
  assert.match(h.element('activeAccountPhone').textContent, /\+6281200009999 · Terverifikasi/);
});
