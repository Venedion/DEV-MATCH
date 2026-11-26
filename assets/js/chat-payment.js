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
  const subtitle = document.getElementById('roomPaymentSubtitle');
  const progressReviewDialog = document.getElementById('progressReviewDialog');
  const progressReviewFrom = document.getElementById('progressReviewFrom');
  const progressReviewContent = document.getElementById('progressReviewContent');
  const progressReviewFooter = document.getElementById('progressReviewFooter');
  const checkoutDialog = document.getElementById('roomPaymentCheckoutDialog');
  const checkoutProject = document.getElementById('roomPaymentCheckoutProject');
  const checkoutAmountLabel = document.getElementById('roomPaymentCheckoutAmountLabel');
  const checkoutAmount = document.getElementById('roomPaymentCheckoutAmount');
  const checkoutError = document.getElementById('roomPaymentCheckoutError');
  const snapDialog = document.getElementById('roomPaymentSnapDialog');
  const snapContainer = document.getElementById('roomPaymentSnap');
  let snapScript;
  let snapRoomKey;
  let nextGatewayRefresh = 0;
  let roomKey;
  let chatRoomKey;
  let agreementConversationId;
  let agreementProposalId;
  let progressReviewKey;
  let progressReviewProposal;
  let progressReviewDeveloperName;
  let progressReviewSnapshot;
  let progressReviewGeneration = 0;
  let progressReviewBusy = false;
  let roomTitle;
  let snapshot;
  let busy = false;
  let reviews = [];
  let returnedRoom;
  const loading = new Map();
  let agreementRealtimeChannel = null;
  let agreementRealtimeClient = null;
  let agreementRealtimeGeneration = 0;
  let agreementRefreshQueued = false;
  const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  const formatTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  const formatDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
  const progressReviewClock = new Intl.DateTimeFormat('en-US', {hour: 'numeric', minute: '2-digit'});
  const progressReviewDate = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
  const dateLabel = value => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : formatTime.format(date);
  };
  const deadlineLabel = value => {
    if (!value) return '';
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
    return Number.isNaN(date.getTime()) ? String(value) : formatDate.format(date);
  };
  const safe = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const labels = {
    PENDING: 'Menunggu', ACCEPTED: 'Diterima', DECLINED: 'Ditolak', NOT_STARTED: 'Belum dimulai',
    IN_PROGRESS: 'Sedang dikerjakan', AWAITING_CLIENT_APPROVAL: 'Menunggu persetujuan Client',
    AWAITING_PROGRESS_REVIEW: 'Menunggu review progress',
    AWAITING_REMAINING_PAYMENT: 'Menunggu pelunasan',
    AWAITING_HANDOVER: 'Menunggu serah terima Developer',
    AWAITING_RESULT_ACCEPTANCE: 'Menunggu penerimaan hasil',
    REVISION: 'Dalam revisi', COMPLETED: 'Selesai', DISPUTED: 'Dalam dispute', CANCELLED: 'Dibatalkan',
    AWAITING_DP: 'Menunggu DP', DP_HELD: 'DP terverifikasi dan ditahan secara virtual',
    DP_RELEASED: 'DP dilepas sesuai tahap',
    REMAINING_HELD: 'Pelunasan ditahan secara virtual',
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

  function setCheckoutError(message = '') {
    checkoutError.textContent = message;
    checkoutError.hidden = !message;
  }

  function loadSnap(clientKey) {
    if (!/^(?:SB-)?Mid-client-[\w-]+$/.test(clientKey || '')) {
      throw new Error('Midtrans Sandbox Client Key belum dikonfigurasi.');
    }
    if (!snapScript) {
      const script = document.createElement('script');
      script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
      script.dataset.clientKey = clientKey;
      snapScript = new Promise((resolve, reject) => {
        script.onload = () => {
          if (typeof window.snap?.embed === 'function') resolve(window.snap);
          else reject(new Error('Checkout Midtrans tidak dapat dimuat.'));
        };
        script.onerror = () => reject(new Error('Checkout Midtrans tidak dapat dimuat.'));
        document.head.append(script);
      }).catch(cause => {
        script.remove();
        snapScript = undefined;
        throw cause;
      });
    }
    return snapScript;
  }

  function showCheckoutConfirmation() {
    const proposal = snapshot?.room?.proposal;
    if (!proposal || snapshot.role !== 'client') {
      setError('DP payment is not available for this account.');
      return;
    }
    const total = Number(proposal.total) || 0;
    const dp = Number(proposal.dp) || 0;
    const developerName = snapshot.room.developerName || snapshot.room.developer?.displayName ||
      snapshot.room.developer?.name || proposal.developerName;
    checkoutProject.textContent = [
      proposal.name || roomTitle,
      developerName ? `Developer ${developerName}` : ''
    ].filter(Boolean).join(' · ');
    checkoutAmountLabel.textContent = `DP (${Number(proposal.dpPercent) || 0}% of ${rupiah.format(total)})`;
    checkoutAmount.textContent = rupiah.format(dp);
    setCheckoutError();
    if (!checkoutDialog.open) checkoutDialog.showModal();
  }

  function isAgreementContext() {
    if (!roomKey) return false;
    try {
      return Boolean(JSON.parse(roomKey)?.agreementId);
    } catch (cause) {
      console.error('Unable to identify the active payment room.', cause);
      return false;
    }
  }

  function closeOtherDialogs() {
    document.querySelectorAll('dialog[open]').forEach(openDialog => {
      if (openDialog !== dialog) openDialog.close();
    });
  }

  function paymentStep(kind, label, amount, payments, checkoutConfigured) {
    const latest = payments.findLast(payment => payment.kind === kind);
    const paymentLabel = latest ? labels[latest.status] : 'Belum dibayar';
    const canPay = latest?.status !== 'PAID';
    const actionLabel = latest?.status === 'EXPIRED' ? `Bayar ulang ${label}`
      : latest && latest.status !== 'CANCELLED' ? 'Buka Snap' : `Bayar ${label}`;
    return `<dt>${label}</dt><dd>${rupiah.format(amount)} · ${paymentLabel}
      ${canPay ? `<div class="payment-actions">${button(kind, actionLabel, true, !checkoutConfigured)}</div>` : ''}
    </dd>`;
  }

  function renderReceipts(ledger) {
    receipts.innerHTML = ledger.map(entry => `<p>Sandbox · ${labels[entry.entry]} · ${rupiah.format(entry.amount)}
      ${entry.order_id ? `<br><small>${safe(entry.order_id)} · ${formatTime.format(new Date(entry.recorded_at))}</small>` : ''}</p>`).join('');
    receipts.hidden = !ledger.length;
  }

  function renderAgreement(room, role, payments, ledger, checkoutConfigured) {
    const {proposal, progressReview, delivery, handover, dispute, ratings} = room;
    const timeline = {
      agreementCreatedAt: proposal.createdAt || null,
      dpPaidAt: payments.find(payment => payment.kind === 'DP' && payment.status === 'PAID')?.paid_at || null,
      progressSubmittedAt: room.progress?.[0]?.at || null,
      progressApprovedAt: progressReview?.approvedAt || null,
      dpReleasedAt: room.releases?.find(release => release.kind === 'DP')?.at || null,
      finalProofSharedAt: delivery?.at || null,
      remainingPaidAt: payments.find(payment => payment.kind === 'REMAINING' && payment.status === 'PAID')?.paid_at || null,
      handoverAt: handover?.at || null,
      resultAcceptedAt: room.result?.acceptedAt || null,
      autoAcceptedAt: room.result?.autoAcceptedAt || null,
      ratings: {
        clientAt: ratings?.client?.at || null,
        developerAt: ratings?.developer?.at || null
      },
      ...(room.timeline || {})
    };
    const client = role === 'client';
    const developer = role === 'developer';
    const total = Number(proposal.total) || 0;
    const paid = payments.filter(payment => payment.status === 'PAID')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const released = (room.releases || []).reduce((sum, release) => sum + Number(release.amount || 0), 0);
    const refunded = ledger.filter(entry => ['FULL_REFUND', 'PARTIAL_REFUND'].includes(entry.entry))
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const held = Math.max(0, paid - released - refunded);
    const remaining = Math.max(0, total - paid);
    const canReviewProgress = client && progressReview?.status === 'PENDING';
    const awaitingProgress = developer && room.project === 'IN_PROGRESS' && !timeline.progressSubmittedAt;
    const awaitingDp = client && room.project === 'NOT_STARTED';
    const canPayDp = awaitingDp && checkoutConfigured;
    const canSubmitFinal = developer && room.project === 'IN_PROGRESS' && progressReview?.approvedAt && !delivery;
    const canPayRemaining = client && room.project === 'AWAITING_REMAINING_PAYMENT' &&
      room.escrow === 'DP_RELEASED' && checkoutConfigured;
    const canHandover = developer && room.project === 'AWAITING_HANDOVER' && room.escrow === 'REMAINING_HELD';
    const canAccept = client && handover?.status === 'AWAITING_CLIENT';
    const canReportProblem = client && room.escrow !== 'AWAITING_DP' &&
      !['COMPLETED', 'CANCELLED', 'DISPUTED', 'DISPUTE_RESOLVED'].includes(room.project) && !dispute;
    const canRate = ['client', 'developer'].includes(role) && room.project === 'COMPLETED' && !ratings?.[role];
    const handoverDeadline = handover?.status === 'AWAITING_CLIENT' ? dateLabel(handover.deadlineAt) : '';
    const submittedProgress = Boolean(timeline.progressSubmittedAt);
    const progressDone = Boolean(timeline.progressApprovedAt);
    const progressUpdateRequested = progressReview?.status === 'UPDATE_REQUESTED';
    const dpPaid = Boolean(timeline.dpPaidAt) ||
      payments.some(payment => payment.kind === 'DP' && payment.status === 'PAID') ||
      room.releases?.some(release => release.kind === 'DP');
    const handoverDone = Boolean(timeline.resultAcceptedAt);
    const ratingsDone = Boolean(timeline.ratings?.clientAt && timeline.ratings?.developerAt);
    const agreementDate = dateLabel(timeline.agreementCreatedAt);
    const timelineStep = (index, label, at, description, status, amount = '', actionHtml = '', completed = Boolean(at)) => {
      const done = Boolean(completed);
      const current = !done && status !== 'Upcoming';
      const badge = done ? 'Done' : status;
      return `<li class="agreement-timeline-step${done ? ' is-done' : ''}${current ? ' is-current' : ''}">
        <span class="agreement-timeline-marker" aria-label="${done ? 'Done' : badge}">${done ? '&#10003;' : index}</span>
        <div class="agreement-timeline-copy">
          <div class="agreement-timeline-title"><strong>${label}</strong>
            <span class="agreement-timeline-badge${current ? ' is-current' : ''}${done ? ' is-done' : ''}">${safe(badge)}</span>
            ${amount ? `<strong class="agreement-timeline-amount">${rupiah.format(amount)}</strong>` : ''}
          </div>
          <p>${description}</p>
          ${done && at ? `<time datetime="${safe(at)}">${safe(dateLabel(at))}</time>` : ''}
          ${actionHtml}
        </div>
      </li>`;
    };
    const progressDescription = progressDone
      ? progressReview?.autoApproved
        ? 'Progress was approved automatically after 5 days. The DP has been released to the developer.'
        : 'Progress approved. The DP has been released to the developer.'
      : progressUpdateRequested
        ? client
          ? 'You requested an update. The DP remains held while the Developer resubmits progress.'
          : `The Client requested an update: ${safe(progressReview.requestReason || 'Please review the progress submission.')}`
      : submittedProgress
        ? client
          ? 'The developer submitted progress for your review. You have 5 days to approve it; after which it is approved automatically.'
          : 'Progress has been submitted and is waiting for the client to review it.'
        : 'The developer uploads progress for the client to review. The DP is released after approval.';
    const progressStatus = progressDone || !dpPaid ? 'Upcoming'
      : progressUpdateRequested ? 'Waiting for developer'
      : submittedProgress ? (client ? 'Waiting for you' : 'Waiting for client')
        : 'Waiting for developer';
    const progressAction = canReviewProgress
      ? `<div class="agreement-step-actions">
          <p>Review the submitted progress before approving the DP release.</p>
          ${button('review-progress', 'Review progress', true)}
        </div>`
      : awaitingProgress
        ? `<div class="agreement-step-actions">${section('Upload progress', form('progress',
            field('title', 'Title') + field('notes', 'Notes', true) +
            field('links', 'Evidence links (one HTTPS URL per line, optional)', true, false), 'Upload progress'))}</div>`
        : '';
    const finalProofAction = canSubmitFinal
      ? `<div class="agreement-step-actions">${section('Submit final video', form('deliver',
          field('notes', 'Notes', true) + field('links', 'Video URL (HTTPS)', true),
          'Submit final video'))}</div>`
      : '';
    const finalProofDescription = delivery?.links?.length
      ? `The developer shared the finished work. <a href="${safe(delivery.links[0])}" target="_blank" rel="noopener noreferrer">Watch video</a>.`
      : 'The developer shares a video of the finished work.';
    const remainingDescription = timeline.remainingPaidAt
      ? 'Payment received and held until you receive and accept the system.'
      : timeline.finalProofSharedAt
        ? client ? 'Pay after watching the video. The payment is held until you receive and accept the system.'
          : 'Waiting for the client to pay after reviewing the final video.'
        : 'You pay after watching the video. The payment is held until you receive and accept the system.';
    const expiredDp = payments.findLast(payment => payment.kind === 'DP')?.status === 'EXPIRED';
    const expiredRemaining = payments.findLast(payment => payment.kind === 'REMAINING')?.status === 'EXPIRED';
    const remainingAction = canPayRemaining && checkoutConfigured
      ? `${expiredRemaining ? '<p class="agreement-inline-note">Checkout expired.</p>' : ''}
        <div class="agreement-step-actions">${button('REMAINING', `${expiredRemaining ? 'Retry remaining payment' : 'Pay remaining'} · ${rupiah.format(remaining)}`, true)}</div>`
      : room.project === 'AWAITING_REMAINING_PAYMENT' && client && !checkoutConfigured
        ? '<p class="agreement-inline-note">Payment checkout is not configured.</p>' : '';
    const dpAction = canPayDp
      ? `${expiredDp ? '<p class="agreement-inline-note">Checkout expired.</p>' : ''}
        <div class="agreement-step-actions">${button('DP', `${expiredDp ? 'Retry DP' : 'Pay DP'} · ${rupiah.format(Number(proposal.dp) || 0)}`, true)}</div>`
      : awaitingDp ? '<p class="agreement-inline-note">Payment checkout is not configured.</p>' : '';
    const handoverDescription = handoverDone
      ? 'The result has been accepted.'
      : handover?.status === 'AWAITING_CLIENT'
        ? `The developer handed over the system. Accept it, or report a problem within 7 days${handoverDeadline ? ` (by ${handoverDeadline})` : ''}.`
        : 'The developer hands over the system. You can accept it, or report a problem within 7 days.';
    const handoverAction = canHandover
      ? `<div class="agreement-step-actions">${section('Hand over system', form('handover',
          field('Handover notes', 'Notes', true, false), 'Hand over system'))}</div>`
      : canAccept && !dispute
        ? `<div class="agreement-step-actions">${button('accept-result', 'Accept result', true)}</div>`
        : '';
    const ratingDescription = ratingsDone ? 'Both of you rated each other after the project was completed.'
      : 'Both of you rate each other after the project is completed.';
    const ratingAction = canRate
      ? `<div class="agreement-step-actions">${section('Rate project', form('rate',
          `<label>Rating<select name="rating" required><option value="">Select a rating</option>
            <option value="5">5 — Excellent</option><option value="4">4 — Good</option>
            <option value="3">3 — Average</option><option value="2">2 — Below average</option>
            <option value="1">1 — Poor</option></select></label>${field('text', 'Review (optional)', true, false)}`,
          'Submit rating'))}</div>`
      : ratings?.[role] ? `<p class="agreement-inline-note">Your rating: ${safe(ratings[role].rating)} / 5</p>` : '';
    const timelineHtml = [
      timelineStep(1, 'Agreement created', timeline.agreementCreatedAt,
        'Both of you accepted the proposal.', 'Upcoming', '',
        `<div class="agreement-step-actions">${button('print-agreement', 'Download PDF')}</div>`, true),
      timelineStep(2, 'DP paid', timeline.dpPaidAt,
        timeline.dpPaidAt ? 'Held until you approve the progress.' : 'The DP is paid and held until progress is approved.',
        timeline.dpPaidAt ? 'Upcoming' : room.project === 'NOT_STARTED'
          ? (client ? 'Awaiting payment' : 'Waiting for client') : 'Upcoming',
        Number(proposal.dp) || 0, dpAction, dpPaid),
      timelineStep(3, 'Progress review', timeline.progressApprovedAt, progressDescription,
        progressStatus, '', progressAction),
      timelineStep(4, 'Final proof', timeline.finalProofSharedAt, finalProofDescription,
        'Upcoming', '', finalProofAction),
      timelineStep(5, 'Remaining payment', timeline.remainingPaidAt, remainingDescription,
        timeline.remainingPaidAt ? 'Upcoming' : timeline.finalProofSharedAt
          ? (client ? 'Awaiting payment' : 'Waiting for client') : 'Upcoming',
        Number(proposal.remaining) || 0, remainingAction),
      timelineStep(6, 'Handover and acceptance', timeline.resultAcceptedAt, handoverDescription,
        timeline.resultAcceptedAt ? 'Upcoming' : handover?.status === 'AWAITING_CLIENT'
          ? (client ? 'Waiting for you' : 'Waiting for client') : 'Upcoming', '', handoverAction),
      timelineStep(7, 'Rating', ratingsDone ? timeline.ratings.clientAt : '',
        ratingDescription, ratingsDone ? 'Upcoming' : room.project === 'COMPLETED'
          ? (ratings?.[role] ? 'Waiting for other rating' : 'Waiting for you') : 'Upcoming', '', ratingAction)
    ].join('');
    const problemSection = dispute
      ? `<section class="agreement-summary-card agreement-problem" aria-live="polite">
          <h2>Problem reported</h2>
          <p>Reporting a problem freezes the payments while we review it.</p>
          <p><strong>${safe(dispute.reason || 'Your report is being reviewed.')}</strong></p>
          <span class="agreement-dispute-status">${safe(dispute.status === 'RESOLVED'
            ? labels[dispute.outcome] || dispute.outcome : 'Under review')}</span>
          ${button('back-to-chat', 'Contact support')}
        </section>`
      : `<section class="agreement-summary-card agreement-problem">
          <h2>Having a problem?</h2>
          <p>Reporting a problem freezes the payments while we review it.</p>
          <button type="button" class="agreement-report-trigger" data-action="report-problem" ${canReportProblem ? '' : 'disabled'}>Report a problem</button>
          ${canReportProblem ? `<div class="agreement-report-form" hidden>${form('dispute',
            field('reason', 'Describe the problem', true), 'Submit report')}</div>` : ''}
        </section>`;
    const stateLabel = dispute ? 'Problem reported'
      : room.project === 'COMPLETED' ? 'Completed'
        : room.project === 'NOT_STARTED' ? 'Not started' : 'In progress';
    const subtitleParts = [proposal.name, proposal.deadline ? `Deadline ${deadlineLabel(proposal.deadline)}` : proposal.duration]
      .filter(Boolean);

    content.innerHTML = `
      <div class="agreement-page-heading">
        <nav class="agreement-breadcrumb" aria-label="Breadcrumb"><span>Projects</span><span aria-hidden="true">/</span>
          <span>${safe(proposal.name)}</span></nav>
        <div class="agreement-page-title-row">
          <div><h1>Project payments <span class="agreement-project-status">${safe(stateLabel)}</span></h1>
            <p>${safe(subtitleParts.join(' · '))}</p></div>
          <div class="agreement-header-actions">
            <button type="button" class="agreement-close-button" data-action="close-dialog" aria-label="Close project payments">×</button>
          </div>
        </div>
      </div>
      <div class="agreement-workspace">
        <section class="agreement-timeline-card">
          <h2>Payment timeline</h2>
          ${dispute ? '<p class="agreement-frozen-note">Payments are frozen while the problem is under review.</p>' : ''}
          <ol class="agreement-timeline">${timelineHtml}</ol>
        </section>
        <aside class="agreement-sidebar">
          <section class="agreement-summary-card">
            <h2>Payment summary</h2>
            <dl class="agreement-summary">
              <dt>Total price</dt><dd>${rupiah.format(total)}</dd>
              <dt>Paid so far</dt><dd>${rupiah.format(paid)}</dd>
              <dt>Held</dt><dd>${rupiah.format(held)}</dd>
              <dt>Released to developer</dt><dd>${rupiah.format(released)}</dd>
              <dt>Still to pay</dt><dd>${rupiah.format(remaining)}</dd>
            </dl>
            <p class="agreement-disclaimer">Payments held and released here are recorded in the project ledger and do not confirm a bank transfer.</p>
          </section>
          <section class="agreement-summary-card agreement-terms-card">
            <h2>Agreement</h2>
            <p>The accepted proposal${agreementDate ? `, locked since ${safe(agreementDate)}` : ''}.</p>
            <div class="agreement-terms-actions">
              <button type="button" data-action="view-proposal-details">View details</button>
              <button type="button" data-action="print-agreement">Download PDF</button>
            </div>
          </section>
          ${problemSection}
        </aside>
      </div>`;
  }

  function render() {
    if (!snapshot) return;
    const { role, room, payments, ledger, checkoutConfigured } = snapshot;
    renderReceipts(ledger);
    if (room?.proposal?.agreementId) {
      window.dispatchEvent(new CustomEvent('devmatch:agreement-payment-status', {
        detail: {
          agreementId: room.proposal.agreementId,
          projectStatus: room.project,
          escrowStatus: room.escrow,
          dpStatus: payments.findLast(payment => payment.kind === 'DP')?.status ?? null,
          remainingStatus: payments.findLast(payment => payment.kind === 'REMAINING')?.status ?? null
        }
      }));
    }
    if (!dialog.open || busy) return;
    identity.hidden = !role;
    roleLabel.textContent = roleLabels[role] || '';

    if (room && (room.timelineVersion === 2 || room.proposal?.agreementId || isAgreementContext())) {
      renderAgreement(room, role, payments, ledger, checkoutConfigured);
      dialog.classList.add('room-payment-dialog--agreement');
      return;
    }
    dialog.classList.remove('room-payment-dialog--agreement');
    const client = role === 'client';
    const developer = role === 'developer';
    if (!room) {
      content.innerHTML = developer
        ? '<p>Kirim proposal melalui tombol Propose project di composer chat.</p>'
        : '<p>Menunggu Developer mengirim proposal melalui chat.</p>';
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
        <dt>${proposal.deadline ? 'Deadline' : 'Estimasi durasi'}</dt>
        <dd class="payment-text">${safe(proposal.deadline || proposal.duration)}</dd>
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
      ${section('Ruang lingkup &amp; deliverables', `${proposal.scopeItems?.length
        ? `<ul class="payment-list">${proposal.scopeItems.map(item => `<li>${safe(item)}</li>`).join('')}</ul>`
        : `<p class="payment-text">${safe(proposal.scope)}</p>`}
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
    const stored = key ? JSON.parse(key) : null;
    const context = Array.isArray(stored)
      ? {conversationId: stored[0], projectId: stored[1]}
      : (stored || {});
    const {data, error: failure} = await window.devMatchBackend.client.functions.invoke('payment-api', {
      body: {...body, operation, ...context}
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
    if (action === 'DP' && !fields.confirmed && isAgreementContext()) {
      showCheckoutConfirmation();
      return;
    }
    if (action === 'back-to-chat') {
      dialog.close();
      document.getElementById('chatThreadContainer')?.scrollIntoView({behavior: 'smooth', block: 'center'});
      return;
    }
    if (action === 'close-dialog') {
      dialog.close();
      return;
    }
    if (action === 'view-proposal-details') {
      if (!window.DEVMATCH_PROPOSAL_DETAILS?.open(agreementProposalId)) {
        setError('Proposal details could not be loaded.');
      }
      return;
    }
    if (action === 'report-problem') {
      const reportForm = content.querySelector('.agreement-report-form');
      if (reportForm) {
        reportForm.hidden = false;
        reportForm.querySelector('textarea, input')?.focus();
      }
      return;
    }
    if (action === 'print-agreement') {
      if (!window.DEVMATCH_PROPOSAL_DETAILS?.preparePrint(agreementProposalId)) {
        setError('Proposal details could not be prepared for download.');
        return;
      }
      window.print();
      return;
    }
    if (action === 'review-progress') {
      const proposal = snapshot?.room?.proposal;
      if (!proposal?.agreementId) {
        setError('Progress review is not available for this agreement.');
        return;
      }
      openProgressReview({
        id: proposal.agreementId,
        conversationId: agreementConversationId,
        proposalId: agreementProposalId,
        title: proposal.name,
        developerName: snapshot.room.developerName || snapshot.room.developer?.displayName
      });
      return;
    }
    const key = roomKey;
    const isCheckout = action === 'DP' || action === 'REMAINING';
    const dpConfirmationOpen = action === 'DP' && fields.confirmed;
    busy = true;
    content.inert = true;
    const checkoutButtons = dpConfirmationOpen
      ? [...checkoutDialog.querySelectorAll('button')] : [];
    checkoutButtons.forEach(checkoutButton => { checkoutButton.disabled = true; });
    setError();
    if (dpConfirmationOpen) setCheckoutError();
    let updated = false;
    try {
      if (isCheckout) {
        const checkout = await request(key, 'checkout', {kind: action});
        if (key !== roomKey) return;
        if (!checkout.token) throw new Error('Token checkout Midtrans tidak tersedia.');
        const snap = await loadSnap(checkout.clientKey);
        if (key !== roomKey) return;
        const close = () => {
          if (snapRoomKey === key && snapDialog.open) snapDialog.close();
        };
        const refresh = () => {
          if (key === roomKey && snapRoomKey === key) void perform('refresh');
        };
        snapRoomKey = key;
        try {
          snapDialog.showModal();
          snap.embed(checkout.token, {
            embedId: snapContainer.id,
            uiMode: 'qr',
            onSuccess: close,
            onPending: refresh,
            onError: refresh,
            onClose: close
          });
        } catch (cause) {
          close();
          throw cause;
        }
        if (dpConfirmationOpen) checkoutDialog.close();
      } else {
          if (action === 'rate') fields.rating = Number(fields.rating);
        const state = action === 'refresh' ? await request(key, 'refresh')
          : await request(key, 'apply', {...fields, action});
        if (key !== roomKey) return;
        snapshot = state;
        updated = true;
        if (action === 'resolve-dispute') void loadReviews();
      }
    } catch (cause) {
      if (key === roomKey) {
        if (dpConfirmationOpen) {
          if ([401, 403].includes(cause.status)) {
            checkoutDialog.close();
            showAccessError(cause);
          } else {
            setCheckoutError(cause.message);
          }
        } else {
          showAccessError(cause);
        }
      }
    } finally {
      busy = false;
      content.inert = false;
      checkoutButtons.forEach(checkoutButton => { checkoutButton.disabled = false; });
      if (updated || key !== roomKey) render();
      flushAgreementRefresh(key);
    }
  }

  snapDialog.querySelector('button').addEventListener('click', () => snapDialog.close());
  snapDialog.addEventListener('close', () => {
    const key = snapRoomKey;
    snapRoomKey = undefined;
    window.snap?.hide();
    snapContainer.replaceChildren();
    if (key && key === roomKey) void perform('refresh');
  });

  checkoutDialog.querySelector('[data-checkout-close]').addEventListener('click', () => checkoutDialog.close());
  checkoutDialog.querySelector('[data-checkout-cancel]').addEventListener('click', () => checkoutDialog.close());
  checkoutDialog.querySelector('[data-checkout-continue]').addEventListener('click', () =>
    perform('DP', {confirmed: true}));
  checkoutDialog.querySelector('[data-demo-payment]').addEventListener('click', () =>
    perform('DP', {confirmed: true}));
  checkoutDialog.addEventListener('close', () => setCheckoutError());
  checkoutDialog.addEventListener('click', event => {
    if (event.target !== checkoutDialog) return;
    const rect = checkoutDialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) checkoutDialog.close();
  });

  async function loadRoom(key, {scrollToTop = false, initialAction = null} = {}) {
    if (loading.has(key)) return;
    try {
      const pending = request(key);
      loading.set(key, pending);
      const state = await signProgressMedia(await pending);
      if (key !== roomKey || busy) return;
      snapshot = state;
      setError();
      render();
      if (dialog.open && scrollToTop) content.scrollTop = 0;
      if (initialAction && dialog.open) {
        if (['DP', 'REMAINING', 'accept-result', 'report-problem'].includes(initialAction)) {
          void perform(initialAction);
        } else {
          const targetByAction = {
            deliver: 'form[data-action="deliver"] input[name="links"]',
            handover: 'form[data-action="handover"] textarea[name="notes"]',
            rate: 'form[data-action="rate"] select[name="rating"]'
          };
          const selector = targetByAction[initialAction];
          const target = selector ? content.querySelector(selector) : null;
          target?.focus();
          target?.scrollIntoView({block: 'center', behavior: 'smooth'});
        }
      }
    } catch (cause) {
      if (key !== roomKey || !dialog.open) return;
      content.textContent = '';
      showAccessError(cause);
    } finally {
      loading.delete(key);
      flushAgreementRefresh(key);
    }
  }

  async function signProgressMedia(state) {
    const progress = state.room?.progress || [];
    const files = progress.flatMap(item => [
      item.video,
      ...(Array.isArray(item.screenshots) ? item.screenshots : [])
    ].filter(file => file?.path));
    if (!files.length) return state;
    const client = window.devMatchBackend?.client;
    if (!client) throw new Error('Layanan file progress belum tersedia.');
    await Promise.all(files.map(async file => {
      const {data, error: failure} = await client.storage.from('agreement-progress')
        .createSignedUrl(file.path, 3600);
      if (failure) throw failure;
      file.url = data.signedUrl;
    }));
    return state;
  }

  function renderProgressReview(state) {
    const room = state.room;
    const progress = room.progress?.[room.progress.length - 1];
    const review = room.progressReview;
    if (!progress || review?.status !== 'PENDING') {
      throw new Error('Progress is no longer waiting for review.');
    }
    const developerName = progressReviewDeveloperName ||
      room.developerName || room.developer?.displayName || 'Developer';
    const submittedDate = progress.at && !Number.isNaN(Date.parse(progress.at))
      ? new Date(progress.at) : null;
    const submittedAt = submittedDate
      ? `${progressReviewDate.format(submittedDate)}, ${progressReviewClock.format(submittedDate)}`
      : '';
    const scope = Array.isArray(room.proposal.scopeItems) ? room.proposal.scopeItems : [];
    const shown = new Set(Array.isArray(progress.scope) ? progress.scope : []);
    const scopeItems = scope.map(item => {
      const isShown = shown.has(item);
      return `<li class="${isShown ? 'is-shown' : 'is-not-shown'}">
        <span class="progress-review-scope-mark" aria-hidden="true">${isShown ? '&#10003;' : ''}</span>
        <span>${safe(item)}${isShown ? '' : ' · not shown yet'}</span>
      </li>`;
    }).join('');
    const video = progress.video?.url
      ? `<video class="progress-review-video" src="${safe(progress.video.url)}" controls playsinline preload="metadata" aria-label="Submitted progress video"></video>`
      : progress.links?.length
        ? `<a class="progress-review-video-link" href="${safe(progress.links[0])}" target="_blank" rel="noopener noreferrer">Open submitted progress</a>`
        : '<div class="progress-review-video-link">No progress video was attached</div>';
    const screenshots = (progress.screenshots || []).filter(file => file.url);
    const screenshotHtml = screenshots.length
      ? `<section><p class="progress-review-section-label">Screenshots</p>
          <div class="progress-review-screenshots">${screenshots.map(file =>
            `<a href="${safe(file.url)}" target="_blank" rel="noopener noreferrer">
              <img src="${safe(file.url)}" alt="${safe(file.name)}" loading="lazy">
            </a>`).join('')}</div>
        </section>`
      : '';
    const deadline = review.deadlineAt && !Number.isNaN(Date.parse(review.deadlineAt))
      ? progressReviewDate.format(new Date(review.deadlineAt)) : 'the deadline';
    progressReviewFrom.textContent = `From ${developerName}${submittedAt ? ` · submitted ${submittedAt}` : ''}`;
    progressReviewContent.innerHTML = `
      ${video}
      <section>
        <p class="progress-review-section-label">Note from ${safe(developerName)}</p>
        <p class="progress-review-note">${safe(progress.notes || '')}</p>
      </section>
      <section>
        <p class="progress-review-section-label">Scope points shown (${shown.size} of ${scope.length})</p>
        <ul class="progress-review-scope">${scopeItems}</ul>
      </section>
      ${screenshotHtml}
      <p class="progress-review-notice">
        Approving releases the DP of <strong>${safe(rupiah.format(Number(room.proposal.dp) || 0))}</strong>
        to ${safe(developerName)}. If you do nothing, it is approved automatically on ${safe(deadline)}.
      </p>`;
    progressReviewFooter.innerHTML = `
      <button type="button" data-review-action="request-update">Request update</button>
      <button type="button" data-review-action="approve-progress" data-primary>Approve progress</button>`;
  }

  function renderProgressUpdateForm() {
    progressReviewContent.innerHTML = `
      <div class="progress-review-request-form">
        <label for="progressReviewUpdateReason">What needs to be updated?</label>
        <textarea id="progressReviewUpdateReason" maxlength="500" rows="4" required></textarea>
        <p id="progressReviewActionError" class="progress-review-request-error" role="alert" hidden></p>
      </div>`;
    progressReviewFooter.innerHTML = `
      <button type="button" data-review-action="cancel-request">Back</button>
      <button type="button" data-review-action="send-request" data-primary>Send request</button>`;
    progressReviewContent.querySelector('textarea')?.focus();
  }

  function showProgressReviewError(message) {
    let error = document.getElementById('progressReviewActionError');
    if (!error) {
      error = document.createElement('p');
      error.id = 'progressReviewActionError';
      error.className = 'progress-review-request-error';
      error.setAttribute('role', 'alert');
      progressReviewContent.append(error);
    }
    error.textContent = message;
    error.hidden = false;
  }

  async function submitProgressReviewAction(action, fields = {}) {
    if (progressReviewBusy || !progressReviewKey) return;
    const key = progressReviewKey;
    progressReviewBusy = true;
    progressReviewFooter.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      const state = await request(key, 'apply', {action, ...fields});
      if (key !== progressReviewKey) return;
      progressReviewSnapshot = state;
      if (progressReviewProposal?.agreement) {
        progressReviewProposal.agreement.progress_review_status =
          state.room.progressReview?.status || null;
        progressReviewProposal.agreement.escrow_status = state.room.escrow;
      }
      if (key === roomKey) {
        snapshot = state;
        if (dialog.open) render();
      }
      window.dispatchEvent(new Event('devmatch:progress-review-updated'));
      progressReviewDialog.close();
    } catch (cause) {
      if (key === progressReviewKey) showProgressReviewError(
        cause.message || 'The progress review could not be submitted. Please try again.'
      );
    } finally {
      progressReviewBusy = false;
      if (progressReviewDialog.open) {
        progressReviewFooter.querySelectorAll('button').forEach(button => { button.disabled = false; });
      }
    }
  }

  function openProgressReview(agreement, proposal = null) {
    if (!agreement?.id) return;
    progressReviewGeneration += 1;
    const generation = progressReviewGeneration;
    const key = JSON.stringify({agreementId: agreement.id});
    progressReviewKey = key;
    progressReviewProposal = proposal || agreement.proposal || null;
    progressReviewDeveloperName = agreement.developerName ||
      progressReviewProposal?.developerName || 'Developer';
    progressReviewSnapshot = null;
    progressReviewBusy = false;
    progressReviewFrom.textContent = '';
    progressReviewContent.textContent = 'Loading progress…';
    progressReviewFooter.replaceChildren();
    if (!progressReviewDialog.open) progressReviewDialog.showModal();
    void (async () => {
      try {
        const state = await signProgressMedia(await request(key));
        if (generation !== progressReviewGeneration || !progressReviewDialog.open) return;
        if (state.role !== 'client') throw new Error('Only the Client can review progress.');
        progressReviewSnapshot = state;
        renderProgressReview(state);
      } catch (cause) {
        if (generation !== progressReviewGeneration || !progressReviewDialog.open) return;
        progressReviewContent.textContent =
          cause.message || 'Progress could not be loaded. Please try again.';
        progressReviewFooter.innerHTML = '<button type="button" data-review-close>Close</button>';
      }
    })();
  }

  async function submitAgreementProgress(agreementId, payload) {
    if (!agreementId) throw new Error('Agreement progress tidak valid.');
    const key = JSON.stringify({agreementId});
    const state = await request(key, 'apply', {action: 'progress', ...payload});
    if (key === roomKey && dialog.open) void loadRoom(key);
    return state;
  }

  function refreshAgreementRoom(key) {
    if (key !== roomKey || !dialog.open) return;
    if (busy || loading.has(key)) {
      agreementRefreshQueued = true;
      return;
    }
    void loadRoom(key);
  }

  function flushAgreementRefresh(key) {
    if (!agreementRefreshQueued) return;
    if (key !== roomKey || !dialog.open) {
      agreementRefreshQueued = false;
      return;
    }
    if (busy || loading.has(key)) return;
    agreementRefreshQueued = false;
    void loadRoom(key);
  }

  function stopAgreementRealtime() {
    agreementRealtimeGeneration += 1;
    agreementRefreshQueued = false;
    const channel = agreementRealtimeChannel;
    const client = agreementRealtimeClient;
    agreementRealtimeChannel = null;
    agreementRealtimeClient = null;
    if (!channel || !client) return;
    void client.removeChannel(channel).then(status => {
      if (status !== 'ok') console.error('Unable to close the agreement payment real-time channel.', status);
    }).catch(cause => {
      console.error('Unable to close the agreement payment real-time channel.', cause);
    });
  }

  async function watchAgreementRealtime(agreementId) {
    stopAgreementRealtime();
    const generation = agreementRealtimeGeneration;
    const key = JSON.stringify({agreementId});
    const client = window.devMatchBackend?.client;
    if (!client) {
      console.error('Agreement payment real-time updates are unavailable; periodic refresh remains active.');
      return;
    }
    try {
      const {data, error: sessionError} = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session?.access_token) throw new Error('An authenticated session is required for agreement updates.');
      await client.realtime.setAuth(data.session.access_token);
      if (generation !== agreementRealtimeGeneration || key !== roomKey || !dialog.open) return;
      agreementRealtimeClient = client;
      agreementRealtimeChannel = client.channel(`payment-agreement:${agreementId}`, {config: {private: true}})
        .on('broadcast', {event: 'refresh'}, () => refreshAgreementRoom(key))
        .subscribe(status => {
          if (generation !== agreementRealtimeGeneration) return;
          if (status === 'SUBSCRIBED') refreshAgreementRoom(key);
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('Agreement payment real-time updates were interrupted; periodic refresh remains active.', status);
          }
        });
    } catch (cause) {
      if (generation === agreementRealtimeGeneration) {
        console.error('Unable to subscribe to agreement payment real-time updates; periodic refresh remains active.', cause);
      }
    }
  }

  dialog.addEventListener('close', () => {
    stopAgreementRealtime();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) dialog.close();
  });

  window.setInterval(async () => {
    const timelineOpen = dialog.open &&
      (snapshot?.room?.timelineVersion === 2 || isAgreementContext());
    const pendingPayment = snapshot?.payments.some(payment =>
      ['PENDING', 'PROCESSING', 'FAILED'].includes(payment.status));
    if (document.hidden || busy || !roomKey || (!timelineOpen && !pendingPayment)) return;
    const key = roomKey;
    const previous = snapshot;
    try {
      const checkGateway = snapshot?.role === 'client' && (pendingPayment || snapRoomKey === key) &&
        Date.now() >= nextGatewayRefresh;
      if (checkGateway) nextGatewayRefresh = Date.now() + 36000;
      const state = await request(key, checkGateway ? 'refresh' : 'snapshot');
      if (key !== roomKey || busy || snapshot !== previous) return;
      if (JSON.stringify(state) !== JSON.stringify(previous)) {
        renderReceipts(state.ledger);
        snapshot = state;
        render();
      }
    } catch (cause) {
      if (key === roomKey && !busy && [401, 403].includes(cause.status)) showAccessError(cause);
    }
  }, 12000);

  function openPayments(operation = 'snapshot', initialAction = null) {
    if (!roomKey) return;
    title.textContent = roomTitle;
    const agreement = isAgreementContext();
    subtitle.textContent = agreement ? 'Project agreement · pembaruan otomatis' : 'Midtrans Sandbox';
    dialog.classList.toggle('room-payment-dialog--agreement', agreement);
    setError();
    identity.hidden = true;
    snapshot = undefined;
    content.textContent = 'Memuat pembayaran…';
    closeOtherDialogs();
    if (!dialog.open) dialog.showModal();
    if (agreement) void watchAgreementRealtime(JSON.parse(roomKey).agreementId);
    else stopAgreementRealtime();
    if (operation === 'refresh') void perform(operation);
    else void loadRoom(roomKey, {scrollToTop: true, initialAction});
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
        if (review.agreementId) {
          openAgreement({
            id: review.agreementId,
            conversationId: review.conversationId,
            title: review.title
          });
          return;
        }
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
    if (action === 'resolve-dispute') fields.partialRefund = Number(fields.partialRefund);
    perform(action, fields);
  });
  progressReviewDialog.querySelector('[data-review-close]').addEventListener('click', () => {
    if (!progressReviewBusy) progressReviewDialog.close();
  });
  progressReviewDialog.addEventListener('click', event => {
    const closeButton = event.target.closest('[data-review-close]');
    if (closeButton) {
      if (!progressReviewBusy) progressReviewDialog.close();
      return;
    }
    const action = event.target.closest('button[data-review-action]')?.dataset.reviewAction;
    if (action === 'request-update') {
      renderProgressUpdateForm();
    } else if (action === 'cancel-request') {
      if (progressReviewSnapshot) renderProgressReview(progressReviewSnapshot);
    } else if (action === 'send-request') {
      const reason = progressReviewContent.querySelector('#progressReviewUpdateReason')?.value.trim();
      if (!reason) {
        showProgressReviewError('Tell the Developer what needs to be updated.');
        return;
      }
      void submitProgressReviewAction('request-progress-update', {reason});
    } else if (action === 'approve-progress') {
      void submitProgressReviewAction('approve-progress');
    }
    if (event.target === progressReviewDialog && !progressReviewBusy) {
      const rect = progressReviewDialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) progressReviewDialog.close();
    }
  });
  progressReviewDialog.addEventListener('cancel', event => {
    if (progressReviewBusy) event.preventDefault();
  });
  progressReviewDialog.addEventListener('close', () => {
    progressReviewGeneration += 1;
    progressReviewKey = null;
    progressReviewProposal = null;
    progressReviewDeveloperName = null;
    progressReviewSnapshot = null;
  });

  function openAgreement(agreement, {action = null, operation = 'snapshot'} = {}) {
    if (!agreement?.id) return;
    roomKey = JSON.stringify({agreementId: agreement.id});
    agreementConversationId = agreement.conversationId || null;
    agreementProposalId = agreement.proposalId || null;
    roomTitle = agreement.title || agreement.terms?.projectName || 'Project agreement';
    openPayments(operation, action);
  }

  window.DEVMATCH_ROOM_PAYMENT = {
    openAgreement,
    openProgressReview,
    submitProgress: submitAgreementProgress,
    setRoom(conversation) {
      const params = new URL(location.href);
      const returning = params.searchParams.get('payment') === 'return';
      const returnAgreement = returning && params.searchParams.get('paymentAgreement');
      const returnProject = returning && params.searchParams.get('paymentProject');
      const openConversation = params.searchParams.get('conversation');
      const matchedAgreement = returnAgreement && conversation && (
        openConversation === conversation.id || conversation.sourceConversationIds?.includes(openConversation));
      if (matchedAgreement) {
        openButton.hidden = true;
        const proposal = conversation.messages?.find(message =>
          message.proposal?.agreement?.id === returnAgreement)?.proposal;
        for (const name of ['payment', 'paymentAgreement', 'paymentProject', 'order_id', 'status_code', 'transaction_status']) {
          params.searchParams.delete(name);
        }
        history.replaceState(history.state, '', params);
        openAgreement({
          id: returnAgreement,
          conversationId: proposal?.conversation_id || conversation.id,
          proposalId: proposal?.id,
          title: proposal?.terms?.projectName
        }, {operation: 'refresh'});
        return;
      }
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
      const hasProposalCard = conversation?.messages?.some(message => message.proposal?.id);
      openButton.hidden = !key || hasProposalCard;
      const activeAgreement = roomKey ? JSON.parse(roomKey).agreementId : null;
      const sameAgreementConversation = activeAgreement && agreementConversationId && conversation && (
        conversation.id === agreementConversationId ||
        conversation.sourceConversationIds?.includes(agreementConversationId));
      if (sameAgreementConversation) {
        chatRoomKey = key;
        chatRoomTitle = project?.title || 'Pembayaran proyek';
        return;
      }
      if (key === chatRoomKey && !activeAgreement) return;
      roomKey = chatRoomKey = key;
      agreementConversationId = null;
      roomTitle = chatRoomTitle = project?.title || 'Pembayaran proyek';
      snapshot = undefined;
      receipts.hidden = true;
      receipts.replaceChildren();
      if (dialog.open) dialog.close();
      if (!key) return;
      if (matchedReturn || (returning && !returnProject && !returnAgreement)) {
        for (const name of ['payment', 'paymentAgreement', 'paymentProject', 'order_id', 'status_code', 'transaction_status']) {
          params.searchParams.delete(name);
        }
        history.replaceState(history.state, '', params);
        openPayments('refresh');
      } else {
        void loadRoom(key);
      }
    }
  };
  void loadReviews();
})();
