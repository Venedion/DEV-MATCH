import {createHash, timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';

export const snapPageHours = 24;
export const sandboxHost = 'https://app.sandbox.midtrans.com';

export class PaymentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function requireCondition(condition, message, status = 409) {
  if (!condition) throw new PaymentError(status, message);
}

export function matchingAmount(value, integer) {
  return typeof value === 'string' && /^(0|[1-9]\d*)(\.0{1,2})?$/.test(value) && Number(value) === integer;
}

export function sandboxGateway({serverKey, signatureSecret = serverKey, returnOrigin, request = fetch}) {
  const configured = Boolean(serverKey?.startsWith('SB-Mid-server-'));

  async function call(url, payload) {
    requireCondition(configured, 'Server Key Midtrans Sandbox belum dikonfigurasi.', 503);
    let response;
    let data;
    try {
      response = await request(url, {
        method: payload ? 'POST' : 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`,
          Accept: 'application/json',
          ...(payload && {'Content-Type': 'application/json'})
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(10000)
      });
      data = await response.json();
    } catch {
      throw new PaymentError(502, 'Midtrans Sandbox tidak dapat dihubungi.');
    }
    if (!payload && (response.status === 404 || Number(data.status_code) === 404)) return null;
    requireCondition(response.ok && (payload || typeof data.transaction_status === 'string'),
      'Midtrans Sandbox menolak permintaan. Periksa konfigurasi atau coba lagi.', 502);
    return data;
  }

  return {
    configured,
    async create(order, conversationId, role, projectId, agreementId) {
      const finish = new URL('/devmatch-chat.html', returnOrigin);
      finish.searchParams.set('conversation', conversationId);
      if (role === 'client') finish.searchParams.set('role', 'client');
      finish.searchParams.set('payment', 'return');
      if (projectId) finish.searchParams.set('paymentProject', projectId);
      if (agreementId) finish.searchParams.set('paymentAgreement', agreementId);
      const result = await call(`${sandboxHost}/snap/v1/transactions`, {
        transaction_details: {order_id: order.order_id, gross_amount: order.amount},
        credit_card: {secure: true},
        page_expiry: {duration: snapPageHours, unit: 'hour'},
        callbacks: {finish: finish.href}
      });
      const redirect = URL.canParse(result.redirect_url) && new URL(result.redirect_url);
      requireCondition(redirect && redirect.origin === sandboxHost && redirect.pathname.startsWith('/snap/'),
        'Midtrans tidak mengembalikan checkout Sandbox yang valid.', 502);
      return redirect.href;
    },
    status(orderId) {
      return call(`https://api.sandbox.midtrans.com/v2/${encodeURIComponent(orderId)}/status`);
    },
    verify({order_id, status_code, gross_amount, signature_key}) {
      if (!configured || !signatureSecret || ![order_id, status_code, gross_amount].every(value => typeof value === 'string') ||
          typeof signature_key !== 'string' || !/^[a-f0-9]{128}$/i.test(signature_key)) return false;
      const expected = createHash('sha512').update(order_id + status_code + gross_amount + signatureSecret).digest();
      return timingSafeEqual(expected, Buffer.from(signature_key, 'hex'));
    }
  };
}
