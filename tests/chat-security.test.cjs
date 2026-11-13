const {test} = require('node:test');
const assert = require('node:assert/strict');
const {webcrypto} = require('node:crypto');
const chatCrypto = import('../supabase/functions/_shared/chat-crypto.mjs');

test('Message sanitizer removes active markup while retaining plain text', async () => {
  const {sanitizeMessageText} = await chatCrypto;
  assert.equal(
    sanitizeMessageText('<script>alert(1)</script><b>Hello</b><br>world'),
    'Hello\nworld'
  );
});

test('AES-GCM ciphertext decrypts only with the original context and key', async () => {
  const {decryptMessage, encryptMessage} = await chatCrypto;
  const key = new Uint8Array(32).fill(7);
  const context = {
    conversationId: 'conversation-id',
    senderId: 'sender-id',
    keyVersion: 1
  };
  const encrypted = await encryptMessage('private message', context, key, webcrypto);

  assert.notEqual(encrypted.ciphertext, 'private message');
  assert.equal(await decryptMessage(encrypted, context, key, webcrypto), 'private message');
  await assert.rejects(
    decryptMessage(encrypted, {...context, conversationId: 'another-conversation'}, key, webcrypto)
  );
});

test('Chat attachments are encrypted and authenticated with their conversation context', async () => {
  const {decryptBinary, encryptBinary} = await chatCrypto;
  const key = new Uint8Array(32).fill(9);
  const context = {
    conversationId: 'conversation-id:attachment:file-id',
    senderId: 'sender-id',
    keyVersion: 1
  };
  const original = new Uint8Array([0, 1, 2, 128, 255]);
  const encrypted = await encryptBinary(original, context, key, webcrypto);

  assert.notDeepEqual(encrypted.ciphertext, original);
  assert.deepEqual(await decryptBinary(encrypted, context, key, webcrypto), original);
  await assert.rejects(
    decryptBinary(encrypted, {...context, senderId: 'another-sender'}, key, webcrypto)
  );
});
