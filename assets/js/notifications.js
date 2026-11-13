(() => {
  const workspace = document.body.dataset.workspace || 'client';
  const backend = window.devMatchBackend;
  const client = backend?.client;
  const markAllReadButton = document.getElementById('markAllRead');
  const notificationsHeading = document.querySelector('.notifications-heading');
  const notificationFilterActions = document.querySelector('.notification-filter-actions');
  const desktopMarkAllLayout = window.matchMedia('(min-width: 601px)');
  const itemsContainer = document.getElementById('notificationItems');
  const notificationStatus = document.getElementById('notificationStatus');
  const notificationEmpty = document.getElementById('notificationEmpty');
  const actionList = document.getElementById('notificationActions');
  const preferenceInputs = [...document.querySelectorAll('[data-preference]')];
  const readNotifications = new Set();
  let notificationRows = [];
  let savedPreferences = {};
  let activeFilter = 'all';
  let activeQuery = '';
  let stateReady = false;

  const kindDetails = kind => {
    const value = String(kind || '').toLowerCase();
    if (value.includes('comment') || value.includes('reply')) return {filter: 'comments', label: 'commented on', badge: '“'};
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

  function actionHref(notification) {
    if (notification.conversation_id) {
      const role = workspace === 'client' ? '&role=client' : '';
      return `devmatch-chat.html?conversation=${encodeURIComponent(notification.conversation_id)}${role}`;
    }
    const category = kindDetails(notification.kind).filter;
    if (category === 'messages') return workspace === 'client' ? 'devmatch-chat.html?role=client' : 'devmatch-chat.html';
    if (category === 'comments') {
      return workspace === 'client' ? 'devmatch-client-dashboard.html#requests' : 'devmatch-dashboard.html#interactions';
    }
    if (category === 'ratings') {
      return workspace === 'client' ? 'devmatch-find-developers.html' : 'devmatch-my-profile.html?role=dev';
    }
    return workspace === 'client' ? 'devmatch-client-dashboard.html#requests' : 'devmatch-my-projects.html';
  }

  function appendNotification(row, notification, actors, projects) {
    const detail = kindDetails(notification.kind);
    const actorName = actors.get(notification.actor_id) || 'A member';
    const projectTitle = projects.get(notification.project_id) || 'your project';
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
    const action = document.createElement('a');
    action.className = 'notification-action';
    action.href = actionHref(notification);
    action.dataset.markRead = '';
    action.textContent = detail.filter === 'comments' ? 'Reply' : detail.filter === 'messages' ? 'Open chat' : 'View';
    article.append(dot, avatar, copy, time, action);
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

  function updateNotifications() {
    const unreadCount = notificationRows.filter(row => row.classList.contains('is-unread')).length;
    document.querySelectorAll('[data-count="all"]').forEach(count => { count.textContent = String(notificationRows.length); });
    document.querySelectorAll('[data-count="unread"]').forEach(count => { count.textContent = String(unreadCount); });
    document.querySelectorAll('#sidebarUnreadCount,#developerNotificationCount,.client-notification-count').forEach(count => {
      count.textContent = String(unreadCount);
      count.hidden = unreadCount === 0;
    });
    const notificationIcon = document.querySelector('.notification-icon');
    notificationIcon?.classList.toggle('is-clear', unreadCount === 0);
    let visibleCount = 0;
    notificationRows.forEach(row => {
      const filterMatches = activeFilter === 'all'
        || activeFilter === 'unread' && row.classList.contains('is-unread')
        || row.dataset.kind === activeFilter;
      const queryMatches = !activeQuery || row.textContent.toLowerCase().includes(activeQuery);
      row.hidden = !(filterMatches && queryMatches);
      if (!row.hidden) visibleCount++;
    });
    document.querySelectorAll('[data-group]').forEach(group => {
      group.hidden = !group.querySelector('.notification-row:not([hidden])');
    });
    notificationEmpty.hidden = !stateReady || visibleCount > 0;
    if (stateReady) notificationStatus.hidden = true;
    buildActions();
  }

  function renderNotifications(notifications, actors, projects) {
    const groups = new Map();
    notifications.forEach(notification => {
      const {key, label} = groupFor(notification.created_at);
      if (!groups.has(key)) {
        const group = document.createElement('div');
        group.className = 'notification-group';
        group.dataset.group = '';
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
        .select('id,recipient_id,actor_id,kind,project_id,conversation_id,created_at')
        .eq('recipient_id', user.id)
        .order('created_at', {ascending: false})
        .limit(100)
    ]);
    if (notificationResult.error) throw notificationResult.error;
    readNotifications.clear();
    readIds.forEach(id => readNotifications.add(id));
    savedPreferences = preferences || {};
    preferenceInputs.forEach(input => {
      if (Object.hasOwn(savedPreferences, input.dataset.preference)) {
        input.checked = Boolean(savedPreferences[input.dataset.preference]);
      }
    });
    const notifications = notificationResult.data || [];
    const actorIds = [...new Set(notifications.map(item => item.actor_id).filter(Boolean))];
    const projectIds = [...new Set(notifications.map(item => item.project_id).filter(Boolean))];
    const [actorsResult, projectsResult] = await Promise.all([
      actorIds.length ? client.from('directory_people').select('id,display_name').in('id', actorIds) : Promise.resolve({data: [], error: null}),
      projectIds.length ? client.from('projects').select('id,title').in('id', projectIds) : Promise.resolve({data: [], error: null})
    ]);
    if (actorsResult.error) throw actorsResult.error;
    if (projectsResult.error) throw projectsResult.error;
    const actors = new Map((actorsResult.data || []).map(actor => [actor.id, actor.display_name]));
    const projects = new Map((projectsResult.data || []).map(project => [project.id, project.title]));
    itemsContainer.replaceChildren();
    stateReady = true;
    notificationStatus.hidden = true;
    notificationEmpty.textContent = 'No notifications match this filter.';
    notificationEmpty.hidden = false;
    renderNotifications(notifications, actors, projects);
    return true;
  })().catch(error => {
    showLoadError(error);
    return false;
  });

  positionMarkAllReadButton();
  desktopMarkAllLayout.addEventListener('change', positionMarkAllReadButton);
  document.querySelectorAll('.notification-filter').forEach(button => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll('.notification-filter').forEach(filterButton => {
        const selected = filterButton === button;
        filterButton.classList.toggle('active', selected);
        filterButton.setAttribute('aria-pressed', String(selected));
      });
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
    updateNotifications();
  }

  markAllReadButton?.addEventListener('click', async () => {
    if (!await notificationStateReady) return;
    const ids = notificationRows.filter(row => row.classList.contains('is-unread')).map(row => row.dataset.notification);
    if (!ids.length) return;
    markAllReadButton.disabled = true;
    try {
      await backend.markNotificationsRead(ids);
      ids.forEach(id => readNotifications.add(id));
      notificationRows.forEach(row => row.classList.remove('is-unread'));
      updateNotifications();
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
