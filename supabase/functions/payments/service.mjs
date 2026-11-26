import {
  mapMidtransStatus,
  matchingRupiahAmount,
  MidtransPaymentError
} from '../_shared/midtrans-payment.mjs';
import {agreementPaymentState} from '../payment-api/state.mjs';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireCondition(condition, message, status = 400) {
  if (!condition) throw new MidtransPaymentError(status, message);
}

export function paymentsService(store, gateway) {
  async function applyVerifiedStatus(payment, result) {
    requireCondition(result?.order_id === payment.midtrans_order_id, 'Order ID Midtrans tidak cocok.', 422);
    const amount = Number(payment.amount);
    requireCondition(
      Number.isSafeInteger(amount) && amount > 0,
      'Nominal pembayaran tidak valid.',
      409
    );
    requireCondition(
      matchingRupiahAmount(result.gross_amount, amount),
      'Nominal pembayaran Midtrans tidak cocok.',
      422
    );
    const mappedStatus = mapMidtransStatus(result);
    if (!mappedStatus) return {status: payment.status, changed: false};

    const agreement = await store.agreement(payment.agreement_id);
    requireCondition(agreement, 'Agreement pembayaran tidak ditemukan.', 404);
    const initialState = agreementPaymentState(agreement);
    return store.applyMidtransStatus(
      payment.midtrans_order_id,
      amount,
      mappedStatus,
      result.transaction_status,
      initialState
    );
  }

  return {
    async createDpTransaction(userId, body) {
      requireCondition(uuidPattern.test(body?.agreementId || ''), 'Agreement tidak valid.');
      requireCondition(gateway.configured, 'Konfigurasi Midtrans belum tersedia.', 503);
      requireCondition(gateway.checkoutConfigured, 'URL kembali aplikasi belum dikonfigurasi.', 503);
      let claimed = await store.claimDp(body.agreementId, userId);
      let payment = claimed?.payment;
      requireCondition(payment, 'Transaksi DP tidak dapat dibuat.', 503);
      if (claimed.expired_checkout) {
        const status = await gateway.status(payment.midtrans_order_id);
        const applied = await applyVerifiedStatus(payment, status);
        if (applied.status === 'pending') {
          throw new MidtransPaymentError(
            409,
            'Status transaksi sebelumnya masih menunggu konfirmasi Midtrans.'
          );
        }
        if (applied.status === 'paid') {
          throw new MidtransPaymentError(409, 'DP agreement ini sudah terverifikasi.');
        }
        if (applied.status === 'expired') {
          throw new MidtransPaymentError(409, 'Pembayaran DP kedaluwarsa; agreement dibatalkan.');
        }
        claimed = await store.claimDp(body.agreementId, userId);
        payment = claimed?.payment;
        requireCondition(payment && !claimed.expired_checkout, 'Transaksi DP tidak dapat dibuat.', 503);
      }
      const amount = Number(payment.amount);
      requireCondition(
        Number.isSafeInteger(amount) && amount > 0,
        'Nominal DP agreement tidak valid.',
        409
      );
      if (payment.snap_token) {
        return {
          paymentId: payment.id,
          orderId: payment.midtrans_order_id,
          snapToken: payment.snap_token,
          expiresAt: payment.expires_at
        };
      }
      if (!claimed.needs_snap) {
        throw new MidtransPaymentError(409, 'Checkout DP sedang disiapkan. Coba lagi sebentar.');
      }
      try {
        const agreement = await store.agreement(payment.agreement_id);
        requireCondition(
          agreement && agreement.id === payment.agreement_id &&
            uuidPattern.test(agreement.conversation_id || ''),
          'Konteks agreement untuk URL kembali tidak tersedia.',
          409
        );
        const snapToken = await gateway.createDp({
          orderId: payment.midtrans_order_id,
          amount,
          paymentId: payment.id,
          agreementId: payment.agreement_id,
          conversationId: agreement.conversation_id
        });
        const saved = await store.storeSnapToken(payment.id, claimed.claim_id, snapToken);
        requireCondition(saved?.snap_token === snapToken, 'Token Snap tidak dapat disimpan.', 503);
        return {
          paymentId: payment.id,
          orderId: payment.midtrans_order_id,
          snapToken,
          expiresAt: payment.expires_at
        };
      } catch (error) {
        await store.releaseCheckoutClaim(payment.id, claimed.claim_id);
        throw error;
      }
    },

    async refreshStatus(userId, body) {
      requireCondition(uuidPattern.test(body?.paymentId || ''), 'Pembayaran tidak valid.');
      requireCondition(
        /^devmatch-dp-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          .test(body?.orderId || ''),
        'Order pembayaran tidak valid.'
      );
      const payment = await store.paymentByOrder(body.orderId);
      requireCondition(payment && payment.id === body.paymentId, 'Pembayaran tidak ditemukan.', 404);
      requireCondition(
        [payment.payer_id, payment.payee_id].includes(userId),
        'Akun ini tidak memiliki akses ke pembayaran.',
        403
      );
      if (payment.status !== 'pending') {
        return {paymentId: payment.id, status: payment.status};
      }
      requireCondition(gateway.configured, 'Konfigurasi Midtrans belum tersedia.', 503);
      const result = await gateway.status(payment.midtrans_order_id);
      const applied = await applyVerifiedStatus(payment, result);
      return {paymentId: payment.id, status: applied.status};
    },

    async handle(userId, body) {
      if (body?.action === 'create-dp-transaction') {
        return this.createDpTransaction(userId, body);
      }
      if (body?.action === 'refresh-status') {
        return this.refreshStatus(userId, body);
      }
      throw new MidtransPaymentError(400, 'Aksi pembayaran tidak valid.');
    },

    async webhook(body) {
      const payment = await store.paymentByOrder(body?.order_id);
      requireCondition(payment, 'Order ID pembayaran tidak ditemukan.', 404);
      if (!matchingRupiahAmount(body.gross_amount, Number(payment.amount))) {
        console.warn('Midtrans amount mismatch', payment.id, 'gross_amount_mismatch');
        throw new MidtransPaymentError(422, 'Nominal pembayaran Midtrans tidak cocok.');
      }
      requireCondition(
        typeof body.transaction_status === 'string' &&
        typeof body.status_code === 'string' &&
        typeof body.transaction_id === 'string',
        'Notifikasi Midtrans tidak valid.',
        400
      );
      return applyVerifiedStatus(payment, body);
    }
  };
}
