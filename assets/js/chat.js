(function() {
  'use strict';

  // Helper escape function
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  // Default initial conversations data
  const defaultConversations = [
    {
      id: 'jessica-sitorus',
      contactId: 'jessica',
      name: 'Jessica Sitorus',
      initials: 'JS',
      role: 'Client',
      roleType: 'client',
      color: 'coral',
      online: true,
      statusText: 'Active now',
      project: {
        id: 'restaurant',
        title: 'Restaurant Website Development',
        category: 'Company Profile',
        price: 'Rp 3.500.000',
        summary: 'Warm, responsive bistro website with digital menu and reservations.',
        link: 'devmatch-developer-profile.html?developer=restaurant'
      },
      files: [
        { name: 'Menu_Bistro_Draft.pdf', size: '1.4 MB' },
        { name: 'Restaurant_Branding_Guidelines.png', size: '3.2 MB' }
      ],
      messages: [
        {
          id: 'm1',
          from: 'them',
          senderName: 'Jessica Sitorus',
          text: 'Hi! I saw your Restaurant Website project on DEV-MATCH. We run a seafood bistro in Medan and really love the aesthetic and layout.',
          time: '10:14 AM'
        },
        {
          id: 'm2',
          from: 'them',
          senderName: 'Jessica Sitorus',
          text: 'Could we add an online table reservation option where customers can pick a time slot and get a confirmation via WhatsApp?',
          time: '10:16 AM'
        },
        {
          id: 'm3',
          from: 'me',
          senderName: 'You',
          text: 'Hi Jessica! Yes, absolutely. The reservation system can connect directly to the WhatsApp Business API or send automated booking alerts with table details.',
          time: '10:20 AM'
        },
        {
          id: 'm4',
          from: 'them',
          senderName: 'Jessica Sitorus',
          text: 'That sounds perfect! What would the timeline look like for implementation and launch?',
          time: '10:22 AM'
        }
      ],
      unreadCount: 1,
      quickReplies: [
        'Usually 7-10 working days including testing',
        'Yes, WhatsApp notifications are included',
        'Can we schedule a 15-minute call on WhatsApp?',
        'I will share a formal proposal with timeline'
      ],
      autoReplies: [
        'Thanks for clarifying! 7-10 days works great for our schedule. Should I prepare the menu items and photos first?',
        'Sounds good! Let me know your WhatsApp number or we can continue right here.',
        'Perfect, looking forward to reviewing the proposal and kicking off the project!'
      ]
    },
    {
      id: 'rizky-aditya',
      contactId: 'rizky',
      name: 'Rizky Aditya',
      initials: 'RA',
      role: 'Developer Partner',
      roleType: 'dev',
      color: 'blue',
      online: true,
      statusText: 'Active 15m ago',
      project: {
        id: 'store',
        title: 'LUMA Online Store & Custom Checkout',
        category: 'E-Commerce',
        price: 'Rp 8.000.000',
        summary: 'Modern online store with product filtering and payment gateway integration.',
        link: 'devmatch-developer-profile.html?developer=restaurant'
      },
      files: [
        { name: 'API_Endpoints_v1.json', size: '240 KB' },
        { name: 'Database_Schema.png', size: '890 KB' }
      ],
      messages: [
        {
          id: 'r1',
          from: 'me',
          senderName: 'You',
          text: 'Hey Rizky! Did you have a chance to review the scope for the client booking module and payment webhook?',
          time: 'Yesterday'
        },
        {
          id: 'r2',
          from: 'them',
          senderName: 'Rizky Aditya',
          text: 'Yes! I checked the repository and the requirements doc yesterday. Everything looks clean.',
          time: 'Yesterday'
        },
        {
          id: 'r3',
          from: 'them',
          senderName: 'Rizky Aditya',
          text: 'I can start next week if the scope is fixed. Shall we sync on the Supabase authentication schema first?',
          time: '11:05 AM'
        }
      ],
      unreadCount: 1,
      quickReplies: [
        'Yes, let us sync on Supabase schema today',
        'Scope is locked, ready whenever you are',
        'I pushed the latest API contracts to GitHub',
        'Let us jump on a quick Discord or Google Meet'
      ],
      autoReplies: [
        'Awesome, I will pull the branch and set up the local migrations.',
        'Got it! Looking forward to collaborating on this sprint.',
        'Sounds like a solid plan. Ping me on WhatsApp or here when the repo is updated.'
      ]
    },
    {
      id: 'kevin-tanoto',
      contactId: 'kevin',
      name: 'Kevin Tanoto',
      initials: 'KT',
      role: 'Client / Café Owner',
      roleType: 'client',
      color: 'purple',
      online: false,
      statusText: 'Active 1h ago',
      project: {
        id: 'pos',
        title: 'Kasir Pintar — Café POS',
        category: 'POS',
        price: 'Rp 6.000.000',
        summary: 'Cloud POS with inventory tracking, sales reports, and multi-branch support.',
        link: 'devmatch-developer-profile.html?developer=pos'
      },
      files: [
        { name: 'Hardware_Printer_Specs.pdf', size: '520 KB' }
      ],
      messages: [
        {
          id: 'k1',
          from: 'them',
          senderName: 'Kevin Tanoto',
          text: 'Hello! Kasir Pintar POS looks very clean and well-built. Is this available for multiple branches with centralized stock management?',
          time: '2h ago'
        },
        {
          id: 'k2',
          from: 'me',
          senderName: 'You',
          text: 'Hi Kevin! Yes, multi-branch support is built into the architecture. Each branch gets its own cashier terminal while managers view aggregated revenue and inventory analytics.',
          time: '1h ago'
        },
        {
          id: 'k3',
          from: 'them',
          senderName: 'Kevin Tanoto',
          text: 'Looks great! Can it also connect to standard 58mm and 80mm Bluetooth thermal printers for receipts?',
          time: '45m ago'
        }
      ],
      unreadCount: 1,
      quickReplies: [
        'Yes, standard ESC/POS thermal printers are supported',
        'We also support barcode scanner integration',
        'Would you like a live demo walkthrough?',
        'Does your café already have hardware ready?'
      ],
      autoReplies: [
        'That is great to know, we already have EPSON thermal printers in both shops.',
        'A live demo would be amazing! When are you free?',
        'Thanks for the quick response. I will discuss with my partner and confirm tomorrow.'
      ]
    },
    {
      id: 'anindya-putri',
      contactId: 'anindya',
      name: 'Anindya Putri',
      initials: 'AN',
      role: 'Client / Clinic Ops',
      roleType: 'client',
      color: 'coral',
      online: true,
      statusText: 'Active now',
      project: {
        id: 'booking',
        title: 'Klinik Booking App',
        category: 'Booking',
        price: 'Rp 5.000.000',
        summary: 'Patient appointments, doctor schedules, and WhatsApp reminders.',
        link: 'devmatch-developer-profile.html?developer=booking'
      },
      files: [
        { name: 'Dokter_Spesialis_Schedule.xlsx', size: '310 KB' }
      ],
      messages: [
        {
          id: 'a1',
          from: 'them',
          senderName: 'Anindya Putri',
          text: 'Hi! We run a dental care clinic in Surabaya. Can the clinic booking app send automatic WhatsApp reminders to patients 1 day before their visit?',
          time: '3h ago'
        },
        {
          id: 'a2',
          from: 'me',
          senderName: 'You',
          text: 'Hi Anindya! Yes, WhatsApp reminders are integrated and can be scheduled 24 hours and 2 hours before the appointment with a cancellation/reschedule link.',
          time: '2h ago'
        },
        {
          id: 'a3',
          from: 'them',
          senderName: 'Anindya Putri',
          text: 'Wonderful! Can multiple doctors have different operational hours and consultation durations?',
          time: '1h ago'
        },
        {
          id: 'a4',
          from: 'me',
          senderName: 'You',
          text: 'Yes, each doctor profile has customized slot intervals (e.g. 15, 30, or 45 mins) and individual shift calendars.',
          time: '40m ago'
        }
      ],
      unreadCount: 0,
      quickReplies: [
        'Would you like to test the patient booking flow?',
        'We can import your doctors schedule via Excel',
        'Yes, we can deploy on Android and iOS',
        'Let us schedule a demo call'
      ],
      autoReplies: [
        'Thanks! I will review the doctor schedule sheet with our clinic manager today.',
        'Sounds very practical. Could you share a demo link so I can test it on my mobile phone?',
        'Great! We would like to proceed with setting up a trial.'
      ]
    },
    {
      id: 'dimas-prasetyo',
      contactId: 'dimas',
      name: 'Dimas Prasetyo',
      initials: 'DP',
      role: 'Client / Logistics',
      roleType: 'client',
      color: 'emerald',
      online: false,
      statusText: 'Active 3h ago',
      project: {
        id: 'inventory',
        title: 'Gudang Inventory System',
        category: 'Inventory',
        price: 'Rp 4.500.000',
        summary: 'Track stock levels, suppliers, and purchase orders in one place.',
        link: 'devmatch-developer-profile.html?developer=inventory'
      },
      files: [
        { name: 'Warehouse_SKU_Sample.csv', size: '1.1 MB' }
      ],
      messages: [
        {
          id: 'd1',
          from: 'them',
          senderName: 'Dimas Prasetyo',
          text: 'Hello, does the inventory system support barcode scanner input via USB and mobile camera?',
          time: 'Yesterday'
        },
        {
          id: 'd2',
          from: 'me',
          senderName: 'You',
          text: 'Yes Dimas, it supports both standard USB barcode guns and smartphone camera scanning via WebRTC.',
          time: 'Yesterday'
        },
        {
          id: 'd3',
          from: 'them',
          senderName: 'Dimas Prasetyo',
          text: 'Great! That fits our warehouse workflow nicely. We will test the import format next.',
          time: 'Yesterday'
        }
      ],
      unreadCount: 0,
      quickReplies: [
        'I can provide a sample CSV template for SKUs',
        'Low-stock threshold alerts are also supported',
        'Feel free to test with your own inventory list',
        'Let me know if you need supplier PO templates'
      ],
      autoReplies: [
        'Thank you! The sample template would be very helpful.',
        'We will run a test import tomorrow morning and let you know.',
        'Awesome, appreciate the fast support.'
      ]
    }
  ];

  // Storage key
  const STORAGE_KEY = 'devmatch_chat_conversations_v2';

  // Load from localStorage or initialize
  function loadConversations() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultConversations));
      }
    } catch (e) {
      console.warn('Failed to access localStorage for chat conversations', e);
    }
    return defaultConversations;
  }

  function saveConversations(data) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Failed to save chat conversations to localStorage', e);
    }
  }

  let conversations = loadConversations();
  let activeConvId = conversations[0].id;
  let currentFilter = 'all';
  let searchQuery = '';

  // DOM Elements
  const convListEl = document.getElementById('chatConvList');
  const threadContainerEl = document.getElementById('chatThreadContainer');
  const chatMessagesEl = document.getElementById('chatMessages');
  const quickRepliesEl = document.getElementById('chatQuickReplies');
  const messageInputEl = document.getElementById('chatMessageInput');
  const chatFormEl = document.getElementById('chatComposerForm');
  const searchInputEl = document.getElementById('chatSearchInput');
  const filterBtns = document.querySelectorAll('.chat-filter-btn');
  const chatViewportEl = document.getElementById('chatViewport');
  const backBtnEl = document.getElementById('chatBackBtn');
  const detailPaneEl = document.getElementById('chatDetailPane');
  const toggleDetailBtn = document.getElementById('toggleDetailBtn');
  const closeDetailBtn = document.getElementById('closeDetailBtn');
  const totalBadgeEl = document.getElementById('chatTotalBadge');
  const markAllReadBtn = document.getElementById('markAllReadBtn');

  // Active header elements
  const activeAvatarEl = document.getElementById('activeAvatar');
  const activeNameEl = document.getElementById('activeName');
  const activeRoleEl = document.getElementById('activeRole');
  const activeStatusDotEl = document.getElementById('activeStatusDot');
  const activeStatusTextEl = document.getElementById('activeStatusText');
  const activeProjectBannerEl = document.getElementById('activeProjectBanner');
  const activeProjectTitleEl = document.getElementById('activeProjectTitle');
  const activeProjectPriceEl = document.getElementById('activeProjectPrice');
  const viewProjectLinkEl = document.getElementById('viewProjectLink');
  const viewProjectBtnEl = document.getElementById('viewProjectBtn');
  const activeWhatsAppBtnEl = document.getElementById('activeWhatsAppBtn');

  // Detail pane elements
  const detailAvatarEl = document.getElementById('detailAvatar');
  const detailNameEl = document.getElementById('detailName');
  const detailRoleEl = document.getElementById('detailRole');
  const detailProjectTitleEl = document.getElementById('detailProjectTitle');
  const detailProjectDescEl = document.getElementById('detailProjectDesc');
  const detailProjectPriceEl = document.getElementById('detailProjectPrice');
  const detailFilesListEl = document.getElementById('detailFilesList');
  const detailWhatsAppActionEl = document.getElementById('detailWhatsAppAction');

  // Format current time helper (e.g., "10:24 AM")
  function formatCurrentTime() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  // Get active conversation
  function getActiveConversation() {
    return conversations.find(c => c.id === activeConvId) || conversations[0];
  }

  // Calculate and update unread badges
  function updateUnreadCounts() {
    const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    if (totalBadgeEl) {
      totalBadgeEl.textContent = String(totalUnread);
      totalBadgeEl.style.display = totalUnread > 0 ? 'inline-flex' : 'none';
    }

    // Also update any sidebar badges or floating chat badges if present
    document.querySelectorAll('.chat-unread-total-badge').forEach(el => {
      el.textContent = String(totalUnread);
      el.style.display = totalUnread > 0 ? 'inline-flex' : 'none';
    });
  }

  // Render conversations list
  function renderConversationsList() {
    if (!convListEl) return;

    let filtered = conversations;

    // Filter by tab
    if (currentFilter === 'unread') {
      filtered = filtered.filter(c => c.unreadCount > 0);
    } else if (currentFilter === 'clients') {
      filtered = filtered.filter(c => c.roleType === 'client');
    } else if (currentFilter === 'devs') {
      filtered = filtered.filter(c => c.roleType === 'dev');
    }

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.project && c.project.title.toLowerCase().includes(q)) ||
        c.messages.some(m => m.text.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      convListEl.innerHTML = `
        <li class="chat-conv-empty">
          <p>No conversations found</p>
          <small>Try a different search or filter</small>
        </li>
      `;
      return;
    }

    convListEl.innerHTML = filtered.map(c => {
      const lastMsg = c.messages[c.messages.length - 1];
      const isUnread = (c.unreadCount || 0) > 0;
      const isActive = c.id === activeConvId;

      return `
        <li class="chat-conv-item ${isActive ? 'active' : ''} ${isUnread ? 'unread' : ''}" data-conv-id="${escapeHtml(c.id)}">
          <div class="chat-avatar-wrap">
            <div class="chat-avatar ${escapeHtml(c.color || 'blue')}">${escapeHtml(c.initials)}</div>
            <span class="chat-online-dot ${c.online ? '' : 'offline'}"></span>
          </div>
          <div class="chat-item-main">
            <div class="chat-item-top">
              <span class="chat-item-name">${escapeHtml(c.name)}</span>
              <span class="chat-item-time">${lastMsg ? escapeHtml(lastMsg.time) : ''}</span>
            </div>
            ${c.project ? `<span class="chat-item-tag">${escapeHtml(c.project.title)}</span>` : ''}
            <p class="chat-item-preview">${lastMsg ? (lastMsg.from === 'me' ? 'You: ' : '') + escapeHtml(lastMsg.text) : 'Start a conversation'}</p>
          </div>
          <div class="chat-item-badge-col">
            ${isUnread ? `<span class="chat-unread-pill">${c.unreadCount}</span>` : ''}
          </div>
        </li>
      `;
    }).join('');

    // Attach click events
    convListEl.querySelectorAll('.chat-conv-item').forEach(el => {
      el.addEventListener('click', () => {
        selectConversation(el.dataset.convId);
      });
    });
  }

  // Render the message thread of the active conversation
  function renderMessagesThread() {
    const conv = getActiveConversation();
    if (!conv) return;

    // Update active header details
    if (activeAvatarEl) {
      activeAvatarEl.textContent = conv.initials;
      activeAvatarEl.className = `chat-avatar ${conv.color || 'blue'}`;
    }
    if (activeNameEl) activeNameEl.textContent = conv.name;
    if (activeRoleEl) activeRoleEl.textContent = conv.role;
    if (activeStatusDotEl) {
      activeStatusDotEl.className = `chat-header-status-dot ${conv.online ? '' : 'offline'}`;
    }
    if (activeStatusTextEl) activeStatusTextEl.textContent = conv.statusText || (conv.online ? 'Active now' : 'Offline');

    // Update Project Banner
    if (activeProjectBannerEl && conv.project) {
      activeProjectBannerEl.style.display = 'flex';
      if (activeProjectTitleEl) activeProjectTitleEl.textContent = conv.project.title;
      if (activeProjectPriceEl) activeProjectPriceEl.textContent = conv.project.price;
      if (viewProjectLinkEl) viewProjectLinkEl.href = conv.project.link || '#';
      if (viewProjectBtnEl) viewProjectBtnEl.href = conv.project.link || '#';
    } else if (activeProjectBannerEl) {
      activeProjectBannerEl.style.display = 'none';
    }

    // Update WhatsApp link
    if (activeWhatsAppBtnEl) {
      const waNumber = '6281234567890';
      const waMsg = encodeURIComponent(`Hi ${conv.name}, I am reaching out from DEV-MATCH regarding ${conv.project ? conv.project.title : 'our discussion'}.`);
      activeWhatsAppBtnEl.href = `https://wa.me/${waNumber}?text=${waMsg}`;
    }
    if (detailWhatsAppActionEl) {
      const waNumber = '6281234567890';
      const waMsg = encodeURIComponent(`Hi ${conv.name}, I am reaching out from DEV-MATCH regarding ${conv.project ? conv.project.title : 'our discussion'}.`);
      detailWhatsAppActionEl.href = `https://wa.me/${waNumber}?text=${waMsg}`;
    }

    // Render Messages
    if (chatMessagesEl) {
      const messagesHtml = conv.messages.map(msg => {
        const isSent = msg.from === 'me';
        return `
          <div class="chat-msg-row ${isSent ? 'sent' : 'received'}">
            ${!isSent ? `<div class="chat-msg-avatar ${conv.color || 'blue'}">${escapeHtml(conv.initials)}</div>` : ''}
            <div class="chat-msg-content">
              <div class="chat-msg-bubble">
                ${escapeHtml(msg.text)}
                ${msg.attachment ? `
                  <div class="chat-attachment-card">
                    <div class="chat-attachment-icon">
                      <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
                    </div>
                    <div class="chat-attachment-info">
                      <b>${escapeHtml(msg.attachment.name)}</b>
                      <small>${escapeHtml(msg.attachment.size)}</small>
                    </div>
                  </div>
                ` : ''}
              </div>
              <div class="chat-msg-meta">
                <span>${escapeHtml(msg.time)}</span>
                ${isSent ? `<span class="chat-msg-checks" title="Delivered and read">✓✓</span>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');

      chatMessagesEl.innerHTML = `
        <div class="chat-date-separator">
          <span>Today, 28 October 2026</span>
        </div>
        ${messagesHtml}
      `;

      // Scroll to bottom
      scrollThreadToBottom();
    }

    // Render Quick Replies
    if (quickRepliesEl) {
      if (conv.quickReplies && conv.quickReplies.length > 0) {
        quickRepliesEl.style.display = 'flex';
        quickRepliesEl.innerHTML = conv.quickReplies.map(reply => `
          <button class="chat-chip" type="button" data-quick-reply="${escapeHtml(reply)}">
            ${escapeHtml(reply)}
          </button>
        `).join('');

        quickRepliesEl.querySelectorAll('.chat-chip').forEach(btn => {
          btn.addEventListener('click', () => {
            const text = btn.dataset.quickReply;
            sendMessage(text);
          });
        });
      } else {
        quickRepliesEl.style.display = 'none';
      }
    }

    // Update Detail Pane
    updateDetailPane(conv);
  }

  // Update Detail Pane contents
  function updateDetailPane(conv) {
    if (!conv) return;

    if (detailAvatarEl) {
      detailAvatarEl.textContent = conv.initials;
      detailAvatarEl.className = `chat-detail-avatar ${conv.color || 'blue'}`;
    }
    if (detailNameEl) detailNameEl.textContent = conv.name;
    if (detailRoleEl) detailRoleEl.textContent = `${conv.role} · Verified Contact`;

    if (conv.project) {
      if (detailProjectTitleEl) detailProjectTitleEl.textContent = conv.project.title;
      if (detailProjectDescEl) detailProjectDescEl.textContent = conv.project.summary || 'Project request on DEV-MATCH.';
      if (detailProjectPriceEl) detailProjectPriceEl.textContent = `${conv.project.price} · Agreed estimate`;
    }

    if (detailFilesListEl) {
      if (conv.files && conv.files.length > 0) {
        detailFilesListEl.innerHTML = conv.files.map(file => `
          <li class="chat-detail-file-item">
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
            <div>
              <b>${escapeHtml(file.name)}</b>
              <small>${escapeHtml(file.size)}</small>
            </div>
            <a href="#" download title="Download file" style="color:var(--ink);"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>
          </li>
        `).join('');
      } else {
        detailFilesListEl.innerHTML = `<li style="font-size:11px;color:var(--muted);">No shared documents yet.</li>`;
      }
    }
  }

  // Scroll message thread to bottom smoothly
  function scrollThreadToBottom(smooth = false) {
    if (threadContainerEl) {
      threadContainerEl.scrollTo({
        top: threadContainerEl.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }

  // Select a conversation by ID
  function selectConversation(id) {
    activeConvId = id;
    const conv = getActiveConversation();
    if (conv && conv.unreadCount > 0) {
      conv.unreadCount = 0;
      saveConversations(conversations);
      updateUnreadCounts();
    }

    // On mobile, show thread pane
    if (chatViewportEl) {
      chatViewportEl.classList.add('viewing-thread');
    }

    renderConversationsList();
    renderMessagesThread();

    if (messageInputEl) {
      messageInputEl.focus();
    }
  }

  // Show typing indicator
  function showTypingIndicator(contactName) {
    const existing = document.getElementById('chatTypingIndicator');
    if (existing) return;

    const conv = getActiveConversation();
    const typingRow = document.createElement('div');
    typingRow.id = 'chatTypingIndicator';
    typingRow.className = 'chat-msg-row received';
    typingRow.innerHTML = `
      <div class="chat-msg-avatar ${conv ? conv.color || 'blue' : 'blue'}">${conv ? escapeHtml(conv.initials) : '...'}</div>
      <div class="chat-msg-content">
        <div class="chat-typing-indicator" title="${escapeHtml(contactName)} is typing...">
          <span class="chat-typing-dot"></span>
          <span class="chat-typing-dot"></span>
          <span class="chat-typing-dot"></span>
        </div>
      </div>
    `;

    if (chatMessagesEl) {
      chatMessagesEl.appendChild(typingRow);
      scrollThreadToBottom(true);
    }
  }

  function hideTypingIndicator() {
    const el = document.getElementById('chatTypingIndicator');
    if (el) el.remove();
  }

  // Send a message
  function sendMessage(text, attachment = null) {
    const cleanText = (text || '').trim();
    if (!cleanText && !attachment) return;

    const conv = getActiveConversation();
    if (!conv) return;

    const newMsg = {
      id: 'm_' + Date.now(),
      from: 'me',
      senderName: 'You',
      text: cleanText,
      time: formatCurrentTime(),
      attachment: attachment || null
    };

    conv.messages.push(newMsg);
    saveConversations(conversations);

    // Re-render
    renderConversationsList();
    renderMessagesThread();

    // Trigger realistic automated reply after a short delay
    simulateIncomingReply(conv);
  }

  // Simulate smart realistic incoming reply
  function simulateIncomingReply(conv) {
    if (!conv || !conv.autoReplies || conv.autoReplies.length === 0) return;

    // Pick a reply
    const replyText = conv.autoReplies.shift() || 'Got it! Thanks for the update. Let us proceed with that.';
    // Recycle replies
    conv.autoReplies.push(replyText);

    // Show typing after 700ms
    setTimeout(() => {
      // Check if user is still on this conversation
      if (activeConvId === conv.id) {
        showTypingIndicator(conv.name);
      }

      // Deliver reply after another 1300ms
      setTimeout(() => {
        hideTypingIndicator();

        const incomingMsg = {
          id: 'm_' + Date.now(),
          from: 'them',
          senderName: conv.name,
          text: replyText,
          time: formatCurrentTime()
        };

        conv.messages.push(incomingMsg);

        // If user moved to another conversation in the meantime, increase unread
        if (activeConvId !== conv.id) {
          conv.unreadCount = (conv.unreadCount || 0) + 1;
        }

        saveConversations(conversations);
        updateUnreadCounts();
        renderConversationsList();

        if (activeConvId === conv.id) {
          renderMessagesThread();
        }
      }, 1400);
    }, 700);
  }

  // Form submit handler
  if (chatFormEl) {
    chatFormEl.addEventListener('submit', function(e) {
      e.preventDefault();
      if (!messageInputEl) return;
      const val = messageInputEl.value;
      if (val.trim()) {
        sendMessage(val);
        messageInputEl.value = '';
        messageInputEl.style.height = 'auto';
      }
    });
  }

  // Auto-resize textarea and submit on Enter (without Shift)
  if (messageInputEl) {
    messageInputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatFormEl.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });

    messageInputEl.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  }

  // Filter tabs click
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter || 'all';
      renderConversationsList();
    });
  });

  // Search input
  if (searchInputEl) {
    searchInputEl.addEventListener('input', () => {
      searchQuery = searchInputEl.value.trim();
      renderConversationsList();
    });
  }

  // Back button for mobile
  if (backBtnEl) {
    backBtnEl.addEventListener('click', () => {
      if (chatViewportEl) {
        chatViewportEl.classList.remove('viewing-thread');
      }
    });
  }

  // Toggle detail drawer
  if (toggleDetailBtn && detailPaneEl) {
    toggleDetailBtn.addEventListener('click', () => {
      detailPaneEl.classList.toggle('closed');
    });
  }

  if (closeDetailBtn && detailPaneEl) {
    closeDetailBtn.addEventListener('click', () => {
      detailPaneEl.classList.add('closed');
    });
  }

  // Mark all as read
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', () => {
      conversations.forEach(c => c.unreadCount = 0);
      saveConversations(conversations);
      updateUnreadCounts();
      renderConversationsList();
    });
  }

  // Dummy attachment button
  const attachBtn = document.getElementById('chatAttachBtn');
  if (attachBtn) {
    attachBtn.addEventListener('click', () => {
      const fileName = prompt('Simulate attaching a file (Enter file name):', 'Project_Scope_Proposal.pdf');
      if (fileName && fileName.trim()) {
        sendMessage(`Here is the document: ${fileName.trim()}`, {
          name: fileName.trim(),
          size: '1.2 MB'
        });
      }
    });
  }

  // Query parameter handling (e.g. ?contact=rizky or ?project=restaurant)
  function getOrCreateProjectConversation(project) {
    const existing = conversations.find(c => c.roleType === 'dev' && c.project && c.project.id === project.id);
    if (existing) return existing;

    const contactId = project.handle.replace(/^@/, '').toLowerCase();
    const id = `project-${project.id}-${contactId}`;
    const conversation = conversations.find(c => c.id === id);
    if (conversation) return conversation;

    const newConversation = {
      id,
      contactId,
      name: project.developer,
      initials: project.initials,
      role: 'Developer',
      roleType: 'dev',
      color: 'blue',
      online: true,
      statusText: 'Active now',
      project: {
        id: project.id,
        title: project.title,
        category: project.category,
        price: project.price,
        summary: project.description,
        link: `devmatch-developer-profile.html?developer=${encodeURIComponent(project.id)}`
      },
      files: [],
      messages: [{
        id: `intro-${project.id}`,
        from: 'them',
        senderName: project.developer,
        text: `Hi! Thanks for your interest in ${project.title}. What would you like to know?`,
        time: 'Now'
      }],
      unreadCount: 0,
      quickReplies: [],
      autoReplies: []
    };

    conversations.push(newConversation);
    saveConversations(conversations);
    return newConversation;
  }

  function handleQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const contactParam = params.get('contact');
    const projectParam = params.get('project');
    const isClientRole = params.get('role') === 'client';

    if (contactParam) {
      const match = conversations.find(c => c.contactId === contactParam || c.id.includes(contactParam));
      if (match) {
        activeConvId = match.id;
      }
    } else if (projectParam) {
      let match;
      if (isClientRole) {
        const project = window.DEVMATCH_SAMPLE_PROJECTS.find(item => item.id === projectParam);
        match = project
          ? getOrCreateProjectConversation(project)
          : conversations.find(c => c.roleType === 'dev' && c.project && c.project.id === projectParam);
      } else {
        match = conversations.find(c => c.project && c.project.id === projectParam);
      }
      if (match) {
        activeConvId = match.id;
      }
    }
  }

  // Load user name into header/topbar
  function loadUserProfile() {
    try {
      const isClientRole = new URLSearchParams(window.location.search).get('role') === 'client';
      const storageKey = isClientRole ? 'devmatch-profile-client' : 'devmatch-profile-dev';
      const profile = JSON.parse(localStorage.getItem(storageKey) || '{}');
      const name = profile.displayName || (isClientRole ? 'Client' : 'Developer');
      const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'DM';
      const updateNavLabel = (link, label) => {
        const textNode = link && Array.from(link.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (textNode) textNode.textContent = ` ${label} `;
      };

      const userAvatarEl = document.getElementById('userAvatar');
      const topUserNameEl = document.getElementById('topUserName');
      if (userAvatarEl) userAvatarEl.textContent = initials;
      if (topUserNameEl) topUserNameEl.textContent = name;

      if (isClientRole) {
        const devModeLink = document.getElementById('devModeLink');
        const clientModeLink = document.getElementById('clientModeLink');
        if (devModeLink) devModeLink.classList.remove('active');
        if (clientModeLink) clientModeLink.classList.add('active');

        const workspaceBadge = document.getElementById('workspaceBadge');
        if (workspaceBadge) {
          workspaceBadge.innerHTML = `<span class="workspace-icon"><svg viewBox="0 0 24 24" style="stroke:currentColor;"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span><span><b>Client workspace</b><small>Discover &amp; hire</small></span>`;
        }

        const sideAdd = document.querySelector('.side-add');
        if (sideAdd) {
          sideAdd.href = 'devmatch-client-dashboard.html#requests';
          sideAdd.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>Post a Request`;
        }

        const overviewLink = document.querySelector('.side-nav a[href="devmatch-dashboard.html"]');
        if (overviewLink) {
          overviewLink.href = 'devmatch-client-dashboard.html';
          updateNavLabel(overviewLink, 'Home');
        }

        const projectsLink = document.querySelector('.side-nav a[href="devmatch-my-projects.html"]');
        if (projectsLink) {
          projectsLink.href = 'devmatch-client-dashboard.html#requests';
          updateNavLabel(projectsLink, 'My Requests');
        }

        const findProjectsLink = document.querySelector('.side-nav a[href="devmatch-landing.html#projects"]');
        if (findProjectsLink) {
          findProjectsLink.href = 'devmatch-client-dashboard.html#discover';
          updateNavLabel(findProjectsLink, 'Discover Projects');
        }

        const findClientsLink = document.querySelector('.side-nav a[href="devmatch-landing.html#developers"]');
        updateNavLabel(findClientsLink, 'Developers');

        const favoritesLink = document.querySelector('.side-nav a[href="devmatch-dashboard.html#projects"]');
        if (favoritesLink) {
          favoritesLink.href = 'devmatch-client-dashboard.html#projects';
        }

        const notifLink = document.querySelector('.side-nav a[href="devmatch-developer-notifications.html"]');
        if (notifLink) {
          notifLink.href = 'devmatch-notifications.html';
        }
        const topNotif = document.querySelector('.notification-button');
        if (topNotif) {
          topNotif.href = 'devmatch-notifications.html';
        }
      }
    } catch (e) {
      console.warn('Failed to load profile for chat topbar', e);
    }
  }

  // Initialize
  handleQueryParams();
  loadUserProfile();
  updateUnreadCounts();
  renderConversationsList();
  renderMessagesThread();

})();
