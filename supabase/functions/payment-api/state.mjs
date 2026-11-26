import {matchingAmount, requireCondition} from './midtrans.mjs';

const now = () => new Date().toISOString();
export const emptyState = () => ({room: null, payments: [], ledger: [], events: []});
export const terminal = status => ['PAID', 'EXPIRED', 'CANCELLED'].includes(status);
const clientActions = new Set([
  'accept', 'decline', 'revision', 'approve', 'approve-progress', 'request-progress-update', 'accept-result',
  'rate', 'cancel', 'dispute'
]);
const developerActions = new Set([
  'propose', 'progress', 'deliver', 'handover', 'rate', 'verify-payout',
  'complete-payout', 'dispute'
]);
const DAY_MS = 24 * 60 * 60 * 1000;
const progressFileTypes = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function agreementPaymentState(agreement) {
  const terms = agreement?.terms?.terms;
  const total = Number(agreement?.total_price);
  const dp = Number(agreement?.dp_amount);
  requireCondition(agreement?.id && terms && Number.isSafeInteger(total) && total > 0 &&
    Number.isSafeInteger(dp) && dp > 0 && dp <= total,
  'Agreement pembayaran tidak valid.', 409);
  const scopeItems = Array.isArray(terms.scope) ? terms.scope : [];
  const revisionCount = Number(terms.revisionCount);
  return {
    room: {
      proposal: {
        agreementId: agreement.id,
        createdAt: agreement.created_at || now(),
        name: terms.projectName,
        description: terms.description,
        scope: scopeItems.join('\n'),
        scopeItems,
        deliverables: scopeItems.join('\n'),
        revisions: terms.revisionNotes || `${revisionCount} free revision rounds`,
        revisionCount,
        revisionNotes: terms.revisionNotes || '',
        duration: terms.deadline,
        deadline: terms.deadline,
        total,
        dpPercent: Number(terms.dpPercent),
        dp,
        remaining: total - dp,
        status: 'ACCEPTED'
      },
      project: 'NOT_STARTED',
      escrow: 'AWAITING_DP',
      timelineVersion: 2,
      progress: [],
      progressReview: null,
      handover: null,
      releases: [],
      ratings: {client: null, developer: null},
      timeline: {
        agreementCreatedAt: agreement.created_at || now(),
        dpPaidAt: null,
        progressSubmittedAt: null,
        progressApprovedAt: null,
        dpReleasedAt: null,
        finalProofSharedAt: null,
        remainingPaidAt: null,
        handoverAt: null,
        resultAcceptedAt: null,
        autoAcceptedAt: null,
        problemReportedAt: null,
        ratings: {clientAt: null, developerAt: null}
      },
      revisionsUsed: 0
    },
    payments: [],
    ledger: [],
    events: []
  };
}

