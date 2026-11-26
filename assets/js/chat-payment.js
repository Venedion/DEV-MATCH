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
  const handoverReviewDialog = document.getElementById('handoverReviewDialog');
  const handoverReviewFrom = document.getElementById('handoverReviewFrom');
  const handoverReviewContent = document.getElementById('handoverReviewContent');
  const handoverReviewFooter = document.getElementById('handoverReviewFooter');
  const checkoutDialog = document.getElementById('roomPaymentCheckoutDialog');
  const ratingDialog = document.getElementById('agreementRatingDialog');
  const ratingForm = document.getElementById('agreementRatingForm');
  const ratingTitle = document.getElementById('agreementRatingTitle');
  const ratingSubtitle = document.getElementById('agreementRatingSubtitle');
  const ratingCriteria = document.getElementById('agreementRatingCriteria');
  const ratingCount = document.getElementById('agreementRatingCount');
  const ratingError = document.getElementById('agreementRatingError');
  const checkoutProject = document.getElementById('roomPaymentCheckoutProject');
  const checkoutAmountLabel = document.getElementById('roomPaymentCheckoutAmountLabel');
  const checkoutAmount = document.getElementById('roomPaymentCheckoutAmount');
  const checkoutError = document.getElementById('roomPaymentCheckoutError');
  const checkoutMode = document.getElementById('roomPaymentCheckoutMode');
  const checkoutNote = document.getElementById('roomPaymentCheckoutNote');
  const snapStatus = document.getElementById('roomPaymentSnapStatus');
  const checkoutSummary = checkoutDialog.querySelector('[data-checkout-summary]');
  const checkoutActions = document.getElementById('roomPaymentCheckoutActions');
  const snapStep = document.getElementById('roomPaymentSnapStep');
  const snapEmbed = document.getElementById('roomPaymentSnapEmbed');
  const demoGuide = document.getElementById('roomPaymentDemoGuide');
  let snapScriptPromise = null;
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
  let handoverReviewKey;
  let handoverReviewGeneration = 0;
  let handoverReviewBusy = false;
  let roomTitle;
  let agreementClientName = '';
  let snapshot;
  let busy = false;
  let handoverDialog = null;
  let handoverSelectedFiles = [];
  let reviews = [];
  let returnedRoom;
  const loading = new Map();
  let agreementRealtimeChannel = null;
  let agreementRealtimeClient = null;
  let agreementRealtimeGeneration = 0;
  let agreementRefreshQueued = false;
  let dpStatusTimer = null;
  let dpStatusPayment = null;
  let dpStatusRefreshPromise = null;
  const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  const formatTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  const formatDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
  const progressReviewClock = new Intl.DateTimeFormat('en-US', {hour: 'numeric', minute: '2-digit'});
  const progressReviewDate = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
  const handoverFileTypes = new Map([
    ['.zip', 'application/zip'],
    ['.7z', 'application/x-7z-compressed'],
    ['.rar', 'application/vnd.rar'],
    ['.tar', 'application/x-tar'],
    ['.gz', 'application/gzip'],
    ['.tgz', 'application/gzip'],
    ['.pdf', 'application/pdf'],
    ['.doc', 'application/msword'],
    ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['.txt', 'text/plain'],
    ['.md', 'text/markdown']
  ]);
  const handoverMaxFileBytes = 50 * 1024 * 1024;
  const handoverMaxTotalBytes = 100 * 1024 * 1024;
  const handoverSignedUrls = new Map();
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
  const safeHandoverFileName = value =>
    value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'handover-file';
  const handoverFileType = file => handoverFileTypes.get(
    String(file.name || '').toLowerCase().match(/\.[^.]+$/)?.[0]
  ) || '';
  const handoverSize = bytes => bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
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
  const ratingCriteriaByRole = {
    client: [
      ['qualityOfWork', 'Quality of work'],
      ['communication', 'Communication'],
      ['meetingDeadline', 'Meeting the deadline']
    ],
    developer: [
      ['clarityOfBrief', 'Clarity of the brief'],
      ['responsiveness', 'Responsiveness'],
      ['respectingScope', 'Respecting the agreed scope']
    ]
  };

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

  function setHandoverError(message = '') {
    if (!handoverDialog) return;
    const error = handoverDialog.querySelector('[data-handover-error]');
    error.textContent = message;
    error.hidden = !message;
  }

  function renderHandoverFiles() {
    const list = handoverDialog?.querySelector('[data-handover-file-list]');
    if (!list) return;
    list.innerHTML = handoverSelectedFiles.map((file, index) => `
      <li class="handover-file-row">
        <span><strong>${safe(file.name)}</strong><small>${handoverSize(file.size)}</small></span>
        <button type="button" data-handover-remove-file="${index}" aria-label="Remove ${safe(file.name)}">×</button>
      </li>`).join('');
  }

  function ensureHandoverDialog() {
    if (handoverDialog) return handoverDialog;
    handoverDialog = document.createElement('dialog');
    handoverDialog.className = 'agreement-handover-dialog';
    document.body.append(handoverDialog);
    handoverDialog.addEventListener('change', event => {
      if (!event.target.matches('[data-handover-files]')) return;
      const selected = Array.from(event.target.files || []);
      if (handoverSelectedFiles.length + selected.length > 5) {
        setHandoverError('Choose up to 5 handover files.');
      } else {
        handoverSelectedFiles.push(...selected);
        setHandoverError();
        renderHandoverFiles();
      }
      event.target.value = '';
    });
    handoverDialog.addEventListener('input', event => {
      if (event.target.name !== 'notes') return;
      const counter = handoverDialog.querySelector('[data-handover-notes-count]');
      counter.textContent = `${event.target.value.length} / 500`;
    });
    handoverDialog.addEventListener('click', event => {
      const closeButton = event.target.closest('[data-handover-close]');
      if (closeButton) {
        if (!busy) handoverDialog.close();
        return;
      }
      const removeButton = event.target.closest('[data-handover-remove-file]');
      if (removeButton) {
        handoverSelectedFiles.splice(Number(removeButton.dataset.handoverRemoveFile), 1);
        setHandoverError();
        renderHandoverFiles();
        return;
      }
      if (event.target === handoverDialog && !busy) {
        const rect = handoverDialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) handoverDialog.close();
      }
    });
    handoverDialog.addEventListener('submit', event => {
      if (!event.target.matches('[data-handover-form]')) return;
      event.preventDefault();
      const form = event.target;
      const notes = form.elements.notes.value.trim();
      const scope = Array.from(form.querySelectorAll('[name="scope"]:checked'), input => input.value);
      const expectedScope = snapshot?.room?.proposal?.scopeItems || [];
      const totalSize = handoverSelectedFiles.reduce((sum, file) => sum + file.size, 0);
      if (!handoverSelectedFiles.length) {
        setHandoverError('Add at least one handover file.');
        return;
      }
      if (handoverSelectedFiles.some(file => !handoverFileType(file) ||
          file.size < 1 || file.size > handoverMaxFileBytes) || totalSize > handoverMaxTotalBytes) {
        setHandoverError('Choose supported files up to 50 MB each and 100 MB total.');
        return;
      }
      if (scope.length !== expectedScope.length || expectedScope.some(item => !scope.includes(item))) {
        setHandoverError('Mark every scope point as delivered before handing over the system.');
        return;
      }
      if (!notes || notes.length > 500) {
        setHandoverError('Add handover notes of up to 500 characters.');
        return;
      }
      const links = {
        website: form.elements.website.value.trim(),
        repository: form.elements.repository.value.trim()
      };
      for (const [label, value] of [['Website link', links.website], ['Repository link', links.repository]]) {
        if (value && (!URL.canParse(value) || new URL(value).protocol !== 'https:')) {
          setHandoverError(`${label} must use HTTPS.`);
          return;
        }
      }
      setHandoverError();
      void perform('handover', {
        notes,
        scope,
        links,
        filesToUpload: [...handoverSelectedFiles]
      });
    });
    handoverDialog.addEventListener('cancel', event => {
      if (busy) event.preventDefault();
    });
    handoverDialog.addEventListener('close', () => {
      if (!busy) handoverSelectedFiles = [];
    });
    return handoverDialog;
  }

  function openHandoverDialog() {
    const room = snapshot?.room;
    const proposal = room?.proposal;
    if (snapshot?.role !== 'developer' || room?.project !== 'AWAITING_HANDOVER' ||
        room?.escrow !== 'REMAINING_HELD' || !proposal) return;
    const scopeItems = Array.isArray(proposal.scopeItems) ? proposal.scopeItems : [];
    if (!scopeItems.length) {
      setError('This agreement has no scope points to confirm for handover.');
      return;
    }
    const payments = snapshot.payments || [];
    const paid = payments.filter(payment => payment.status === 'PAID')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const released = (room.releases || []).reduce((sum, release) => sum + Number(release.amount || 0), 0);
    const held = Math.max(0, paid - released);
    const node = ensureHandoverDialog();
    handoverSelectedFiles = [];
    node.innerHTML = `
      <section>
        <header class="handover-dialog-header">
          <div><h2>Hand over system</h2>
            <p>${safe(proposal.name || roomTitle)} · for ${safe(agreementClientName || 'Client')}</p></div>
          <button type="button" data-handover-close aria-label="Close handover">×</button>
        </header>
        <form data-handover-form>
          <div class="handover-dialog-content">
            <section class="handover-dialog-field">
              <p class="handover-dialog-label">Files</p>
              <ul class="handover-file-list" data-handover-file-list></ul>
              <label class="handover-add-files">
                <input type="file" data-handover-files multiple
                  accept=".zip,.7z,.rar,.tar,.gz,.tgz,.pdf,.doc,.docx,.txt,.md">
                <span>＋ Add files</span>
              </label>
            </section>
            <section class="handover-dialog-field">
              <p class="handover-dialog-label">Links (optional)</p>
              <label><span class="visually-hidden">Website link</span>
                <input name="website" type="url" maxlength="2048" placeholder="https://your-website.example"></label>
              <label><span class="visually-hidden">Repository link</span>
                <input name="repository" type="url" maxlength="2048" placeholder="Repository link"></label>
            </section>
            <section class="handover-dialog-field">
              <label class="handover-dialog-label" for="handoverNotes">Handover notes</label>
              <textarea id="handoverNotes" name="notes" maxlength="500" required></textarea>
              <small class="handover-notes-count" data-handover-notes-count>0 / 500</small>
            </section>
            <section class="handover-dialog-field">
              <p class="handover-dialog-label">Scope points delivered</p>
              <div class="handover-scope-list">${scopeItems.map(item => `
                <label><input type="checkbox" name="scope" value="${safe(item)}" checked>
                  <span>${safe(item)}</span></label>`).join('')}</div>
            </section>
            <p class="handover-dialog-notice">
              ${safe(agreementClientName || 'The Client')} has 7 days to accept. After that it is accepted automatically
              and the remaining <strong>${safe(rupiah.format(held))}</strong> is released to you.
            </p>
            <p class="handover-dialog-error" data-handover-error hidden></p>
          </div>
          <footer class="handover-dialog-footer">
            <button type="button" data-handover-close>Cancel</button>
            <button type="submit" data-primary>Hand over system</button>
          </footer>
        </form>
      </section>`;
    node.showModal();
  }

  function setError(message = '') {
    error.textContent = message;
    error.hidden = !message;
  }

  function setCheckoutError(message = '') {
    checkoutError.textContent = message;
    checkoutError.hidden = !message;
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
    const environment = window.DEVMATCH_PUBLIC_CONFIG?.midtransEnvironment || 'sandbox';
    const isSandbox = environment === 'sandbox';
    const embeddedCheckoutAvailable = window.DEVMATCH_PUBLIC_CONFIG?.midtransPaymentsEnabled === true;
    const checkoutDuration = embeddedCheckoutAvailable ? '48 hours' : '10 minutes';
    checkoutMode.textContent = isSandbox ? 'Test mode' : 'Live mode';
    checkoutNote.textContent = isSandbox
      ? `Midtrans Sandbox is for testing; no real money moves. The checkout is valid for ${checkoutDuration}.${
        embeddedCheckoutAvailable ? '' : ' Snap opens in a new tab.'
      }`
      : `The checkout is valid for ${checkoutDuration}.${
        embeddedCheckoutAvailable ? '' : ' Snap opens in a new tab.'
      }`;
    demoGuide.hidden = !isSandbox;
    setCheckoutError();
    snapEmbed.replaceChildren();
    snapStep.hidden = true;
    checkoutSummary.hidden = false;
    checkoutActions.hidden = false;
    if (!checkoutDialog.open) checkoutDialog.showModal();
  }

  function loadSnap() {
    const config = window.DEVMATCH_PUBLIC_CONFIG || {};
    const environment = config.midtransEnvironment || 'sandbox';
    const clientKey = config.midtransClientKey;
    const snapJsUrl = config.midtransSnapJsUrl ||
      (environment === 'sandbox'
        ? 'https://app.sandbox.midtrans.com/snap/snap.js'
        : 'https://app.midtrans.com/snap/snap.js');
    const allowedHost = environment === 'sandbox'
      ? 'app.sandbox.midtrans.com'
      : 'app.midtrans.com';
    if (!clientKey || !['sandbox', 'production'].includes(environment)) {
      return Promise.reject(new Error('Midtrans Client Key belum dikonfigurasi untuk environment ini.'));
    }
    const expectedClientPrefix = environment === 'sandbox' ? 'SB-Mid-client-' : 'Mid-client-';
    if (!clientKey.startsWith(expectedClientPrefix)) {
      return Promise.reject(new Error('Midtrans Client Key tidak cocok dengan environment.'));
    }

    let url;
    try {
      url = new URL(snapJsUrl);
    } catch {
      return Promise.reject(new Error('Alamat Snap JavaScript tidak valid.'));
    }
    if (url.protocol !== 'https:' || url.hostname !== allowedHost || url.pathname !== '/snap/snap.js') {
      return Promise.reject(new Error('Alamat Snap JavaScript tidak cocok dengan environment.'));
    }
    if (window.snap?.embed) return Promise.resolve(window.snap);
    if (snapScriptPromise) return snapScriptPromise;

    snapScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url.href;
      script.dataset.clientKey = clientKey;
      script.async = true;
      script.onload = () => window.snap?.embed
        ? resolve(window.snap)
        : reject(new Error('Snap tidak menyediakan fungsi embed.'));
      script.onerror = () => reject(new Error('Snap gagal dimuat. Periksa koneksi dan CSP.'));
      document.head.append(script);
    }).catch(cause => {
      snapScriptPromise = null;
      throw cause;
    });
    return snapScriptPromise;
  }

  async function invokePayments(body) {
    const {data, error: failure} = await window.devMatchBackend.client.functions.invoke('payments', {body});
    if (failure) {
      const response = failure.context;
      const details = await response?.clone?.().json().catch(() => null);
      const cause = new Error(details?.error || 'Layanan pembayaran belum tersedia.');
      cause.status = response?.status;
      throw cause;
    }
    if (!data || !Object.hasOwn(data, 'data')) {
      throw new Error('Respons layanan pembayaran tidak valid.');
    }
    return data.data;
  }

  function stopDpStatusPolling() {
    if (dpStatusTimer !== null) window.clearInterval(dpStatusTimer);
    dpStatusTimer = null;
    dpStatusPayment = null;
    dpStatusRefreshPromise = null;
  }

  function setSnapStatus(message, isError = false) {
    if (!snapStatus) return;
    snapStatus.textContent = message;
    snapStatus.setAttribute('role', isError ? 'alert' : 'status');
    snapStatus.dataset.error = isError ? 'true' : 'false';
    snapStatus.hidden = !message;
  }

  function showDpStatusError(message) {
    if (checkoutDialog.open && !snapStep.hidden) setSnapStatus(message, true);
    else if (dialog.open) setError(message);
  }

  async function refreshDpStatus(payment) {
    if (dpStatusRefreshPromise) return dpStatusRefreshPromise;
    const request = invokePayments({
      action: 'refresh-status',
      paymentId: payment.paymentId,
      orderId: payment.orderId
    });
    dpStatusRefreshPromise = request;
    try {
      const result = await request;
      if (result?.paymentId !== payment.paymentId ||
          !['pending', 'paid', 'expired', 'failed', 'cancelled'].includes(result.status)) {
        throw new Error('Status pembayaran dari server tidak valid.');
      }
      if (dpStatusPayment?.paymentId !== payment.paymentId) return result.status;
      if (result.status === 'pending') {
        setSnapStatus('Payment is pending. We will keep checking securely.');
        return result.status;
      }

      stopDpStatusPolling();
      const messages = {
        paid: 'DP received. Updating the project status…',
        expired: 'This DP payment expired.',
        failed: 'The bank declined this payment.',
        cancelled: 'This payment was cancelled.'
      };
      if (checkoutDialog.open && !snapStep.hidden) {
        setSnapStatus(messages[result.status] || 'Payment status updated.');
      } else if (result.status !== 'paid' && dialog.open) {
        setError(messages[result.status] || 'Payment status updated.');
      }
      if (result.status === 'paid' && checkoutDialog.open) checkoutDialog.close();
      refreshAgreementRoom(roomKey);
      window.dispatchEvent(new CustomEvent('devmatch:dp-payment-status', {
        detail: {agreementId: payment.agreementId}
      }));
      return result.status;
    } catch (cause) {
      console.error('Unable to refresh the DP payment status.', cause);
      if (dpStatusPayment?.paymentId === payment.paymentId) {
        showDpStatusError(
          'We could not verify the payment yet. This page will retry; do not pay again while it is checking.'
        );
      }
      return null;
    } finally {
      if (dpStatusRefreshPromise === request) dpStatusRefreshPromise = null;
    }
  }

  function startDpStatusPolling(payment) {
    stopDpStatusPolling();
    dpStatusPayment = payment;
    setSnapStatus('Checking payment status with Midtrans…');
    void refreshDpStatus(payment);
    dpStatusTimer = window.setInterval(() => {
      if (!dpStatusPayment ||
          (!checkoutDialog.open && !(dialog.open && isAgreementContext()))) {
        stopDpStatusPolling();
        return;
      }
      if (document.visibilityState === 'visible' && !dpStatusRefreshPromise) {
        void refreshDpStatus(dpStatusPayment);
      }
    }, 5000);
  }

  window.addEventListener('focus', () => {
    if (dpStatusPayment && document.visibilityState === 'visible' && !dpStatusRefreshPromise) {
      void refreshDpStatus(dpStatusPayment);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (dpStatusPayment && document.visibilityState === 'visible' && !dpStatusRefreshPromise) {
      void refreshDpStatus(dpStatusPayment);
    }
  });

  async function createDpCheckout(agreementId) {
    const snap = await loadSnap();
    const created = await invokePayments({action: 'create-dp-transaction', agreementId});
    if (!created?.paymentId || !created?.orderId || !created?.snapToken) {
      throw new Error('Respons transaksi pembayaran tidak valid.');
    }
    const statusPayment = {
      paymentId: created.paymentId,
      orderId: created.orderId,
      agreementId
    };
    checkoutSummary.hidden = true;
    checkoutActions.hidden = true;
    snapStep.hidden = false;
    snapEmbed.replaceChildren();
    setSnapStatus('Checking payment status with Midtrans…');
    startDpStatusPolling(statusPayment);
    try {
      await snap.embed(created.snapToken, {
        embedId: 'roomPaymentSnapEmbed',
        onSuccess: () => { void refreshDpStatus(statusPayment); },
        onPending: () => { void refreshDpStatus(statusPayment); },
        onError: () => { void refreshDpStatus(statusPayment); },
        onClose: () => { void refreshDpStatus(statusPayment); }
      });
    } catch (cause) {
      stopDpStatusPolling();
      snapEmbed.replaceChildren();
      snapStep.hidden = true;
      checkoutSummary.hidden = false;
      checkoutActions.hidden = false;
      throw cause;
    }
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
    const dpPaid = payments.some(payment => payment.kind === 'DP' && payment.status === 'PAID');
    const awaitingProgress = developer && dpPaid && room.project === 'IN_PROGRESS' &&
      room.escrow === 'DP_HELD' && !timeline.progressSubmittedAt;
    const awaitingDp = client && room.project === 'NOT_STARTED';
    const canPayDp = awaitingDp && checkoutConfigured;
    const canSubmitFinal = developer && room.project === 'IN_PROGRESS' && progressReview?.approvedAt && !delivery;
    const canPayRemaining = client && room.project === 'AWAITING_REMAINING_PAYMENT' &&
      room.escrow === 'DP_RELEASED' && checkoutConfigured;
    const canHandover = developer && room.project === 'AWAITING_HANDOVER' && room.escrow === 'REMAINING_HELD';
    const canAccept = client && handover?.status === 'AWAITING_CLIENT';
    const canReportProblem = client && room.escrow !== 'AWAITING_DP' &&
      !['COMPLETED', 'CANCELLED', 'DISPUTED', 'DISPUTE_RESOLVED'].includes(room.project) && !dispute;
    const ratingState = room.ratingState || {};
    const canRate = ['client', 'developer'].includes(role) && ratingState.canReview === true;
    const handoverDeadline = handover?.status === 'AWAITING_CLIENT' ? dateLabel(handover.deadlineAt) : '';
    const submittedProgress = Boolean(timeline.progressSubmittedAt);
    const progressDone = Boolean(timeline.progressApprovedAt);
    const progressUpdateRequested = progressReview?.status === 'UPDATE_REQUESTED';
    const handoverDone = Boolean(timeline.resultAcceptedAt);
    const ratingsDone = ratingState.hasSubmitted === true && ratingState.counterpartSubmitted === true;
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
        ? '<p class="agreement-inline-note">Coming soon. Upload progress will be available here.</p>'
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
      ? `<div class="agreement-step-actions">${button('handover-open', 'Hand over system', true)}</div>`
      : canAccept && !dispute
        ? `<div class="agreement-step-actions">${button('review-handover', 'Review handover', true)}</div>`
        : '';
    const handoverDetails = handover?.status
      ? `<div class="agreement-handover-details">
          ${handover.files?.length ? `<section><strong>Files</strong><ul>${handover.files.map(file =>
            `<li>${file.url
              ? `<a href="${safe(file.url)}" target="_blank" rel="noopener noreferrer">${safe(file.name)}</a>`
              : safe(file.name)} <small>${handoverSize(Number(file.size) || 0)}</small></li>`
          ).join('')}</ul></section>` : ''}
          ${handover.links?.website || handover.links?.repository
            ? `<section><strong>Links</strong><ul>
                ${handover.links.website ? `<li><a href="${safe(handover.links.website)}" target="_blank" rel="noopener noreferrer">Website</a></li>` : ''}
                ${handover.links.repository ? `<li><a href="${safe(handover.links.repository)}" target="_blank" rel="noopener noreferrer">Repository</a></li>` : ''}
              </ul></section>` : ''}
          ${handover.notes ? `<section><strong>Handover notes</strong><p>${safe(handover.notes)}</p></section>` : ''}
          ${handover.scope?.length ? `<section><strong>Scope points delivered</strong><ul class="agreement-handover-scope">
            ${handover.scope.map(item => `<li><span aria-hidden="true">✓</span>${safe(item)}</li>`).join('')}
          </ul></section>` : ''}
        </div>`
      : '';
    const ratingDescription = ratingsDone
      ? 'Both reviews are published and visible on your profiles.'
      : ratingState.hasSubmitted
        ? `Your review is submitted. The other participant can review until ${dateLabel(ratingState.closesAt)}.`
        : ratingState.counterpartSubmitted
          ? `The other participant has submitted a review. Submit yours by ${dateLabel(ratingState.closesAt)}.`
          : ratingState.closesAt
            ? `Review this completed and paid agreement by ${dateLabel(ratingState.closesAt)}.`
            : 'Reviews are available for completed and paid agreements.';
    const ratingAction = canRate
      ? `<div class="agreement-step-actions">${button('rate', 'Rate now', true)}</div>`
      : ratingState.hasSubmitted
        ? `<p class="agreement-inline-note">${ratingState.published
          ? 'Your review is published.'
          : 'Your review is submitted and cannot be edited.'}</p>` : '';
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
          ? (client ? 'Waiting for you' : 'Waiting for client') : 'Upcoming', '',
        `${handoverDetails}${handoverAction}`),
      timelineStep(7, 'Rating', ratingState.submittedAt || '',
        ratingDescription, ratingsDone ? 'Done' : canRate
          ? (ratingState.counterpartSubmitted ? 'Waiting for you' : 'Waiting for review')
          : ratingState.hasSubmitted ? 'Waiting for other rating' : 'Upcoming', '', ratingAction,
        ratingsDone)
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

  function ratingStars(name, label) {
    return `<div class="agreement-rating-stars" data-rating-group="${safe(name)}" role="radiogroup" aria-label="${safe(label)}">
      ${[1, 2, 3, 4, 5].map(value => `
        <label>
          <input type="radio" name="${safe(name)}" value="${value}" aria-label="${value} out of 5" required>
          <span aria-hidden="true">★</span>
        </label>`).join('')}
    </div>`;
  }

  function updateRatingStars(group) {
    const selected = Number(group.querySelector('input:checked')?.value || 0);
    group.querySelectorAll('label').forEach((label, index) => {
      label.classList.toggle('is-selected', index < selected);
    });
    updateOverallRating();
  }

  function updateOverallRating() {
    const values = Array.from(ratingCriteria.querySelectorAll('input:checked'), input => Number(input.value));
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const stars = ratingForm.querySelector('[data-rating-overall-stars]');
    const value = ratingForm.querySelector('[data-rating-overall-value]');
    if (stars) stars.textContent = average === null
      ? '☆☆☆☆☆' : `${'★'.repeat(Math.round(average))}${'☆'.repeat(5 - Math.round(average))}`;
    if (value) value.textContent = average === null ? '—' : average.toFixed(1);
  }

  function openRatingDialog() {
    const {role, room} = snapshot || {};
    if (!room || !ratingCriteriaByRole[role] || room.ratingState?.canReview !== true) return;
    const proposal = room.proposal || {};
    const counterpart = role === 'client'
      ? room.developerName || room.developer?.displayName || agreementClientName || 'Developer'
      : room.clientName || agreementClientName || 'Client';
    const completedAt = room.result?.acceptedAt || room.timeline?.resultAcceptedAt;
    const completedDate = completedAt && !Number.isNaN(Date.parse(completedAt))
      ? ` · completed ${progressReviewDate.format(new Date(completedAt))}` : '';
    ratingTitle.textContent = `Rate ${counterpart}`;
    ratingSubtitle.textContent = `${proposal.name || roomTitle}${completedDate}`;
    ratingCriteria.innerHTML = ratingCriteriaByRole[role].map(([key, label]) => `
      <div class="agreement-rating-criterion">
        <span>${label}</span>${ratingStars(key, label)}
      </div>`).join('');
    ratingForm.reset();
    ratingError.textContent = '';
    ratingError.hidden = true;
    ratingCount.textContent = '0';
    ratingForm.querySelectorAll('.agreement-rating-stars').forEach(updateRatingStars);
    updateOverallRating();
    if (!ratingDialog.open) ratingDialog.showModal();
    ratingForm.querySelector('.agreement-rating-criterion input')?.focus();
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
    if (action === 'review-handover') {
      openHandoverReview();
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
    const isEmbeddedDp = action === 'DP' && isAgreementContext() &&
      window.DEVMATCH_PUBLIC_CONFIG?.midtransPaymentsEnabled === true;
    const dpConfirmationOpen = action === 'DP' && fields.confirmed;
    busy = true;
    content.inert = true;
    if (action === 'handover' && handoverDialog?.open) {
      const submitButton = handoverDialog.querySelector('[data-primary]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Uploading…';
      }
    }
    const checkoutButtons = dpConfirmationOpen
      ? [...checkoutDialog.querySelectorAll('button')] : [];
    checkoutButtons.forEach(checkoutButton => { checkoutButton.disabled = true; });
    setError();
    if (dpConfirmationOpen) setCheckoutError();
    let checkoutTab;
    let checkoutOpened = false;
    let updated = false;
    let uploadedHandoverPaths = [];
    let handoverSaved = false;
    try {
      if (action === 'rate') {
        const criteria = Object.fromEntries(
          ratingCriteriaByRole[snapshot?.role]?.map(([key]) => [key, Number(fields[key])]) || []
        );
        const agreementId = snapshot?.room?.proposal?.agreementId;
        if (!agreementId) throw new Error('This agreement cannot be rated.');
        await window.devMatchBackend.submitAgreementReview(agreementId, criteria, fields.text || '');
        snapshot.room.ratingState = await window.devMatchBackend.loadAgreementReviewState(agreementId);
        updated = true;
      } else if (isEmbeddedDp) {
        await createDpCheckout(JSON.parse(key).agreementId);
      } else if (isCheckout) {
        // Open during the click so the browser can authorize the new tab.
        checkoutTab = window.open('about:blank', '_blank');
        if (checkoutTab) checkoutTab.opener = null;
        const checkout = await request(key, 'checkout', {kind: action});
        if (key !== roomKey) return;
        const target = new URL(checkout.redirectUrl);
        if (target.origin !== 'https://app.sandbox.midtrans.com' || !target.pathname.startsWith('/snap/')) {
          throw new Error('Tautan checkout Sandbox tidak valid.');
        }
        if (checkoutTab && !checkoutTab.closed) {
          checkoutTab.location.replace(target.href);
          checkoutOpened = true;
          if (dpConfirmationOpen) checkoutDialog.close();
        } else {
          const link = document.createElement('a');
          link.href = target.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = 'Open Midtrans Sandbox in a new tab';
          const message = dpConfirmationOpen ? checkoutError : error;
          message.replaceChildren(link);
          message.hidden = false;
        }
      } else {
        let applyFields = fields;
        if (action === 'handover') {
          const client = window.devMatchBackend?.client;
          if (!client) throw new Error('Handover upload service is unavailable.');
          const {data, error: authError} = await client.auth.getUser();
          if (authError) throw authError;
          if (!data.user?.id) throw new Error('Log in to upload handover files.');
          const {filesToUpload = [], ...handoverFields} = fields;
          const files = [];
          for (const file of filesToUpload) {
            const path = `${JSON.parse(key).agreementId}/${data.user.id}/${crypto.randomUUID()}-${safeHandoverFileName(file.name)}`;
            const type = handoverFileType(file);
            uploadedHandoverPaths.push(path);
            const {error: uploadError} = await client.storage.from('agreement-handover').upload(path, file, {
              cacheControl: '3600',
              contentType: type,
              upsert: false
            });
            if (uploadError) throw uploadError;
            files.push({path, name: file.name.slice(0, 120), type, size: file.size});
          }
          applyFields = {...handoverFields, files};
        }
        const state = action === 'refresh' ? await request(key, 'refresh')
          : await request(key, 'apply', {...applyFields, action});
        if (action === 'handover') {
          handoverSaved = true;
          handoverDialog?.close();
          handoverSelectedFiles = [];
          try {
            await signHandoverMedia(state);
          } catch (cause) {
            setError(`Handover was submitted, but its files could not be opened: ${cause.message}`);
          }
        }
        if (key !== roomKey) return;
        snapshot = state;
        updated = true;
        if (action === 'resolve-dispute') void loadReviews();
      }
    } catch (cause) {
      if (key === roomKey) {
        if (action === 'handover') {
          setHandoverError(cause.message || 'The system could not be handed over. Please try again.');
          if ([401, 403].includes(cause.status)) showAccessError(cause);
        } else if (dpConfirmationOpen) {
          if ([401, 403].includes(cause.status)) {
            checkoutDialog.close();
            showAccessError(cause);
          } else {
            setCheckoutError(cause.message);
          }
        } else if (action === 'rate') {
          ratingError.textContent = cause.message || 'Unable to submit your rating. Please try again.';
          ratingError.hidden = false;
        } else {
          showAccessError(cause);
        }
      }
    } finally {
      if (uploadedHandoverPaths.length && !handoverSaved) {
        const client = window.devMatchBackend?.client;
        try {
          if (!client) throw new Error('Handover storage service is unavailable for cleanup.');
          const {error: cleanupError} = await client.storage.from('agreement-handover')
            .remove(uploadedHandoverPaths);
          if (cleanupError) throw cleanupError;
        } catch (cleanupError) {
          console.error('Unable to remove unsubmitted handover files.', cleanupError);
        }
      }
      if (!checkoutOpened && checkoutTab && !checkoutTab.closed) checkoutTab.close();
      busy = false;
      content.inert = false;
      checkoutButtons.forEach(checkoutButton => { checkoutButton.disabled = false; });
      if (action === 'handover' && handoverDialog?.open) {
        const submitButton = handoverDialog.querySelector('[data-primary]');
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Hand over system';
        }
      }
      if (action === 'rate') {
        const submitButton = ratingForm.querySelector('[type="submit"]');
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Submit rating';
        }
        if (updated) ratingDialog.close();
      }
      if (updated || key !== roomKey) render();
      flushAgreementRefresh(key);
    }
  }

  checkoutDialog.querySelector('[data-checkout-close]').addEventListener('click', () => checkoutDialog.close());
  checkoutDialog.querySelector('[data-checkout-cancel]').addEventListener('click', () => checkoutDialog.close());
  checkoutDialog.querySelector('[data-checkout-continue]').addEventListener('click', () =>
    perform('DP', {confirmed: true}));
  checkoutDialog.addEventListener('close', () => {
    setCheckoutError();
    setSnapStatus('');
    snapEmbed.replaceChildren();
    snapStep.hidden = true;
    checkoutSummary.hidden = false;
    checkoutActions.hidden = false;
  });
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
      const state = await signHandoverMedia(await signProgressMedia(await pending));
      const agreementId = state.room?.proposal?.agreementId;
      if (agreementId && ['client', 'developer'].includes(state.role)) {
        state.room.ratingState = await window.devMatchBackend.loadAgreementReviewState(agreementId);
      }
      if (key !== roomKey || busy) return;
      snapshot = state;
      setError();
      render();
      if (dialog.open && scrollToTop) content.scrollTop = 0;
      if (initialAction && dialog.open) {
        if (['DP', 'REMAINING', 'accept-result', 'report-problem'].includes(initialAction)) {
          void perform(initialAction);
        } else if (initialAction === 'handover') {
          openHandoverDialog();
        } else if (initialAction === 'review-handover') {
          openHandoverReview();
        } else if (initialAction === 'rate') {
          openRatingDialog();
        } else {
          const targetByAction = {
            deliver: 'form[data-action="deliver"] input[name="links"]'
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

  async function signHandoverMedia(state) {
    const files = state.room?.handover?.files || [];
    if (!files.length) return state;
    const client = window.devMatchBackend?.client;
    if (!client) throw new Error('Layanan file handover belum tersedia.');
    await Promise.all(files.map(async file => {
      if (!file?.path) return;
      const cached = handoverSignedUrls.get(file.path);
      if (cached && cached.expiresAt > Date.now() + 60_000) {
        file.url = cached.url;
        return;
      }
      const {data, error: failure} = await client.storage.from('agreement-handover')
        .createSignedUrl(file.path, 3600, {download: file.name || true});
      if (failure) throw failure;
      if (!data?.signedUrl) throw new Error('Tautan file handover tidak tersedia.');
      file.url = data.signedUrl;
      handoverSignedUrls.set(file.path, {url: data.signedUrl, expiresAt: Date.now() + 55 * 60_000});
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

  function renderHandoverReview(state) {
    const room = state.room;
    const handover = room.handover;
    const developerName = room.developerName || room.developer?.displayName || 'Developer';
    const submittedDate = handover.at && !Number.isNaN(Date.parse(handover.at))
      ? new Date(handover.at) : null;
    const submittedAt = submittedDate
      ? `${progressReviewDate.format(submittedDate)}, ${progressReviewClock.format(submittedDate)}`
      : '';
    const files = Array.isArray(handover.files) ? handover.files : [];
    const links = [
      {value: handover.links?.website, label: 'Live site'},
      {value: handover.links?.repository, label: 'Repository'}
    ].filter(link => link.value);
    const scope = Array.isArray(room.proposal.scopeItems) ? room.proposal.scopeItems : [];
    const deliveredScope = new Set(Array.isArray(handover.scope) ? handover.scope : []);
    const deliveredCount = scope.filter(item => deliveredScope.has(item)).length;
    const fileRows = files.map(file => {
      const size = Number(file.size) || 0;
      const sizeLabel = size >= 1024 * 1024
        ? `${Number.isInteger(size / (1024 * 1024)) ? size / (1024 * 1024) : (size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(size / 1024))} KB`;
      return `<li class="handover-review-row">
        <span class="handover-review-item-copy"><strong>${safe(file.name || 'Handover file')}</strong>
          <small>${safe(sizeLabel)}</small></span>
        ${file.url
          ? `<a class="handover-review-link-button" href="${safe(file.url)}" download="${safe(file.name || 'handover-file')}">Download</a>`
          : '<span class="handover-review-unavailable">Unavailable</span>'}
      </li>`;
    }).join('');
    const linkRows = links.map(link => {
      let display = link.value;
      try {
        display = new URL(link.value).hostname;
      } catch {
        // The API validates handover links as HTTPS URLs.
      }
      return `<li class="handover-review-row">
        <span class="handover-review-item-copy"><strong>${safe(display)}</strong>
          <small>${safe(link.label)}</small></span>
        <a class="handover-review-link-button" href="${safe(link.value)}" target="_blank" rel="noopener noreferrer">Open</a>
      </li>`;
    }).join('');
    const scopeRows = scope.map(item => {
      const isDelivered = deliveredScope.has(item);
      return `<li class="${isDelivered ? 'is-shown' : 'is-not-shown'}">
        <span class="progress-review-scope-mark" aria-hidden="true">${isDelivered ? '&#10003;' : ''}</span>
        <span>${safe(item)}${isDelivered ? '' : ' · not delivered yet'}</span>
      </li>`;
    }).join('');
    const deadline = handover.deadlineAt && !Number.isNaN(Date.parse(handover.deadlineAt))
      ? progressReviewDate.format(new Date(handover.deadlineAt)) : 'the deadline';
    const remaining = room.proposal.remaining != null && Number.isFinite(Number(room.proposal.remaining))
      ? Number(room.proposal.remaining)
      : Math.max(0, (Number(room.proposal.total) || 0) - (Number(room.proposal.dp) || 0));

    handoverReviewFrom.textContent =
      `From ${developerName}${submittedAt ? ` · handed over ${submittedAt}` : ''}`;
    handoverReviewContent.innerHTML = `
      <section>
        <p class="progress-review-section-label">Delivered</p>
        ${files.length || links.length
          ? `<ul class="handover-review-deliveries">${fileRows}${linkRows}</ul>`
          : '<p class="progress-review-note">No files or links were included.</p>'}
      </section>
      <section>
        <p class="progress-review-section-label">Note from ${safe(developerName)}</p>
        <p class="progress-review-note">${safe(handover.notes || '')}</p>
      </section>
      <section>
        <p class="progress-review-section-label">Scope points (${deliveredCount} of ${scope.length} delivered)</p>
        <ul class="progress-review-scope">${scopeRows || '<li>No scope points were listed.</li>'}</ul>
        <p class="handover-review-hint">Check each point yourself before you accept.</p>
      </section>
      <p class="progress-review-notice">
        Accepting releases <strong>${safe(rupiah.format(remaining))}</strong> to ${safe(developerName)}
        and completes the project. If you do nothing, it is accepted automatically on ${safe(deadline)}.
        Found a problem? Report it before then.
      </p>`;
    handoverReviewFooter.innerHTML = `
      <button type="button" data-handover-review-action="report-problem">Report a problem</button>
      <button type="button" data-handover-review-action="accept-result" data-primary>Accept result</button>`;
  }

  function openHandoverReview() {
    if (!roomKey) return;
    const generation = ++handoverReviewGeneration;
    const key = roomKey;
    handoverReviewKey = key;
    handoverReviewBusy = false;
    handoverReviewFrom.textContent = '';
    handoverReviewContent.textContent = 'Loading handover…';
    handoverReviewFooter.replaceChildren();
    if (!handoverReviewDialog.open) handoverReviewDialog.showModal();
    void (async () => {
      try {
        const state = await signHandoverMedia(await request(key));
        if (generation !== handoverReviewGeneration || !handoverReviewDialog.open) return;
        if (state.role !== 'client' || state.room?.handover?.status !== 'AWAITING_CLIENT' ||
          state.room.dispute) {
          throw new Error('This handover is no longer waiting for your review.');
        }
        snapshot = state;
        if (dialog.open) render();
        renderHandoverReview(state);
      } catch (cause) {
        if (generation !== handoverReviewGeneration || !handoverReviewDialog.open) return;
        handoverReviewContent.textContent =
          cause.message || 'Handover could not be loaded. Please try again.';
        handoverReviewFooter.innerHTML =
          '<button type="button" data-handover-review-close>Close</button>';
      }
    })();
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
    stopDpStatusPolling();
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
      const checkGateway = snapshot?.role === 'client' && pendingPayment &&
        Date.now() >= nextGatewayRefresh;
      if (checkGateway) nextGatewayRefresh = Date.now() + 36000;
      const state = await signHandoverMedia(await request(key, checkGateway ? 'refresh' : 'snapshot'));
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
    if (action === 'handover-open') openHandoverDialog();
    else if (action === 'rate') openRatingDialog();
    else if (action) perform(action);
  });
  content.addEventListener('submit', event => {
    const action = event.target.dataset.action;
    if (!action) return;
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.target));
    if (action === 'resolve-dispute') fields.partialRefund = Number(fields.partialRefund);
    perform(action, fields);
  });
  ratingForm.addEventListener('input', event => {
    if (event.target.name === 'text') ratingCount.textContent = String(event.target.value.length);
  });
  ratingForm.addEventListener('change', event => {
    const group = event.target.closest('.agreement-rating-stars');
    if (group) updateRatingStars(group);
  });
  ratingForm.addEventListener('submit', event => {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries(new FormData(ratingForm));
    const submitButton = ratingForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting…';
    ratingError.textContent = '';
    ratingError.hidden = true;
    void perform('rate', fields);
  });
  ratingDialog.querySelector('[data-rating-close]').addEventListener('click', () => ratingDialog.close());
  ratingDialog.querySelector('[data-rating-skip]').addEventListener('click', () => ratingDialog.close());
  ratingDialog.addEventListener('click', event => {
    if (event.target !== ratingDialog) return;
    const rect = ratingDialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) ratingDialog.close();
  });
  handoverReviewDialog.querySelector('[data-handover-review-close]').addEventListener('click', () => {
    if (!handoverReviewBusy) handoverReviewDialog.close();
  });
  handoverReviewDialog.addEventListener('click', event => {
    const closeButton = event.target.closest('[data-handover-review-close]');
    if (closeButton) {
      if (!handoverReviewBusy) handoverReviewDialog.close();
      return;
    }
    const action = event.target.closest('button[data-handover-review-action]')?.dataset.handoverReviewAction;
    if (action === 'report-problem') {
      if (!handoverReviewBusy && handoverReviewKey === roomKey) {
        handoverReviewDialog.close();
        void perform('report-problem');
      }
    } else if (action === 'accept-result' && !handoverReviewBusy && !busy &&
      handoverReviewKey === roomKey) {
      handoverReviewBusy = true;
      handoverReviewFooter.querySelectorAll('button').forEach(button => { button.disabled = true; });
      handoverReviewDialog.close();
      void perform('accept-result').finally(() => { handoverReviewBusy = false; });
    }
    if (event.target === handoverReviewDialog && !handoverReviewBusy) {
      const rect = handoverReviewDialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) handoverReviewDialog.close();
    }
  });
  handoverReviewDialog.addEventListener('cancel', event => {
    if (handoverReviewBusy) event.preventDefault();
  });
  handoverReviewDialog.addEventListener('close', () => {
    handoverReviewGeneration += 1;
    handoverReviewKey = null;
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
    agreementClientName = agreement.clientName || '';
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
      const returnPaymentId = returning && params.searchParams.get('paymentId');
      const returnPaymentOrderId = returning && params.searchParams.get('paymentOrderId');
      const returnProject = returning && params.searchParams.get('paymentProject');
      const openConversation = params.searchParams.get('conversation');
      const matchedAgreement = returnAgreement && conversation && (
        openConversation === conversation.id || conversation.sourceConversationIds?.includes(openConversation));
      if (matchedAgreement) {
        openButton.hidden = true;
        const proposal = conversation.messages?.find(message =>
          message.proposal?.agreement?.id === returnAgreement)?.proposal;
        for (const name of [
          'payment', 'paymentAgreement', 'paymentProject', 'paymentId', 'paymentOrderId',
          'order_id', 'status_code', 'transaction_status'
        ]) {
          params.searchParams.delete(name);
        }
        history.replaceState(history.state, '', params);
        openAgreement({
          id: returnAgreement,
          conversationId: proposal?.conversation_id || conversation.id,
          proposalId: proposal?.id,
          title: proposal?.terms?.projectName
        });
        if (returnPaymentId && returnPaymentOrderId) {
          startDpStatusPolling({
            paymentId: returnPaymentId,
            orderId: returnPaymentOrderId,
            agreementId: returnAgreement
          });
        }
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
