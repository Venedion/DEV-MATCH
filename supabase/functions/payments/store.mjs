import {MidtransPaymentError} from '../_shared/midtrans-payment.mjs';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function supabasePaymentsStore(url, serviceKey, request = fetch) {
  const headers = {apikey: serviceKey, Authorization: `Bearer ${serviceKey}`};

  async function call(path, options = {}) {
    const response = await request(new URL(path, url), {
      ...options,
      headers: {...headers, ...options.headers},
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      throw new MidtransPaymentError(502, 'Database pembayaran belum dapat digunakan.');
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function rpc(name, body) {
    return call(`/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
  }

  async function one(table, query) {
    const rows = await call(`/rest/v1/${table}?${new URLSearchParams({...query, limit: '1'})}`);
    return rows[0] || null;
  }

  return {
    async user(authorization) {
      if (!/^Bearer\s+\S+$/i.test(authorization || '')) return null;
      const response = await request(new URL('/auth/v1/user', url), {
        headers: {...headers, Authorization: authorization},
        signal: AbortSignal.timeout(8000)
      });
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) throw new MidtransPaymentError(503, 'Sesi login Supabase tidak dapat diverifikasi.');
      const user = await response.json();
      return uuidPattern.test(user?.id || '') ? user.id : null;
    },
    claimDp(agreementId, payerId) {
      return rpc('payments_claim_dp_transaction', {
        p_agreement_id: agreementId,
        p_payer_id: payerId
      });
    },
    storeSnapToken(paymentId, claimId, snapToken) {
      return rpc('payments_store_snap_token', {
        p_payment_id: paymentId,
        p_claim_id: claimId,
        p_snap_token: snapToken
      });
    },
    releaseCheckoutClaim(paymentId, claimId) {
      return rpc('payments_release_checkout_claim', {
        p_payment_id: paymentId,
        p_claim_id: claimId
      });
    },
    paymentByOrder(orderId) {
      return one('payments', {
        select: 'id,agreement_id,payer_id,payee_id,kind,amount,status,expires_at,snap_token,last_midtrans_status,midtrans_order_id',
        midtrans_order_id: `eq.${orderId}`
      });
    },
    agreement(agreementId) {
      return one('project_agreements', {
        select: 'id,proposal_id,conversation_id,developer_id,client_id,terms,total_price,dp_amount,payment_status,created_at',
        id: `eq.${agreementId}`
      });
    },
    applyMidtransStatus(orderId, amount, status, midtransStatus, initialState) {
      return rpc('payments_apply_midtrans_status', {
        p_order_id: orderId,
        p_gross_amount: amount,
        p_status: status,
        p_midtrans_status: midtransStatus,
        p_initial_state: initialState
      });
    }
  };
}
