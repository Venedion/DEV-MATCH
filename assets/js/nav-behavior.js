(function () {
  'use strict';

  const modeSwitchStorageKey = 'devmatch-mode-switch-navigation';
  const modeSwitchSelector = '.mode-switch a, .client-mode-switch a';
  const mobileNavigationBreakpoint = window.matchMedia('(max-width: 820px)');

  function getMode(link) {
    return link.textContent.trim().toLowerCase().includes('client mode')
      ? 'client'
      : 'developer';
  }

  function setModeSwitchDestinations() {
    document.querySelectorAll(modeSwitchSelector).forEach(link => {
      const destination = getMode(link) === 'client'
        ? 'devmatch-client-dashboard.html'
        : 'devmatch-dashboard.html';
      link.href = destination;
    });
  }

  setModeSwitchDestinations();

  const header = document.querySelector('header.topbar, header.client-topbar, header.profile-topbar');
  const sidebar = document.querySelector('body > .sidebar, body > .client-sidebar');
  const modeSwitch = document.querySelector('.mode-switch, .client-mode-switch');
  const mobileMenuButton = document.createElement('button');
  const mobileNavigationBackdrop = document.createElement('button');

  function setMobileNavigationOpen(isOpen) {
    document.body.classList.toggle('mobile-navigation-open', isOpen);
    mobileMenuButton.setAttribute('aria-expanded', String(isOpen));
    mobileMenuButton.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
  }

  function setMobileModeMenuOpen(isOpen) {
    if (!modeSwitch) return;
    modeSwitch.classList.toggle('mobile-mode-open', isOpen);
    modeSwitch.querySelectorAll('a').forEach(link => {
      link.setAttribute('aria-expanded', String(isOpen && link.classList.contains('active')));
    });
  }

  if (header && sidebar) {
    sidebar.id ||= 'mobileNavigation';
    mobileMenuButton.className = 'mobile-menu-toggle';
    mobileMenuButton.type = 'button';
    mobileMenuButton.setAttribute('aria-label', 'Open navigation');
    mobileMenuButton.setAttribute('aria-controls', sidebar.id);
    mobileMenuButton.setAttribute('aria-expanded', 'false');
    mobileMenuButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    header.insertBefore(mobileMenuButton, header.firstElementChild);

    mobileNavigationBackdrop.className = 'mobile-navigation-backdrop';
    mobileNavigationBackdrop.type = 'button';
    mobileNavigationBackdrop.setAttribute('aria-label', 'Close navigation');
    mobileNavigationBackdrop.tabIndex = -1;
    document.body.appendChild(mobileNavigationBackdrop);
  }

  const activeModeLink = document.querySelector(
    '.mode-switch a.active, .client-mode-switch a.active'
  );
  const isClientMode = activeModeLink
    ? getMode(activeModeLink) === 'client'
    : (
      new URLSearchParams(window.location.search).get('role') === 'client'
      || document.body.classList.contains('client-shell-page')
      || document.body.dataset.workspace === 'client'
    );

  function getWorkspaceProfile(workspace) {
    const storageKey = `devmatch-profile-${workspace}`;

    try {
      const storedProfile = localStorage.getItem(storageKey);
      if (storedProfile === null) return {};

      const profile = JSON.parse(storedProfile);
      if (profile && typeof profile === 'object' && !Array.isArray(profile)) {
        return profile;
      }

      console.warn(`Expected an object in localStorage key "${storageKey}".`);
    } catch (error) {
      console.warn(`Could not read profile from localStorage key "${storageKey}".`, error);
    }

    return {};
  }

  function updateHeaderProfile() {
    const workspace = isClientMode ? 'client' : 'dev';
    const role = isClientMode ? 'Client' : 'Developer';
    const fallbackName = isClientMode ? 'Client User' : 'Rizky Aditya';
    const profile = getWorkspaceProfile(workspace);
    const displayName = typeof profile.displayName === 'string'
      ? profile.displayName.trim() || fallbackName
      : fallbackName;
    const initials = displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
    const header = document.querySelector('header');
    const userLink = header?.querySelector('.user-menu, .client-user, .user-link');

    if (!userLink) return;

    const nameElement = userLink.querySelector('b');
    const roleElement = userLink.querySelector('small');
    const avatarElement = userLink.querySelector('.user-avatar, .client-avatar');

    if (nameElement) nameElement.textContent = displayName;
    if (roleElement) roleElement.textContent = role;
    if (avatarElement) avatarElement.textContent = initials || (isClientMode ? 'CU' : 'RA');
    userLink.href = `devmatch-my-profile.html?role=${workspace}`;
  }

  updateHeaderProfile();

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

  function updateHeaderNotificationDot(unreadCount) {
    const notificationLink = document.querySelector(
      'header .notification-button, header .client-icon-button'
    );
    if (!notificationLink) return;

    let dot = notificationLink.querySelector('i');
    if (!dot) {
      dot = document.createElement('i');
      dot.setAttribute('aria-hidden', 'true');
      notificationLink.appendChild(dot);
    }

    dot.hidden = unreadCount === 0;
  }

  function updateLinkBadge(selector, type, count) {
    document.querySelectorAll(selector).forEach(link => {
      let badge = link.querySelector('.nav-count, .client-nav-count, .client-notification-count');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = link.classList.contains('client-nav-item') ? 'client-nav-count' : 'nav-count';
        link.appendChild(badge);
      }

      badge.classList.remove('nav-count-message', 'nav-count-favorites', 'nav-count-notifications');
      badge.classList.add(`nav-count-${type}`);
      badge.style.removeProperty('background');
      badge.style.removeProperty('color');
      badge.textContent = String(count);
      badge.hidden = count === 0;
      badge.style.display = count === 0 ? 'none' : '';
    });
  }

  function updateNavBadges() {
    const unreadNotificationCount = getUnreadNotificationCount();
    updateLinkBadge('nav a[href^="devmatch-chat.html"]', 'message', getUnreadMessageCount());
    updateLinkBadge('nav a[href^="devmatch-favorites.html"]', 'favorites', getFavoriteCount());
    updateLinkBadge(
      'nav a[href^="devmatch-developer-notifications.html"], nav a[href^="devmatch-notifications.html"]',
      'notifications',
      unreadNotificationCount
    );
    updateHeaderNotificationDot(unreadNotificationCount);
  }

  window.DEVMATCH_NAV_BADGES = {
    updateFavorites: function () {
      updateLinkBadge('nav a[href^="devmatch-favorites.html"]', 'favorites', getFavoriteCount());
    }
  };
  updateNavBadges();
  window.addEventListener('storage', updateNavBadges);

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;

    if (event.target.closest('.mobile-menu-toggle')) {
      setMobileNavigationOpen(!document.body.classList.contains('mobile-navigation-open'));
      return;
    }

    if (event.target.closest('.mobile-navigation-backdrop')) {
      setMobileNavigationOpen(false);
      return;
    }

    const modeLink = event.target.closest(modeSwitchSelector);
    if (modeLink && mobileNavigationBreakpoint.matches && modeLink.classList.contains('active')) {
      event.preventDefault();
      setMobileModeMenuOpen(!modeSwitch.classList.contains('mobile-mode-open'));
      return;
    }

    if (modeLink && !modeLink.classList.contains('active') && !modeLink.target) {
      setMobileModeMenuOpen(false);
      const activeLink = modeLink.parentElement.querySelector('.active');
      if (activeLink) {
        try {
          sessionStorage.setItem(
            modeSwitchStorageKey,
            `${getMode(activeLink)}:${Date.now()}`
          );
        } catch (error) {
          console.warn('Could not save the previous workspace mode.', error);
        }
      }
    }

    const link = event.target.closest('nav a.nav-item, nav a.client-nav-item');
    if (!link || link.target || link.hasAttribute('download')) return;
    setMobileNavigationOpen(false);

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

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    setMobileNavigationOpen(false);
    setMobileModeMenuOpen(false);
  });
})();
