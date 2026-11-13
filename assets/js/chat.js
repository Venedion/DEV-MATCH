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
    activeProjectTitle: document.getElementById('activeProjectTitle'),
    activeProjectPrice: document.getElementById('activeProjectPrice'),
    viewProjectLink: document.getElementById('viewProjectLink'),
    viewProjectBtn: document.getElementById('viewProjectBtn'),
    activeWhatsAppBtn: document.getElementById('activeWhatsAppBtn'),
    detailAvatar: document.getElementById('detailAvatar'),
    detailName: document.getElementById('detailName'),
    detailRole: document.getElementById('detailRole'),
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
  let currentFilter = 'all';
  let searchQuery = '';
  let realtimeChannel = null;
  let authSubscription = null;
  let isSending = false;
  let selectedAttachment = null;

  function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
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
      body: {action, ...payload}
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
    try {
      const readAt = Number(localStorage.getItem(readAtKey(conversation.id)) || 0);
      return Date.parse(last.created_at) <= readAt;
    } catch (error) {
      console.warn('Unable to read local chat status.', error);
      return false;
    }
  }

  function markRead(conversation) {
    conversation.unreadCount = 0;
    try {
      localStorage.setItem(readAtKey(conversation.id), String(Date.now()));
    } catch (error) {
      console.warn('Unable to save local chat read status.', error);
    }
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

  function mapConversation(row, people, projects) {
    const existing = conversations.find(item => item.id === row.id);
    const otherId = row.participant_a_id === currentUser.id
      ? row.participant_b_id
      : row.participant_a_id;
    const person = people.get(otherId);
    const project = projects.get(row.project_id) || null;
    const conversation = {
      id: row.id,
      contactId: person?.username || otherId,
      participantId: otherId,
      name: person?.display_name || 'DEV-MATCH member',
      initials: initials(person?.display_name),
      role: person?.account_role === 'client' ? 'Client' : 'Developer',
      roleType: person?.account_role || '',
      color: person?.account_role === 'client' ? 'coral' : 'blue',
      online: false,
      statusText: 'Encrypted chat',
      project: project ? {
        id: project.id,
        title: project.title,
        category: project.category,
        price: project.price,
        summary: project.data?.overview || project.data?.description || '',
        project_kind: project.project_kind,
        link: projectUrl(project)
      } : null,
      files: [],
      messages: existing?.messages || [],
      lastMessage: row.last_message || null,
      unreadCount: 0,
      quickReplies: []
    };
    if (!wasReadAfterLastMessage(conversation)) conversation.unreadCount = 1;
    return conversation;
  }

  async function loadConversationList() {
    const rows = await invokeChat('list-conversations');
    if (!Array.isArray(rows)) throw new Error('Chat service returned an invalid conversation list.');

    const partnerIds = [...new Set(rows.map(row =>
      row.participant_a_id === currentUser.id ? row.participant_b_id : row.participant_a_id
    ))];
    const projectIds = [...new Set(rows.map(row => row.project_id).filter(Boolean))];
    let people = [];
    let projects = [];

    if (partnerIds.length) {
      const result = await client.from('directory_people')
        .select('id,display_name,username,account_role')
        .in('id', partnerIds);
      if (result.error) throw result.error;
      people = result.data || [];
    }
    if (projectIds.length) {
      const result = await client.from('projects')
        .select('id,title,category,price,data,project_kind')
        .in('id', projectIds);
      if (result.error) throw result.error;
      projects = result.data || [];
    }

    const peopleById = new Map(people.map(person => [person.id, person]));
    const projectsById = new Map(projects.map(project => [project.id, project]));
    conversations = rows.map(row => mapConversation(row, peopleById, projectsById));
    if (!conversations.some(conversation => conversation.id === activeConvId)) {
      activeConvId = null;
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
      convListEl.innerHTML = `<li class="chat-conv-empty"><p>${emptyText}</p><small>Select a project to start a secure chat.</small></li>`;
      return;
    }

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
            <span class="chat-online-dot offline"></span>
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
  }

  function getActiveConversation() {
    return conversations.find(conversation => conversation.id === activeConvId) || null;
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
      if (composer) composer.hidden = true;
      if (quickRepliesEl) quickRepliesEl.hidden = true;
      detailPaneEl?.classList.add('closed');
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
    if (elements.activeStatusText) elements.activeStatusText.textContent = 'Encrypted via Supabase';
    if (elements.activeStatusDot) elements.activeStatusDot.hidden = true;

    const project = conversation.project;
    if (projectBanner) projectBanner.hidden = !project;
    if (project) {
      if (elements.activeProjectTitle) elements.activeProjectTitle.textContent = project.title;
      if (elements.activeProjectPrice) elements.activeProjectPrice.textContent = project.price || '';
      if (elements.viewProjectLink) elements.viewProjectLink.href = project.link;
      if (elements.viewProjectBtn) elements.viewProjectBtn.href = project.link;
    }
    if (elements.activeWhatsAppBtn) elements.activeWhatsAppBtn.hidden = true;
    if (elements.detailWhatsAppAction) elements.detailWhatsAppAction.hidden = true;
    if (elements.detailAvatar) {
      elements.detailAvatar.textContent = conversation.initials;
      elements.detailAvatar.className = `chat-detail-avatar ${conversation.color}`;
    }
    if (elements.detailName) elements.detailName.textContent = conversation.name;
    if (elements.detailRole) elements.detailRole.textContent = conversation.role;
    if (elements.detailProjectTitle) {
      elements.detailProjectTitle.textContent = project?.title || 'No project linked';
    }
    if (elements.detailProjectDesc) {
      elements.detailProjectDesc.textContent = project?.summary || 'Private conversation';
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
      return `${dateSeparator}
        <div class="chat-msg-row ${isSent ? 'sent' : 'received'}">
          ${!isSent ? `<div class="chat-msg-avatar ${escapeHtml(conversation.color)}">${escapeHtml(conversation.initials)}</div>` : ''}
          <div class="chat-msg-content">
            ${message.text ? `<div class="chat-msg-bubble">${escapeHtml(message.text).replace(/\n/g, '<br>')}</div>` : ''}
            ${attachmentCards}
            <div class="chat-msg-meta"><span>${escapeHtml(formatTime(message.created_at))}</span></div>
          </div>
        </div>`;
    }).join('');
    if (chatMessagesEl) {
      chatMessagesEl.innerHTML = messagesHtml || '<p class="chat-conv-empty">No messages yet. Send the first message.</p>';
      scrollThreadToBottom();
    }
    updateDetailPaneVisibility();
  }

  function updateDetailPaneVisibility() {
    if (mobileChatBreakpoint.matches && detailPaneEl) detailPaneEl.classList.add('closed');
  }

  function scrollThreadToBottom() {
    threadContainerEl?.scrollTo({top: threadContainerEl.scrollHeight, behavior: 'auto'});
  }

  async function loadMessages(conversationId) {
    const messages = await invokeChat('list-messages', {conversationId});
    if (!Array.isArray(messages)) throw new Error('Chat service returned an invalid message list.');
    const conversation = conversations.find(item => item.id === conversationId);
    if (!conversation) return;
    conversation.messages = messages;
    conversation.lastMessage = messages[messages.length - 1] || null;
    if (conversation.lastMessage?.sender_id !== currentUser.id && conversationId !== activeConvId) {
      if (!wasReadAfterLastMessage(conversation)) conversation.unreadCount = 1;
    }
    if (conversationId === activeConvId) markRead(conversation);
    updateUnreadCounts();
    renderConversationsList();
    if (conversationId === activeConvId) renderMessagesThread();
  }

  async function startRealtime() {
    const {data, error} = await client.auth.getSession();
    if (error) throw error;
    if (!data.session?.access_token) throw new Error('Your session expired. Please log in again.');
    await client.realtime.setAuth(data.session.access_token);
    if (!authSubscription) {
      const {data: authListener} = client.auth.onAuthStateChange((_event, session) => {
        if (session?.access_token) {
          void client.realtime.setAuth(session.access_token).catch(error => {
            console.error('Unable to refresh the real-time session token.', error);
          });
        }
      });
      authSubscription = authListener.subscription;
    }
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
          if (conversationId === activeConvId) await loadMessages(conversationId);
        } catch (error) {
          console.error('Unable to refresh real-time chat messages.', error);
          setStatus(error.message || 'Unable to refresh messages.', true);
        }
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setStatus('Connected securely · messages encrypted at rest.');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setStatus('Real-time connection interrupted. Messages may be delayed.', true);
        }
      });
  }

  async function selectConversation(id) {
    const conversation = conversations.find(item => item.id === id);
    if (!conversation) return;
    activeConvId = id;
    markRead(conversation);
    if (chatViewportEl) chatViewportEl.classList.add('viewing-thread');
    if (!mobileChatBreakpoint.matches) detailPaneEl?.classList.remove('closed');
    updateUnreadCounts();
    renderConversationsList();
    renderMessagesThread();
    setStatus('Loading encrypted messages…');
    if (messageInputEl) messageInputEl.focus();
    try {
      await loadMessages(id);
      if (!realtimeChannel) await startRealtime();
      setStatus('Connected securely · messages encrypted at rest.');
    } catch (error) {
      console.error('Unable to open chat conversation.', error);
      setStatus(error.message || 'Unable to load this conversation.', true);
    }
  }

  async function sendMessage(text) {
    const conversation = getActiveConversation();
    if (!conversation || isSending) return;
    const plainText = String(text || '').trim();
    if (!plainText && !selectedAttachment) return;
    isSending = true;
    if (sendBtnEl) sendBtnEl.disabled = true;
    if (attachButtonEl) attachButtonEl.disabled = true;
    setStatus('Encrypting and sending…');
    try {
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
        ...(attachment ? {attachment} : {})
      });
      if (!message || typeof message.text !== 'string' || !Array.isArray(message.attachments)) {
        throw new Error('Chat service returned an invalid message.');
      }
      if (!conversation.messages.some(item => item.id === message.id)) {
        conversation.messages.push(message);
      }
      conversation.lastMessage = message;
      renderConversationsList();
      renderMessagesThread();
      setStatus('Message sent securely.');
      return true;
    } catch (error) {
      console.error('Unable to send chat message.', error);
      setStatus(error.message || 'Unable to send this message.', true);
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
        .eq('id', contact)
        .maybeSingle();
      if (result.error) throw result.error;
      if (result.data) return result.data;
    }
    if (contact) {
      const result = await client.from('directory_people')
        .select('id,display_name,username,account_role')
        .eq('username', contact.replace(/^@/, ''))
        .maybeSingle();
      if (result.error) throw result.error;
      if (result.data) return result.data;
    }
    if (UUID_PATTERN.test(fallbackId || '')) {
      const result = await client.from('directory_people')
        .select('id,display_name,username,account_role')
        .eq('id', fallbackId)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    }
    return null;
  }

  async function openFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project') || params.get('request');
    if (projectId) {
      const conversation = await invokeChat('start-project', {projectId});
      await loadConversationList();
      await selectConversation(conversation.id);
      return;
    }
    const contact = params.get('contact');
    const participantId = params.get('client');
    if (contact || participantId) {
      const recipient = await lookupContact(contact, participantId);
      if (!recipient) throw new Error('This contact is not available in the public directory.');
      const conversation = await invokeChat('start-user', {participantId: recipient.id});
      await loadConversationList();
      await selectConversation(conversation.id);
      return;
    }
    const requestedConversation = params.get('conversation');
    if (requestedConversation && conversations.some(item => item.id === requestedConversation)) {
      await selectConversation(requestedConversation);
    }
  }

  function updateNavLabel(link, label) {
    const textNode = link && Array.from(link.childNodes)
      .find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (textNode) textNode.textContent = ` ${label} `;
  }

  function updateShell(profile) {
    const isClient = profile.account_role === 'client';
    const role = isClient ? 'client' : 'dev';
    const name = profile.display_name?.trim() || currentUser.email || 'DEV-MATCH member';
    const avatar = document.getElementById('userAvatar');
    const topName = document.getElementById('topUserName');
    if (avatar) avatar.textContent = initials(name);
    if (topName) topName.textContent = name;
    document.body.classList.toggle('client-shell-page', isClient);
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
        workspace.innerHTML = '<span class="workspace-icon">C</span><span><b>Client workspace</b><small>Discover &amp; hire</small></span>';
      }
      const sideAdd = document.querySelector('.side-add');
      if (sideAdd) {
        sideAdd.href = 'devmatch-client-dashboard.html#requests';
        sideAdd.textContent = 'Post a Request';
      }
      const overview = document.querySelector('.side-nav a[href="devmatch-dashboard.html"]');
      if (overview) {
        overview.href = 'devmatch-client-dashboard.html';
        updateNavLabel(overview, 'Home');
      }
      const projects = document.querySelector('.side-nav a[href="devmatch-my-projects.html"]');
      if (projects) {
        projects.href = 'devmatch-client-dashboard.html#requests';
        updateNavLabel(projects, 'My Requests');
      }
      const discover = document.querySelector('.side-nav a[href="devmatch-find-projects.html"]');
      if (discover) {
        discover.href = 'devmatch-discover-projects.html';
        updateNavLabel(discover, 'Discover Projects');
      }
      const developers = document.querySelector('.side-nav a[href="devmatch-find-clients.html"]');
      if (developers) {
        developers.href = 'devmatch-find-developers.html';
        updateNavLabel(developers, 'Developers');
      }
      const favorites = document.querySelector('.side-nav a[href="devmatch-favorites.html"]');
      if (favorites) favorites.href = 'devmatch-favorites.html?role=client';
      const messages = document.querySelector('.side-nav a[href="devmatch-chat.html"]');
      if (messages) messages.href = 'devmatch-chat.html?role=client';
      const profile = document.querySelector('.side-nav a[href="devmatch-my-profile.html?role=dev"]');
      if (profile) profile.href = 'devmatch-my-profile.html?role=client';
      const notifications = document.querySelector('.side-nav a[href="devmatch-developer-notifications.html"]');
      if (notifications) notifications.href = 'devmatch-notifications.html';
      const topNotifications = document.querySelector('.notification-button');
      if (topNotifications) topNotifications.href = 'devmatch-notifications.html';
    }
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
      chatViewportEl?.classList.remove('viewing-thread');
    });
    document.getElementById('toggleDetailBtn')?.addEventListener('click', () => {
      detailPaneEl?.classList.toggle('closed');
    });
    document.getElementById('closeDetailBtn')?.addEventListener('click', () => {
      detailPaneEl?.classList.add('closed');
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
      if (event.matches) detailPaneEl?.classList.add('closed');
    });
  }

  async function initialize() {
    bindControls();
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
    setStatus('Loading conversations…');
    await loadConversationList();
    await startRealtime();
    await openFromQuery();
    if (legacyChatRemoved) {
      setStatus('Previous device-only demo chats were cleared. New messages are stored securely in Supabase.');
    } else if (!activeConvId) {
      setStatus('Select a conversation or open a project to start a secure chat.');
    }
  }

  initialize().catch(error => {
    console.error('Unable to initialize secure chat.', error);
    setStatus(error.message || 'Unable to load chat. Please try again.', true);
  });

  window.addEventListener('beforeunload', () => {
    if (realtimeChannel) void client.removeChannel(realtimeChannel);
    authSubscription?.unsubscribe();
  });
})();
