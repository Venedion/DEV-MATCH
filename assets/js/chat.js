(function() {
  'use strict';

  const backend = window.devMatchBackend;
  const client = backend.client;
  const LEGACY_CHAT_STORAGE_KEY = 'devmatch_chat_conversations_v2';
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ALLOWED_PROPOSAL_ATTACHMENT_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]);
  const PROGRESS_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
  const PROGRESS_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const PROPOSAL_CARD_STAGES = [
    {
      id: 'dp-paid',
      label: '1 · DP paid',
      client: {
        status: 'Waiting for progress',
        note: name => `DP paid and held. Waiting for ${name} to submit progress.`,
        actions: []
      },
      developer: {
        status: 'DP paid',
        note: () => 'DP paid and held. Upload progress to continue.',
        actions: ['Upload progress']
      }
    },
    {
      id: 'progress-submitted',
      label: '2 · Progress submitted',
      client: {
        status: 'Progress submitted',
        note: () => 'Review progress within 5 days. It will be automatically approved after that.',
        actions: ['Review progress']
      },
      developer: {
        status: 'Waiting for review',
        note: name => `Progress submitted. Waiting for ${name} to review it.`,
        actions: []
      }
    },
    {
      id: 'progress-approved',
      label: '3 · Progress approved',
      client: {
        status: 'Progress approved',
        note: name => `Progress approved. The DP has been released to ${name}.`,
        actions: []
      },
      developer: {
        status: 'Progress approved',
        note: () => 'The DP has been released. Submit the final video when it is ready.',
        actions: ['Submit final video']
      }
    },
    {
      id: 'final-video-shared',
      label: '4 · Final video shared',
      client: {
        status: 'Final video shared',
        note: () => 'Watch the final video, then pay the remaining balance.',
        actions: ['Pay remaining · {remaining}', 'Watch video']
      },
      developer: {
        status: 'Waiting for remaining payment',
        note: name => `Final video shared. Waiting for ${name} to pay the remaining balance.`,
        actions: []
      }
    },
    {
      id: 'remaining-paid',
      label: '5 · Remaining paid',
      client: {
        status: 'Remaining paid',
        note: () => 'The remaining payment is held until the system handover is complete.',
        actions: []
      },
      developer: {
        status: 'Remaining paid',
        note: () => 'The remaining payment is held. Hand over the system to continue.',
        actions: ['Hand over system']
      }
    },
    {
      id: 'system-handed-over',
      label: '6 · System handed over',
      client: {
        status: 'System handed over',
        note: () => 'Accept the result within 7 days or report a problem.',
        actions: ['Accept result', 'Report a problem']
      },
      developer: {
        status: 'Waiting for client',
        note: name => `System handed over. Waiting for ${name} to respond within 7 days.`,
        actions: []
      }
    },
    {
      id: 'completed',
      label: '7 · Completed',
      client: {
        status: 'Completed',
        note: () => 'Project completed. Rate your experience.',
        actions: ['Rate']
      },
      developer: {
        status: 'Completed',
        note: () => 'Project completed. Rate your experience.',
        actions: ['Rate']
      }
    },
    {
      id: 'problem-reported',
      label: '8 · Problem reported',
      client: {
        status: 'Problem reported',
        note: () => 'Payment is frozen while support reviews the reported problem.',
        actions: ['Contact support']
      },
      developer: {
        status: 'Problem reported',
        note: () => 'Payment is frozen while support reviews the reported problem.',
        actions: ['Contact support']
      }
    }
  ];

  const convListEl = document.getElementById('chatConvList');
  const threadContainerEl = document.getElementById('chatThreadContainer');
  const chatMessagesEl = document.getElementById('chatMessages');
  const quickRepliesEl = document.getElementById('chatQuickReplies');
  const messageInputEl = document.getElementById('chatMessageInput');
  const chatFormEl = document.getElementById('chatComposerForm');
  const attachmentInputEl = document.getElementById('chatAttachmentInput');
  const attachmentPreviewEl = document.getElementById('chatAttachmentPreview');
  const attachButtonEl = document.getElementById('chatAttachBtn');
  const composerMenuEl = document.getElementById('chatComposerMenu');
  const uploadFileButtonEl = document.getElementById('chatUploadFileAction');
  const projectTermsButtonEl = document.getElementById('chatProjectTermsAction');
  const proposalDialogEl = document.getElementById('proposeProjectDialog');
  const proposalFormEl = document.getElementById('proposeProjectForm');
  const proposalScopeListEl = document.getElementById('proposeProjectScopeList');
  const progressDialogEl = document.getElementById('proposalProgressDialog');
  const progressFormEl = document.getElementById('proposalProgressForm');
  const searchInputEl = document.getElementById('chatSearchInput');
  const filterBtns = document.querySelectorAll('.chat-filter-btn');
  const chatViewportEl = document.getElementById('chatViewport');
  const chatEmptyStateEl = document.getElementById('chatEmptyState');
  const detailPaneEl = document.getElementById('chatDetailPane');
  const detailBackdropEl = document.getElementById('chatDetailBackdrop');
  const totalBadgeEl = document.getElementById('chatTotalBadge');
  const statusEl = document.getElementById('chatStatus');
  const sendBtnEl = chatFormEl?.querySelector('[type="submit"]');
  const mobileChatBreakpoint = window.matchMedia('(orientation: portrait)');
  const elements = {
    activeAvatar: document.getElementById('activeAvatar'),
    activeName: document.getElementById('activeName'),
    activeRole: document.getElementById('activeRole'),
    activeStatusDot: document.getElementById('activeStatusDot'),
    activeStatusText: document.getElementById('activeStatusText'),
    activeProjectBanner: document.getElementById('activeProjectBanner'),
    activeProjectImage: document.getElementById('activeProjectImage'),
    activeProjectCategory: document.getElementById('activeProjectCategory'),
    activeProjectTitle: document.getElementById('activeProjectTitle'),
    activeProjectPrice: document.getElementById('activeProjectPrice'),
    viewProjectLink: document.getElementById('viewProjectLink'),
    viewProjectBtn: document.getElementById('viewProjectBtn'),
    projectEngagementPanel: document.getElementById('projectEngagementPanel'),
    engagementStatus: document.getElementById('engagementStatus'),
    confirmProjectCompletion: document.getElementById('confirmProjectCompletion'),
    projectReviewForm: document.getElementById('projectReviewForm'),
    projectReviewRating: document.getElementById('projectReviewRating'),
    projectReviewText: document.getElementById('projectReviewText'),
    projectReviewMessage: document.getElementById('projectReviewMessage'),
    activeWhatsAppBtn: document.getElementById('activeWhatsAppBtn'),
    detailAvatar: document.getElementById('detailAvatar'),
    detailName: document.getElementById('detailName'),
    detailRole: document.getElementById('detailRole'),
    detailProjectCard: document.getElementById('detailProjectCard'),
    detailProfileLink: document.getElementById('detailProfileLink'),
    detailProjectTitle: document.getElementById('detailProjectTitle'),
    detailProjectDesc: document.getElementById('detailProjectDesc'),
    detailProjectPrice: document.getElementById('detailProjectPrice'),
    detailFilesList: document.getElementById('detailFilesList'),
    detailWhatsAppAction: document.getElementById('detailWhatsAppAction')
  };

  let currentUser = null;
  let currentProfile = null;
  let conversations = [];
  let activeConvId = null;
  let pendingConversationDraft = null;
  let currentFilter = 'all';
  let searchQuery = '';
  let realtimeChannel = null;

  function syncMobileChatRoomNavbar(isRoomOpen) {
    if (!window.matchMedia('(orientation: portrait)').matches) return;
    const nav = document.querySelector('.mobile-bottom-nav');
    if (!nav) return;
    nav.classList.toggle('chat-room-open', isRoomOpen);
    document.body.classList.toggle('mobile-chat-room-open', isRoomOpen);
    if (isRoomOpen) {
      nav.classList.add('is-hidden');
      document.body.classList.add('mobile-bottom-nav-hidden');
    } else {
      nav.classList.remove('is-hidden');
      document.body.classList.remove('mobile-bottom-nav-hidden');
    }
  }
  const presenceChannels = new Map();
  let presenceReady = false;
  let isSending = false;
  let selectedAttachment = null;
  let projectDetailsPromise = null;
  let proposalContextId = null;
  let progressProposal = null;
  let progressVideoObjectUrl = null;
  let progressVideoDurationSeconds = null;
  let proposalScopeItems = [];
  let proposalDownPayment = 25;
  let proposalRevisionCount = 2;

  function setStatus(message, isError = false) {
    if (!statusEl) return;
    if (/^Loading\b/.test(message) && window.DEVMATCH_SKELETON) {
      window.DEVMATCH_SKELETON.status(statusEl,message,1);
    } else {
      statusEl.textContent = message;
    }
    statusEl.classList.toggle('is-error', isError);
  }

  function setComposerMenuOpen(open) {
    if (!composerMenuEl || !attachButtonEl) return;
    composerMenuEl.hidden = !open;
    attachButtonEl.setAttribute('aria-expanded', String(open));
  }

  function proposalAmount(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits ? Math.min(Number(digits), Number.MAX_SAFE_INTEGER) : 0;
  }

  function formatProposalAmount(value) {
    return `Rp ${Math.max(0, Math.round(Number(value) || 0)).toLocaleString('id-ID')}`;
  }

  function updateProposalCalculations() {
    const priceInput = document.getElementById('proposeProjectPrice');
    const dpPercent = document.getElementById('proposeProjectDpPercent');
    const dpAmount = document.getElementById('proposeProjectDpAmount');
    const remainingAmount = document.getElementById('proposeProjectRemainingAmount');
    const total = proposalAmount(priceInput?.value);
    const downPayment = Math.round(total * proposalDownPayment / 100);
    if (dpPercent) dpPercent.textContent = String(proposalDownPayment);
    if (dpAmount) dpAmount.textContent = formatProposalAmount(downPayment);
    if (remainingAmount) remainingAmount.textContent = formatProposalAmount(total - downPayment);
  }

  function updateProposalCounters() {
    [
      ['proposeProjectName', 'proposeProjectNameCount'],
      ['proposeProjectDescription', 'proposeProjectDescriptionCount'],
      ['proposeProjectRevisionNotes', 'proposeProjectRevisionNotesCount']
    ].forEach(([inputId, countId]) => {
      const input = document.getElementById(inputId);
      const count = document.getElementById(countId);
      if (input && count) count.textContent = String(input.value.length);
    });
    const scopeCount = document.getElementById('proposeProjectScopeCount');
    if (scopeCount) scopeCount.textContent = String(proposalScopeItems.length);
    const addScopeButton = document.getElementById('addProposalScopePoint');
    if (addScopeButton) addScopeButton.disabled = proposalScopeItems.length >= 20;
  }

  function renderProposalScopeItems() {
    if (!proposalScopeListEl) return;
    proposalScopeListEl.replaceChildren();
    proposalScopeItems.forEach((value, index) => {
      const item = document.createElement('li');
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 300;
      input.value = value;
      input.placeholder = `Describe deliverable ${index + 1}`;
      input.setAttribute('aria-label', `Scope of work point ${index + 1}`);
      input.addEventListener('input', () => {
        proposalScopeItems[index] = input.value;
      });

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'chat-proposal-remove-point';
      removeButton.textContent = '×';
      removeButton.setAttribute('aria-label', `Remove scope point ${index + 1}`);
      removeButton.disabled = proposalScopeItems.length <= 1;
      removeButton.addEventListener('click', () => {
        proposalScopeItems.splice(index, 1);
        renderProposalScopeItems();
        updateProposalCounters();
      });
      item.append(input, removeButton);
      proposalScopeListEl.append(item);
    });
    updateProposalCounters();
  }

  function openProposalForm() {
    const conversation = getActiveConversation();
    const project = conversation?.project;
    if (!proposalDialogEl || !conversation) return;

    const workspaceRole = currentProfile?.account_role;
    setProposalStatus(workspaceRole === 'dev' || workspaceRole === 'client'
      ? `Terms are saved with the proposal. ${workspaceRole === 'dev' ? 'The Client' : 'The Developer'} can accept to create an agreement.`
      : 'Select a Client or Developer workspace to send a project proposal.');
    const requestProject = project?.project_kind === 'request' ? project : null;
    const contextId = `${conversation.id || 'draft'}:${project?.id || 'none'}:${conversation.contactId || conversation.participantId || ''}`;
    if (proposalContextId !== contextId) {
      const requestData = requestProject?.requestData || {};
      const initialFeatures = Array.isArray(requestData.features)
        ? requestData.features.filter(value => typeof value === 'string').map(value => value.trim()).filter(Boolean).slice(0, 20)
        : [];
      const initialScopes = initialFeatures.length ? initialFeatures : [''];
      proposalFormEl?.reset();
      document.getElementById('proposeProjectName').value = requestProject?.title || '';
      document.getElementById('proposeProjectDescription').value =
        requestData.description || requestData.overview || requestProject?.summary || '';
      const priceInput = document.getElementById('proposeProjectPrice');
      const initialPrice = requestData.price || requestData.budgetFrom || '';
      priceInput.value = initialPrice ? formatProposalAmount(proposalAmount(initialPrice)) : '';
      const budgetFrom = requestData.budgetFrom;
      const budgetTo = requestData.budgetTo;
      const budgetLabel = budgetFrom && budgetTo
        ? `${formatProposalAmount(proposalAmount(budgetFrom))} — ${formatProposalAmount(proposalAmount(budgetTo))}`
        : requestData.budget || requestProject?.price || 'Not specified';
      const budgetHint = document.getElementById('proposeProjectBudget');
      if (budgetHint) {
        budgetHint.textContent = `Client budget: ${budgetLabel}${requestData.negotiable ? ' · Negotiable' : ''}`;
      }
      const deadlineInput = document.getElementById('proposeProjectDeadline');
      if (/^\d{4}-\d{2}-\d{2}$/.test(requestData.deadline || '')) {
        deadlineInput.value = requestData.deadline;
      }
      const recipient = document.getElementById('proposeProjectRecipient');
      if (recipient) {
        const requestLabel = requestProject
          ? ` · from request "${requestProject.title || 'Project request'}"`
          : '';
        recipient.textContent = `To ${conversation.contactDisplayName || conversation.name}${requestLabel}`;
      }
      proposalDownPayment = 25;
      proposalRevisionCount = 2;
      proposalScopeItems = initialScopes;
      const revisionOutput = document.getElementById('proposeProjectRevisionCount');
      if (revisionOutput) revisionOutput.textContent = String(proposalRevisionCount);
      renderProposalAttachments();
      document.querySelectorAll('[data-proposal-dp]').forEach(button => {
        const selected = Number(button.dataset.proposalDp) === proposalDownPayment;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      proposalContextId = contextId;
      renderProposalScopeItems();
      updateProposalCounters();
      updateProposalCalculations();
    }

    if (!proposalDialogEl.open) proposalDialogEl.showModal();
  }

  function renderProposalAttachments() {
    const input = document.getElementById('proposeProjectAttachments');
    const list = document.getElementById('proposeProjectAttachmentList');
    if (!input || !list) return;
    list.replaceChildren();
    Array.from(input.files || []).forEach(file => {
      const item = document.createElement('li');
      item.textContent = `${file.name} · ${formatFileSize(file.size)}`;
      list.append(item);
    });
  }

  function formatProposalDeadline(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Not set';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? 'Not set'
      : date.toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'});
  }

  function setProgressStatus(message = '') {
    const status = document.getElementById('proposalProgressStatus');
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
  }

  function clearProgressVideoPreview() {
    const preview = document.getElementById('proposalProgressVideoPreview');
    if (progressVideoObjectUrl) URL.revokeObjectURL(progressVideoObjectUrl);
    progressVideoObjectUrl = null;
    progressVideoDurationSeconds = null;
    if (preview) {
      preview.pause();
      preview.removeAttribute('src');
      preview.load();
      preview.hidden = true;
    }
  }

  function openProposalProgress(proposal) {
    if (!proposal?.agreement?.id || !progressDialogEl || !progressFormEl) return;
    progressProposal = proposal;
    progressFormEl.reset();
    clearProgressVideoPreview();
    setProgressStatus();
    const videoStatus = document.getElementById('proposalProgressVideoStatus');
    const project = document.getElementById('proposalProgressProject');
    const notesCount = document.getElementById('proposalProgressNotesCount');
    const scope = document.getElementById('proposalProgressScope');
    const screenshots = document.getElementById('proposalProgressScreenshotList');
    if (videoStatus) videoStatus.textContent = '';
    if (project) project.textContent = proposal.terms?.projectName || 'Project agreement';
    if (notesCount) notesCount.textContent = '0';
    screenshots?.replaceChildren();
    scope?.replaceChildren();
    [...new Set(Array.isArray(proposal.terms?.scope) ? proposal.terms.scope : [])].forEach((item, index) => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'progressScope';
      checkbox.value = item;
      checkbox.id = `proposalProgressScope${index}`;
      const text = document.createElement('span');
      text.textContent = item;
      label.append(checkbox, text);
      scope?.append(label);
    });
    if (!progressDialogEl.open) progressDialogEl.showModal();
  }

  function validateProgressVideo(file) {
    if (!PROGRESS_VIDEO_TYPES.has(file.type) || file.size < 1 || file.size > 50 * 1024 * 1024) {
      throw new Error('Choose an MP4, MOV, or WebM video up to 50 MB.');
    }
  }

  function validateProgressScreenshots(files) {
    if (files.length > 5 || files.some(file =>
      !PROGRESS_IMAGE_TYPES.has(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024)) {
      throw new Error('Choose up to 5 JPG, PNG, or WebP screenshots, each up to 5 MB.');
    }
  }

  function safeProgressFileName(name) {
    return name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'progress-file';
  }

  async function uploadProgressFile(file, agreementId, userId, uploadedPaths) {
    const path = `${agreementId}/${userId}/${crypto.randomUUID()}-${safeProgressFileName(file.name)}`;
    uploadedPaths.push(path);
    const {error} = await client.storage.from('agreement-progress').upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;
    return {path, name: file.name.slice(0, 120), type: file.type, size: file.size};
  }

  async function submitProposalProgress(event) {
    event.preventDefault();
    const videoInput = document.getElementById('proposalProgressVideo');
    const screenshotInput = document.getElementById('proposalProgressScreenshots');
    const notesInput = document.getElementById('proposalProgressNotes');
    const submitButton = progressFormEl.querySelector('[type="submit"]');
    const video = videoInput.files?.[0];
    const screenshots = Array.from(screenshotInput.files || []);
    const scope = [...progressFormEl.querySelectorAll('input[name="progressScope"]:checked')]
      .map(input => input.value);
    const notes = notesInput.value.trim();
    const durationSeconds = progressVideoDurationSeconds;
    const uploadedPaths = [];
    let submitted = false;
    const closeButtons = progressDialogEl.querySelectorAll('[data-progress-close]');
    try {
      if (!progressProposal?.agreement?.id) throw new Error('Project agreement is unavailable.');
      if (!video) throw new Error('Choose a progress video.');
      validateProgressVideo(video);
      validateProgressScreenshots(screenshots);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 300) {
        throw new Error('The video must be no longer than 5 minutes.');
      }
      if (!notes || notes.length > 500) throw new Error('Add notes of up to 500 characters.');
      if (!scope.length) throw new Error('Select at least one scope point.');
      if (new Set(scope).size !== scope.length) throw new Error('Remove duplicate scope points.');
      if (typeof window.DEVMATCH_ROOM_PAYMENT?.submitProgress !== 'function') {
        throw new Error('Progress submission service is unavailable. Please try again.');
      }
      submitButton.disabled = true;
      submitButton.textContent = 'Uploading…';
      closeButtons.forEach(button => { button.disabled = true; });
      const user = await backend.ready;
      if (!user?.id) throw new Error('Log in to upload progress.');
      const videoFile = await uploadProgressFile(video, progressProposal.agreement.id, user.id, uploadedPaths);
      const screenshotFiles = [];
      for (const file of screenshots) {
        const uploaded = await uploadProgressFile(file, progressProposal.agreement.id, user.id, uploadedPaths);
        screenshotFiles.push(uploaded);
      }
      await window.DEVMATCH_ROOM_PAYMENT.submitProgress(progressProposal.agreement.id, {
        video: {...videoFile, durationSeconds},
        screenshots: screenshotFiles,
        scope,
        notes
      });
      submitted = true;
      progressProposal.agreement.progress_review_status = 'PENDING';
      progressDialogEl.close();
      renderMessagesThread();
    } catch (error) {
      if (!submitted && uploadedPaths.length) {
        try {
          const {error: cleanupError} = await client.storage.from('agreement-progress').remove(uploadedPaths);
          if (cleanupError) throw cleanupError;
        } catch (cleanupError) {
          console.error('Unable to remove unsubmitted progress files.', cleanupError);
        }
      }
      setProgressStatus(error.message || 'Progress could not be submitted. Please try again.');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit progress';
      }
      closeButtons.forEach(button => { button.disabled = false; });
    }
  }

  function renderProjectProposalCard(proposal, preview = null) {
    if (!proposal?.terms) return '';
    const terms = proposal.terms;
    const previewStage = preview
      ? PROPOSAL_CARD_STAGES.find(stage => stage.id === preview.stageId)
      : null;
    const previewRole = preview?.role === 'client' ? 'client' : 'developer';
    const stageView = previewStage?.[previewRole] || null;
    const isPreview = Boolean(stageView);
    const isCreator = (proposal.creator_id || proposal.developer_id) === currentUser?.id;
    const isPending = proposal.status === 'pending';
    const isAccepted = proposal.status === 'accepted';
    const agreement = proposal.agreement || {};
    const role = currentProfile?.account_role;
    const isClient = role === 'client';
    const isDeveloper = role === 'dev';
    const projectStatus = agreement.project_status || 'NOT_STARTED';
    const reviewStatus = agreement.progress_review_status;
    const escrowStatus = agreement.escrow_status || 'AWAITING_DP';
    const isAwaitingDp = !isPreview && isAccepted && projectStatus === 'NOT_STARTED' &&
      escrowStatus === 'AWAITING_DP';
    const isDpPaid = !isPreview && isAccepted && escrowStatus === 'DP_HELD';
    const isProgressPending = !isPreview && reviewStatus === 'PENDING';
    const isProgressUpdateRequested = !isPreview && reviewStatus === 'UPDATE_REQUESTED';
    const isProgressApproved = !isPreview && (
      agreement.progress_approved || ['APPROVED', 'AUTO_APPROVED'].includes(reviewStatus)
    );
    const isAwaitingProgress = !isPreview && isDpPaid &&
      ['IN_PROGRESS', 'REVISION'].includes(projectStatus) &&
      !agreement.progress_submitted_at && !isProgressPending && !isProgressApproved;
    const isFinalProofShared = !isPreview && (
      projectStatus === 'AWAITING_REMAINING_PAYMENT' || agreement.final_proof_shared
    );
    const isRemainingPaid = !isPreview && (
      projectStatus === 'AWAITING_HANDOVER' || escrowStatus === 'REMAINING_HELD'
    );
    const isAwaitingResult = !isPreview && (
      projectStatus === 'AWAITING_RESULT_ACCEPTANCE' || agreement.handover_status === 'AWAITING_CLIENT'
    );
    const isCompleted = !isPreview && projectStatus === 'COMPLETED';
    const isDisputed = !isPreview && (
      projectStatus === 'DISPUTED' || agreement.dispute_status === 'NEEDS_REVIEW'
    );
    const status = stageView?.status || (isDisputed ? 'Problem reported'
      : isCompleted ? 'Completed'
      : isAwaitingResult ? 'System handed over'
      : isRemainingPaid ? 'Remaining paid'
      : isFinalProofShared ? 'Final video shared'
      : isProgressPending ? (isClient ? 'Progress submitted' : 'Waiting for review')
      : isProgressUpdateRequested ? 'Update requested'
      : isProgressApproved ? 'Progress approved'
      : isAwaitingDp ? 'Awaiting DP'
      : isAwaitingProgress ? (isDeveloper ? 'DP paid' : 'Waiting for progress')
      : isAccepted ? 'Accepted'
      : proposal.status === 'withdrawn' ? 'Withdrawn' : 'Pending approval');
    const conversation = getActiveConversation();
    const contactName = escapeHtml(conversation?.contactDisplayName || conversation?.name ||
      (currentProfile?.account_role === 'client' ? 'the Developer' : 'the Client'));
    const statusNote = stageView
      ? stageView.note(contactName)
      : isDisputed
      ? 'Payment is frozen while support reviews the reported problem.'
      : isCompleted
      ? 'Project completed. You can rate your experience.'
      : isAwaitingResult
      ? isClient
        ? 'The system was handed over. Accept the result or report a problem within 7 days.'
        : `The system was handed over. Waiting for ${contactName} to respond within 7 days.`
      : isRemainingPaid
      ? isDeveloper
        ? 'The remaining payment is held. Hand over the system to continue.'
        : 'The remaining payment is held until the system handover is complete.'
      : isFinalProofShared
      ? isClient
        ? 'The final video is ready. Watch it, then pay the remaining balance.'
        : `Final video shared. Waiting for ${contactName} to pay the remaining balance.`
      : isProgressPending
      ? isDeveloper
        ? `Progress submitted. Waiting for ${contactName} to review it.`
        : 'The Developer submitted progress for your review.'
      : isProgressUpdateRequested
      ? isDeveloper
        ? 'The Client requested an update. Submit progress again when it is ready.'
        : 'You requested an update. The DP remains held while the Developer resubmits progress.'
      : isProgressApproved
      ? isDeveloper
        ? 'The DP has been released. Submit the final video when it is ready.'
        : `Progress approved. The DP has been released to ${contactName}.`
      : isAwaitingDp
      ? isClient
        ? 'Agreement created. Pay the DP to start the project. Pay within 48 hours.'
        : `Waiting for ${contactName} to pay the DP. You can start once it is received.`
      : isDpPaid
        ? isDeveloper
          ? 'DP paid and held. Upload progress to continue.'
          : `DP paid and held. Waiting for ${contactName} to submit progress.`
      : isPending
      ? isCreator
        ? `Waiting for ${contactName} to accept. The terms are locked once accepted.`
        : 'After you accept, an agreement is created and the terms are locked. You can then open project payments.'
      : isAccepted
        ? 'Agreement created. The terms are locked. Open project payments to continue.'
        : 'This proposal was withdrawn by its creator and can no longer be accepted.';
    const cardId = escapeHtml(proposal.id);
    const paymentAction = (label, action, primary = false) =>
      `<button class="${primary ? 'chat-proposal-card-primary' : ''}" type="button" data-proposal-payments="${cardId}"${action ? ` data-proposal-payment-action="${action}"` : ''}>${escapeHtml(label)}</button>`;
    const actions = isPreview
      ? stageView.actions.map((label, index) => {
        const remaining = Math.max(0, Number(terms.totalPrice) - Number(terms.dpAmount));
        const actionLabel = label.replace('{remaining}', formatProposalAmount(remaining));
        return `<button class="${index === 0 ? 'chat-proposal-card-primary' : ''}" type="button">${escapeHtml(actionLabel)}</button>`;
      })
      : [];
    if (!isPreview && isAccepted && agreement.id) {
      if (isAwaitingDp && isClient) {
        actions.push(paymentAction(`Pay DP · ${formatProposalAmount(terms.dpAmount)}`, 'DP', true));
      } else if (isDpPaid && isDeveloper && !isProgressPending) {
        actions.push(`<button class="chat-proposal-card-primary" type="button" data-proposal-progress="${cardId}">Upload progress</button>`);
      } else if (isProgressPending && isClient) {
        actions.push(`<button class="chat-proposal-card-primary" type="button" data-proposal-review-progress="${cardId}">Review progress</button>`);
      } else if (isProgressApproved && isDeveloper) {
        actions.push(paymentAction('Submit final video', 'deliver', true));
      } else if (isFinalProofShared && isClient) {
        actions.push(paymentAction(`Pay remaining · ${formatProposalAmount(Number(terms.totalPrice) - Number(terms.dpAmount))}`, 'REMAINING', true));
      } else if (isRemainingPaid && isDeveloper) {
        actions.push(paymentAction('Hand over system', 'handover', true));
      } else if (isAwaitingResult && isClient) {
        actions.push(paymentAction('Accept result', 'accept-result', true));
        actions.push(paymentAction('Report a problem', 'report-problem'));
      } else if (isCompleted && !agreement[isClient ? 'client_rated' : 'developer_rated']) {
        actions.push(paymentAction('Rate', 'rate', true));
      } else if (isDisputed) {
        actions.push(paymentAction('Contact support', null, true));
      }
      if (isFinalProofShared && agreement.final_proof_url) {
        actions.push(`<a class="chat-proposal-card-link" href="${escapeHtml(agreement.final_proof_url)}" target="_blank" rel="noopener noreferrer">Watch video</a>`);
      }
      actions.push(`<button type="button" data-proposal-payments="${cardId}">Project payments</button>`);
    } else if (!isPreview && isPending && !isCreator) {
      actions.push(`<button class="chat-proposal-card-primary" type="button" data-proposal-accept="${cardId}">Accept proposal</button>`);
      actions.push(`<button type="button" data-proposal-ask-changes="${cardId}">Ask for changes</button>`);
    }
    if (!isPreview) {
      actions.push(`<button type="button" data-proposal-view="${cardId}">View details</button>`);
      if (isPending && isCreator) {
        actions.push(`<button type="button" data-proposal-withdraw="${cardId}">Withdraw proposal</button>`);
      }
    }
    const hasPrimaryAction = isPreview
      ? actions.length > 0
      : actions.some(action => action.includes('chat-proposal-card-primary'));
    const rows = [
      ['DP', `${Number(terms.dpPercent) || 0}%`, terms.dpAmount],
      ['Remaining payment', '', Number(terms.totalPrice) - Number(terms.dpAmount)],
      ['Deadline', '', formatProposalDeadline(terms.deadline)],
      ['Revisions', '', `${Number(terms.revisionCount) || 0} free rounds`],
      ['Scope of work', '', `${Array.isArray(terms.scope) ? terms.scope.length : 0} points`]
    ];
    const cardLabel = isPreview
      ? `${previewRole === 'client' ? 'Client' : 'Developer'} · ${previewStage.label}`
      : 'Project proposal';
    return `<article class="chat-project-proposal-card" data-project-proposal-card="${escapeHtml(proposal.id)}"${isPreview ? ` data-card-stage="${escapeHtml(previewStage.id)}" data-card-role="${previewRole}"` : ''}>
      <header><span>${escapeHtml(cardLabel)}</span><strong class="chat-proposal-status${isAwaitingDp ? ' is-awaiting-dp' : ''}">${escapeHtml(status)}</strong></header>
      <h3>${escapeHtml(terms.projectName || 'Project proposal')}</h3>
      <strong class="chat-proposal-card-price">${escapeHtml(formatProposalAmount(terms.totalPrice))}</strong>
      <dl>${rows.map(([label, hint, amount]) => `<div><dt>${escapeHtml(label)}${hint ? ` (${escapeHtml(hint)})` : ''}</dt><dd>${typeof amount === 'number' ? escapeHtml(formatProposalAmount(amount)) : escapeHtml(amount)}</dd></div>`).join('')}</dl>
      <p>${statusNote}</p>
      <footer class="${hasPrimaryAction ? 'has-primary' : ''}${actions.length === 2 ? ' is-two-actions' : ''}">${actions.join('')}</footer>
    </article>`;
  }

  function renderProposalCardStagePreview() {
    const terms = {
      projectName: 'Website redesign',
      totalPrice: 7000000,
      dpPercent: 25,
      dpAmount: 1750000,
      deadline: '2026-12-10',
      revisionCount: 2,
      scope: ['Responsive website and handover']
    };
    const cards = PROPOSAL_CARD_STAGES.flatMap(stage =>
      ['client', 'developer'].map(role => {
        const proposal = {
          id: `preview-${role}-${stage.id}`,
          developer_id: 'preview-developer',
          status: 'accepted',
          terms,
          agreement: {id: 'preview-agreement'}
        };
        const card = renderProjectProposalCard(proposal, {stageId: stage.id, role});
        return `<div class="chat-msg-row received chat-proposal-row chat-proposal-preview-row">
          <div class="chat-msg-content"><div class="chat-msg-body-row">
            <div class="chat-msg-body"><div class="chat-msg-bubble chat-proposal-message-bubble">${card}</div></div>
          </div></div>
        </div>`;
      })
    );
    return `<section class="chat-proposal-stage-preview" aria-label="Proposal card visual preview">
      <h2>Proposal card preview · 16 variants</h2>
      ${cards.join('')}
    </section>`;
  }

  function isLocalProposalCardPreview() {
    const host = window.location.hostname;
    return (host === 'localhost' || host === '127.0.0.1') &&
      new URLSearchParams(window.location.search).get('preview') === 'proposal-card-states';
  }

  function updateProposalDetailsPrintContent() {
    const printContent = document.getElementById('proposalDetailsPrintContent');
    const dialog = document.getElementById('projectProposalDetailsDialog');
    const content = document.getElementById('projectProposalDetailsContent');
    const header = dialog?.firstElementChild?.cloneNode(true);
    const details = content?.cloneNode(true);
    if (!printContent || !header || !details) return false;
    header.querySelector('[data-close-proposal-details]')?.remove();
    header.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    details.removeAttribute('id');
    details.classList.add('proposal-details-print-body');
    printContent.replaceChildren(header, details);
    return true;
  }

  function openProposalDetails(proposal, {showDialog = true} = {}) {
    const dialog = document.getElementById('projectProposalDetailsDialog');
    const content = document.getElementById('projectProposalDetailsContent');
    if (!dialog || !content || !proposal?.terms) return;
    const terms = proposal.terms;
    const conversation = getActiveConversation();
    const isCreator = (proposal.creator_id || proposal.developer_id) === currentUser?.id;
    const isPending = proposal.status === 'pending';
    const isAccepted = proposal.status === 'accepted';
    const status = isAccepted ? 'Accepted' : proposal.status === 'withdrawn' ? 'Withdrawn' : 'Pending approval';
    const sender = isCreator
      ? 'You'
      : conversation?.contactDisplayName || conversation?.name ||
        (currentProfile?.account_role === 'client' ? 'Developer' : 'Client');
    const statusLabel = document.getElementById('projectProposalDetailsStatus');
    const senderLabel = document.getElementById('projectProposalDetailsFrom');
    const statusNote = document.getElementById('projectProposalDetailsStatusNote');
    content.replaceChildren();
    hideProposalAcceptConfirmation(false);
    hideProposalWithdrawConfirmation(false);
    const addText = (tag, className, value) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      element.textContent = value;
      content.append(element);
      return element;
    };
    const addSection = (title, count) => {
      const section = document.createElement('section');
      section.className = 'chat-proposal-details-section';
      const heading = document.createElement('h4');
      heading.textContent = count === undefined ? title : `${title} (${count})`;
      section.append(heading);
      content.append(section);
      return section;
    };
    const addFact = (container, label, value) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = label;
      const detail = document.createElement('dd');
      detail.textContent = value;
      row.append(term, detail);
      container.append(row);
    };
    const setAction = (id, action, visible) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.hidden = !visible;
      button.disabled = false;
      button.removeAttribute('data-proposal-details-action');
      if (visible) {
        button.dataset.proposalDetailsAction = action;
        button.dataset.proposalId = proposal.id;
      } else {
        button.removeAttribute('data-proposal-id');
      }
    };

    addText('p', 'chat-proposal-details-eyebrow', 'PROJECT PROPOSAL');
    addText('h3', '', terms.projectName || 'Project proposal');
    if (terms.description) addText('p', 'chat-proposal-details-description', terms.description);

    const pricing = addSection('Price and payment');
    const totalPrice = document.createElement('strong');
    totalPrice.className = 'chat-proposal-details-price';
    totalPrice.textContent = formatProposalAmount(terms.totalPrice);
    pricing.append(totalPrice);
    const paymentFacts = document.createElement('dl');
    paymentFacts.className = 'chat-proposal-details-facts';
    addFact(paymentFacts, `Down payment (${Number(terms.dpPercent) || 0}%)`, formatProposalAmount(terms.dpAmount));
    addFact(
      paymentFacts,
      'Remaining payment',
      formatProposalAmount(terms.remainingAmount ?? (Number(terms.totalPrice) - Number(terms.dpAmount)))
    );
    pricing.append(paymentFacts);

    const delivery = addSection('Timeline and revisions');
    const deliveryFacts = document.createElement('dl');
    deliveryFacts.className = 'chat-proposal-details-facts';
    addFact(deliveryFacts, 'Deadline', formatProposalDeadline(terms.deadline));
    addFact(deliveryFacts, 'Free revisions', `${Number(terms.revisionCount) || 0} rounds`);
    delivery.append(deliveryFacts);

    const scopeItems = Array.isArray(terms.scope) ? terms.scope : [];
    const scopeSection = addSection('Scope of work', scopeItems.length);
    const scope = document.createElement('ol');
    scope.className = 'chat-proposal-details-scope';
    scopeItems.forEach(point => {
      const item = document.createElement('li');
      item.textContent = point;
      scope.append(item);
    });
    scopeSection.append(scope);

    const revisionSection = addSection('Revision notes');
    const revisionNotes = document.createElement('p');
    revisionNotes.className = 'chat-proposal-details-notes';
    revisionNotes.textContent = terms.revisionNotes || 'No additional revision notes.';
    revisionSection.append(revisionNotes);

    if (proposal.attachments?.length) {
      const attachmentSection = addSection('Attachments', proposal.attachments.length);
      const files = document.createElement('ul');
      files.className = 'chat-proposal-details-files';
      proposal.attachments.forEach(file => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.proposalDownload = file.id;
        button.dataset.proposalId = proposal.id;
        button.textContent = `${file.name} · ${formatFileSize(file.size)}`;
        item.append(button);
        files.append(item);
      });
      attachmentSection.append(files);
    }

    const project = conversation?.project;
    if (project?.project_kind === 'request') {
      const requestData = project.requestData || {};
      const lower = proposalAmount(requestData.budgetFrom);
      const upper = proposalAmount(requestData.budgetTo);
      const amount = proposalAmount(terms.totalPrice);
      const budgetLabel = lower && upper
        ? `${formatProposalAmount(lower)} — ${formatProposalAmount(upper)}`
        : requestData.budget || project.price || 'Not specified';
      let comparison = 'No budget set';
      if (lower && upper) comparison = amount >= lower && amount <= upper ? 'Within budget' : 'Outside budget';
      else if (upper) comparison = amount <= upper ? 'Within budget' : 'Above budget';
      else if (lower) comparison = amount >= lower ? 'Within budget' : 'Below budget';
      const comparisonSection = addSection('Compared with your request');
      const comparisonFacts = document.createElement('dl');
      comparisonFacts.className = 'chat-proposal-details-facts';
      addFact(comparisonFacts, 'Request budget', String(budgetLabel));
      addFact(comparisonFacts, 'Proposal price', comparison);
      comparisonSection.append(comparisonFacts);
    }

    if (statusLabel) {
      statusLabel.textContent = status;
      statusLabel.className = `chat-proposal-details-status is-${proposal.status}`;
    }
    if (senderLabel) {
      const sentDate = proposal.created_at ? new Date(proposal.created_at) : null;
      const sentLabel = sentDate && !Number.isNaN(sentDate.getTime())
        ? ` · sent ${sentDate.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })}`
        : '';
      senderLabel.textContent = `From ${sender}${sentLabel}`;
    }
    if (statusNote) {
      statusNote.textContent = isPending
        ? isCreator
          ? `Waiting for ${conversation?.contactDisplayName || conversation?.name || 'the other participant'} to accept.`
          : 'Accepting creates an agreement and locks these terms.'
        : isAccepted
          ? 'Agreement created. Open project payments to continue.'
          : 'This proposal was withdrawn by its creator and can no longer be accepted.';
    }
    setAction('projectProposalDetailsAskChanges', 'ask-changes', isPending && !isCreator);
    setAction('projectProposalDetailsWithdraw', 'withdraw', isPending && isCreator);
    setAction('projectProposalDetailsPayments', 'payments', isAccepted && Boolean(proposal.agreement?.id));
    setAction('projectProposalDetailsAccept', 'accept', isPending && !isCreator);

    updateProposalDetailsPrintContent();
    if (showDialog) {
      if (dialog.open) dialog.close();
      dialog.showModal();
    }
  }

  function getActiveProposal(proposalId) {
    return getActiveConversation()?.messages
      ?.find(message => message.proposal?.id === proposalId)?.proposal || null;
  }

  window.DEVMATCH_PROPOSAL_DETAILS = {
    open(proposalId) {
      const proposal = getActiveProposal(proposalId);
      if (!proposal) return false;
      openProposalDetails(proposal);
      return true;
    },
    preparePrint(proposalId) {
      const proposal = getActiveProposal(proposalId);
      if (!proposal) return false;
      openProposalDetails(proposal, {showDialog: false});
      return updateProposalDetailsPrintContent();
    }
  };

  function showProposalWithdrawConfirmation(proposalId) {
    const proposal = getActiveConversation()?.messages
      ?.find(message => message.proposal?.id === proposalId)?.proposal;
    if (proposal?.status !== 'pending'
      || (proposal.creator_id || proposal.developer_id) !== currentUser?.id) return false;
    const confirmation = document.getElementById('projectProposalWithdrawConfirmation');
    const confirmButton = confirmation?.querySelector('[data-proposal-withdraw-confirm]');
    const status = document.getElementById('projectProposalWithdrawStatus');
    if (!confirmation || !confirmButton) return false;
    confirmButton.dataset.proposalId = proposalId;
    confirmButton.disabled = false;
    const cancelButton = confirmation.querySelector('[data-proposal-withdraw-cancel]');
    if (cancelButton) cancelButton.disabled = false;
    if (status) {
      status.textContent = '';
      status.hidden = true;
      status.classList.remove('is-error');
    }
    confirmation.hidden = false;
    cancelButton?.focus();
    return true;
  }

  function showProposalAcceptConfirmation(proposalId) {
    const proposal = getActiveConversation()?.messages
      ?.find(message => message.proposal?.id === proposalId)?.proposal;
    if (proposal?.status !== 'pending'
      || (proposal.creator_id || proposal.developer_id) === currentUser?.id) return false;
    const confirmation = document.getElementById('projectProposalAcceptConfirmation');
    const acceptButton = confirmation?.querySelector('[data-proposal-accept-confirm]');
    const status = document.getElementById('projectProposalAcceptStatus');
    if (!confirmation || !acceptButton) return false;

    const terms = proposal.terms || {};
    const totalPrice = proposalAmount(terms.totalPrice);
    const dpPercent = Number(terms.dpPercent) || 0;
    const dpAmount = proposalAmount(terms.dpAmount) || Math.round(totalPrice * dpPercent / 100);
    document.getElementById('projectProposalAcceptName').textContent = terms.projectName || 'Project proposal';
    document.getElementById('projectProposalAcceptPrice').textContent = formatProposalAmount(totalPrice);
    document.getElementById('projectProposalAcceptDpLabel').textContent = `DP (${dpPercent}%)`;
    document.getElementById('projectProposalAcceptDpAmount').textContent = formatProposalAmount(dpAmount);
    document.getElementById('projectProposalAcceptDeadline').textContent =
      formatProposalDeadline(terms.deadline);
    document.getElementById('projectProposalAcceptPayer').textContent =
      currentProfile?.account_role === 'client' ? 'You' : 'The Client';

    acceptButton.dataset.proposalId = proposal.id;
    acceptButton.disabled = false;
    confirmation.querySelectorAll('[data-proposal-accept-cancel], [data-proposal-accept-close]')
      .forEach(button => { button.disabled = false; });
    if (status) {
      status.textContent = '';
      status.hidden = true;
    }
    if (!confirmation.open) confirmation.showModal();
    confirmation.querySelector('[data-proposal-accept-cancel]')?.focus();
    return true;
  }

  function hideProposalAcceptConfirmation(restoreFocus = true) {
    const confirmation = document.getElementById('projectProposalAcceptConfirmation');
    if (!confirmation) return;
    if (confirmation.open) confirmation.close();
    const acceptButton = confirmation.querySelector('[data-proposal-accept-confirm]');
    if (acceptButton) {
      acceptButton.disabled = false;
      acceptButton.removeAttribute('data-proposal-id');
    }
    confirmation.querySelectorAll('[data-proposal-accept-cancel], [data-proposal-accept-close]')
      .forEach(button => { button.disabled = false; });
    const status = document.getElementById('projectProposalAcceptStatus');
    if (status) {
      status.textContent = '';
      status.hidden = true;
    }
    if (restoreFocus) document.getElementById('projectProposalDetailsAccept')?.focus();
  }

  function hideProposalWithdrawConfirmation(restoreFocus = true) {
    const confirmation = document.getElementById('projectProposalWithdrawConfirmation');
    if (!confirmation) return;
    confirmation.hidden = true;
    const confirmButton = confirmation.querySelector('[data-proposal-withdraw-confirm]');
    if (confirmButton) {
      confirmButton.disabled = false;
      confirmButton.removeAttribute('data-proposal-id');
    }
    const cancelButton = confirmation.querySelector('[data-proposal-withdraw-cancel]');
    if (cancelButton) cancelButton.disabled = false;
    const status = document.getElementById('projectProposalWithdrawStatus');
    if (status) {
      status.textContent = '';
      status.hidden = true;
      status.classList.remove('is-error');
    }
    if (restoreFocus) document.getElementById('projectProposalDetailsWithdraw')?.focus();
  }

  function setProposalStatus(message, isError = false) {
    const status = document.getElementById('proposeProjectStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  async function ensureProposalConversation(conversation) {
    if (conversation.id) return conversation;
    const row = conversation.projectId
      ? await invokeChat('start-project', {projectId: conversation.projectId})
      : await invokeChat('start-user', {participantId: conversation.participantId});
    if (!row || typeof row.id !== 'string' || !row.id) {
      throw new Error('Chat service returned an invalid conversation.');
    }
    const contact = {
      id: conversation.participantId,
      account_role: conversation.roleType,
      username: conversation.contactUsername,
      display_name: conversation.contactDisplayName
    };
    const sourceConversations = Array.isArray(row.source_conversations) && row.source_conversations.length
      ? row.source_conversations
      : [{id: row.id, my_role: conversation.myRole}];
    const knownProjects = new Map();
    if (conversation.projectId && conversation.sourceProject) {
      knownProjects.set(conversation.projectId, conversation.sourceProject);
    }
    const persisted = conversations.find(item =>
      item.id === row.id || item.sourceConversationIds.includes(row.id)
    ) || mapConversation({
      ...row,
      project_id: conversation.projectId || row.project_id,
      contact,
      source_conversations: sourceConversations
    }, knownProjects);

    if (!conversations.some(item => item.id === persisted.id)) conversations.unshift(persisted);
    pendingConversationDraft = null;
    activeConvId = persisted.id;
    updateConversationQuery(persisted.id);
    renderConversationsList();
    renderMessagesThread();
    return persisted;
  }

  async function submitProjectProposal(event) {
    event.preventDefault();
    if (!proposalFormEl || !proposalFormEl.reportValidity()) return;
    if (!['dev', 'client'].includes(currentProfile?.account_role)) {
      setProposalStatus('Select a Client or Developer workspace to send a project proposal.', true);
      return;
    }
    const conversation = getActiveConversation();
    if (!conversation) {
      setProposalStatus('Open a conversation before sending a proposal.', true);
      return;
    }

    const input = document.getElementById('proposeProjectAttachments');
    const selectedFiles = Array.from(input?.files || []);
    const totalBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    if (selectedFiles.length > 5
      || totalBytes > 2 * 1024 * 1024
      || selectedFiles.some(file => file.size < 1 || file.size > 2 * 1024 * 1024
        || !ALLOWED_PROPOSAL_ATTACHMENT_TYPES.has(file.type))) {
      setProposalStatus('Choose up to five PDF, DOC, DOCX, JPG, PNG, or WebP files totaling no more than 2 MB.', true);
      return;
    }

    const scope = Array.from(proposalScopeListEl?.querySelectorAll('input') || [])
      .map(scopeInput => scopeInput.value.trim());
    if (!scope.length || scope.length > 20 || scope.some(point => !point || point.length > 300)) {
      setProposalStatus('Add 1 to 20 scope points, each with 1 to 300 characters.', true);
      proposalScopeListEl?.querySelector('input')?.focus();
      return;
    }
    const totalPrice = proposalAmount(document.getElementById('proposeProjectPrice').value);
    if (!Number.isSafeInteger(totalPrice) || totalPrice < 40000 || totalPrice > 1000000000) {
      setProposalStatus('Enter a total price between Rp40,000 and Rp1 billion.', true);
      document.getElementById('proposeProjectPrice').focus();
      return;
    }

    const submitButton = proposalFormEl.querySelector('[type="submit"]');
    if (submitButton?.disabled) return;
    if (submitButton) submitButton.disabled = true;
    setProposalStatus('Sending proposal securely…');
    try {
      const activeConversation = await ensureProposalConversation(conversation);
      const attachments = await Promise.all(selectedFiles.map(async file => ({
        name: file.name,
        type: file.type,
        base64: await fileAsBase64(file)
      })));
      const result = await invokeChat('create-project-proposal', {
        conversationId: activeConversation.id,
        terms: {
          projectName: document.getElementById('proposeProjectName').value.trim(),
          description: document.getElementById('proposeProjectDescription').value.trim(),
          totalPrice,
          dpPercent: proposalDownPayment,
          deadline: document.getElementById('proposeProjectDeadline').value,
          scope,
          revisionCount: proposalRevisionCount,
          revisionNotes: document.getElementById('proposeProjectRevisionNotes').value.trim()
        },
        attachments
      });
      if (!result?.message?.proposal?.id || !result.message.id) {
        throw new Error('Chat service returned an invalid proposal.');
      }
      const existing = activeConversation.messages.findIndex(message => message.id === result.message.id);
      if (existing >= 0) activeConversation.messages.splice(existing, 1, result.message);
      else activeConversation.messages.push(result.message);
      activeConversation.lastMessage = result.message;
      renderConversationsList();
      renderMessagesThread();
      scrollThreadToBottom();
      proposalDialogEl?.close();
      proposalContextId = null;
      proposalFormEl.reset();
      proposalScopeItems = [];
      renderProposalScopeItems();
      renderProposalAttachments();
      setStatus(`Proposal sent. Waiting for the ${currentProfile?.account_role === 'dev' ? 'client' : 'developer'} to accept.`);
    } catch (error) {
      console.error('Unable to send project proposal.', error);
      setProposalStatus(error.message || 'Unable to send this proposal. Please try again.', true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  function updateProposalMessage(conversation, proposal) {
    const message = conversation?.messages?.find(item =>
      item.proposal?.id === proposal?.id || item.proposal_id === proposal?.id
    );
    if (!message) return false;
    message.proposal = proposal;
    if (conversation.lastMessage?.id === message.id) conversation.lastMessage = message;
    renderConversationsList();
    if (conversation.id === activeConvId) renderMessagesThread();
    return true;
  }

  async function changeProjectProposal(action, proposalId, button) {
    const conversation = getActiveConversation();
    if (!conversation?.id || !proposalId) return false;
    if (button) button.disabled = true;
    try {
      const result = await invokeChat(action, {
        conversationId: conversation.id,
        proposalId
      });
      if (!result?.proposal || !updateProposalMessage(conversation, result.proposal)) {
        throw new Error('The updated proposal could not be displayed.');
      }
      setStatus(action === 'accept-project-proposal'
        ? 'Proposal accepted. Open Project payments on the proposal card to continue.'
        : 'Proposal withdrawn.');
      return true;
    } catch (error) {
      console.error('Unable to update project proposal.', error);
      setStatus(error.message || 'Unable to update this proposal. Please try again.', true);
      return false;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function askForProposalChanges(proposalId) {
    const conversation = getActiveConversation();
    const proposal = conversation?.messages?.find(message => message.proposal?.id === proposalId)?.proposal;
    if (!proposal || proposal.status !== 'pending') return;
    if (!messageInputEl?.value.trim()) {
      const developerName = conversation.name || 'the developer';
      messageInputEl.value = `Hi ${developerName}, I'd like to discuss some changes to your project proposal.`;
      messageInputEl.dispatchEvent(new Event('input'));
    }
    messageInputEl?.focus();
    setStatus('Review the message and send it to ask for changes.');
  }

  async function downloadProposalAttachment(proposalId, attachmentId, button) {
    const conversation = getActiveConversation();
    if (!conversation?.id) return;
    if (button) button.disabled = true;
    try {
      const result = await invokeChat('download-project-proposal-attachment', {
        conversationId: conversation.id,
        proposalId,
        attachmentId
      });
      if (!result || typeof result.base64 !== 'string' || typeof result.name !== 'string') {
        throw new Error('Chat service returned an invalid proposal attachment.');
      }
      const url = URL.createObjectURL(new Blob([decodeBase64(result.base64)], {
        type: result.type || 'application/octet-stream'
      }));
      const link = document.createElement('a');
      link.href = url;
      link.download = result.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Unable to download proposal attachment.', error);
      setStatus(error.message || 'Unable to download this proposal attachment.', true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function edgeError(error, fallback) {
    const response = error?.context;
    if (response && typeof response.clone === 'function') {
      try {
        const body = await response.clone().json();
        if (typeof body.error === 'string') return new Error(body.error);
      } catch {
        // Fall back to the SDK error when the response has no JSON body.
      }
    }
    return new Error(error?.message || fallback);
  }

  async function invokeChat(action, payload = {}) {
    const {data, error} = await client.functions.invoke('chat-api', {
      body: {action, ...payload, workspaceRole: currentProfile?.account_role}
    });
    if (error) throw await edgeError(error, 'Chat service is unavailable.');
    if (!data || !Object.hasOwn(data, 'data')) {
      throw new Error('Chat service returned an invalid response.');
    }
    return data.data;
  }

  function initials(name) {
    return String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase() || '?';
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    if (date.toDateString() === new Date().toDateString()) return 'Today';
    return date.toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'});
  }

  function localReadAt(conversationId) {
    return backend.getChatReadAt(currentUser.id, currentProfile.account_role, conversationId);
  }

  function wasReadAfterLastMessage(conversation) {
    const last = conversation.lastMessage;
    if (!last || last.sender_id === currentUser.id) return true;
    if (last.read_at && Date.parse(last.read_at) >= Date.parse(last.created_at)) return true;
    try {
      return Date.parse(last.created_at) <= localReadAt(conversation.id);
    } catch (error) {
      console.warn('Unable to read local chat status.', error);
      return false;
    }
  }

  function markRead(conversation, {notify = true} = {}) {
    conversation.unreadCount = 0;
    try {
      backend.setChatReadAt(
        currentUser.id,
        currentProfile.account_role,
        conversation.id
      );
    } catch (error) {
      console.warn('Unable to save local chat read status.', error);
    }
    if (notify) window.dispatchEvent(new Event('devmatch:messages-changed'));
  }

  function updateUnreadCounts() {
    const total = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
    if (totalBadgeEl) {
      totalBadgeEl.textContent = String(total);
      totalBadgeEl.hidden = total === 0;
    }
    const mobileTotalBadgeEl = document.getElementById('mobileChatTotalBadge');
    if (mobileTotalBadgeEl) {
      mobileTotalBadgeEl.textContent = String(total);
      mobileTotalBadgeEl.hidden = total === 0;
    }
    document.querySelectorAll('.chat-unread-total-badge').forEach(element => {
      element.textContent = String(total);
      element.hidden = total === 0;
    });
  }

  function projectUrl(project) {
    if (!project) return '#';
    const page = project.project_kind === 'request'
      ? 'devmatch-find-project-detail.html'
      : 'devmatch-developer-profile.html';
    const queryKey = project.project_kind === 'request' ? 'request' : 'developer';
    return `${page}?${queryKey}=${encodeURIComponent(project.id)}`;
  }

  function safeProjectCover(value) {
    if (typeof value !== 'string') return '';
    if (/^data:image\/(?:jpeg|png|webp);base64,/i.test(value)) return value;
    try {
      const url = new URL(value);
      return url.origin === 'https://yxwktllqbmhustmhdaqi.supabase.co'
        && url.pathname.startsWith('/storage/v1/object/public/project-media/')
        ? value
        : '';
    } catch {
      return '';
    }
  }

  function mapProject(project, fallbackKind = null) {
    if (!project) return null;
    const projectKind = project.project_kind || fallbackKind;
    const available = project.available === true
      || (project.available !== false
        && (projectKind === 'portfolio' && project.status === 'published'
          || projectKind === 'request' && project.status === 'open'));
    if (!available) {
      return {
        id: project.id,
        title: projectKind === 'request' ? 'Request unavailable' : 'Project unavailable',
        category: '',
        price: '',
        coverImage: '',
        developerName: project.developer_name || '',
        summary: '',
        requestData: null,
        project_kind: projectKind,
        ownerId: null,
        link: '#',
        available: false
      };
    }
    return {
      id: project.id,
      title: project.title,
      category: project.category,
      price: project.price,
      coverImage: safeProjectCover(project.cover_image),
      developerName: project.developer_name || '',
      clientName: project.client_name || '',
      clientInitials: initials(project.client_name || ''),
      summary: project.data?.overview || project.data?.description || '',
      requestData: projectKind === 'request'
        && project.data
        && typeof project.data === 'object'
        && !Array.isArray(project.data)
        ? project.data
        : null,
      project_kind: projectKind,
      ownerId: project.owner_id,
      link: projectUrl({...project, project_kind: projectKind}),
      available: true
    };
  }

  function renderProjectReplyContext(project, cancellable = false, clickable = false, allowProjectDetails = false) {
    if (!project?.available) return '';
    const isRequest = project.project_kind === 'request';
    const isPortfolio = project.project_kind === 'portfolio';
    const requestTitle = project.title || 'Project request';
    const projectTitle = project.title || 'Project';
    const isClickable = clickable && (isRequest || (isPortfolio && allowProjectDetails));
    const contextTag = isClickable ? 'button' : 'div';
    const contextAttributes = isClickable
      ? isRequest
        ? `type="button" class="chat-project-reply-context chat-project-reply-open"
            data-chat-request-detail="${escapeHtml(project.id)}"
            data-chat-request-title="${escapeHtml(requestTitle)}"
            aria-label="View request details: ${escapeHtml(requestTitle)}"`
        : `type="button" class="chat-project-reply-context chat-project-reply-open"
            data-chat-project-detail="${escapeHtml(project.id)}"
            data-chat-project-title="${escapeHtml(projectTitle)}"
            aria-label="View project details: ${escapeHtml(projectTitle)}"`
      : 'class="chat-project-reply-context"';
    const thumbnail = isRequest
      ? `<span class="chat-client-reply-avatar" aria-hidden="true">${escapeHtml(project.clientInitials || 'CL')}</span>`
      : project.coverImage
        ? `<img src="${escapeHtml(project.coverImage)}" alt="">`
        : '<span aria-hidden="true">Project</span>';
    return `<${contextTag} ${contextAttributes}>
      <div class="chat-project-reply-thumbnail">${thumbnail}</div>
      <div class="chat-project-reply-info">
        <strong>${escapeHtml(project.title || 'Project')}</strong>
        <small>${escapeHtml(isRequest && project.clientName
          ? `${project.clientName} · ${project.price || ''}`
          : project.price || '')}</small>
      </div>
      ${cancellable ? '<button class="chat-project-reply-cancel" type="button" data-cancel-project-reply aria-label="Cancel project reply">×</button>' : ''}
    </${contextTag}>`;
  }

  function mapConversation(row, projects) {
    const sourceConversationIds = Array.isArray(row.source_conversations)
      ? row.source_conversations.map(source => source.id).filter(Boolean)
      : [row.id];
    const existing = conversations.find(item =>
      item.id === row.id
      || sourceConversationIds.includes(item.id)
      || item.sourceConversationIds.includes(row.id)
    );
    const otherId = row.participant_a_id === currentUser.id
      ? row.participant_b_id
      : row.participant_a_id;
    const person = row.contact;
    const contextProjectId = row.project_context?.id || row.project_id || null;
    const projectRow = row.project_context || projects.get(contextProjectId);
    const projectKind = projectRow?.project_kind
      || null;
    const projectForMap = projectRow && projectKind === 'request'
      ? {...projectRow, client_name: projectRow.client_name || person?.display_name || person?.username || ''}
      : projectRow;
    const project = projectForMap
      ? mapProject(projectForMap, projectKind)
      : contextProjectId
        ? mapProject({id: contextProjectId, project_kind: projectKind, available: false}, projectKind)
        : null;
    const conversation = {
      id: row.id,
      projectId: row.project_id || null,
      messageProjectId: null,
      contactId: person?.username || otherId,
      participantId: otherId,
      contactUsername: person?.username || '',
      contactDisplayName: person?.display_name || '',
      myRole: row.participant_a_id === currentUser.id
        ? row.participant_a_role
        : row.participant_b_role,
      sourceConversationIds,
      name: person?.username || person?.display_name || 'Unavailable account',
      initials: initials(person?.username || person?.display_name),
      role: person?.account_role === 'client' ? 'Client' : person?.account_role === 'dev' ? 'Developer' : 'Account',
      roleType: person?.account_role || '',
      color: person?.account_role === 'client' ? 'coral' : 'blue',
      online: existing?.online || false,
      peerReadAt: existing?.peerReadAt || null,
      statusText: 'Encrypted chat',
      project,
      files: [],
      messages: existing?.messages || [],
      lastMessage: row.last_message || null,
      unreadCount: 0,
      quickReplies: []
    };
    if (!wasReadAfterLastMessage(conversation)) conversation.unreadCount = 1;
    return conversation;
  }

  function updateContactPresence(participantId, channel) {
    const online = Object.hasOwn(channel.presenceState(), participantId);
    let changed = false;
    conversations.forEach(conversation => {
      if (conversation.participantId !== participantId || conversation.online === online) return;
      conversation.online = online;
      changed = true;
    });
    if (changed) renderConversationsList();
  }

  function syncPresenceChannels() {
    if (!presenceReady) return;

    const participantIds = new Set(conversations.map(conversation => conversation.participantId));
    for (const [participantId, channel] of presenceChannels) {
      if (participantIds.has(participantId)) continue;
      presenceChannels.delete(participantId);
      void client.removeChannel(channel).catch(error => {
        console.error('Unable to stop tracking chat contact presence.', error);
      });
    }

    participantIds.forEach(participantId => {
      const existingChannel = presenceChannels.get(participantId);
      if (existingChannel) {
        updateContactPresence(participantId, existingChannel);
        return;
      }

      const channel = client.channel(`devmatch-user-presence:${participantId}`, {
        config: {private: true, presence: {key: currentUser.id}}
      });
      presenceChannels.set(participantId, channel);
      channel
        .on('presence', {event: 'sync'}, () => {
          updateContactPresence(participantId, channel);
        })
        .subscribe(status => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('Unable to subscribe to chat contact presence.', status);
          }
        });
    });
  }

  async function loadConversationList() {
    const rows = await invokeChat('list-conversations');
    if (!Array.isArray(rows)) throw new Error('Chat service returned an invalid conversation list.');

    const projectsById = new Map();
    conversations = rows.map(row => mapConversation(row, projectsById));
    syncPresenceChannels();
    if (activeConvId) {
      const activeConversation = conversations.find(conversation =>
        conversation.id === activeConvId
        || conversation.sourceConversationIds.includes(activeConvId)
      );
      if (activeConversation) {
        if (activeConversation.id !== activeConvId) {
          activeConvId = activeConversation.id;
          updateConversationQuery(activeConvId);
        }
      } else {
        activeConvId = null;
      }
    }
    updateUnreadCounts();
    renderConversationsList();
    renderMessagesThread();
  }

  function renderConversationsList() {
    if (!convListEl) return;
    let filtered = conversations;
    if (currentFilter === 'unread') filtered = filtered.filter(conversation => conversation.unreadCount > 0);
    else if (currentFilter === 'clients') filtered = filtered.filter(conversation => conversation.roleType === 'client');
    else if (currentFilter === 'devs') filtered = filtered.filter(conversation => conversation.roleType === 'dev');
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(conversation =>
        conversation.name.toLowerCase().includes(query)
        || conversation.project?.title?.toLowerCase().includes(query)
        || conversation.lastMessage?.text?.toLowerCase().includes(query)
      );
    }

    if (!filtered.length) {
      const emptyText = conversations.length ? 'No conversations found' : 'No conversations yet';
      convListEl.setAttribute('aria-busy', 'false');
      convListEl.innerHTML = `<li class="chat-conv-empty"><p>${emptyText}</p><small>Open a profile or project to start a secure chat.</small></li>`;
      return;
    }

    convListEl.setAttribute('aria-busy', 'false');
    convListEl.innerHTML = filtered.map(conversation => {
      const lastMessage = conversation.lastMessage;
      const preview = lastMessage
        ? `${lastMessage.sender_id === currentUser.id ? 'You: ' : ''}${lastMessage.text
          || (lastMessage.attachments?.length ? `File: ${lastMessage.attachments[0].name}` : '')}`
        : 'No messages yet';
      const projectTag = conversation.project
        ? `<span class="chat-item-tag">${escapeHtml(conversation.project.title)}</span>`
        : '';
      return `
        <li class="chat-conv-item ${conversation.id === activeConvId ? 'active' : ''} ${conversation.unreadCount ? 'unread' : ''}" data-conv-id="${escapeHtml(conversation.id)}">
          <div class="chat-avatar-wrap">
            <div class="chat-avatar ${escapeHtml(conversation.color)}">${escapeHtml(conversation.initials)}</div>
            <span class="chat-online-dot ${conversation.online ? 'online' : 'offline'}" role="img" aria-label="${conversation.online ? 'Online' : 'Offline'}" title="${conversation.online ? 'Online' : 'Offline'}"></span>
          </div>
          <div class="chat-item-main">
            <div class="chat-item-top">
              <span class="chat-item-name">${escapeHtml(conversation.name)}</span>
              <span class="chat-item-time">${lastMessage ? escapeHtml(formatTime(lastMessage.created_at)) : ''}</span>
            </div>
            ${projectTag}
            <p class="chat-item-preview">${escapeHtml(preview)}</p>
          </div>
          <div class="chat-item-badge-col">
            ${conversation.unreadCount ? '<span class="chat-unread-pill">1</span>' : ''}
          </div>
        </li>
      `;
    }).join('');

    convListEl.querySelectorAll('.chat-conv-item').forEach(element => {
      element.addEventListener('click', () => {
        void selectConversation(element.dataset.convId);
      });
    });
    elements.confirmProjectCompletion?.addEventListener('click', async () => {
      const conversation = getActiveConversation();
      if (!conversation?.project || elements.confirmProjectCompletion.disabled) return;
      elements.confirmProjectCompletion.disabled = true;
      elements.engagementStatus.textContent = 'Saving your completion confirmation…';
      try {
        await backend.confirmProjectCompletion(conversation.id);
        await refreshProjectEngagement(conversation);
      } catch (error) {
        console.error('Unable to confirm project completion.', error);
        elements.engagementStatus.textContent = error.message || 'Unable to confirm completion. Please try again.';
        elements.confirmProjectCompletion.disabled = false;
      }
    });
    elements.projectReviewForm?.addEventListener('submit', async event => {
      event.preventDefault();
      const conversation = getActiveConversation();
      const rating = Number(elements.projectReviewRating.value);
      const submitButton = elements.projectReviewForm.querySelector('[type="submit"]');
      if (!conversation?.project || !rating || submitButton.disabled) return;
      submitButton.disabled = true;
      elements.projectReviewMessage.textContent = 'Submitting your review…';
      elements.projectReviewMessage.hidden = false;
      try {
        const engagement = await backend.loadProjectEngagement(conversation.id);
        if (!engagement) throw new Error('Project completion has not been confirmed.');
        await backend.submitProjectReview(
          engagement.id,
          rating,
          elements.projectReviewText.value
        );
        elements.projectReviewForm.reset();
        await refreshProjectEngagement(conversation);
      } catch (error) {
        console.error('Unable to submit project review.', error);
        elements.projectReviewMessage.textContent = error.message || 'Unable to submit your review. Please try again.';
        elements.projectReviewMessage.hidden = false;
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  function renderConversationSkeleton(count = 5) {
    if (!convListEl) return;
    const shimmer = (className) => `<span class="devmatch-shimmer ${className}" aria-hidden="true"></span>`;
    convListEl.setAttribute('aria-busy', 'true');
    convListEl.innerHTML = Array.from({length: count}, () => `
      <li class="chat-conv-item chat-skeleton-item" aria-hidden="true">
        <div class="chat-avatar-wrap">${shimmer('chat-skeleton-avatar')}</div>
        <div class="chat-item-main">
          <div class="chat-item-top">${shimmer('chat-skeleton-name')}${shimmer('chat-skeleton-time')}</div>
          ${shimmer('chat-item-tag chat-skeleton-tag')}
          <p class="chat-item-preview">${shimmer('chat-skeleton-preview')}</p>
        </div>
        <div class="chat-item-badge-col"></div>
      </li>`).join('');
  }

  function getActiveConversation() {
    if (pendingConversationDraft && activeConvId === null) return pendingConversationDraft;
    return conversations.find(conversation => conversation.id === activeConvId) || null;
  }

  function updateConversationQuery(conversationId, preserveReview = false) {
    const url = new URL(window.location.href);
    if (conversationId) {
      url.searchParams.set('conversation', conversationId);
      ['project', 'request', 'contact', 'client'].forEach(key => url.searchParams.delete(key));
    } else {
      ['conversation', 'project', 'request', 'contact', 'client'].forEach(key => url.searchParams.delete(key));
    }
    if (!preserveReview) url.searchParams.delete('review');
    window.history.replaceState(window.history.state, '', url);
  }

  function renderMessagesThread() {
    const conversation = getActiveConversation();
    window.DEVMATCH_ROOM_PAYMENT?.setRoom(conversation === pendingConversationDraft ? null : conversation);
    const project = conversation?.project;
    const mainHeader = document.querySelector('.chat-main-header');
    const projectBanner = document.getElementById('activeProjectBanner');
    const composer = document.querySelector('.chat-composer-wrap');
    if (!conversation) {
      chatViewportEl?.classList.remove('has-active-conversation');
      if (chatEmptyStateEl) chatEmptyStateEl.hidden = false;
      if (mainHeader) mainHeader.hidden = true;
      if (projectBanner) projectBanner.hidden = true;
      if (elements.projectEngagementPanel) elements.projectEngagementPanel.hidden = true;
      if (composer) composer.hidden = true;
      if (quickRepliesEl) quickRepliesEl.hidden = true;
      setDetailPaneOpen(false);
      if (chatMessagesEl) chatMessagesEl.replaceChildren();
      return;
    }

    chatViewportEl?.classList.add('has-active-conversation');
    if (chatEmptyStateEl) chatEmptyStateEl.hidden = true;
    if (mainHeader) mainHeader.hidden = false;
    if (composer) composer.hidden = false;
    if (quickRepliesEl) quickRepliesEl.hidden = true;
    if (elements.activeAvatar) {
      elements.activeAvatar.textContent = conversation.initials;
      elements.activeAvatar.className = `chat-avatar ${conversation.color}`;
    }
    if (elements.activeName) elements.activeName.textContent = conversation.name;
    if (elements.activeRole) elements.activeRole.textContent = conversation.role;
    if (elements.activeStatusText) elements.activeStatusText.textContent = conversation.online ? 'Online' : 'Offline';
    if (elements.activeStatusDot) elements.activeStatusDot.hidden = !conversation.online;

    const isDraft = conversation === pendingConversationDraft;
    elements.detailProjectCard?.classList.toggle('is-unlinked', !project || !project.available);
    if (projectBanner) projectBanner.hidden = !project;
    if (elements.projectEngagementPanel) {
      elements.projectEngagementPanel.hidden = isDraft || Boolean(project && !project.available);
    }
    if (project) {
      if (elements.activeProjectImage) {
        elements.activeProjectImage.hidden = !project.coverImage;
        if (project.coverImage) elements.activeProjectImage.src = project.coverImage;
        else elements.activeProjectImage.removeAttribute('src');
      }
      if (elements.activeProjectCategory) elements.activeProjectCategory.textContent = project.category || '';
      if (elements.activeProjectTitle) elements.activeProjectTitle.textContent = project.title;
      if (elements.activeProjectPrice) elements.activeProjectPrice.textContent = project.price || '';
      if (elements.viewProjectLink) {
        elements.viewProjectLink.href = project.link;
        elements.viewProjectLink.hidden = !project.available;
      }
      if (elements.viewProjectBtn) {
        elements.viewProjectBtn.href = project.link;
        elements.viewProjectBtn.hidden = !project.available;
      }
    } else {
      if (elements.viewProjectLink) elements.viewProjectLink.hidden = true;
      if (elements.viewProjectBtn) elements.viewProjectBtn.hidden = true;
    }
    if (elements.activeWhatsAppBtn) elements.activeWhatsAppBtn.hidden = true;
    if (elements.detailWhatsAppAction) elements.detailWhatsAppAction.hidden = true;
    if (elements.detailAvatar) {
      elements.detailAvatar.textContent = conversation.initials;
      elements.detailAvatar.className = `chat-detail-avatar ${conversation.color}`;
    }
    if (elements.detailName) elements.detailName.textContent = conversation.name;
    if (elements.detailRole) elements.detailRole.textContent = conversation.role;
    if (elements.detailProfileLink) {
      const isClient = conversation.roleType === 'client';
      const isDeveloper = conversation.roleType === 'dev';
      elements.detailProfileLink.hidden = !conversation.participantId || (!isClient && !isDeveloper);
      if (!elements.detailProfileLink.hidden) {
        const page = isClient ? 'devmatch-client-profile.html?client=' : 'devmatch-developer-profile.html?developer=';
        elements.detailProfileLink.href = `${page}${encodeURIComponent(conversation.participantId)}`;
      }
    }
    if (elements.detailProjectTitle) {
      elements.detailProjectTitle.textContent = project?.title || 'No project linked';
    }
    if (elements.detailProjectDesc) {
      elements.detailProjectDesc.textContent = project?.available
        ? project.summary || 'Private conversation'
        : project ? '' : 'Private conversation';
    }
    if (elements.detailProjectPrice) elements.detailProjectPrice.textContent = project?.price || '';
    if (elements.detailFilesList) {
      elements.detailFilesList.innerHTML = '<li style="font-size:11px;color:var(--muted);">No shared documents yet.</li>';
    }

    const messages = conversation.messages || [];
    let previousDate = '';
    const messagesHtml = messages.map(message => {
      const dateLabel = formatDate(message.created_at);
      const dateSeparator = dateLabel && dateLabel !== previousDate
        ? `<div class="chat-date-separator"><span>${escapeHtml(dateLabel)}</span></div>`
        : '';
      previousDate = dateLabel;
      const isSent = message.sender_id === currentUser.id;
      const attachmentCards = (Array.isArray(message.attachments) ? message.attachments : [])
        .map(attachment => `<button class="chat-attachment-card" type="button" data-chat-download
          data-conversation-id="${escapeHtml(message.conversation_id)}"
          data-message-id="${escapeHtml(message.id)}"
          data-attachment-id="${escapeHtml(attachment.id)}">
          <span class="chat-attachment-icon" aria-hidden="true">↓</span>
          <span class="chat-attachment-info"><b>${escapeHtml(attachment.name)}</b>
          <small>${escapeHtml(formatFileSize(attachment.size))}</small></span>
        </button>`).join('');
      const projectContext = message.project_context?.available === true
        ? renderProjectReplyContext(
            mapProject(message.project_context),
            false,
            true,
            true
          )
        : '';
      const messageText = message.text
        ? escapeHtml(message.text).replace(/\n/g, '<br>')
        : '';
      const proposalCard = renderProjectProposalCard(message.proposal);
      const bubble = proposalCard
        ? `<div class="chat-msg-bubble chat-proposal-message-bubble">${proposalCard}</div>`
        : projectContext || messageText
        ? `<div class="chat-msg-bubble">${projectContext}${projectContext && messageText ? '<div class="chat-project-reply-divider" aria-hidden="true"></div>' : ''}${messageText}</div>`
        : '';
      return `${dateSeparator}
        <div class="chat-msg-row ${isSent ? 'sent' : 'received'}${proposalCard ? ' chat-proposal-row' : ''}">
          ${!isSent ? `<div class="chat-msg-avatar ${escapeHtml(conversation.color)}">${escapeHtml(conversation.initials)}</div>` : ''}
          <div class="chat-msg-content">
            <div class="chat-msg-body-row">
              <div class="chat-msg-body">
                ${bubble}
                ${proposalCard ? '' : attachmentCards}
              </div>
            </div>
            <div class="chat-msg-meta"><span>${escapeHtml(formatTime(message.created_at))}</span>${isSent
              ? `<span class="chat-msg-checks" aria-label="${message.read_at || Date.parse(conversation.peerReadAt || 0) >= Date.parse(message.created_at) ? 'Read' : 'Sent'}">${message.read_at || Date.parse(conversation.peerReadAt || 0) >= Date.parse(message.created_at) ? 'Read ✓✓' : 'Sent ✓'}</span>`
              : ''}</div>
          </div>
        </div>`;
    }).join('');
    const pendingProject = (isDraft || conversation.messageProjectId) ? project : null;
    const projectReplyPreview = renderProjectReplyContext(pendingProject, true);
    const projectReplyDraft = projectReplyPreview
      ? `<div class="chat-msg-row sent chat-project-reply-draft">
          <div class="chat-msg-content">
            <div class="chat-msg-body-row">
              <div class="chat-msg-body">
                <div class="chat-msg-bubble">${projectReplyPreview}</div>
              </div>
            </div>
          </div>
        </div>`
      : '';
    if (chatMessagesEl) {
      const cardPreview = isLocalProposalCardPreview();
      chatMessagesEl.innerHTML = cardPreview
        ? renderProposalCardStagePreview()
        : `${messagesHtml || '<p class="chat-conv-empty">No messages yet. Send the first message.</p>'}${projectReplyDraft}`;
      if (cardPreview && threadContainerEl) threadContainerEl.scrollTop = 0;
      else scrollThreadToBottom();
    }
    updateDetailPaneVisibility();
  }

  function cancelProjectReply() {
    const conversation = getActiveConversation();
    if (!conversation) return;
    conversation.messageProjectId = null;
    if (conversation === pendingConversationDraft) {
      conversation.projectId = null;
      conversation.sourceProject = null;
      conversation.project = null;
      updateConversationQuery(null);
    } else {
      updateConversationQuery(conversation.id);
    }
    renderMessagesThread();
  }

  function updateDetailPaneVisibility() {
    if (mobileChatBreakpoint.matches) setDetailPaneOpen(false);
  }

  function setDetailPaneOpen(isOpen) {
    if (!detailPaneEl) return;
    const shouldOpen = Boolean(isOpen);
    const isMobileModal = shouldOpen && mobileChatBreakpoint.matches;
    detailPaneEl.classList.toggle('closed', !shouldOpen);
    detailPaneEl.setAttribute('aria-hidden', String(!shouldOpen));
    if (isMobileModal) detailPaneEl.setAttribute('aria-modal', 'true');
    else detailPaneEl.removeAttribute('aria-modal');
    if (detailBackdropEl) detailBackdropEl.hidden = !isMobileModal;
    document.getElementById('toggleDetailBtn')?.setAttribute('aria-expanded', String(shouldOpen));

    if (isMobileModal) {
      document.getElementById('closeDetailBtn')?.focus();
    } else if (document.activeElement?.closest('#chatDetailPane')) {
      document.getElementById('toggleDetailBtn')?.focus();
    }
  }

  async function refreshProjectEngagement(conversation = getActiveConversation()) {
    const panel = elements.projectEngagementPanel;
    if (!panel) return;
    if (!conversation) {
      panel.hidden = true;
      return;
    }
    if (conversation === pendingConversationDraft) {
      panel.hidden = true;
      return;
    }
    if (conversation.id !== activeConvId) return;

    panel.hidden = false;
    if (!conversation.project?.id || !conversation.project.available) {
      elements.engagementStatus.textContent = 'Reviews require a project-linked conversation. Start a chat from a project page to enable completion confirmation.';
      elements.confirmProjectCompletion.hidden = true;
      elements.projectReviewForm.hidden = true;
      elements.projectReviewMessage.hidden = true;
      return;
    }
    window.DEVMATCH_SKELETON?.status(elements.engagementStatus,'Loading project completion status',1);
    elements.confirmProjectCompletion.hidden = true;
    elements.confirmProjectCompletion.disabled = true;
    elements.projectReviewForm.hidden = true;
    elements.projectReviewMessage.hidden = true;
    try {
      const engagement = await backend.loadProjectEngagement(conversation.id);
      if (conversation.id !== activeConvId) return;
      if (!engagement) {
        elements.engagementStatus.textContent = 'Confirm completion here when the work is finished. Both participants must confirm before either side can review.';
        elements.confirmProjectCompletion.hidden = false;
        elements.confirmProjectCompletion.disabled = false;
        elements.confirmProjectCompletion.textContent = 'Confirm project completion';
        return;
      }

      const viewerIsClient = currentProfile.account_role === 'client';
      const viewerConfirmed = Boolean(viewerIsClient
        ? engagement.client_completed_at
        : engagement.developer_completed_at);
      const partnerConfirmed = Boolean(viewerIsClient
        ? engagement.developer_completed_at
        : engagement.client_completed_at);
      if (!viewerConfirmed || !partnerConfirmed) {
        elements.engagementStatus.textContent = viewerConfirmed
          ? `You confirmed completion. Waiting for ${conversation.name} to confirm.`
          : partnerConfirmed
            ? `${conversation.name} confirmed completion. Confirm when the work is finished.`
            : 'Both participants must confirm completion before reviews are available.';
        elements.confirmProjectCompletion.hidden = false;
        elements.confirmProjectCompletion.disabled = viewerConfirmed;
        elements.confirmProjectCompletion.textContent = viewerConfirmed
          ? 'Completion confirmed'
          : 'Confirm project completion';
        return;
      }

      elements.engagementStatus.textContent = 'Both participants confirmed completion. Each side can leave one review.';
      const existingReview = await backend.loadMyProjectReview(engagement.id);
      if (conversation.id !== activeConvId) return;
      if (existingReview) {
        elements.projectReviewMessage.textContent = 'Your review for this project has been submitted.';
        elements.projectReviewMessage.hidden = false;
        return;
      }
      elements.projectReviewForm.hidden = false;
    } catch (error) {
      console.error('Unable to load project completion status.', error);
      if (conversation.id !== activeConvId) return;
      elements.engagementStatus.textContent = 'Could not load completion status. Check your connection and try again.';
      elements.confirmProjectCompletion.hidden = false;
      elements.confirmProjectCompletion.disabled = false;
    }
  }

  function scrollThreadToBottom() {
    threadContainerEl?.scrollTo({top: threadContainerEl.scrollHeight, behavior: 'auto'});
  }

  async function markMessagesRead(conversationId) {
    try {
      await invokeChat('mark-messages-read', {conversationId});
    } catch (error) {
      console.warn('Unable to mark chat messages read.', error);
    }
  }

  async function loadMessages(conversationId) {
    const messages = await invokeChat('list-messages', {conversationId, limit: 75, markRead: false});
    if (!Array.isArray(messages)) throw new Error('Chat service returned an invalid message list.');
    const conversation = conversations.find(item => item.id === conversationId);
    if (!conversation) return;
    const knownProjectContexts = new Map(
      conversation.messages
        .filter(message => message.project_context?.available === true)
        .map(message => [message.id, message.project_context])
    );
    conversation.messages = messages.map(message => {
      if (message.project_context?.available === true) return message;
      const projectContext = knownProjectContexts.get(message.id);
      return projectContext ? {...message, project_context: projectContext} : message;
    });
    conversation.lastMessage = conversation.messages[conversation.messages.length - 1] || null;
    if (conversation.lastMessage?.sender_id !== currentUser.id && conversationId !== activeConvId) {
      if (!wasReadAfterLastMessage(conversation)) conversation.unreadCount = 1;
    }
    if (conversationId === activeConvId) {
      markRead(conversation);
      void markMessagesRead(conversationId);
    }
    updateUnreadCounts();
    renderConversationsList();
    if (conversationId === activeConvId) renderMessagesThread();
  }

  async function loadOlderMessages(conversation) {
    if (!conversation || conversation.loadingOlderMessages || conversation.loadedAllMessages) return;
    const oldestMessage = conversation.messages[0];
    if (!oldestMessage?.created_at) return;
    conversation.loadingOlderMessages = true;
    const previousScrollHeight = threadContainerEl?.scrollHeight || 0;
    try {
      const olderMessages = await invokeChat('list-messages', {
        conversationId: conversation.id,
        limit: 75,
        before: oldestMessage.created_at,
        markRead: false
      });
      if (!Array.isArray(olderMessages)) throw new Error('Chat service returned an invalid older message list.');
      if (!olderMessages.length) {
        conversation.loadedAllMessages = true;
        return;
      }
      const existingIds = new Set(conversation.messages.map(message => message.id));
      const uniqueOlderMessages = olderMessages.filter(message => !existingIds.has(message.id));
      if (!uniqueOlderMessages.length) {
        conversation.loadedAllMessages = true;
        return;
      }
      conversation.messages = [...uniqueOlderMessages, ...conversation.messages];
      conversation.lastMessage = conversation.messages[conversation.messages.length - 1] || null;
      if (conversation.id === activeConvId) {
        renderMessagesThread();
        if (threadContainerEl) {
          const heightDifference = threadContainerEl.scrollHeight - previousScrollHeight;
          threadContainerEl.scrollTop = heightDifference;
        }
      }
    } catch (error) {
      console.error('Unable to load older chat messages.', error);
      setStatus(error.message || 'Unable to load older messages.', true);
    } finally {
      conversation.loadingOlderMessages = false;
    }
  }

  let activityTimer;
  async function syncActivity() {
    if (!currentUser || pendingConversationDraft || document.visibilityState !== 'visible') return;
    const conversation=getActiveConversation();
    const last=conversation?.messages?.at(-1);
    const {data,error}=await client.rpc('sync_chat_activity', {
      p_role: conversation?.myRole || currentProfile.account_role,
      p_conversation: conversation?.id || null,
      p_read_at: last?.created_at || null
    });
    if(error){console.warn('Unable to update chat status.',error);return;}
    if(conversation && conversation.id===activeConvId){
      const changed=conversation.online!==data.online || conversation.peerReadAt!==data.read_at;
      conversation.online=data.online;conversation.peerReadAt=data.read_at;
      if(changed)renderMessagesThread();
    }
  }
  document.addEventListener('visibilitychange',()=>{if(currentUser)void syncActivity();});
  async function startRealtime() {
    const {data, error} = await client.auth.getSession();
    if (error) throw error;
    if (!data.session?.access_token) throw new Error('Your session expired. Please log in again.');
    await client.realtime.setAuth(data.session.access_token);
    presenceReady = true;
    syncPresenceChannels();
    realtimeChannel = client.channel(`chat-messages:${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, async payload => {
        const conversationId = payload.new?.conversation_id;
        if (!conversationId) return;
        try {
          await loadConversationList();
          const active = getActiveConversation();
          if (active?.sourceConversationIds?.includes(conversationId)) {
            await loadMessages(active.id);
          }
        } catch (error) {
          console.error('Unable to refresh real-time chat messages.', error);
          setStatus(error.message || 'Unable to refresh messages.', true);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages'
      }, async payload => {
        const conversationId = payload.new?.conversation_id || payload.old?.conversation_id;
        const active = getActiveConversation();
        if (!active?.sourceConversationIds?.includes(conversationId)) return;
        try {
          await loadMessages(active.id);
        } catch (error) {
          console.error('Unable to refresh chat read receipts.', error);
          setStatus(error.message || 'Unable to refresh read receipts.', true);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'project_proposals'
      }, async payload => {
        const conversationId = payload.new?.conversation_id;
        const active = getActiveConversation();
        if (!conversationId || !active?.sourceConversationIds?.includes(conversationId)) return;
        try {
          await loadMessages(active.id);
        } catch (error) {
          console.error('Unable to refresh a project proposal.', error);
          setStatus(error.message || 'Unable to refresh the proposal.', true);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_engagements'
      }, payload => {
        const conversationId = payload.new?.conversation_id || payload.old?.conversation_id;
        const active = getActiveConversation();
        if (active?.sourceConversationIds?.includes(conversationId)) void refreshProjectEngagement();
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setStatus('Connected securely · messages encrypted at rest.');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setStatus('Real-time connection interrupted. Messages may be delayed.', true);
        }
      });
  }

  async function selectConversation(id, {focusReview = false, initialMessages = null} = {}) {
    const conversation = conversations.find(item => item.id === id);
    if (!conversation) return;
    const openingFromUrl = new URLSearchParams(location.search).get('conversation');
    const shouldAnimateRoom = !openingFromUrl || openingFromUrl !== id;
    if (Array.isArray(initialMessages)) {
      conversation.messages = initialMessages;
      conversation.lastMessage = initialMessages[initialMessages.length - 1] || conversation.lastMessage;
    }
    pendingConversationDraft = null;
    activeConvId = id;
    updateConversationQuery(id, focusReview);
    markRead(conversation);
    if (chatViewportEl) chatViewportEl.classList.add('viewing-thread');
    if (shouldAnimateRoom) {
      syncMobileChatRoomNavbar(true);
    } else {
      syncMobileChatRoomNavbar(true);
      document.body.classList.add('mobile-chat-room-open');
      document.querySelector('.chat-main-pane')?.style.setProperty('animation', 'none');
    }
    setDetailPaneOpen(false);
    updateUnreadCounts();
    renderConversationsList();
    renderMessagesThread();
    void refreshProjectEngagement(conversation).then(() => {
      if (
        !focusReview
        || id !== activeConvId
        || !elements.projectReviewForm
        || !elements.engagementStatus
      ) return;
      const reviewAvailable = !elements.projectReviewForm.hidden;
      const focusTarget = reviewAvailable ? elements.projectReviewForm : elements.engagementStatus;
      focusTarget.scrollIntoView({behavior: 'smooth', block: 'center'});
      if (reviewAvailable) elements.projectReviewRating.focus({preventScroll: true});
    });
    setStatus('Loading encrypted messages…');
    if (mobileChatBreakpoint.matches) messageInputEl?.blur();
    else messageInputEl?.focus();
    try {
      if (Array.isArray(initialMessages)) {
        renderMessagesThread();
        scrollThreadToBottom();
        void markMessagesRead(id);
      } else {
        await loadMessages(id);
      }
      if (!realtimeChannel) await startRealtime();
      setStatus('Connected securely · messages encrypted at rest.');
    } catch (error) {
      console.error('Unable to open chat conversation.', error);
      setStatus(error.message || 'Unable to load this conversation.', true);
    }
  }

  async function sendMessage(text) {
    let conversation = getActiveConversation();
    if (!conversation || isSending) return;
    const plainText = String(text || '').trim();
    if (!plainText && !selectedAttachment) return;
    const isDraft = conversation === pendingConversationDraft;
    const draftProject = conversation.sourceProject;
    const messageProjectId = conversation.messageProjectId
      || (isDraft && conversation.project ? conversation.projectId : null);
    const projectForMessage = draftProject
      ? mapProject(draftProject)
      : conversation.project;
    const optimisticId = plainText ? `temp-${crypto.randomUUID?.() || Date.now()}` : null;
    let optimisticConversation = conversation;
    let previousLastMessage = conversation.lastMessage;
    let optimisticMessage = null;
    if (optimisticId) {
      optimisticMessage = {
        id: optimisticId,
        conversation_id: conversation.id,
        sender_id: currentUser.id,
        text: plainText,
        attachments: [],
        created_at: new Date().toISOString(),
        read_at: null,
        ...(messageProjectId ? {
          project_context: projectForMessage?.available
            ? {
                id: projectForMessage.id,
                project_kind: projectForMessage.project_kind,
                title: projectForMessage.title,
                price: projectForMessage.price,
                cover_image: projectForMessage.coverImage || null,
                client_name: projectForMessage.clientName || null,
                available: true
              }
            : undefined
        } : {})
      };
      conversation.messages.push(optimisticMessage);
      conversation.lastMessage = optimisticMessage;
      renderConversationsList();
      renderMessagesThread();
      scrollThreadToBottom();
      setStatus('Sending…');
    }
    isSending = true;
    if (sendBtnEl) sendBtnEl.disabled = true;
    if (attachButtonEl) attachButtonEl.disabled = true;
    if (!optimisticId) setStatus('Encrypting and sending…');
    try {
      if (isDraft) {
        const row = conversation.projectId
          ? await invokeChat('start-project', {projectId: conversation.projectId})
          : await invokeChat('start-user', {participantId: conversation.participantId});
        if (!row || typeof row.id !== 'string' || !row.id) {
          throw new Error('Chat service returned an invalid conversation.');
        }
        const contact = {
          id: conversation.participantId,
          account_role: conversation.roleType,
          username: conversation.contactUsername,
          display_name: conversation.contactDisplayName
        };
        conversation = conversations.find(item =>
          item.id === row.id || item.sourceConversationIds.includes(row.id)
        )
          || mapConversation(
            {...row, project_id: conversation.projectId || row.project_id, contact, source_conversations: [{id: row.id, my_role: row.participant_a_id === currentUser.id
              ? row.participant_a_role
              : row.participant_b_role}]},
            new Map([[conversation.projectId, conversation.sourceProject]])
          );
        if (!conversations.some(item => item.id === conversation.id)) {
          conversations.unshift(conversation);
        }
        if (messageProjectId) {
          conversation.messageProjectId = messageProjectId;
          conversation.project = draftProject
              ? mapProject(draftProject)
              : conversation.project;
        }
        if (optimisticMessage && optimisticConversation !== conversation) {
          optimisticConversation.messages = optimisticConversation.messages.filter(
            item => item.id !== optimisticId
          );
          optimisticConversation.lastMessage = null;
          if (!conversation.messages.some(item => item.id === optimisticId)) {
            previousLastMessage = conversation.lastMessage;
            optimisticMessage.conversation_id = conversation.id;
            conversation.messages.push(optimisticMessage);
            conversation.lastMessage = optimisticMessage;
          }
          optimisticConversation = conversation;
        }
        pendingConversationDraft = null;
        activeConvId = conversation.id;
        updateConversationQuery(conversation.id);
        renderConversationsList();
        renderMessagesThread();
      }
      const attachment = selectedAttachment
        ? {
            name: selectedAttachment.name,
            type: selectedAttachment.type,
            base64: await fileAsBase64(selectedAttachment)
          }
        : undefined;
      const message = await invokeChat('send-message', {
        conversationId: conversation.id,
        text: plainText,
        ...(messageProjectId ? {projectId: messageProjectId} : {}),
        ...(attachment ? {attachment} : {})
      });
      if (!message || typeof message.text !== 'string' || !Array.isArray(message.attachments)) {
        throw new Error('Chat service returned an invalid message.');
      }
      if (
        messageProjectId
        && projectForMessage?.available
        && projectForMessage.id === messageProjectId
        && (message.project_context?.available !== true
          || message.project_context.id !== messageProjectId)
      ) {
        message.project_context = {
          id: projectForMessage.id,
          project_kind: projectForMessage.project_kind,
          title: projectForMessage.title,
          price: projectForMessage.price,
          cover_image: projectForMessage.coverImage || null,
          client_name: projectForMessage.clientName || null,
          available: true
        };
      }
      if (optimisticId) {
        const optimisticIndex = conversation.messages.findIndex(item => item.id === optimisticId);
        if (optimisticIndex >= 0) conversation.messages.splice(optimisticIndex, 1, message);
        else if (!conversation.messages.some(item => item.id === message.id)) conversation.messages.push(message);
      } else if (!conversation.messages.some(item => item.id === message.id)) {
        conversation.messages.push(message);
      }
      conversation.lastMessage = message;
      if (isDraft) {
        if (!conversations.some(item => item.id === conversation.id)) conversations.unshift(conversation);
        pendingConversationDraft = null;
        activeConvId = conversation.id;
        updateConversationQuery(conversation.id);
      }
      conversation.messageProjectId = null;
      renderConversationsList();
      renderMessagesThread();
      setStatus('Message sent securely.');
      return true;
    } catch (error) {
      console.error('Unable to send chat message.', error);
      if (optimisticId) {
        optimisticConversation.messages = optimisticConversation.messages.filter(item => item.id !== optimisticId);
        optimisticConversation.lastMessage = previousLastMessage;
        renderConversationsList();
        renderMessagesThread();
      }
      setStatus(`${error.message || 'Unable to send this message.'} You can try again.`, true);
      return false;
    } finally {
      isSending = false;
      if (sendBtnEl) sendBtnEl.disabled = false;
      if (attachButtonEl) attachButtonEl.disabled = false;
    }
  }

  function formatFileSize(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return '';
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fileAsBase64(file) {
    return file.arrayBuffer().then(buffer => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }
      return btoa(binary);
    });
  }

  function renderAttachmentPreview() {
    if (!attachmentPreviewEl) return;
    attachmentPreviewEl.replaceChildren();
    attachmentPreviewEl.hidden = !selectedAttachment;
    if (!selectedAttachment) return;
    const name = document.createElement('span');
    name.textContent = `${selectedAttachment.name} · ${formatFileSize(selectedAttachment.size)}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      selectedAttachment = null;
      if (attachmentInputEl) attachmentInputEl.value = '';
      renderAttachmentPreview();
    });
    attachmentPreviewEl.append(name, remove);
  }

  function decodeBase64(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  async function downloadAttachment(button) {
    button.disabled = true;
    try {
      const result = await invokeChat('download-attachment', {
        conversationId: button.dataset.conversationId,
        messageId: button.dataset.messageId,
        attachmentId: button.dataset.attachmentId
      });
      if (!result || typeof result.base64 !== 'string' || typeof result.name !== 'string') {
        throw new Error('Chat service returned an invalid attachment.');
      }
      const url = URL.createObjectURL(new Blob([decodeBase64(result.base64)], {
        type: result.type || 'application/octet-stream'
      }));
      const link = document.createElement('a');
      link.href = url;
      link.download = result.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Unable to download chat attachment.', error);
      setStatus(error.message || 'Unable to download this attachment.', true);
    } finally {
      button.disabled = false;
    }
  }

  async function lookupContact(contact, fallbackId) {
    if (UUID_PATTERN.test(contact || '')) {
      const result = await client.from('directory_people')
        .select('id,display_name,username,account_role')
        .eq('account_role', currentProfile.account_role === 'client' ? 'dev' : 'client')
        .eq('id', contact)
        .maybeSingle();
      if (result.error) throw result.error;
      if (result.data) return result.data;
    }
    if (contact) {
      const result = await client.from('directory_people')
        .select('id,display_name,username,account_role')
        .eq('account_role', currentProfile.account_role === 'client' ? 'dev' : 'client')
        .eq('username', contact.replace(/^@/, ''))
        .maybeSingle();
      if (result.error) throw result.error;
      if (result.data) return result.data;
    }
    if (UUID_PATTERN.test(fallbackId || '')) {
      const result = await client.from('directory_people')
        .select('id,display_name,username,account_role')
        .eq('account_role', currentProfile.account_role === 'client' ? 'dev' : 'client')
        .eq('id', fallbackId)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    }
    return null;
  }

  function makeConversationDraft(recipient, project = null) {
    const role = recipient.account_role;
    return {
      id: null,
      projectId: project?.id || null,
      sourceProject: project,
      participantId: recipient.id,
      contactUsername: recipient.username || '',
      contactDisplayName: recipient.display_name || '',
      name: recipient.username || recipient.display_name || 'Unavailable account',
      initials: initials(recipient.username || recipient.display_name),
      role: role === 'dev' ? 'Developer' : 'Client',
      roleType: role,
      color: role === 'client' ? 'coral' : 'blue',
      myRole: currentProfile.account_role,
      sourceConversationIds: [],
      online: false,
      peerReadAt: null,
      statusText: 'Encrypted chat',
      project: mapProject(project),
      files: [],
      messages: [],
      lastMessage: null,
      unreadCount: 0,
      quickReplies: []
    };
  }

  function replaceDraftProject(draft, project) {
    draft.projectId = project.id;
    const projectWithContact = project.project_kind === 'request'
      ? {...project, client_name: draft.contactDisplayName || draft.name}
      : project;
    draft.sourceProject = projectWithContact;
    draft.project = mapProject(projectWithContact);
    draft.messageProjectId = null;
  }

  function activateConversationDraft(draft, status = 'Write a message to start this conversation.') {
    pendingConversationDraft = draft;
    activeConvId = null;
    chatViewportEl?.classList.add('viewing-thread');
    syncMobileChatRoomNavbar(true);
    setDetailPaneOpen(false);
    renderConversationsList();
    renderMessagesThread();
    setStatus(status, status !== 'Write a message to start this conversation.');
    if (mobileChatBreakpoint.matches) messageInputEl?.blur();
    else messageInputEl?.focus();
  }

  async function openExistingOrDraft(row, recipient, project = null) {
    let messages;
    try {
      messages = await invokeChat('list-messages', {conversationId: row.id, limit: 75, markRead: false});
    } catch (error) {
      console.error('Unable to load the existing conversation.', error);
      activateConversationDraft(
        makeConversationDraft(recipient, project),
        `${error.message || 'Unable to load existing chat.'} You can still send a message.`
      );
      return;
    }
    if (messages.length) {
      let existing = conversations.find(item =>
        item.id === row.id || item.sourceConversationIds.includes(row.id)
      );
      if (!existing) {
        existing = mapConversation(
          {...row, contact: recipient, project_id: project?.id || row.project_id},
          new Map(project ? [[project.id, project]] : [])
        );
        conversations.unshift(existing);
      }
      if (project) {
        existing.messageProjectId = project.id;
        existing.project = mapProject({
          ...project,
          client_name: project.project_kind === 'request'
            ? recipient.display_name || recipient.username || existing.contactDisplayName || existing.name
            : ''
        });
      }
      await selectConversation(existing.id, {initialMessages: messages});
      return;
    }
    activateConversationDraft(makeConversationDraft(recipient, project));
  }

  async function openFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project') || params.get('request');
    if (projectId) {
      const {data:project, error} = await client.from('projects')
        .select('id,owner_id,title,project_kind,project_type,category,price,cover_image,status,data')
        .eq('id', projectId)
        .in('status', ['published', 'open'])
        .maybeSingle();
      if (error) throw error;
      if (!project) throw new Error('This project is not available for a new conversation.');

      const senderRole = project.project_kind === 'portfolio' ? 'client' : 'dev';
      const recipientRole = project.project_kind === 'portfolio' ? 'dev' : 'client';
      if (currentProfile.account_role !== senderRole) {
        throw new Error('Switch to the correct workspace to contact this project owner.');
      }
      if (project.owner_id === currentUser.id) {
        throw new Error('You cannot start a conversation about your own project.');
      }

      if (pendingConversationDraft?.participantId === project.owner_id) {
        replaceDraftProject(pendingConversationDraft, project);
        activateConversationDraft(pendingConversationDraft);
        return;
      }

      const existing = conversations.find(conversation =>
        conversation.participantId === project.owner_id && conversation.projectId === project.id
      );
      if (existing) {
        existing.messageProjectId = project.id;
        existing.project = mapProject({
          ...project,
          client_name: project.project_kind === 'request'
            ? existing.contactDisplayName || existing.name
            : ''
        });
        await selectConversation(existing.id);
        return;
      }

      const recipient = await lookupContact(project.owner_id);
      if (!recipient || recipient.account_role !== recipientRole) {
        throw new Error('This project owner is not available for chat.');
      }
      if (project.project_kind === 'request') {
        project.client_name = recipient.display_name || recipient.username || '';
      }
      const draft = makeConversationDraft(recipient, project);
      activateConversationDraft(draft);
      void (async () => {
        try {
          let existingRow;
          try {
            existingRow = await invokeChat('open-project-chat', {projectId: project.id});
          } catch (openError) {
            console.warn('Open-project chat endpoint unavailable; using legacy lookup.', openError);
            existingRow = await invokeChat('find-project', {projectId: project.id});
          }
          if (existingRow && getActiveConversation() === draft) {
            await openExistingOrDraft(existingRow, recipient, project);
          }
        } catch (error) {
          console.error('Unable to check for an existing project conversation.', error);
          if (getActiveConversation() === draft) {
            setStatus(`${error.message || 'Unable to check existing chat.'} You can still send a message.`, true);
          }
        }
      })();
      return;
    }
    const contact = params.get('contact');
    const participantId = params.get('client');
    if (contact || participantId) {
      const recipient = await lookupContact(contact, participantId);
      if (!recipient) throw new Error('This contact is not available in the public directory.');
      const draft = makeConversationDraft(recipient);
      let existingRow;
      try {
        existingRow = await invokeChat('find-user', {participantId: recipient.id});
      } catch (error) {
        console.error('Unable to check for an existing direct conversation.', error);
        activateConversationDraft(draft, `${error.message || 'Unable to check existing chat.'} You can still send a message.`);
        return;
      }
      if (existingRow) await openExistingOrDraft(existingRow, recipient);
      else activateConversationDraft(draft);
      return;
    }
    const requestedConversation = params.get('conversation');
    const requestedThread = conversations.find(item =>
      item.id === requestedConversation || item.sourceConversationIds.includes(requestedConversation)
    );
    if (requestedThread) {
      await selectConversation(requestedThread.id, {focusReview: params.get('review') === '1'});
      syncMobileChatRoomNavbar(true);
    }
  }

  function ensureProjectDetailsLoaded() {
    if (projectDetailsPromise) return projectDetailsPromise;
    projectDetailsPromise = new Promise((resolve, reject) => {
      if (typeof window.openProjectDetails === 'function') {
        resolve();
        return;
      }
      if (!document.querySelector('link[data-project-detail-styles]')) {
        const styles = document.createElement('link');
        styles.rel = 'stylesheet';
        styles.href = 'assets/css/project-detail.css?v=20261122-hide-replies-bottom-v1';
        styles.dataset.projectDetailStyles = 'true';
        document.head.append(styles);
      }
      const script = document.createElement('script');
      script.src = 'assets/js/project-detail.js?v=20261122-view-reply-line-v1';
      script.addEventListener('load', () => {
        if (typeof window.openProjectDetails === 'function') resolve();
        else reject(new Error('Project detail helper did not load.'));
      });
      script.addEventListener('error', () => reject(new Error('Project detail assets could not be loaded.')));
      document.body.append(script);
    });
    return projectDetailsPromise;
  }

  function updateShell(profile) {
    const isClient = profile.account_role === 'client';
    const role = isClient ? 'client' : 'dev';
    const name = profile.username?.trim() || profile.display_name?.trim() || currentUser.email || 'Account';
    const avatar = document.getElementById('userAvatar');
    const topName = document.getElementById('topUserName');
    if (avatar) avatar.textContent = initials(name);
    if (topName) topName.textContent = name;
    const roleLabel = document.querySelector('.user-menu .user-copy small');
    if (roleLabel) roleLabel.textContent = isClient ? 'Client' : 'Developer';
    document.body.classList.toggle('client-shell-page', isClient);
    window.DEVMATCH_SIDEBAR_NAVIGATION?.setWorkspace(role);
    const userMenu = document.querySelector('.user-menu');
    if (userMenu) userMenu.href = `devmatch-my-profile.html?role=${role}`;

    const devLink = document.getElementById('devModeLink');
    const clientLink = document.getElementById('clientModeLink');
    devLink?.classList.toggle('active', !isClient);
    clientLink?.classList.toggle('active', isClient);

    if (isClient) {
      const brand = document.querySelector('.brand');
      if (brand) brand.href = 'devmatch-client-dashboard.html';
      if (devLink) devLink.href = 'devmatch-dashboard.html';
      if (clientLink) clientLink.href = 'devmatch-client-dashboard.html';
      const workspace = document.getElementById('workspaceBadge');
      if (workspace) {
        workspace.innerHTML = '<span class="workspace-icon"><svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span><span><b>Client workspace</b><small>Discover &amp; hire</small></span>';
      }
      const sideAdd = document.querySelector('.side-add');
      if (sideAdd) {
        sideAdd.href = 'devmatch-client-dashboard.html#requests';
        let actionLabel = sideAdd.querySelector('.sidebar-action-label');
        if (!actionLabel) {
          actionLabel = Array.from(sideAdd.children).find(child => child.tagName === 'SPAN');
          if (actionLabel) actionLabel.classList.add('sidebar-action-label');
        }
        if (!actionLabel) {
          Array.from(sideAdd.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .forEach(node => node.remove());
          actionLabel = document.createElement('span');
          actionLabel.className = 'sidebar-action-label';
          sideAdd.append(actionLabel);
        }
        actionLabel.textContent = 'Post a Request';
        sideAdd.classList.add('post-request');
      }
      const topNotifications = document.querySelector('.notification-button');
      if (topNotifications) topNotifications.href = 'devmatch-notifications.html';
    }
    window.DEVMATCH_NAV_BADGES?.updateNotifications();
  }

  function bindControls() {
    window.addEventListener('devmatch:progress-review-updated', () => renderMessagesThread());
    filterBtns.forEach(button => {
      button.addEventListener('click', () => {
        filterBtns.forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        currentFilter = button.dataset.filter || 'all';
        renderConversationsList();
      });
    });
    searchInputEl?.addEventListener('input', () => {
      searchQuery = searchInputEl.value.trim();
      renderConversationsList();
    });
    threadContainerEl?.addEventListener('scroll', () => {
      const scrollBottomBtn = document.getElementById('chatScrollBottomBtn');
      if (scrollBottomBtn) {
        const distanceFromBottom = threadContainerEl.scrollHeight
          - threadContainerEl.clientHeight
          - threadContainerEl.scrollTop;
        scrollBottomBtn.hidden = distanceFromBottom < 120;
      }
      if (isLocalProposalCardPreview()) return;
      if (threadContainerEl.scrollTop > 80) return;
      const conversation = getActiveConversation();
      if (conversation && conversation !== pendingConversationDraft) {
        void loadOlderMessages(conversation);
      }
    });
    document.getElementById('chatScrollBottomBtn')?.addEventListener('click', () => {
      threadContainerEl?.scrollTo({
        top: threadContainerEl.scrollHeight,
        behavior: 'smooth'
      });
    });
    chatFormEl?.addEventListener('submit', event => {
      event.preventDefault();
      const value = messageInputEl?.value || '';
      if (!value.trim() && !selectedAttachment) return;
      void sendMessage(value).then(sent => {
        if (sent) {
          messageInputEl.value = '';
          messageInputEl.style.height = 'auto';
          selectedAttachment = null;
          if (attachmentInputEl) attachmentInputEl.value = '';
          renderAttachmentPreview();
        }
      });
    });
    attachButtonEl?.addEventListener('click', () => {
      setComposerMenuOpen(composerMenuEl?.hidden === true);
    });
    uploadFileButtonEl?.addEventListener('click', () => {
      setComposerMenuOpen(false);
      attachmentInputEl?.click();
    });
    projectTermsButtonEl?.addEventListener('click', () => {
      setComposerMenuOpen(false);
      openProposalForm();
    });
    proposalFormEl?.addEventListener('submit', event => void submitProjectProposal(event));
    const progressVideoInput = document.getElementById('proposalProgressVideo');
    const progressVideoPreview = document.getElementById('proposalProgressVideoPreview');
    const progressScreenshotInput = document.getElementById('proposalProgressScreenshots');
    const progressScreenshotList = document.getElementById('proposalProgressScreenshotList');
    const progressVideoStatus = document.getElementById('proposalProgressVideoStatus');
    const progressNotes = document.getElementById('proposalProgressNotes');
    const progressNotesCount = document.getElementById('proposalProgressNotesCount');
    progressFormEl?.addEventListener('submit', event => void submitProposalProgress(event));
    progressVideoInput?.addEventListener('change', () => {
      clearProgressVideoPreview();
      setProgressStatus();
      if (progressVideoStatus) progressVideoStatus.textContent = '';
      const file = progressVideoInput.files?.[0];
      if (!file) return;
      try {
        validateProgressVideo(file);
        const url = URL.createObjectURL(file);
        progressVideoObjectUrl = url;
        progressVideoPreview.hidden = false;
        if (progressVideoStatus) progressVideoStatus.textContent = 'Checking video duration…';
        progressVideoPreview.onloadedmetadata = () => {
          if (progressVideoObjectUrl !== url) return;
          const duration = Number(progressVideoPreview.duration);
          if (!Number.isFinite(duration) || duration <= 0 || duration > 300) {
            progressVideoDurationSeconds = null;
            if (progressVideoStatus) progressVideoStatus.textContent = 'Video duration must be 5 minutes or less.';
            return;
          }
          progressVideoDurationSeconds = duration;
          if (progressVideoStatus) {
            const totalSeconds = Math.ceil(duration);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = (totalSeconds % 60).toString().padStart(2, '0');
            progressVideoStatus.textContent = `Video duration: ${minutes}:${seconds}`;
          }
        };
        progressVideoPreview.onerror = () => {
          if (progressVideoObjectUrl !== url) return;
          progressVideoDurationSeconds = null;
          if (progressVideoStatus) progressVideoStatus.textContent = 'The selected video could not be read.';
        };
        progressVideoPreview.src = url;
        progressVideoPreview.load();
      } catch (error) {
        progressVideoInput.value = '';
        setProgressStatus(error.message);
      }
    });
    progressScreenshotInput?.addEventListener('change', () => {
      progressScreenshotList?.replaceChildren();
      setProgressStatus();
      const files = Array.from(progressScreenshotInput.files || []);
      try {
        validateProgressScreenshots(files);
        files.forEach(file => {
          const item = document.createElement('li');
          item.textContent = `${file.name} · ${formatFileSize(file.size)}`;
          progressScreenshotList?.append(item);
        });
      } catch (error) {
        progressScreenshotInput.value = '';
        setProgressStatus(error.message);
      }
    });
    progressNotes?.addEventListener('input', () => {
      if (progressNotesCount) progressNotesCount.textContent = String(progressNotes.value.length);
    });
    progressDialogEl?.querySelectorAll('[data-progress-close]').forEach(button => {
      button.addEventListener('click', () => progressDialogEl.close());
    });
    progressDialogEl?.addEventListener('click', event => {
      if (event.target === progressDialogEl &&
          !progressFormEl?.querySelector('[type="submit"]')?.disabled) progressDialogEl.close();
    });
    progressDialogEl?.addEventListener('cancel', event => {
      if (progressFormEl?.querySelector('[type="submit"]')?.disabled) event.preventDefault();
    });
    progressDialogEl?.addEventListener('close', () => {
      clearProgressVideoPreview();
      progressProposal = null;
      setProgressStatus();
    });
    proposalDialogEl?.querySelectorAll('[data-close-propose-project]').forEach(button => {
      button.addEventListener('click', () => proposalDialogEl.close());
    });
    proposalDialogEl?.addEventListener('click', event => {
      if (event.target === proposalDialogEl) proposalDialogEl.close();
    });
    const proposalDetailsDialog = document.getElementById('projectProposalDetailsDialog');
    const proposalAcceptConfirmationDialog = document.getElementById('projectProposalAcceptConfirmation');
    proposalAcceptConfirmationDialog?.addEventListener('cancel', event => {
      event.preventDefault();
      hideProposalAcceptConfirmation();
    });
    proposalAcceptConfirmationDialog?.addEventListener('click', event => {
      if (event.target === proposalAcceptConfirmationDialog) {
        const panel = proposalAcceptConfirmationDialog.querySelector('section');
        const rect = panel?.getBoundingClientRect();
        if (rect && (event.clientX < rect.left || event.clientX > rect.right
          || event.clientY < rect.top || event.clientY > rect.bottom)) {
          hideProposalAcceptConfirmation();
        }
        return;
      }
      const cancelButton = event.target.closest('[data-proposal-accept-cancel], [data-proposal-accept-close]');
      if (cancelButton && proposalAcceptConfirmationDialog.contains(cancelButton)) {
        hideProposalAcceptConfirmation();
        return;
      }
      const confirmButton = event.target.closest('[data-proposal-accept-confirm]');
      if (!confirmButton || !proposalAcceptConfirmationDialog.contains(confirmButton)) return;
      const proposalId = confirmButton.dataset.proposalId;
      const confirmationStatus = document.getElementById('projectProposalAcceptStatus');
      const cancelButtons = proposalAcceptConfirmationDialog.querySelectorAll(
        '[data-proposal-accept-cancel], [data-proposal-accept-close]'
      );
      cancelButtons.forEach(button => { button.disabled = true; });
      void changeProjectProposal('accept-project-proposal', proposalId, confirmButton)
        .then(updated => {
          if (updated) {
            hideProposalAcceptConfirmation(false);
            proposalDetailsDialog?.close();
            return;
          }
          cancelButtons.forEach(button => { button.disabled = false; });
          if (confirmationStatus) {
            confirmationStatus.textContent = statusEl?.textContent || 'Unable to accept this proposal. Please try again.';
            confirmationStatus.hidden = false;
          }
        });
    });
    proposalDetailsDialog?.querySelectorAll('[data-close-proposal-details]').forEach(button => {
      button.addEventListener('click', () => proposalDetailsDialog.close());
    });
    proposalDetailsDialog?.addEventListener('click', event => {
      if (event.target === proposalDetailsDialog) proposalDetailsDialog.close();
    });
    proposalDetailsDialog?.addEventListener('click', event => {
      const cancelButton = event.target.closest('[data-proposal-withdraw-cancel]');
      if (cancelButton && proposalDetailsDialog.contains(cancelButton)) {
        hideProposalWithdrawConfirmation();
        return;
      }
      const confirmButton = event.target.closest('[data-proposal-withdraw-confirm]');
      if (!confirmButton || !proposalDetailsDialog.contains(confirmButton)) return;
      const proposalId = confirmButton.dataset.proposalId;
      const confirmationStatus = document.getElementById('projectProposalWithdrawStatus');
      const keepButton = proposalDetailsDialog.querySelector('[data-proposal-withdraw-cancel]');
      if (keepButton) keepButton.disabled = true;
      void changeProjectProposal('withdraw-project-proposal', proposalId, confirmButton)
        .then(updated => {
          if (updated) {
            proposalDetailsDialog.close();
            hideProposalWithdrawConfirmation(false);
            return;
          }
          if (keepButton) keepButton.disabled = false;
          if (confirmationStatus) {
            confirmationStatus.textContent = statusEl?.textContent || 'Unable to withdraw this proposal. Please try again.';
            confirmationStatus.hidden = false;
            confirmationStatus.classList.add('is-error');
          }
        });
    });
    proposalDetailsDialog?.addEventListener('click', event => {
      const actionButton = event.target.closest('[data-proposal-details-action]');
      if (!actionButton || !proposalDetailsDialog.contains(actionButton)) return;
      const proposalId = actionButton.dataset.proposalId;
      const action = actionButton.dataset.proposalDetailsAction;
      if (action === 'ask-changes') {
        proposalDetailsDialog.close();
        askForProposalChanges(proposalId);
      } else if (action === 'accept') {
        showProposalAcceptConfirmation(proposalId);
      } else if (action === 'withdraw') {
        showProposalWithdrawConfirmation(proposalId);
      } else if (action === 'payments') {
        const proposal = getActiveConversation()?.messages
          .find(message => message.proposal?.id === proposalId)?.proposal;
        if (proposal?.agreement?.id) {
          proposalDetailsDialog.close();
          window.DEVMATCH_ROOM_PAYMENT?.openAgreement({
            id: proposal.agreement.id,
            conversationId: proposal.conversation_id,
            proposalId: proposal.id,
            title: proposal.terms?.projectName
          });
        }
      }
    });
    proposalDetailsDialog?.addEventListener('click', event => {
      const attachmentButton = event.target.closest('[data-proposal-download]');
      if (!attachmentButton || !proposalDetailsDialog.contains(attachmentButton)) return;
      void downloadProposalAttachment(
        attachmentButton.dataset.proposalId,
        attachmentButton.dataset.proposalDownload,
        attachmentButton
      );
    });
    document.querySelectorAll('[data-proposal-dp]').forEach(button => {
      button.addEventListener('click', () => {
        proposalDownPayment = Number(button.dataset.proposalDp);
        document.querySelectorAll('[data-proposal-dp]').forEach(option => {
          const selected = option === button;
          option.classList.toggle('is-selected', selected);
          option.setAttribute('aria-pressed', String(selected));
        });
        updateProposalCalculations();
      });
    });
    document.getElementById('proposeProjectPrice')?.addEventListener('input', updateProposalCalculations);
    document.getElementById('proposeProjectPrice')?.addEventListener('blur', event => {
      const amount = proposalAmount(event.currentTarget.value);
      event.currentTarget.value = amount ? formatProposalAmount(amount) : '';
      updateProposalCalculations();
    });
    ['proposeProjectName', 'proposeProjectDescription', 'proposeProjectRevisionNotes'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateProposalCounters);
    });
    document.getElementById('addProposalScopePoint')?.addEventListener('click', () => {
      if (proposalScopeItems.length >= 20) return;
      proposalScopeItems.push('');
      renderProposalScopeItems();
      proposalScopeListEl?.lastElementChild?.querySelector('input')?.focus();
    });
    document.getElementById('decreaseProposalRevisions')?.addEventListener('click', () => {
      proposalRevisionCount = Math.max(0, proposalRevisionCount - 1);
      document.getElementById('proposeProjectRevisionCount').textContent = String(proposalRevisionCount);
    });
    document.getElementById('increaseProposalRevisions')?.addEventListener('click', () => {
      proposalRevisionCount = Math.min(99, proposalRevisionCount + 1);
      document.getElementById('proposeProjectRevisionCount').textContent = String(proposalRevisionCount);
    });
    document.getElementById('proposeProjectAttachments')?.addEventListener('change', renderProposalAttachments);
    document.addEventListener('click', event => {
      if (!composerMenuEl || composerMenuEl.hidden || !(event.target instanceof Node)) return;
      if (composerMenuEl.contains(event.target) || attachButtonEl?.contains(event.target)) return;
      setComposerMenuOpen(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || composerMenuEl?.hidden) return;
      setComposerMenuOpen(false);
      attachButtonEl?.focus();
    });
    attachmentInputEl?.addEventListener('change', () => {
      const file = attachmentInputEl.files?.[0];
      if (!file) return;
      if (![
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/zip',
        'application/x-zip-compressed'
      ].includes(file.type) || file.size < 1 || file.size > 2 * 1024 * 1024) {
        setStatus('Choose a PDF, DOC, DOCX, JPG, PNG, WebP, or ZIP file up to 2 MB.', true);
        attachmentInputEl.value = '';
        return;
      }
      selectedAttachment = file;
      renderAttachmentPreview();
      setStatus('Attachment ready. Files are encrypted before storage.');
    });
    chatMessagesEl?.addEventListener('click', event => {
      const viewProposalButton = event.target.closest('[data-proposal-view]');
      if (viewProposalButton && chatMessagesEl.contains(viewProposalButton)) {
        event.preventDefault();
        const proposal = getActiveConversation()?.messages
          .find(message => message.proposal?.id === viewProposalButton.dataset.proposalView)?.proposal;
        if (proposal) openProposalDetails(proposal);
        return;
      }
      const progressButton = event.target.closest('[data-proposal-progress]');
      if (progressButton && chatMessagesEl.contains(progressButton)) {
        event.preventDefault();
        const proposal = getActiveConversation()?.messages
          .find(message => message.proposal?.id === progressButton.dataset.proposalProgress)?.proposal;
        if (proposal) openProposalProgress(proposal);
        return;
      }
      const progressReviewButton = event.target.closest('[data-proposal-review-progress]');
      if (progressReviewButton && chatMessagesEl.contains(progressReviewButton)) {
        event.preventDefault();
        const proposal = getActiveConversation()?.messages
          .find(message => message.proposal?.id === progressReviewButton.dataset.proposalReviewProgress)?.proposal;
        if (proposal?.agreement?.id) {
          window.DEVMATCH_ROOM_PAYMENT?.openProgressReview({
            id: proposal.agreement.id,
            conversationId: proposal.conversation_id,
            proposalId: proposal.id,
            title: proposal.terms?.projectName,
            developerName: getActiveConversation()?.contactDisplayName || getActiveConversation()?.name
          }, proposal);
        }
        return;
      }
      const proposalPaymentsButton = event.target.closest('[data-proposal-payments]');
      if (proposalPaymentsButton && chatMessagesEl.contains(proposalPaymentsButton)) {
        event.preventDefault();
        event.stopPropagation();
        const proposal = getActiveConversation()?.messages
          .find(message => message.proposal?.id === proposalPaymentsButton.dataset.proposalPayments)?.proposal;
        if (proposal?.agreement?.id) {
          window.DEVMATCH_ROOM_PAYMENT?.openAgreement({
            id: proposal.agreement.id,
            conversationId: proposal.conversation_id,
            proposalId: proposal.id,
            title: proposal.terms?.projectName
          }, {
            action: proposalPaymentsButton.dataset.proposalPaymentAction || null
          });
        }
        return;
      }
      const acceptProposalButton = event.target.closest('[data-proposal-accept]');
      if (acceptProposalButton && chatMessagesEl.contains(acceptProposalButton)) {
        event.preventDefault();
        const proposal = getActiveConversation()?.messages
          .find(message => message.proposal?.id === acceptProposalButton.dataset.proposalAccept)?.proposal;
        if (proposal) {
          openProposalDetails(proposal);
          showProposalAcceptConfirmation(proposal.id);
        }
        return;
      }
      const withdrawProposalButton = event.target.closest('[data-proposal-withdraw]');
      if (withdrawProposalButton && chatMessagesEl.contains(withdrawProposalButton)) {
        event.preventDefault();
        const proposal = getActiveConversation()?.messages
          .find(message => message.proposal?.id === withdrawProposalButton.dataset.proposalWithdraw)?.proposal;
        if (proposal) {
          openProposalDetails(proposal);
          showProposalWithdrawConfirmation(proposal.id);
        }
        return;
      }
      const askChangesButton = event.target.closest('[data-proposal-ask-changes]');
      if (askChangesButton && chatMessagesEl.contains(askChangesButton)) {
        event.preventDefault();
        askForProposalChanges(askChangesButton.dataset.proposalAskChanges);
        return;
      }
      const cancelButton = event.target.closest('[data-cancel-project-reply]');
      if (cancelButton && chatMessagesEl.contains(cancelButton)) {
        event.preventDefault();
        cancelProjectReply();
        return;
      }
      const requestButton = event.target.closest('[data-chat-request-detail]');
      if (requestButton && chatMessagesEl.contains(requestButton)) {
        event.preventDefault();
        if (typeof window.openProjectRequestDetails !== 'function') {
          setStatus('Request details are unavailable. Please try again.', true);
          return;
        }
        window.openProjectRequestDetails(
          requestButton.dataset.chatRequestDetail,
          requestButton.dataset.chatRequestTitle
        );
        return;
      }
      const projectButton = event.target.closest('[data-chat-project-detail]');
      if (projectButton && chatMessagesEl.contains(projectButton)) {
        event.preventDefault();
        void ensureProjectDetailsLoaded().then(() => {
          window.openProjectDetails(
            projectButton.dataset.chatProjectDetail
          );
        }).catch(error => {
          console.error('Unable to open project details.', error);
          setStatus(error.message || 'Project details are unavailable. Please try again.', true);
        });
        return;
      }
      const button = event.target.closest('[data-chat-download]');
      if (button && chatMessagesEl.contains(button)) void downloadAttachment(button);
    });
    messageInputEl?.addEventListener('keydown', event => {
      const mobileRoom = mobileChatBreakpoint.matches
        && document.body.classList.contains('mobile-chat-room-open');
      if (event.key === 'Enter' && !mobileRoom && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        chatFormEl?.requestSubmit();
      }
    });
    messageInputEl?.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = `${Math.min(this.scrollHeight, 120)}px`;
    });
    document.getElementById('chatBackBtn')?.addEventListener('click', () => {
      pendingConversationDraft = null;
      activeConvId = null;
      document.body.classList.add('mobile-chat-room-leaving');
      syncMobileChatRoomNavbar(false);
      window.setTimeout(() => {
        document.body.classList.remove('mobile-chat-room-leaving');
        document.body.classList.remove('mobile-chat-room-open');
        chatViewportEl?.classList.remove('viewing-thread');
      }, 280);
      updateConversationQuery(null);
      renderMessagesThread();
    });
    document.getElementById('toggleDetailBtn')?.addEventListener('click', () => {
      setDetailPaneOpen(detailPaneEl?.classList.contains('closed'));
    });
    document.getElementById('closeDetailBtn')?.addEventListener('click', () => {
      setDetailPaneOpen(false);
    });
    detailBackdropEl?.addEventListener('click', () => setDetailPaneOpen(false));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !detailPaneEl?.classList.contains('closed') && mobileChatBreakpoint.matches) {
        setDetailPaneOpen(false);
      }
    });
    document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
      conversations.forEach(conversation => markRead(conversation, {notify: false}));
      window.dispatchEvent(new Event('devmatch:messages-changed'));
      updateUnreadCounts();
      renderConversationsList();
      setStatus('Conversations marked read on this device.');
    });
    document.getElementById('mobileMarkAllReadBtn')?.addEventListener('click', () => {
      document.getElementById('markAllReadBtn')?.click();
    });
    const attachButton = document.getElementById('chatAttachBtn');
    if (attachButton) attachButton.hidden = false;
    mobileChatBreakpoint.addEventListener('change', event => {
      if (event.matches) setDetailPaneOpen(false);
    });
  }

  async function initialize() {
    bindControls();
    renderConversationSkeleton();
    setStatus('Loading conversations…');
    if (window.matchMedia('(orientation: portrait)').matches
      && new URLSearchParams(location.search).get('conversation')) {
      document.body.classList.add('mobile-chat-room-open');
    }
    let legacyChatRemoved = false;
    try {
      legacyChatRemoved = localStorage.getItem(LEGACY_CHAT_STORAGE_KEY) !== null;
      localStorage.removeItem(LEGACY_CHAT_STORAGE_KEY);
    } catch (error) {
      console.error('Unable to clear old device-only chat data.', error);
      setStatus('Old local chat data could not be cleared from this browser.', true);
    }

    currentUser = await backend.ready;
    if (!currentUser) return;
    currentProfile = await backend.loadProfile(currentUser);
    updateShell(currentProfile);
    try {
      await loadConversationList();
    } catch (error) {
      convListEl?.replaceChildren();
      convListEl?.setAttribute('aria-busy', 'false');
      throw error;
    }
    await startRealtime();
    activityTimer=setInterval(()=>void syncActivity(),30000);
    await openFromQuery();
    await syncActivity();
    if (isLocalProposalCardPreview()) {
      setStatus('Visual preview only. Buttons and deadline text are not active.');
    } else if (legacyChatRemoved) {
      setStatus('Previous device-only demo chats were cleared. New messages are stored securely in Supabase.');
    } else if (!activeConvId && !pendingConversationDraft) {
      setStatus('Select a conversation or open a project to start a secure chat.');
    }
  }

  initialize().catch(error => {
    console.error('Unable to initialize secure chat.', error);
    setStatus(error.message || 'Unable to load chat. Please try again.', true);
  });

  window.addEventListener('beforeunload', () => {
    clearInterval(activityTimer);
    if (realtimeChannel) void client.removeChannel(realtimeChannel);
    presenceChannels.forEach(channel => void client.removeChannel(channel));
  });
})();
