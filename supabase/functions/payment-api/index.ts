import {getCorsHeaders, jsonResponse} from '../_shared/registration.mjs';
import {PaymentError, sandboxGateway} from './midtrans.mjs';
import {paymentService} from './service.mjs';
import {supabasePaymentStore} from './store.mjs';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const store = supabaseUrl && serviceKey ? supabasePaymentStore(supabaseUrl, serviceKey) : null;
const gateway = sandboxGateway({
  serverKey: Deno.env.get('MIDTRANS_SERVER_KEY'),
  clientKey: Deno.env.get('MIDTRANS_CLIENT_KEY'),
  signatureSecret: Deno.env.get('MIDTRANS_SIGNATURE_SECRET') || undefined,
  returnOrigin: Deno.env.get('PAYMENT_RETURN_ORIGIN') || 'https://devm4tch.vercel.app'
});
const service = store && paymentService(store, gateway);

async function readBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json') || !request.body) {
    throw new PaymentError(415, 'Gunakan Content-Type application/json.');
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let content = '';
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 32768) {
      await reader.cancel();
      throw new PaymentError(413, 'Ukuran permintaan terlalu besar.');
    }
    content += decoder.decode(value, {stream: true});
  }
  try {
    const body = JSON.parse(content + decoder.decode());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypeError();
    return body;
  } catch {
    throw new PaymentError(400, 'Data JSON tidak valid.');
  }
}

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  const cors = getCorsHeaders(origin);
  const webhook = new URL(request.url).pathname.endsWith('/payment-api/webhook');
  try {
    if (request.method === 'OPTIONS') return new Response(null, {status: cors ? 204 : 403, headers: cors || {}});
    if (request.method !== 'POST') throw new PaymentError(405, 'Metode tidak tersedia.');
    if (!store || !service) throw new PaymentError(503, 'Konfigurasi pembayaran belum tersedia.');
    if (webhook) {
      await service.webhook(await readBody(request));
      return jsonResponse({received: true}, 200, null);
    }
    if (origin && !cors) throw new PaymentError(403, 'Origin pembayaran tidak diizinkan.');
    const user = await store.user(request.headers.get('authorization'));
    if (!user) throw new PaymentError(401, 'Login ke DEV-MATCH untuk membuka pembayaran.');
    const data = await service.handle(user, await readBody(request));
    return jsonResponse({data}, 200, cors);
  } catch (error) {
    if (error instanceof PaymentError) return jsonResponse({error: error.message}, error.status, cors);
    console.error('Payment API error', error instanceof Error ? error.name : typeof error);
    return jsonResponse({error: 'Layanan pembayaran sedang mengalami gangguan.'}, 500, cors);
  }
});
