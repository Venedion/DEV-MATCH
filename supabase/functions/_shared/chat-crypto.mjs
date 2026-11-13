const encoder = new TextEncoder();

export function sanitizeMessageText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?(?:<\/style\s*>|$)/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
}

function encodeBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new TypeError('Invalid encrypted message encoding.');
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}

function messageAad(context) {
  return encoder.encode(`${context.conversationId}:${context.senderId}:${context.keyVersion}`);
}

async function importKey(keyBytes, webCrypto, usage) {
  if (!(keyBytes instanceof Uint8Array) || keyBytes.length !== 32) {
    throw new TypeError('Chat encryption keys must be 32 bytes.');
  }
  return webCrypto.subtle.importKey('raw', keyBytes, {name: 'AES-GCM'}, false, [usage]);
}

export async function encryptMessage(plaintext, context, keyBytes, webCrypto = globalThis.crypto) {
  const key = await importKey(keyBytes, webCrypto, 'encrypt');
  const nonce = new Uint8Array(12);
  webCrypto.getRandomValues(nonce);
  const encrypted = await webCrypto.subtle.encrypt(
    {name: 'AES-GCM', iv: nonce, additionalData: messageAad(context), tagLength: 128},
    key,
    encoder.encode(plaintext)
  );
  return {
    ciphertext: encodeBase64Url(new Uint8Array(encrypted)),
    nonce: encodeBase64Url(nonce)
  };
}

export async function decryptMessage(record, context, keyBytes, webCrypto = globalThis.crypto) {
  const key = await importKey(keyBytes, webCrypto, 'decrypt');
  const plaintext = await webCrypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decodeBase64Url(record.nonce),
      additionalData: messageAad(context),
      tagLength: 128
    },
    key,
    decodeBase64Url(record.ciphertext)
  );
  return new TextDecoder().decode(plaintext);
}

export async function encryptBinary(plaintext, context, keyBytes, webCrypto = globalThis.crypto) {
  if (!(plaintext instanceof Uint8Array)) throw new TypeError('Attachment content must be bytes.');
  const key = await importKey(keyBytes, webCrypto, 'encrypt');
  const nonce = new Uint8Array(12);
  webCrypto.getRandomValues(nonce);
  const ciphertext = await webCrypto.subtle.encrypt(
    {name: 'AES-GCM', iv: nonce, additionalData: messageAad(context), tagLength: 128},
    key,
    plaintext
  );
  return {ciphertext: new Uint8Array(ciphertext), nonce: encodeBase64Url(nonce)};
}

export async function decryptBinary(record, context, keyBytes, webCrypto = globalThis.crypto) {
  const key = await importKey(keyBytes, webCrypto, 'decrypt');
  const plaintext = await webCrypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decodeBase64Url(record.nonce),
      additionalData: messageAad(context),
      tagLength: 128
    },
    key,
    record.ciphertext
  );
  return new Uint8Array(plaintext);
}
