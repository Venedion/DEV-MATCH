import { createHash, timingSafeEqual } from 'node:crypto';

export const snapPageHours = 24;

export class PaymentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function midtransSandbox({ serverKey, clientKey, signatureSecret = serverKey, request = fetch }) {
  const configured = Boolean(serverKey?.startsWith('SB-Mid-server-') && clientKey?.startsWith('SB-Mid-client-'));

  async function call(url, payload) {
    if (!configured) throw new PaymentError(503, 'Isi Client Key dan Server Key Midtrans Sandbox di server.');
    let response;
    let data;
    try {
      response = await request(url, {
        method: payload ? 'POST' : 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`,
          Accept: 'application/json',
          ...(payload && { 'Content-Type': 'application/json' })
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(10000)
      });
      data = await response.json();
    } catch {
      throw new PaymentError(502, 'Midtrans Sandbox tidak dapat dihubungi. Coba lagi.');
    }
    if (!payload && (response.status === 404 || Number(data.status_code) === 404)) return null;
    if (!response.ok || (payload ? Number(data.status_code) >= 400 : typeof data.transaction_status !== 'string')) {
      throw new PaymentError(502, 'Midtrans Sandbox menolak permintaan. Periksa konfigurasi atau coba lagi.');
    }
    return data;
  }

  return {
    clientKey: configured ? clientKey : '',
    async create(orderId, amount) {
      const result = await call('https://app.sandbox.midtrans.com/snap/v1/transactions', {
        transaction_details: { order_id: orderId, gross_amount: amount },
        credit_card: { secure: true },
        page_expiry: { duration: snapPageHours, unit: 'hour' }
      });
      if (typeof result.token !== 'string' || !result.token) {
        throw new PaymentError(502, 'Midtrans tidak mengembalikan token Snap.');
      }
      return result.token;
    },
    status(orderId) {
      return call(`https://api.sandbox.midtrans.com/v2/${encodeURIComponent(orderId)}/status`);
    },
    verify(notification) {
      const { order_id, status_code, gross_amount, signature_key } = notification;
      if (!configured || !signatureSecret || ![order_id, status_code, gross_amount].every(value => typeof value === 'string') ||
          typeof signature_key !== 'string' || !/^[a-f0-9]{128}$/i.test(signature_key)) return false;
      const expected = createHash('sha512').update(order_id + status_code + gross_amount + signatureSecret).digest();
      return timingSafeEqual(expected, Buffer.from(signature_key, 'hex'));
    }
  };
}

export function matchingAmount(value, amount) {
  return typeof value === 'string' && /^(0|[1-9]\d*)(\.0{1,2})?$/.test(value) && Number(value) === amount;
}
