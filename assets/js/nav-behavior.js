(function () {
  'use strict';

  const modeSwitchStorageKey = 'devmatch-mode-switch-navigation';
  const accountReturnStorageKey = 'devmatch-account-dropdown-return';
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
  const mobileSearchBreakpoint = window.matchMedia('(max-width: 600px)');
  const mobileSearchField = header?.querySelector('.search, .client-search, .top-search');
  let mobileSearchToggle;
  const mobileMenuButton = document.createElement('button');
  const mobileNavigationBackdrop = document.createElement('button');

  function setMobileSearchOpen(isOpen, focusInput = false) {
    if (!header || !mobileSearchField || !mobileSearchToggle) return;
    header.classList.toggle('mobile-header-search-open', isOpen);
    mobileSearchToggle.setAttribute('aria-expanded', String(isOpen));
    mobileSearchToggle.setAttribute('aria-label', isOpen ? 'Close search' : 'Open search');
    if (isOpen && focusInput) mobileSearchField.querySelector('input')?.focus();
    else if (!isOpen) mobileSearchField.querySelector('input')?.blur();
  }

  if (header && mobileSearchField) {
    mobileSearchField.classList.add('mobile-header-search');
    const searchInput = mobileSearchField.querySelector('input');
    if (searchInput) {
      if (!searchInput.id) searchInput.id = 'mobileHeaderSearchInput';
      mobileSearchToggle = document.createElement('button');
      mobileSearchToggle.className = 'mobile-search-toggle';
      mobileSearchToggle.type = 'button';
      mobileSearchToggle.setAttribute('aria-label', 'Open search');
      mobileSearchToggle.setAttribute('aria-controls', searchInput.id);
      mobileSearchToggle.setAttribute('aria-expanded', 'false');
      mobileSearchToggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>';
      header.insertBefore(mobileSearchToggle, mobileSearchField);
    }
  }

  mobileSearchBreakpoint.addEventListener('change', event => {
    if (!event.matches) setMobileSearchOpen(false);
  });

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

  const headerUserLink = header?.querySelector('.user-menu, .client-user, .user-link');
  let headerAccountDropdown;
  let headerAccountDropdownCloseTimer;
  const modeSwitchHome = modeSwitch?.parentElement;
  const modeSwitchNextSibling = modeSwitch?.nextSibling;
  const originalModeLinkMarkup = modeSwitch
    ? [...modeSwitch.querySelectorAll('a')].map(link => ({
      link,
      innerHTML: link.innerHTML,
      ariaLabel: link.getAttribute('aria-label')
    }))
    : [];

  function prepareMobileAccountModeSwitch() {
    if (!modeSwitch || !headerAccountDropdown || !mobileSearchBreakpoint.matches) return;
    const targetLink = [...modeSwitch.querySelectorAll('a')]
      .find(link => !link.classList.contains('active'));
    if (!targetLink) return;

    const targetMode = getMode(targetLink);
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<path d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4m14 4H3"/>';

    const label = document.createElement('span');
    label.className = 'mobile-account-mode-label';
    label.textContent = `Switch to ${targetMode} mode`;

    modeSwitch.querySelectorAll('a').forEach(link => {
      link.classList.toggle('mobile-account-mode-action', link === targetLink);
      if (link === targetLink) {
        link.replaceChildren(icon, label);
        link.setAttribute('aria-label', `Switch to ${targetMode} mode`);
      }
    });
    modeSwitch.classList.remove('mobile-mode-open');
    modeSwitch.querySelectorAll('a').forEach(link => link.setAttribute('aria-expanded', 'false'));
    headerAccountDropdown.appendChild(modeSwitch);
  }

  function restoreModeSwitchPosition() {
    if (!modeSwitch || !modeSwitchHome) return;
    originalModeLinkMarkup.forEach(({link, innerHTML, ariaLabel}) => {
      link.innerHTML = innerHTML;
      if (ariaLabel === null) link.removeAttribute('aria-label');
      else link.setAttribute('aria-label', ariaLabel);
      link.classList.remove('mobile-account-mode-action');
    });
    if (modeSwitch.parentElement === modeSwitchHome) return;
    const nextSibling = modeSwitchNextSibling?.parentNode === modeSwitchHome
      ? modeSwitchNextSibling
      : null;
    modeSwitchHome.insertBefore(modeSwitch, nextSibling);
    setMobileModeMenuOpen(false);
  }

  function setHeaderAccountDropdownOpen(isOpen) {
    if (!headerAccountDropdown || !headerUserLink) return;
    window.clearTimeout(headerAccountDropdownCloseTimer);
    headerUserLink.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) {
      headerAccountDropdown.hidden = false;
      requestAnimationFrame(() => {
        if (headerUserLink.getAttribute('aria-expanded') === 'true') {
          headerAccountDropdown.classList.add('is-open');
        }
      });
    } else {
      headerAccountDropdown.classList.remove('is-open');
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        headerAccountDropdown.hidden = true;
      } else {
        headerAccountDropdownCloseTimer = window.setTimeout(() => {
          headerAccountDropdown.hidden = true;
        }, 180);
      }
    }
    if (mobileSearchBreakpoint.matches && modeSwitch) {
      const identity = headerAccountDropdown.querySelector('.header-account-identity');
      if (identity?.nextSibling !== modeSwitch) {
        headerAccountDropdown.insertBefore(modeSwitch, identity?.nextSibling || null);
      }
    } else {
      restoreModeSwitchPosition();
    }
  }

  mobileSearchBreakpoint.addEventListener('change', event => {
    if (event.matches) {
      if (headerAccountDropdown && !headerAccountDropdown.hidden) updateHeaderAccountOptions();
      else prepareMobileAccountModeSwitch();
    } else {
      restoreModeSwitchPosition();
    }
  });

  function updateHeaderAccountOptions() {
    if (!headerAccountDropdown) return;

    const accountNavigation = document.querySelector(
      'aside nav[aria-label="Account navigation"], aside nav[aria-label="Navigasi akun"]'
    );
    if (!accountNavigation) {
      console.warn('Could not find the account navigation for the header profile menu.');
      return;
    }

    const options = Array.from(accountNavigation.querySelectorAll('a'))
      .filter(link => ['profile', 'settings'].includes(link.textContent.trim().toLowerCase()));
    if (options.length === 0) {
      console.warn('Could not find Profile and Settings links in the account navigation.');
      return false;
    }

    headerAccountDropdown.replaceChildren();

    const identity = document.createElement('div');
    const avatar = headerUserLink.querySelector('.user-avatar, .client-avatar');
    const displayName = headerUserLink.querySelector('b')?.textContent.trim();
    const role = headerUserLink.querySelector('small')?.textContent.trim();
    identity.className = 'header-account-identity';
    if (avatar) identity.appendChild(avatar.cloneNode(true));

    const identityCopy = document.createElement('span');
    identityCopy.className = 'header-account-identity-copy';
    const identityName = document.createElement('b');
    identityName.textContent = displayName || 'Account';
    identityCopy.appendChild(identityName);
    if (role) {
      const identityRole = document.createElement('small');
      identityRole.textContent = role;
      identityCopy.appendChild(identityRole);
    }
    identity.appendChild(identityCopy);
    headerAccountDropdown.appendChild(identity);
    if (mobileSearchBreakpoint.matches) prepareMobileAccountModeSwitch();

    options.forEach(option => {
      const menuLink = document.createElement('a');
      const icon = option.querySelector('svg');
      const label = option.textContent.trim();
      menuLink.className = 'header-account-option';
      menuLink.href = option.href;
      if (icon) {
        const menuIcon = icon.cloneNode(true);
        menuIcon.setAttribute('aria-hidden', 'true');
        menuLink.appendChild(menuIcon);
      }

      const menuLabel = document.createElement('span');
      menuLabel.textContent = label;
      menuLink.appendChild(menuLabel);
      headerAccountDropdown.appendChild(menuLink);
    });

    const activeModeLink = document.querySelector(
      '.mode-switch a.active, .client-mode-switch a.active'
    );
    const logoutLink = document.createElement('a');
    const logoutIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    logoutIcon.setAttribute('viewBox', '0 0 24 24');
    logoutIcon.setAttribute('aria-hidden', 'true');
    logoutIcon.innerHTML = '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7v18h-7"/>';
    logoutLink.className = 'header-account-option header-account-logout';
    logoutLink.href = `devmatch-auth.html?mode=login&role=${activeModeLink && getMode(activeModeLink) === 'client' ? 'client' : 'dev'}`;
    logoutLink.appendChild(logoutIcon);

    const logoutLabel = document.createElement('span');
    logoutLabel.textContent = 'Log out';
    logoutLink.appendChild(logoutLabel);
    headerAccountDropdown.appendChild(logoutLink);
    return true;
  }

  if (header && headerUserLink) {
    headerAccountDropdown = document.createElement('div');
    headerAccountDropdown.className = 'header-account-dropdown';
    headerAccountDropdown.id = 'headerAccountDropdown';
    headerAccountDropdown.setAttribute('aria-label', 'Account options');
    headerAccountDropdown.hidden = true;
    header.appendChild(headerAccountDropdown);
    headerUserLink.setAttribute('aria-haspopup', 'menu');
    headerUserLink.setAttribute('aria-controls', headerAccountDropdown.id);
    headerUserLink.setAttribute('aria-expanded', 'false');
  }
  if (mobileSearchBreakpoint.matches) prepareMobileAccountModeSwitch();

  function getAccountReturnUrl() {
    try {
      const storedState = sessionStorage.getItem(accountReturnStorageKey);
      if (!storedState) return null;

      const state = JSON.parse(storedState);
      if (typeof state.from !== 'string' || typeof state.to !== 'string') {
        sessionStorage.removeItem(accountReturnStorageKey);
        return null;
      }

      const returnUrl = new URL(state.from, window.location.href);
      const targetUrl = new URL(state.to, window.location.href);
      const currentUrl = new URL(window.location.href);
      const isCurrentTarget = targetUrl.pathname === currentUrl.pathname
        && targetUrl.search === currentUrl.search
        && (!targetUrl.hash || targetUrl.hash === currentUrl.hash);

      if (returnUrl.origin !== currentUrl.origin || !isCurrentTarget || returnUrl.href === currentUrl.href) {
        sessionStorage.removeItem(accountReturnStorageKey);
        return null;
      }

      return returnUrl.href;
    } catch (error) {
      console.warn('Could not read the previous page for the account back button.', error);
      return null;
    }
  }

  function saveAccountReturnDestination(destination) {
    const currentUrl = new URL(window.location.href);
    let returnUrl = currentUrl;

    try {
      const storedState = sessionStorage.getItem(accountReturnStorageKey);
      if (storedState) {
        const state = JSON.parse(storedState);
        if (typeof state.from === 'string' && typeof state.to === 'string') {
          const previousTarget = new URL(state.to, currentUrl);
          const previousReturn = new URL(state.from, currentUrl);
          const isOnPreviousTarget = previousTarget.pathname === currentUrl.pathname
            && previousTarget.search === currentUrl.search
            && (!previousTarget.hash || previousTarget.hash === currentUrl.hash);

          if (previousReturn.origin === currentUrl.origin && isOnPreviousTarget) {
            returnUrl = previousReturn;
          }
        }
      }

      sessionStorage.setItem(accountReturnStorageKey, JSON.stringify({
        from: returnUrl.href,
        to: destination
      }));
    } catch (error) {
      console.warn('Could not save the previous page for the account back button.', error);
    }
  }

  const accountReturnUrl = getAccountReturnUrl();
  let accountReturnButton;
  const accountPageHeading = document.querySelector(
    'main.settings-page .settings-header, main.profile-page .profile-page-heading > div'
  );
  if (accountReturnUrl && accountPageHeading) {
    accountReturnButton = document.createElement('button');
    accountReturnButton.className = 'account-return-button';
    accountReturnButton.type = 'button';
    accountReturnButton.setAttribute('aria-label', 'Back to previous page');
    accountReturnButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span>Back</span>';
    accountPageHeading.insertBefore(accountReturnButton, accountPageHeading.firstElementChild);
    document.body.classList.add('account-return-enabled');
  }

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

    if (header?.classList.contains('mobile-header-search-open')
      && !event.target.closest('.mobile-header-search, .mobile-search-toggle')) {
      setMobileSearchOpen(false);
    }

    if (accountReturnButton && event.target.closest('.account-return-button')) {
      event.preventDefault();
      try {
        sessionStorage.removeItem(accountReturnStorageKey);
      } catch (error) {
        console.warn('Could not clear the account back-button destination.', error);
      }
      setMobileNavigationOpen(false);
      window.location.assign(accountReturnUrl);
      return;
    }

    const userLink = event.target.closest('header .user-menu, header .client-user, header .user-link');
    if (userLink && userLink === headerUserLink) {
      event.preventDefault();
      const isOpen = headerAccountDropdown && !headerAccountDropdown.hidden;
      const hasOptions = isOpen || updateHeaderAccountOptions();
      setHeaderAccountDropdownOpen(!isOpen && hasOptions);
      return;
    }

    if (headerAccountDropdown && !headerAccountDropdown.hidden) {
      if (headerAccountDropdown.contains(event.target)) {
        const accountModeLink = event.target.closest(modeSwitchSelector);
        if (accountModeLink && accountModeLink.closest('.header-account-dropdown')) {
          const isActiveMode = accountModeLink.classList.contains('active');
          setHeaderAccountDropdownOpen(false);
          if (isActiveMode) {
            event.preventDefault();
            return;
          }
        } else {
          const accountOption = event.target.closest('a.header-account-option');
          if (accountOption?.classList.contains('header-account-logout')) {
            try {
              sessionStorage.removeItem(accountReturnStorageKey);
            } catch (error) {
              console.warn('Could not clear the account back-button destination.', error);
            }
          } else if (accountOption) {
            saveAccountReturnDestination(accountOption.href);
          }
          setHeaderAccountDropdownOpen(false);
          return;
        }
      }
      if (!headerAccountDropdown.contains(event.target)) setHeaderAccountDropdownOpen(false);
    }

    if (event.target.closest('.mobile-menu-toggle')) {
      setMobileNavigationOpen(!document.body.classList.contains('mobile-navigation-open'));
      return;
    }

    if (event.target.closest('.mobile-search-toggle')) {
      setMobileSearchOpen(!header?.classList.contains('mobile-header-search-open'), true);
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
    if (event.key === 'Escape' && header?.classList.contains('mobile-header-search-open')) {
      setMobileSearchOpen(false);
      mobileSearchToggle?.focus();
    }
    if (event.key !== 'Escape') return;
    setMobileNavigationOpen(false);
    setMobileModeMenuOpen(false);
    if (headerAccountDropdown && !headerAccountDropdown.hidden) {
      setHeaderAccountDropdownOpen(false);
      headerUserLink?.focus();
    }
  });
})();