export function paymentSnapshot(state, role, checkoutConfigured) {
  return {
    role, checkoutConfigured, room: state.room, ledger: state.ledger,
    payments: state.payments.map(({order_id, kind, amount, status, paid_at}) =>
      ({order_id, kind, amount, status, paid_at}))
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

function progressFile(file, agreementId, actorId, type, maximumBytes) {
  requireCondition(file && typeof file === 'object' && !Array.isArray(file), 'File progress tidak valid.', 400);
  const prefix = `${agreementId}/${actorId}/`;
  const name = text(file.name, 'Nama file', 120);
  requireCondition(typeof file.path === 'string' && file.path.startsWith(prefix) &&
    /^[A-Za-z0-9._-]{1,180}$/.test(file.path.slice(prefix.length)),
  'Lokasi file progress tidak valid.', 400);
  requireCondition(progressFileTypes.has(file.type) && (type === 'video'
    ? file.type.startsWith('video/') : file.type.startsWith('image/')),
  'Format file progress tidak didukung.', 400);
  requireCondition(Number.isSafeInteger(file.size) && file.size > 0 && file.size <= maximumBytes,
    'Ukuran file progress tidak valid.', 400);
  const result = {path: file.path, name, type: file.type, size: file.size};
  if (type === 'video') {
    requireCondition(Number.isFinite(file.durationSeconds) && file.durationSeconds > 0 &&
      file.durationSeconds <= 300, 'Durasi video maksimal 5 menit.', 400);
    result.durationSeconds = Math.ceil(file.durationSeconds);
  }
  return result;
}

function record(state, entry, amount, orderId = null) {
  if (!state.ledger.some(row => row.entry === entry)) {
    state.ledger.push({entry, amount, order_id: orderId, recorded_at: now()});
  }
}

function agreementRoom(room) {
  return Boolean(room?.proposal?.agreementId);
}

function stagedAgreement(room) {
  return agreementRoom(room) && room.timelineVersion === 2;
}

function ensureAgreementTimeline(room) {
  if (!stagedAgreement(room)) return;
  room.releases ||= [];
  room.ratings ||= {client: null, developer: null};
  room.timeline ||= {};
  const timeline = room.timeline;
  timeline.agreementCreatedAt ||= room.proposal.createdAt || null;
  timeline.dpPaidAt ||= null;
  if (!Object.hasOwn(timeline, 'progressSubmittedAt')) {
    timeline.progressSubmittedAt = room.progress?.[0]?.at || null;
  }
  timeline.progressApprovedAt ||= null;
  timeline.dpReleasedAt ||= null;
  timeline.finalProofSharedAt ||= room.delivery?.at || null;
  timeline.remainingPaidAt ||= null;
  timeline.handoverAt ||= room.handover?.at || null;
  timeline.resultAcceptedAt ||= room.result?.acceptedAt || null;
  timeline.autoAcceptedAt ||= room.result?.autoAcceptedAt || null;
  timeline.problemReportedAt ||= room.dispute?.at || null;
  timeline.ratings ||= {clientAt: null, developerAt: null};
  if (!room.progressReview && room.progress?.length && !room.delivery && !timeline.progressApprovedAt) {
    const submittedAt = room.progress[0].at;
    room.progressReview = {
      status: 'PENDING',
      submittedAt,
      deadlineAt: new Date(Date.parse(submittedAt) + 5 * DAY_MS).toISOString(),
      approvedAt: null,
      autoApproved: false
    };
  }
}

function addRelease(state, kind, amount, at) {
  const {room} = state;
  room.releases ||= [];
  if (room.releases.some(release => release.kind === kind)) return;
  room.releases.push({kind, amount, at});
  record(state, `${kind}_RELEASED`, amount);
}

function approveProgress(state, at, automatic = false) {
  const {room} = state;
  if (room.progressReview?.status !== 'PENDING' || room.dispute) return false;
  room.progressReview.status = automatic ? 'AUTO_APPROVED' : 'APPROVED';
  room.progressReview.approvedAt = at;
  room.progressReview.autoApproved = automatic;
  room.timeline.progressApprovedAt = at;
  room.timeline.dpReleasedAt = at;
  room.project = 'IN_PROGRESS';
  room.escrow = 'DP_RELEASED';
  addRelease(state, 'DP', room.proposal.dp, at);
  return true;
}

function acceptResult(state, at, automatic = false) {
  const {room} = state;
  if (room.handover?.status !== 'AWAITING_CLIENT' || room.dispute) return false;
  room.handover.status = automatic ? 'AUTO_ACCEPTED' : 'ACCEPTED';
  room.result = {acceptedAt: at, autoAcceptedAt: automatic ? at : null};
  room.timeline.resultAcceptedAt = at;
  room.timeline.autoAcceptedAt = automatic ? at : null;
  room.project = 'COMPLETED';
  room.escrow = 'RELEASED';
  addRelease(state, 'REMAINING', room.proposal.remaining, at);
  return true;
}

export function processDueTransitions(state, time = Date.now()) {
  const {room} = state;
  if (!stagedAgreement(room) || !room || room.dispute) return false;
  ensureAgreementTimeline(room);
  let changed = false;
  const progressDeadline = Date.parse(room.progressReview?.deadlineAt || '');
  if (room.progressReview?.status === 'PENDING' && Number.isFinite(progressDeadline) &&
      progressDeadline <= time) {
    changed = approveProgress(state, new Date(progressDeadline).toISOString(), true) || changed;
  }
  const handoverDeadline = Date.parse(room.handover?.deadlineAt || '');
  if (room.handover?.status === 'AWAITING_CLIENT' && Number.isFinite(handoverDeadline) &&
      handoverDeadline <= time) {
    changed = acceptResult(state, new Date(handoverDeadline).toISOString(), true) || changed;
  }
  return changed;
}

export function applyAction(state, role, {action, ...body}, actorId = null) {
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
  const isAgreement = stagedAgreement(room);
  if (isAgreement) ensureAgreementTimeline(room);
  const disputed = room.dispute?.status === 'NEEDS_REVIEW';
  const canRateCompletedAgreement = isAgreement && action === 'rate' &&
    ['client', 'developer'].includes(role);
  const alreadyAutoAccepted = isAgreement && action === 'accept-result' &&
    room.handover?.status === 'AUTO_ACCEPTED';
  requireCondition((disputed ? action === 'resolve-dispute' : action !== 'resolve-dispute') &&
    (!['COMPLETED', 'CANCELLED'].includes(room.project) ||
      canRateCompletedAgreement || alreadyAutoAccepted),
  'Proyek sudah ditutup atau sedang dalam dispute.');
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
      if (isAgreement) {
        requireCondition(room.progressReview?.status !== 'PENDING',
          'Progress sebelumnya masih menunggu review Client.');
        requireCondition(!room.timeline.progressSubmittedAt && room.escrow === 'DP_HELD',
          'Progress tahap ini sudah dikirim.');
      }
      requireCondition(room.progress.length < 200, 'Batas pembaruan progress tercapai.');
      {
        const submittedAt = now();
        let progress;
        if (body.video !== undefined) {
          requireCondition(isAgreement && uuidPattern.test(actorId || ''),
            'Upload file hanya tersedia untuk agreement.', 400);
          const video = progressFile(body.video, room.proposal.agreementId, actorId, 'video', 50 * 1024 * 1024);
          const screenshots = body.screenshots || [];
          requireCondition(Array.isArray(screenshots) && screenshots.length <= 5,
            'Maksimal 5 screenshot dapat diunggah.', 400);
          const scopeItems = room.proposal.scopeItems || [];
          const scope = body.scope;
          requireCondition(Array.isArray(scope) && scope.length > 0 &&
            scope.length <= scopeItems.length && new Set(scope).size === scope.length &&
            scope.every(item => typeof item === 'string' && scopeItems.includes(item)),
          'Pilih setidaknya satu scope point yang ada di agreement.', 400);
          progress = {
            title: video.name,
            notes: text(body.notes, 'Catatan progress', 500),
            scope,
            video,
            screenshots: screenshots.map(file =>
              progressFile(file, room.proposal.agreementId, actorId, 'image', 5 * 1024 * 1024)),
            links: body.links ? deliveryLinks(body.links) : [],
            at: submittedAt
          };
        } else {
          progress = {
            title: text(body.title, 'Judul progress', 120),
            notes: text(body.notes, 'Catatan progress'),
            links: body.links ? deliveryLinks(body.links) : [],
            at: submittedAt
          };
        }
        room.progress.push(progress);
        if (isAgreement && !room.timeline.progressSubmittedAt) {
          room.progressReview = {
            status: 'PENDING',
            submittedAt,
            deadlineAt: new Date(Date.parse(submittedAt) + 5 * DAY_MS).toISOString(),
            approvedAt: null,
            autoApproved: false
          };
          room.timeline.progressSubmittedAt = submittedAt;
          room.project = 'AWAITING_PROGRESS_REVIEW';
        }
      }
      break;
    case 'approve-progress':
      if (isAgreement && role === 'client' && room.progressReview?.status === 'AUTO_APPROVED') return;
      requireCondition(isAgreement && role === 'client' &&
        room.progressReview?.status === 'PENDING', 'Progress belum menunggu persetujuan.');
      requireCondition(approveProgress(state, now()), 'Progress tidak dapat disetujui.');
      break;
    case 'request-progress-update':
      requireCondition(isAgreement && role === 'client' &&
        room.progressReview?.status === 'PENDING', 'Progress belum menunggu review Client.');
      room.progressReview = {
        ...room.progressReview,
        status: 'UPDATE_REQUESTED',
        requestReason: text(body.reason, 'Alasan permintaan update', 500),
        requestedAt: now()
      };
      room.timeline.progressSubmittedAt = null;
      room.project = 'IN_PROGRESS';
      break;
    case 'deliver':
      requireCondition(['IN_PROGRESS', 'REVISION'].includes(room.project), 'Proyek belum siap untuk final delivery.');
      if (isAgreement) {
        requireCondition(room.progressReview?.approvedAt, 'Progress harus disetujui sebelum final proof.');
      }
      room.delivery = {links: deliveryLinks(body.links), notes: text(body.notes, 'Catatan pengiriman'), at: now()};
      room.timeline && (room.timeline.finalProofSharedAt = room.delivery.at);
      room.project = isAgreement ? 'AWAITING_REMAINING_PAYMENT' : 'AWAITING_CLIENT_APPROVAL';
      break;
    case 'handover':
      requireCondition(isAgreement && role === 'developer' &&
        room.project === 'AWAITING_HANDOVER' && room.escrow === 'REMAINING_HELD',
      'Handover tersedia setelah pembayaran sisa terverifikasi.');
      {
        const handedOverAt = now();
        room.handover = {
          status: 'AWAITING_CLIENT',
          at: handedOverAt,
          deadlineAt: new Date(Date.parse(handedOverAt) + 7 * DAY_MS).toISOString(),
          notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : ''
        };
        room.timeline.handoverAt = handedOverAt;
        room.project = 'AWAITING_RESULT_ACCEPTANCE';
      }
      break;
    case 'accept-result':
      if (alreadyAutoAccepted) return;
      requireCondition(isAgreement && role === 'client' &&
        room.handover?.status === 'AWAITING_CLIENT', 'Handover belum menunggu penerimaan Client.');
      requireCondition(acceptResult(state, now()), 'Hasil proyek tidak dapat diterima.');
      break;
    case 'rate':
      requireCondition(isAgreement && ['client', 'developer'].includes(role) &&
        room.project === 'COMPLETED', 'Rating tersedia setelah proyek selesai.');
      requireCondition(Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5,
        'Pilih rating dari 1 sampai 5.', 400);
      room.ratings ||= {client: null, developer: null};
      requireCondition(!room.ratings[role], 'Rating sudah dikirim.');
      room.ratings[role] = {
        rating: body.rating,
        text: typeof body.text === 'string' ? body.text.trim().slice(0, 1000) : '',
        at: now()
      };
      room.timeline.ratings[role === 'client' ? 'clientAt' : 'developerAt'] = room.ratings[role].at;
      break;
    case 'revision':
      requireCondition(reviewing, 'Final delivery sudah disetujui atau belum tersedia.');
      if (Number.isInteger(room.proposal.revisionCount)) {
        requireCondition((room.revisionsUsed || 0) < room.proposal.revisionCount,
          'Jumlah revisi gratis sesuai proposal sudah habis.');
      }
      room.revision = {reason: text(body.reason, 'Alasan revisi'), at: now()};
      room.revisionsUsed = (room.revisionsUsed || 0) + 1;
      room.project = 'REVISION';
      break;
    case 'verify-payout':
      requireCondition(accepted && !room.demoPayoutVerified, 'Verifikasi tujuan payout belum tersedia.');
      room.demoPayoutVerified = true;
      break;
    case 'approve':
      requireCondition(!isAgreement, 'Gunakan penerimaan handover untuk menyelesaikan agreement.');
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
      if (isAgreement) {
        requireCondition(role === 'client' && room.escrow !== 'AWAITING_DP' &&
          !['COMPLETED', 'CANCELLED', 'DISPUTED', 'DISPUTE_RESOLVED'].includes(room.project),
        'Masalah dapat dilaporkan Client setelah DP terverifikasi dan sebelum proyek selesai.');
      }
      {
        const reportedAt = now();
        if (isAgreement) room.timeline.problemReportedAt = reportedAt;
        room.dispute = {
          status: 'NEEDS_REVIEW',
          openedBy: role,
          reason: text(body.reason, 'Alasan dispute'),
          at: reportedAt
        };
      }
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
  if (stagedAgreement(room)) {
    const released = (room.releases || []).reduce((sum, item) => sum + item.amount, 0);
    const alreadyRefunded = (state.ledger || [])
      .filter(item => ['FULL_REFUND', 'PARTIAL_REFUND'].includes(item.entry))
      .reduce((sum, item) => sum + item.amount, 0);
    const held = Math.max(0, paid - released - alreadyRefunded);
    const refund = outcome === 'FULL_REFUND' ? held : outcome === 'PARTIAL_REFUND' ? partialRefund : 0;
    requireCondition(Number.isInteger(refund) && refund >= 0 && refund <= held &&
      (outcome !== 'PARTIAL_REFUND' || (refund > 0 && refund < held)),
    'Nominal refund simulasi tidak valid.', 400);
    requireCondition(outcome !== 'RELEASE_TO_DEVELOPER' || held > 0,
      'Belum ada pembayaran yang dapat dicairkan.', 409);
    const net = held - refund;
    room.dispute = {...room.dispute, status: 'RESOLVED', outcome, refund, net,
      decision: text(decision, 'Alasan keputusan'), resolvedAt: now()};
    room.timeline.problemResolvedAt = room.dispute.resolvedAt;
    if (refund) record(state, outcome, refund);
    if (net) {
      room.releases ||= [];
      room.releases.push({kind: 'DISPUTE', amount: net, at: room.dispute.resolvedAt});
      record(state, 'DISPUTE_RELEASED', net);
      room.escrow = 'RELEASED';
      room.project = 'DISPUTE_RESOLVED';
    } else {
      room.escrow = refund ? 'REFUNDED' : (released ? 'DP_RELEASED' : 'AWAITING_DP');
      room.project = 'CANCELLED';
    }
    return;
  }
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
  const canPayRemaining = stagedAgreement(room)
    ? room.escrow === 'DP_RELEASED' && room.progressReview?.approvedAt && room.delivery?.at &&
      room.project === 'AWAITING_REMAINING_PAYMENT'
    : room.escrow === 'DP_HELD';
  requireCondition(kind === 'DP' || canPayRemaining, 'DP dan final proof harus tersedia sebelum pelunasan.');
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
    // Orders created before the 10-minute limit still use their original 24-hour session.
    const expiresAt = order.snapExpiresAt ?? (order.snapCreatedAt ? order.snapCreatedAt + 24 * 3_600_000 : Infinity);
    if (order.status === 'PENDING' && expiresAt <= time) {
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
  if (stagedAgreement(state.room)) {
    ensureAgreementTimeline(state.room);
    if (dp) {
      state.room.escrow = 'DP_HELD';
      state.room.project = 'IN_PROGRESS';
      state.room.timeline.dpPaidAt ||= order.paid_at;
    } else {
      state.room.escrow = 'REMAINING_HELD';
      state.room.project = 'AWAITING_HANDOVER';
      state.room.timeline.remainingPaidAt ||= order.paid_at;
    }
  } else {
    state.room.escrow = dp ? 'DP_HELD' : 'FULL_PAYMENT_HELD';
    if (dp && state.room.project === 'NOT_STARTED') state.room.project = 'IN_PROGRESS';
  }
  record(state, state.room.escrow, order.amount, orderId);
}
