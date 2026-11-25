(() => {
  const workspace = document.body.dataset.workspace || 'client';
  const backend = window.devMatchBackend;
  const client = backend?.client;
  const markAllReadButton = document.getElementById('markAllRead');
  const notificationsHeading = document.querySelector('.notifications-heading');
  const notificationFilterActions = document.querySelector('.notification-filter-actions');
  const mobileFilterToggle = document.getElementById('notificationFilterToggle');
  const mobileFilterMenu = document.getElementById('notificationFilterMenu');
  const mobileFilterPanel = mobileFilterMenu?.querySelector('.notification-mobile-filter-panel');
  const mobileSettingsToggle = document.getElementById('notificationSettingsToggle');
  const mobileSettingsCard = document.getElementById('notification-settings');
  const mobileFilterLabel = document.getElementById('notificationMobileFilterLabel');
  const mobileFilterOptions = [...(mobileFilterMenu?.querySelectorAll('[data-notification-filter-option]') || [])];
  const desktopMarkAllLayout = window.matchMedia('(orientation: landscape)');
  const mobileListLayout = window.matchMedia('(orientation: portrait)');
  const MOBILE_NOTIFICATION_DISPLAY_BOUNDARY_RATIO = 0.73;
  const listToggle = document.createElement('button');
  listToggle.className = 'notification-list-toggle';
  listToggle.type = 'button';
  listToggle.setAttribute('aria-controls', 'notificationItems');
  listToggle.hidden = true;
  const stickyListToggle = document.createElement('div');
  stickyListToggle.className = 'notification-list-sticky';
  const itemsContainer = document.getElementById('notificationItems');
  const notificationList = itemsContainer?.closest('.notification-list');
  const notificationStatus = document.getElementById('notificationStatus');
  const notificationEmpty = document.getElementById('notificationEmpty');
  const actionList = document.getElementById('notificationActions');
  const preferenceInputs = [...document.querySelectorAll('[data-preference]')];
  const readNotifications = new Set();
  let newlyReceivedNotificationIds = new Set();
  let notificationRows = [];
  let notificationRecords = [];
  let actorDirectory = new Map();
  let projectDirectory = new Map();
  const processingRealtimeNotificationIds = new Set();
  const pendingRealtimeNotifications = [];
  let savedPreferences = {};
  let activeFilter = 'all';
  let activeQuery = '';
  let mobileListExpanded = false;
  let mobileListExpandedScrollTop = null;
  let mobileFilterClosePending = false;
  let mobileBoundaryFrame = 0;
  let mobileBoundaryResizeObserver = null;
  let listHeightAnimation = null;
  let stickyNavigation = null;
  let stickyNavigationTransitioning = false;
  let stickyPositionFrame = 0;
  let stateReady = false;

  function syncMobileFilterSelection(filter) {
    const selectedOption = mobileFilterOptions.find(option => option.dataset.notificationFilterOption === filter);
    if (!selectedOption) return;
    if (mobileFilterLabel) mobileFilterLabel.textContent = selectedOption.textContent.trim();
    mobileFilterOptions.forEach(option => {
      option.setAttribute('aria-pressed', String(option === selectedOption));
    });
  }

  function setMobileFilterMenuOpen(open, restoreFocus = false) {
    if (!mobileFilterToggle || !mobileFilterMenu) return;
    if (open) {
      const wasHidden = mobileFilterMenu.hidden;
      mobileFilterMenu.hidden = false;
      mobileFilterToggle.setAttribute('aria-expanded', 'true');
      mobileFilterClosePending = false;
      if (wasHidden) {
        mobileFilterMenu.classList.remove('is-open');
        window.requestAnimationFrame(() => {
          if (mobileFilterToggle.getAttribute('aria-expanded') === 'true') {
            mobileFilterMenu.classList.add('is-open');
          }
        });
      } else {
        mobileFilterMenu.classList.add('is-open');
      }
    } else {
      mobileFilterToggle.setAttribute('aria-expanded', 'false');
      const wasOpen = mobileFilterMenu.classList.contains('is-open');
      mobileFilterMenu.classList.remove('is-open');
      const canAnimateClose = mobileListLayout.matches
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (canAnimateClose && (wasOpen || mobileFilterClosePending)) {
        mobileFilterClosePending = true;
      } else {
        mobileFilterClosePending = false;
        mobileFilterMenu.hidden = true;
      }
    }
    if (restoreFocus) mobileFilterToggle.focus();
  }

  function setMobileSettingsMenuOpen(open, restoreFocus = false) {
    if (!mobileSettingsToggle || !mobileSettingsCard) return;
    const shouldOpen = open && mobileListLayout.matches;
    mobileSettingsToggle.setAttribute('aria-expanded', String(shouldOpen));
    mobileSettingsCard.classList.toggle('is-mobile-settings-open', shouldOpen);
    if (restoreFocus) mobileSettingsToggle.focus();
  }

  window.DEVMATCH_SKELETON?.rows(itemsContainer,4);
  window.DEVMATCH_SKELETON?.status(notificationStatus,'Loading notifications');
  window.DEVMATCH_SKELETON?.rows(actionList,2);
  document.querySelectorAll('[data-count]').forEach(count =>
    window.DEVMATCH_SKELETON?.text(count,'Loading notification count','24px')
  );

  const kindDetails = kind => {
    const value = String(kind || '').toLowerCase();
    if (value.includes('reply')) return {filter: 'comments', label: 'replied to your comment on', badge: '“'};
    if (value.includes('comment')) return {filter: 'comments', label: 'commented on', badge: '“'};
    if (value.includes('message') || value.includes('conversation')) return {filter: 'messages', label: 'sent you a message', badge: '✉'};
    if (value.includes('favorite') || value.includes('favourite') || value.includes('save')) return {filter: 'favorites', label: 'saved', badge: '♥'};
    if (value.includes('rating') || value.includes('review')) return {filter: 'ratings', label: 'left a rating', badge: '★'};
    return {filter: 'updates', label: 'sent you an update', badge: '•'};
  };

  function initials(value) {
    return String(value || '').trim().split(/\s+/).slice(0, 2)
      .map(part => part[0] || '').join('').toUpperCase() || '•';
  }

  function groupFor(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return {key: 'earlier', label: 'Earlier'};
    const now = new Date();
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const difference = Math.round((day - eventDay) / 86400000);
    if (difference <= 0) return {key: 'today', label: 'Today'};
    if (difference === 1) return {key: 'yesterday', label: 'Yesterday'};
    return {key: 'earlier', label: 'Earlier'};
  }

  function timeLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';
    const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days < 7 ? `${days}d ago` : date.toLocaleDateString();
  }

  function actionHref(notification, projects) {
    if (notification.conversation_id) {
      const role = workspace === 'client' ? '&role=client' : '';
      return `devmatch-chat.html?conversation=${encodeURIComponent(notification.conversation_id)}${role}`;
    }
    const category = kindDetails(notification.kind).filter;
    if (category === 'messages') return workspace === 'client' ? 'devmatch-chat.html?role=client' : 'devmatch-chat.html';
    if (category === 'comments') {
      const project=projects.get(notification.project_id);
      if(project?.kind==='portfolio'){
        return `devmatch-discover-project-detail.html?project=${encodeURIComponent(notification.project_id)}#commentsSection`;
      }
      if(project?.kind==='request'){
        return `devmatch-client-dashboard.html?section=comments#request-detail/${encodeURIComponent(notification.project_id)}`;
      }
      return workspace === 'client' ? 'devmatch-client-dashboard.html#requests' : 'devmatch-dashboard.html#interactions';
    }
    if (category === 'ratings') {
      return workspace === 'client' ? 'devmatch-find-developers.html' : 'devmatch-my-profile.html?role=dev';
    }
    return workspace === 'client' ? 'devmatch-client-dashboard.html#requests' : 'devmatch-my-projects.html';
  }

  function appendNotification(row, notification, actors, projects) {
    const detail = kindDetails(notification.kind);
    const actorName = actors.get(notification.actor_id + ':' + notification.actor_role) || 'A member';
    const projectTitle = projects.get(notification.project_id)?.title || 'your project';
    const article = document.createElement('article');
    article.className = 'notification-row';
    article.dataset.notification = notification.id;
    article.dataset.kind = detail.filter;
    if (!readNotifications.has(notification.id)) article.classList.add('is-unread');

    const dot = document.createElement('span');
    dot.className = 'unread-dot';
    dot.setAttribute('aria-hidden', 'true');
    const avatar = document.createElement('span');
    avatar.className = 'notification-avatar';
    avatar.textContent = initials(actorName);
    const badge = document.createElement('i');
    badge.className = `avatar-badge ${detail.filter.replace(/s$/, '')}-badge`;
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = detail.badge;
    avatar.append(badge);

    const copy = document.createElement('p');
    copy.className = 'notification-copy';
    const content = document.createElement('div');
    content.className = 'notification-content';
    const sentence = document.createElement('span');
    const name = document.createElement('b');
    name.textContent = actorName;
    sentence.append(name, document.createTextNode(` ${detail.label}`));
    if (['comments', 'favorites'].includes(detail.filter)) {
      sentence.append(document.createTextNode(' '));
      const project = document.createElement('strong');
      project.textContent = projectTitle;
      sentence.append(project);
    }
    copy.append(sentence);

    const time = document.createElement('time');
    time.dateTime = notification.created_at || '';
    time.textContent = timeLabel(notification.created_at);
    content.append(copy, time);
    const action = document.createElement('a');
    action.className = 'notification-action';
    action.href = actionHref(notification,projects);
    action.dataset.markRead = '';
    action.textContent = detail.filter === 'comments' ? 'Reply' : detail.filter === 'messages' ? 'Open chat' : 'View';
    article.append(dot, avatar, content, action);
    row.append(article);
  }

  function buildActions() {
    actionList.replaceChildren();
    const pending = notificationRows.filter(row =>
      row.classList.contains('is-unread') && ['comments', 'messages'].includes(row.dataset.kind)
    ).slice(0, 3);
    if (!pending.length) {
      const empty = document.createElement('p');
      empty.className = 'notification-empty';
      empty.textContent = 'No unread items need your action.';
      actionList.append(empty);
      return;
    }
    pending.forEach(row => {
      const article = document.createElement('article');
      const copy = document.createElement('p');
      const name = document.createElement('b');
      name.textContent = row.querySelector('.notification-copy b')?.textContent || 'A member';
      const description = document.createElement('span');
      description.textContent = row.dataset.kind === 'messages' ? 'New message' : 'New comment';
      copy.append(name, description);
      const link = document.createElement('a');
      link.href = row.querySelector('a')?.href || '#';
      link.dataset.markRead = '';
      link.dataset.notificationLink = row.dataset.notification;
      link.textContent = row.dataset.kind === 'messages' ? 'Open chat' : 'Reply';
      article.append(copy, link);
      actionList.append(article);
    });
  }

  function orderNotificationsNewestFirst(notifications) {
    if (!mobileListLayout.matches) return notifications;
    return [...notifications].sort((first, second) => {
      const firstDate = new Date(first.created_at).getTime();
      const secondDate = new Date(second.created_at).getTime();
      if (Number.isNaN(firstDate)) return Number.isNaN(secondDate) ? 0 : 1;
      if (Number.isNaN(secondDate)) return -1;
      return secondDate - firstDate;
    });
  }

  async function addRealtimeNotification(notification) {
    if (notificationRecords.some(item => item.id === notification.id)
      || processingRealtimeNotificationIds.has(notification.id)) return;
    processingRealtimeNotificationIds.add(notification.id);
    try {
      const [actorResult, projectResult] = await Promise.all([
        notification.actor_id
          ? client.from('directory_people').select('id,username,display_name,account_role').eq('id', notification.actor_id).maybeSingle()
          : Promise.resolve({data: null, error: null}),
        notification.project_id
          ? client.from('projects').select('id,title,project_kind').eq('id', notification.project_id).maybeSingle()
          : Promise.resolve({data: null, error: null})
      ]);
      if (actorResult.error) throw actorResult.error;
      if (projectResult.error) throw projectResult.error;
      const actor = actorResult.data;
      const project = projectResult.data;
      if (actor) actorDirectory.set(actor.id + ':' + actor.account_role, actor.username || actor.display_name);
      if (project) {
        projectDirectory.set(project.id, {title: project.title, kind: project.project_kind});
      }
      notificationRecords.push(notification);
      newlyReceivedNotificationIds.add(notification.id);
      cancelListHeightAnimation();
      itemsContainer.replaceChildren();
      renderNotifications(orderNotificationsNewestFirst(notificationRecords), actorDirectory, projectDirectory);
    } catch (error) {
      console.error('Unable to add a new notification to the list.', error);
      notificationStatus.textContent = 'Unable to refresh notifications. Please reload the page.';
      notificationStatus.hidden = false;
    } finally {
      processingRealtimeNotificationIds.delete(notification.id);
    }
  }

  function receiveRealtimeNotification(notification) {
    if (!stateReady) {
      if (!pendingRealtimeNotifications.some(item => item.id === notification.id)) {
        pendingRealtimeNotifications.push(notification);
      }
      return;
    }
    void addRealtimeNotification(notification);
  }

  function getMobileNotificationDisplayBoundary() {
    const viewport = window.visualViewport;
    return (viewport?.offsetTop || 0)
      + (viewport?.height || window.innerHeight) * MOBILE_NOTIFICATION_DISPLAY_BOUNDARY_RATIO;
  }

  function scheduleMobileBoundaryUpdate() {
    if (!mobileListLayout.matches || mobileListExpanded || mobileBoundaryFrame) return;
    mobileBoundaryFrame = window.requestAnimationFrame(() => {
      mobileBoundaryFrame = 0;
      updateNotifications();
    });
  }

  function animateListHeight(previousHeight) {
    cancelListHeightAnimation();
    const nextHeight = itemsContainer.scrollHeight;
    if (Math.abs(previousHeight - nextHeight) < 1
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || typeof itemsContainer.animate !== 'function') {
      return;
    }

    itemsContainer.style.overflow = 'hidden';
    const animation = itemsContainer.animate(
      [{height: `${previousHeight}px`}, {height: `${nextHeight}px`}],
      {duration: 220, easing: 'ease-in-out'}
    );
    listHeightAnimation = animation;
    animation.onfinish = () => {
      if (listHeightAnimation !== animation) return;
      itemsContainer.style.removeProperty('overflow');
      listHeightAnimation = null;
    };
  }

  function cancelListHeightAnimation() {
    if (listHeightAnimation) listHeightAnimation.cancel();
    listHeightAnimation = null;
    itemsContainer.style.removeProperty('overflow');
  }

  function updateStickyListTogglePosition() {
    if (!stickyNavigation || !stickyListToggle.isConnected) return;
    const navigationTop = stickyNavigation.getBoundingClientRect().top;
    const viewport = window.visualViewport;
    const viewportBottom = (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight);
    const scrollRoot = itemsContainer.closest('main');
    const scrollRootRect = scrollRoot?.getBoundingClientRect();
    const scrollRootPaddingBottom = scrollRoot
      ? Number.parseFloat(getComputedStyle(scrollRoot).paddingBottom) || 0
      : 0;
    const scrollportBottom = scrollRootRect ? scrollRootRect.bottom - scrollRootPaddingBottom : window.innerHeight;
    const wrapperRect = stickyListToggle.getBoundingClientRect();
    const buttonRect = listToggle.getBoundingClientRect();
    const buttonBottomGap = Math.max(0, wrapperRect.bottom - buttonRect.bottom);
    const safeAreaBottom = Number.parseFloat(
      getComputedStyle(stickyListToggle).getPropertyValue('--notification-sticky-safe-area')
    ) || 0;
    const maxButtonBottom = viewportBottom - safeAreaBottom - 6;
    const buttonBottom = Math.min(navigationTop - buttonBottomGap, maxButtonBottom);
    const wrapperBottom = buttonBottom + buttonBottomGap;
    document.body.style.setProperty(
      '--notification-list-sticky-bottom',
      `${scrollportBottom - wrapperBottom}px`
    );
  }

  function scheduleStickyPositionUpdate() {
    if (stickyPositionFrame) return;
    const update = () => {
      stickyPositionFrame = 0;
      updateStickyListTogglePosition();
      if (stickyNavigationTransitioning) {
        stickyPositionFrame = window.requestAnimationFrame(update);
      }
    };
    stickyPositionFrame = window.requestAnimationFrame(update);
  }

  function handleStickyNavigationTransition(event) {
    if (event.target !== stickyNavigation || event.propertyName !== 'transform') return;
    stickyNavigationTransitioning = event.type === 'transitionrun';
    scheduleStickyPositionUpdate();
  }

  function isStickyNavigationTransitioning() {
    const animations = stickyNavigation?.getAnimations?.() || [];
    return animations.some(animation =>
      animation.transitionProperty === 'transform' && animation.playState === 'running'
    );
  }

  function stopStickyPositionTracking() {
    if (stickyPositionFrame) window.cancelAnimationFrame(stickyPositionFrame);
    stickyPositionFrame = 0;
    if (stickyNavigation) {
      stickyNavigation.removeEventListener('transitionrun', handleStickyNavigationTransition);
      stickyNavigation.removeEventListener('transitionend', handleStickyNavigationTransition);
      stickyNavigation.removeEventListener('transitioncancel', handleStickyNavigationTransition);
    }
    window.removeEventListener('resize', scheduleStickyPositionUpdate);
    window.visualViewport?.removeEventListener('resize', scheduleStickyPositionUpdate);
    window.visualViewport?.removeEventListener('scroll', scheduleStickyPositionUpdate);
    stickyNavigation = null;
    stickyNavigationTransitioning = false;
  }

  function startStickyPositionTracking(mobileNavigation) {
    if (stickyNavigation === mobileNavigation) return;
    stopStickyPositionTracking();
    stickyNavigation = mobileNavigation;
    stickyNavigation.addEventListener('transitionrun', handleStickyNavigationTransition);
    stickyNavigation.addEventListener('transitionend', handleStickyNavigationTransition);
    stickyNavigation.addEventListener('transitioncancel', handleStickyNavigationTransition);
    window.addEventListener('resize', scheduleStickyPositionUpdate);
    window.visualViewport?.addEventListener('resize', scheduleStickyPositionUpdate);
    window.visualViewport?.addEventListener('scroll', scheduleStickyPositionUpdate);
  }

  function clearStickyListToggle() {
    stopStickyPositionTracking();
    stickyListToggle.remove();
    document.body.classList.remove('mobile-notification-list-expanded');
    document.body.style.removeProperty('--notification-list-sticky-bottom');
  }

  function placeStickyListToggle() {
    const mobileNavigation = document.querySelector('.mobile-bottom-nav');
    const notificationList = itemsContainer.closest('.notification-list');
    if (!mobileNavigation || !notificationList) return false;
    stickyListToggle.append(listToggle);
    notificationList.append(stickyListToggle);
    document.body.classList.add('mobile-notification-list-expanded');
    startStickyPositionTracking(mobileNavigation);
    updateStickyListTogglePosition();
    stickyNavigationTransitioning = isStickyNavigationTransitioning();
    if (stickyNavigationTransitioning) scheduleStickyPositionUpdate();
    return true;
  }

  function updateNotifications({animate = false} = {}) {
    if (!stateReady) {
      notificationEmpty.hidden = true;
      return;
    }
    const previousHeight = animate ? itemsContainer.getBoundingClientRect().height : 0;
    const unreadCount = notificationRows.filter(row => row.classList.contains('is-unread')).length;
    document.querySelectorAll('[data-count="all"]').forEach(count => { count.textContent = String(notificationRows.length); });
    document.querySelectorAll('[data-count="unread"]').forEach(count => { count.textContent = String(unreadCount); });
    document.querySelectorAll('#sidebarUnreadCount,#developerNotificationCount,.client-notification-count').forEach(count => {
      count.textContent = String(unreadCount);
      count.hidden = unreadCount === 0;
    });
    const notificationIcon = document.querySelector('.notification-icon');
    notificationIcon?.classList.toggle('is-clear', unreadCount === 0);
    const matchingRows = [];
    notificationRows.forEach(row => {
      const filterMatches = activeFilter === 'all'
        || activeFilter === 'unread' && row.classList.contains('is-unread')
        || row.dataset.kind === activeFilter;
      const queryMatches = !activeQuery || row.textContent.toLowerCase().includes(activeQuery);
      row.hidden = !(filterMatches && queryMatches);
      if (!row.hidden) matchingRows.push(row);
    });

    const isMobile = mobileListLayout.matches;
    notificationList?.classList.remove('has-mobile-overflow');
    notificationList?.style.removeProperty('--notification-list-collapsed-height');
    matchingRows.forEach(row => {
      row.classList.remove('is-mobile-collapsed');
      row.inert = false;
      row.removeAttribute('aria-hidden');
    });
    const groups = [...itemsContainer.querySelectorAll('[data-group]')];
    groups.forEach(group => {
      group.hidden = !group.querySelector('.notification-row:not([hidden])');
    });

    const displayBoundary = isMobile ? getMobileNotificationDisplayBoundary() : 0;
    const firstOverflowIndex = isMobile
      ? matchingRows.findIndex(row => row.getBoundingClientRect().bottom > displayBoundary + 0.5)
      : -1;
    const hasMore = firstOverflowIndex >= 0;
    matchingRows.forEach((row, index) => {
      const collapse = isMobile && !mobileListExpanded && hasMore && index >= firstOverflowIndex;
      row.classList.toggle('is-mobile-collapsed', collapse);
      row.inert = collapse;
      if (collapse) row.setAttribute('aria-hidden', 'true');
      else row.removeAttribute('aria-hidden');
    });
    groups.forEach(group => {
      group.hidden = !group.querySelector('.notification-row:not([hidden]):not(.is-mobile-collapsed)');
    });
    if (isMobile && hasMore && !mobileListExpanded && notificationList) {
      const collapsedHeight = Math.max(0, displayBoundary - itemsContainer.getBoundingClientRect().top);
      notificationList.classList.add('has-mobile-overflow');
      notificationList.style.setProperty('--notification-list-collapsed-height', `${collapsedHeight}px`);
    }

    if (isMobile && hasMore) {
      listToggle.textContent = mobileListExpanded ? 'View Less' : 'View All';
      listToggle.setAttribute('aria-expanded', String(mobileListExpanded));
      listToggle.hidden = false;
      if (mobileListExpanded) {
        if (!placeStickyListToggle()) {
          clearStickyListToggle();
          itemsContainer.append(listToggle);
        }
      } else {
        clearStickyListToggle();
        if (notificationList) notificationList.append(listToggle);
        else itemsContainer.append(listToggle);
      }
    } else {
      clearStickyListToggle();
      listToggle.hidden = true;
      listToggle.remove();
    }
    notificationEmpty.hidden = !stateReady || matchingRows.length > 0;
    if (stateReady) notificationStatus.hidden = true;
    buildActions();
    if (animate) animateListHeight(previousHeight);
  }

  function renderNotifications(notifications, actors, projects) {
    const groups = new Map();
    notifications.forEach(notification => {
      const {key, label} = groupFor(notification.created_at);
      if (!groups.has(key)) {
        const group = document.createElement('div');
        group.className = 'notification-group';
        group.dataset.group = '';
        group.dataset.groupKey = key;
        const heading = document.createElement('h2');
        heading.className = 'notification-day';
        heading.textContent = label;
        group.append(heading);
        groups.set(key, group);
        itemsContainer.append(group);
      }
      appendNotification(groups.get(key), notification, actors, projects);
    });
    notificationRows = [...itemsContainer.querySelectorAll('[data-notification]')];
    notificationRows.forEach(row => {
      if (readNotifications.has(row.dataset.notification)) row.classList.remove('is-unread');
    });
    updateNotifications();
  }

  function positionMarkAllReadButton() {
    if (!markAllReadButton || !notificationFilterActions || !notificationsHeading) return;
    if (desktopMarkAllLayout.matches) notificationFilterActions.append(markAllReadButton);
    else notificationsHeading.append(markAllReadButton);
  }

  function showLoadError(error) {
    console.error('Unable to load notifications from Supabase.', error);
    notificationStatus.textContent = 'Unable to load notifications. Check your connection and try again.';
    notificationStatus.hidden = false;
    notificationEmpty.hidden = true;
    itemsContainer.replaceChildren();
    document.querySelectorAll('[data-count]').forEach(count => { count.textContent = '—'; });
    actionList.replaceChildren();
    notificationRows = [];
    buildActions();
    updateNotifications();
  }

  const notificationStateReady = (async () => {
    if (!backend || !client) throw new Error('Supabase is unavailable.');
    const user = await backend.ready;
    if (!user) throw new Error('Your session is unavailable.');
    const [readIds, preferences, notificationResult] = await Promise.all([
      backend.loadNotificationReads(),
      backend.loadNotificationPreferences(),
      client.from('notifications')
        .select('id,recipient_id,recipient_role,actor_id,actor_role,kind,project_id,conversation_id,created_at')
        .eq('recipient_id', user.id).eq('recipient_role', workspace)
        .order('created_at', {ascending: false})
    ]);
    if (notificationResult.error) throw notificationResult.error;
    const notifications = notificationResult.data || [];
    notificationRecords = [...notifications];
    const readIdsSet = new Set(readIds);
    const unreadIds = notifications
      .map(notification => notification.id)
      .filter(id => !readIdsSet.has(id));
    newlyReceivedNotificationIds = new Set(unreadIds);
    if (unreadIds.length) {
      await backend.markNotificationsRead(unreadIds);
      unreadIds.forEach(id => readIdsSet.add(id));
      window.dispatchEvent(new Event('devmatch:notifications-changed'));
    }
    readNotifications.clear();
    readIdsSet.forEach(id => readNotifications.add(id));
    savedPreferences = preferences || {};
    preferenceInputs.forEach(input => {
      if (Object.hasOwn(savedPreferences, input.dataset.preference)) {
        input.checked = Boolean(savedPreferences[input.dataset.preference]);
      }
    });
    const actorIds = [...new Set(notifications.map(item => item.actor_id).filter(Boolean))];
    const projectIds = [...new Set(notifications.map(item => item.project_id).filter(Boolean))];
    const [actorsResult, projectsResult] = await Promise.all([
      actorIds.length ? client.from('directory_people').select('id,username,display_name,account_role').in('id', actorIds) : Promise.resolve({data: [], error: null}),
      projectIds.length ? client.from('projects').select('id,title,project_kind').in('id', projectIds) : Promise.resolve({data: [], error: null})
    ]);
    if (actorsResult.error) throw actorsResult.error;
    if (projectsResult.error) throw projectsResult.error;
    actorDirectory = new Map((actorsResult.data || []).map(actor => [actor.id + ':' + actor.account_role, actor.username || actor.display_name]));
    projectDirectory = new Map((projectsResult.data || []).map(project => [project.id, {
      title:project.title,
      kind:project.project_kind
    }]));
    itemsContainer.replaceChildren();
    stateReady = true;
    notificationStatus.hidden = true;
    notificationEmpty.textContent = 'No notifications match this filter.';
    notificationEmpty.hidden = false;
    renderNotifications(orderNotificationsNewestFirst(notificationRecords), actorDirectory, projectDirectory);
    pendingRealtimeNotifications.splice(0).forEach(receiveRealtimeNotification);
    return true;
  })().catch(error => {
    showLoadError(error);
    return false;
  });

  positionMarkAllReadButton();
  syncMobileFilterSelection(activeFilter);
  listToggle.addEventListener('click', () => {
    if (!mobileListLayout.matches) return;
    if (mobileListExpanded) {
      mobileListExpanded = false;
      const scrollRoot = itemsContainer.closest('main');
      if (scrollRoot) scrollRoot.scrollTop = mobileListExpandedScrollTop ?? 0;
      else window.scrollTo(0, mobileListExpandedScrollTop ?? 0);
      mobileListExpandedScrollTop = null;
    } else {
      const scrollRoot = itemsContainer.closest('main');
      mobileListExpandedScrollTop = scrollRoot ? scrollRoot.scrollTop : window.scrollY;
      mobileListExpanded = true;
    }
    updateNotifications({animate: true});
  });
  mobileListLayout.addEventListener('change', () => {
    cancelListHeightAnimation();
    mobileListExpanded = false;
    mobileListExpandedScrollTop = null;
    updateNotifications();
  });
  window.addEventListener('resize', scheduleMobileBoundaryUpdate);
  window.addEventListener('scroll', scheduleMobileBoundaryUpdate, {passive: true});
  window.visualViewport?.addEventListener('resize', scheduleMobileBoundaryUpdate);
  window.visualViewport?.addEventListener('scroll', scheduleMobileBoundaryUpdate);
  itemsContainer.closest('main')?.addEventListener('scroll', scheduleMobileBoundaryUpdate, {passive: true});
  if (typeof ResizeObserver === 'function') {
    mobileBoundaryResizeObserver = new ResizeObserver(scheduleMobileBoundaryUpdate);
    if (notificationList) mobileBoundaryResizeObserver.observe(notificationList);
    if (notificationsHeading) mobileBoundaryResizeObserver.observe(notificationsHeading);
  }
  window.addEventListener('devmatch:notification-received', event => {
    if (!mobileListLayout.matches || !(event instanceof CustomEvent)) return;
    const notification = event.detail;
    if (notification?.recipient_role !== workspace) return;
    receiveRealtimeNotification(notification);
  });
  desktopMarkAllLayout.addEventListener('change', () => {
    positionMarkAllReadButton();
    if (desktopMarkAllLayout.matches) {
      setMobileFilterMenuOpen(false);
      setMobileSettingsMenuOpen(false);
    }
  });
  mobileFilterToggle?.addEventListener('click', () => {
    setMobileFilterMenuOpen(mobileFilterToggle.getAttribute('aria-expanded') !== 'true');
  });
  mobileSettingsToggle?.addEventListener('click', () => {
    const open = mobileSettingsToggle.getAttribute('aria-expanded') !== 'true';
    if (open) setMobileFilterMenuOpen(false);
    setMobileSettingsMenuOpen(open);
  });
  mobileFilterMenu?.addEventListener('click', event => {
    const option = event.target instanceof Element
      ? event.target.closest('[data-notification-filter-option]')
      : null;
    if (!option) return;
    document.querySelector(`.notification-filter[data-filter="${option.dataset.notificationFilterOption}"]`)?.click();
    setMobileFilterMenuOpen(false);
  });
  mobileFilterPanel?.addEventListener('transitionend', event => {
    if (event.target !== mobileFilterPanel || event.propertyName !== 'transform'
      || !mobileFilterClosePending || mobileFilterToggle?.getAttribute('aria-expanded') === 'true') return;
    mobileFilterClosePending = false;
    mobileFilterMenu.hidden = true;
  });
  document.addEventListener('click', event => {
    if (!(event.target instanceof Node)) return;
    if (!mobileFilterMenu?.contains(event.target)
      && !mobileFilterToggle?.contains(event.target)) setMobileFilterMenuOpen(false);
    if (!mobileSettingsCard?.contains(event.target)
      && !mobileSettingsToggle?.contains(event.target)) setMobileSettingsMenuOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (mobileFilterToggle?.getAttribute('aria-expanded') === 'true') setMobileFilterMenuOpen(false, true);
    if (mobileSettingsToggle?.getAttribute('aria-expanded') === 'true') setMobileSettingsMenuOpen(false, true);
  });
  document.querySelectorAll('.notification-filter').forEach(button => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll('.notification-filter').forEach(filterButton => {
        const selected = filterButton === button;
        filterButton.classList.toggle('active', selected);
        filterButton.setAttribute('aria-pressed', String(selected));
      });
      syncMobileFilterSelection(activeFilter);
      updateNotifications();
    });
  });

  async function markRead(notificationId) {
    if (!await notificationStateReady) throw new Error('Notifications are not ready.');
    const row = notificationRows.find(item => item.dataset.notification === notificationId);
    if (!row || !row.classList.contains('is-unread')) return;
    await backend.markNotificationsRead([notificationId]);
    row.classList.remove('is-unread');
    readNotifications.add(notificationId);
    newlyReceivedNotificationIds.delete(notificationId);
    updateNotifications();
    window.dispatchEvent(new Event('devmatch:notifications-changed'));
  }

  markAllReadButton?.addEventListener('click', async () => {
    if (!await notificationStateReady) return;
    const ids = notificationRows.filter(row => row.classList.contains('is-unread')).map(row => row.dataset.notification);
    if (!ids.length) return;
    markAllReadButton.disabled = true;
    try {
      await backend.markNotificationsRead(ids);
      ids.forEach(id => {
        readNotifications.add(id);
        newlyReceivedNotificationIds.delete(id);
      });
      notificationRows.forEach(row => row.classList.remove('is-unread'));
      updateNotifications();
      window.dispatchEvent(new Event('devmatch:notifications-changed'));
    } catch (error) {
      console.error('Unable to mark notifications as read.', error);
      notificationStatus.textContent = 'Unable to save notification status. Please try again.';
      notificationStatus.hidden = false;
    } finally {
      markAllReadButton.disabled = false;
    }
  });

  document.addEventListener('click', async event => {
    const link = event.target.closest('[data-mark-read]');
    if (!link) return;
    const id = link.dataset.notificationLink || link.closest('[data-notification]')?.dataset.notification;
    if (!id) return;
    event.preventDefault();
    try {
      await markRead(id);
      window.location.assign(link.href);
    } catch (error) {
      console.error('Unable to mark notification as read.', error);
      notificationStatus.textContent = 'Unable to save notification status. Please try again.';
      notificationStatus.hidden = false;
    }
  });

  preferenceInputs.forEach(input => {
    input.addEventListener('change', async () => {
      if (!await notificationStateReady) return;
      const preferences = Object.fromEntries(preferenceInputs.map(item => [item.dataset.preference, item.checked]));
      try {
        await backend.saveNotificationPreferences(preferences);
        savedPreferences = preferences;
      } catch (error) {
        console.error('Unable to save notification preferences.', error);
        input.checked = !input.checked;
        notificationStatus.textContent = 'Unable to save notification preferences. Please try again.';
        notificationStatus.hidden = false;
      }
    });
  });

  const search = document.getElementById('searchInput');
  search?.addEventListener('input', () => {
    activeQuery = search.value.trim().toLowerCase();
    updateNotifications();
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      search?.focus();
    }
  });

  updateNotifications();
})();
