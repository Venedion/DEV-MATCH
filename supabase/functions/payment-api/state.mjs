import {matchingAmount, requireCondition, snapPageHours} from './midtrans.mjs';

const now = () => new Date().toISOString();
export const emptyState = () => ({room: null, payments: [], ledger: [], events: []});
export const terminal = status => ['PAID', 'EXPIRED', 'CANCELLED'].includes(status);
const clientActions = new Set(['accept', 'decline', 'revision', 'approve', 'cancel', 'dispute']);
const developerActions = new Set(['propose', 'progress', 'deliver', 'verify-payout', 'complete-payout', 'dispute']);

export function paymentSnapshot(state, role, checkoutConfigured) {
  return {
    role, checkoutConfigured, room: state.room, ledger: state.ledger,
    payments: state.payments.map(({order_id, kind, amount, status, paid_at}) => ({order_id, kind, amount, status, paid_at}))
  };
}

function text(value, label, limit = 2000) {
  requireCondition(typeof value === 'string' && value.trim() && value.trim().length <= limit,
    `${label} wajib diisi (maksimal ${limit} karakter).`, 400);
  return value.trim();
}

function deliveryLinks(value) {
  const links = text(value, 'Tautan hasil proyek').split(/\r?\n/).map(link => link.trim()).filter(Boolean);
  requireCondition(links.every(link => URL.canParse(link) && new URL(link).protocol === 'https:'),
    'Isi satu tautan HTTPS per baris.', 400);
  return links;
}

function record(state, entry, amount, orderId = null) {
  if (!state.ledger.some(row => row.entry === entry)) {
    state.ledger.push({entry, amount, order_id: orderId, recorded_at: now()});
  }
}

