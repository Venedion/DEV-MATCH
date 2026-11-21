const sender = '6285373117073';
const origins = new Set(['https://devm4tch.vercel.app', 'https://dev-match-vincent.vercel.app']);
const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const signingSecret = Deno.env.get('WHATSAPP_OTP_SIGNING_SECRET');
const fonnteToken = Deno.env.get('FONNTE_DEVICE_TOKEN');
const enabled = Deno.env.get('WHATSAPP_OTP_ENABLED') === 'true'
  && Boolean(url && serviceKey && fonnteToken && signingSecret && signingSecret.length >= 32);

const encoder = new TextEncoder();

async function fonnteStatus() {
  const response = await fetch('https://api.fonnte.com/device', {
    method: 'POST', headers: {Authorization: fonnteToken!},
    redirect: 'error', signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) return 'unavailable';
  const device = await response.json();
  if (device.status !== true || device.device_status !== 'connect'
    || String(device.device).replace(/\D/g, '') !== sender
    || String(device.package).trim().toLowerCase() !== 'free') return 'unavailable';
  return Number(device.quota) > 0 ? null : 'quota';
}

async function sendWithFonnte(phone: string, code: string) {
  const body = new FormData();
  body.set('target', phone.slice(1));
  body.set('countryCode', '0');
  body.set('message', 'DEV-MATCH: Kode verifikasi WhatsApp kamu ' + code + '. Berlaku 5 menit. Jangan bagikan kode ini.');
  const response = await fetch('https://api.fonnte.com/send', {
    method: 'POST', headers: {Authorization: fonnteToken!}, body,
    redirect: 'error', signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) return false;
  const result = await response.json();
  return result.status === true && Array.isArray(result.id) && result.id.length === 1;
}

function generateCode() {
  const random = new Uint32Array(1);
  do { crypto.getRandomValues(random); } while (random[0] >= 4294000000);
  return String(random[0] % 1000000).padStart(6, '0');
}

async function sign(user: string, phone: string, challenge: string, code: string) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(signingSecret!), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode([user, phone, challenge, code].join(':')));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function rpc(name: string, body: Record<string, string>) {
  const response = await fetch(url + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: {apikey: serviceKey!, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json'},
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error('Database request failed');
  return response.json();
}

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  const headers = new Headers({'Vary': 'Origin', 'Cache-Control': 'no-store'});
  if (origin && origins.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  const json = (body: object, status = 200) => Response.json(body, {status, headers});

  if (origin && !origins.has(origin)) return json({error: 'forbidden'}, 403);
  if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
  if (request.method === 'GET') return json({available: enabled});
  if (request.method !== 'POST') return json({error: 'method'}, 405);
  if (!enabled) return json({error: 'unavailable'}, 503);
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return json({error: 'unauthorized'}, 401);

  try {
    const auth = await fetch(url + '/auth/v1/user', {
      headers: {apikey: serviceKey!, Authorization: authorization},
      signal: AbortSignal.timeout(5000)
    });
    if (!auth.ok) return json({error: 'unauthorized'}, 401);
    const user = await auth.json();
    if (!user.id || !user.email_confirmed_at) return json({error: 'unauthorized'}, 401);

    const input = await request.json().catch(() => null);
    const phone = typeof input?.phone === 'string' ? input.phone : '';
    if (!/^\+[1-9]\d{8,14}$/.test(phone) || phone === '+' + sender) {
      return json({error: 'phone'}, 400);
    }
    if (input.action === 'verify') {
      if (typeof input.code !== 'string' || !/^\d{6}$/.test(input.code)
        || typeof input.challenge !== 'string'
        || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.challenge)) {
        return json({error: 'invalid'}, 400);
      }
      const result = await rpc('verify_whatsapp_otp', {
        p_user: user.id, p_phone: phone, p_challenge: input.challenge,
        p_digest: await sign(user.id, phone, input.challenge, input.code)
      });
      return result === 'verified' ? json({verified: true}) : json({error: result}, 400);
    }
    if (input.action !== 'send') return json({error: 'method'}, 400);
    const deviceError = await fonnteStatus();
    if (deviceError) return json({error: deviceError}, 503);

    const challenge = crypto.randomUUID();
    const code = generateCode();
    const reserved = await rpc('reserve_whatsapp_otp', {
      p_user: user.id, p_phone: phone, p_challenge: challenge,
      p_digest: await sign(user.id, phone, challenge, code)
    });
    if (!reserved) return json({error: 'cooldown'}, 429);

    return await sendWithFonnte(phone, code) ? json({challenge}) : json({error: 'delivery'}, 502);
  } catch {
    return json({error: 'unavailable'}, 503);
  }
});
