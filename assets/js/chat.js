(function() {
  'use strict';

  const backend = window.devMatchBackend;
  const client = backend.client;
  const LEGACY_CHAT_STORAGE_KEY = 'devmatch_chat_conversations_v2';
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  const convListEl = document.getElementById('chatConvList');
  const threadContainerEl = document.getElementById('chatThreadContainer');
  const chatMessagesEl = document.getElementById('chatMessages');
  const quickRepliesEl = document.getElementById('chatQuickReplies');
  const messageInputEl = document.getElementById('chatMessageInput');
  const chatFormEl = document.getElementById('chatComposerForm');
  const attachmentInputEl = document.getElementById('chatAttachmentInput');
  const attachmentPreviewEl = document.getElementById('chatAttachmentPreview');
  const attachButtonEl = document.getElementById('chatAttachBtn');
  const searchInputEl = document.getElementById('chatSearchInput');
  const filterBtns = document.querySelectorAll('.chat-filter-btn');
  const chatViewportEl = document.getElementById('chatViewport');
  const chatEmptyStateEl = document.getElementById('chatEmptyState');
  const detailPaneEl = document.getElementById('chatDetailPane');
  const totalBadgeEl = document.getElementById('chatTotalBadge');
  const statusEl = document.getElementById('chatStatus');
  const sendBtnEl = chatFormEl?.querySelector('[type="submit"]');
  const mobileChatBreakpoint = window.matchMedia('(max-width: 820px)');
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
  const presenceChannels = new Map();
  let presenceReady = false;
  let isSending = false;
  let selectedAttachment = null;
  let projectDetailsPromise = null;

  function setStatus(message, isError = false) {
    if (!statusEl) return;
    if (/^Loading\b/.test(message) && window.DEVMATCH_SKELETON) {
      window.DEVMATCH_SKELETON.status(statusEl,message,1);
    } else {
      statusEl.textContent = message;
    }
    statusEl.classList.toggle('is-error', isError);
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

  function readAtKey(conversationId) {
    return `devmatch-chat-read:${currentUser.id}:${conversationId}`;
  }

  function wasReadAfterLastMessage(conversation) {
    const last = conversation.lastMessage;
    if (!last || last.sender_id === currentUser.id) return true;
    if (last.read_at && Date.parse(last.read_at) >= Date.parse(last.created_at)) return true;
    try {
      const readAt = Number(localStorage.getItem(readAtKey(conversation.id)) || 0);
      return Date.parse(last.created_at) <= readAt;
    } catch (error) {
      console.warn('Unable to read local chat status.', error);
      return false;
    }
  }

  function markRead(conversation) {
    const wasUnread = conversation.unreadCount > 0;
    conversation.unreadCount = 0;
    try {
      localStorage.setItem(readAtKey(conversation.id), String(Date.now()));
    } catch (error) {
      console.warn('Unable to save local chat read status.', error);
    }
    if (wasUnread) window.dispatchEvent(new Event('devmatch:messages-changed'));
  }

  function updateUnreadCounts() {
    const total = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
    if (totalBadgeEl) {
      totalBadgeEl.textContent = String(total);
      totalBadgeEl.hidden = total === 0;
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

    const project = conversation.project;
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
      const bubble = projectContext || messageText
        ? `<div class="chat-msg-bubble">${projectContext}${projectContext && messageText ? '<div class="chat-project-reply-divider" aria-hidden="true"></div>' : ''}${messageText}</div>`
        : '';
      return `${dateSeparator}
        <div class="chat-msg-row ${isSent ? 'sent' : 'received'}">
          ${!isSent ? `<div class="chat-msg-avatar ${escapeHtml(conversation.color)}">${escapeHtml(conversation.initials)}</div>` : ''}
          <div class="chat-msg-content">
            <div class="chat-msg-body-row">
              <div class="chat-msg-body">
                ${bubble}
                ${attachmentCards}
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
      chatMessagesEl.innerHTML = `${messagesHtml || '<p class="chat-conv-empty">No messages yet. Send the first message.</p>'}${projectReplyDraft}`;
      scrollThreadToBottom();
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
    detailPaneEl.classList.toggle('closed', !isOpen);
    detailPaneEl.setAttribute('aria-hidden', String(!isOpen));
    document.getElementById('toggleDetailBtn')?.setAttribute('aria-expanded', String(isOpen));
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
    if (Array.isArray(initialMessages)) {
      conversation.messages = initialMessages;
      conversation.lastMessage = initialMessages[initialMessages.length - 1] || conversation.lastMessage;
    }
    pendingConversationDraft = null;
    activeConvId = id;
    updateConversationQuery(id, focusReview);
    markRead(conversation);
    if (chatViewportEl) chatViewportEl.classList.add('viewing-thread');
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
    if (messageInputEl) messageInputEl.focus();
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
    setDetailPaneOpen(false);
    renderConversationsList();
    renderMessagesThread();
    setStatus(status, status !== 'Write a message to start this conversation.');
    messageInputEl?.focus();
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
      if (threadContainerEl.scrollTop > 80) return;
      const conversation = getActiveConversation();
      if (conversation && conversation !== pendingConversationDraft) {
        void loadOlderMessages(conversation);
      }
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
    attachButtonEl?.addEventListener('click', () => attachmentInputEl?.click());
    attachmentInputEl?.addEventListener('change', () => {
      const file = attachmentInputEl.files?.[0];
      if (!file) return;
      if (![
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/webp'
      ].includes(file.type) || file.size < 1 || file.size > 2 * 1024 * 1024) {
        setStatus('Choose a PDF, DOC, DOCX, JPG, PNG, or WebP file up to 2 MB.', true);
        attachmentInputEl.value = '';
        return;
      }
      selectedAttachment = file;
      renderAttachmentPreview();
      setStatus('Attachment ready. Files are encrypted before storage.');
    });
    chatMessagesEl?.addEventListener('click', event => {
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
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
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
      chatViewportEl?.classList.remove('viewing-thread');
      updateConversationQuery(null);
      renderMessagesThread();
    });
    document.getElementById('toggleDetailBtn')?.addEventListener('click', () => {
      setDetailPaneOpen(detailPaneEl?.classList.contains('closed'));
    });
    document.getElementById('closeDetailBtn')?.addEventListener('click', () => {
      setDetailPaneOpen(false);
    });
    document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
      conversations.forEach(markRead);
      updateUnreadCounts();
      renderConversationsList();
      setStatus('Conversations marked read on this device.');
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
    if (legacyChatRemoved) {
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
