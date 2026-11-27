(function () {
  'use strict';

  const dialog = document.getElementById('proposalVideoDialog');
  if (!dialog) return;
  const form = dialog.querySelector('form');
  const title = dialog.querySelector('h2');
  const subtitle = dialog.querySelector('[data-video-subtitle]');
  const body = dialog.querySelector('[data-video-body]');
  const footer = dialog.querySelector('footer');
  const bucket = 'agreement-progress';
  const videoTypes = new Map([['mp4', 'video/mp4'], ['mov', 'video/quicktime'], ['webm', 'video/webm']]);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const action = (label, value, primary = false) =>
    `<button type="button" data-video-action="${value}"${primary ? ' class="is-primary"' : ''}>${escape(label)}</button>`;
  const submit = label => `<button type="submit" class="is-primary">${escape(label)}</button>`;
  let context;
  let screen;
  let gatewayState;
  let busy = false;
  let readVersion = 0;
  let file;
  let previewUrl;
  let duration;
  let mode = 'upload';

  function selectScreen(name, heading, description, content, actions) {
    screen = name;
    title.textContent = heading;
    subtitle.textContent = description;
    body.innerHTML = content + '<p class="proposal-video-error" role="alert" hidden></p>';
    footer.innerHTML = actions;
    if (!dialog.open) dialog.showModal();
  }

  function error(message) {
    const target = body.querySelector('[role="alert"]');
    if (!target) return;
    target.hidden = !message;
    target.textContent = message || '';
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = undefined;
    file = undefined;
    duration = undefined;
  }

  function httpsUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }

  async function request(operation, fields = {}) {
    const client = window.devMatchBackend.client;
    const {data, error: failure} = await client.functions.invoke('payment-api', {
      body: {operation, agreementId: context.agreement.id, ...fields}
    });
    if (failure) {
      const details = await failure.context?.clone?.().json().catch(() => null);
      throw new Error(details?.error || failure.message || 'The agreement could not be updated.');
    }
    if (!data?.data) throw new Error('The agreement service returned an invalid response.');
    return data.data;
  }

  function revisionCounts() {
    const room = gatewayState?.room;
    const limit = Number(room?.proposal?.revisionCount ?? context.terms.revisionCount) || 0;
    const used = Number(room?.revisionsUsed ?? context.agreement.revisions_used) || 0;
    return {limit, used, left: Math.max(0, limit - used)};
  }

  function renderSubmit() {
    const {limit, used} = revisionCounts();
    const revised = context.agreement.project_status === 'REVISION';
    const heading = revised ? 'Submit revised video' : 'Submit final video';
    const description = revised
      ? `Revision ${used} of ${limit} · Upload a new video that addresses the client's request.`
      : `The client will watch it, then approve and pay or request a revision. ${limit} free revisions included.`;
    const reason = context.agreement.final_revision_reason;
    selectScreen('submit', heading, description, `
      ${revised && reason ? `<p class="proposal-video-notice"><strong>Client's request:</strong> ${escape(reason)}</p>` : ''}
      <div class="proposal-video-modes" aria-label="Video source">
        <button type="button" data-video-action="upload" aria-pressed="true">Upload video</button>
        <button type="button" data-video-action="link" aria-pressed="false">Paste link</button>
      </div>
      <div data-video-upload>
        <label class="proposal-video-field"><strong>Video file</strong>
          <input name="video" type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm">
          <small>MP4, MOV or WebM · up to 5 minutes · 50 MB</small>
        </label>
        <div class="proposal-video-file" data-video-file hidden>
          <span></span>${action('Remove', 'remove')}
        </div>
      </div>
      <label class="proposal-video-field" data-video-link hidden><strong>Video link</strong>
        <input name="link" type="url" placeholder="https://" disabled>
        <small>Enter a link that starts with https://.</small>
      </label>
      <label class="proposal-video-field"><strong>Notes for the client</strong>
        <textarea name="notes" maxlength="500" required rows="3"></textarea>
      </label>`, action('Cancel', 'cancel') + submit(heading));
  }

  function setMode(value) {
    mode = value;
    for (const button of body.querySelectorAll('.proposal-video-modes button')) {
      button.setAttribute('aria-pressed', String(button.dataset.videoAction === mode));
    }
    body.querySelector('[data-video-upload]').hidden = mode !== 'upload';
    body.querySelector('[data-video-link]').hidden = mode !== 'link';
    form.elements.link.disabled = mode !== 'link';
    error();
  }

  function inspectFile(blob) {
    const type = videoTypes.get(blob.name.split('.').pop().toLowerCase());
    if (!type || (blob.type && blob.type !== type) || blob.size < 1 || blob.size > 50 * 1024 * 1024) {
      throw new Error('Choose an MP4, MOV or WebM video up to 50 MB.');
    }
    clearFile();
    file = blob;
    previewUrl = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const currentUrl = previewUrl;
    return new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        if (previewUrl !== currentUrl) return resolve();
        if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 300) {
          return reject(new Error('The video must be no longer than 5 minutes.'));
        }
        duration = video.duration;
        resolve();
      };
      video.onerror = () => previewUrl !== currentUrl ? resolve() : reject(new Error('This video could not be opened.'));
      video.src = currentUrl;
    });
  }

  async function renderReview() {
    const version = ++readVersion;
    selectScreen('review', 'Final video', '', '<p role="status">Loading final video…</p>', action('Close', 'cancel'));
    try {
      const state = await request('snapshot');
      if (readVersion !== version || !dialog.open) return;
      gatewayState = state;
      const {room, role} = state;
      const delivery = room.delivery;
      if (role !== 'client' || !delivery) throw new Error('The final video is unavailable.');
      const {limit, used, left} = revisionCounts();
      const link = httpsUrl(delivery.links?.[0]);
      let media = '';
      if (delivery.video?.path) {
        const storage = window.devMatchBackend.client.storage.from(bucket);
        const [{data, error: failure}, download] = await Promise.all([
          storage.createSignedUrl(delivery.video.path, 3600),
          storage.createSignedUrl(delivery.video.path, 3600, {download: delivery.video.name || true})
        ]);
        if (failure) throw failure;
        const url = httpsUrl(data?.signedUrl);
        if (!url) throw new Error('The final video could not be loaded.');
        const downloadUrl = httpsUrl(download.data?.signedUrl) || url;
        media = `<video src="${escape(url)}" controls playsinline preload="metadata" aria-label="Final project video"></video>
          <a class="proposal-video-download" href="${escape(downloadUrl)}" target="_blank" rel="noopener noreferrer">Video not playing? Download video</a>`;
      } else if (link) {
        media = `<section class="proposal-video-link-box"><strong>Video link</strong><p>${escape(link)}</p>
          <a href="${escape(link)}" target="_blank" rel="noopener noreferrer">Open link in a new tab</a>
          <small>This video is hosted outside DEV-MATCH.</small></section>`;
      }
      if (version !== readVersion || !dialog.open) return;
      const awaiting = room.project === 'AWAITING_REMAINING_PAYMENT' && room.escrow === 'DP_RELEASED';
      const paymentActive = gatewayState.payments?.some(item => item.kind === 'REMAINING' &&
        ['pending', 'processing'].includes(String(item.status).toLowerCase()));
      const counterpart = room.developerName || room.developer?.displayName || 'the developer';
      const notes = delivery.notes ? `<p><strong>Notes from ${escape(counterpart)}</strong></p><p>${escape(delivery.notes)}</p>` : '';
      selectScreen('review', `Final video · version ${delivery.version || used + 1}`, awaiting
        ? `Submitted by ${counterpart}. Watch it, then request a revision or accept and pay.`
        : `Submitted by ${counterpart}.`, `${media}${notes}<p class="proposal-video-summary">Revisions ${used} of ${limit} used · ${left} left</p>`,
        awaiting ? (left && !paymentActive ? action(`Request revision (${left} left)`, 'revision') : action('Close', 'cancel')) +
          action('Accept & pay remaining', 'pay', true) : action('Close', 'cancel'));
    } catch (failure) {
      if (version === readVersion && dialog.open) error(failure.message);
    }
  }

  function renderRevision() {
    const {used, limit, left} = revisionCounts();
    const counterpart = gatewayState?.room?.developerName || gatewayState?.room?.developer?.displayName || 'the developer';
    selectScreen('revision', 'Request revision', `Describe what should change. ${counterpart} will submit a new video.`, `
      <p class="proposal-video-summary">This uses 1 of your ${limit} free revisions. ${Math.max(0, left - 1)} will be left after this request.</p>
      <label class="proposal-video-field"><strong>What should be revised?</strong>
        <textarea name="reason" maxlength="500" rows="4" required autofocus></textarea>
        <small><span data-video-count>0</span> / 500</small>
      </label>`, action('Cancel', gatewayState ? 'review' : 'cancel') + submit('Send revision request'));
    if (!left || used >= limit) {
      footer.querySelector('[type="submit"]').disabled = true;
      error('All free revisions have been used.');
    }
    form.elements.reason.focus();
  }

  function open(proposal, name) {
    if (!proposal?.agreement?.id || busy) return;
    clearFile();
    ++readVersion;
    context = proposal;
    gatewayState = null;
    mode = 'upload';
    if (name === 'submit') renderSubmit();
    else if (name === 'revision') renderRevision();
    else void renderReview();
  }

  dialog.addEventListener('click', event => {
    const value = event.target.closest('[data-video-action]')?.dataset.videoAction;
    if (!value || busy) return;
    if (value === 'cancel') dialog.close();
    if (value === 'review') void renderReview();
    if (value === 'revision') renderRevision();
    if (value === 'upload' || value === 'link') setMode(value);
    if (value === 'remove') {
      clearFile();
      form.elements.video.value = '';
      body.querySelector('[data-video-file]').hidden = true;
    }
    if (value === 'pay') {
      dialog.close();
      window.DEVMATCH_ROOM_PAYMENT.openAgreement({
        id: context.agreement.id, title: context.terms.projectName,
        conversationId: context.conversation_id, proposalId: context.id
      }, {action: 'REMAINING'});
    }
  });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => { ++readVersion; clearFile(); });
  form.addEventListener('input', event => {
    const count = body.querySelector('[data-video-count]');
    if (count && event.target.name === 'reason') count.textContent = String(event.target.value.length);
  });
  form.addEventListener('change', async event => {
    if (event.target.name !== 'video') return;
    const version = readVersion;
    const selected = event.target.files[0];
    const row = body.querySelector('[data-video-file]');
    row.hidden = true;
    clearFile();
    error();
    if (!selected) return;
    try {
      await inspectFile(selected);
      if (version !== readVersion || file !== selected || !duration) return;
      const seconds = Math.floor(duration);
      row.querySelector('span').textContent = `${selected.name} · ${(selected.size / 1024 ** 2).toFixed(1)} MB · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      row.hidden = false;
    } catch (failure) {
      if (version !== readVersion || file !== selected && file) return;
      clearFile();
      event.target.value = '';
      error(failure.message);
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !['submit', 'revision'].includes(screen)) return;
    const {agreement} = context;
    const client = window.devMatchBackend.client;
    let uploadedPath;
    let submitted = false;
    busy = true;
    const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
    buttons.forEach(button => { button.disabled = true; });
    error();
    try {
      if (screen === 'revision') {
        const reason = form.elements.reason.value.trim();
        if (!reason) throw new Error('Describe what should change.');
        await request('apply', {action: 'revision', reason});
      } else {
        const notes = form.elements.notes.value.trim();
        if (!notes) throw new Error('Add notes for the client.');
        const fields = {action: 'deliver', notes};
        if (mode === 'link') {
          const url = httpsUrl(form.elements.link.value.trim());
          if (!url) throw new Error('Enter a link that starts with https://.');
          fields.links = [url];
        } else {
          if (!file || !duration) throw new Error('Choose a compatible video and wait for it to load.');
          const {data, error: failure} = await client.auth.getUser();
          if (failure) throw failure;
          if (!data.user?.id) throw new Error('Log in before uploading a final video.');
          const name = file.name.replace(/[^A-Za-z0-9._-]/g, '-').slice(-100);
          uploadedPath = `${agreement.id}/${data.user.id}/final-${crypto.randomUUID()}-${name}`;
          const type = videoTypes.get(file.name.split('.').pop().toLowerCase());
          const {error: uploadError} = await client.storage.from(bucket).upload(uploadedPath, file, {contentType: type});
          if (uploadError) throw uploadError;
          fields.video = {path: uploadedPath, name: file.name.slice(0, 120), type, size: file.size, durationSeconds: duration};
        }
        await request('apply', fields);
      }
      submitted = true;
      dialog.close();
      window.dispatchEvent(new CustomEvent('devmatch:proposal-card-updated', {detail: {agreementId: agreement.id}}));
    } catch (failure) {
      error(failure.message);
    } finally {
      if (uploadedPath && !submitted) {
        try {
          const {error: failure} = await client.storage.from(bucket).remove([uploadedPath]);
          if (failure) console.error('Unable to remove an unsubmitted final video.', failure);
        } catch (failure) {
          console.error('Unable to remove an unsubmitted final video.', failure);
        }
      }
      busy = false;
      buttons.forEach(button => { button.disabled = false; });
    }
  });

  window.DEVMATCH_PROPOSAL_VIDEO = {open};
})();

