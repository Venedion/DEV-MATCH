/**
 * Find Clients Page Logic - DEV-MATCH
 * Replicates design from "Find Clients.pdf"
 */

(function () {
  'use strict';

  const FAVORITES_KEY = 'devmatch-favorite-clients';

  let CLIENTS_DATA = [];

  // State
  let searchQuery = '';
  let searchScope = 'name';
  let selectedBusinessType = 'all';
  let selectedLocation = 'all';
  let hasOpenRequestsOnly = true; // Enabled by default per PDF design (solid dark pill)
  let sortOrder = 'az';
  let favoriteIds = getSavedFavorites();

  // Elements
  const searchInput = document.getElementById('clientSearchInput');
  const topSearchInput = document.getElementById('topSearchInput');
  const searchScopeSelect = document.getElementById('searchScopeSelect');
  const searchScopeDropdown = document.getElementById('searchScopeDropdown');
  const searchScopeTrigger = document.getElementById('searchScopeTrigger');
  const searchScopeMenu = document.getElementById('searchScopeMenu');
  const btnSearch = document.getElementById('btnSearchClients');
  const clientsGrid = document.getElementById('clientsGrid');
  const emptyState = document.getElementById('clientsEmptyState');
  const clientsCountEl = document.getElementById('clientsCountHeading');
  const businessTypeDropdown = document.getElementById('businessTypeDropdown');
  const locationDropdown = document.getElementById('locationDropdown');
  const btnToggleOpenRequests = document.getElementById('btnToggleOpenRequests');
  const sortNewestBtn = document.getElementById('sortNewestBtn');
  const sortOldestBtn = document.getElementById('sortOldestBtn');
  const clientDialog = document.getElementById('clientDialog');
  const dialogContent = document.getElementById('dialogContent');
  const dialogCloseBtn = document.getElementById('dialogCloseBtn');
  const toastEl = document.getElementById('fcToast');
  const favoriteCountEl = document.getElementById('favoriteCount');
  const favoriteStateReady = window.devMatchBackend.ready.then(user => user
    ? window.devMatchBackend.loadFavorites()
    : null
  ).then(records => {
    if (!records) return false;
    favoriteIds = records.filter(item => item.type === 'client').map(item => item.id);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
    renderClients();
    return true;
  }).catch(error => {
    console.error('Unable to load client favorites from Supabase.', error);
    window.alert('Unable to load favorites. Check your connection and try again.');
    return null;
  });

  // Helpers
  function getSavedFavorites() {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored !== null) {
        const data = JSON.parse(stored);
        return Array.isArray(data) ? data : [];
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  function saveFavorites(ids) {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
    } catch (e) {
      console.warn('Could not save client favorites', e);
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2400);
  }

  function updateFavoriteBadge() {
    if (window.DEVMATCH_NAV_BADGES) window.DEVMATCH_NAV_BADGES.updateFavorites();
    else if (favoriteCountEl) favoriteCountEl.textContent = String(favoriteIds.length);
  }

  // Filter & Sort Logic
  function getFilteredClients() {
    return CLIENTS_DATA.filter(client => {
      // Open requests filter
      if (hasOpenRequestsOnly && client.openRequestsCount <= 0) {
        return false;
      }

      // Business type filter
      if (selectedBusinessType !== 'all' && client.category !== selectedBusinessType && client.businessType !== selectedBusinessType) {
        return false;
      }

      // Location filter
      if (selectedLocation !== 'all' && client.location.toLowerCase() !== selectedLocation.toLowerCase()) {
        return false;
      }

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        if (searchScope === 'name') {
          if (!client.name.toLowerCase().includes(q)) return false;
        } else if (searchScope === 'business') {
          if (!client.business.toLowerCase().includes(q) && !client.category.toLowerCase().includes(q)) return false;
        } else if (searchScope === 'location') {
          if (!client.location.toLowerCase().includes(q)) return false;
        } else {
          // 'all'
          const haystack = `${client.name} ${client.business} ${client.category} ${client.location}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const byName=a.name.localeCompare(b.name);
      return sortOrder==='za'?-byName:byName;
    });
  }

  // Render Client Cards
  function renderClients() {
    const clients = getFilteredClients();

    if (clients.length === 0) {
      clientsGrid.innerHTML = '';
      emptyState.classList.add('show');
      emptyState.hidden = false;
    } else {
      emptyState.classList.remove('show');
      emptyState.hidden = true;
      clientsGrid.innerHTML = clients.map(client => {
        const isFav = favoriteIds.includes(client.id);
        const reqText = client.openRequestsCount === 1 ? '1 open request' : `${client.openRequestsCount} open requests`;

        return `
          <article class="client-card" data-client-id="${escapeHtml(client.id)}">
            <div class="client-card-top">
              <div class="client-profile-group">
                <div class="client-avatar-badge">${escapeHtml(client.initials)}</div>
                <div class="client-name-business">
                  <h2 class="client-name-title"><a href="devmatch-client-profile.html?client=${encodeURIComponent(client.id)}" aria-label="View ${escapeHtml(client.name)} profile">${escapeHtml(client.name)}</a></h2>
                  <p class="client-business-tag">${escapeHtml(client.business)}</p>
                </div>
              </div>
              <button class="btn-card-favorite ${isFav ? 'is-favorite' : ''}" type="button" data-favorite-id="${escapeHtml(client.id)}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}" title="${isFav ? 'Favorited' : 'Favorite'}">
                <svg viewBox="0 0 24 24" fill="${isFav ? '#e54860' : 'none'}" stroke="currentColor" stroke-width="1.8">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            </div>

            <div class="client-card-meta">
              <div class="meta-row">
                <span class="meta-item">
                  <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  Client
                </span>
                <span class="meta-requests-badge">${escapeHtml(reqText)}</span>
              </div>
              <div class="meta-row">
                <span class="meta-item meta-location">
                  <svg viewBox="0 0 24 24"><path d="M12 21c-4.4-4.8-8-9-8-12a8 8 0 1 1 16 0c0 3-3.6 7.2-8 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
                  ${escapeHtml(client.location)}
                </span>
                <span class="meta-item meta-active">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg>
                  ${escapeHtml(client.activeText)}
                </span>
              </div>
            </div>

            <div class="client-card-actions">
              <button class="btn-view-requests" type="button" data-action="view-requests" data-client-id="${escapeHtml(client.id)}">
                View requests
              </button>
              <a class="btn-contact-client" href="devmatch-chat.html?contact=${encodeURIComponent(client.contactId)}&client=${encodeURIComponent(client.id)}" data-action="contact-client" data-client-id="${escapeHtml(client.id)}">
                <svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-4A8.5 8.5 0 1 1 21 11.5z"/></svg>
                Contact
              </a>
            </div>
          </article>
        `;
      }).join('');
    }

    // Update count heading
    if (clientsCountEl) {
      if (!searchQuery && selectedBusinessType === 'all' && selectedLocation === 'all' && hasOpenRequestsOnly) {
        clientsCountEl.textContent = `${clients.length} clients`;
      } else {
        clientsCountEl.textContent = `${clients.length} clients`;
      }
    }

    updateFavoriteBadge();
  }

  // Open "View Requests" Modal Dialog
  function openClientRequestsModal(clientId) {
    const client = CLIENTS_DATA.find(c => c.id === clientId);
    if (!client || !clientDialog || !dialogContent) return;

    const reqs = client.requests;
    let reqsHtml = '';

    if (reqs && reqs.length > 0) {
      reqsHtml = reqs.map(req => `
        <div class="dialog-request-item">
          <div class="req-header">
            <span class="req-title">${escapeHtml(req.title)}</span>
            <span class="req-budget">${escapeHtml(req.budget)}</span>
          </div>
          <p class="req-desc">${escapeHtml(req.description)}</p>
          <div class="req-tags">
            <span class="req-tag">${escapeHtml(req.category)}</span>
            <span class="req-tag">${escapeHtml(req.type)}</span>
            ${req.tags.map(tag => `<span class="req-tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
        </div>
      `).join('');
    } else {
      reqsHtml = `
        <div style="padding: 24px; text-align: center; color: #6b7280; background: #f9fafb; border-radius: 12px; font-size: 13.5px;">
          Klien ini saat ini belum memiliki permintaan proyek terbuka.
        </div>
      `;
    }

    dialogContent.innerHTML = `
      <div class="dialog-header">
        <div class="dialog-avatar">${escapeHtml(client.initials)}</div>
        <div class="dialog-title-group">
          <h2>${escapeHtml(client.name)}</h2>
          <p>${escapeHtml(client.business)} • ${escapeHtml(client.location)}</p>
        </div>
      </div>

      <div class="dialog-badges">
        <span class="dialog-badge green">${escapeHtml(client.activeText)}</span>
        <span class="dialog-badge">${client.openRequestsCount} Open Requests</span>
        <span class="dialog-badge">${escapeHtml(client.businessType)}</span>
      </div>

      <div class="dialog-section-title">
        <span>Permintaan Proyek Terbuka</span>
        <small style="color: #6b7280; font-weight: 500;">${reqs.length} proyek</small>
      </div>

      <div class="dialog-requests-list">
        ${reqsHtml}
      </div>

      <div class="dialog-footer">
        <a class="btn-dialog-contact" href="devmatch-chat.html?contact=${encodeURIComponent(client.contactId)}&client=${encodeURIComponent(client.id)}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-4A8.5 8.5 0 1 1 21 11.5z"/></svg>
          Contact client
        </a>
        <button class="btn-dialog-close" type="button" data-close-dialog>Close</button>
      </div>
    `;

    clientDialog.showModal();
  }

  // Event Listeners Setup
  function initEvents() {
    // Search input
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        searchQuery = e.target.value;
        renderClients();
      });
      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          renderClients();
        }
      });
    }

    // Topbar search input
    if (topSearchInput) {
      topSearchInput.addEventListener('input', e => {
        searchQuery = e.target.value;
        if (searchInput) searchInput.value = searchQuery;
        renderClients();
      });
    }

    // Shortcut Cmd+K / Ctrl+K
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchInput) searchInput.focus();
      }
    });

    // Search Scope Select
    if (searchScopeSelect) {
      searchScopeSelect.addEventListener('change', e => {
        searchScope = e.target.value;
        renderClients();
      });
    }

    if (searchScopeDropdown && searchScopeSelect && searchScopeTrigger && searchScopeMenu) {
      const options = Array.from(searchScopeMenu.querySelectorAll('[role="option"]'));
      const closeScopeMenu = ({focusTrigger = false} = {}) => {
        searchScopeDropdown.classList.remove('open');
        searchScopeTrigger.setAttribute('aria-expanded', 'false');
        searchScopeMenu.setAttribute('aria-hidden', 'true');
        searchScopeMenu.inert = true;
        if (focusTrigger) searchScopeTrigger.focus();
      };
      const openScopeMenu = () => {
        searchScopeDropdown.classList.add('open');
        searchScopeTrigger.setAttribute('aria-expanded', 'true');
        searchScopeMenu.setAttribute('aria-hidden', 'false');
        searchScopeMenu.inert = false;
        options.find(option => option.dataset.value === searchScopeSelect.value)?.focus();
      };
      const selectScope = option => {
        searchScopeSelect.value = option.dataset.value;
        searchScopeTrigger.querySelector('span').textContent = option.textContent.trim();
        options.forEach(item => item.setAttribute('aria-selected', String(item === option)));
        searchScopeSelect.dispatchEvent(new Event('change', {bubbles: true}));
        closeScopeMenu({focusTrigger: true});
      };

      searchScopeTrigger.addEventListener('click', () => {
        if (searchScopeDropdown.classList.contains('open')) closeScopeMenu();
        else openScopeMenu();
      });
      searchScopeTrigger.addEventListener('keydown', event => {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
          event.preventDefault();
          openScopeMenu();
        }
      });
      searchScopeMenu.addEventListener('click', event => {
        const option = event.target.closest('[role="option"]');
        if (option) selectScope(option);
      });
      searchScopeMenu.addEventListener('keydown', event => {
        const currentIndex = options.indexOf(document.activeElement);
        if (event.key === 'Escape') {
          event.preventDefault();
          closeScopeMenu({focusTrigger: true});
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const direction = event.key === 'ArrowDown' ? 1 : -1;
          options[(currentIndex + direction + options.length) % options.length]?.focus();
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          options[event.key === 'Home' ? 0 : options.length - 1]?.focus();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          document.activeElement?.click();
        } else if (event.key === 'Tab') {
          closeScopeMenu();
        }
      });
    }

    // Search Button
    if (btnSearch) {
      btnSearch.addEventListener('click', () => {
        renderClients();
      });
    }

    // Business Type Dropdown
    if (businessTypeDropdown) {
      const trigger = businessTypeDropdown.querySelector('.filter-pill-btn');
      const label = trigger ? trigger.querySelector('.filter-label-text') : null;

      businessTypeDropdown.addEventListener('click', e => {
        const item = e.target.closest('.dropdown-item');
        if (item) {
          const val = item.dataset.value;
          selectedBusinessType = val;
          businessTypeDropdown.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          if (label) {
            label.textContent = val === 'all' ? 'Business type' : item.textContent.trim().replace('✓', '');
          }
          trigger.classList.toggle('has-value', val !== 'all');
          businessTypeDropdown.classList.remove('open');
          renderClients();
          return;
        }

        if (e.target.closest('.filter-pill-btn')) {
          businessTypeDropdown.classList.toggle('open');
          if (locationDropdown) locationDropdown.classList.remove('open');
        }
      });
    }

    // Location Dropdown
    if (locationDropdown) {
      const trigger = locationDropdown.querySelector('.filter-pill-btn');
      const label = trigger ? trigger.querySelector('.filter-label-text') : null;

      locationDropdown.addEventListener('click', e => {
        const item = e.target.closest('.dropdown-item');
        if (item) {
          const val = item.dataset.value;
          selectedLocation = val;
          locationDropdown.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          if (label) {
            label.textContent = val === 'all' ? 'Location' : item.textContent.trim().replace('✓', '');
          }
          trigger.classList.toggle('has-value', val !== 'all');
          locationDropdown.classList.remove('open');
          renderClients();
          return;
        }

        if (e.target.closest('.filter-pill-btn')) {
          locationDropdown.classList.toggle('open');
          if (businessTypeDropdown) businessTypeDropdown.classList.remove('open');
        }
      });
    }

    // Close dropdowns on outside click
    document.addEventListener('click', e => {
      if (searchScopeDropdown && !e.target.closest('#searchScopeDropdown')) {
        searchScopeDropdown.classList.remove('open');
        searchScopeTrigger?.setAttribute('aria-expanded', 'false');
        searchScopeMenu?.setAttribute('aria-hidden', 'true');
        if (searchScopeMenu) searchScopeMenu.inert = true;
      }
      if (!e.target.closest('.filter-dropdown-container')) {
        if (businessTypeDropdown) businessTypeDropdown.classList.remove('open');
        if (locationDropdown) locationDropdown.classList.remove('open');
      }
    });

    // Has Open Requests Toggle
    if (btnToggleOpenRequests) {
      btnToggleOpenRequests.addEventListener('click', () => {
        hasOpenRequestsOnly = !hasOpenRequestsOnly;
        btnToggleOpenRequests.classList.toggle('inactive', !hasOpenRequestsOnly);
        renderClients();
      });
    }

    // Sort Newest / Oldest
    if (sortNewestBtn && sortOldestBtn) {
      sortNewestBtn.addEventListener('click', () => {
        sortOrder = 'az';
        sortNewestBtn.classList.add('active');
        sortOldestBtn.classList.remove('active');
        renderClients();
      });
      sortOldestBtn.addEventListener('click', () => {
        sortOrder = 'za';
        sortOldestBtn.classList.add('active');
        sortNewestBtn.classList.remove('active');
        renderClients();
      });
    }

    // Delegate Card Actions (Favorite, View Requests)
    if (clientsGrid) {
      clientsGrid.addEventListener('click', async e => {
        // Favorite button
        const favBtn = e.target.closest('.btn-card-favorite');
        if (favBtn) {
          const authenticated = await favoriteStateReady;
          if (authenticated === null) return;
          const id = favBtn.dataset.favoriteId;
          const saved = favoriteIds.includes(id);
          if (authenticated) {
            try {
              await window.devMatchBackend.setFavorite('client', id, !saved);
            } catch (error) {
              console.error('Unable to update client favorite in Supabase.', error);
              window.alert('Unable to save this favorite. Please try again.');
              return;
            }
          }
          if (saved) {
            favoriteIds = favoriteIds.filter(item => item !== id);
            showToast('Dihapus dari Favorites');
          } else {
            favoriteIds = [...favoriteIds, id];
            showToast('Ditambahkan ke Favorites');
          }
          saveFavorites(favoriteIds);
          renderClients();
          return;
        }

        // View requests button
        const viewBtn = e.target.closest('[data-action="view-requests"]');
        if (viewBtn) {
          const id = viewBtn.dataset.clientId;
          openClientRequestsModal(id);
          return;
        }
      });
    }

    // Modal Close
    if (dialogCloseBtn && clientDialog) {
      dialogCloseBtn.addEventListener('click', () => {
        clientDialog.close();
      });
    }

    if (clientDialog) {
      clientDialog.addEventListener('click', e => {
        if (e.target.closest('[data-close-dialog]')) {
          clientDialog.close();
        }
        if (e.target === clientDialog) {
          clientDialog.close();
        }
      });
    }

    // Reset Filters from Empty State
    const btnReset = document.getElementById('btnResetFilters');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        searchQuery = '';
        selectedBusinessType = 'all';
        selectedLocation = 'all';
        hasOpenRequestsOnly = false;
        if (searchInput) searchInput.value = '';
        if (topSearchInput) topSearchInput.value = '';
        if (btnToggleOpenRequests) btnToggleOpenRequests.classList.add('inactive');

        const btTrigger = businessTypeDropdown ? businessTypeDropdown.querySelector('.filter-label-text') : null;
        if (btTrigger) btTrigger.textContent = 'Business type';
        if (businessTypeDropdown) {
          businessTypeDropdown.querySelector('.filter-pill-btn').classList.remove('has-value');
          businessTypeDropdown.querySelectorAll('.dropdown-item').forEach(el => el.classList.toggle('selected', el.dataset.value === 'all'));
        }

        const locTrigger = locationDropdown ? locationDropdown.querySelector('.filter-label-text') : null;
        if (locTrigger) locTrigger.textContent = 'Location';
        if (locationDropdown) {
          locationDropdown.querySelector('.filter-pill-btn').classList.remove('has-value');
          locationDropdown.querySelectorAll('.dropdown-item').forEach(el => el.classList.toggle('selected', el.dataset.value === 'all'));
        }

        renderClients();
      });
    }
  }

  async function loadClients() {
    const status = document.getElementById('directoryStatus');
    status.hidden = false;
    status.textContent = 'Loading client directory?';
    try {
      const user = await window.devMatchBackend.ready;
      if (!user) throw new Error('Sign in with a developer account to browse the client directory.');
      const {data: account, error: accountError} = await window.devMatchBackend.client
        .from('profiles').select('account_role').eq('id', user.id).single();
      if (accountError) throw accountError;
      if (account.account_role !== 'dev') throw new Error('The client directory is available in developer mode.');
      const [{data: people, error: peopleError}, {data: rows, error: projectsError}] = await Promise.all([
        window.devMatchBackend.client.from('directory_people')
          .select('id,display_name,username,account_role,profile_data,open_request_count')
          .eq('account_role', 'client'),
        window.devMatchBackend.client.from('projects')
          .select('id,owner_id,title,project_type,category,price,data,status,created_at,updated_at')
          .eq('project_kind', 'request').eq('status', 'open').order('updated_at', {ascending:false})
      ]);
      if (peopleError) throw peopleError;
      if (projectsError) throw projectsError;
      const requestsByOwner = new Map();
      (rows || []).forEach(row => {
        const data = row.data && typeof row.data === 'object' ? row.data : {};
        const request = {id:row.id,title:row.title,category:row.category,type:row.project_type,
          budget:row.price || data.budgetLabel || data.budget || '',description:data.description || data.overview || '',
          tags:Array.isArray(data.stack)?data.stack:[]};
        requestsByOwner.set(row.owner_id,[...(requestsByOwner.get(row.owner_id)||[]),request]);
      });
      CLIENTS_DATA = (people || []).map((person,index) => {
        const profile = person.profile_data || {};
        const name = String(person.display_name || 'DEV-MATCH member');
        const requests = requestsByOwner.get(person.id) || [];
        const category = String(profile.industry || '');
        return {id:person.id,contactId:person.id,name,initials:(name.match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'DM',
          business:String(profile.companyName || name),category,businessType:category||'Business type not provided',type:'Client',
          openRequestsCount:requests.length,location:String(profile.city || 'Location not provided'),activeText:'Profile listed',
          orderIndex:index,requests};
      });
      status.hidden = true;
      emptyState.hidden = CLIENTS_DATA.length > 0;
      renderClients();
    } catch (error) {
      console.error('Unable to load the client directory from Supabase.', error);
      status.textContent = error.message && /Sign in|available in developer mode/.test(error.message)
        ? error.message : 'The client directory could not be loaded. Check your connection and try again.';
      status.hidden = false;
      CLIENTS_DATA = [];
      emptyState.hidden = true;
      renderClients();
    }
  }

  initEvents();
  emptyState.hidden = true;
  loadClients();
})();
