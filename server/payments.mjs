import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { matchingAmount, PaymentError, snapPageHours } from './midtrans.mjs';

const now = () => new Date().toISOString();

function requireCondition(condition, message, status = 409) {
  if (!condition) throw new PaymentError(status, message);
}

function requiredText(value, label, limit = 2000) {
  requireCondition(typeof value === 'string' && value.trim() && value.trim().length <= limit,
    `${label} wajib diisi (maksimal ${limit} karakter).`, 400);
  return value.trim();
}

function deliveryLink(value) {
  const links = requiredText(value, 'Tautan hasil proyek').split(/\r?\n/).map(link => link.trim()).filter(Boolean);
  requireCondition(links.every(link => URL.canParse(link) && new URL(link).protocol === 'https:'),
    'Isi satu tautan HTTPS per baris.', 400);
  return links;
}

function gatewayState(data) {
  switch (data.transaction_status) {
    case 'settlement': return !data.fraud_status || data.fraud_status === 'accept' ? 'PAID' : 'PROCESSING';
    case 'capture': return data.fraud_status === 'accept' ? 'PAID' : 'PROCESSING';
    case 'authorize':
    case 'pending': return 'PROCESSING';
    case 'expire': return 'EXPIRED';
    case 'cancel': return 'CANCELLED';
    case 'deny':
    case 'failure': return 'FAILED';
    default: return null;
  }
}

