/**
 * Favorites Page Logic - DEV-MATCH
 * Fully mode-aware:
 * - Developer Mode: saved projects and saved clients
 * - Client Mode: saved projects and saved developers
 * Strictly separated storage per mode.
 */

(function() {
  'use strict';

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  // Mode detection
  const urlParams = new URLSearchParams(window.location.search);
  const isClient = urlParams.get('role') === 'client' || document.body.classList.contains('client-shell-page');

  // Storage Keys
  const PROJECTS_KEY = isClient ? 'devmatch-client-project-favorites' : 'devmatch-developer-project-favorites';
  const CLIENTS_KEY = 'devmatch-favorite-clients';
  const DEVS_KEY = 'devmatch-client-dev-favorites';
  if (localStorage.getItem(PROJECTS_KEY) === null) {
    const legacyProjects = localStorage.getItem('devmatch-client-favorites');
    if (legacyProjects !== null) localStorage.setItem(PROJECTS_KEY, legacyProjects);
  }

  // Helper getters
  function getAllProjects() {
    return Array.isArray(window.DEVMATCH_SAMPLE_PROJECTS) ? window.DEVMATCH_SAMPLE_PROJECTS : [];
  }

  function getAllClients() {
    return Array.isArray(window.DEVMATCH_SAMPLE_CLIENTS) ? window.DEVMATCH_SAMPLE_CLIENTS : [];
  }

  function getAllDevelopers() {
    return Array.isArray(window.DEVMATCH_SAMPLE_DEVELOPERS) ? window.DEVMATCH_SAMPLE_DEVELOPERS : [];
  }

  // Load Saved Projects
  function loadProjectFavorites() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(PROJECTS_KEY);
        if (stored) return JSON.parse(stored);
        const defaultFavorites = isClient ? ['restaurant', 'pos', 'booking'] : ['pos', 'inventory'];
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(defaultFavorites));
        return defaultFavorites;
      }
    } catch (e) {
      console.warn('Failed to read project favorites from localStorage', e);
    }
    return ['restaurant', 'pos', 'booking'];
  }

  function saveProjectFavorites(favs) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(favs));
      }
    } catch (e) {
      console.warn('Failed to save project favorites to localStorage', e);
    }
  }

  // Load Saved Clients (Developer Mode)
  function loadClientFavorites() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(CLIENTS_KEY);
        if (stored) return JSON.parse(stored);
        const defaultClients = ['jessica-sitorus', 'klinik-sehat-bersama'];
        localStorage.setItem(CLIENTS_KEY, JSON.stringify(defaultClients));
        return defaultClients;
      }
    } catch (e) {
      console.warn('Failed to read client favorites from localStorage', e);
    }
    return ['jessica-sitorus', 'klinik-sehat-bersama'];
  }

  function saveClientFavorites(clients) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
      }
    } catch (e) {
      console.warn('Failed to save client favorites to localStorage', e);
    }
  }

  // Load Saved Developers (Client Mode)
  function loadDevFavorites() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(DEVS_KEY);
        if (stored) return JSON.parse(stored);
        const defaultDevs = ['rizky-aditya'];
        localStorage.setItem(DEVS_KEY, JSON.stringify(defaultDevs));
        return defaultDevs;
      }
    } catch (e) {
      console.warn('Failed to read developer favorites from localStorage', e);
    }
    return ['rizky-aditya'];
  }

  function saveDevFavorites(devs) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DEVS_KEY, JSON.stringify(devs));
      }
    } catch (e) {
      console.warn('Failed to save developer favorites to localStorage', e);
    }
  }

  // State
  let favoriteProjectIds = loadProjectFavorites();
  let favoriteClientIds = loadClientFavorites();
  let favoriteDevIds = loadDevFavorites();
  let currentTab = 'projects'; // 'projects' or ('clients' in dev mode / 'developers' in client mode)
  let currentCategory = 'all';
  let searchQuery = '';
  let currentSort = 'recent';
  let lastRemovedItem = null;

  // DOM Elements
  const favGridEl = document.getElementById('favGrid');
  const favCountEl = document.getElementById('favCount');
  const tabProjectsBtn = document.getElementById('tabProjects');
  const tabSecondaryBtn = document.getElementById('tabClients') || document.getElementById('tabDevs');
  const countProjectsEl = document.getElementById('countProjects');
  const countSecondaryEl = document.getElementById('countClients') || document.getElementById('countDevs');
  const searchInputEl = document.getElementById('favSearchInput');
  const categorySelectEl = document.getElementById('favCategorySelect');
  const sortSelectEl = document.getElementById('favSortSelect');
  const favExploreBtn = document.getElementById('favExploreBtn');
  const favClientDialog = document.getElementById('favClientDialog');
  const favDialogCloseBtn = document.getElementById('favDialogCloseBtn');
  const favDialogContent = document.getElementById('favDialogContent');
  const toastEl = document.getElementById('favToast');
  const toastTextEl = document.getElementById('favToastText');
  const toastUndoBtn = document.getElementById('favToastUndo');
  let toastTimer = null;

  // Setup tab label dynamically based on mode
  if (tabSecondaryBtn) {
    if (isClient) {
      tabSecondaryBtn.id = 'tabDevs';
      tabSecondaryBtn.innerHTML = `Saved Developers <span class="fav-tab-count" id="countDevs">${favoriteDevIds.length}</span>`;
    } else {
      tabSecondaryBtn.innerHTML = `Saved Clients <span class="fav-tab-count" id="countClients">${favoriteClientIds.length}</span>`;
    }
  }

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

  // Update counters across page and sidebar
  function updateCounters() {
    const projCount = favoriteProjectIds.length;
    const secondaryCount = isClient ? favoriteDevIds.length : favoriteClientIds.length;

    if (countProjectsEl) countProjectsEl.textContent = String(projCount);
    const countBadge = document.getElementById(isClient ? 'countDevs' : 'countClients') || countSecondaryEl;
    if (countBadge) countBadge.textContent = String(secondaryCount);

    if (favCountEl) {
      favCountEl.textContent = currentTab === 'projects' ? `${projCount} saved` : `${secondaryCount} saved`;
    }

    // Total favorites in sidebar
    document.querySelectorAll('#favoriteCount, .favorites-count-badge').forEach(badge => {
      badge.textContent = String(projCount + secondaryCount);
    });
  }

  // Update Category Select Options depending on current tab
  function updateCategoryOptions() {
    if (!categorySelectEl) return;

    if (currentTab === 'projects') {
      categorySelectEl.innerHTML = `
        <option value="all">All Categories</option>
        <option value="Company Profile">Company Profile</option>
        <option value="POS">POS</option>
        <option value="Booking">Booking</option>
        <option value="Inventory">Inventory</option>
        <option value="E-Commerce">E-Commerce</option>
        <option value="Other">Other</option>
      `;
    } else if (isClient) {
      // Client mode: Filter developers by specialization
      categorySelectEl.innerHTML = `
        <option value="all">All Specializations</option>
        <option value="Full-stack">Full-stack</option>
        <option value="Frontend">Frontend</option>
        <option value="Backend">Backend</option>
        <option value="Mobile">Mobile</option>
        <option value="UI/UX">UI/UX Design</option>
      `;
    } else {
      // Developer mode: Filter clients by business type
      categorySelectEl.innerHTML = `
        <option value="all">All Business Types</option>
        <option value="Café">Café / F&amp;B</option>
        <option value="Retail">Retail / Fashion</option>
        <option value="Healthcare">Healthcare Clinic</option>
        <option value="Building materials">Building Materials</option>
        <option value="Hospitality">Homestay / Hospitality</option>
        <option value="Distribution">Distribution &amp; Logistics</option>
        <option value="Services">Services &amp; Legal</option>
      `;
    }
    categorySelectEl.value = 'all';
    currentCategory = 'all';
  }

  // Update Sort Select Options depending on current tab
  function updateSortOptions() {
    if (!sortSelectEl) return;

    if (currentTab === 'projects') {
      sortSelectEl.innerHTML = `
        <option value="recent">Recently Added</option>
        <option value="price-low">Price: Low to High</option>
        <option value="price-high">Price: High to Low</option>
        <option value="name">Title A–Z</option>
      `;
    } else if (isClient) {
      sortSelectEl.innerHTML = `
        <option value="recent">Recently Added</option>
        <option value="name">Name A–Z</option>
        <option value="projects">Most Projects</option>
        <option value="views">Most Views</option>
      `;
    } else {
      sortSelectEl.innerHTML = `
        <option value="recent">Recently Added</option>
        <option value="name">Name A–Z</option>
        <option value="requests">Most Open Requests</option>
      `;
    }
    sortSelectEl.value = 'recent';
    currentSort = 'recent';
  }

  // Render Projects Grid
  function renderProjects() {
    const all = getAllProjects();
    let savedProjects = all.filter(p => favoriteProjectIds.includes(p.id));

    if (currentCategory !== 'all') {
      savedProjects = savedProjects.filter(p => p.category.toLowerCase() === currentCategory.toLowerCase());
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      savedProjects = savedProjects.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.developer.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }

    if (currentSort === 'price-low') {
      savedProjects.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    } else if (currentSort === 'price-high') {
      savedProjects.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    } else if (currentSort === 'name') {
      savedProjects.sort((a, b) => a.title.localeCompare(b.title));
    }

    if (savedProjects.length === 0) {
      const exploreUrl = isClient ? 'devmatch-discover-projects.html' : 'devmatch-find-projects.html';
      favGridEl.innerHTML = `
        <div class="fav-empty-state">
          <div class="fav-empty-icon">
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </div>
          <h3>No saved projects found</h3>
          <p>${favoriteProjectIds.length === 0 ? 'You haven’t saved any projects yet. Browse developer projects and click the heart icon to save your favorites.' : 'No saved projects match your filter or search query.'}</p>
          <a class="fav-btn primary" href="${exploreUrl}" style="margin:0 auto;display:inline-flex;">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>
            Explore Projects
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
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
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
          <a class="fav-action-link primary" href="devmatch-chat.html?project=${encodeURIComponent(project.id)}${isClient ? '&role=client' : ''}">
            <svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-4A8.5 8.5 0 1 1 21 11.5z"/></svg>
            Chat with Dev
          </a>
          <a class="fav-action-link" href="devmatch-developer-profile.html?developer=${encodeURIComponent(project.id)}">
            View Details
          </a>
        </footer>
      </article>
    `).join('');

    favGridEl.querySelectorAll('[data-remove-fav]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFavoriteProject(btn.dataset.removeFav);
      });
    });
  }

  // Render Saved Clients Grid (Developer Mode: from Find Clients tab)
  function renderClients() {
    const all = getAllClients();
    let savedClients = all.filter(c => favoriteClientIds.includes(c.id));

    if (currentCategory !== 'all') {
      savedClients = savedClients.filter(c =>
        c.category === currentCategory || c.businessType === currentCategory
      );
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      savedClients = savedClients.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.business.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q)
      );
    }

    if (currentSort === 'name') {
      savedClients.sort((a, b) => a.name.localeCompare(b.name));
    } else if (currentSort === 'requests') {
      savedClients.sort((a, b) => b.openRequestsCount - a.openRequestsCount);
    } else {
      savedClients.sort((a, b) => {
        const idxA = favoriteClientIds.indexOf(a.id);
        const idxB = favoriteClientIds.indexOf(b.id);
        return idxB - idxA;
      });
    }

    if (savedClients.length === 0) {
      favGridEl.innerHTML = `
        <div class="fav-empty-state">
          <div class="fav-empty-icon">
            <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0m2-8a3 3 0 1 0 0-6m1 8a5 5 0 0 1 3 5"/></svg>
          </div>
          <h3>No saved clients found</h3>
          <p>${favoriteClientIds.length === 0 ? 'You haven’t saved any clients yet. Browse businesses looking for developers in Find Clients and click the heart icon to save them.' : 'No saved clients match your filter or search query.'}</p>
          <a class="fav-btn primary" href="devmatch-find-clients.html" style="margin:0 auto;display:inline-flex;">
            <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0m2-8a3 3 0 1 0 0-6m1 8a5 5 0 0 1 3 5"/></svg>
            Find Clients
          </a>
        </div>
      `;
      return;
    }

    favGridEl.innerHTML = savedClients.map(client => {
      const topReq = client.requests && client.requests.length > 0 ? client.requests[0] : null;
      const previewHtml = topReq ? `
        <div class="fav-client-req-preview">
          <small>Latest Project Request</small>
          <b>${escapeHtml(topReq.title)}</b> · <span style="color:#15934f;font-weight:700;">${escapeHtml(topReq.budget)}</span>
        </div>
      ` : `
        <div class="fav-client-req-preview" style="font-style:italic;color:#9ca3af;">
          No open project requests at the moment.
        </div>
      `;

      return `
        <article class="fav-client-card" data-client-id="${escapeHtml(client.id)}">
          <button class="fav-remove-btn" type="button" data-remove-client="${escapeHtml(client.id)}" title="Remove client" aria-label="Remove ${escapeHtml(client.name)} from favorites">
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>

          <div class="fav-client-card-top">
            <div class="fav-client-card-avatar">${escapeHtml(client.initials)}</div>
            <div class="fav-client-card-info">
              <div class="fav-client-badge-row">
                <span class="fav-client-tag">Client</span>
                <span class="fav-client-tag active-pill">${escapeHtml(client.activeText)}</span>
              </div>
              <h3>${escapeHtml(client.name)}</h3>
              <p>${escapeHtml(client.business)}</p>
            </div>
          </div>

          <div class="fav-client-meta-box">
            <div class="fav-client-meta-item">
              <span>Location</span>
              <strong>${escapeHtml(client.location)}</strong>
            </div>
            <div class="fav-client-meta-item">
              <span>Open Requests</span>
              <strong class="highlight-green">${client.openRequestsCount} Requests</strong>
            </div>
            <div class="fav-client-meta-item">
              <span>Category</span>
              <strong>${escapeHtml(client.category)}</strong>
            </div>
          </div>

          ${previewHtml}

          <div class="fav-card-footer" style="margin-top:auto;padding:12px 0 0;background:transparent;border-top:1px solid #f0f0f2;">
            <a class="fav-action-link primary" href="devmatch-chat.html?contact=${encodeURIComponent(client.contactId)}&client=${encodeURIComponent(client.id)}">
              <svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-4A8.5 8.5 0 1 1 21 11.5z"/></svg>
              Chat Client
            </a>
            <button class="fav-action-link" type="button" data-view-client="${escapeHtml(client.id)}">
              View Requests
            </button>
          </div>
        </article>
      `;
    }).join('');

    favGridEl.querySelectorAll('[data-remove-client]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFavoriteClient(btn.dataset.removeClient);
      });
    });

    favGridEl.querySelectorAll('[data-view-client]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openClientModal(btn.dataset.viewClient);
      });
    });
  }

  // Render Saved Developers Grid (Client Mode: from devmatch-find-developers.html)
  function renderDevelopers() {
    const all = getAllDevelopers();
    let savedDevs = all.filter(d => favoriteDevIds.includes(d.id));

    if (currentCategory !== 'all') {
      savedDevs = savedDevs.filter(d =>
        d.specialization.toLowerCase() === currentCategory.toLowerCase()
      );
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      savedDevs = savedDevs.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.specialization.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q) ||
        d.skills.some(s => s.toLowerCase().includes(q)) ||
        d.bio.toLowerCase().includes(q)
      );
    }

    if (currentSort === 'name') {
      savedDevs.sort((a, b) => a.name.localeCompare(b.name));
    } else if (currentSort === 'projects') {
      savedDevs.sort((a, b) => b.projectsCount - a.projectsCount);
    } else if (currentSort === 'views') {
      savedDevs.sort((a, b) => b.viewsCount - a.viewsCount);
    } else {
      savedDevs.sort((a, b) => {
        const idxA = favoriteDevIds.indexOf(a.id);
        const idxB = favoriteDevIds.indexOf(b.id);
        return idxB - idxA;
      });
    }

    if (savedDevs.length === 0) {
      favGridEl.innerHTML = `
        <div class="fav-empty-state">
          <div class="fav-empty-icon">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
          </div>
          <h3>No saved developers found</h3>
          <p>${favoriteDevIds.length === 0 ? 'You haven’t saved any developers yet. Browse top independent developers in Discover Developers and click the heart icon to save them.' : 'No saved developers match your filter or search query.'}</p>
          <a class="fav-btn primary" href="devmatch-find-developers.html" style="margin:0 auto;display:inline-flex;">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
            Find Developers
          </a>
        </div>
      `;
      return;
    }

    favGridEl.innerHTML = savedDevs.map(dev => `
      <article class="fav-dev-card" data-dev-id="${escapeHtml(dev.id)}">
        <button class="fav-remove-btn" type="button" data-remove-dev="${escapeHtml(dev.id)}" title="Remove developer" aria-label="Remove ${escapeHtml(dev.name)} from favorites">
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>

        <div class="fav-dev-card-top">
          <div class="fav-dev-card-avatar">${escapeHtml(dev.initials)}</div>
          <div class="fav-dev-card-info">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
              <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;background:#e7f6ed;color:#15934f;">${escapeHtml(dev.status)}</span>
              <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;background:#f3f4f6;color:#4b5563;">${escapeHtml(dev.specialization)}</span>
            </div>
            <h3>${escapeHtml(dev.name)}</h3>
            <p style="margin:0;display:flex;align-items:center;gap:3px;font-size:12px;color:#64748b;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21c-4.4-4.8-8-9-8-12a8 8 0 1 1 16 0c0 3-3.6 7.2-8 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
              ${escapeHtml(dev.location)}
            </p>
          </div>
        </div>

        <p class="fav-dev-card-bio">${escapeHtml(dev.bio)}</p>

        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px;">
          ${dev.skills.map(skill => `<span style="font-size:11px;font-weight:600;padding:2px 7px;background:#f3f4f6;color:#374151;border-radius:6px;">${escapeHtml(skill)}</span>`).join('')}
        </div>

        <div class="fav-dev-stats-row">
          <div class="fav-dev-stat-box">
            <span>Projects</span>
            <strong>${dev.projectsCount}</strong>
          </div>
          <div class="fav-dev-stat-box">
            <span>Views</span>
            <strong>${escapeHtml(dev.views)}</strong>
          </div>
          <div class="fav-dev-stat-box">
            <span>Favorites</span>
            <strong>${dev.favoritesCount}</strong>
          </div>
        </div>

        <div class="fav-card-footer" style="margin-top:auto;padding:12px 0 0;background:transparent;border-top:1px solid #f0f0f2;">
          <a class="fav-action-link primary" href="devmatch-chat.html?contact=${encodeURIComponent(dev.contactId)}&role=client">
            <svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-4A8.5 8.5 0 1 1 21 11.5z"/></svg>
            Contact
          </a>
          <a class="fav-action-link" href="${escapeHtml(dev.profileUrl)}">
            View Profile
          </a>
        </div>
      </article>
    `).join('');

    favGridEl.querySelectorAll('[data-remove-dev]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFavoriteDeveloper(btn.dataset.removeDev);
      });
    });
  }

  // Open Client Requests Modal inside Favorites
  function openClientModal(clientId) {
    const client = getAllClients().find(c => c.id === clientId);
    if (!client || !favClientDialog || !favDialogContent) return;

    const reqs = client.requests || [];
    const reqsHtml = reqs.length > 0 ? reqs.map(req => `
      <div class="dialog-request-item" style="border:1px solid #e5e7eb;border-radius:12px;padding:14px;background:#fbfbfb;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
          <strong style="font-size:14px;color:#111827;">${escapeHtml(req.title)}</strong>
          <span style="font-size:12px;font-weight:700;color:#15934f;background:#e7f6ed;padding:2px 8px;border-radius:6px;">${escapeHtml(req.budget)}</span>
        </div>
        <p style="font-size:13px;color:#64748b;line-height:1.5;margin-bottom:8px;">${escapeHtml(req.description)}</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <span style="font-size:11px;padding:2px 7px;background:#f1f2f5;border-radius:99px;font-weight:600;">${escapeHtml(req.category)}</span>
          <span style="font-size:11px;padding:2px 7px;background:#f1f2f5;border-radius:99px;font-weight:600;">${escapeHtml(req.type)}</span>
          ${(req.tags || []).map(t => `<span style="font-size:11px;padding:2px 7px;background:#f1f2f5;border-radius:99px;font-weight:600;">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
    `).join('') : `
      <div style="padding:24px;text-align:center;color:#6b7280;background:#f9fafb;border-radius:12px;font-size:13px;">
        Klien ini saat ini belum memiliki permintaan proyek terbuka.
      </div>
    `;

    favDialogContent.innerHTML = `
      <div class="dialog-header">
        <div class="dialog-avatar" style="width:48px;height:48px;border-radius:50%;background:#e5e7eb;display:grid;place-items:center;font-weight:800;font-size:15px;">${escapeHtml(client.initials)}</div>
        <div class="dialog-title-group">
          <h2>${escapeHtml(client.name)}</h2>
          <p>${escapeHtml(client.business)} · ${escapeHtml(client.location)}</p>
        </div>
      </div>

      <div class="dialog-badges" style="display:flex;gap:8px;margin:12px 0 16px;">
        <span class="dialog-badge green">${escapeHtml(client.activeText)}</span>
        <span class="dialog-badge">${client.openRequestsCount} Open Requests</span>
        <span class="dialog-badge">${escapeHtml(client.businessType || client.category)}</span>
      </div>

      <div class="dialog-section-title" style="font-weight:700;margin:16px 0 10px;">
        Permintaan Proyek Terbuka (${reqs.length})
      </div>

      <div class="dialog-requests-list">
        ${reqsHtml}
      </div>

      <div class="dialog-footer" style="display:flex;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid #f3f4f6;">
        <a class="btn-dialog-contact" href="devmatch-chat.html?contact=${encodeURIComponent(client.contactId)}&client=${encodeURIComponent(client.id)}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-4A8.5 8.5 0 1 1 21 11.5z"/></svg>
          Chat Klien
        </a>
        <button class="btn-dialog-close" type="button" data-close-fav-dialog>Tutup</button>
      </div>
    `;

    favClientDialog.showModal();
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
      saveProjectFavorites(favoriteProjectIds);
      updateCounters();
      renderCurrentTab();

      showToast('Project removed from favorites', () => {
        if (lastRemovedItem && lastRemovedItem.type === 'project') {
          favoriteProjectIds.push(lastRemovedItem.id);
          saveProjectFavorites(favoriteProjectIds);
          updateCounters();
          renderCurrentTab();
        }
      });
    }, 200);
  }

  // Remove a client favorite (syncs back to 'devmatch-favorite-clients')
  function removeFavoriteClient(id) {
    const card = document.querySelector(`.fav-client-card[data-client-id="${id}"]`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
    }

    setTimeout(() => {
      lastRemovedItem = { type: 'client', id };
      favoriteClientIds = favoriteClientIds.filter(item => item !== id);
      saveClientFavorites(favoriteClientIds);
      updateCounters();
      renderCurrentTab();

      showToast('Client removed from favorites', () => {
        if (lastRemovedItem && lastRemovedItem.type === 'client') {
          favoriteClientIds.push(lastRemovedItem.id);
          saveClientFavorites(favoriteClientIds);
          updateCounters();
          renderCurrentTab();
        }
      });
    }, 200);
  }

  // Remove a developer favorite (syncs back to 'devmatch-client-dev-favorites')
  function removeFavoriteDeveloper(id) {
    const card = document.querySelector(`.fav-dev-card[data-dev-id="${id}"]`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
    }

    setTimeout(() => {
      lastRemovedItem = { type: 'developer', id };
      favoriteDevIds = favoriteDevIds.filter(item => item !== id);
      saveDevFavorites(favoriteDevIds);
      updateCounters();
      renderCurrentTab();

      showToast('Developer removed from favorites', () => {
        if (lastRemovedItem && lastRemovedItem.type === 'developer') {
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
      if (favExploreBtn) {
        favExploreBtn.href = isClient ? 'devmatch-discover-projects.html' : 'devmatch-find-projects.html';
        favExploreBtn.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>Explore Projects`;
      }
      renderProjects();
    } else {
      if (isClient) {
        if (favExploreBtn) {
          favExploreBtn.href = 'devmatch-find-developers.html';
          favExploreBtn.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>Find Developers`;
        }
        renderDevelopers();
      } else {
        if (favExploreBtn) {
          favExploreBtn.href = 'devmatch-find-clients.html';
          favExploreBtn.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0m2-8a3 3 0 1 0 0-6m1 8a5 5 0 0 1 3 5"/></svg>Find Clients`;
        }
        renderClients();
      }
    }
  }

  // Tab switching
  if (tabProjectsBtn && tabSecondaryBtn) {
    tabProjectsBtn.addEventListener('click', () => {
      tabProjectsBtn.classList.add('active');
      tabSecondaryBtn.classList.remove('active');
      tabProjectsBtn.setAttribute('aria-selected', 'true');
      tabSecondaryBtn.setAttribute('aria-selected', 'false');
      currentTab = 'projects';
      updateCategoryOptions();
      updateSortOptions();
      updateCounters();
      renderCurrentTab();
    });

    tabSecondaryBtn.addEventListener('click', () => {
      tabSecondaryBtn.classList.add('active');
      tabProjectsBtn.classList.remove('active');
      tabSecondaryBtn.setAttribute('aria-selected', 'true');
      tabProjectsBtn.setAttribute('aria-selected', 'false');
      currentTab = isClient ? 'developers' : 'clients';
      updateCategoryOptions();
      updateSortOptions();
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

  // Sort filter
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
          saveProjectFavorites(favoriteProjectIds);
          updateCounters();
          renderCurrentTab();
          showToast('All saved projects cleared');
        }
      } else if (isClient) {
        if (favoriteDevIds.length === 0) return;
        if (confirm('Are you sure you want to clear all saved developers?')) {
          favoriteDevIds = [];
          saveDevFavorites(favoriteDevIds);
          updateCounters();
          renderCurrentTab();
          showToast('All saved developers cleared');
        }
      } else {
        if (favoriteClientIds.length === 0) return;
        if (confirm('Are you sure you want to clear all saved clients?')) {
          favoriteClientIds = [];
          saveClientFavorites(favoriteClientIds);
          updateCounters();
          renderCurrentTab();
          showToast('All saved clients cleared');
        }
      }
    });
  }

  // Modal dialog close
  if (favDialogCloseBtn && favClientDialog) {
    favDialogCloseBtn.addEventListener('click', () => {
      favClientDialog.close();
    });
  }

  if (favClientDialog) {
    favClientDialog.addEventListener('click', (e) => {
      if (e.target.closest('[data-close-fav-dialog]') || e.target === favClientDialog) {
        favClientDialog.close();
      }
    });
  }

  // Load user profile details in topbar
  function loadUserProfile() {
    try {
      document.body.classList.toggle('client-shell-page', isClient);
      const key = isClient ? 'devmatch-profile-client' : 'devmatch-profile-dev';
      const profile = JSON.parse(localStorage.getItem(key) || '{}');
      const name = typeof profile.displayName === 'string' && profile.displayName.trim()
        ? profile.displayName.trim()
        : (isClient ? 'Jessica Sitorus' : 'Rizky Aditya');
      const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || (isClient ? 'JS' : 'RA');
      const role = isClient ? 'Client' : 'Developer';
      const userAvatarEl = document.getElementById('userAvatar');
      const topUserNameEl = document.getElementById('topUserName');
      if (userAvatarEl) userAvatarEl.textContent = initials;
      if (topUserNameEl) topUserNameEl.textContent = name;
      document.querySelector('.user-copy small').textContent = role;

      const modeLinks = document.querySelectorAll('.mode-switch .mode');
      modeLinks.forEach((link, index) => link.classList.toggle('active', isClient ? index === 1 : index === 0));
      if (isClient) {
        const brand = document.querySelector('.topbar .brand');
        if (brand) brand.href = 'devmatch-client-dashboard.html';
        const workspace = document.querySelector('.workspace');
        if (workspace) workspace.innerHTML = '<span class="workspace-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span><span><b>Client workspace</b><small>Discover &amp; hire</small></span>';
        const addLink = document.querySelector('.side-add');
        if (addLink) {
          addLink.href = 'devmatch-client-dashboard.html#requests';
          addLink.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14m-7-7h14"/></svg>Post a Request';
          addLink.classList.add('post-request');
        }
        const menu = document.querySelector('.side-nav[aria-label="Dashboard navigation"]');
        if (menu) menu.innerHTML = `
          <a class="nav-item" href="devmatch-client-dashboard.html"><svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/></svg>Home</a>
          <a class="nav-item" href="devmatch-chat.html?role=client"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-4A8.5 8.5 0 1 1 21 11.5z"/></svg>Messages<span class="nav-count chat-unread-total-badge">3</span></a>
          <a class="nav-item" href="devmatch-client-dashboard.html#requests"><svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M8 13h8m-8 4h8"/></svg>My Requests</a>
          <a class="nav-item" href="devmatch-discover-projects.html"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>Discover Projects</a>
          <a class="nav-item" href="devmatch-find-developers.html"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0m2-8a3 3 0 1 0 0-6m1 8a5 5 0 0 1 3 5"/></svg>Developers</a>
          <a class="nav-item active" href="devmatch-favorites.html?role=client" aria-current="page"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>Favorites<span class="nav-count" id="favoriteCount">0</span></a>
          <a class="nav-item" href="devmatch-notifications.html"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 13h4"/></svg>Notifications<span class="nav-count notification-count" id="clientNotificationCount">2</span></a>`;
        const account = document.querySelector('.side-nav[aria-label="Account navigation"]');
        if (account) account.innerHTML = `
          <a class="nav-item" href="devmatch-my-profile.html?role=client"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>Profile</a>
          <a class="nav-item" href="devmatch-settings.html?role=client"><svg viewBox="0 0 24 24"><path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6"/></svg>Settings</a>`;
        const intro = document.querySelector('.fav-heading>div>p:last-child');
        if (intro) intro.textContent = 'Projects and developers you saved for later.';
      }
    } catch (e) {}
  }

  // Initialize
  loadUserProfile();
  updateCategoryOptions();
  updateSortOptions();
  updateCounters();
  renderCurrentTab();

})();
