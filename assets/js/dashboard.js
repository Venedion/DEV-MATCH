(() => {
  const backend = window.devMatchBackend;
  const client = backend?.client;
  const formatNumber = value => Number.isFinite(Number(value))
    ? Number(value).toLocaleString('en-US')
    : '—';
  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };
  const profile = JSON.parse(localStorage.getItem('devmatch-profile-dev') || '{}');
  const displayName = typeof profile.displayName === 'string' && profile.displayName.trim()
    ? profile.displayName.trim()
    : 'Developer';
  const nameParts = displayName.split(/\s+/).filter(Boolean);
  setText('#welcomeName', nameParts[0] || 'Developer');
  setText('#topUserName', displayName);
  setText('#userAvatar', nameParts.slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'DM');

  const metricElements = {
    projects: document.getElementById('totalProjects'),
    views: document.getElementById('totalViews'),
    favorites: document.getElementById('totalFavorites'),
    comments: document.getElementById('totalComments')
  };
  const projectList = document.getElementById('projectList');
  const commentsList = document.querySelector('.comment-list');
  const interactionList = document.querySelector('.interaction-list');
  const stateText = {
    loading: 'Loading your dashboard…',
    emptyProjects: 'No projects yet. Add a project to see it here.',
    emptyComments: 'No comments on your projects yet.',
    emptyActivity: 'Recent project activity will appear here.',
    error: 'Unable to load dashboard data. Check your connection and try again.'
  };

  function showMessage(container, message, className = 'dashboard-empty') {
    const paragraph = document.createElement('p');
    paragraph.className = className;
    paragraph.textContent = message;
    container.replaceChildren(paragraph);
  }

  function initials(value) {
    return String(value || '').trim().split(/\s+/).slice(0, 2)
      .map(part => part[0] || '').join('').toUpperCase() || '•';
  }

  function timeAgo(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';
    const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  function activityCategory(kind) {
    const value = String(kind || '').toLowerCase();
    if (value.includes('comment') || value.includes('reply')) return 'comments';
    if (value.includes('message') || value.includes('conversation')) return 'messages';
    if (value.includes('favorite') || value.includes('favourite') || value.includes('save')) return 'favorites';
    if (value.includes('rating') || value.includes('review')) return 'ratings';
    return 'updates';
  }

  function activityVerb(category) {
    return ({
      comments: 'commented on',
      messages: 'sent a message about',
      favorites: 'saved',
      ratings: 'left a rating for',
      updates: 'updated'
    })[category];
  }

  async function loadMetrics(user) {
    const { data, error } = await client.rpc('get_dashboard_metrics');
    if (error) throw error;
    const metrics = typeof data === 'string' ? JSON.parse(data) : data;
    if (!metrics || typeof metrics !== 'object'
      || Object.keys(metricElements).some(key => metrics[key] == null || !Number.isFinite(Number(metrics[key])))) {
      throw new Error('Dashboard metrics are unavailable.');
    }
    Object.entries(metricElements).forEach(([key, element]) => {
      if (element) element.textContent = formatNumber(metrics[key]);
    });
    const chartViews = document.getElementById('chartViews');
    if (chartViews) chartViews.textContent = formatNumber(metrics.views);
    const status = document.getElementById('dashboardStatus');
    if (status) status.hidden = true;
    return user;
  }

  async function loadProjects(user) {
    const { data, error } = await client.from('projects')
      .select('id,title,project_type,status')
      .eq('owner_id', user.id)
      .eq('project_kind', 'portfolio')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    if (!data?.length) {
      showMessage(projectList, stateText.emptyProjects);
      return [];
    }
    projectList.replaceChildren();
    data.slice(0, 5).forEach(project => {
      const row = document.createElement('article');
      row.className = 'project-row';
      const info = document.createElement('div');
      info.className = 'project-info';
      const thumb = document.createElement('span');
      thumb.className = 'project-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      thumb.textContent = '↗';
      const copy = document.createElement('div');
      const title = document.createElement('h3');
      title.className = 'project-name';
      title.textContent = project.title || 'Untitled project';
      const type = document.createElement('p');
      type.className = 'project-type';
      type.textContent = project.project_type || 'Project';
      copy.append(title, type);
      const status = document.createElement('p');
      status.className = 'project-views';
      status.textContent = project.status === 'published' ? 'Published' : 'Draft';
      info.append(thumb, copy, status);
      row.append(info);
      projectList.append(row);
    });
    return data;
  }

  async function loadComments(projects) {
    if (!projects.length) {
      showMessage(commentsList, stateText.emptyComments, 'range-empty');
      return;
    }
    const { data, error } = await client.from('comments')
      .select('id,project_id,text,author_name,created_at')
      .in('project_id', projects.map(project => project.id))
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    if (!data?.length) {
      showMessage(commentsList, stateText.emptyComments, 'range-empty');
      return;
    }
    const titles = new Map(projects.map(project => [project.id, project.title || 'Project']));
    commentsList.replaceChildren();
    data.forEach(comment => {
      const item = document.createElement('article');
      item.className = 'comment';
      const avatar = document.createElement('span');
      avatar.className = 'comment-avatar';
      avatar.textContent = initials(comment.author_name);
      const copy = document.createElement('p');
      const name = document.createElement('b');
      name.textContent = comment.author_name || 'A member';
      const projectTitle = document.createElement('strong');
      projectTitle.textContent = titles.get(comment.project_id) || 'Project';
      const body = document.createElement('span');
      body.textContent = comment.text || '';
      copy.append(name, document.createTextNode(' on '), projectTitle, body);
      const time = document.createElement('time');
      time.dateTime = comment.created_at;
      time.textContent = timeAgo(comment.created_at);
      item.append(avatar, copy, time);
      commentsList.append(item);
    });
  }

  async function loadActivity(user, projects) {
    const { data, error } = await client.from('notifications')
      .select('id,actor_id,kind,project_id,conversation_id,created_at')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    if (!data?.length) {
      showMessage(interactionList, stateText.emptyActivity, 'range-empty');
      return;
    }
    const actorIds = [...new Set(data.map(item => item.actor_id).filter(Boolean))];
    const projectIds = [...new Set(data.map(item => item.project_id).filter(Boolean))];
    const [actorsResult, projectsResult] = await Promise.all([
      actorIds.length
        ? client.from('directory_people').select('id,display_name').in('id', actorIds)
        : Promise.resolve({ data: [], error: null }),
      projectIds.length
        ? client.from('projects').select('id,title').in('id', projectIds)
        : Promise.resolve({ data: [], error: null })
    ]);
    if (actorsResult.error) throw actorsResult.error;
    if (projectsResult.error) throw projectsResult.error;
    const names = new Map((actorsResult.data || []).map(actor => [actor.id, actor.display_name]));
    const titles = new Map(projects.map(project => [project.id, project.title]));
    (projectsResult.data || []).forEach(project => titles.set(project.id, project.title));
    interactionList.replaceChildren();
    data.forEach(entry => {
      const category = activityCategory(entry.kind);
      const item = document.createElement('p');
      const icon = document.createElement('span');
      icon.className = `interaction-icon${category === 'messages' ? ' message' : category === 'favorites' ? '' : ' view'}`;
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = category === 'favorites' ? '♡' : category === 'comments' ? '“' : category === 'messages' ? '✉' : '•';
      const copy = document.createElement('span');
      const actor = document.createElement('b');
      actor.textContent = names.get(entry.actor_id) || 'A member';
      const description = document.createTextNode(` ${activityVerb(category)} `);
      const project = document.createElement('strong');
      project.textContent = titles.get(entry.project_id) || (entry.conversation_id ? 'your conversation' : 'your work');
      const time = document.createElement('small');
      time.textContent = timeAgo(entry.created_at);
      copy.append(actor, description, project, time);
      item.append(icon, copy);
      interactionList.append(item);
    });
  }

  function setError(container, message, className = 'dashboard-empty') {
    if (container) showMessage(container, message, className);
  }

  async function start() {
    showMessage(projectList, stateText.loading);
    showMessage(commentsList, stateText.loading, 'range-empty');
    showMessage(interactionList, stateText.loading, 'range-empty');
    const status = document.getElementById('dashboardStatus');
    if (status) {
      status.textContent = stateText.loading;
      status.hidden = false;
    }
    if (!backend || !client) {
      if (status) {
        status.textContent = stateText.error;
        status.hidden = false;
      }
      Object.values(metricElements).forEach(element => { if (element) element.textContent = '—'; });
      setError(projectList, stateText.error);
      setError(commentsList, stateText.error);
      setError(interactionList, stateText.error);
      return;
    }
    try {
      const user = await backend.ready;
      if (!user) return;
      const projectResult = await loadProjects(user).catch(error => {
        console.error('Unable to load dashboard projects.', error);
        setError(projectList, stateText.error);
        return [];
      });
      const tasks = [
        loadMetrics(user).catch(error => {
          console.error('Unable to load dashboard metrics.', error);
          Object.values(metricElements).forEach(element => { if (element) element.textContent = '—'; });
          if (status) {
            status.textContent = stateText.error;
            status.hidden = false;
          }
        }),
        loadComments(projectResult).catch(error => {
          console.error('Unable to load dashboard comments.', error);
          setError(commentsList, stateText.error, 'range-empty');
        }),
        loadActivity(user, projectResult).catch(error => {
          console.error('Unable to load dashboard activity.', error);
          setError(interactionList, stateText.error, 'range-empty');
        })
      ];
      await Promise.all(tasks);
      const readIds = await backend.loadNotificationReads();
      const { data: notifications, error } = await client.from('notifications')
        .select('id')
        .eq('recipient_id', user.id);
      if (error) throw error;
      const unreadCount = (notifications || []).filter(item => !readIds.includes(item.id)).length;
      const badge = document.getElementById('developerNotificationCount');
      badge.textContent = String(unreadCount);
      badge.hidden = unreadCount === 0;
      const dot = document.querySelector('.notification-button i');
      if (dot) dot.hidden = unreadCount === 0;
    } catch (error) {
      console.error('Unable to load dashboard data.', error);
      if (status) {
        status.textContent = stateText.error;
        status.hidden = false;
      }
    }
  }

  const search = document.getElementById('searchInput');
  search?.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    document.querySelectorAll('.project-row,.comment').forEach(row => {
      row.hidden = !!query && !row.textContent.toLowerCase().includes(query);
    });
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      search?.focus();
    }
  });
  start();
})();