export function applyAction(state, role, {action, ...body}) {
  const permitted = role === 'reviewer' ? action === 'resolve-dispute'
    : (role === 'client' ? clientActions : developerActions).has(action);
  requireCondition(permitted, 'Aksi tidak tersedia untuk peran akun ini.', 403);
  const {room} = state;
  if (action === 'propose') {
    requireCondition(!room || room.proposal.status === 'DECLINED', 'Proposal sudah tersedia untuk proyek ini.');
    const {total, dpPercent} = body;
    requireCondition(Number.isInteger(total) && total >= 40000 && total <= 1000000000 &&
      [25, 50].includes(dpPercent), 'Masukkan total Rp40.000–Rp1 miliar dan pilih DP 25% atau 50%.', 400);
    const dp = Math.ceil(total * dpPercent / 100);
    const proposal = {
      name: text(body.name, 'Nama proyek', 120), description: text(body.description, 'Deskripsi'),
      scope: text(body.scope, 'Ruang lingkup'), deliverables: text(body.deliverables, 'Deliverables'),
      revisions: text(body.revisions, 'Ketentuan revisi'), duration: text(body.duration, 'Durasi', 120),
      total, dpPercent, dp, remaining: total - dp, status: 'PENDING'
    };
    state.room = {proposal, project: 'NOT_STARTED', escrow: 'AWAITING_DP', progress: []};
    return;
  }

  requireCondition(room, 'Proposal belum dibuat.', 404);
  const disputed = room.dispute?.status === 'NEEDS_REVIEW';
  requireCondition((disputed ? action === 'resolve-dispute' : action !== 'resolve-dispute') &&
    !['COMPLETED', 'CANCELLED'].includes(room.project), 'Proyek sudah ditutup atau sedang dalam dispute.');
  const accepted = room.proposal.status === 'ACCEPTED';
  const reviewing = room.project === 'AWAITING_CLIENT_APPROVAL' && !room.delivery?.approvedAt;

  switch (action) {
    case 'accept':
    case 'decline':
      requireCondition(room.proposal.status === 'PENDING', 'Proposal sudah ditinjau.');
      room.proposal.status = action === 'accept' ? 'ACCEPTED' : 'DECLINED';
      break;
    case 'progress':
      requireCondition(['IN_PROGRESS', 'REVISION'].includes(room.project), 'Progress tersedia setelah DP terverifikasi.');
      requireCondition(room.progress.length < 200, 'Batas pembaruan progress tercapai.');
      room.progress.push({title: text(body.title, 'Judul progress', 120), notes: text(body.notes, 'Catatan progress'),
        links: body.links ? deliveryLinks(body.links) : [], at: now()});
      break;
    case 'deliver':
      requireCondition(['IN_PROGRESS', 'REVISION'].includes(room.project), 'Proyek belum siap untuk final delivery.');
      room.delivery = {links: deliveryLinks(body.links), notes: text(body.notes, 'Catatan pengiriman'), at: now()};
      room.project = 'AWAITING_CLIENT_APPROVAL';
      break;
    case 'revision':
      requireCondition(reviewing, 'Final delivery sudah disetujui atau belum tersedia.');
      room.revision = {reason: text(body.reason, 'Alasan revisi'), at: now()};
      room.project = 'REVISION';
      break;
    case 'verify-payout':
      requireCondition(accepted && !room.demoPayoutVerified, 'Verifikasi tujuan payout belum tersedia.');
      room.demoPayoutVerified = true;
      break;
    case 'approve':
      requireCondition(reviewing, 'Final delivery sudah disetujui atau belum tersedia.');
      requireCondition(room.escrow === 'FULL_PAYMENT_HELD', 'DP dan pelunasan harus terverifikasi.');
      requireCondition(room.demoPayoutVerified, 'Developer harus memverifikasi tujuan payout demo.');
      room.delivery.approvedAt = now();
      startPayout(state, room.proposal.total, 'RELEASE_PENDING');
      break;
    case 'complete-payout':
      requireCondition(room.escrow === 'RELEASE_PENDING' && room.payout?.status === 'PROCESSING', 'Payout belum diproses.');
      room.payout.status = 'COMPLETED';
      room.escrow = 'RELEASED';
      room.project = 'COMPLETED';
      record(state, 'RELEASED', room.payout.net);
      break;
    case 'cancel':
      requireCondition(accepted && room.project === 'NOT_STARTED' &&
        state.payments.every(payment => ['EXPIRED', 'CANCELLED'].includes(payment.status)),
      'Pembatalan tersedia sebelum ada transaksi aktif.');
      room.project = 'CANCELLED';
      break;
    case 'dispute':
      requireCondition(accepted && !room.dispute, 'Dispute tersedia setelah proposal diterima dan hanya bisa diajukan sekali.');
      room.dispute = {status: 'NEEDS_REVIEW', openedBy: role, reason: text(body.reason, 'Alasan dispute'), at: now()};
      room.project = 'DISPUTED';
      break;
    case 'resolve-dispute':
      resolveDispute(state, body);
      break;
  }
}

function startPayout(state, amount, entry) {
  state.room.payout = {status: 'PROCESSING', gross: amount, fee: 0, net: amount};
  state.room.escrow = 'RELEASE_PENDING';
  record(state, entry, amount);
}

function resolveDispute(state, {outcome, partialRefund, decision}) {
  const {room, payments} = state;
  requireCondition(payments.every(payment => terminal(payment.status)), 'Selesaikan transaksi aktif sebelum review.');
  requireCondition(['RELEASE_TO_DEVELOPER', 'PARTIAL_REFUND', 'FULL_REFUND'].includes(outcome), 'Hasil review tidak valid.', 400);
  const paid = payments.filter(payment => payment.status === 'PAID').reduce((sum, payment) => sum + payment.amount, 0);
  const refund = outcome === 'FULL_REFUND' ? paid : outcome === 'PARTIAL_REFUND' ? partialRefund : 0;
  requireCondition(Number.isInteger(refund) && refund >= 0 && refund <= paid &&
    (outcome !== 'PARTIAL_REFUND' || (refund > 0 && refund < paid)), 'Nominal refund simulasi tidak valid.', 400);
  requireCondition(outcome !== 'RELEASE_TO_DEVELOPER' || paid > 0, 'Belum ada pembayaran yang dapat dicairkan.');
  const net = paid - refund;
  requireCondition(!net || room.demoPayoutVerified, 'Tujuan payout demo belum diverifikasi.');
  room.dispute = {...room.dispute, status: 'RESOLVED', outcome, refund, net,
    decision: text(decision, 'Alasan keputusan'), resolvedAt: now()};
  if (refund) record(state, outcome, refund);
  if (net) {
    startPayout(state, net, 'DISPUTE_RELEASE_PENDING');
    room.project = 'DISPUTE_RESOLVED';
  } else {
    delete room.payout;
    room.escrow = refund ? 'REFUNDED' : 'AWAITING_DP';
    room.project = 'CANCELLED';
  }
}

