import {createHash, timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';

const environments = {
  sandbox: {
    snapHost: 'https://app.sandbox.midtrans.com',
    statusHost: 'https://api.sandbox.midtrans.com',
    serverKeyPrefix: 'SB-Mid-server-'
  },
  production: {
    snapHost: 'https://app.midtrans.com',
    statusHost: 'https://api.midtrans.com',
    serverKeyPrefix: 'Mid-server-'
  }
};

export class MidtransPaymentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function paymentEnvironment(value) {
  const environment = value || 'sandbox';
  const config = environments[environment];
  if (!config) throw new MidtransPaymentError(503, 'Konfigurasi environment Midtrans tidak valid.');
  return {environment, ...config};
}

export function mapMidtransStatus({transaction_status: transactionStatus, fraud_status: fraudStatus}) {
  switch (transactionStatus) {
    case 'settlement': return 'paid';
    case 'capture': return fraudStatus === 'accept' ? 'paid' : 'pending';
    case 'pending':
    case 'authorize': return 'pending';
    case 'expire': return 'expired';
    case 'deny':
    case 'failure': return 'failed';
    case 'cancel': return 'cancelled';
    default: return null;
  }
}

export function matchingRupiahAmount(value, amount) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(\.0{1,2})?$/.test(value)) return false;
  const integer = Number(value);
  return Number.isSafeInteger(integer) && integer === amount;
}

function configuredReturnOrigin(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password ||
        !['', '/'].includes(url.pathname) || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function verifyMidtransSignature(body, serverKey) {
  const {order_id: orderId, status_code: statusCode, gross_amount: grossAmount, signature_key: signature} = body || {};
  if (typeof serverKey !== 'string' || !serverKey ||
      ![orderId, statusCode, grossAmount].every(value => typeof value === 'string') ||
      typeof signature !== 'string' || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHash('sha512')
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

export function midtransGateway({environment, serverKey, returnOrigin, request = fetch}) {
  const config = paymentEnvironment(environment);
  const configured = typeof serverKey === 'string' && serverKey.startsWith(config.serverKeyPrefix);
  const appOrigin = configuredReturnOrigin(returnOrigin);

  async function call(url, body) {
    if (!configured) {
      throw new MidtransPaymentError(503, `Server Key Midtrans ${config.environment} belum dikonfigurasi.`);
    }
    let response;
    let data;
    try {
      response = await request(url, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`,
          Accept: 'application/json',
          ...(body && {'Content-Type': 'application/json'})
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10000)
      });
      data = await response.json();
    } catch {
      throw new MidtransPaymentError(502, 'Midtrans tidak dapat dihubungi.');
    }
    if (!response.ok) {
      throw new MidtransPaymentError(502, 'Midtrans menolak permintaan pembayaran.');
    }
    return data;
  }

  return {
    configured,
    checkoutConfigured: configured && Boolean(appOrigin),
    environment: config.environment,
    snapHost: config.snapHost,
    async createDp({orderId, amount, paymentId, agreementId, conversationId}) {
      if (!appOrigin) {
        throw new MidtransPaymentError(503, 'URL kembali aplikasi belum dikonfigurasi.');
      }
      if (![paymentId, agreementId, conversationId].every(value =>
        typeof value === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))) {
        throw new MidtransPaymentError(400, 'Konteks agreement untuk URL kembali tidak valid.');
      }
      const finish = new URL('/devmatch-chat.html', appOrigin);
      finish.searchParams.set('conversation', conversationId);
      finish.searchParams.set('role', 'client');
      finish.searchParams.set('payment', 'return');
      finish.searchParams.set('paymentAgreement', agreementId);
      finish.searchParams.set('paymentId', paymentId);
      finish.searchParams.set('paymentOrderId', orderId);
      const result = await call(`${config.snapHost}/snap/v1/transactions`, {
        transaction_details: {order_id: orderId, gross_amount: amount},
        credit_card: {secure: true},
        expiry: {unit: 'hour', duration: 48},
        callbacks: {finish: finish.href}
      });
      if (typeof result?.token !== 'string' || !result.token.trim()) {
        throw new MidtransPaymentError(502, 'Midtrans tidak mengembalikan token Snap yang valid.');
      }
      return result.token;
    },
    status(orderId) {
      return call(`${config.statusHost}/v2/${encodeURIComponent(orderId)}/status`);
    }
  };
}
