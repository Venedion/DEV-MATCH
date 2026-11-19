const DEFAULT_POW_DIFFICULTY = 17;
const DEFAULT_APP_ORIGINS = ['https://devm4tch.vercel.app', 'https://dev-match-vincent.vercel.app'];
const LOCAL_DEV_ORIGINS = ['http://127.0.0.1:8767', 'http://localhost:8080'];

function readEnv(name) {
  return globalThis.Deno?.env?.get(name) ?? globalThis.process?.env?.[name] ?? '';
}

function configuredDifficulty() {
  const value = Number(readEnv('REGISTRATION_POW_DIFFICULTY'));
  return Number.isInteger(value) && value >= 12 && value <= 24 ? value : DEFAULT_POW_DIFFICULTY;
}

export const POW_DIFFICULTY = configuredDifficulty();

const encoder = new TextEncoder();

// APP_ORIGINS (comma separated) replaces the default production origins.
// Localhost is only accepted when ALLOW_LOCAL_ORIGINS=true (local development).
export function allowedOrigins() {
  const configured = readEnv('APP_ORIGINS')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const origins = configured.length ? configured : [...DEFAULT_APP_ORIGINS];
  if (readEnv('ALLOW_LOCAL_ORIGINS') === 'true') origins.push(...LOCAL_DEV_ORIGINS);
  return origins;
}

export function getCorsHeaders(origin) {
  if (!origin || !allowedOrigins().includes(origin)) return null;
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

export async function sha256Hex(value, webCrypto = globalThis.crypto) {
  const digest = await webCrypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Supabase Edge Functions sit behind Cloudflare. cf-connecting-ip is set by the
// edge and cannot be supplied by the client; x-forwarded-for can be prefixed
// by the client, so it is only a fallback.
export function clientIp(headers) {
  const candidates = [
    headers.get('cf-connecting-ip'),
    headers.get('x-real-ip'),
    headers.get('x-forwarded-for')?.split(/\s*,\s*/)[0]
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && /^[0-9a-f:.]{3,45}$/i.test(value)) return value;
  }
  return null;
}

// Constant-time comparison for secrets of the same encoding.
export function timingSafeEqual(left, right) {
  const a = encoder.encode(String(left ?? ''));
  const b = encoder.encode(String(right ?? ''));
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}
