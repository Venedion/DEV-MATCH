(function () {
  'use strict';

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
        { key: 'settings', id: 'settingsLink', label: 'Settings', href: 'devmatch-settings.html', icon: 'settings' }
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
    if (role === 'client') {
      if (page === 'devmatch-client-dashboard.html') {
        if (hash === '#requests' || hash.startsWith('#request-')) return 'requests';
        if (hash === '#discover') return 'discover';
        return 'home';
      }
      if (page === 'devmatch-discover-projects.html' || page === 'devmatch-discover-project-detail.html') return 'discover';
      if (page === 'devmatch-find-developers.html' || page === 'devmatch-developer-profile.html') return 'developers';
      if (page === 'devmatch-notifications.html') return 'notifications';
    } else {
      if (page === 'devmatch-dashboard.html') return 'overview';
      if (page === 'devmatch-my-projects.html') return 'projects';
      if (page === 'devmatch-find-projects.html' || page === 'devmatch-find-project-detail.html') return 'findProjects';
      if (page === 'devmatch-find-clients.html') return 'findClients';
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
        `href="${getItemHref(item, role)}"`
      ];
      if (item.request) attributes.push('data-request-nav');
      if (active) attributes.push('aria-current="page"');
      const labelId = {
        overviewLink: 'overviewLinkLabel',
        projectsLink: 'projectsLinkLabel',
        findProjectsLink: 'findProjectsLinkLabel',
        findClientsLink: 'findClientsLinkLabel'
      }[item.id];
      const label = labelId ? `<span id="${labelId}">${item.label}</span>` : item.label;
      return `<a ${attributes.join(' ')}>${icons[item.icon]}${label}${getBadgeMarkup(item, role, itemClass)}</a>`;
    }).join('');
  }

  let currentWorkspace = '';

  function setWorkspace(role) {
    if (role !== 'client' && role !== 'developer' && role !== 'dev') {
      throw new TypeError('Sidebar workspace must be client or developer.');
    }
    const workspace = role === 'dev' ? 'developer' : role;
    if (workspace === currentWorkspace) return;
    currentWorkspace = workspace;
    const activeKey = getCurrentPage(workspace);
    const groups = navigation[workspace];
    document.querySelectorAll('[data-shared-navigation]').forEach(nav => {
      const group = nav.dataset.sharedNavigation;
      if (group === 'primary' || group === 'account') {
        renderGroup(nav, groups[group], workspace, activeKey);
      }
    });
  }

  window.DEVMATCH_SIDEBAR_NAVIGATION = { setWorkspace };
  setWorkspace(getInitialWorkspace());
})();
