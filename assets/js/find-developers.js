/**
 * Find Developers Page Logic - DEV-MATCH Client Mode
 * Replicates design from "Discover — Developers tab.pdf"
 * Action favorite uses separated storage: 'devmatch-client-dev-favorites'
 */

(function () {
  'use strict';

  // Distinct favorite key for Client Mode Developer bookmarks
  const FAVORITES_KEY = 'devmatch-client-dev-favorites';
  const DEVELOPERS_PER_PAGE = 9;

  let DEVELOPERS_DATA = [];

  // State
  let searchQuery = '';
  let searchScope = 'all';
  let selectedSpecialization = 'all';
  let selectedGender = 'all';
  let selectedStatus = 'all';
  let mobileDeveloperFilterDraft = null;
  let currentSort = 'projects';
  let currentPage = 1;
  let directoryLoaded = false;
  let favoriteIds = loadFavorites();

  // Elements
  const searchInput = document.getElementById('devSearchInput');
  const topSearchInput = document.getElementById('topSearchInput');
  const searchScopeSelect = document.getElementById('searchScopeSelect');
  const btnSearch = document.getElementById('btnSearchDevs');
  const devsGrid = document.getElementById('devsGrid');
  const emptyState = document.getElementById('devsEmptyState');
  const countHeading = document.getElementById('devsCountHeading');
  const projectTabCount = document.getElementById('projectTabCount');
  const developerTabCount = document.getElementById('developerTabCount');
  const sortLabel = document.getElementById('devsSortLabel');
  const specDropdown = document.getElementById('specDropdown');
  const genderDropdown = document.getElementById('genderDropdown');
  const statusDropdown = document.getElementById('statusDropdown');
  const sortBtns = document.querySelectorAll('.sort-btn');
  const pagination = document.querySelector('.devs-pagination');
  const toastEl = document.getElementById('favoriteActionToast');
  const favoriteRemoveDialog = document.getElementById('favoriteRemoveDialog');
  const favoriteRemoveMessage = document.getElementById('favoriteRemoveMessage');
  const sidebarFavBadge = document.getElementById('favoriteCount');
  const favoriteStateReady = window.devMatchBackend.ready.then(user => user
    ? window.devMatchBackend.loadFavorites()
    : null
  ).then(records => {
    if (!records) return false;
    favoriteIds = records.filter(item => item.type === 'developer').map(item => item.id);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
    renderDevelopers();
    return true;
  }).catch(error => {
    console.error('Unable to load developer favorites from Supabase.', error);
    window.alert('Unable to load favorites. Check your connection and try again.');
    return null;
  });

  // Load favorites from localStorage
  function loadFavorites() {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
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
      console.warn('Could not save developer favorites', e);
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function showToast(msg, undoCallback, favoriteLink) {
    window.DEVMATCH_FAVORITE_FEEDBACK.showToast(toastEl, msg, undoCallback, favoriteLink);
  }

  function updateSidebarFavoriteBadge() {
    if (window.DEVMATCH_NAV_BADGES) window.DEVMATCH_NAV_BADGES.updateFavorites();
    else if (sidebarFavBadge) sidebarFavBadge.textContent = String(favoriteIds.length);
  }

  // Filter & Sort Logic
  function getFilteredDevelopers() {
    return DEVELOPERS_DATA.filter(dev => {
      // Specialization filter
      if (selectedSpecialization !== 'all' && dev.specialization.toLowerCase() !== selectedSpecialization.toLowerCase()) {
        return false;
      }

      // Gender filter
      if (selectedGender !== 'all' && (!dev.gender || dev.gender.toLowerCase() !== selectedGender.toLowerCase())) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && dev.status.toLowerCase() !== selectedStatus.toLowerCase()) {
        return false;
      }

      // Search Query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        if (searchScope === 'name') {
          if (!dev.name.toLowerCase().includes(q)) return false;
        } else if (searchScope === 'skill') {
          if (!dev.skills.some(s => s.toLowerCase().includes(q))) return false;
        } else if (searchScope === 'specialization') {
          if (!dev.specialization.toLowerCase().includes(q)) return false;
        } else {
          // 'all'
          const haystack = `${dev.name} ${dev.skills.join(' ')} ${dev.specialization} ${dev.location} ${dev.bio}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
      }

      return true;
    }).sort((a, b) => currentSort === 'projects'
      ? b.projectsCount - a.projectsCount || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name));
  }

  function getDeveloperFilterValues() {
    return {
      specialization: selectedSpecialization,
      gender: selectedGender,
      status: selectedStatus
    };
  }

  function syncDeveloperFilterControls(values) {
    [
      [specDropdown, 'specialization', 'Specialization'],
      [genderDropdown, 'gender', 'Gender'],
      [statusDropdown, 'status', 'Status']
    ].forEach(([dropdown, key, defaultLabel]) => {
      if (!dropdown) return;
      const value = values[key];
      dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.value === value);
      });
      const label = dropdown.querySelector('.filter-label-text');
      if (label) {
        label.textContent = value === 'all'
          ? defaultLabel
          : key === 'specialization' ? `${defaultLabel}: ${value}` : value;
      }
      dropdown.querySelector('.filter-pill-btn')?.classList.toggle('has-value', value !== 'all');
    });
  }

  function isMobileDeveloperFilterPanelOpen() {
    const panel = document.getElementById('mobileDevsFilterPanel');
    return window.matchMedia('(orientation: portrait)').matches && Boolean(panel && !panel.hidden);
  }

  function updateDeveloperFilter(key, value) {
    if (isMobileDeveloperFilterPanelOpen()) {
      if (!mobileDeveloperFilterDraft) mobileDeveloperFilterDraft = getDeveloperFilterValues();
      mobileDeveloperFilterDraft[key] = value;
      syncDeveloperFilterControls(mobileDeveloperFilterDraft);
      return;
    }

    if (key === 'specialization') selectedSpecialization = value;
    if (key === 'gender') selectedGender = value;
    if (key === 'status') selectedStatus = value;
    syncDeveloperFilterControls(getDeveloperFilterValues());
    renderDevelopers();
  }

  function renderPagination(pageCount) {
    if (!pagination) return;

    if (pageCount <= 1) {
      pagination.hidden = true;
      pagination.innerHTML = '';
      return;
    }

    pagination.hidden = false;
    let pageNumbers;
    if (pageCount <= 5) {
      pageNumbers = Array.from({length: pageCount}, (_, index) => index + 1);
    } else if (currentPage <= 3) {
      pageNumbers = [1, 2, 3, '…', pageCount];
    } else if (currentPage >= pageCount - 2) {
      pageNumbers = [1, '…', pageCount - 2, pageCount - 1, pageCount];
    } else {
      pageNumbers = [1, '…', currentPage - 1, currentPage, currentPage + 1, '…', pageCount];
    }

    const buttons = [
      `<button class="page-btn nav-arrow" type="button" data-page="${currentPage - 1}" aria-label="Previous page" ${currentPage === 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg></button>`
    ];
    pageNumbers.forEach(page => {
      if (page === '…') {
        buttons.push('<span class="page-ellipsis" aria-hidden="true">…</span>');
      } else {
        buttons.push(`<button class="page-btn${page === currentPage ? ' active' : ''}" type="button" data-page="${page}" aria-label="Page ${page}" aria-current="${page === currentPage ? 'page' : 'false'}">${page}</button>`);
      }
    });
    buttons.push(
      `<button class="page-btn nav-arrow arrow-action" type="button" data-page="${currentPage + 1}" aria-label="Next page" ${currentPage === pageCount ? 'disabled' : ''}><svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h20M17 8l5 4-5 4"/></svg></button>`
    );
    pagination.innerHTML = buttons.join('');
  }

  // Render Developer Cards
  function renderDevelopers() {
    if(!directoryLoaded)return;
    const devs = getFilteredDevelopers();
    const pageCount = Math.ceil(devs.length / DEVELOPERS_PER_PAGE);
    currentPage = Math.min(currentPage, Math.max(pageCount, 1));
    const visibleDevs = devs.slice((currentPage - 1) * DEVELOPERS_PER_PAGE, currentPage * DEVELOPERS_PER_PAGE);

    if (devs.length === 0) {
      devsGrid.innerHTML = '';
      emptyState.classList.add('show');
      emptyState.hidden = false;
    } else {
      emptyState.classList.remove('show');
      emptyState.hidden = true;
      devsGrid.innerHTML = visibleDevs.map(dev => {
        const isFav = favoriteIds.includes(dev.id);
        const profileUrl = new URL(dev.profileUrl, location.href);

        return `
          <article class="dev-card" tabindex="0" aria-label="Open developer profile: ${escapeHtml(dev.name)}" data-dev-id="${escapeHtml(dev.id)}" data-profile-url="${escapeHtml(profileUrl.href)}">
            <div class="dev-card-top">
              <div class="dev-profile-group">
                <div class="dev-avatar-badge">${escapeHtml(dev.initials)}</div>
                <div class="dev-name-location">
                  <h2 class="dev-name-title">${escapeHtml(dev.name)}</h2>
                  <span class="dev-location-tag">
                    <svg viewBox="0 0 24 24"><path d="M12 21c-4.4-4.8-8-9-8-12a8 8 0 1 1 16 0c0 3-3.6 7.2-8 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
                    ${escapeHtml(dev.location)}
                  </span>
                </div>
              </div>
              <button class="btn-dev-favorite ${isFav ? 'is-favorite' : ''}" type="button" data-favorite-id="${escapeHtml(dev.id)}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}" title="${isFav ? 'Favorited' : 'Favorite'}">
                <svg viewBox="0 0 24 24" fill="${isFav ? '#e54860' : 'none'}" stroke="currentColor" stroke-width="1.8">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            </div>

            <div class="dev-badges-row">
              <span class="status-badge ${escapeHtml(dev.statusType)}">${escapeHtml(dev.status)}</span>
              <span class="spec-badge">${escapeHtml(dev.specialization)}</span>
            </div>

            <p class="dev-bio">${escapeHtml(dev.bio)}</p>

            <div class="dev-skills-row">
              ${dev.skills.map(skill => `<span class="dev-skill-pill">${escapeHtml(skill)}</span>`).join('')}
            </div>

            <div class="dev-stats-grid">
              <div class="dev-stat-col">
                <strong>${dev.projectsCount}</strong>
                <small>Projects</small>
              </div>
              <div class="dev-stat-col">
                <strong>${escapeHtml(dev.views)}</strong>
                <small>Views</small>
              </div>
              <div class="dev-stat-col">
                <strong>${escapeHtml(dev.favoritesCount)}</strong>
                <small>Favorites</small>
              </div>
            </div>

            <div class="dev-actions-row">
              <a class="btn-view-profile" href="${escapeHtml(profileUrl.href)}">
                View Profile
              </a>
              <a class="btn-contact-dev" href="devmatch-chat.html?contact=${encodeURIComponent(dev.contactId)}&role=client">
                <svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-4A8.5 8.5 0 1 1 21 11.5z"/></svg>
                Contact
              </a>
            </div>
          </article>
        `;
      }).join('');
    }
    renderPagination(pageCount);

    // Update count heading
    if (countHeading) {
      if (selectedSpecialization === 'Full-stack' && !searchQuery && selectedGender === 'all' && selectedStatus === 'all') {
        countHeading.textContent = `${devs.length} full-stack developers`;
      } else if (selectedSpecialization !== 'all') {
        countHeading.textContent = `${devs.length} ${selectedSpecialization.toLowerCase()} developers`;
      } else {
        countHeading.textContent = `${devs.length} developers`;
      }
    }

    if (sortLabel) {
      if (currentSort === 'projects') {
        sortLabel.textContent = 'Sorted by most projects';
      } else {
        sortLabel.textContent = 'Sorted by name';
      }
    }

    updateSidebarFavoriteBadge();
  }

  // Event Listeners Setup
  function initEvents() {
    // Search input
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        searchQuery = e.target.value;
        renderDevelopers();
      });
      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          renderDevelopers();
        }
      });
    }

    if (topSearchInput) {
      topSearchInput.addEventListener('input', e => {
        searchQuery = e.target.value;
        if (searchInput) searchInput.value = searchQuery;
        renderDevelopers();
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
        renderDevelopers();
      });
    }

    if (btnSearch) {
      btnSearch.addEventListener('click', () => {
        renderDevelopers();
      });
    }

    // Specialization Dropdown
    if (specDropdown) {
      const trigger = specDropdown.querySelector('.filter-pill-btn');

      specDropdown.addEventListener('click', e => {
        const item = e.target.closest('.dropdown-item');
        if (item) {
          updateDeveloperFilter('specialization', item.dataset.value);
          specDropdown.classList.remove('open');
          return;
        }

        if (e.target.closest('.filter-pill-btn')) {
          specDropdown.classList.toggle('open');
          if (genderDropdown) genderDropdown.classList.remove('open');
          if (statusDropdown) statusDropdown.classList.remove('open');
        }
      });
    }

    // Gender Dropdown
    if (genderDropdown) {
      const trigger = genderDropdown.querySelector('.filter-pill-btn');

      genderDropdown.addEventListener('click', e => {
        const item = e.target.closest('.dropdown-item');
        if (item) {
          updateDeveloperFilter('gender', item.dataset.value);
          genderDropdown.classList.remove('open');
          return;
        }

        if (e.target.closest('.filter-pill-btn')) {
          genderDropdown.classList.toggle('open');
          if (specDropdown) specDropdown.classList.remove('open');
          if (statusDropdown) statusDropdown.classList.remove('open');
        }
      });
    }

    // Status Dropdown
    if (statusDropdown) {
      const trigger = statusDropdown.querySelector('.filter-pill-btn');

      statusDropdown.addEventListener('click', e => {
        const item = e.target.closest('.dropdown-item');
        if (item) {
          updateDeveloperFilter('status', item.dataset.value);
          statusDropdown.classList.remove('open');
          return;
        }

        if (e.target.closest('.filter-pill-btn')) {
          statusDropdown.classList.toggle('open');
          if (specDropdown) specDropdown.classList.remove('open');
          if (genderDropdown) genderDropdown.classList.remove('open');
        }
      });
    }

    // Close dropdowns on outside click
    document.addEventListener('click', e => {
      if (!e.target.closest('.filter-dropdown-container')) {
        if (specDropdown) specDropdown.classList.remove('open');
        if (genderDropdown) genderDropdown.classList.remove('open');
        if (statusDropdown) statusDropdown.classList.remove('open');
      }
    });

    // Sort buttons
    sortBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sortBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSort = btn.dataset.sort;
        renderDevelopers();
      });
    });

    // Favorite click delegate (Separate storage: 'devmatch-client-dev-favorites')
    if (devsGrid) {
      devsGrid.addEventListener('click', async e => {
        const favBtn = e.target.closest('.btn-dev-favorite');
        if (favBtn) {
          const authenticated = await favoriteStateReady;
          if (authenticated === null) return;
          const id = favBtn.dataset.favoriteId;
          const saved = favoriteIds.includes(id);
          if (saved) {
            const developer = DEVELOPERS_DATA.find(item => item.id === id);
            if (!developer || !await window.DEVMATCH_FAVORITE_FEEDBACK.confirmRemoval(
              favoriteRemoveDialog,
              favoriteRemoveMessage,
              developer.name
            )) return;
          }
          if (authenticated) {
            try {
              await window.devMatchBackend.setFavorite('developer', id, !saved);
            } catch (error) {
              console.error('Unable to update developer favorite in Supabase.', error);
              window.alert('Unable to save this favorite. Please try again.');
              return;
            }
          }
          if (saved) {
            favoriteIds = favoriteIds.filter(item => item !== id);
            showToast('Developer removed from your favorites', async () => {
              try {
                if (authenticated) await window.devMatchBackend.setFavorite('developer', id, true);
              } catch (error) {
                console.error('Unable to restore developer favorite in Supabase.', error);
                window.alert('Unable to restore this favorite. Please try again.');
                return false;
              }
              if (!favoriteIds.includes(id)) favoriteIds = [...favoriteIds, id];
              saveFavorites(favoriteIds);
              renderDevelopers();
              updateSidebarFavoriteBadge();
              return true;
            });
          } else {
            favoriteIds = [...favoriteIds, id];
            showToast('Developer added to your favorites', null, {tab: 'developers'});
          }
          saveFavorites(favoriteIds);
          renderDevelopers();
          return;
        }

        const card = e.target.closest('.dev-card[data-profile-url]');
        if (card && !e.target.closest('a, button, input, select, textarea, [contenteditable="true"]')) {
          window.location.href = card.dataset.profileUrl;
        }
      });

      devsGrid.addEventListener('keydown', e => {
        const card = e.target.closest('.dev-card[data-profile-url]');
        if (!card || e.target !== card || e.key !== 'Enter') return;
        e.preventDefault();
        window.location.href = card.dataset.profileUrl;
      });
    }

    if (pagination) {
      pagination.addEventListener('click', event => {
        const button = event.target.closest('.page-btn[data-page]');
        if (!button || button.disabled) return;
        const page = Number(button.dataset.page);
        if (!Number.isInteger(page) || page < 1) return;
        currentPage = page;
        renderDevelopers();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Reset filter
    const btnReset = document.getElementById('btnResetDevs');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        searchQuery = '';
        selectedSpecialization = 'all';
        selectedGender = 'all';
        selectedStatus = 'all';
        mobileDeveloperFilterDraft = null;
        if (searchInput) searchInput.value = '';
        if (topSearchInput) topSearchInput.value = '';
        syncDeveloperFilterControls(getDeveloperFilterValues());
        renderDevelopers();
      });
    }
  }

  function initializeMobileDeveloperActions() {
    const breakpoint = window.matchMedia('(orientation: portrait)');
    const actions = document.querySelector('.mobile-devs-actions');
    const filterRow = document.querySelector('.devs-filter-row');
    const filterPills = filterRow?.querySelector('.filter-left-pills');
    const sortOptions = filterRow?.querySelector('.sort-toggle-wrap');
    const filterFields = document.querySelector('.mobile-devs-filter-fields');
    const filterToggle = document.getElementById('mobileDevsFilterToggle');
    const filterPanel = document.getElementById('mobileDevsFilterPanel');
    const sortToggle = document.getElementById('mobileDevsSortToggle');
    const sortMenu = document.getElementById('mobileDevsSortMenu');
    const sortControl = actions?.querySelector('.mobile-devs-sort-control');
    const resetButton = document.getElementById('mobileDevsFilterReset');
    const applyButton = document.getElementById('mobileDevsFilterApply');
    if (!actions || !filterRow || !filterPills || !sortOptions || !filterFields
      || !filterToggle || !filterPanel || !sortToggle || !sortMenu || !sortControl
      || !resetButton || !applyButton) return;

    const filterPlaceholder = document.createComment('developer filters placement');
    const sortPlaceholder = document.createComment('developer sort placement');
    filterPills.before(filterPlaceholder);
    sortOptions.before(sortPlaceholder);

    function setFilterPanelOpen(isOpen) {
      filterPanel.hidden = !isOpen;
      filterToggle.setAttribute('aria-expanded', String(isOpen));
      actions.classList.toggle('mobile-filter-open', isOpen);
      if (isOpen) {
        mobileDeveloperFilterDraft = getDeveloperFilterValues();
        syncDeveloperFilterControls(mobileDeveloperFilterDraft);
      } else {
        mobileDeveloperFilterDraft = null;
        syncDeveloperFilterControls(getDeveloperFilterValues());
        filterPills.querySelectorAll('.filter-dropdown-container.open').forEach(dropdown => {
          dropdown.classList.remove('open');
          dropdown.querySelector('.filter-pill-btn')?.setAttribute('aria-expanded', 'false');
        });
      }
    }

    function closeSortMenu() {
      if (sortMenu.matches(':popover-open')) sortMenu.hidePopover();
      sortToggle.setAttribute('aria-expanded', 'false');
    }

    function syncLayout() {
      if (breakpoint.matches) {
        filterFields.append(filterPills);
        sortMenu.append(sortOptions);
        sortOptions.querySelectorAll('.sort-btn').forEach(button => {
          button.setAttribute('role', 'menuitemradio');
          button.setAttribute('aria-checked', String(button.classList.contains('active')));
        });
        return;
      }

      setFilterPanelOpen(false);
      closeSortMenu();
      filterPlaceholder.parentNode?.insertBefore(filterPills, filterPlaceholder.nextSibling);
      sortPlaceholder.parentNode?.insertBefore(sortOptions, sortPlaceholder.nextSibling);
      sortOptions.querySelectorAll('.sort-btn').forEach(button => {
        button.removeAttribute('role');
        button.removeAttribute('aria-checked');
      });
    }

    filterToggle.addEventListener('click', () => {
      closeSortMenu();
      setFilterPanelOpen(filterPanel.hidden);
    });
    sortToggle.addEventListener('click', () => {
      if (sortMenu.matches(':popover-open')) {
        closeSortMenu();
        return;
      }
      setFilterPanelOpen(false);
      const bounds = sortToggle.getBoundingClientRect();
      sortMenu.style.top = `${bounds.bottom + 6}px`;
      sortMenu.style.right = `${Math.max(10, window.innerWidth - bounds.left + 6)}px`;
      sortMenu.showPopover();
      sortToggle.setAttribute('aria-expanded', 'true');
    });
    sortMenu.addEventListener('click', event => {
      const selectedButton = event.target.closest('.sort-btn');
      if (!selectedButton) return;
      sortMenu.querySelectorAll('.sort-btn').forEach(button => {
        button.setAttribute('aria-checked', String(button.classList.contains('active')));
      });
      closeSortMenu();
    });
    resetButton.addEventListener('click', () => {
      mobileDeveloperFilterDraft = {
        specialization: 'all',
        gender: 'all',
        status: 'all'
      };
      syncDeveloperFilterControls(mobileDeveloperFilterDraft);
    });
    applyButton.addEventListener('click', () => {
      const filters = mobileDeveloperFilterDraft || getDeveloperFilterValues();
      selectedSpecialization = filters.specialization;
      selectedGender = filters.gender;
      selectedStatus = filters.status;
      mobileDeveloperFilterDraft = null;
      currentPage = 1;
      syncDeveloperFilterControls(getDeveloperFilterValues());
      renderDevelopers();
      setFilterPanelOpen(false);
      filterToggle.focus();
    });
    document.addEventListener('pointerdown', event => {
      if (!actions.contains(event.target)) {
        setFilterPanelOpen(false);
        closeSortMenu();
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (!filterPanel.hidden) setFilterPanelOpen(false);
      closeSortMenu();
    });
    breakpoint.addEventListener('change', syncLayout);
    syncLayout();
  }

  async function loadDevelopers() {
    const status = document.getElementById('directoryStatus');
    status.hidden = false;
    window.DEVMATCH_SKELETON?.status(status,'Loading developer directory');
    window.DEVMATCH_SKELETON?.cards(devsGrid,6,'developer');
    window.DEVMATCH_SKELETON?.text(countHeading,'Loading developer count','90px');
    window.DEVMATCH_SKELETON?.text(developerTabCount,'Loading developer count','24px');
    try {
      const user = await window.devMatchBackend.ready;
      if (!user) throw new Error('Sign in with a client account to browse the developer directory.');
      const account = await window.devMatchBackend.loadProfile(user);
      if (account.account_role !== 'client') throw new Error('The developer directory is available in client mode.');
      const directory = window.devMatchBackend.client.from('directory_people');
      const metricColumns = 'id,display_name,username,account_role,profile_data,published_portfolio_count,published_portfolio_views_count,published_portfolio_favorites_count';
      const legacyColumns = 'id,display_name,username,account_role,profile_data,published_portfolio_count';
      let engagementMetricsAvailable = true;
      let result = await directory.select(metricColumns, {count:'exact'}).eq('account_role','dev');
      if (result.error &&
          ['42703', 'PGRST204'].includes(result.error.code) &&
          /published_portfolio_(views|favorites)_count/.test(result.error.message || '')) {
        engagementMetricsAvailable = false;
        result = await directory.select(legacyColumns, {count:'exact'}).eq('account_role','dev');
      }
      const {data: people, count: totalDevelopers, error} = result;
      if (error) throw error;
      developerTabCount.textContent = totalDevelopers === null ? '0' : String(totalDevelopers);
      DEVELOPERS_DATA = (people || []).map(person => {
        const profile=person.profile_data || {};
        const name=String(person.display_name || 'DEV-MATCH member');
        const skills=Array.isArray(profile.skills)?profile.skills.map(String):[];
        const specialization=String(profile.specialtyOther || profile.specialty || 'Developer');
        const availability=String(profile.availability || '');
        const statusType=/available|open|hiring/i.test(availability)?'open':/busy/i.test(availability)?'busy':'freelance';
        const viewsCount=Number(person.published_portfolio_views_count)||0;
        const favoritesCount=Number(person.published_portfolio_favorites_count)||0;
        return {id:person.id,handle:person.username?`@${String(person.username).replace(/^@/,'')}`:'',contactId:person.id,
          initials:(name.match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'DM',name,
          location:String(profile.city || 'Location not provided'),city:String(profile.city || ''),status:availability || 'Availability not provided',statusType,
          specialization,gender:'',bio:String(profile.bio || 'No biography provided.'),skills,
          projectsCount:Number(person.published_portfolio_count)||0,
          views:engagementMetricsAvailable?String(viewsCount):'Not available',
          viewsCount:engagementMetricsAvailable?viewsCount:0,
          favoritesCount:engagementMetricsAvailable?favoritesCount:'Not available',
          profileUrl:`devmatch-developer-profile.html?developer=${encodeURIComponent(person.id)}`};
      });
      if(genderDropdown)genderDropdown.hidden=true;
      directoryLoaded=true;
      status.hidden = true;
      emptyState.classList.toggle('show',DEVELOPERS_DATA.length===0);
      renderDevelopers();
    } catch (error) {
      console.error('Unable to load the developer directory from Supabase.', error);
      status.textContent = error.message && /Sign in|available in client mode/.test(error.message)
        ? error.message : 'The developer directory could not be loaded. Check your connection and try again.';
      status.hidden = false;
      DEVELOPERS_DATA = [];
      countHeading.textContent = '— developers';
      developerTabCount.textContent = '0';
      devsGrid.replaceChildren();
      directoryLoaded=false;
      emptyState.classList.remove('show');
      emptyState.hidden=true;
      renderDevelopers();
    }
  }

  async function loadProjectTabCount() {
    try {
      const {count, error} = await window.devMatchBackend.client.from('projects')
        .select('id', {count:'exact',head:true})
        .eq('project_kind','portfolio')
        .eq('status','published');
      if (error) throw error;
      projectTabCount.textContent = count === null ? '0' : String(count);
    } catch (error) {
      console.error('Unable to load project tab count from Supabase.', error);
      projectTabCount.textContent = '0';
    }
  }

  initEvents();
  initializeMobileDeveloperActions();
  emptyState.classList.remove('show');
  emptyState.hidden=true;
  loadProjectTabCount();
  loadDevelopers();
})();
