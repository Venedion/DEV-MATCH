import {
  encodeBase64Url,
  getCorsHeaders,
  jsonResponse,
  POW_DIFFICULTY,
  signPayload
} from '../_shared/registration.mjs';

Deno.serve(async request => {
  const cors = getCorsHeaders(request.headers.get('origin'));
  if (!cors) return jsonResponse({error: 'Origin not allowed.'}, 403, null);
  if (request.method === 'OPTIONS') return new Response('ok', {headers: cors});
  if (request.method !== 'GET') {
    return jsonResponse({error: 'Method not allowed.'}, 405, cors);
  }

  const secret = Deno.env.get('REGISTRATION_HMAC_SECRET');
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    console.error('REGISTRATION_HMAC_SECRET must contain at least 32 bytes.');
    return jsonResponse({error: 'Registration protection is not configured.'}, 503, cors);
  }

  try {
    const nonce = new Uint8Array(24);
    crypto.getRandomValues(nonce);
    const payload = `${Date.now()}.${encodeBase64Url(nonce)}`;
    const signature = await signPayload(payload, secret);
    return jsonResponse({payload, signature, difficulty: POW_DIFFICULTY}, 200, cors);
  } catch (error) {
    console.error('Unable to create registration challenge.', error);
    return jsonResponse({error: 'Unable to initialize registration protection.'}, 503, cors);
  }
});
