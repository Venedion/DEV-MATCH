import {getCorsHeaders, jsonResponse} from '../_shared/registration.mjs';
import {
  MidtransPaymentError,
  midtransGateway,
  paymentEnvironment
} from '../_shared/midtrans-payment.mjs';
import {paymentsService} from './service.mjs';
import {supabasePaymentsStore} from './store.mjs';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const environment = paymentEnvironment(Deno.env.get('MIDTRANS_ENVIRONMENT'));
const store = supabaseUrl && serviceRoleKey
  ? supabasePaymentsStore(supabaseUrl, serviceRoleKey)
  : null;
const gateway = midtransGateway({
  environment: environment.environment,
  serverKey: Deno.env.get('MIDTRANS_SERVER_KEY'),
  returnOrigin: Deno.env.get('PAYMENT_RETURN_ORIGIN')
});
const service = store && paymentsService(store, gateway);

async function readBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json') || !request.body) {
    throw new MidtransPaymentError(415, 'Gunakan Content-Type application/json.');
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let size = 0;
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16384) {
      await reader.cancel();
      throw new MidtransPaymentError(413, 'Ukuran permintaan terlalu besar.');
    }
    content += decoder.decode(value, {stream: true});
  }
  try {
    const body = JSON.parse(content + decoder.decode());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypeError();
    return body;
  } catch {
    throw new MidtransPaymentError(400, 'Data JSON tidak valid.');
  }
}

Deno.serve(async request => {
  const cors = getCorsHeaders(request.headers.get('origin'));
  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, {status: cors ? 204 : 403, headers: cors || {}});
    }
    if (request.method !== 'POST') throw new MidtransPaymentError(405, 'Metode tidak tersedia.');
    if (!cors && request.headers.has('origin')) throw new MidtransPaymentError(403, 'Origin tidak diizinkan.');
    if (!store || !service) throw new MidtransPaymentError(503, 'Layanan pembayaran belum dikonfigurasi.');
    const user = await store.user(request.headers.get('authorization'));
    if (!user) throw new MidtransPaymentError(401, 'Login ke DEV-MATCH untuk melanjutkan.');
    return jsonResponse({data: await service.handle(user, await readBody(request))}, 200, cors);
  } catch (error) {
    if (error instanceof MidtransPaymentError) {
      return jsonResponse({error: error.message}, error.status, cors);
    }
    console.error('Payments function failed.', error instanceof Error ? error.name : typeof error);
    return jsonResponse({error: 'Layanan pembayaran sedang mengalami gangguan.'}, 500, cors);
  }
});
