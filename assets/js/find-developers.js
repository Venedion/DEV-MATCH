/**
 * Find Developers Page Logic - DEV-MATCH Client Mode
 * Replicates design from "Discover — Developers tab.pdf"
 * Action favorite uses separated storage: 'devmatch-client-dev-favorites'
 */

(function () {
  'use strict';

  // Distinct favorite key for Client Mode Developer bookmarks
  const FAVORITES_KEY = 'devmatch-client-dev-favorites';

  const DEVELOPERS_DATA = Array.isArray(window.DEVMATCH_SAMPLE_DEVELOPERS) && window.DEVMATCH_SAMPLE_DEVELOPERS.length > 0
    ? window.DEVMATCH_SAMPLE_DEVELOPERS
    : [
        {
          id: 'rizky-aditya',
          handle: '@rizkyaditya',
          contactId: 'rizky',
          initials: 'RA',
          name: 'Rizky Aditya',
          location: 'Medan, Indonesia',
          city: 'Medan',
          status: 'Open for hiring',
          statusType: 'open',
          specialization: 'Full-stack',
          gender: 'Male',
          bio: 'Business websites and POS systems for Indonesian SMEs. 5 years shipping Laravel + React.',
          skills: ['React', 'Laravel', 'MySQL', 'Figma'],
          projectsCount: 18,
          views: '4.2k',
          viewsCount: 4200,
          favoritesCount: 312,
          rating: '4.9',
          reviews: 24,
          profileUrl: 'devmatch-developer-profile.html?developer=restaurant'
        },
        {
          id: 'winson-lim',
          handle: '@winsonlim',
          contactId: 'winson',
          initials: 'WL',
          name: 'Winson Lim',
          location: 'Medan, Indonesia',
          city: 'Medan',
          status: 'Freelance',
          statusType: 'freelance',
          specialization: 'Full-stack',
          gender: 'Male',
          bio: 'Founder of chrip.dev — custom web systems for cafés, retail and small businesses.',
          skills: ['Next.js', 'Supabase', 'Tailwind', 'Vercel'],
          projectsCount: 14,
          views: '3.6k',
          viewsCount: 3600,
          favoritesCount: 276,
          rating: '4.8',
          reviews: 19,
          profileUrl: 'devmatch-developer-profile.html?developer=pos'
        },
        {
          id: 'putri-ayu-lestari',
          handle: '@putriayu',
          contactId: 'putri',
          initials: 'PA',
          name: 'Putri Ayu Lestari',
          location: 'Yogyakarta, Indonesia',
          city: 'Yogyakarta',
          status: 'Open for hiring',
          statusType: 'open',
          specialization: 'Full-stack',
          gender: 'Female',
          bio: 'Booking and membership platforms with clean admin dashboards and payment gateways.',
          skills: ['Vue', 'Node.js', 'Prisma', 'Midtrans'],
          projectsCount: 12,
          views: '2.8k',
          viewsCount: 2800,
          favoritesCount: 241,
          rating: '4.9',
          reviews: 18,
          profileUrl: 'devmatch-developer-profile.html?developer=booking'
        },
        {
          id: 'fajar-ramadhan',
          handle: '@fajar_r',
          contactId: 'fajar',
          initials: 'FR',
          name: 'Fajar Ramadhan',
          location: 'Jakarta, Indonesia',
          city: 'Jakarta',
          status: 'Busy',
          statusType: 'busy',
          specialization: 'Full-stack',
          gender: 'Male',
          bio: 'Enterprise-grade web apps — ERP modules, inventory and reporting for distributors.',
          skills: ['Django', 'React', 'Redis', 'AWS'],
          projectsCount: 21,
          views: '5.1k',
          viewsCount: 5100,
          favoritesCount: 230,
          rating: '4.8',
          reviews: 27,
          profileUrl: 'devmatch-developer-profile.html?developer=inventory'
        },
        {
          id: 'michelle-gunawan',
          handle: '@michelleg',
          contactId: 'michelle',
          initials: 'MG',
          name: 'Michelle Gunawan',
          location: 'Medan, Indonesia',
          city: 'Medan',
          status: 'Open for hiring',
          statusType: 'open',
          specialization: 'Full-stack',
          gender: 'Female',
          bio: 'E-commerce specialist: storefronts, marketplace sync and courier integrations.',
          skills: ['Shopify', 'Next.js', 'Go', 'Figma'],
          projectsCount: 9,
          views: '1.9k',
          viewsCount: 1900,
          favoritesCount: 198,
          rating: '4.7',
          reviews: 14,
          profileUrl: 'devmatch-developer-profile.html?developer=store'
        },
        {
          id: 'yosua-simanjuntak',
          handle: '@yosuas',
          contactId: 'yosua',
          initials: 'YS',
          name: 'Yosua Simanjuntak',
          location: 'Balige, Indonesia',
          city: 'Balige',
          status: 'Not available',
          statusType: 'unavailable',
          specialization: 'Full-stack',
          gender: 'Male',
          bio: 'School and community apps — attendance, payments and parent portals.',
          skills: ['Laravel', 'Flutter', 'MySQL', 'Docker'],
          projectsCount: 7,
          views: '1.2k',
          viewsCount: 1200,
          favoritesCount: 143,
          rating: '4.6',
          reviews: 11,
          profileUrl: 'devmatch-developer-profile.html?developer=analytics'
        }
      ];

  // State
  let searchQuery = '';
  let searchScope = 'all';
  let selectedSpecialization = 'Full-stack'; // Default matching PDF ("Specialization: Full-stack")
  let selectedGender = 'all';
  let selectedStatus = 'all';
  let currentSort = 'favorites'; // 'favorites', 'views', 'projects'
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

  // Load favorites from localStorage
  function loadFavorites() {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
      const initialSeed = ['rizky-aditya'];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(initialSeed));
      return initialSeed;
    } catch (e) {
      return ['rizky-aditya'];
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
    if (sidebarFavBadge) {
      sidebarFavBadge.textContent = String(favoriteIds.length);
    }
  }

  // Filter & Sort Logic
  function getFilteredDevelopers() {
    return DEVELOPERS_DATA.filter(dev => {
      // Specialization filter
      if (selectedSpecialization !== 'all' && dev.specialization.toLowerCase() !== selectedSpecialization.toLowerCase()) {
        return false;
      }

      // Gender filter
      if (selectedGender !== 'all' && dev.gender.toLowerCase() !== selectedGender.toLowerCase()) {
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
    }).sort((a, b) => {
      if (currentSort === 'views') {
        return b.viewsCount - a.viewsCount;
      } else if (currentSort === 'projects') {
        return b.projectsCount - a.projectsCount;
      } else {
        // 'favorites'
        return b.favoritesCount - a.favoritesCount;
      }
    });
  }

  // Render Developer Cards
  function renderDevelopers() {
    const devs = getFilteredDevelopers();

    if (devs.length === 0) {
      devsGrid.innerHTML = '';
      emptyState.classList.add('show');
    } else {
      emptyState.classList.remove('show');
      devsGrid.innerHTML = devs.map(dev => {
        const isFav = favoriteIds.includes(dev.id);

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
                  <path d="m20.8 4.6-1.4-1.4a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>
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
                <strong>${dev.favoritesCount}</strong>
                <small>Favorites</small>
              </div>
            </div>

            <div class="dev-actions-row">
              <a class="btn-view-profile" href="${escapeHtml(dev.profileUrl)}">
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
        countHeading.textContent = '38 full-stack developers';
      } else if (selectedSpecialization !== 'all') {
        countHeading.textContent = `${devs.length} ${selectedSpecialization.toLowerCase()} developers`;
      } else {
        countHeading.textContent = `${devs.length} developers`;
      }
    }

    if (sortLabel) {
      if (currentSort === 'views') {
        sortLabel.textContent = 'Sorted by most viewed';
      } else if (currentSort === 'projects') {
        sortLabel.textContent = 'Sorted by most projects';
      } else {
        sortLabel.textContent = 'Sorted by most favorited';
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
      devsGrid.addEventListener('click', e => {
        const favBtn = e.target.closest('.btn-dev-favorite');
        if (favBtn) {
          const id = favBtn.dataset.favoriteId;
          const idx = favoriteIds.indexOf(id);
          if (idx > -1) {
            favoriteIds.splice(idx, 1);
            showToast('Developer dihapus dari Favorites');
          } else {
            favoriteIds.push(id);
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

  // Initialize
  initEvents();
  renderDevelopers();
})();
