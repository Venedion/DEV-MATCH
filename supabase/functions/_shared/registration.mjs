export const POW_DIFFICULTY = 14;

const encoder = new TextEncoder();

export function getCorsHeaders(origin) {
  const allowedOrigins = (Deno.env.get('APP_ORIGINS') || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (!origin || !allowedOrigins.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
}

export function jsonResponse(body, status, cors) {
  const headers = new Headers(cors || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), {status, headers});
}

export function encodeBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function hmacKey(secret, webCrypto) {
  return webCrypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign', 'verify']
  );
}

export async function signPayload(payload, secret, webCrypto = globalThis.crypto) {
  const key = await hmacKey(secret, webCrypto);
  const signature = await webCrypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return encodeBase64Url(new Uint8Array(signature));
}

export async function verifyPayload(payload, signature, secret, webCrypto = globalThis.crypto) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
  try {
    const key = await hmacKey(secret, webCrypto);
    return await webCrypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(signature),
      encoder.encode(payload)
    );
  } catch {
    return false;
  }
}

export async function hasValidProof(input, counter, difficulty = POW_DIFFICULTY, webCrypto = globalThis.crypto) {
  if (!Number.isSafeInteger(counter) || counter < 0 || counter > 0xffffffff) return false;
  const hash = new Uint8Array(await webCrypto.subtle.digest('SHA-256', encoder.encode(`${input}.${counter}`)));
  const wholeZeroBytes = Math.floor(difficulty / 8);
  for (let index = 0; index < wholeZeroBytes; index += 1) {
    if (hash[index] !== 0) return false;
  }
  const remainingBits = difficulty % 8;
  return remainingBits === 0 || (hash[wholeZeroBytes] >> (8 - remainingBits)) === 0;
}
