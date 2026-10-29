(function () {
  'use strict';

  const isClientMode = new URLSearchParams(window.location.search).get('role') === 'client'
    || document.body.classList.contains('client-shell-page')
    || document.body.dataset.workspace === 'client';

  function readStoredArray(key, fallback, legacyKey) {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
        console.warn(`Expected an array in localStorage key "${key}".`);
      } else if (legacyKey) {
        const legacy = localStorage.getItem(legacyKey);
        if (legacy !== null) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed)) return parsed;
          console.warn(`Expected an array in localStorage key "${legacyKey}".`);
        }
      }
    } catch (error) {
      console.warn(`Could not read localStorage key "${key}".`, error);
    }
    return fallback;
  }

  function getFavoriteCount() {
    const projectKey = isClientMode
      ? 'devmatch-client-project-favorites'
      : 'devmatch-developer-project-favorites';
    const secondaryKey = isClientMode
      ? 'devmatch-client-dev-favorites'
      : 'devmatch-favorite-clients';
    const projectDefaults = isClientMode ? ['restaurant', 'pos', 'booking'] : ['pos', 'inventory'];
    const secondaryDefaults = isClientMode ? ['rizky-aditya'] : ['jessica-sitorus', 'klinik-sehat-bersama'];
    const projects = readStoredArray(projectKey, projectDefaults, 'devmatch-client-favorites');
    const secondary = readStoredArray(secondaryKey, secondaryDefaults);
    return projects.length + secondary.length;
  }

  function getUnreadMessageCount() {
    try {
      const stored = localStorage.getItem('devmatch_chat_conversations_v2');
      if (stored === null) return 3;
      const conversations = JSON.parse(stored);
      if (!Array.isArray(conversations)) {
        console.warn('Expected an array in localStorage key "devmatch_chat_conversations_v2".');
        return 3;
      }
      return conversations.reduce((total, conversation) => total + (Number(conversation.unreadCount) || 0), 0);
    } catch (error) {
      console.warn('Could not read message counts from localStorage.', error);
      return 3;
    }
  }

  function getUnreadNotificationCount() {
    const readKey = isClientMode ? 'devmatch-client-notifications-read' : 'devmatch-dev-notifications-read';
    const readIds = new Set(readStoredArray(readKey, []));
    return ['jessica-comment', 'rizky-message'].filter(id => !readIds.has(id)).length;
  }

  function updateBadge(selector, count) {
    document.querySelectorAll(selector).forEach(badge => {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
  }

  function updateNavBadges() {
    updateBadge(
      '.chat-unread-total-badge, nav a[href^="devmatch-chat.html"] .nav-count, nav a[href^="devmatch-chat.html"] .client-nav-count',
      getUnreadMessageCount()
    );
    updateBadge(
      '.favorites-count-badge, nav a[href^="devmatch-favorites.html"] .nav-count, nav a[href^="devmatch-favorites.html"] .client-nav-count',
      getFavoriteCount()
    );
    updateBadge(
      '#developerNotificationCount, #clientNotificationCount, #sidebarUnreadCount, nav a[href^="devmatch-developer-notifications.html"] .nav-count, nav a[href^="devmatch-notifications.html"] .nav-count, nav a[href^="devmatch-notifications.html"] .client-nav-count',
      getUnreadNotificationCount()
    );
  }

  window.DEVMATCH_NAV_BADGES = {
    updateFavorites: function () {
      updateBadge(
        '.favorites-count-badge, nav a[href^="devmatch-favorites.html"] .nav-count, nav a[href^="devmatch-favorites.html"] .client-nav-count',
        getFavoriteCount()
      );
    }
  };
  updateNavBadges();
  window.addEventListener('storage', updateNavBadges);

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;

    const link = event.target.closest('nav a.nav-item, nav a.client-nav-item');
    if (!link || link.target || link.hasAttribute('download')) return;

    const label = link.textContent.trim().toLowerCase();
    if (label === 'home' || label === 'overview') return;

    const destination = new URL(link.href, window.location.href);
    const current = new URL(window.location.href);
    if (destination.pathname === current.pathname
      && destination.search === current.search
      && destination.hash === current.hash) {
      event.preventDefault();
    }
  });
})();
