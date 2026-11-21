const businessNumber = '6285373117073';
const allowedOrigins = new Set(['https://devm4tch.vercel.app', 'https://dev-match-vincent.vercel.app']);
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const codePattern = new RegExp('^DEV-MATCH VERIFY (' + uuid + ')$', 'i');

Deno.serve(async request => {
  const url = new URL(request.url);
  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
  const verifyToken = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
  const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const configured = Boolean(appSecret && verifyToken && phoneId);

  if (request.method === 'GET' && url.searchParams.has('availability')) {
    const origin = request.headers.get('origin') || '';
    const headers = new Headers({'Vary': 'Origin'});
    if (allowedOrigins.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
    return Response.json({available: configured, ...(configured ? {number: businessNumber} : {})}, {headers});
  }

  if (!configured) return new Response('Not configured', {status: 503});
  if (request.method === 'GET') {
    const challenge = url.searchParams.get('hub.challenge');
    if (url.searchParams.get('hub.mode') === 'subscribe'
      && url.searchParams.get('hub.verify_token') === verifyToken && challenge) {
      return new Response(challenge);
    }
    return new Response('Forbidden', {status: 403});
  }
  if (request.method !== 'POST') return new Response('Method not allowed', {status: 405});

  const signature = request.headers.get('x-hub-signature-256')?.match(/^sha256=([0-9a-f]{64})$/i);
  if (!signature) return new Response('Unauthorized', {status: 401});
  const body = await request.arrayBuffer();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), {name: 'HMAC', hash: 'SHA-256'}, false, ['verify']);
  const signatureBytes = Uint8Array.from(signature[1].match(/../g)!, pair => parseInt(pair, 16));
  if (!await crypto.subtle.verify('HMAC', key, signatureBytes, body)) {
    return new Response('Unauthorized', {status: 401});
  }

  let event;
  try { event = JSON.parse(new TextDecoder().decode(body)); }
  catch { return new Response('Invalid JSON', {status: 400}); }
  if (event?.object !== 'whatsapp_business_account') return new Response('OK');

  for (const entry of event.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages' || change.value?.metadata?.phone_number_id !== phoneId) continue;
      const destination = String(change.value.metadata.display_phone_number || '').replace(/\D/g, '');
      if (destination !== businessNumber) continue;

      for (const message of change.value.messages ?? []) {
        if (message.type !== 'text' || !/^[1-9][0-9]{7,14}$/.test(message.from || '')) continue;
        const match = String(message.text?.body || '').trim().match(codePattern);
        if (!match) continue;
        const endpoint = Deno.env.get('SUPABASE_URL') + '/rest/v1/rpc/confirm_whatsapp_phone_verification';
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const result = await fetch(endpoint, {
          method: 'POST',
          headers: {apikey: serviceKey!, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json'},
          body: JSON.stringify({p_code: match[1], p_sender: '+' + message.from})
        });
        if (!result.ok) return new Response('Verification temporarily unavailable', {status: 503});
      }
    }
  }
  return new Response('OK');
});
