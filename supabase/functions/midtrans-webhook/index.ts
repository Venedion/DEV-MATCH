import {jsonResponse} from '../_shared/registration.mjs';
import {
  MidtransPaymentError,
  midtransGateway,
  paymentEnvironment,
  verifyMidtransSignature
} from '../_shared/midtrans-payment.mjs';
import {paymentsService} from '../payments/service.mjs';
import {supabasePaymentsStore} from '../payments/store.mjs';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
const environment = paymentEnvironment(Deno.env.get('MIDTRANS_ENVIRONMENT'));
const store = supabaseUrl && serviceRoleKey
  ? supabasePaymentsStore(supabaseUrl, serviceRoleKey)
  : null;
const gateway = midtransGateway({environment: environment.environment, serverKey});
const service = store && paymentsService(store, gateway);

async function readBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json') || !request.body) {
    throw new MidtransPaymentError(415, 'Content-Type application/json required.');
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
      throw new MidtransPaymentError(413, 'Request body is too large.');
    }
    content += decoder.decode(value, {stream: true});
  }
  try {
    const body = JSON.parse(content + decoder.decode());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypeError();
    return body;
  } catch {
    throw new MidtransPaymentError(400, 'Invalid notification body.');
  }
}

Deno.serve(async request => {
  let orderId = 'unknown';
  let status = 'rejected';
  try {
    if (request.method !== 'POST') throw new MidtransPaymentError(405, 'POST required.');
    if (!store || !service || !gateway.configured) {
      throw new MidtransPaymentError(503, 'Payment notification service is not configured.');
    }
    const body = await readBody(request);
    orderId = typeof body.order_id === 'string' ? body.order_id : 'unknown';
    if (!verifyMidtransSignature(body, serverKey)) {
      throw new MidtransPaymentError(401, 'Invalid Midtrans signature.');
    }
    const result = await service.webhook(body);
    status = result?.status || 'processed';
    console.info('Midtrans notification processed', orderId, status);
    return jsonResponse({received: true}, 200, null);
  } catch (error) {
    if (error instanceof MidtransPaymentError) {
      status = `rejected_${error.status}`;
      if (error.status === 422) console.warn('Midtrans notification rejected', orderId, status);
      if (error.status >= 500) console.error('Midtrans notification unavailable', orderId, status);
      return jsonResponse({error: error.message}, error.status, null);
    }
    status = 'processing_failed';
    console.error('Midtrans notification failed', orderId, status);
    return jsonResponse({error: 'Payment notification could not be processed.'}, 500, null);
  }
});
