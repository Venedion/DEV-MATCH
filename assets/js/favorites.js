(function() {
  'use strict';

  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  const FAVORITES_KEY = 'devmatch-client-favorites';
  const DEV_FAVORITES_KEY = 'devmatch-client-dev-favorites';

  // Sample developers data
  const sampleDevelopers = [
    {
      id: 'rizkyaditya',
      name: 'Rizky Aditya',
      initials: 'RA',
      handle: '@rizkyaditya',
      role: 'Full-stack Developer',
      location: 'Medan',
      bio: 'Business websites and POS systems for Indonesian SMEs. 5 years shipping Laravel + React.',
      rating: '4.9',
      reviews: 24,
      projectsCount: 18,
      views: '4.2k',
      favorites: 312
    },
    {
      id: 'kevintanoto',
      name: 'Kevin Tanoto',
      initials: 'KT',
      handle: '@kevintanoto',
      role: 'Full-stack Developer',
      location: 'Bandung',
      bio: 'Building reliable business tools, point-of-sale systems, and dashboards for growing teams.',
      rating: '4.8',
      reviews: 19,
      projectsCount: 14,
      views: '3.8k',
      favorites: 246
    },
    {
      id: 'sarahn',
      name: 'Sarah Nasution',
      initials: 'SN',
      handle: '@sarahn',
      role: 'Frontend Specialist',
      location: 'Jakarta',
      bio: 'I design and build data-rich interfaces that make complex business metrics easy to understand.',
      rating: '5.0',
      reviews: 31,
      projectsCount: 21,
      views: '5.1k',
      favorites: 389
    }
  ];

  // Helper to get all projects
  function getAllProjects() {
    return window.DEVMATCH_SAMPLE_PROJECTS || [];
  }

  // Load favorites from localStorage
  function loadFavorites() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(FAVORITES_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
        // Seed default favorites if first time so it looks populated
        const defaultFavorites = ['restaurant', 'pos', 'booking'];
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(defaultFavorites));
        return defaultFavorites;
      }
    } catch (e) {
      console.warn('Failed to read favorites from localStorage', e);
    }
    return ['restaurant', 'pos', 'booking'];
  }

  function saveFavorites(favs) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
      }
    } catch (e) {
      console.warn('Failed to save favorites to localStorage', e);
    }
  }

  function loadDevFavorites() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(DEV_FAVORITES_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
        const defaultDevs = ['rizkyaditya', 'kevintanoto'];
        localStorage.setItem(DEV_FAVORITES_KEY, JSON.stringify(defaultDevs));
        return defaultDevs;
      }
    } catch (e) {
      console.warn('Failed to read dev favorites from localStorage', e);
    }
    return ['rizkyaditya', 'kevintanoto'];
  }

  function saveDevFavorites(devs) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DEV_FAVORITES_KEY, JSON.stringify(devs));
      }
    } catch (e) {
      console.warn('Failed to save dev favorites to localStorage', e);
    }
  }

  let favoriteProjectIds = loadFavorites();
  let favoriteDevIds = loadDevFavorites();
  let currentTab = 'projects'; // 'projects' or 'developers'
  let currentCategory = 'all';
  let searchQuery = '';
  let currentSort = 'recent';
  let lastRemovedItem = null;

  // DOM elements
  const favGridEl = document.getElementById('favGrid');
  const favCountEl = document.getElementById('favCount');
  const tabProjectsBtn = document.getElementById('tabProjects');
  const tabDevsBtn = document.getElementById('tabDevs');
  const countProjectsEl = document.getElementById('countProjects');
  const countDevsEl = document.getElementById('countDevs');
  const searchInputEl = document.getElementById('favSearchInput');
  const categorySelectEl = document.getElementById('favCategorySelect');
  const sortSelectEl = document.getElementById('favSortSelect');
  const toastEl = document.getElementById('favToast');
  const toastTextEl = document.getElementById('favToastText');
  const toastUndoBtn = document.getElementById('favToastUndo');
  let toastTimer = null;

  // Show Toast with undo option
  function showToast(message, undoCallback) {
    if (!toastEl) return;
    clearTimeout(toastTimer);
    toastTextEl.textContent = message;
    toastEl.classList.add('show');

    if (undoCallback) {
      toastUndoBtn.style.display = 'inline-block';
      toastUndoBtn.onclick = () => {
        undoCallback();
        toastEl.classList.remove('show');
      };
    } else {
      toastUndoBtn.style.display = 'none';
    }

    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 4500);
  }

  // Update counters
  function updateCounters() {
    const projCount = favoriteProjectIds.length;
    const devCount = favoriteDevIds.length;

    if (countProjectsEl) countProjectsEl.textContent = String(projCount);
    if (countDevsEl) countDevsEl.textContent = String(devCount);
    if (favCountEl) favCountEl.textContent = currentTab === 'projects' ? `${projCount} saved` : `${devCount} saved`;

    // Update sidebar badges if any
    document.querySelectorAll('#favoriteCount, .favorites-count-badge').forEach(badge => {
      badge.textContent = String(projCount);
    });
  }

  // Render Projects Grid
  function renderProjects() {
    const all = getAllProjects();
    let savedProjects = all.filter(p => favoriteProjectIds.includes(p.id));

    // Category filter
    if (currentCategory !== 'all') {
      savedProjects = savedProjects.filter(p => p.category.toLowerCase() === currentCategory.toLowerCase());
    }

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      savedProjects = savedProjects.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.developer.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }

    // Sort
    if (currentSort === 'price-low') {
      savedProjects.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    } else if (currentSort === 'price-high') {
      savedProjects.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    } else if (currentSort === 'title') {
      savedProjects.sort((a, b) => a.title.localeCompare(b.title));
    }

    if (savedProjects.length === 0) {
      favGridEl.innerHTML = `
        <div class="fav-empty-state">
          <div class="fav-empty-icon">
            <svg viewBox="0 0 24 24"><path d="m20.8 4.6-1.4-1.4a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>
          </div>
          <h3>No saved projects found</h3>
          <p>${favoriteProjectIds.length === 0 ? 'You haven’t saved any projects yet. Browse developer projects and click the heart icon to save your favorites.' : 'No saved projects match your filter or search query.'}</p>
          <a class="fav-btn primary" href="devmatch-discover-projects.html" style="margin:0 auto;display:inline-flex;">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>
            Discover Projects
          </a>
        </div>
      `;
      return;
    }

    favGridEl.innerHTML = savedProjects.map(project => `
      <article class="fav-card" data-project-id="${escapeHtml(project.id)}">
        <div class="fav-card-art ${escapeHtml(project.art || '')}">
          <span class="fav-card-badge">${escapeHtml(project.category)}</span>
          <button class="fav-remove-btn" type="button" data-remove-fav="${escapeHtml(project.id)}" title="Remove from favorites" aria-label="Remove ${escapeHtml(project.title)} from favorites">
            <svg viewBox="0 0 24 24"><path d="m20.8 4.6-1.4-1.4a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>
          </button>
          <div class="fav-art-window">
            <div class="fav-art-window-bar"><i></i><i></i><i></i></div>
            <div class="fav-art-mock">
              <div class="fav-art-side"></div>
              <div class="fav-art-body">
                <div class="fav-art-line short"></div>
                <div class="fav-art-line"></div>
                <div class="fav-art-line" style="width:75%;"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="fav-card-body">
          <span class="fav-card-type">${escapeHtml(project.type)}</span>
          <h3 class="fav-card-title">${escapeHtml(project.title)}</h3>
          <p class="fav-card-desc">${escapeHtml(project.description)}</p>

          <div class="fav-card-meta">
            <a class="fav-dev-pill" href="devmatch-developer-profile.html?developer=${encodeURIComponent(project.id)}">
              <span class="fav-dev-avatar">${escapeHtml(project.initials)}</span>
              <span class="fav-dev-name">${escapeHtml(project.developer)}</span>
            </a>
            <span class="fav-card-price">${escapeHtml(project.price)}</span>
          </div>
        </div>

        <footer class="fav-card-footer">
          <a class="fav-action-link primary" href="devmatch-chat.html?project=${encodeURIComponent(project.id)}">
            <svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-4A8.5 8.5 0 1 1 21 11.5z"/></svg>
            Chat with Dev
          </a>
          <a class="fav-action-link" href="devmatch-developer-profile.html?developer=${encodeURIComponent(project.id)}">
            View Details
          </a>
        </footer>
      </article>
    `).join('');

    // Attach remove handlers
    favGridEl.querySelectorAll('[data-remove-fav]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.removeFav;
        removeFavoriteProject(id);
      });
    });
  }

  // Render Developers Grid
  function renderDevelopers() {
    let savedDevs = sampleDevelopers.filter(d => favoriteDevIds.includes(d.id));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      savedDevs = savedDevs.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.role.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q)
      );
    }

    if (savedDevs.length === 0) {
      favGridEl.innerHTML = `
        <div class="fav-empty-state">
          <div class="fav-empty-icon">
            <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0m2-8a3 3 0 1 0 0-6m1 8a5 5 0 0 1 3 5"/></svg>
          </div>
          <h3>No saved developers found</h3>
          <p>Explore developer profiles on DEV-MATCH and bookmark your preferred partners to easily contact them anytime.</p>
          <a class="fav-btn primary" href="devmatch-landing.html#developers" style="margin:0 auto;display:inline-flex;">
            <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/></svg>
            Find Developers
          </a>
        </div>
      `;
      return;
    }

    favGridEl.innerHTML = savedDevs.map(dev => `
      <article class="fav-dev-card" data-dev-id="${escapeHtml(dev.id)}">
        <button class="fav-remove-btn" type="button" data-remove-dev="${escapeHtml(dev.id)}" title="Remove developer" aria-label="Remove ${escapeHtml(dev.name)} from favorites">
          <svg viewBox="0 0 24 24"><path d="m20.8 4.6-1.4-1.4a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>
        </button>

        <div class="fav-dev-card-top">
          <div class="fav-dev-card-avatar">${escapeHtml(dev.initials)}</div>
          <div class="fav-dev-card-info">
            <h3>${escapeHtml(dev.name)}</h3>
            <p>${escapeHtml(dev.role)} · ${escapeHtml(dev.location)}</p>
            <span class="fav-dev-rating">★ ${dev.rating} <small style="color:var(--muted);font-weight:400;">(${dev.reviews} reviews)</small></span>
          </div>
        </div>

        <p class="fav-dev-card-bio">${escapeHtml(dev.bio)}</p>

        <div class="fav-dev-stats-row">
          <div class="fav-dev-stat-box">
            <span>Projects</span>
            <strong>${dev.projectsCount}</strong>
          </div>
          <div class="fav-dev-stat-box">
            <span>Views</span>
            <strong>${dev.views}</strong>
          </div>
          <div class="fav-dev-stat-box">
            <span>Favorites</span>
            <strong>${dev.favorites}</strong>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-top:auto;">
          <a class="fav-action-link primary" href="devmatch-chat.html?contact=${encodeURIComponent(dev.id)}">
            <svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-4A8.5 8.5 0 1 1 21 11.5z"/></svg>
            Message
          </a>
          <a class="fav-action-link" href="devmatch-developer-profile.html?developer=restaurant">
            Full Profile
          </a>
        </div>
      </article>
    `).join('');

    favGridEl.querySelectorAll('[data-remove-dev]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.removeDev;
        removeFavoriteDev(id);
      });
    });
  }

  // Parse price helper: "Rp 3.500.000" -> 3500000
  function parsePrice(str) {
    if (!str) return 0;
    return Number(str.replace(/[^0-9]/g, '')) || 0;
  }

  // Remove a project favorite
  function removeFavoriteProject(id) {
    const card = document.querySelector(`.fav-card[data-project-id="${id}"]`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
    }

    setTimeout(() => {
      lastRemovedItem = { type: 'project', id };
      favoriteProjectIds = favoriteProjectIds.filter(item => item !== id);
      saveFavorites(favoriteProjectIds);
      updateCounters();
      renderCurrentTab();

      showToast('Project removed from favorites', () => {
        if (lastRemovedItem && lastRemovedItem.type === 'project') {
          favoriteProjectIds.push(lastRemovedItem.id);
          saveFavorites(favoriteProjectIds);
          updateCounters();
          renderCurrentTab();
        }
      });
    }, 200);
  }

  // Remove a developer favorite
  function removeFavoriteDev(id) {
    const card = document.querySelector(`.fav-dev-card[data-dev-id="${id}"]`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
    }

    setTimeout(() => {
      lastRemovedItem = { type: 'dev', id };
      favoriteDevIds = favoriteDevIds.filter(item => item !== id);
      saveDevFavorites(favoriteDevIds);
      updateCounters();
      renderCurrentTab();

      showToast('Developer removed from favorites', () => {
        if (lastRemovedItem && lastRemovedItem.type === 'dev') {
          favoriteDevIds.push(lastRemovedItem.id);
          saveDevFavorites(favoriteDevIds);
          updateCounters();
          renderCurrentTab();
        }
      });
    }, 200);
  }

  function renderCurrentTab() {
    if (currentTab === 'projects') {
      if (categorySelectEl) categorySelectEl.style.display = 'block';
      renderProjects();
    } else {
      if (categorySelectEl) categorySelectEl.style.display = 'none';
      renderDevelopers();
    }
  }

  // Tab switching
  if (tabProjectsBtn && tabDevsBtn) {
    tabProjectsBtn.addEventListener('click', () => {
      tabProjectsBtn.classList.add('active');
      tabDevsBtn.classList.remove('active');
      currentTab = 'projects';
      updateCounters();
      renderCurrentTab();
    });

    tabDevsBtn.addEventListener('click', () => {
      tabDevsBtn.classList.add('active');
      tabProjectsBtn.classList.remove('active');
      currentTab = 'developers';
      updateCounters();
      renderCurrentTab();
    });
  }

  // Search filter
  if (searchInputEl) {
    searchInputEl.addEventListener('input', () => {
      searchQuery = searchInputEl.value.trim();
      renderCurrentTab();
    });
  }

  // Category filter
  if (categorySelectEl) {
    categorySelectEl.addEventListener('change', () => {
      currentCategory = categorySelectEl.value;
      renderCurrentTab();
    });
  }

  // Sort
  if (sortSelectEl) {
    sortSelectEl.addEventListener('change', () => {
      currentSort = sortSelectEl.value;
      renderCurrentTab();
    });
  }

  // Clear all button
  const clearAllBtn = document.getElementById('favClearAllBtn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (currentTab === 'projects') {
        if (favoriteProjectIds.length === 0) return;
        if (confirm('Are you sure you want to clear all saved projects?')) {
          favoriteProjectIds = [];
          saveFavorites(favoriteProjectIds);
          updateCounters();
          renderCurrentTab();
          showToast('All saved projects cleared');
        }
      } else {
        if (favoriteDevIds.length === 0) return;
        if (confirm('Are you sure you want to clear all saved developers?')) {
          favoriteDevIds = [];
          saveDevFavorites(favoriteDevIds);
          updateCounters();
          renderCurrentTab();
          showToast('All saved developers cleared');
        }
      }
    });
  }

  // Load user profile details in topbar
  function loadUserProfile() {
    try {
      const isClient = new URLSearchParams(window.location.search).get('role') === 'client';
      document.body.classList.toggle('client-shell-page', isClient);
      const key = isClient ? 'devmatch-profile-client' : 'devmatch-profile-dev';
      const profile = JSON.parse(localStorage.getItem(key) || '{}');
      const name = profile.displayName || (isClient ? 'Client' : 'Developer');
      const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'DM';

      const userAvatarEl = document.getElementById('userAvatar');
      const topUserNameEl = document.getElementById('topUserName');
      if (userAvatarEl) userAvatarEl.textContent = initials;
      if (topUserNameEl) topUserNameEl.textContent = name;

      if (isClient) {
        const messagesLink = document.querySelector('.side-nav a[href="devmatch-chat.html"], .side-nav a[href="devmatch-chat.html?role=client"]');
        if (messagesLink) messagesLink.href = 'devmatch-chat.html?role=client';
        const notificationsUrl = 'devmatch-notifications.html';
        document.querySelectorAll('.notification-button, .client-icon-button').forEach(link => {
          link.href = notificationsUrl;
        });
        const notificationsLink = [...document.querySelectorAll('.side-nav a, .client-nav a')]
          .find(link => link.textContent.trim().startsWith('Notifications'));
        if (notificationsLink) notificationsLink.href = notificationsUrl;
        document.querySelectorAll('.mode').forEach(m => m.classList.remove('active'));
        const clientMode = document.querySelector('.mode-switch a[href*="client"]');
        if (clientMode) clientMode.classList.add('active');

        const workspaceBadge = document.querySelector('.workspace');
        if (workspaceBadge) {
          workspaceBadge.innerHTML = `<span class="workspace-icon"><svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span><span><b>Client workspace</b><small>Discover &amp; hire</small></span>`;
        }

        const sideAdd = document.querySelector('.side-add');
        if (sideAdd) {
          sideAdd.href = 'devmatch-client-dashboard.html#requests';
          sideAdd.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>Post a Request`;
        }

        const overviewLink = document.querySelector('.side-nav a[href="devmatch-dashboard.html"]');
        if (overviewLink) {
          overviewLink.href = 'devmatch-client-dashboard.html';
        }
      }
    } catch (e) {}
  }

  // Initialize
  loadUserProfile();
  updateCounters();
  renderCurrentTab();

})();
