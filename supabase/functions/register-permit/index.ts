import {
  encodeBase64Url,
  getCorsHeaders,
  hasValidProof,
  jsonResponse,
  verifyPayload
} from '../_shared/registration.mjs';

const MAX_CHALLENGE_AGE_MS = 60 * 60 * 1000;
const MIN_CHALLENGE_AGE_MS = 2000;

Deno.serve(async request => {
  const cors = getCorsHeaders(request.headers.get('origin'));
  if (!cors) return jsonResponse({error: 'Origin not allowed.'}, 403, null);
  if (request.method === 'OPTIONS') return new Response('ok', {headers: cors});
  if (request.method !== 'POST') {
    return jsonResponse({error: 'Method not allowed.'}, 405, cors);
  }

  const secret = Deno.env.get('REGISTRATION_HMAC_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || new TextEncoder().encode(secret).length < 32 || !supabaseUrl || !serviceRoleKey) {
    console.error('Registration protection requires its HMAC secret and Supabase server credentials.');
    return jsonResponse({error: 'Registration protection is not configured.'}, 503, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({error: 'Invalid registration request.'}, 400, cors);
  }

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const honeypot = typeof body?.website === 'string' ? body.website : '';
  const {payload, signature} = body?.challenge || {};
  const counter = body?.counter;

  if (honeypot) return jsonResponse({error: 'Unable to verify registration. Please try again.'}, 400, cors);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return jsonResponse({error: 'Enter a valid email address.'}, 400, cors);
  }
  if (typeof payload !== 'string' || typeof signature !== 'string'
    || !/^\d{13}\.[A-Za-z0-9_-]{32}$/.test(payload)
    || !/^[A-Za-z0-9_-]{43}$/.test(signature)
    || !Number.isSafeInteger(counter) || counter < 0 || counter > 0xffffffff) {
    return jsonResponse({error: 'Unable to verify registration. Reload the page and try again.'}, 400, cors);
  }

  if (!await verifyPayload(payload, signature, secret)) {
    return jsonResponse({error: 'Unable to verify registration. Reload the page and try again.'}, 400, cors);
  }

  const issuedAt = Number(payload.slice(0, payload.indexOf('.')));
  const age = Date.now() - issuedAt;
  if (age < MIN_CHALLENGE_AGE_MS) {
    return jsonResponse({error: 'Please wait a moment before submitting the form.'}, 400, cors);
  }
  if (age > MAX_CHALLENGE_AGE_MS || !await hasValidProof(`${payload}.${signature}`, counter)) {
    return jsonResponse({error: 'Unable to verify registration. Reload the page and try again.'}, 400, cors);
  }

  const forwardedIp = request.headers.get('x-forwarded-for')?.split(/\s*,\s*/)[0];
  if (!forwardedIp) {
    console.error('Registration request did not include a platform client IP.');
    return jsonResponse({error: 'Unable to verify your network. Please try again later.'}, 503, cors);
  }

  const permit = new Uint8Array(32);
  crypto.getRandomValues(permit);
  const permitToken = encodeBase64Url(permit);
  const tokenDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(permitToken));
  const tokenHash = Array.from(new Uint8Array(tokenDigest), byte => byte.toString(16).padStart(2, '0')).join('');

  let response;
  try {
    response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/issue_registration_permit`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({p_email: email, p_ip: forwardedIp, p_token_hash: tokenHash})
    });
  } catch (error) {
    console.error('Failed to reach the registration rate-limit RPC.', error);
    return jsonResponse({error: 'Unable to verify registration right now. Please try again.'}, 503, cors);
  }

  if (!response.ok) {
    console.error('Supabase rejected the registration rate-limit RPC.', response.status);
    return jsonResponse({error: 'Unable to verify registration right now. Please try again.'}, 503, cors);
  }

  let allowed;
  try {
    allowed = await response.json();
  } catch (error) {
    console.error('Supabase returned an invalid rate-limit response.', error);
    return jsonResponse({error: 'Unable to verify registration right now. Please try again.'}, 503, cors);
  }
  if (allowed !== true) {
    return jsonResponse({error: 'Too many registration attempts from this network. Try again later.'}, 429, cors);
  }

  return jsonResponse({registrationPermit: permitToken}, 200, cors);
});