export function checkoutOrder(state, role, kind, makeId = () => `devmatch-${crypto.randomUUID()}`) {
  requireCondition(role === 'client', 'Pembayaran tersedia untuk Client.', 403);
  requireCondition(['DP', 'REMAINING'].includes(kind), 'Jenis pembayaran tidak valid.', 400);
  const {room, payments} = state;
  requireCondition(room?.proposal.status === 'ACCEPTED' && !room.dispute &&
    !['CANCELLED', 'COMPLETED'].includes(room.project), 'Proposal belum siap untuk pembayaran.');
  const existing = payments.find(payment => payment.kind === kind && !['EXPIRED', 'CANCELLED'].includes(payment.status));
  requireCondition(existing?.status !== 'PAID', 'Pembayaran sudah terverifikasi.');
  requireCondition(kind === 'DP' || room.escrow === 'DP_HELD', 'DP harus terverifikasi sebelum pelunasan.');
  if (existing) return {order: existing};
  requireCondition(payments.length < 100, 'Batas percobaan pembayaran untuk proyek ini tercapai.');
  const order = {order_id: makeId(), kind, amount: kind === 'DP' ? room.proposal.dp : room.proposal.remaining, status: 'PENDING'};
  payments.push(order);
  return {order, newOrderId: order.order_id};
}

function gatewayState({transaction_status, fraud_status}) {
  switch (transaction_status) {
    case 'settlement': return !fraud_status || fraud_status === 'accept' ? 'PAID' : 'PROCESSING';
    case 'capture': return fraud_status === 'accept' ? 'PAID' : 'PROCESSING';
    case 'authorize':
    case 'pending': return 'PROCESSING';
    case 'expire': return 'EXPIRED';
    case 'cancel': return 'CANCELLED';
    case 'deny':
    case 'failure': return 'FAILED';
    default: return null;
  }
}

export function reconcile(state, orderId, verified, event, time = Date.now()) {
  const order = state.payments.find(payment => payment.order_id === orderId);
  requireCondition(order, 'Order ID tidak ditemukan.', 404);
  if (!verified) {
    requireCondition(!event, 'Status transaksi belum tersedia di Midtrans.', 502);
    if (order.status === 'PENDING' && order.snapCreatedAt && order.snapCreatedAt + snapPageHours * 3600000 <= time) {
      order.status = 'EXPIRED';
    }
    return;
  }
  requireCondition(verified.order_id === orderId && matchingAmount(verified.gross_amount, order.amount) &&
    (!verified.currency || verified.currency === 'IDR'), 'Detail transaksi Midtrans tidak cocok.', 422);
  if (event) {
    requireCondition(matchingAmount(event.gross_amount, order.amount), 'Nominal webhook tidak cocok.', 422);
    const key = JSON.stringify([orderId, verified.transaction_id, verified.transaction_status, verified.status_code, verified.fraud_status]);
    if (!state.events.some(item => item.key === key)) state.events.push({key, at: now()});
  }
  const status = gatewayState(verified);
  if (!status || terminal(order.status) || time < (order.checkedAt ?? 0)) return;
  order.checkedAt = time;
  order.status = status;
  if (status !== 'PAID') return;
  order.paid_at = now();
  const dp = order.kind === 'DP';
  state.room.escrow = dp ? 'DP_HELD' : 'FULL_PAYMENT_HELD';
  if (dp && state.room.project === 'NOT_STARTED') state.room.project = 'IN_PROGRESS';
  record(state, state.room.escrow, order.amount, orderId);
}
