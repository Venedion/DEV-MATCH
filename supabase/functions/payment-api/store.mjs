import {PaymentError} from './midtrans.mjs';

export function supabasePaymentStore(url, key, request = fetch) {
  const bearer = {apikey: key, Authorization: `Bearer ${key}`};
  const args = ref => ({p_conversation: ref.conversationId, p_project: ref.projectId});

  async function rpc(name, body) {
    return call(`/rest/v1/rpc/${name}`, {
      method: 'POST', headers: {...bearer, 'Content-Type': 'application/json'}, body: JSON.stringify(body)
    });
  }

  async function call(path, options) {
    const response = await request(new URL(path, url), {...options, signal: AbortSignal.timeout(8000)});
    if (!response.ok) {
      console.error('Payment database request failed', response.status, path.split('?')[0]);
      throw new PaymentError(502, 'Database pembayaran belum dapat digunakan.');
    }
    return response.json();
  }

  async function one(table, params) {
    const rows = await call(`/rest/v1/${table}?${new URLSearchParams({...params, limit: '1'})}`, {headers: bearer});
    return rows[0] || null;
  }

  return {
    async user(authorization) {
      if (!/^Bearer [^\s]+$/.test(authorization || '')) return null;
      const response = await request(new URL('/auth/v1/user', url), {
        headers: {apikey: key, Authorization: authorization}, signal: AbortSignal.timeout(8000)
      });
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) throw new PaymentError(502, 'Sesi login Supabase tidak dapat diverifikasi.');
      return (await response.json()).id || null;
    },
    context(user, ref) {
      return rpc('payment_room_context', {p_user: user, ...args(ref)});
    },
    reviewerRooms(user) {
      return rpc('payment_reviewer_rooms', {p_user: user});
    },
    save(ref, version, state, orderId = null) {
      return rpc('payment_save_room', {...args(ref), p_version: version, p_state: state, p_order_id: orderId});
    },
    async state(ref) {
      return await one('payment_rooms', {select: 'version,state', conversation_id: `eq.${ref.conversationId}`,
        project_id: `eq.${ref.projectId}`}) || {version: 0, state: null};
    },
    async orderRef(orderId) {
      const row = await one('payment_order_refs', {select: 'conversation_id,project_id', order_id: `eq.${orderId}`});
      return row && {conversationId: row.conversation_id, projectId: row.project_id};
    }
  };
}
