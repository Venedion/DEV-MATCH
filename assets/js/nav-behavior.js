(function () {
  'use strict';

  const modeSwitchStorageKey = 'devmatch-mode-switch-navigation';
  const accountReturnStorageKey = 'devmatch-account-dropdown-return';
  const mobileChatReturnUrlStorageKey = 'devmatch-mobile-chat-return-url';
  let mobileChatHasStoredOrigin = false;
  const modeSwitchSelector = '.mode-switch a, .client-mode-switch a';
  const mobileNavigationBreakpoint = window.matchMedia('(max-width: 820px)');
  const favoritesTabs = document.querySelector('.favorites-page-layout .fav-tabs');
  const exploreSwitch = document.querySelector(
    '.find-projects-page .find-projects-switch, .find-clients-main .clients-tabs-toggle'
  ) || favoritesTabs;
  const isFavoritesTabSwitch = exploreSwitch === favoritesTabs;
  const explorePageHeader = exploreSwitch?.closest('header') || exploreSwitch?.closest('.favorites-page');
  const exploreScrollContainer = exploreSwitch?.closest('main');
  const exploreFilterActions = document.querySelector(
    '.find-projects-page .mobile-market-sticky-actions, .find-clients-main .mobile-clients-actions'
  );
  const exploreSwitchBreakpoint = window.matchMedia(
    isFavoritesTabSwitch ? '(max-width: 820px)' : '(max-width: 860px)'
  );

  if (exploreSwitch && explorePageHeader && exploreScrollContainer) {
    const exploreSwitchPlaceholder = document.createComment('explore switch placement');
    exploreSwitch.before(exploreSwitchPlaceholder);
    let previousScrollTop = exploreScrollContainer.scrollTop;
    let scrollDirection = 0;
    let accumulatedScroll = 0;

    function setExploreSwitchHidden(isHidden) {
      exploreSwitch.classList.toggle('scroll-aware-switch-hidden', isHidden);
      exploreFilterActions?.classList.toggle('switch-hidden', isHidden);
    }

    function syncExploreSwitchBreakpoint() {
      if (exploreSwitchBreakpoint.matches) {
        if (exploreSwitch.parentElement !== exploreScrollContainer) {
          exploreScrollContainer.insertBefore(exploreSwitch, explorePageHeader);
        }
        exploreSwitch.classList.add('scroll-aware-switch');
        setExploreSwitchHidden(false);
      } else {
        if (exploreSwitch.parentElement !== explorePageHeader) {
          exploreSwitchPlaceholder.parentNode?.insertBefore(
            exploreSwitch,
            exploreSwitchPlaceholder.nextSibling
          );
        }
        exploreSwitch.classList.remove('scroll-aware-switch', 'scroll-aware-switch-hidden');
        exploreFilterActions?.classList.remove('switch-hidden');
      }
      previousScrollTop = exploreScrollContainer.scrollTop;
      scrollDirection = 0;
      accumulatedScroll = 0;
    }

    exploreScrollContainer.addEventListener('scroll', () => {
      if (!exploreSwitchBreakpoint.matches) return;

      const currentScrollTop = exploreScrollContainer.scrollTop;
      const delta = currentScrollTop - previousScrollTop;
      previousScrollTop = currentScrollTop;

      if (currentScrollTop <= 24) {
        setExploreSwitchHidden(false);
        scrollDirection = 0;
        accumulatedScroll = 0;
        return;
      }

      if (
        exploreSwitch.contains(document.activeElement) &&
        (!isFavoritesTabSwitch || document.activeElement.matches(':focus-visible'))
      ) {
        setExploreSwitchHidden(false);
        scrollDirection = 0;
        accumulatedScroll = 0;
        return;
      }

      const nextDirection = Math.sign(delta);
      if (!nextDirection) return;
      if (nextDirection !== scrollDirection) {
        scrollDirection = nextDirection;
        accumulatedScroll = 0;
      }
      accumulatedScroll += Math.abs(delta);

      if (accumulatedScroll < 8) return;
      setExploreSwitchHidden(nextDirection > 0);
      accumulatedScroll = 0;
    }, { passive: true });

    exploreSwitchBreakpoint.addEventListener('change', syncExploreSwitchBreakpoint);
    syncExploreSwitchBreakpoint();
  }

  function getMode(link) {
    if (link.dataset.workspaceMode) return link.dataset.workspaceMode;
    return link.textContent.trim().toLowerCase().includes('client mode')
      ? 'client'
      : 'developer';
  }

  function setModeSwitchDestinations(activeMode) {
    const returnToMobileProfile = isMobileMyProfilePage && mobileSearchBreakpoint.matches;
    document.querySelectorAll(modeSwitchSelector).forEach(link => {
      const linkMode = getMode(link);
      link.dataset.workspaceMode = linkMode;
      link.href = linkMode === activeMode
        ? (linkMode === 'client' ? 'devmatch-client-dashboard.html' : 'devmatch-dashboard.html')
        : returnToMobileProfile
          ? `devmatch-my-profile.html?role=${linkMode === 'client' ? 'client' : 'dev'}`
          : `devmatch-auth.html?mode=register&role=${linkMode === 'client' ? 'client' : 'dev'}`;
    });
  }

  let switchingWorkspace = false;
  async function animateMobileModeSwitchExit(link) {
    const arrows = [...link.querySelectorAll('.mobile-mode-arrow')];
    if (!arrows.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    document.documentElement.classList.remove('mobile-mode-switch-arrow-arrival');
    link.classList.add('mobile-mode-switch-leaving');
    await Promise.all(arrows.map(arrow => {
      const animationName = arrow.classList.contains('mobile-mode-arrow--top')
        ? 'mobile-profile-arrow-hide-right-to-left'
        : 'mobile-profile-arrow-hide-left-to-right';
      return new Promise(resolve => {
        const onAnimationEnd = event => {
          if (event.animationName !== animationName) return;
          arrow.removeEventListener('animationend', onAnimationEnd);
          resolve();
        };
        arrow.addEventListener('animationend', onAnimationEnd);
      });
    }));
  }

  function clearMobileModeSwitchArrival(icon) {
    if (!document.documentElement.classList.contains('mobile-mode-switch-arrow-arrival')) return;

    const arrows = [...icon.querySelectorAll('.mobile-mode-arrow')];
    let remainingAnimations = arrows.length;
    arrows.forEach(arrow => {
      const animationName = arrow.classList.contains('mobile-mode-arrow--top')
        ? 'mobile-profile-arrow-show-left-to-right'
        : 'mobile-profile-arrow-show-right-to-left';
      const onAnimationEnd = event => {
        if (event.animationName !== animationName) return;
        arrow.removeEventListener('animationend', onAnimationEnd);
        remainingAnimations -= 1;
        if (remainingAnimations === 0) {
          document.documentElement.classList.remove('mobile-mode-switch-arrow-arrival');
        }
      };
      arrow.addEventListener('animationend', onAnimationEnd);
    });
  }

  async function switchAccountWorkspace(role, returnToProfile = false, modeLink = null) {
    const backend = window.devMatchBackend;
    const user = await backend.ready;
    if (!user) throw new Error('Please log in first.');
    const exists = await backend.hasWorkspace(role);
    let create = false;
    if (!exists) {
      const choice = await chooseWorkspace(role);
      if (!choice) return;
      if (choice === 'new') {
        sessionStorage.setItem('devmatch-separate-account-email', user.email || '');
        const result = await backend.client.auth.signOut({scope: 'local'});
        if (result.error) throw result.error;
        backend.clearCache();
        location.assign(`devmatch-auth.html?mode=register&role=${role}`);
        return;
      }
      create = true;
    }
    if (returnToProfile && modeLink) await animateMobileModeSwitchExit(modeLink);
    const profile = await backend.switchWorkspace(role, create);
    location.assign(returnToProfile
      ? `devmatch-my-profile.html?role=${role}`
      : backend.destination(profile, user));
  }

  function chooseWorkspace(role) {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.setAttribute('aria-labelledby', 'workspace-choice-title');
      dialog.className = 'workspace-choice';
      dialog.style.cssText = 'border:1px solid #ddd;border-radius:18px;padding:28px;max-width:420px;width:calc(100% - 32px);font:inherit;color:#171717';
      const name = role === 'dev' ? 'developer' : 'client';
      dialog.innerHTML = `<h2 id="workspace-choice-title">Switch to ${name} mode</h2><p>Use the same username, email, phone number, and password. Your ${name} profile, messages, favorites, and notifications stay separate.</p><button type="button" data-choice="connect">Connect with current account</button> <button type="button" data-choice="new">Create a new ${name} account</button><p>A new account uses a different email and password.</p><button type="button" data-choice="cancel">Cancel</button>`;
      document.body.append(dialog);
      let finished = false;
      const finish = value => { if (finished) return; finished = true; dialog.close(); dialog.remove(); resolve(value); };
      dialog.addEventListener('click', event => { const button = event.target.closest('[data-choice]'); if (button) finish(button.dataset.choice === 'cancel' ? null : button.dataset.choice); });
      dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
      dialog.showModal();
    });
  }

  const header = document.querySelector('header.topbar, header.client-topbar, header.profile-topbar');
  const isMobileMyProfilePage = document.body.matches('.my-profile-page:not(.client-profile-public)');
  if (document.body.classList.contains('chat-body')) {
    const chatBackLink = document.getElementById('mobileChatBack');
    if (chatBackLink) {
      const role = new URLSearchParams(location.search).get('role') || 'dev';
      const referrer = document.referrer ? new URL(document.referrer, location.href) : null;
      const previousIsChat = referrer?.pathname.endsWith('/devmatch-chat.html');
      let storedReturnUrl = null;
      try {
        const storedUrl = sessionStorage.getItem(mobileChatReturnUrlStorageKey);
        if (storedUrl) {
          const previous = new URL(storedUrl, location.href);
          if (previous.origin === location.origin && !previous.pathname.endsWith('/devmatch-chat.html')) {
            storedReturnUrl = `${previous.pathname}${previous.search}${previous.hash}`;
          }
        }
      } catch (error) {
        console.warn('Unable to read the previous mobile page for chat navigation.', error);
      }

      if (storedReturnUrl) {
        mobileChatHasStoredOrigin = true;
        chatBackLink.href = storedReturnUrl;
      } else if (referrer && referrer.origin === location.origin && !previousIsChat) {
        chatBackLink.href = `${referrer.pathname}${referrer.search}${referrer.hash}`;
      } else {
        chatBackLink.href = role === 'client'
          ? 'devmatch-discover-projects.html'
          : 'devmatch-find-projects.html';
      }
    } else {
      try {
        sessionStorage.removeItem(mobileChatReturnUrlStorageKey);
      } catch (error) {
        console.warn('Unable to clear a stale mobile chat return destination.', error);
      }
    }
  } else {
    try {
      sessionStorage.removeItem(mobileChatReturnUrlStorageKey);
    } catch (error) {
      console.warn('Unable to clear a stale mobile chat return destination.', error);
    }
  }
  const sidebar = document.querySelector('body > .sidebar, body > .client-sidebar');
  const modeSwitch = document.querySelector('.mode-switch, .client-mode-switch');
  const mobileSearchBreakpoint = window.matchMedia('(max-width: 820px)');
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
    if (!document.querySelector('.mobile-bottom-nav')) {
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
  }

  let activeModeLink = document.querySelector(
    '.mode-switch a.active, .client-mode-switch a.active'
  );
  const requestedRole = new URLSearchParams(window.location.search).get('role');
  let isClientMode = requestedRole === 'client'
    ? true
    : requestedRole === 'dev'
      ? false
      : activeModeLink
        ? getMode(activeModeLink) === 'client'
        : (
          document.body.classList.contains('client-shell-page')
          || document.body.dataset.workspace === 'client'
        );

  if (requestedRole === 'client' || requestedRole === 'dev') {
    const activeMode = isClientMode ? 'client' : 'developer';
    document.querySelectorAll(modeSwitchSelector).forEach(link => {
      link.classList.toggle('active', getMode(link) === activeMode);
    });
    activeModeLink = document.querySelector(
      '.mode-switch a.active, .client-mode-switch a.active'
    );
  }

  setModeSwitchDestinations(isClientMode ? 'client' : 'developer');

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
    const fallbackName = 'Account';
    const profile = getWorkspaceProfile(workspace);
    const displayName = profile.username?.trim() || (typeof profile.displayName === 'string'
      ? profile.displayName.trim() || fallbackName
      : fallbackName);
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

  function isMobileProfileModeSwitching() {
    return isMobileMyProfilePage && mobileSearchBreakpoint.matches && switchingWorkspace;
  }

  async function syncWorkspaceModeWithAccount() {
    const backend = window.devMatchBackend;
    if (!backend || isMobileProfileModeSwitching()) return;
    const user = await backend.ready;
    if (!user || isMobileProfileModeSwitching()) return;
    const profile = await backend.loadProfile(user);
    if (isMobileProfileModeSwitching()) return;
    if (!['client', 'dev'].includes(profile.account_role)) {
      throw new Error('The account has no supported workspace role.');
    }

    backend.cache(profile,user);
    isClientMode = profile.account_role === 'client';
    const activeMode = isClientMode ? 'client' : 'developer';
    document.querySelectorAll(modeSwitchSelector).forEach(link => {
      const active = getMode(link) === activeMode;
      link.classList.toggle('active', active);
      link.hidden = false;
      link.style.display = '';
    });
    setModeSwitchDestinations(activeMode);
    activeModeLink = document.querySelector(
      '.mode-switch a.active, .client-mode-switch a.active'
    );
    updateHeaderProfile();
    if (isMobileMyProfilePage && mobileSearchBreakpoint.matches) {
      prepareMobileAccountModeSwitch();
    }
    window.DEVMATCH_SIDEBAR_NAVIGATION?.setWorkspace(isClientMode ? 'client' : 'developer');
    updateNavBadges();
  }

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
      .find(link => !link.hidden && !link.classList.contains('active'));
    if (!targetLink) return;

    if (modeSwitch.querySelector('a.mobile-account-mode-action') !== targetLink) {
      originalModeLinkMarkup.forEach(({link, innerHTML, ariaLabel}) => {
        if (link === targetLink) return;
        link.innerHTML = innerHTML;
        if (ariaLabel === null) link.removeAttribute('aria-label');
        else link.setAttribute('aria-label', ariaLabel);
        link.classList.remove('mobile-account-mode-action');
      });

      const targetMode = getMode(targetLink);
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      icon.classList.add('mobile-mode-switch-icon');
      icon.innerHTML = '<g class="mobile-mode-arrow mobile-mode-arrow--top"><path d="M3 7h18M17 3l4 4-4 4"/></g><g class="mobile-mode-arrow mobile-mode-arrow--bottom"><path d="M21 17H3M7 13l-4 4 4 4"/></g>';

      const label = document.createElement('span');
      label.className = 'mobile-account-mode-label';
      label.textContent = `Switch to ${targetMode} mode`;

      targetLink.replaceChildren(icon, label);
      targetLink.setAttribute('aria-label', `Switch to ${targetMode} mode`);
      if (isMobileMyProfilePage) clearMobileModeSwitchArrival(icon);
    }

    modeSwitch.querySelectorAll('a').forEach(link => {
      link.classList.toggle('mobile-account-mode-action', link === targetLink);
      link.setAttribute('aria-expanded', 'false');
    });
    modeSwitch.classList.remove('mobile-mode-open');
    if (isMobileMyProfilePage) {
      modeSwitch.classList.add('mobile-profile-header-mode-switch');
      if (modeSwitch.parentElement !== header) header.appendChild(modeSwitch);
    } else {
      modeSwitch.classList.remove('mobile-profile-header-mode-switch');
      if (modeSwitch.parentElement !== headerAccountDropdown) {
        headerAccountDropdown.appendChild(modeSwitch);
      }
    }
  }

  function restoreModeSwitchPosition() {
    if (!modeSwitch || !modeSwitchHome) return;
    modeSwitch.classList.remove('mobile-profile-header-mode-switch');
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
      if (!isMobileMyProfilePage && identity?.nextSibling !== modeSwitch) {
        headerAccountDropdown.insertBefore(modeSwitch, identity?.nextSibling || null);
      }
    } else {
      restoreModeSwitchPosition();
    }
  }

  mobileSearchBreakpoint.addEventListener('change', event => {
    setModeSwitchDestinations(isClientMode ? 'client' : 'developer');
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

  async function updateFavoriteBadges() {
    const backend = window.devMatchBackend;
    if (!backend) throw new Error('Supabase is unavailable.');
    const user = await backend.ready;
    const favorites = user ? await backend.loadFavorites() : [];
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const validFavoriteCount = favorites.filter(item =>
      typeof item.id === 'string' && uuidPattern.test(item.id)
    ).length;
    updateLinkBadge('nav a[href^="devmatch-favorites.html"]', 'favorites', validFavoriteCount);
  }

  function refreshFavoriteBadges() {
    updateFavoriteBadges().catch(error => {
      console.error('Unable to load favorite badges from Supabase.', error);
      updateLinkBadge('nav a[href^="devmatch-favorites.html"]', 'favorites', 0);
    });
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

  function updateFloatingChatBadges(unreadCount) {
    document.querySelectorAll('.floating-chat').forEach(link => {
      let badge = link.querySelector('.floating-chat-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'floating-chat-badge';
        badge.setAttribute('aria-hidden', 'true');
        link.appendChild(badge);
      }

      badge.textContent = String(unreadCount);
      badge.hidden = unreadCount === 0;
      link.setAttribute(
        'aria-label',
        unreadCount ? `Messages & Chat, ${unreadCount} unread conversations` : 'Messages & Chat'
      );
      link.title = unreadCount
        ? `Open Messages & Chat (${unreadCount} unread)`
        : 'Open Messages & Chat';
    });
  }

  let notificationRealtimeChannel = null;
  let notificationRealtimeUserId = null;
  let notificationRealtimeSetup = null;
  let notificationAuthSubscription = null;

  async function ensureNotificationRealtime(backend, user) {
    if (notificationRealtimeSetup) await notificationRealtimeSetup;
    if (notificationRealtimeChannel && notificationRealtimeUserId === user.id) return;

    notificationRealtimeSetup = (async () => {
      if (notificationRealtimeChannel) {
        await backend.client.removeChannel(notificationRealtimeChannel);
        notificationRealtimeChannel = null;
      }

      const {data, error} = await backend.client.auth.getSession();
      if (error) throw error;
      if (!data.session?.access_token) throw new Error('Your session is unavailable.');
      await backend.client.realtime.setAuth(data.session.access_token);

      if (!notificationAuthSubscription) {
        const {data: authListener} = backend.client.auth.onAuthStateChange((_event, session) => {
          if (session?.access_token) {
            void backend.client.realtime.setAuth(session.access_token).catch(error => {
              console.error('Unable to refresh the notification real-time session.', error);
            });
          }
        });
        notificationAuthSubscription = authListener.subscription;
      }

      notificationRealtimeUserId = user.id;
      notificationRealtimeChannel = backend.client
        .channel(`nav-updates:${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`
        }, payload => {
          refreshNotificationBadges();
          if (mobileNavigationBreakpoint.matches) {
            window.dispatchEvent(new CustomEvent('devmatch:notification-received', {detail: payload.new}));
          }
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        }, () => {
          refreshMessageBadges();
        })
        .subscribe(status => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('Navigation real-time updates are unavailable.', status);
          }
        });
    })();

    try {
      await notificationRealtimeSetup;
    } catch (error) {
      notificationRealtimeUserId = null;
      throw error;
    } finally {
      notificationRealtimeSetup = null;
    }
  }

  async function updateNotificationBadges() {
    const backend = window.devMatchBackend;
    if (!backend) throw new Error('Supabase is unavailable.');
    updateLinkBadge(
      'nav a[href^="devmatch-developer-notifications.html"], nav a[href^="devmatch-notifications.html"]',
      'notifications',
      0
    );
    updateHeaderNotificationDot(0);
    const user = await backend.ready;
    if (user) {
      try {
        await ensureNotificationRealtime(backend, user);
      } catch (error) {
        console.error('Unable to subscribe to notification updates.', error);
      }
    }
    const unreadNotificationCount = user ? await backend.loadUnreadNotificationCount() : 0;
    updateLinkBadge(
      'nav a[href^="devmatch-developer-notifications.html"], nav a[href^="devmatch-notifications.html"]',
      'notifications',
      unreadNotificationCount
    );
    updateHeaderNotificationDot(unreadNotificationCount);
  }

  function refreshNotificationBadges() {
    updateNotificationBadges().catch(error => {
      console.error('Unable to load notification badges from Supabase.', error);
      updateLinkBadge(
        'nav a[href^="devmatch-developer-notifications.html"], nav a[href^="devmatch-notifications.html"]',
        'notifications',
        0
      );
      updateHeaderNotificationDot(0);
    });
  }

  async function updateMessageBadges() {
    const backend = window.devMatchBackend;
    if (!backend) throw new Error('Supabase is unavailable.');
    const user = await backend.ready;
    let unreadCount = 0;

    if (user) {
      const {data, error} = await backend.client.functions.invoke('chat-api', {
        body: {action: 'list-conversations', workspaceRole: await backend.getWorkspaceRole()}
      });
      if (error) throw error;
      if (!Array.isArray(data?.data)) {
        throw new Error('Chat service returned an invalid conversation list.');
      }

      const role = await backend.getWorkspaceRole();
      unreadCount = data.data.filter(conversation => {
        try {
          return backend.isChatConversationUnread(conversation, user.id, role);
        } catch (error) {
          console.warn('Unable to read local chat status.', error);
          return true;
        }
      }).length;
    }

    updateLinkBadge('nav a[href^="devmatch-chat.html"]', 'message', unreadCount);
    updateFloatingChatBadges(unreadCount);
  }

  function refreshMessageBadges() {
    updateMessageBadges().catch(error => {
      console.error('Unable to load unread conversations for navigation.', error);
    });
  }

  function updateNavBadges() {
    refreshMessageBadges();
    refreshFavoriteBadges();
    refreshNotificationBadges();
  }

  window.DEVMATCH_NAV_BADGES = {
    updateFavorites: refreshFavoriteBadges,
    updateNotifications: refreshNotificationBadges
  };
  updateNavBadges();
  syncWorkspaceModeWithAccount().catch(error => {
    console.error('Unable to sync the workspace mode with the account role.', error);
  });
  window.addEventListener('storage', updateNavBadges);
  window.addEventListener('devmatch:notifications-changed', refreshNotificationBadges);
  window.addEventListener('devmatch:messages-changed', refreshMessageBadges);

  document.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;

    const chatLink = event.target.closest('a[href^="devmatch-chat.html"], .floating-chat');
    if (chatLink && mobileNavigationBreakpoint.matches && !document.body.classList.contains('chat-body')) {
      const activeItem = document.querySelector('.mobile-bottom-nav__item.active');
      const activeKey = activeItem?.dataset.mobileNavKey;
      if (activeKey) {
        try {
          sessionStorage.setItem('devmatch-mobile-chat-return-tab', activeKey);
        } catch (error) {
          console.warn('Unable to save the previous mobile navigation tab.', error);
        }
      }
      try {
        sessionStorage.setItem(mobileChatReturnUrlStorageKey, window.location.href);
      } catch (error) {
        console.warn('Unable to save the previous mobile page for chat navigation.', error);
      }
    }

    if (event.defaultPrevented) return;

    const mobileChatBackLink = event.target.closest('#mobileChatBack');
    if (mobileChatBackLink && mobileNavigationBreakpoint.matches && mobileChatHasStoredOrigin) {
      event.preventDefault();
      try {
        sessionStorage.removeItem(mobileChatReturnUrlStorageKey);
      } catch (error) {
        console.warn('Unable to clear the mobile chat return destination.', error);
      }
      window.history.back();
      return;
    }

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
    if (modeLink && mobileNavigationBreakpoint.matches && modeLink.classList.contains('active')
      && [...modeSwitch.querySelectorAll('a')].some(link => !link.hidden && !link.classList.contains('active'))) {
      event.preventDefault();
      setMobileModeMenuOpen(!modeSwitch.classList.contains('mobile-mode-open'));
      return;
    }

    if (modeLink && !modeLink.classList.contains('active') && !modeLink.target) {
      event.preventDefault();
      if (switchingWorkspace) return;
      switchingWorkspace = true;
      const targetRole = getMode(modeLink) === 'client' ? 'client' : 'dev';
      const returnToProfile = isMobileMyProfilePage && mobileSearchBreakpoint.matches;
      switchAccountWorkspace(
        targetRole,
        returnToProfile,
        modeLink
      ).catch(error => {
        if (returnToProfile) modeLink.classList.remove('mobile-mode-switch-leaving');
        console.error('Unable to switch workspace.', error);
        alert(error.message || 'Unable to switch accounts right now. Please try again.');
      }).finally(() => { switchingWorkspace = false; });
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
