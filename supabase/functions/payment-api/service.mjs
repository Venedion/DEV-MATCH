import {PaymentError, matchingAmount, requireCondition} from './midtrans.mjs';
import {agreementPaymentState, applyAction, checkoutOrder, emptyState, paymentSnapshot, reconcile, terminal} from './state.mjs';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const orderPattern = /^devmatch-[0-9a-f-]{36}$/i;

export function paymentService(store, gateway) {
  async function mutate(ref, load, update) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const loaded = await load();
      const {state: stored, role, version} = loaded;
      const state = stored || (ref.agreementId ? agreementPaymentState(loaded.agreement) : emptyState());
      const before = JSON.stringify(state);
      const result = update(state, role);
      if (before === JSON.stringify(state) || await store.save(ref, version, state, result?.newOrderId)) {
        return {state, role, result};
      }
    }
    throw new PaymentError(409, 'Room sedang diperbarui. Coba lagi.');
  }

  async function sync(ref, load, orderId, event) {
    const time = Date.now();
    const verified = await gateway.status(orderId);
    await mutate(ref, load, state => reconcile(state, orderId, verified, event, time));
  }

  async function makeCheckout(ref, load, kind) {
    requireCondition(gateway.configured, 'Midtrans Sandbox belum dikonfigurasi.', 503);
    const claim = crypto.randomUUID();
    const {result: {order}} = await mutate(ref, load, (state, role) => {
      const result = checkoutOrder(state, role, kind);
      if (result.order.checkoutUrl) return result;
      requireCondition(!result.order.claim || result.order.claim.until <= Date.now(),
        'Checkout sedang dibuat. Coba lagi sebentar.');
      result.order.claim = {id: claim, until: Date.now() + 20000};
      return result;
    });
    if (order.checkoutUrl) return {redirectUrl: order.checkoutUrl};

    let redirectUrl;
    try {
      redirectUrl = await gateway.create(order, ref.conversationId, 'client', ref.projectId, ref.agreementId);
    } catch (error) {
      await mutate(ref, () => store.state(ref), state => {
        const saved = state.payments.find(payment => payment.order_id === order.order_id);
        if (saved?.claim?.id === claim) delete saved.claim;
      });
      throw error;
    }

    await mutate(ref, () => store.state(ref), state => {
      const saved = state.payments.find(payment => payment.order_id === order.order_id);
      requireCondition(saved?.claim?.id === claim, 'Checkout sudah berubah. Perbarui status pembayaran.');
      saved.checkoutUrl = redirectUrl;
      saved.snapCreatedAt = Date.now();
      delete saved.claim;
    });
    const updated = await load();
    const saved = updated.state?.payments.find(payment => payment.order_id === order.order_id);
    requireCondition(!updated.state?.room?.dispute && saved && !terminal(saved.status),
      'Pembayaran sudah berakhir atau dibekukan karena dispute.');
    return {redirectUrl};
  }

  function withPaymentState(ref, result) {
    if (!result.state) {
      result.state = ref.agreementId ? agreementPaymentState(result.agreement) : emptyState();
    }
    return result;
  }

  return {
    async handle(user, body) {
      const {operation, conversationId, projectId, agreementId} = body;
      if (operation === 'reviews') return store.reviewerRooms(user);
      requireCondition(!Object.hasOwn(body, 'role'), 'Peran pembayaran ditentukan oleh peserta room.', 400);
      let ref;
      let load;
      if (typeof agreementId === 'string') {
        requireCondition(uuidPattern.test(agreementId), 'Agreement tidak valid.', 400);
        ref = {agreementId};
        load = async () => {
          const result = await store.context(user, ref);
          requireCondition(['client', 'developer', 'reviewer'].includes(result?.role),
            'Akun ini tidak memiliki akses pembayaran untuk agreement ini.', 403);
          return result;
        };
      } else {
        requireCondition(typeof conversationId === 'string' && uuidPattern.test(conversationId) &&
          typeof projectId === 'string' && /^[\w-]{1,160}$/.test(projectId), 'Room atau proyek tidak valid.', 400);
        const requested = {conversationId, projectId};
        let canonicalId;
        load = async () => {
          const result = await store.context(user, requested);
          requireCondition(['client', 'developer', 'reviewer'].includes(result?.role),
            'Akun ini tidak memiliki akses pembayaran untuk proyek di room ini.', 403);
          requireCondition(!canonicalId || canonicalId === (result.conversationId || conversationId),
            'Room pembayaran sedang diperbarui. Coba lagi.');
          return result;
        };
        const result = await load();
        canonicalId = result.conversationId || conversationId;
        ref = {conversationId: canonicalId, projectId};
      }
      let result = withPaymentState(ref, await load());
      if (ref.agreementId) ref.conversationId = result.conversationId;
      if (operation === 'checkout') {
        requireCondition(result.role === 'client', 'Pembayaran tersedia untuk Client.', 403);
        return makeCheckout(ref, load, body.kind);
      }
      if (operation === 'apply') {
        const result = await mutate(ref, load, (state, role) => applyAction(state, role, body));
        return paymentSnapshot(result.state, result.role, gateway.configured);
      }
      requireCondition(['snapshot', 'refresh'].includes(operation), 'Aksi pembayaran tidak valid.', 400);
      if (operation === 'refresh' && gateway.configured) {
        const active = (result.state?.payments || []).filter(payment => !terminal(payment.status));
        await Promise.all(active.map(payment => sync(ref, load, payment.order_id)));
        result = withPaymentState(ref, await load());
      }
      return paymentSnapshot(result.state || emptyState(), result.role, gateway.configured);
    },

    async webhook(body) {
      requireCondition(gateway.verify(body), 'Signature Midtrans tidak valid.', 401);
      const {order_id: orderId} = body;
      requireCondition(orderPattern.test(orderId) && typeof body.transaction_status === 'string' &&
        body.transaction_status.length <= 32 && typeof body.transaction_id === 'string' &&
        body.transaction_id.length <= 80, 'Notifikasi Midtrans tidak valid.', 400);
      const ref = await store.orderRef(orderId);
      requireCondition(ref, 'Order ID tidak ditemukan.', 404);
      const load = () => store.state(ref);
      const {state} = await load();
      const order = state?.payments.find(payment => payment.order_id === orderId);
      requireCondition(order && matchingAmount(body.gross_amount, order.amount),
        'Nominal pembayaran tidak cocok.', 422);
      await sync(ref, load, orderId, body);
    }
  };
}
