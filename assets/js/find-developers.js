/**
 * Find Developers Page Logic - DEV-MATCH Client Mode
 * Replicates design from "Discover — Developers tab.pdf"
 * Action favorite uses separated storage: 'devmatch-client-dev-favorites'
 */

(function () {
  'use strict';

  // Distinct favorite key for Client Mode Developer bookmarks
  const FAVORITES_KEY = 'devmatch-client-dev-favorites';

  let DEVELOPERS_DATA = [];

  // State
  let searchQuery = '';
  let searchScope = 'all';
  let selectedSpecialization = 'all';
  let selectedGender = 'all';
  let selectedStatus = 'all';
  let currentSort = 'projects';
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
  const sortLabel = document.getElementById('devsSortLabel');
  const specDropdown = document.getElementById('specDropdown');
  const genderDropdown = document.getElementById('genderDropdown');
  const statusDropdown = document.getElementById('statusDropdown');
  const sortBtns = document.querySelectorAll('.sort-btn');
  const toastEl = document.getElementById('fdToast');
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

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2400);
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

  // Render Developer Cards
  function renderDevelopers() {
    if(!directoryLoaded)return;
    const devs = getFilteredDevelopers();

    if (devs.length === 0) {
      devsGrid.innerHTML = '';
      emptyState.classList.add('show');
      emptyState.hidden = false;
    } else {
      emptyState.classList.remove('show');
      emptyState.hidden = true;
      devsGrid.innerHTML = devs.map(dev => {
        const isFav = favoriteIds.includes(dev.id);
        const profileUrl = new URL(dev.profileUrl, location.href);

        return `
          <article class="dev-card" data-dev-id="${escapeHtml(dev.id)}">
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
      const label = trigger ? trigger.querySelector('.filter-label-text') : null;

      specDropdown.addEventListener('click', e => {
        const item = e.target.closest('.dropdown-item');
        if (item) {
          const val = item.dataset.value;
          selectedSpecialization = val;
          specDropdown.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          if (label) {
            label.textContent = val === 'all' ? 'Specialization' : `Specialization: ${val}`;
          }
          trigger.classList.toggle('has-value', val !== 'all');
          specDropdown.classList.remove('open');
          renderDevelopers();
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
      const label = trigger ? trigger.querySelector('.filter-label-text') : null;

      genderDropdown.addEventListener('click', e => {
        const item = e.target.closest('.dropdown-item');
        if (item) {
          const val = item.dataset.value;
          selectedGender = val;
          genderDropdown.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          if (label) {
            label.textContent = val === 'all' ? 'Gender' : val;
          }
          trigger.classList.toggle('has-value', val !== 'all');
          genderDropdown.classList.remove('open');
          renderDevelopers();
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
      const label = trigger ? trigger.querySelector('.filter-label-text') : null;

      statusDropdown.addEventListener('click', e => {
        const item = e.target.closest('.dropdown-item');
        if (item) {
          const val = item.dataset.value;
          selectedStatus = val;
          statusDropdown.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          if (label) {
            label.textContent = val === 'all' ? 'Status' : val;
          }
          trigger.classList.toggle('has-value', val !== 'all');
          statusDropdown.classList.remove('open');
          renderDevelopers();
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
            showToast('Developer dihapus dari Favorites');
          } else {
            favoriteIds = [...favoriteIds, id];
            showToast('Developer ditambahkan ke Favorites');
          }
          saveFavorites(favoriteIds);
          renderDevelopers();
          return;
        }
      });
    }

    // Pagination buttons click
    document.querySelectorAll('.page-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.page-btn[data-page]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Reset filter
    const btnReset = document.getElementById('btnResetDevs');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        searchQuery = '';
        selectedSpecialization = 'all';
        selectedGender = 'all';
        selectedStatus = 'all';
        if (searchInput) searchInput.value = '';
        if (topSearchInput) topSearchInput.value = '';

        const sTrig = specDropdown ? specDropdown.querySelector('.filter-label-text') : null;
        if (sTrig) sTrig.textContent = 'Specialization';
        if (specDropdown) {
          specDropdown.querySelector('.filter-pill-btn').classList.remove('has-value');
          specDropdown.querySelectorAll('.dropdown-item').forEach(el => el.classList.toggle('selected', el.dataset.value === 'all'));
        }

        const gTrig = genderDropdown ? genderDropdown.querySelector('.filter-label-text') : null;
        if (gTrig) gTrig.textContent = 'Gender';
        if (genderDropdown) {
          genderDropdown.querySelector('.filter-pill-btn').classList.remove('has-value');
          genderDropdown.querySelectorAll('.dropdown-item').forEach(el => el.classList.toggle('selected', el.dataset.value === 'all'));
        }

        const stTrig = statusDropdown ? statusDropdown.querySelector('.filter-label-text') : null;
        if (stTrig) stTrig.textContent = 'Status';
        if (statusDropdown) {
          statusDropdown.querySelector('.filter-pill-btn').classList.remove('has-value');
          statusDropdown.querySelectorAll('.dropdown-item').forEach(el => el.classList.toggle('selected', el.dataset.value === 'all'));
        }

        renderDevelopers();
      });
    }
  }

  async function loadDevelopers() {
    const status = document.getElementById('directoryStatus');
    status.hidden = false;
    status.textContent = 'Loading developer directory?';
    try {
      const user = await window.devMatchBackend.ready;
      if (!user) throw new Error('Sign in with a client account to browse the developer directory.');
      const {data: account, error: accountError} = await window.devMatchBackend.client
        .from('profiles').select('account_role').eq('id', user.id).single();
      if (accountError) throw accountError;
      if (account.account_role !== 'client') throw new Error('The developer directory is available in client mode.');
      const {data: people, error} = await window.devMatchBackend.client.from('directory_people')
        .select('id,display_name,username,account_role,profile_data,published_portfolio_count')
        .eq('account_role','dev');
      if (error) throw error;
      DEVELOPERS_DATA = (people || []).map(person => {
        const profile=person.profile_data || {};
        const name=String(person.display_name || 'DEV-MATCH member');
        const skills=Array.isArray(profile.skills)?profile.skills.map(String):[];
        const specialization=String(profile.specialtyOther || profile.specialty || 'Developer');
        const availability=String(profile.availability || '');
        const statusType=/available|open|hiring/i.test(availability)?'open':/busy/i.test(availability)?'busy':'freelance';
        return {id:person.id,handle:person.username?`@${String(person.username).replace(/^@/,'')}`:'',contactId:person.id,
          initials:(name.match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'DM',name,
          location:String(profile.city || 'Location not provided'),city:String(profile.city || ''),status:availability || 'Availability not provided',statusType,
          specialization,gender:'',bio:String(profile.bio || 'No biography provided.'),skills,
          projectsCount:Number(person.published_portfolio_count)||0,views:'Not available',viewsCount:0,favoritesCount:'Not available',
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
      directoryLoaded=false;
      emptyState.classList.remove('show');
      emptyState.hidden=true;
      renderDevelopers();
    }
  }

  initEvents();
  emptyState.classList.remove('show');
  emptyState.hidden=true;
  loadDevelopers();
})();
