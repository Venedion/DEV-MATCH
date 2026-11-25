(function () {
  'use strict';

  const dialog = document.getElementById('roomPaymentDialog');
  const openButton = document.getElementById('roomPaymentButton');
  const reviewsButton = document.getElementById('roomPaymentReviews');
  const content = document.getElementById('roomPaymentContent');
  const error = document.getElementById('roomPaymentError');
  const receipts = document.getElementById('roomPaymentReceipts');
  const identity = document.getElementById('roomPaymentIdentity');
  const roleLabel = document.getElementById('roomPaymentRole');
  const title = document.getElementById('roomPaymentTitle');

  let roomKey;
  let chatRoomKey;
  let roomTitle;
  let snapshot;
  let busy = false;
  let reviews = [];
  let returnedRoom;
  const loading = new Map();
  const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  const formatTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  const safe = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const labels = {
    PENDING: 'Menunggu', ACCEPTED: 'Diterima', DECLINED: 'Ditolak', NOT_STARTED: 'Belum dimulai',
    IN_PROGRESS: 'Sedang dikerjakan', AWAITING_CLIENT_APPROVAL: 'Menunggu persetujuan Client',
    REVISION: 'Dalam revisi', COMPLETED: 'Selesai', DISPUTED: 'Dalam dispute', CANCELLED: 'Dibatalkan',
    AWAITING_DP: 'Menunggu DP', DP_HELD: 'DP terverifikasi dan ditahan secara virtual',
    FULL_PAYMENT_HELD: 'Pelunasan terverifikasi dan ditahan secara virtual',
    RELEASE_PENDING: 'Pencairan simulasi sedang diproses', RELEASED: 'Payout simulasi selesai',
    PROCESSING: 'Sedang diproses', PAID: 'Terverifikasi', FAILED: 'Gagal', EXPIRED: 'Kedaluwarsa',
    REFUNDED: 'Dana virtual dikembalikan', FULL_REFUND: 'Refund simulasi penuh',
    PARTIAL_REFUND: 'Refund simulasi sebagian', RELEASE_TO_DEVELOPER: 'Pencairan ke Developer',
    DISPUTE_RESOLVED: 'Dispute selesai', DISPUTE_RELEASE_PENDING: 'Payout hasil review sedang diproses'
  };
  const roleLabels = { client: 'Client', developer: 'Developer', reviewer: 'Reviewer dispute' };

  const button = (action, label, primary = false, disabled = false) =>
    `<button type="button" data-action="${action}" ${primary ? 'data-primary' : ''} ${disabled ? 'disabled' : ''}>${label}</button>`;
  const field = (name, label, multiline = false, required = true, value = '') =>
    `<label>${label}${multiline
      ? `<textarea name="${name}" rows="2" maxlength="2000" ${required ? 'required' : ''}></textarea>`
      : `<input name="${name}" maxlength="120" value="${safe(value)}" ${required ? 'required' : ''}>`}</label>`;
  const submit = label => `<button type="submit" data-primary>${label}</button>`;
  const form = (action, fields, label) => `<form data-action="${action}">${fields}${submit(label)}</form>`;
  const section = (label, body) => `<details><summary>${label}</summary>${body}</details>`;
  const links = items => items.map(link =>
    `<li><a href="${safe(link)}" target="_blank" rel="noopener noreferrer">${safe(link)}</a></li>`).join('');

  function setError(message = '') {
    error.textContent = message;
    error.hidden = !message;
  }

  function proposalForm() {
    return form('propose', [
      field('name', 'Nama proyek', false, true, roomTitle),
      field('description', 'Deskripsi', true),
      '<label>Total (IDR)<input name="total" type="number" required min="40000" max="1000000000" step="1"></label>',
      '<label>Uang muka<select name="dpPercent"><option value="25">25%</option><option value="50">50%</option></select></label>',
      field('duration', 'Estimasi durasi'),
      field('scope', 'Ruang lingkup', true),
      field('deliverables', 'Deliverables', true),
      field('revisions', 'Ketentuan revisi', true)
    ].join(''), 'Kirim proposal');
  }

  function paymentStep(kind, label, amount, payments, checkoutConfigured) {
    const latest = payments.findLast(payment => payment.kind === kind);
    const paymentLabel = latest ? labels[latest.status] : 'Belum dibayar';
    const canPay = latest?.status !== 'PAID';
    return `<dt>${label}</dt><dd>${rupiah.format(amount)} · ${paymentLabel}
      ${canPay ? `<div class="payment-actions">${button(kind, latest &&
        !['EXPIRED', 'CANCELLED'].includes(latest.status) ? 'Buka Snap' : `Bayar ${label}`, true, !checkoutConfigured)}</div>` : ''}
    </dd>`;
  }

  function renderReceipts(ledger) {
    if (roomKey !== chatRoomKey) return;
    receipts.innerHTML = ledger.map(entry => `<p>Sandbox · ${labels[entry.entry]} · ${rupiah.format(entry.amount)}
      ${entry.order_id ? `<br><small>${safe(entry.order_id)} · ${formatTime.format(new Date(entry.recorded_at))}</small>` : ''}</p>`).join('');
    receipts.hidden = !ledger.length;
  }

  function render() {
    if (!snapshot) return;
    const { role, room, payments, ledger, checkoutConfigured } = snapshot;
    renderReceipts(ledger);
    if (!dialog.open || busy) return;
    identity.hidden = !role;
    roleLabel.textContent = roleLabels[role] || '';

    const client = role === 'client';
    const developer = role === 'developer';
    if (!room) {
      content.innerHTML = developer ? proposalForm() : '<p>Menunggu proposal dari Developer.</p>';
      return;
    }
    const { proposal, project, escrow, delivery, revision, progress, payout, dispute, demoPayoutVerified } = room;
    const accepted = proposal.status === 'ACCEPTED';
    const closed = ['CANCELLED', 'COMPLETED', 'DISPUTED'].includes(project);
    const showPayments = accepted && client && !closed && !dispute;
    const canWork = ['IN_PROGRESS', 'REVISION'].includes(project);
    const reviewing = project === 'AWAITING_CLIENT_APPROVAL' && !delivery?.approvedAt;
    const canPayRemaining = escrow !== 'AWAITING_DP';

    content.innerHTML = `
      <h3>${safe(proposal.name)}</h3>
      <p class="payment-text">${safe(proposal.description)}</p>
      <dl>
        <dt>Proposal</dt><dd>${labels[proposal.status]}</dd>
        <dt>Estimasi durasi</dt><dd class="payment-text">${safe(proposal.duration)}</dd>
        <dt>Total</dt><dd>${rupiah.format(proposal.total)}</dd>
        <dt>Proyek</dt><dd>${labels[project]}</dd>
        ${showPayments ? paymentStep('DP', 'DP', proposal.dp, payments, checkoutConfigured)
          : `<dt>DP (${proposal.dpPercent}%)</dt><dd>${rupiah.format(proposal.dp)}</dd>`}
        ${showPayments && canPayRemaining ? paymentStep('REMAINING', 'Pelunasan', proposal.remaining, payments, checkoutConfigured)
          : `<dt>Pelunasan</dt><dd>${rupiah.format(proposal.remaining)}</dd>`}
        ${accepted ? `<dt>Escrow simulasi</dt><dd>${labels[escrow]}</dd>` : ''}
        ${payout ? `<dt>Payout simulasi</dt><dd>${labels[payout.status]} · ${rupiah.format(payout.net)}
          <br><small>Biaya simulasi ${rupiah.format(payout.fee)}</small></dd>` : ''}
      </dl>
      ${showPayments && !checkoutConfigured ? '<p>Checkout memerlukan konfigurasi Midtrans Sandbox di server.</p>' : ''}
      ${section('Ruang lingkup &amp; deliverables', `<p class="payment-text">${safe(proposal.scope)}</p>
        <p class="payment-text"><strong>Deliverables</strong><br>${safe(proposal.deliverables)}</p>
        <p class="payment-text"><strong>Ketentuan revisi</strong><br>${safe(proposal.revisions)}</p>`)}
      ${client && proposal.status === 'PENDING' ? `<div class="payment-actions">
        ${button('accept', 'Terima proposal', true)}${button('decline', 'Tolak proposal')}</div>` : ''}
      ${developer && proposal.status === 'DECLINED' ? section('Kirim proposal baru', proposalForm()) : ''}
      ${accepted && developer && !closed && !demoPayoutVerified ? `<div class="payment-actions">
        ${button('verify-payout', 'Verifikasi tujuan payout demo')}</div>` : ''}
      ${progress.length ? section('Riwayat progress', `<ul class="payment-list">${progress.map(update =>
        `<li><strong>${safe(update.title)}</strong> · ${formatTime.format(new Date(update.at))}
          <p class="payment-text">${safe(update.notes)}</p>
          ${update.links.length ? `<ul>${links(update.links)}</ul>` : ''}</li>`).join('')}</ul>`) : ''}
      ${delivery ? section('Final delivery', `<p class="payment-text">${safe(delivery.notes)}</p>
        <ul class="payment-list">${links(delivery.links)}</ul>`) : ''}
      ${revision ? `<p class="payment-text"><strong>Revisi Client</strong><br>${safe(revision.reason)}</p>` : ''}
      ${dispute ? `<p class="payment-text"><strong>${dispute.status === 'RESOLVED' ? labels[dispute.outcome] : 'Dispute menunggu review'}</strong>
        <br>${safe(dispute.reason)}${dispute.decision ? `<br>Keputusan: ${safe(dispute.decision)}` : ''}</p>` : ''}
      ${role === 'reviewer' && dispute?.status === 'NEEDS_REVIEW' ? form('resolve-dispute',
        `<label>Hasil review simulasi<select name="outcome">
          <option value="FULL_REFUND">Refund penuh</option>
          <option value="PARTIAL_REFUND">Refund sebagian</option>
          <option value="RELEASE_TO_DEVELOPER">Cairkan ke Developer</option>
        </select></label><label>Nominal jika refund sebagian (IDR)<input name="partialRefund" type="number" min="1" step="1"></label>`
        + field('decision', 'Alasan keputusan', true), 'Selesaikan dispute simulasi') : ''}
      ${developer && canWork ? section('Kirim progress', form('progress',
        field('title', 'Judul') + field('notes', 'Catatan', true) +
        field('links', 'Bukti (tautan HTTPS per baris, opsional)', true, false), 'Simpan progress')) : ''}
      ${developer && canWork ? section('Kirim final delivery', form('deliver',
        field('notes', 'Catatan pengiriman', true) + field('links', 'Tautan HTTPS hasil proyek (satu per baris)', true),
        'Kirim final delivery')) : ''}
      ${client && reviewing ? `<div class="payment-actions">${button('approve', 'Setujui final delivery', true,
        escrow !== 'FULL_PAYMENT_HELD' || !demoPayoutVerified)}</div>
        ${!demoPayoutVerified ? '<p>Developer perlu memverifikasi tujuan payout demo sebelum persetujuan.</p>' : ''}
        ${section('Minta revisi', form('revision', field('reason', 'Alasan dan bukti revisi', true), 'Kirim permintaan revisi'))}` : ''}
      ${developer && !closed && payout?.status === 'PROCESSING'
        ? `<div class="payment-actions">${button('complete-payout', 'Selesaikan payout simulasi', true)}</div>` : ''}
      ${client && project === 'NOT_STARTED' && accepted &&
        payments.every(payment => ['EXPIRED', 'CANCELLED'].includes(payment.status))
        ? `<div class="payment-actions">${button('cancel', 'Batalkan proyek')}</div>` : ''}
      ${accepted && !closed && !dispute && (client || developer) ? section('Ajukan dispute', form('dispute',
        field('reason', 'Alasan dan bukti dispute', true), 'Bekukan dan ajukan review')) : ''}
      ${accepted && payments.length ? `<div class="payment-actions">${button('refresh', 'Perbarui status pembayaran')}</div>` : ''}
    `;
  }

  async function request(key, operation = 'snapshot', body = {}) {
    const [conversationId, projectId] = key ? JSON.parse(key) : [];
    const {data, error: failure} = await window.devMatchBackend.client.functions.invoke('payment-api', {
      body: {...body, operation, conversationId, projectId}
    });
    if (failure) {
      const response = failure.context;
      const details = await response?.clone?.().json().catch(() => null);
      const cause = new Error(details?.error || 'Layanan pembayaran belum tersedia.');
      cause.status = response?.status;
      throw cause;
    }
    if (!data || !Object.hasOwn(data, 'data')) throw new Error('Respons layanan pembayaran tidak valid.');
    return data.data;
  }

  function showAccessError(cause) {
    setError(cause.message);
    if (![401, 403].includes(cause.status)) return;
    snapshot = undefined;
    identity.hidden = true;
    renderReceipts([]);
    if (cause.status === 401) {
      const link = document.createElement('a');
      link.href = 'devmatch-auth.html?mode=login';
      link.textContent = 'Login ke DEV-MATCH';
      content.replaceChildren(link);
    } else {
      content.replaceChildren();
    }
  }

  async function perform(action, fields = {}) {
    if (busy || !roomKey) return;
    const key = roomKey;
    busy = true;
    content.inert = true;
    setError();
    let updated = false;
    try {
      if (['DP', 'REMAINING'].includes(action)) {
        const checkout = await request(key, 'checkout', {kind: action});
        if (key !== roomKey) return;
        const target = new URL(checkout.redirectUrl);
        if (target.origin !== 'https://app.sandbox.midtrans.com' || !target.pathname.startsWith('/snap/')) {
          throw new Error('Tautan checkout Sandbox tidak valid.');
        }
        location.assign(target.href);
      } else {
        const state = action === 'refresh' ? await request(key, 'refresh')
          : await request(key, 'apply', {...fields, action});
        if (key !== roomKey) return;
        snapshot = state;
        updated = true;
        if (action === 'resolve-dispute') void loadReviews();
      }
    } catch (cause) {
      if (key === roomKey) showAccessError(cause);
    } finally {
      busy = false;
      content.inert = false;
      if (updated || key !== roomKey) render();
    }
  }

  async function loadRoom(key) {
    if (loading.has(key)) return;
    try {
      const pending = request(key);
      loading.set(key, pending);
      const state = await pending;
      if (key !== roomKey || busy) return;
      snapshot = state;
      setError();
      render();
    } catch (cause) {
      if (key !== roomKey || !dialog.open) return;
      content.textContent = '';
      showAccessError(cause);
    } finally {
      loading.delete(key);
    }
  }

  window.setInterval(async () => {
    if (document.hidden || busy || !roomKey || !snapshot?.payments.some(payment =>
      ['PENDING', 'PROCESSING', 'FAILED'].includes(payment.status))) return;
    const key = roomKey;
    const previous = snapshot;
    try {
      const state = await request(key);
      if (key !== roomKey || busy || snapshot !== previous) return;
      if (state.ledger.length !== previous.ledger.length) renderReceipts(state.ledger);
      snapshot = state;
    } catch (cause) {
      if (key === roomKey && !busy && [401, 403].includes(cause.status)) showAccessError(cause);
    }
  }, 12000);

  function openPayments(operation = 'snapshot') {
    if (!roomKey) return;
    title.textContent = roomTitle;
    setError();
    identity.hidden = true;
    snapshot = undefined;
    content.textContent = 'Memuat pembayaran…';
    if (!dialog.open) dialog.showModal();
    if (operation === 'refresh') void perform(operation);
    else void loadRoom(roomKey);
  }

  let chatRoomTitle;
  openButton.addEventListener('click', () => {
    roomKey = chatRoomKey;
    roomTitle = chatRoomTitle;
    openPayments();
  });

  async function loadReviews() {
    try {
      reviews = await request(null, 'reviews');
      reviewsButton.hidden = !reviews.length;
    } catch {
      reviewsButton.hidden = true;
    }
  }

  reviewsButton.addEventListener('click', async () => {
    await loadReviews();
    if (!reviews.length) return;
    title.textContent = 'Review dispute';
    setError();
    identity.hidden = true;
    content.replaceChildren();
    for (const review of reviews) {
      const item = document.createElement('button');
      item.type = 'button';
      item.textContent = review.title;
      item.addEventListener('click', () => {
        roomKey = JSON.stringify([review.conversationId, review.projectId]);
        roomTitle = review.title;
        openPayments();
      });
      content.append(item);
    }
    if (!dialog.open) dialog.showModal();
  });
  content.addEventListener('click', event => {
    const action = event.target.closest('button[data-action]')?.dataset.action;
    if (action) perform(action);
  });
  content.addEventListener('submit', event => {
    const action = event.target.dataset.action;
    if (!action) return;
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.target));
    if (action === 'propose') {
      fields.total = Number(fields.total);
      fields.dpPercent = Number(fields.dpPercent);
    }
    if (action === 'resolve-dispute') fields.partialRefund = Number(fields.partialRefund);
    perform(action, fields);
  });

  window.DEVMATCH_ROOM_PAYMENT = {
    setRoom(conversation) {
      const params = new URL(location.href);
      const returning = params.searchParams.get('payment') === 'return';
      const returnProject = returning && params.searchParams.get('paymentProject');
      const openConversation = params.searchParams.get('conversation');
      const matchedReturn = returnProject && conversation && (
        openConversation === conversation.id || conversation.sourceConversationIds?.includes(openConversation));
      const recentContext = conversation?.messages?.findLast(message => message.project_context?.available)?.project_context;
      if (returnedRoom?.conversationId !== conversation?.id) returnedRoom = null;
      if (matchedReturn) {
        const knownProject = [conversation.project, recentContext].find(item => item?.id === returnProject);
        returnedRoom = {conversationId: conversation.id, project: knownProject || {id: returnProject, title: 'Pembayaran proyek'}};
      }
      const project = returnedRoom?.project || (conversation?.project?.id ? conversation.project : recentContext);
      const key = project?.id && conversation?.id ? JSON.stringify([conversation.id, project.id]) : null;
      openButton.hidden = !key;
      if (key === chatRoomKey) return;
      roomKey = chatRoomKey = key;
      roomTitle = chatRoomTitle = project?.title || 'Pembayaran proyek';
      snapshot = undefined;
      receipts.hidden = true;
      receipts.replaceChildren();
      if (dialog.open) dialog.close();
      if (!key) return;
      if (matchedReturn || (returning && !returnProject)) {
        for (const name of ['payment', 'paymentProject', 'order_id', 'status_code', 'transaction_status']) params.searchParams.delete(name);
        history.replaceState(history.state, '', params);
        openPayments('refresh');
      } else {
        void loadRoom(key);
      }
    }
  };
  void loadReviews();
})();
