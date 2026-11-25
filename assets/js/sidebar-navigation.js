(function () {
  'use strict';

  const mobileNavigationTransitionKey = 'devmatch-mobile-bottom-nav-transition';

  const icons = {
    overview: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/></svg>',
    messages: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-4A8.5 8.5 0 1 1 21 11.5z"/></svg>',
    projects: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    discover: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
    people: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0m2-8a3 3 0 1 0 0-6m1 8a5 5 0 0 1 3 5"/></svg>',
    favorites: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    notifications: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 13h4"/></svg>',
    profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6"/></svg>'
  };

  const navigation = {
    developer: {
      primary: [
        { key: 'overview', id: 'overviewLink', label: 'Overview', href: 'devmatch-dashboard.html', icon: 'overview' },
        { key: 'messages', id: 'messagesLink', label: 'Messages', href: 'devmatch-chat.html', icon: 'messages', badge: 'messages' },
        { key: 'projects', id: 'projectsLink', label: 'My Projects', href: 'devmatch-my-projects.html', icon: 'projects' },
        { key: 'findProjects', id: 'findProjectsLink', label: 'Find Projects', href: 'devmatch-find-projects.html', icon: 'discover' },
        { key: 'findClients', id: 'findClientsLink', label: 'Find Clients', href: 'devmatch-find-clients.html', icon: 'people' },
        { key: 'favorites', id: 'favoritesLink', label: 'Favorites', href: 'devmatch-favorites.html', icon: 'favorites', badge: 'favorites' },
        { key: 'notifications', id: 'notificationsNavLink', label: 'Notifications', href: 'devmatch-developer-notifications.html', icon: 'notifications', badge: 'notifications' }
      ],
      account: [
        { key: 'profile', id: 'profileNavLink', label: 'Profile', href: 'devmatch-my-profile.html?role=dev', icon: 'profile' },
        { key: 'settings', id: 'settingsLink', label: 'Settings', href: 'devmatch-settings.html?role=dev', icon: 'settings' }
      ]
    },
    client: {
      primary: [
        { key: 'home', id: 'overviewLink', label: 'Home', href: 'devmatch-client-dashboard.html#home', icon: 'home' },
        { key: 'messages', id: 'messagesLink', label: 'Messages', href: 'devmatch-chat.html?role=client', icon: 'messages', badge: 'messages' },
        { key: 'requests', id: 'projectsLink', label: 'My Requests', href: 'devmatch-client-dashboard.html#requests', icon: 'projects', request: true },
        { key: 'discover', id: 'findProjectsLink', label: 'Discover Projects', href: 'devmatch-discover-projects.html', icon: 'discover' },
        { key: 'developers', id: 'findClientsLink', label: 'Developers', href: 'devmatch-find-developers.html', icon: 'people' },
        { key: 'favorites', id: 'favoritesLink', label: 'Favorites', href: 'devmatch-favorites.html?role=client', icon: 'favorites', badge: 'favorites' },
        { key: 'notifications', id: 'notificationsNavLink', label: 'Notifications', href: 'devmatch-notifications.html', icon: 'notifications', badge: 'notifications' }
      ],
      account: [
        { key: 'profile', id: 'profileNavLink', label: 'Profile', href: 'devmatch-my-profile.html?role=client', icon: 'profile' },
        { key: 'settings', id: 'settingsLink', label: 'Settings', href: 'devmatch-settings.html?role=client', icon: 'settings' }
      ]
    }
  };

  function getCurrentPage(role) {
    const page = location.pathname.split('/').pop();
    const hash = location.hash;
    if (page === 'devmatch-chat.html') {
      try {
        const storedActive = sessionStorage.getItem('devmatch-mobile-chat-return-tab');
        if (storedActive) return storedActive;
        if (document.referrer) {
          const previous = new URL(document.referrer, location.href);
          const previousPage = previous.pathname.split('/').pop();
          if (role === 'client') {
            if (previousPage === 'devmatch-client-dashboard.html') {
              return previous.hash === '#requests' || previous.hash.startsWith('#request-') ? 'requests' : 'home';
            }
            if (['devmatch-discover-projects.html', 'devmatch-discover-project-detail.html',
              'devmatch-find-developers.html', 'devmatch-developer-profile.html',
              'devmatch-favorites.html'].includes(previousPage)) return 'explore';
            if (previousPage === 'devmatch-notifications.html') return 'notifications';
            if (['devmatch-my-profile.html', 'devmatch-settings.html'].includes(previousPage)) return 'profile';
          } else {
            if (previousPage === 'devmatch-dashboard.html') return 'overview';
            if (previousPage === 'devmatch-my-projects.html') return 'projects';
            if (['devmatch-find-projects.html', 'devmatch-find-project-detail.html',
              'devmatch-find-clients.html', 'devmatch-client-profile.html',
              'devmatch-favorites.html'].includes(previousPage)) return 'explore';
            if (previousPage === 'devmatch-developer-notifications.html') return 'notifications';
            if (['devmatch-my-profile.html', 'devmatch-settings.html'].includes(previousPage)) return 'profile';
          }
        }
      } catch (error) {
        console.warn('Unable to read the previous mobile navigation tab.', error);
      }
      return 'messages';
    }
    if (role === 'client') {
      if (page === 'devmatch-client-dashboard.html') {
        if (hash === '#requests' || hash.startsWith('#request-')) return 'requests';
        if (hash === '#discover') return 'discover';
        return 'home';
      }
      if (page === 'devmatch-find-projects.html') return 'findProjects';
      if (page === 'devmatch-discover-projects.html' || page === 'devmatch-discover-project-detail.html') return 'discover';
      if (page === 'devmatch-find-developers.html' || page === 'devmatch-developer-profile.html') return 'developers';
      if (page === 'devmatch-notifications.html') return 'notifications';
    } else {
      if (page === 'devmatch-dashboard.html') return 'overview';
      if (page === 'devmatch-my-projects.html') return 'projects';
      if (page === 'devmatch-find-projects.html' || page === 'devmatch-find-project-detail.html') return 'findProjects';
      if (page === 'devmatch-find-clients.html') return 'findClients';
      if (page === 'devmatch-client-profile.html') {
        const source = new URLSearchParams(location.search).get('from');
        if (source === 'find-projects') return 'findProjects';
        if (source === 'find-clients') return 'findClients';
      }
      if (page === 'devmatch-developer-notifications.html') return 'notifications';
    }
    if (page === 'devmatch-chat.html') return 'messages';
    if (page === 'devmatch-favorites.html') return 'favorites';
    if (page === 'devmatch-settings.html') return 'settings';
    if (page === 'devmatch-my-profile.html') return 'profile';
    return '';
  }

  function getInitialWorkspace() {
    const queryRole = new URLSearchParams(location.search).get('role');
    if (queryRole === 'client' || queryRole === 'dev') return queryRole;
    const pageRole = document.body.dataset.workspace;
    if (pageRole === 'client' || pageRole === 'dev') return pageRole;
    const activeMode = document.querySelector('.mode-switch a.active, .client-mode-switch a.active');
    if (activeMode) return activeMode.textContent.toLowerCase().includes('client mode') ? 'client' : 'developer';
    try {
      const storedRole = sessionStorage.getItem('devmatch-active-role');
      if (storedRole === 'client' || storedRole === 'dev') return storedRole === 'dev' ? 'developer' : storedRole;
    } catch (error) {
      console.warn('Unable to read the active workspace for sidebar navigation.', error);
    }
    return document.body.classList.contains('client-shell-page') ? 'client' : 'developer';
  }

  function getBadgeMarkup(item, role, itemClass) {
    if (item.badge === 'favorites') {
      return `<span class="${itemClass === 'client-nav-item' ? 'client-nav-count' : 'nav-count favorites-count-badge'}" id="favoriteCount">0</span>`;
    }
    if (item.badge === 'notifications') {
      const badgeClass = itemClass === 'client-nav-item' ? 'client-notification-count' : 'nav-count notification-count';
      const id = role === 'client' ? 'clientNotificationCount' : 'developerNotificationCount';
      return `<span class="${badgeClass}" id="${id}" hidden></span>`;
    }
    if (item.badge === 'messages') {
      const badgeClass = itemClass === 'client-nav-item' ? 'client-nav-count' : 'nav-count';
      return `<span class="${badgeClass} chat-unread-total-badge" hidden>0</span>`;
    }
    return '';
  }

  function getItemHref(item, role) {
    if (role === 'client' && location.pathname.endsWith('/devmatch-client-dashboard.html')) {
      if (item.key === 'home') return '#home';
      if (item.key === 'requests') return '#requests';
    }
    return item.href;
  }

  function renderGroup(nav, items, role, activeKey) {
    const itemClass = nav.classList.contains('client-nav') ? 'client-nav-item' : 'nav-item';
    nav.innerHTML = items.map(item => {
      const active = item.key === activeKey;
      const attributes = [
        `class="${itemClass}${active ? ' active' : ''}"`,
        `id="${item.id}"`,
        `data-nav-key="${item.key}"`,
        `href="${getItemHref(item, role)}"`,
        `title="${item.label}"`
      ];
      if (item.request) attributes.push('data-request-nav');
      if (active) attributes.push('aria-current="page"');
      const labelId = {
        overviewLink: 'overviewLinkLabel',
        projectsLink: 'projectsLinkLabel',
        findProjectsLink: 'findProjectsLinkLabel',
        findClientsLink: 'findClientsLinkLabel'
      }[item.id];
      return `<a ${attributes.join(' ')}>${icons[item.icon]}<span class="nav-item-label"${labelId ? ` id="${labelId}"` : ''}>${item.label}</span>${getBadgeMarkup(item, role, itemClass)}</a>`;
    }).join('');
  }

  function renderMobileBottomNavigation(role, activeKey) {
    let nav = document.querySelector('.mobile-bottom-nav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.className = 'mobile-bottom-nav';
      document.body.appendChild(nav);
      initializeMobileBottomNavigationEvents(nav);
    }

    const isClient = role === 'client';
    const page = location.pathname.split('/').pop();
    let effectiveActiveKey = activeKey;
    if (page === 'devmatch-chat.html') {
      try {
        const storedActive = sessionStorage.getItem('devmatch-mobile-chat-return-tab');
        if (storedActive) effectiveActiveKey = storedActive;
      } catch (error) {
        console.warn('Unable to read the active mobile chat tab.', error);
      }
    }
    const items = isClient
      ? [
        {key: 'home', label: 'Home', href: 'devmatch-client-dashboard.html#home', icon: 'home'},
        {key: 'requests', label: 'My Requests', href: 'devmatch-client-dashboard.html#requests', icon: 'projects'},
        {key: 'explore', label: 'Explore', href: 'devmatch-discover-projects.html', icon: 'discover'},
        {key: 'notifications', label: 'Notifications', href: 'devmatch-notifications.html', icon: 'notifications'},
        {key: 'profile', label: 'Profile', href: 'devmatch-my-profile.html?role=client', icon: 'profile'}
      ]
      : [
        {key: 'overview', label: 'Overview', href: 'devmatch-dashboard.html', icon: 'overview'},
        {key: 'projects', label: 'My Projects', href: 'devmatch-my-projects.html', icon: 'projects'},
        {key: 'explore', label: 'Explore', href: 'devmatch-find-projects.html', icon: 'discover'},
        {key: 'notifications', label: 'Notifications', href: 'devmatch-developer-notifications.html', icon: 'notifications'},
        {key: 'profile', label: 'Profile', href: 'devmatch-my-profile.html?role=dev', icon: 'profile'}
      ];

    nav.setAttribute('aria-label', isClient ? 'Client navigation' : 'Developer navigation');
    nav.dataset.workspace = role;
    nav.replaceChildren();

    items.forEach(item => {
      const active = item.key === 'explore'
        ? ['explore', 'findProjects', 'findClients', 'discover', 'developers', 'favorites'].includes(effectiveActiveKey)
        : item.key === 'profile'
          ? effectiveActiveKey === 'profile' || effectiveActiveKey === 'settings'
          : item.key === effectiveActiveKey;

      const isClientDashboardShortcut = isClient
        && page === 'devmatch-client-dashboard.html'
        && (item.key === 'home' || item.key === 'requests');
      const link = document.createElement(isClientDashboardShortcut ? 'button' : 'a');
      link.className = `mobile-bottom-nav__item${active ? ' active' : ''}`;
      link.dataset.mobileNavKey = item.key;
      if (isClientDashboardShortcut) {
        link.type = 'button';
        link.dataset.mobileClientView = item.key;
      } else {
        link.href = item.href;
      }
      if (isClient && (item.key === 'home' || item.key === 'requests' || item.key === 'explore')) {
        link.classList.add('client-nav-item');
        link.dataset.navKey = item.key === 'explore' ? 'discover' : item.key;
        if (item.key === 'requests') link.setAttribute('data-request-nav', '');
      }
      link.setAttribute('aria-label', item.label);
      link.title = item.label;
      if (active) link.setAttribute('aria-current', 'page');
      link.innerHTML = `${icons[item.icon]}<span class="mobile-bottom-nav__sr-only">${item.label}</span>`;
      nav.appendChild(link);
    });

    document.body.classList.add('has-mobile-bottom-navigation');
    document.body.classList.toggle('mobile-bottom-nav-hidden', nav.classList.contains('is-hidden'));
    updateMobileBottomNavigationIndicator(nav);
  }

  function initializeMobileBottomNavigationEvents(nav) {
    nav.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      const clickedItem = event.target.closest('.mobile-bottom-nav__item');
      if (!clickedItem) return;
      scrollIntent.direction = 0;
      scrollIntent.expiresAt = 0;
      scrollIntent.touchY = null;
      scrollIntent.touchMoved = false;
      if (clickedItem instanceof HTMLAnchorElement) {
        const activeItem = nav.querySelector('.mobile-bottom-nav__item.active');
        const activeKey = activeItem?.dataset.mobileNavKey;
        const destinationKey = clickedItem.dataset.mobileNavKey;
        try {
          if (activeKey && destinationKey && activeKey !== destinationKey) {
            const destinationPath = new URL(clickedItem.href, location.href).pathname;
            sessionStorage.setItem(
              mobileNavigationTransitionKey,
              `${nav.dataset.workspace}|${activeKey}|${destinationPath}`
            );
          } else {
            sessionStorage.removeItem(mobileNavigationTransitionKey);
          }
        } catch (error) {
          console.warn('Unable to save the previous mobile navigation tab.', error);
        }
      }
      if (clickedItem.href && clickedItem.href.includes('devmatch-chat.html')) {
        const activeItem = nav.querySelector('.mobile-bottom-nav__item.active');
        const activeKey = activeItem?.dataset.mobileNavKey;
        if (activeKey) {
          try {
            sessionStorage.setItem('devmatch-mobile-chat-return-tab', activeKey);
          } catch (error) {
            console.warn('Unable to save the previous mobile navigation tab.', error);
          }
        }
      }
      if (clickedItem instanceof HTMLButtonElement) {
        requestAnimationFrame(() => updateMobileBottomNavigationIndicator(nav));
      }
    });

    const main = document.querySelector('main');
    const scrollPositions = new Map();
    [document.scrollingElement, document.documentElement, document.body, main].forEach(target => {
      if (target instanceof HTMLElement) scrollPositions.set(target, target.scrollTop);
    });

    const mobileViewport = window.matchMedia('(orientation: portrait)');
    const scrollIntent = { direction: 0, expiresAt: 0, touchY: null, touchMoved: false };
    const noteScrollIntent = (scrollDirection, duration) => {
      if (!mobileViewport.matches || !scrollDirection) return;
      scrollIntent.direction = Math.sign(scrollDirection);
      scrollIntent.expiresAt = performance.now() + duration;
    };

    window.addEventListener('wheel', event => {
      noteScrollIntent(event.deltaY, 300);
    }, {passive: true});

    window.addEventListener('touchstart', event => {
      if (event.touches.length === 1) {
        scrollIntent.touchY = event.touches[0].clientY;
        scrollIntent.touchMoved = false;
      }
    }, {passive: true});

    window.addEventListener('touchmove', event => {
      if (scrollIntent.touchY === null || event.touches.length !== 1) return;
      const currentY = event.touches[0].clientY;
      const delta = scrollIntent.touchY - currentY;
      if (Math.abs(delta) > 3) {
        scrollIntent.touchMoved = true;
        noteScrollIntent(delta, 700);
      }
      scrollIntent.touchY = currentY;
    }, {passive: true});

    const clearTouchPosition = () => {
      scrollIntent.touchY = null;
      if (scrollIntent.touchMoved && scrollIntent.direction) {
        scrollIntent.expiresAt = Math.max(scrollIntent.expiresAt, performance.now() + 500);
      }
      scrollIntent.touchMoved = false;
    };
    window.addEventListener('touchend', clearTouchPosition, {passive: true});
    window.addEventListener('touchcancel', clearTouchPosition, {passive: true});

    window.addEventListener('keydown', event => {
      if (event.target instanceof Element
        && event.target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return;
      const keyDirection = {
        ArrowDown: 1,
        PageDown: 1,
        ' ': 1,
        End: 1,
        ArrowUp: -1,
        PageUp: -1,
        Home: -1
      }[event.key];
      noteScrollIntent(keyDirection, 500);
    });

    let scrollTarget = null;
    let direction = 0;
    let directionDistance = 0;
    document.addEventListener('scroll', event => {
      const target = event.target === document ? document.scrollingElement : event.target;
      if (!(target instanceof HTMLElement)
        || (target !== document.documentElement && target !== document.body && target.tagName !== 'MAIN')) return;

      const currentTop = Math.max(0, target.scrollTop);
      const previousTop = scrollPositions.get(target);
      scrollPositions.set(target, currentTop);
      if (!mobileViewport.matches) {
        direction = 0;
        directionDistance = 0;
        return;
      }
      if (target !== scrollTarget) {
        scrollTarget = target;
        direction = 0;
        directionDistance = 0;
      }
      if (previousTop === undefined) return;

      const delta = currentTop - previousTop;
      if (!delta) return;
      const nextDirection = delta > 0 ? 1 : -1;
      if (performance.now() > scrollIntent.expiresAt || scrollIntent.direction !== nextDirection) {
        direction = 0;
        directionDistance = 0;
        return;
      }
      if (currentTop < 24) {
        setMobileBottomNavigationHidden(nav, false);
        direction = 0;
        directionDistance = 0;
        return;
      }

      if (nextDirection !== direction) {
        direction = nextDirection;
        directionDistance = 0;
      }
      directionDistance += Math.abs(delta);
      if (directionDistance < 8) return;

      setMobileBottomNavigationHidden(nav, direction > 0);
      directionDistance = 0;
    }, {capture: true, passive: true});

    window.addEventListener('resize', () => {
      scrollIntent.direction = 0;
      scrollIntent.expiresAt = 0;
      scrollIntent.touchY = null;
      scrollIntent.touchMoved = false;
      direction = 0;
      directionDistance = 0;
      setMobileBottomNavigationHidden(nav, false);
      updateMobileBottomNavigationIndicator(nav);
    });
  }

  function updateMobileBottomNavigationIndicator(nav) {
    if (!(nav instanceof HTMLElement)) return;
    const activeItem = nav.querySelector('.mobile-bottom-nav__item.active');
    const navBounds = nav.getBoundingClientRect();
    if (!activeItem || !navBounds.width) return;
    if (nav.dataset.mobileNavIndicatorPending === 'true') return;

    const setPosition = item => {
      const currentNavBounds = nav.getBoundingClientRect();
      const itemBounds = item.getBoundingClientRect();
      nav.style.setProperty(
        '--mobile-nav-active-left',
        `${itemBounds.left - currentNavBounds.left - nav.clientLeft}px`
      );
      nav.style.setProperty('--mobile-nav-active-width', `${itemBounds.width}px`);
    };

    const markIndicatorReady = () => {
      nav.classList.remove('is-initializing-indicator');
      nav.dataset.mobileNavIndicatorPending = 'false';
      nav.dataset.mobileNavIndicatorInitialized = 'true';
    };

    if (nav.dataset.mobileNavIndicatorInitialized === 'true') {
      setPosition(activeItem);
      nav.classList.add('has-active-indicator');
      return;
    }

    nav.classList.add('is-initializing-indicator');
    let savedTransition = null;
    try {
      savedTransition = sessionStorage.getItem(mobileNavigationTransitionKey);
      sessionStorage.removeItem(mobileNavigationTransitionKey);
    } catch (error) {
      console.warn('Unable to restore the previous mobile navigation tab.', error);
    }
    const [previousRole, previousKey, destinationPath] = savedTransition?.split('|') || [];
    const previousItem = previousRole === nav.dataset.workspace && destinationPath === location.pathname
      ? Array.from(nav.querySelectorAll('.mobile-bottom-nav__item'))
        .find(item => item.dataset.mobileNavKey === previousKey)
      : null;

    if (previousItem && previousItem !== activeItem) {
      setPosition(previousItem);
      nav.classList.add('has-active-indicator');
      nav.dataset.mobileNavIndicatorPending = 'true';
      requestAnimationFrame(() => {
        nav.classList.remove('is-initializing-indicator');
        requestAnimationFrame(() => {
          const currentActiveItem = nav.querySelector('.mobile-bottom-nav__item.active');
          if (currentActiveItem) setPosition(currentActiveItem);
          nav.dataset.mobileNavIndicatorPending = 'false';
          nav.dataset.mobileNavIndicatorInitialized = 'true';
        });
      });
      return;
    }

    setPosition(activeItem);
    nav.classList.add('has-active-indicator');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const currentActiveItem = nav.querySelector('.mobile-bottom-nav__item.active');
      if (currentActiveItem) setPosition(currentActiveItem);
      markIndicatorReady();
    }));
    nav.dataset.mobileNavIndicatorPending = 'true';
  }

  function setMobileBottomNavigationHidden(nav, hidden) {
    nav.classList.toggle('is-hidden', hidden);
    document.body.classList.toggle('mobile-bottom-nav-hidden', hidden);
  }

  function initializeSidebarActionLabels() {
    const actions = document.querySelectorAll('body > .sidebar > .side-add, body > .sidebar > .post-request, body > .client-sidebar > .post-request');
    actions.forEach(action => {
      const existingLabel = Array.from(action.children).find(child => child.tagName === 'SPAN');
      if (existingLabel) {
        existingLabel.classList.add('sidebar-action-label');
        return;
      }

      const textNodes = Array.from(action.childNodes).filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (!textNodes.length) return;

      const label = document.createElement('span');
      label.className = 'sidebar-action-label';
      label.textContent = textNodes.map(node => node.textContent.trim()).join(' ');
      textNodes.forEach(node => node.remove());
      action.append(label);
    });
  }

  function initializeSidebarPin() {
    const sidebars = document.querySelectorAll('body > .sidebar, body > .client-sidebar');
    if (!sidebars.length) return;

    let pinned = false;
    try {
      pinned = localStorage.getItem('devmatch-sidebar-pinned') === 'true';
    } catch (error) {
      console.warn('Unable to read the saved sidebar preference.', error);
    }

    function updateButtons() {
      const isPinned = document.body.classList.contains('sidebar-pinned');
      sidebars.forEach(sidebar => {
        const button = sidebar.querySelector('.sidebar-pin-toggle');
        if (!button) return;
        button.setAttribute('aria-pressed', String(isPinned));
        button.setAttribute('aria-label', isPinned ? 'Unpin navigation' : 'Pin navigation');
        button.title = isPinned ? 'Unpin navigation' : 'Pin navigation';
      });
    }

    document.body.classList.toggle('sidebar-pinned', pinned);
    sidebars.forEach(sidebar => {
      const button = document.createElement('button');
      button.className = 'sidebar-pin-toggle';
      button.type = 'button';
      button.setAttribute('aria-pressed', String(pinned));
      button.setAttribute('aria-label', pinned ? 'Unpin navigation' : 'Pin navigation');
      button.title = pinned ? 'Unpin navigation' : 'Pin navigation';
      button.innerHTML = '<svg viewBox="0 0 40 28" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="35" height="23" rx="4.5"/><path d="M14.5 2.5v23"/><path class="sidebar-pin-arrow" d="M7.5 10l3 4-3 4"/></svg>';
      button.addEventListener('click', () => {
        const nextPinned = !document.body.classList.contains('sidebar-pinned');
        document.body.classList.toggle('sidebar-pinned', nextPinned);
        try {
          localStorage.setItem('devmatch-sidebar-pinned', String(nextPinned));
        } catch (error) {
          console.warn('Unable to save the sidebar preference.', error);
        }
        updateButtons();
      });
      sidebar.prepend(button);
    });
  }

  function initializeSidebarBrandPlacement() {
    const brand = document.querySelector(
      'body > .topbar > .brand, body > .profile-topbar > .brand, body > .client-topbar > .client-brand'
    );
    const sidebar = document.querySelector('body > .sidebar, body > .client-sidebar');
    if (!brand || !sidebar) return;

    const header = brand.parentElement;
    const desktop = window.matchMedia('(orientation: landscape)');
    let placeholder = null;

    function updatePlacement() {
      if (desktop.matches && brand.parentElement !== sidebar) {
        placeholder = document.createElement('span');
        placeholder.className = 'sidebar-brand-placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        header.replaceChild(placeholder, brand);
        sidebar.insertBefore(brand, sidebar.firstChild);
      } else if (!desktop.matches && brand.parentElement === sidebar) {
        header.replaceChild(brand, placeholder);
        placeholder = null;
      }
    }

    updatePlacement();
    window.addEventListener('resize', updatePlacement);
  }

  let currentWorkspace = '';

  function setWorkspace(role) {
    if (role !== 'client' && role !== 'developer' && role !== 'dev') {
      throw new TypeError('Sidebar workspace must be client or developer.');
    }
    const workspace = role === 'dev' ? 'developer' : role;
    const activeKey = getCurrentPage(workspace);
    const desktopActiveKey = location.pathname.split('/').pop() === 'devmatch-chat.html'
      ? 'messages'
      : activeKey;
    if (location.pathname.split('/').pop() !== 'devmatch-chat.html'
      && activeKey
      && activeKey !== 'messages') {
      try {
        sessionStorage.setItem('devmatch-mobile-chat-return-tab', activeKey);
      } catch (error) {
        console.warn('Unable to persist the previous mobile navigation tab.', error);
      }
    }
    currentWorkspace = workspace;
    const groups = navigation[workspace];
    document.querySelectorAll('[data-shared-navigation]').forEach(nav => {
      const group = nav.dataset.sharedNavigation;
      if (group === 'primary' || group === 'account') {
        renderGroup(nav, groups[group], workspace, desktopActiveKey);
      }
    });
    renderMobileBottomNavigation(workspace, activeKey);
  }

  window.DEVMATCH_SIDEBAR_NAVIGATION = {
    setWorkspace,
    updateMobileBottomNavigationIndicator: () =>
      updateMobileBottomNavigationIndicator(document.querySelector('.mobile-bottom-nav'))
  };
  initializeSidebarActionLabels();
  initializeSidebarPin();
  initializeSidebarBrandPlacement();
  setWorkspace(getInitialWorkspace());
})();