export function openPayments(filename, gateway) {
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY, owner TEXT NOT NULL, room_key TEXT NOT NULL,
      details TEXT NOT NULL, UNIQUE (owner, room_key)
    );
    CREATE TABLE IF NOT EXISTS payments (
      order_id TEXT PRIMARY KEY, room_id INTEGER NOT NULL REFERENCES rooms(id),
      kind TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL,
      token TEXT, paid_at TEXT
    );
    CREATE TABLE IF NOT EXISTS snap_sessions (
      order_id TEXT PRIMARY KEY REFERENCES payments(order_id), expires_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_payment ON payments(room_id, kind)
      WHERE status NOT IN ('EXPIRED', 'CANCELLED');
    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY, room_id INTEGER NOT NULL REFERENCES rooms(id),
      order_id TEXT REFERENCES payments(order_id), entry TEXT NOT NULL,
      amount INTEGER NOT NULL, recorded_at TEXT NOT NULL, UNIQUE (room_id, entry)
    );
    CREATE TABLE IF NOT EXISTS payment_webhooks (
      event_id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES payments(order_id),
      transaction_status TEXT NOT NULL, recorded_at TEXT NOT NULL
    );
  `);

  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function findRoom(owner, key) {
    const room = db.prepare('SELECT id, details FROM rooms WHERE owner = ? AND room_key = ?').get(owner, key);
    return room && { id: room.id, ...JSON.parse(room.details) };
  }

  function saveRoom(room) {
    const { id, ...details } = room;
    db.prepare('UPDATE rooms SET details = ? WHERE id = ?').run(JSON.stringify(details), id);
  }

  function findPayment(orderId) {
    return db.prepare('SELECT * FROM payments WHERE order_id = ?').get(orderId);
  }

  function snapshot(owner, key) {
    const room = findRoom(owner, key);
    if (!room) return { room: null, payments: [], ledger: [], checkoutConfigured: Boolean(gateway.clientKey) };
    const { id, ...details } = room;
    return {
      room: details,
      payments: db.prepare(`SELECT order_id, kind, amount, status, paid_at
        FROM payments WHERE room_id = ? ORDER BY rowid`).all(id),
      ledger: db.prepare(`SELECT order_id, entry, amount, recorded_at
        FROM ledger WHERE room_id = ? ORDER BY id`).all(id),
      checkoutConfigured: Boolean(gateway.clientKey)
    };
  }

  function record(roomId, entry, amount, orderId = null) {
    db.prepare(`INSERT INTO ledger (room_id, order_id, entry, amount, recorded_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(room_id, entry) DO NOTHING`).run(roomId, orderId, entry, amount, now());
  }

  const clientActions = new Set(['accept', 'decline', 'revision', 'approve', 'cancel']);
  const developerActions = new Set(['propose', 'progress', 'deliver', 'verify-payout', 'complete-payout']);

  function change(owner, key, role, body) {
    const { action } = body;
    const allowed = role === 'reviewer' ? action === 'resolve-dispute'
      : action === 'dispute' || (role === 'client' ? clientActions : developerActions).has(action);
    requireCondition(allowed, 'Aksi tidak tersedia untuk peran ini.', 403);
    return transaction(() => {
      const room = findRoom(owner, key);
      if (action === 'propose') {
        requireCondition(!room || room.proposal.status === 'DECLINED', 'Proposal sudah tersedia untuk room ini.');
        const { total, dpPercent } = body;
        requireCondition(Number.isInteger(total) && total >= 40000 && total <= 1000000000 &&
          [25, 50].includes(dpPercent), 'Masukkan total Rp40.000–Rp1 miliar dan pilih DP 25% atau 50%.', 400);
        const dp = Math.ceil(total * dpPercent / 100);
        const proposal = {
          name: requiredText(body.name, 'Nama proyek', 120),
          description: requiredText(body.description, 'Deskripsi'),
          scope: requiredText(body.scope, 'Ruang lingkup'),
          deliverables: requiredText(body.deliverables, 'Deliverables'),
          revisions: requiredText(body.revisions, 'Ketentuan revisi'),
          duration: requiredText(body.duration, 'Durasi', 120),
          total, dpPercent, dp, remaining: total - dp, status: 'PENDING'
        };
        const details = { proposal, project: 'NOT_STARTED', escrow: 'AWAITING_DP', progress: [] };
        if (room) saveRoom({ id: room.id, ...details });
        else db.prepare('INSERT INTO rooms (owner, room_key, details) VALUES (?, ?, ?)').run(owner, key, JSON.stringify(details));
        return snapshot(owner, key);
      }

      requireCondition(room, 'Proposal belum dibuat.', 404);
      const activeDispute = room.dispute?.status === 'NEEDS_REVIEW';
      requireCondition((activeDispute ? action === 'resolve-dispute' : action !== 'resolve-dispute') &&
        !['COMPLETED', 'CANCELLED'].includes(room.project),
        'Proyek ini sudah ditutup atau sedang dalam dispute.');

      switch (action) {
        case 'accept':
        case 'decline':
          requireCondition(room.proposal.status === 'PENDING', 'Proposal sudah ditinjau.');
          room.proposal.status = action === 'accept' ? 'ACCEPTED' : 'DECLINED';
          break;
        case 'progress':
          requireCondition(['IN_PROGRESS', 'REVISION'].includes(room.project), 'Progress tersedia setelah DP terverifikasi.');
          room.progress.push({
            title: requiredText(body.title, 'Judul progress', 120),
            notes: requiredText(body.notes, 'Catatan progress'),
            links: body.links ? deliveryLink(body.links) : [],
            at: now()
          });
          break;
        case 'deliver':
          requireCondition(['IN_PROGRESS', 'REVISION'].includes(room.project), 'Proyek belum siap untuk final delivery.');
          room.delivery = { links: deliveryLink(body.links), notes: requiredText(body.notes, 'Catatan pengiriman'), at: now() };
          room.project = 'AWAITING_CLIENT_APPROVAL';
          break;
        case 'revision':
          requireCondition(room.project === 'AWAITING_CLIENT_APPROVAL' && !room.delivery.approvedAt,
            'Final delivery sudah disetujui atau belum tersedia.');
          room.revision = { reason: requiredText(body.reason, 'Alasan revisi'), at: now() };
          room.project = 'REVISION';
          break;
        case 'verify-payout':
          requireCondition(room.proposal.status === 'ACCEPTED' && !room.demoPayoutVerified, 'Verifikasi simulasi belum tersedia.');
          room.demoPayoutVerified = true;
          break;
        case 'approve':
          requireCondition(room.project === 'AWAITING_CLIENT_APPROVAL' && !room.delivery.approvedAt,
            'Final delivery sudah disetujui atau belum tersedia.');
          requireCondition(room.escrow === 'FULL_PAYMENT_HELD', 'DP dan pelunasan harus terverifikasi.');
          requireCondition(room.demoPayoutVerified, 'Developer harus memverifikasi tujuan payout demo.');
          room.delivery.approvedAt = now();
          room.escrow = 'RELEASE_PENDING';
          room.payout = { status: 'PROCESSING', gross: room.proposal.total, fee: 0, net: room.proposal.total };
          record(room.id, 'RELEASE_PENDING', room.payout.net);
          break;
        case 'complete-payout':
          requireCondition(room.escrow === 'RELEASE_PENDING' && room.payout?.status === 'PROCESSING', 'Payout belum diproses.');
          room.payout.status = 'COMPLETED';
          room.escrow = 'RELEASED';
          room.project = 'COMPLETED';
          record(room.id, 'RELEASED', room.payout.net);
          break;
        case 'cancel':
          requireCondition(room.project === 'NOT_STARTED' && room.proposal.status === 'ACCEPTED' &&
            !db.prepare(`SELECT 1 FROM payments WHERE room_id = ?
              AND status NOT IN ('EXPIRED', 'CANCELLED')`).get(room.id),
          'Pembatalan tersedia sebelum ada transaksi aktif. Gunakan dispute jika transaksi sudah dibuat.');
          room.project = 'CANCELLED';
          break;
        case 'dispute':
          requireCondition(room.proposal.status === 'ACCEPTED' && !room.dispute,
            'Dispute tersedia setelah proposal diterima dan hanya bisa diajukan sekali.');
          room.dispute = { status: 'NEEDS_REVIEW', openedBy: role, reason: requiredText(body.reason, 'Alasan dispute'), at: now() };
          room.project = 'DISPUTED';
          break;
        case 'resolve-dispute': {
          const { pending, paid } = db.prepare(`SELECT COUNT(*) FILTER (WHERE status IN ('PENDING', 'PROCESSING', 'FAILED')) AS pending,
            COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0) AS paid FROM payments WHERE room_id = ?`).get(room.id);
          requireCondition(!pending, 'Transaksi yang masih aktif perlu mencapai status akhir sebelum dispute diselesaikan.');
          const { outcome, partialRefund } = body;
          requireCondition(['RELEASE_TO_DEVELOPER', 'PARTIAL_REFUND', 'FULL_REFUND'].includes(outcome), 'Hasil review tidak valid.', 400);
          const refund = outcome === 'FULL_REFUND' ? paid : outcome === 'PARTIAL_REFUND' ? partialRefund : 0;
          requireCondition(Number.isInteger(refund) && refund >= 0 && refund <= paid &&
            (outcome !== 'PARTIAL_REFUND' || (refund > 0 && refund < paid)), 'Nominal refund simulasi tidak valid.', 400);
          requireCondition(outcome !== 'RELEASE_TO_DEVELOPER' || paid > 0, 'Belum ada pembayaran yang dapat dicairkan.');
          const net = paid - refund;
          requireCondition(!net || room.demoPayoutVerified, 'Tujuan payout demo belum diverifikasi.');
          room.dispute = { ...room.dispute, status: 'RESOLVED', outcome, refund, net,
            decision: requiredText(body.decision, 'Alasan keputusan'), resolvedAt: now() };
          if (refund) record(room.id, outcome, refund);
          if (net) {
            room.payout = { status: 'PROCESSING', gross: net, fee: 0, net };
            room.escrow = 'RELEASE_PENDING';
            room.project = 'DISPUTE_RESOLVED';
            record(room.id, 'DISPUTE_RELEASE_PENDING', net);
          } else {
            delete room.payout;
            room.escrow = refund ? 'REFUNDED' : 'AWAITING_DP';
            room.project = 'CANCELLED';
          }
          break;
        }
      }
      saveRoom(room);
      return snapshot(owner, key);
    });
  }

  const creating = new Map();

  async function checkout(owner, key, kind) {
    requireCondition(gateway.clientKey, 'Isi Client Key dan Server Key Midtrans Sandbox di server.', 503);
    requireCondition(['DP', 'REMAINING'].includes(kind), 'Jenis pembayaran tidak valid.', 400);
    const payment = transaction(() => {
      const room = findRoom(owner, key);
      requireCondition(room?.proposal.status === 'ACCEPTED' && !room.dispute &&
        !['CANCELLED', 'COMPLETED'].includes(room.project), 'Proposal belum siap untuk pembayaran.');
      const current = db.prepare(`SELECT * FROM payments WHERE room_id = ? AND kind = ?
        AND status NOT IN ('EXPIRED', 'CANCELLED')`).get(room.id, kind);
      requireCondition(current?.status !== 'PAID', 'Pembayaran sudah terverifikasi.');
      requireCondition(kind === 'DP' || room.escrow === 'DP_HELD', 'DP harus terverifikasi sebelum pelunasan.');
      if (current) return current;
      const orderId = `devmatch-${randomUUID()}`;
      const amount = kind === 'DP' ? room.proposal.dp : room.proposal.remaining;
      db.prepare(`INSERT INTO payments (order_id, room_id, kind, amount, status)
        VALUES (?, ?, ?, ?, 'PENDING')`).run(orderId, room.id, kind, amount);
      return findPayment(orderId);
    });
    if (!payment.token && !creating.has(payment.order_id)) {
      const pending = gateway.create(payment.order_id, payment.amount).then(token => {
        transaction(() => {
          db.prepare('UPDATE payments SET token = ? WHERE order_id = ?').run(token, payment.order_id);
          db.prepare('INSERT INTO snap_sessions (order_id, expires_at) VALUES (?, ?)')
            .run(payment.order_id, Date.now() + snapPageHours * 3600000);
        });
        return token;
      }).finally(() => creating.delete(payment.order_id));
      creating.set(payment.order_id, pending);
    }
    const token = payment.token || await creating.get(payment.order_id);
    requireCondition(!findRoom(owner, key)?.dispute &&
      !['PAID', 'EXPIRED', 'CANCELLED'].includes(findPayment(payment.order_id).status),
      'Pembayaran sudah berakhir atau dibekukan karena dispute. Perbarui status pembayaran.');
    return { token, clientKey: gateway.clientKey };
  }

  async function reconcile(orderId, eventId) {
    const payment = findPayment(orderId);
    const verified = await gateway.status(orderId);
    if (!verified) {
      requireCondition(!eventId, 'Status transaksi belum tersedia di Midtrans.', 502);
      const snap = db.prepare('SELECT expires_at FROM snap_sessions WHERE order_id = ?').get(orderId);
      if (snap?.expires_at <= Date.now()) {
        db.prepare("UPDATE payments SET status = 'EXPIRED' WHERE order_id = ? AND status = 'PENDING'").run(orderId);
      }
      return;
    }
    requireCondition(verified.order_id === orderId && matchingAmount(verified.gross_amount, payment.amount) &&
      (!verified.currency || verified.currency === 'IDR'), 'Detail transaksi Midtrans tidak cocok.', 422);
    const status = gatewayState(verified);
    transaction(() => {
      if (eventId) {
        db.prepare(`INSERT INTO payment_webhooks (event_id, order_id, transaction_status, recorded_at)
          VALUES (?, ?, ?, ?) ON CONFLICT(event_id) DO NOTHING`).run(eventId, orderId, verified.transaction_status, now());
      }
      const current = findPayment(orderId);
      if (!status || current.status === 'PAID' || ['EXPIRED', 'CANCELLED'].includes(current.status)) return;
      db.prepare('UPDATE payments SET status = ?, paid_at = ? WHERE order_id = ?')
        .run(status, status === 'PAID' ? now() : null, orderId);
      if (status !== 'PAID') return;
      const { details } = db.prepare('SELECT details FROM rooms WHERE id = ?').get(payment.room_id);
      const room = { id: payment.room_id, ...JSON.parse(details) };
      const downPayment = payment.kind === 'DP';
      room.escrow = downPayment ? 'DP_HELD' : 'FULL_PAYMENT_HELD';
      if (downPayment && room.project === 'NOT_STARTED') room.project = 'IN_PROGRESS';
      record(room.id, room.escrow, payment.amount, orderId);
      saveRoom(room);
    });
  }

  async function refresh(owner, key) {
    const room = findRoom(owner, key);
    if (room) {
      const pending = db.prepare(`SELECT order_id FROM payments WHERE room_id = ?
        AND status IN ('PENDING', 'PROCESSING', 'FAILED')`).all(room.id);
      await Promise.all(pending.map(payment => reconcile(payment.order_id)));
    }
    return snapshot(owner, key);
  }

  async function webhook(body) {
    requireCondition(gateway.verify(body), 'Signature Midtrans tidak valid.', 401);
    const payment = findPayment(body.order_id);
    requireCondition(payment, 'Order ID tidak ditemukan.', 404);
    requireCondition(matchingAmount(body.gross_amount, payment.amount), 'Nominal pembayaran tidak cocok.', 422);
    const eventId = JSON.stringify([body.order_id, body.transaction_id, body.transaction_status, body.fraud_status, body.status_code]);
    await reconcile(body.order_id, eventId);
  }

  return { snapshot, change, checkout, refresh, webhook, close: () => db.close() };
}
