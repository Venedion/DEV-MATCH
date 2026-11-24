/**
 * Favorites Page Logic - DEV-MATCH
 * Fully mode-aware:
 * - Developer Mode: saved projects and saved clients
 * - Client Mode: saved projects and saved developers
 * Strictly separated storage per mode.
 */

(async function() {
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
  const mobileFavoritesBackLink = document.getElementById('mobileFavoritesBack');
  if (mobileFavoritesBackLink) {
    const previousPage = new URL(document.referrer || window.location.href);
    const previousPageName = previousPage.pathname.split('/').pop();
    if (previousPage.origin === window.location.origin
      && ['devmatch-find-projects.html', 'devmatch-find-clients.html'].includes(previousPageName)) {
      mobileFavoritesBackLink.href = `${previousPageName}${previousPage.search}${previousPage.hash}`;
    }
  }
  const isClient = urlParams.get('role') === 'client' || document.body.classList.contains('client-shell-page');
  const clientProfileOptions = window.DEVMATCH_CLIENT_PROFILE_OPTIONS;
  const initialFavoriteGrid = document.getElementById('favGrid');
  window.DEVMATCH_SKELETON?.cards(initialFavoriteGrid,4,'favorite-project');
  ['countProjects','countClients','countDevs','favCount','mobileFavCount'].forEach(id =>
    window.DEVMATCH_SKELETON?.text(document.getElementById(id),'Loading saved item count','24px')
  );

  // Storage Keys
  const PROJECTS_KEY = isClient ? 'devmatch-client-project-favorites' : 'devmatch-developer-project-favorites';
  const CLIENTS_KEY = 'devmatch-favorite-clients';
  const DEVS_KEY = 'devmatch-client-dev-favorites';
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const validFavoriteIds = ids => Array.isArray(ids)
    ? [...new Set(ids.filter(id => typeof id === 'string' && UUID_PATTERN.test(id)))]
    : [];
  if (!await window.devMatchBackend.ready) return;
  let initialFavoriteRows = null;
  try {
    initialFavoriteRows = await window.devMatchBackend.loadFavorites();
  } catch (error) {
    console.error('Unable to load favorites from Supabase.', error);
    window.DEVMATCH_SKELETON?.status(initialFavoriteGrid,'Unable to load saved items');
    ['countProjects','countClients','countDevs','favCount','mobileFavCount'].forEach(id => {
      const count = document.getElementById(id);
      if (count) count.textContent = '—';
    });
    window.alert('Unable to load favorites. Check your connection and try again.');
    return;
  }
  if (initialFavoriteRows) {
    const idsFor = type => validFavoriteIds(initialFavoriteRows.filter(item => item.type === type).map(item => item.id));
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(idsFor('project')));
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(idsFor('client')));
    localStorage.setItem(DEVS_KEY, JSON.stringify(idsFor('developer')));
  }

  let favoriteProjects = [];
  let favoriteClients = [];
  let favoriteDevelopers = [];

  function getAllProjects() {
    return favoriteProjects;
  }

  function getAllClients() {
    return favoriteClients;
  }

  function getAllDevelopers() {
    return favoriteDevelopers;
  }

  // Load Saved Projects
  function loadProjectFavorites() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(PROJECTS_KEY);
        if (stored) return JSON.parse(stored);
        const defaultFavorites = [];
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(defaultFavorites));
        return defaultFavorites;
      }
    } catch (e) {
      console.warn('Failed to read project favorites from localStorage', e);
    }
    return [];
  }

  // Load Saved Clients (Developer Mode)
  function loadClientFavorites() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(CLIENTS_KEY);
        if (stored) return JSON.parse(stored);
        const defaultClients = [];
        localStorage.setItem(CLIENTS_KEY, JSON.stringify(defaultClients));
        return defaultClients;
      }
    } catch (e) {
      console.warn('Failed to read client favorites from localStorage', e);
    }
    return [];
  }

  // Load Saved Developers (Client Mode)
  function loadDevFavorites() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(DEVS_KEY);
        if (stored) return JSON.parse(stored);
        const defaultDevs = [];
        localStorage.setItem(DEVS_KEY, JSON.stringify(defaultDevs));
        return defaultDevs;
      }
    } catch (e) {
      console.warn('Failed to read developer favorites from localStorage', e);
    }
    return [];
  }

  async function persistFavorite(type, id, saved, storageKey) {
    await window.devMatchBackend.setFavorite(type, id, saved);
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const ids = Array.isArray(stored) ? stored : [];
    const updated = saved
      ? [...new Set([...ids, id])]
      : ids.filter(item => item !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    return updated;
  }

  async function clearFavoriteCollection(type, storageKey) {
    await window.devMatchBackend.clearFavorites(type);
    localStorage.setItem(storageKey, '[]');
  }

  // State
  let favoriteProjectIds = initialFavoriteRows ? validFavoriteIds(loadProjectFavorites()) : [];
  let favoriteClientIds = initialFavoriteRows ? validFavoriteIds(loadClientFavorites()) : [];
  let favoriteDevIds = initialFavoriteRows ? validFavoriteIds(loadDevFavorites()) : [];
  let currentTab = 'projects'; // 'projects' or ('clients' in dev mode / 'developers' in client mode)
  let currentCategory = 'all';
  let currentType = 'all';
  let favoriteClientLocation = {country: 'all', regions: []};
  let favoriteClientsWithOpenRequestsOnly = false;
  let mobileClientFilterDraft = null;
  let favoriteClientLocationRegions = {};
  let favoriteClientLocationOptionsError = '';
  let favoriteClientRegionSearchQuery = '';
  let searchQuery = '';
  let currentSort = 'recent';
  let lastRemovedItem = null;
  let pendingFavoriteRemoval = null;

  // DOM Elements
  const favGridEl = document.getElementById('favGrid');
  const favCountEl = document.getElementById('favCount');
  const mobileFavCountEl = document.getElementById('mobileFavCount');
  const tabProjectsBtn = document.getElementById('tabProjects');
  const tabSecondaryBtn = document.getElementById('tabClients') || document.getElementById('tabDevs');
  const countProjectsEl = document.getElementById('countProjects');
  const countSecondaryEl = document.getElementById('countClients') || document.getElementById('countDevs');
  const searchInputEl = document.getElementById('favSearchInput');
  const categorySelectEl = document.getElementById('favCategorySelect');
  const typeSelectEl = document.getElementById('favTypeSelect');
  const sortSelectEl = document.getElementById('favSortSelect');
  const mobileFavoritesTypeGroup = document.getElementById('mobileFavoritesTypeGroup');
  const mobileFavoritesTypeOptions = document.getElementById('mobileFavoritesTypeOptions');
  const mobileFavoritesOpenRequestsGroup = document.getElementById('mobileFavoritesOpenRequestsGroup');
  const mobileFavoritesOpenRequests = document.getElementById('mobileFavoritesOpenRequests');
  const mobileFavoritesCategoryHeading = document.getElementById('mobileFavoritesCategoryHeading');
  const mobileFavoritesCategoryOptions = document.getElementById('mobileFavoritesCategoryOptions');
  const mobileFavoritesLocationGroup = document.getElementById('mobileFavoritesLocationGroup');
  const mobileFavoritesCountryOptions = document.getElementById('mobileFavoritesCountryOptions');
  const mobileFavoritesRegionSection = document.getElementById('mobileFavoritesRegionSection');
  const mobileFavoritesRegionHeading = document.getElementById('mobileFavoritesRegionHeading');
  const mobileFavoritesRegionSearch = document.getElementById('mobileFavoritesRegionSearch');
  const mobileFavoritesRegionOptions = document.getElementById('mobileFavoritesRegionOptions');
  const mobileFavoritesRegionEmpty = document.getElementById('mobileFavoritesRegionEmpty');
  const mobileFavoritesLocationStatus = document.getElementById('mobileFavoritesLocationStatus');
  const mobileFavoritesSortOptions = document.getElementById('mobileFavoritesSortOptions');
  const favoriteSelectUIs = [];
  const favExploreBtn = document.getElementById('favExploreBtn');
  const favClientDialog = document.getElementById('favClientDialog');
  const favDialogCloseBtn = document.getElementById('favDialogCloseBtn');
  const favDialogContent = document.getElementById('favDialogContent');
  const favRemoveDialog = document.getElementById('favRemoveDialog');
  const favRemoveTitle = document.getElementById('favRemoveTitle');
  const favRemoveMessage = document.getElementById('favRemoveMessage');
  const favRemoveCancel = document.getElementById('favRemoveCancel');
  const favRemoveConfirm = document.getElementById('favRemoveConfirm');
  const toastEl = document.getElementById('favToast');
  const toastTextEl = document.getElementById('favToastText');

  function confirmFavoriteRemoval(type, id, label) {
    pendingFavoriteRemoval = {action: 'remove', type, id};
    favRemoveTitle.textContent = 'Remove from favorites?';
    favRemoveMessage.textContent = `Are you sure you want to remove “${label}” from your favorites?`;
    favRemoveConfirm.textContent = 'Remove';
    favRemoveDialog.showModal();
  }

  function confirmClearAllFavorites(type, label) {
    pendingFavoriteRemoval = {action: 'clear-all', type};
    favRemoveTitle.textContent = 'Clear all favorites?';
    favRemoveMessage.textContent = `Are you sure you want to remove all saved ${label} from your favorites?`;
    favRemoveConfirm.textContent = 'Clear All';
    favRemoveDialog.showModal();
  }

  async function loadFavoriteEntities() {
    if (!initialFavoriteRows) return;
    const client = window.devMatchBackend.client;
    let projectRows = [];
    if (favoriteProjectIds.length) {
      const {data, error} = await client.from('projects')
        .select('id,owner_id,title,project_kind,project_type,category,price,cover_image,status,data,created_at')
        .in('id', favoriteProjectIds)
        .eq('project_kind', isClient ? 'portfolio' : 'request')
        .eq('status', isClient ? 'published' : 'open');
      if (error) throw error;
      projectRows = data || [];
    }

    const ownerIds = [...new Set(projectRows.map(project => project.owner_id).filter(Boolean))];
    const projectOwners = new Map();
    if (ownerIds.length) {
      const {data, error} = await client.from('directory_people')
        .select('id,display_name,username,account_role,profile_data')
        .eq('account_role', isClient ? 'dev' : 'client')
        .in('id', ownerIds);
      if (error) throw error;
      (data || []).forEach(person => projectOwners.set(person.id, person));
    }
    favoriteProjects = projectRows.map(row => {
      const data = row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? row.data : {};
      const owner = projectOwners.get(row.owner_id);
      const name = String(owner?.display_name || 'DEV-MATCH member');
      const price = String(row.price || data.budgetLabel || data.budget || 'Contact for pricing');
      const detailUrl = isClient
        ? `devmatch-discover-project-detail.html?project=${encodeURIComponent(row.id)}`
        : `devmatch-find-project-detail.html?request=${encodeURIComponent(row.id)}`;
      const profileUrl = isClient
        ? `devmatch-developer-profile.html?developer=${encodeURIComponent(row.owner_id)}`
        : `devmatch-client-profile.html?client=${encodeURIComponent(row.owner_id)}`;
      return {
        ...data,
        id: row.id,
        ownerId: row.owner_id,
        title: String(row.title || data.title || 'Untitled project'),
        type: String(row.project_type || data.projectType || data.type || 'Project'),
        category: String(row.category || data.category || 'Other'),
        description: String(data.description || data.overview || ''),
        developer: name,
        handle: owner?.username ? `@${String(owner.username).replace(/^@/, '')}` : '',
        initials: (name.match(/\b\p{L}/gu) || []).slice(0, 2).join('').toUpperCase() || 'DM',
        price,
        detailUrl,
        profileUrl,
        coverImage: String(row.cover_image || ''),
        art: 'dashboard-art'
      };
    });

    if (isClient && favoriteDevIds.length) {
      const {data, error} = await client.from('directory_people')
        .select('id,display_name,username,profile_data,published_portfolio_count')
        .eq('account_role', 'dev')
        .in('id', favoriteDevIds);
      if (error) throw error;
      favoriteDevelopers = (data || []).map(person => {
        const profile = person.profile_data || {};
        const name = String(person.display_name || 'DEV-MATCH member');
        const skills = Array.isArray(profile.skills) ? profile.skills.map(String) : [];
        const specialization = Array.isArray(profile.specialty)
          ? profile.specialty.join(', ')
          : String(profile.specialtyOther || profile.specialty || 'Developer');
        const availability = String(profile.availability || 'Availability not provided');
        return {
          id: person.id,
          name,
          initials: (name.match(/\b\p{L}/gu) || []).slice(0, 2).join('').toUpperCase() || 'DM',
          specialization,
          status: availability,
          location: [profile.city, profile.country].filter(Boolean).join(', ') || 'Location not provided',
          bio: String(profile.bio || 'No biography provided.'),
          skills,
          projectsCount: Number(person.published_portfolio_count) || 0,
          views: 'Not available',
          viewsCount: 0,
          favoritesCount: 'Not available',
          contactId: person.id,
          profileUrl: `devmatch-developer-profile.html?developer=${encodeURIComponent(person.id)}`
        };
      });
    } else if (!isClient && favoriteClientIds.length) {
      const {data: people, error: peopleError} = await client.from('directory_people')
        .select('id,display_name,profile_data,open_request_count')
        .eq('account_role', 'client')
        .in('id', favoriteClientIds);
      if (peopleError) throw peopleError;
      const requestsByOwner = new Map();
      const {data: requests, error: requestsError} = await client.from('projects')
        .select('id,owner_id,title,project_type,category,price,data')
        .eq('project_kind', 'request')
        .eq('status', 'open')
        .in('owner_id', favoriteClientIds)
        .order('updated_at', {ascending: false});
      if (requestsError) throw requestsError;
      (requests || []).forEach(row => {
        const data = row.data && typeof row.data === 'object' ? row.data : {};
        const request = {
          title: String(row.title || data.title || 'Untitled request'),
          budget: String(row.price || data.budgetLabel || data.budget || 'Budget not specified'),
          description: String(data.description || data.overview || ''),
          category: String(row.category || data.category || 'Other'),
          type: String(row.project_type || data.projectType || data.type || 'Project'),
          tags: Array.isArray(data.stack) ? data.stack.map(String) : []
        };
        requestsByOwner.set(row.owner_id, [...(requestsByOwner.get(row.owner_id) || []), request]);
      });
      favoriteClients = (people || []).map(person => {
        const profile = person.profile_data || {};
        const name = String(person.display_name || 'DEV-MATCH member');
        const requestsForClient = requestsByOwner.get(person.id) || [];
        const category = String(profile.industry || 'Business');
        return {
          id: person.id,
          contactId: person.id,
          name,
          initials: (name.match(/\b\p{L}/gu) || []).slice(0, 2).join('').toUpperCase() || 'DM',
          business: String(profile.companyName || name),
          category,
          businessType: category,
          country: String(profile.country || ''),
          profileCity: String(profile.city || ''),
          location: [profile.city, profile.country].filter(Boolean).join(', ') || 'Location not provided',
          openRequestsCount: Number(person.open_request_count) || 0,
          requests: requestsForClient,
          activeText: 'Active'
        };
      });
    }
  }
  const toastUndoBtn = document.getElementById('favToastUndo');
  let toastTimer = null;

  function updateFavoriteSelect(select) {
    const wrapper = select.closest('.fav-select-wrap');
    const trigger = wrapper?.querySelector('.fav-select-trigger');
    const menu = wrapper?.querySelector('.fav-select-menu');
    if (!trigger || !menu) return;

    const selectedOption = select.selectedOptions[0];
    trigger.querySelector('span').textContent = selectedOption?.textContent.trim() || 'Choose an option';
    menu.replaceChildren(...Array.from(select.options, option => {
      const item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option === selectedOption));
      item.dataset.value = option.value;
      item.textContent = option.textContent.trim();
      return item;
    }));
  }

  function setupFavoriteSelect(select) {
    const wrapper = select.closest('.fav-select-wrap');
    const trigger = wrapper?.querySelector('.fav-select-trigger');
    const menu = wrapper?.querySelector('.fav-select-menu');
    if (!wrapper || !trigger || !menu) return;

    const close = ({focusTrigger = false} = {}) => {
      wrapper.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
      menu.inert = true;
      if (focusTrigger && trigger.getClientRects().length) trigger.focus();
    };
    const open = () => {
      favoriteSelectUIs.forEach(ui => {
        if (ui.wrapper !== wrapper) ui.close();
      });
      wrapper.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
      menu.inert = false;
      menu.querySelector('[aria-selected="true"]')?.focus();
    };
    const selectOption = option => {
      select.value = option.dataset.value;
      updateFavoriteSelect(select);
      select.dispatchEvent(new Event('change', {bubbles: true}));
      close({focusTrigger: true});
    };

    trigger.addEventListener('click', () => {
      if (wrapper.classList.contains('open')) close();
      else open();
    });
    trigger.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        open();
      }
    });
    menu.addEventListener('click', event => {
      const option = event.target.closest('[role="option"]');
      if (option) selectOption(option);
    });
    menu.addEventListener('keydown', event => {
      const options = Array.from(menu.querySelectorAll('[role="option"]'));
      const currentIndex = options.indexOf(document.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        close({focusTrigger: true});
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
        close();
      }
    });
    select.addEventListener('change', () => updateFavoriteSelect(select));
    const ui = {wrapper, close};
    favoriteSelectUIs.push(ui);
    updateFavoriteSelect(select);
  }

  function updateFavoriteTabIndicator() {
    const tabs = document.querySelector('.fav-tabs');
    const activeTab = tabs?.querySelector('.fav-tab-btn.active');
    if (!tabs || !activeTab) return;
    const tabButtons = [...tabs.querySelectorAll('.fav-tab-btn')];
    const activeIndex = tabButtons.indexOf(activeTab);
    const tabsBounds = tabs.getBoundingClientRect();
    const activeBounds = activeTab.getBoundingClientRect();
    const previousBounds = tabButtons[activeIndex - 1]?.getBoundingClientRect();
    const nextBounds = tabButtons[activeIndex + 1]?.getBoundingClientRect();
    const previousGap = previousBounds ? activeBounds.left - previousBounds.right : nextBounds ? nextBounds.left - activeBounds.right : 0;
    const nextGap = nextBounds ? nextBounds.left - activeBounds.right : previousBounds ? activeBounds.left - previousBounds.right : 0;
    const indicatorX = activeBounds.left - tabsBounds.left - previousGap / 2;
    const indicatorWidth = activeBounds.width + previousGap / 2 + nextGap / 2;
    tabs.style.setProperty('--fav-tab-indicator-x', `${indicatorX}px`);
    tabs.style.setProperty('--fav-tab-indicator-width', `${indicatorWidth}px`);
    tabs.classList.add('indicator-ready');
  }

  [categorySelectEl, sortSelectEl].filter(Boolean).forEach(setupFavoriteSelect);
  document.addEventListener('click', event => {
    favoriteSelectUIs.forEach(ui => {
      if (!event.target.closest('.fav-select-wrap')) ui.close();
    });
  });

  function closeMobileFavoritesPanels() {
    const actions = document.getElementById('mobileFavoritesStickyActions');
    const sortPanel = document.getElementById('mobileFavoritesSortPanel');
    const filterPanel = document.getElementById('mobileFavoritesFilterPanel');
    const sortToggle = document.getElementById('mobileFavoritesSortToggle');
    const filterToggle = document.getElementById('mobileFavoritesFilterToggle');
    if (!actions || !sortPanel || !filterPanel) return;
    sortPanel.hidden = true;
    filterPanel.hidden = true;
    sortToggle?.setAttribute('aria-expanded', 'false');
    filterToggle?.setAttribute('aria-expanded', 'false');
    actions.classList.remove('mobile-sort-open', 'mobile-filter-open');
    favoriteSelectUIs.forEach(ui => ui.close());
    if (mobileClientFilterDraft) {
      mobileClientFilterDraft = null;
      renderMobileFavoritesFilterOptions();
    }
  }

  function renderMobileChoiceList(select, container, buttonClass, selectedValue = select?.value, onSelect) {
    if (!select || !container) return;
    container.replaceChildren(...Array.from(select.options, option => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = buttonClass;
      button.dataset.value = option.value;
      button.setAttribute('aria-pressed', String(option.value === selectedValue));

      const label = document.createElement('span');
      label.textContent = option.textContent;
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'm5 12 4 4L19 6');
      icon.append(path);
      button.append(label, icon);
      button.addEventListener('click', event => {
        event.stopPropagation();
        if (onSelect) {
          onSelect(option.value);
        } else {
          select.value = option.value;
          select.dispatchEvent(new Event('change', {bubbles: true}));
        }
      });
      return button;
    }));
  }

  function copyFavoriteClientLocation(location) {
    return {
      country: location?.country || 'all',
      regions: Array.isArray(location?.regions) ? [...new Set(location.regions)] : []
    };
  }

  function createFavoriteLocationCheckmark() {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm5 12 4 4L19 6');
    icon.append(path);
    return icon;
  }

  function renderMobileFavoriteClientLocationOptions(location = mobileClientFilterDraft?.location || favoriteClientLocation) {
    if (!clientProfileOptions || !mobileFavoritesCountryOptions || !mobileFavoritesRegionSection
      || !mobileFavoritesRegionOptions) return;
    const selectedLocation = copyFavoriteClientLocation(location);
    mobileFavoritesCountryOptions.replaceChildren(...[
      {value: 'all', label: 'All countries'},
      ...clientProfileOptions.countries.map(country => ({value: country, label: country}))
    ].map(({value, label}) => {
      const button = document.createElement('button');
      button.className = 'location-country-option';
      button.type = 'button';
      button.dataset.country = value;
      button.setAttribute('aria-pressed', String(selectedLocation.country === value));
      button.setAttribute('aria-expanded', String(selectedLocation.country === value && value !== 'all'));
      button.setAttribute('aria-controls', 'mobileFavoritesRegionSection');
      const text = document.createElement('span');
      text.textContent = label;
      button.append(text, createFavoriteLocationCheckmark());
      button.addEventListener('click', event => {
        event.stopPropagation();
        if (!mobileClientFilterDraft) return;
        mobileClientFilterDraft.location = {country: value, regions: []};
        favoriteClientRegionSearchQuery = '';
        if (mobileFavoritesRegionSearch) mobileFavoritesRegionSearch.value = '';
        renderMobileFavoriteClientLocationOptions(mobileClientFilterDraft.location);
        if (value !== 'all') {
          requestAnimationFrame(() => mobileFavoritesRegionSection.scrollIntoView({block: 'nearest'}));
        }
      });
      return button;
    }));

    const country = clientProfileOptions.countries.find(item => item === selectedLocation.country);
    mobileFavoritesRegionSection.hidden = !country;
    mobileFavoritesRegionOptions.replaceChildren();
    if (!country) {
      if (mobileFavoritesLocationStatus) mobileFavoritesLocationStatus.hidden = true;
      if (mobileFavoritesRegionEmpty) mobileFavoritesRegionEmpty.hidden = true;
      return;
    }

    if (mobileFavoritesRegionHeading) {
      mobileFavoritesRegionHeading.textContent = country === 'Malaysia'
        ? 'STATE'
        : country === 'Singapore' ? 'REGION' : 'PROVINCE';
    }
    const regions = favoriteClientLocationRegions[country] || [];
    const query = favoriteClientRegionSearchQuery.trim().toLocaleLowerCase();
    const matchingRegions = regions.filter(region => region.name.toLocaleLowerCase().includes(query));
    const allOption = regions.length ? document.createElement('button') : null;
    if (allOption) {
      allOption.className = 'location-region-option location-region-all-option';
      allOption.type = 'button';
      allOption.setAttribute('aria-pressed', String(selectedLocation.regions.length === 0));
      const label = country === 'Malaysia' ? 'All states' : country === 'Singapore' ? 'All regions' : 'All provinces';
      const text = document.createElement('span');
      text.textContent = label;
      allOption.append(text, createFavoriteLocationCheckmark());
      allOption.addEventListener('click', event => {
        event.stopPropagation();
        if (!mobileClientFilterDraft) return;
        mobileClientFilterDraft.location.regions = [];
        renderMobileFavoriteClientLocationOptions(mobileClientFilterDraft.location);
      });
    }
    mobileFavoritesRegionOptions.replaceChildren(
      ...(allOption ? [allOption] : []),
      ...matchingRegions.map(region => {
        const button = document.createElement('button');
        button.className = 'location-region-option';
        button.type = 'button';
        button.dataset.region = region.name;
        button.setAttribute('aria-pressed', String(selectedLocation.regions.includes(region.name)));
        const text = document.createElement('span');
        text.textContent = region.name;
        button.append(text, createFavoriteLocationCheckmark());
        button.addEventListener('click', event => {
          event.stopPropagation();
          if (!mobileClientFilterDraft) return;
          const selected = new Set(mobileClientFilterDraft.location.regions);
          if (selected.has(region.name)) selected.delete(region.name);
          else selected.add(region.name);
          mobileClientFilterDraft.location.regions = [...selected];
          renderMobileFavoriteClientLocationOptions(mobileClientFilterDraft.location);
        });
        return button;
      })
    );
    if (mobileFavoritesRegionEmpty) {
      mobileFavoritesRegionEmpty.hidden = Boolean(favoriteClientLocationOptionsError)
        || !regions.length || matchingRegions.length > 0;
    }
    if (mobileFavoritesLocationStatus) {
      mobileFavoritesLocationStatus.hidden = !favoriteClientLocationOptionsError && regions.length > 0;
      mobileFavoritesLocationStatus.textContent = favoriteClientLocationOptionsError
        || (regions.length ? '' : 'Loading location options…');
    }
  }

  function getFavoriteClientRegion(client) {
    const country = clientProfileOptions.countries.find(item =>
      item.toLocaleLowerCase() === client.country.toLocaleLowerCase()
    );
    const regions = favoriteClientLocationRegions[country] || [];
    const rawLocation = String(client.profileCity || '').trim();
    if (!rawLocation) return '';
    const [firstPart, ...remainingParts] = rawLocation.split(',');
    const prefix = firstPart.trim().toLocaleLowerCase();
    const matchingRegion = regions.find(region => region.name.toLocaleLowerCase() === prefix);
    if (matchingRegion) return matchingRegion.name;
    if (remainingParts.length) return firstPart.trim();

    const city = rawLocation.toLocaleLowerCase();
    const matches = regions.filter(region => region.cities.some(item =>
      item.name.toLocaleLowerCase() === city
    ));
    return matches.length === 1 ? matches[0].name : '';
  }

  async function loadFavoriteClientLocationOptions() {
    try {
      const loadJson = async path => {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Location data request failed with status ${response.status}.`);
        return response.json();
      };
      const [indonesia, malaysiaSingapore] = await Promise.all([
        loadJson('assets/data/indonesia-regions.json?v=20261121-location-alpha-v1'),
        loadJson('assets/data/malaysia-singapore-regions.json?v=20261122-malaysia-singapore-v1')
      ]);
      const groups = {
        Indonesia: indonesia.provinces,
        Malaysia: malaysiaSingapore.countries?.Malaysia,
        Singapore: malaysiaSingapore.countries?.Singapore
      };
      for (const country of clientProfileOptions.countries) {
        const regions = groups[country];
        if (!Array.isArray(regions) || !regions.length
          || regions.some(region => typeof region.name !== 'string' || !Array.isArray(region.cities))) {
          throw new Error(`The ${country} location list is incomplete.`);
        }
      }
      favoriteClientLocationRegions = groups;
      favoriteClientLocationOptionsError = '';
      renderMobileFavoriteClientLocationOptions();
    } catch (error) {
      console.error('Unable to load Favorites client location options.', error);
      favoriteClientLocationOptionsError = 'Location options could not be loaded. Refresh the page to try again.';
      renderMobileFavoriteClientLocationOptions();
    }
  }

  function renderMobileFavoritesFilterOptions() {
    if (mobileFavoritesTypeGroup) {
      mobileFavoritesTypeGroup.hidden = currentTab !== 'projects';
    }
    const savedClientsTab = !isClient && currentTab === 'clients';
    if (mobileFavoritesOpenRequestsGroup) mobileFavoritesOpenRequestsGroup.hidden = !savedClientsTab;
    if (mobileFavoritesLocationGroup) mobileFavoritesLocationGroup.hidden = !savedClientsTab;
    if (mobileFavoritesCategoryHeading) {
      mobileFavoritesCategoryHeading.textContent = currentTab === 'projects'
        ? 'Categories'
        : isClient ? 'Specialization' : 'Business Type';
    }
    if (mobileFavoritesCategoryOptions) {
      mobileFavoritesCategoryOptions.setAttribute('aria-label', mobileFavoritesCategoryHeading?.textContent || 'Categories');
    }
    renderMobileChoiceList(typeSelectEl, mobileFavoritesTypeOptions, 'mobile-favorites-filter-option');
    const selectedBusinessType = savedClientsTab && mobileClientFilterDraft
      ? mobileClientFilterDraft.businessType
      : categorySelectEl?.value;
    renderMobileChoiceList(categorySelectEl, mobileFavoritesCategoryOptions, 'mobile-favorites-filter-option',
      selectedBusinessType, value => {
        if (savedClientsTab && mobileClientFilterDraft) {
          mobileClientFilterDraft.businessType = value;
          renderMobileFavoritesFilterOptions();
          return;
        }
        categorySelectEl.value = value;
        categorySelectEl.dispatchEvent(new Event('change', {bubbles: true}));
      });
    if (mobileFavoritesOpenRequests) {
      const selected = mobileClientFilterDraft?.hasOpenRequestsOnly ?? favoriteClientsWithOpenRequestsOnly;
      mobileFavoritesOpenRequests.setAttribute('aria-pressed', String(selected));
      mobileFavoritesOpenRequests.classList.toggle('inactive', !selected);
    }
    renderMobileFavoriteClientLocationOptions();
  }

  function renderMobileFavoritesSortOptions() {
    if (!sortSelectEl || !mobileFavoritesSortOptions) return;
    mobileFavoritesSortOptions.replaceChildren(...Array.from(sortSelectEl.options, option => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mobile-favorites-sort-option';
      button.dataset.value = option.value;
      button.setAttribute('aria-pressed', String(option.value === sortSelectEl.value));
      const label = document.createElement('span');
      label.textContent = option.textContent;
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'm5 12 4 4L19 6');
      icon.append(path);
      button.append(label, icon);
      button.addEventListener('click', () => {
        sortSelectEl.value = option.value;
        sortSelectEl.dispatchEvent(new Event('change', {bubbles: true}));
        closeMobileFavoritesPanels();
        document.getElementById('mobileFavoritesSortToggle')?.focus();
      });
      return button;
    }));
  }

  function setupMobileFavoritesFilters() {
    const actions = document.getElementById('mobileFavoritesStickyActions');
    const sortToggle = document.getElementById('mobileFavoritesSortToggle');
    const filterToggle = document.getElementById('mobileFavoritesFilterToggle');
    const sortPanel = document.getElementById('mobileFavoritesSortPanel');
    const filterPanel = document.getElementById('mobileFavoritesFilterPanel');
    const resetButton = document.getElementById('mobileFavoritesFilterReset');
    const applyButton = document.getElementById('mobileFavoritesFilterApply');
    if (!actions || !sortToggle || !filterToggle || !sortPanel || !filterPanel
      || !resetButton || !applyButton || !categorySelectEl || !typeSelectEl || !sortSelectEl) return;

    sortToggle.addEventListener('click', () => {
      const shouldOpen = sortPanel.hidden;
      closeMobileFavoritesPanels();
      if (!shouldOpen) return;
      sortPanel.hidden = false;
      sortToggle.setAttribute('aria-expanded', 'true');
      actions.classList.add('mobile-sort-open');
    });

    filterToggle.addEventListener('click', () => {
      const shouldOpen = filterPanel.hidden;
      closeMobileFavoritesPanels();
      if (!shouldOpen) return;
      if (!isClient && currentTab === 'clients') {
        mobileClientFilterDraft = {
          businessType: currentCategory,
          location: copyFavoriteClientLocation(favoriteClientLocation),
          hasOpenRequestsOnly: favoriteClientsWithOpenRequestsOnly
        };
        favoriteClientRegionSearchQuery = '';
        if (mobileFavoritesRegionSearch) mobileFavoritesRegionSearch.value = '';
        renderMobileFavoritesFilterOptions();
      }
      filterPanel.scrollTop = 0;
      filterPanel.hidden = false;
      filterToggle.setAttribute('aria-expanded', 'true');
      actions.classList.add('mobile-filter-open');
    });

    mobileFavoritesOpenRequests?.addEventListener('click', event => {
      event.stopPropagation();
      if (!mobileClientFilterDraft) return;
      mobileClientFilterDraft.hasOpenRequestsOnly = !mobileClientFilterDraft.hasOpenRequestsOnly;
      renderMobileFavoritesFilterOptions();
    });
    mobileFavoritesRegionSearch?.addEventListener('input', () => {
      favoriteClientRegionSearchQuery = mobileFavoritesRegionSearch.value;
      renderMobileFavoriteClientLocationOptions();
    });

    resetButton.addEventListener('click', () => {
      if (!isClient && currentTab === 'clients') {
        currentCategory = 'all';
        categorySelectEl.value = 'all';
        favoriteClientLocation = {country: 'all', regions: []};
        favoriteClientsWithOpenRequestsOnly = false;
        mobileClientFilterDraft = null;
        favoriteClientRegionSearchQuery = '';
        if (mobileFavoritesRegionSearch) mobileFavoritesRegionSearch.value = '';
        updateFavoriteSelect(categorySelectEl);
        renderMobileFavoritesFilterOptions();
        renderCurrentTab();
      } else {
        [categorySelectEl, typeSelectEl].forEach(select => {
          select.value = 'all';
          select.dispatchEvent(new Event('change', {bubbles: true}));
        });
      }
      closeMobileFavoritesPanels();
      filterToggle.focus();
    });
    applyButton.addEventListener('click', () => {
      if (mobileClientFilterDraft) {
        currentCategory = mobileClientFilterDraft.businessType;
        categorySelectEl.value = currentCategory;
        favoriteClientLocation = copyFavoriteClientLocation(mobileClientFilterDraft.location);
        favoriteClientsWithOpenRequestsOnly = mobileClientFilterDraft.hasOpenRequestsOnly;
        mobileClientFilterDraft = null;
        updateFavoriteSelect(categorySelectEl);
        renderMobileFavoritesFilterOptions();
        renderCurrentTab();
      }
      closeMobileFavoritesPanels();
      filterToggle.focus();
    });
    document.addEventListener('click', event => {
      if (!actions.contains(event.target)) closeMobileFavoritesPanels();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMobileFavoritesPanels();
    });
  }

  setupMobileFavoritesFilters();
  if (!isClient) loadFavoriteClientLocationOptions();

  // Setup tab label dynamically based on mode
  if (tabSecondaryBtn) {
    if (isClient) {
      tabSecondaryBtn.id = 'tabDevs';
      tabSecondaryBtn.innerHTML = `Developers <span class="fav-tab-count" id="countDevs">${favoriteDevIds.length}</span>`;
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
      toastUndoBtn.onclick = async () => {
        toastUndoBtn.disabled = true;
        try {
          const shouldDismiss = await undoCallback();
          if (shouldDismiss !== false) toastEl.classList.remove('show');
        } finally {
          toastUndoBtn.disabled = false;
        }
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
    const projCount = favoriteProjects.filter(project => favoriteProjectIds.includes(project.id)).length;
    const secondaryCount = isClient
      ? favoriteDevelopers.filter(developer => favoriteDevIds.includes(developer.id)).length
      : favoriteClients.filter(client => favoriteClientIds.includes(client.id)).length;

    if (countProjectsEl) countProjectsEl.textContent = String(projCount);
    const countBadge = document.getElementById(isClient ? 'countDevs' : 'countClients') || countSecondaryEl;
    if (countBadge) countBadge.textContent = String(secondaryCount);

    const savedCountText = `${projCount + secondaryCount} saved`;
    if (favCountEl) favCountEl.textContent = savedCountText;
    if (mobileFavCountEl) mobileFavCountEl.textContent = savedCountText;

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
        ${clientProfileOptions.businessTypes.map(type =>
          `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`
        ).join('')}
      `;
    }
    categorySelectEl.value = 'all';
    currentCategory = 'all';
    updateFavoriteSelect(categorySelectEl);
    renderMobileFavoritesFilterOptions();
  }

  function updateTypeOptions() {
    if (!typeSelectEl) return;
    typeSelectEl.innerHTML = currentTab === 'projects'
      ? `<option value="all">All types</option>
        <option>Website</option>
        <option>Web App</option>
        <option>Android / iOS</option>`
      : '<option value="all">All types</option>';
    typeSelectEl.value = 'all';
    currentType = 'all';
    renderMobileFavoritesFilterOptions();
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
    updateFavoriteSelect(sortSelectEl);
    renderMobileFavoritesSortOptions();
  }

  // Render Projects Grid
  function renderProjects() {
    const all = getAllProjects();
    let savedProjects = all.filter(p => favoriteProjectIds.includes(p.id));

    if (currentCategory !== 'all') {
      savedProjects = savedProjects.filter(p => p.category.toLowerCase() === currentCategory.toLowerCase());
    }

    if (currentType !== 'all') {
      savedProjects = savedProjects.filter(p => p.type.toLowerCase() === currentType.toLowerCase());
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      savedProjects = savedProjects.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.developer.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
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
      const emptyMessage = favoriteProjectIds.length === 0
        ? 'You haven’t saved any projects yet. Browse projects and click the heart icon to save your favorites.'
        : currentCategory !== 'all' || currentType !== 'all' || searchQuery
          ? 'No saved projects match your filter or search query.'
          : 'Your saved projects aren’t available in this workspace or are no longer published.';
      favGridEl.innerHTML = `
        <div class="fav-empty-state">
          <div class="fav-empty-icon">
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </div>
          <h3>No saved projects found</h3>
          <p>${emptyMessage}</p>
          <a class="fav-btn primary" href="${exploreUrl}" style="margin:0 auto;display:inline-flex;">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>
            Explore Projects
          </a>
        </div>
      `;
      return;
    }

    favGridEl.innerHTML = savedProjects.map(project => `
      <article class="fav-card fav-card-clickable" data-project-id="${escapeHtml(project.id)}" ${isClient ? `data-project-detail="${escapeHtml(project.id)}" role="link" tabindex="0" aria-label="View ${escapeHtml(project.title)} details"` : `data-detail-url="${escapeHtml(project.detailUrl)}"`}>
        <div class="fav-card-art ${escapeHtml(project.art || '')}">
          <span class="fav-card-badge">${escapeHtml(project.category)}</span>
          <button class="fav-remove-btn" type="button" data-remove-fav="${escapeHtml(project.id)}" title="Remove from favorites" aria-label="Remove ${escapeHtml(project.title)} from favorites">
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          ${safeCoverImage(project.coverImage) ? `<img class="fav-project-cover" src="${escapeHtml(safeCoverImage(project.coverImage))}" alt="" loading="lazy">` : `<div class="fav-art-window">
            <div class="fav-art-window-bar"><i></i><i></i><i></i></div>
            <div class="fav-art-mock">
              <div class="fav-art-side"></div>
              <div class="fav-art-body">
                <div class="fav-art-line short"></div>
                <div class="fav-art-line"></div>
                <div class="fav-art-line" style="width:75%;"></div>
              </div>
            </div>
          </div>`}
        </div>

        <div class="fav-card-body">
          <span class="fav-card-type">${escapeHtml(project.type)}</span>
          <h3 class="fav-card-title">${isClient
            ? escapeHtml(project.title)
            : `<a class="fav-project-title-link" href="${escapeHtml(project.detailUrl)}">${escapeHtml(project.title)}</a>`}</h3>
          <p class="fav-card-desc">${escapeHtml(project.description)}</p>

          <div class="fav-card-meta${isClient ? '' : ' fav-card-meta-developer'}">
            ${!isClient ? `<span class="fav-card-price">${escapeHtml(project.price)}</span>` : ''}
            <a class="fav-dev-pill" href="${escapeHtml(project.profileUrl)}">
              <span class="fav-dev-avatar">${escapeHtml(project.initials)}</span>
              <span class="fav-dev-name-wrap"><b>${escapeHtml(project.developer)}</b><small>${escapeHtml(project.handle||'')}</small></span>
            </a>
            ${isClient ? `<span class="fav-card-price">${escapeHtml(project.price)}</span><span class="fav-card-rating" aria-label="Rating 4.9 out of 5"><span>★</span> 4.9</span>` : ''}
          </div>
        </div>

        <footer class="fav-card-footer">
          <a class="fav-action-link primary" href="devmatch-chat.html?${isClient ? 'project' : 'request'}=${encodeURIComponent(project.id)}&role=${isClient ? 'client' : 'dev'}">
            <svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-4A8.5 8.5 0 1 1 21 11.5z"/></svg>
            ${isClient ? 'Contact' : 'Chat with Client'}
          </a>
          ${isClient ? `<a class="fav-action-link" href="${escapeHtml(project.detailUrl)}" data-project-detail="${escapeHtml(project.id)}">View Details</a>` : ''}
        </footer>
      </article>
    `).join('');

    favGridEl.querySelectorAll('[data-remove-fav]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const project = savedProjects.find(item => item.id === btn.dataset.removeFav);
        if (!project) return;
        confirmFavoriteRemoval('project', project.id, project.title);
      });
    });
    if(isClient){
      favGridEl.querySelectorAll('[data-project-detail]').forEach(element=>{
        element.addEventListener('click',event=>{
          if(element.tagName==='A'||element.tagName==='BUTTON'){
            if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||typeof window.openProjectDetails!=='function')return;
            event.preventDefault();
            window.openProjectDetails(element.dataset.projectDetail);
          }else{
            if(event.target.closest('a,button')||typeof window.openProjectDetails!=='function')return;
            window.openProjectDetails(element.dataset.projectDetail);
          }
        });
        if(element.tagName==='ARTICLE'){
          element.addEventListener('keydown',event=>{
            if((event.key==='Enter'||event.key===' ')&&event.target===element){
              event.preventDefault();
              if(typeof window.openProjectDetails==='function'){
                window.openProjectDetails(element.dataset.projectDetail);
              }
            }
          });
        }
      });
    }
    if (!isClient) {
      favGridEl.querySelectorAll('.fav-card-clickable').forEach(card => {
        card.addEventListener('click', event => {
          if (event.target.closest('a,button')) return;
          if(typeof window.openProjectRequestDetails==='function'){
            window.openProjectRequestDetails(card.dataset.projectId,card.querySelector('.fav-card-title')?.textContent||'Project request');
          }else{
            window.location.assign(card.dataset.detailUrl);
          }
        });
      });
    }
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

    if (favoriteClientsWithOpenRequestsOnly) {
      savedClients = savedClients.filter(client => client.openRequestsCount > 0);
    }

    if (favoriteClientLocation.country !== 'all') {
      savedClients = savedClients.filter(client => {
        if (client.country.toLocaleLowerCase() !== favoriteClientLocation.country.toLocaleLowerCase()) return false;
        if (!favoriteClientLocation.regions.length) return true;
        const clientRegion = getFavoriteClientRegion(client).toLocaleLowerCase();
        return favoriteClientLocation.regions.some(region => region.toLocaleLowerCase() === clientRegion);
      });
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
        const client = savedClients.find(item => item.id === btn.dataset.removeClient);
        if (!client) return;
        confirmFavoriteRemoval('client', client.id, client.name);
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
        const developer = savedDevs.find(item => item.id === btn.dataset.removeDev);
        if (!developer) return;
        confirmFavoriteRemoval('developer', developer.id, developer.name);
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

  function safeCoverImage(value) {
    if (typeof value !== 'string') return '';
    if (/^data:image\/(?:jpeg|png|webp);base64,/i.test(value)) return value;
    try {
      const url = new URL(value);
      return url.origin === 'https://yxwktllqbmhustmhdaqi.supabase.co'
        && url.pathname.startsWith('/storage/v1/object/public/project-media/')
        ? value : '';
    } catch {
      return '';
    }
  }

  // Remove a project favorite
  function removeFavoriteProject(id) {
    const card = document.querySelector(`.fav-card[data-project-id="${id}"]`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
    }

    setTimeout(async () => {
      try {
        favoriteProjectIds = await persistFavorite('project', id, false, PROJECTS_KEY);
      } catch (error) {
        console.error('Unable to remove project favorite from Supabase.', error);
        window.alert('Unable to update favorites. Please try again.');
        renderCurrentTab();
        return;
      }
      lastRemovedItem = { type: 'project', id };
      updateCounters();
      renderCurrentTab();
      updateFavoriteTabIndicator();

      showToast('Project removed from favorites', async () => {
        if (lastRemovedItem && lastRemovedItem.type === 'project') {
          try {
            favoriteProjectIds = await persistFavorite('project', lastRemovedItem.id, true, PROJECTS_KEY);
          } catch (error) {
            console.error('Unable to restore project favorite in Supabase.', error);
            window.alert('Unable to restore this favorite. Please try again.');
            return;
          }
          updateCounters();
          renderCurrentTab();
          updateFavoriteTabIndicator();
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

    setTimeout(async () => {
      try {
        favoriteClientIds = await persistFavorite('client', id, false, CLIENTS_KEY);
      } catch (error) {
        console.error('Unable to remove client favorite from Supabase.', error);
        window.alert('Unable to update favorites. Please try again.');
        renderCurrentTab();
        return;
      }
      lastRemovedItem = { type: 'client', id };
      updateCounters();
      renderCurrentTab();

      showToast('Client removed from favorites', async () => {
        if (lastRemovedItem && lastRemovedItem.type === 'client') {
          try {
            favoriteClientIds = await persistFavorite('client', lastRemovedItem.id, true, CLIENTS_KEY);
          } catch (error) {
            console.error('Unable to restore client favorite in Supabase.', error);
            window.alert('Unable to restore this favorite. Please try again.');
            return;
          }
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

    setTimeout(async () => {
      try {
        favoriteDevIds = await persistFavorite('developer', id, false, DEVS_KEY);
      } catch (error) {
        console.error('Unable to remove developer favorite from Supabase.', error);
        window.alert('Unable to update favorites. Please try again.');
        renderCurrentTab();
        return;
      }
      lastRemovedItem = { type: 'developer', id };
      updateCounters();
      renderCurrentTab();

      showToast('Developer removed from favorites', async () => {
        if (lastRemovedItem && lastRemovedItem.type === 'developer') {
          try {
            favoriteDevIds = await persistFavorite('developer', lastRemovedItem.id, true, DEVS_KEY);
          } catch (error) {
            console.error('Unable to restore developer favorite in Supabase.', error);
            window.alert('Unable to restore this favorite. Please try again.');
            return;
          }
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
      closeMobileFavoritesPanels();
      tabProjectsBtn.classList.add('active');
      tabSecondaryBtn.classList.remove('active');
      tabProjectsBtn.setAttribute('aria-selected', 'true');
      tabSecondaryBtn.setAttribute('aria-selected', 'false');
      currentTab = 'projects';
      updateFavoriteTabIndicator();
      updateCategoryOptions();
      updateTypeOptions();
      updateSortOptions();
      updateCounters();
      renderCurrentTab();
    });

    tabSecondaryBtn.addEventListener('click', () => {
      closeMobileFavoritesPanels();
      tabSecondaryBtn.classList.add('active');
      tabProjectsBtn.classList.remove('active');
      tabSecondaryBtn.setAttribute('aria-selected', 'true');
      tabProjectsBtn.setAttribute('aria-selected', 'false');
      currentTab = isClient ? 'developers' : 'clients';
      updateFavoriteTabIndicator();
      updateCategoryOptions();
      updateTypeOptions();
      updateSortOptions();
      updateCounters();
      renderCurrentTab();
    });

    const requestedTab = urlParams.get('tab');
    if (requestedTab === 'clients' || requestedTab === 'saved-clients') {
      if (!isClient) tabSecondaryBtn.click();
    } else if (requestedTab === 'developers' || requestedTab === 'saved-developers') {
      if (isClient) tabSecondaryBtn.click();
    }
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
      renderMobileFavoritesFilterOptions();
      renderCurrentTab();
    });
  }

  if (typeSelectEl) {
    typeSelectEl.addEventListener('change', () => {
      currentType = typeSelectEl.value;
      renderMobileFavoritesFilterOptions();
      renderCurrentTab();
    });
  }

  // Sort filter
  if (sortSelectEl) {
    sortSelectEl.addEventListener('change', () => {
      currentSort = sortSelectEl.value;
      renderMobileFavoritesSortOptions();
      renderCurrentTab();
    });
  }

  async function clearAllFavorites(type) {
    const labels = {
      project: 'projects',
      developer: 'developers',
      client: 'clients'
    };
    const storageKeys = {
      project: PROJECTS_KEY,
      developer: DEVS_KEY,
      client: CLIENTS_KEY
    };
    const favoriteIdsByType = {
      project: favoriteProjectIds,
      developer: favoriteDevIds,
      client: favoriteClientIds
    };
    const removedIds = [...favoriteIdsByType[type]];

    try {
      await clearFavoriteCollection(type, storageKeys[type]);
    } catch (error) {
      console.error(`Unable to clear ${type} favorites in Supabase.`, error);
      window.alert('Unable to clear favorites. Please try again.');
      return;
    }

    if (type === 'project') favoriteProjectIds = [];
    if (type === 'developer') favoriteDevIds = [];
    if (type === 'client') favoriteClientIds = [];
    updateCounters();
    renderCurrentTab();
    showToast(`All saved ${labels[type]} cleared`, async () => {
      try {
        for (const id of removedIds) {
          await persistFavorite(type, id, true, storageKeys[type]);
        }
      } catch (error) {
        console.error(`Unable to restore ${type} favorites in Supabase.`, error);
        const storedIds = JSON.parse(localStorage.getItem(storageKeys[type]) || '[]');
        const restoredIds = Array.isArray(storedIds) ? storedIds : [];
        if (type === 'project') favoriteProjectIds = restoredIds;
        if (type === 'developer') favoriteDevIds = restoredIds;
        if (type === 'client') favoriteClientIds = restoredIds;
        updateCounters();
        renderCurrentTab();
        window.alert('Unable to restore all favorites. Please try again.');
        return false;
      }

      if (type === 'project') favoriteProjectIds = removedIds;
      if (type === 'developer') favoriteDevIds = removedIds;
      if (type === 'client') favoriteClientIds = removedIds;
      updateCounters();
      renderCurrentTab();
      return true;
    });
  }

  // Clear all button
  document.querySelectorAll('[data-favorites-clear-all]').forEach(clearAllBtn => {
    clearAllBtn.addEventListener('click', () => {
      if (currentTab === 'projects') {
        if (favoriteProjectIds.length === 0) return;
        confirmClearAllFavorites('project', 'projects');
      } else if (isClient) {
        if (favoriteDevIds.length === 0) return;
        confirmClearAllFavorites('developer', 'developers');
      } else {
        if (favoriteClientIds.length === 0) return;
        confirmClearAllFavorites('client', 'clients');
      }
    });
  });

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

  favRemoveCancel.addEventListener('click', () => favRemoveDialog.close());
  favRemoveDialog.addEventListener('close', () => {
    pendingFavoriteRemoval = null;
    favRemoveTitle.textContent = 'Remove from favorites?';
    favRemoveConfirm.textContent = 'Remove';
  });
  favRemoveDialog.addEventListener('click', event => {
    if (event.target === favRemoveDialog) favRemoveDialog.close();
  });
  favRemoveConfirm.addEventListener('click', () => {
    const pending = pendingFavoriteRemoval;
    favRemoveDialog.close();
    if (!pending) return;
    if (pending.action === 'clear-all') {
      clearAllFavorites(pending.type);
      return;
    }
    if (pending.type === 'project') removeFavoriteProject(pending.id);
    if (pending.type === 'client') removeFavoriteClient(pending.id);
    if (pending.type === 'developer') removeFavoriteDeveloper(pending.id);
  });

  // Load user profile details in topbar
  function loadUserProfile() {
    try {
      document.body.classList.toggle('client-shell-page', isClient);
      window.DEVMATCH_SIDEBAR_NAVIGATION?.setWorkspace(isClient ? 'client' : 'developer');
      const key = isClient ? 'devmatch-profile-client' : 'devmatch-profile-dev';
      const profile = JSON.parse(localStorage.getItem(key) || '{}');
      const name = typeof profile.displayName === 'string' && profile.displayName.trim()
        ? profile.displayName.trim()
        : (isClient ? 'Client' : 'Developer');
      const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || (isClient ? 'CL' : 'DV');
      const role = isClient ? 'Client' : 'Developer';
      const userAvatarEl = document.getElementById('userAvatar');
      const topUserNameEl = document.getElementById('topUserName');
      if (userAvatarEl) userAvatarEl.textContent = initials;
      if (topUserNameEl) topUserNameEl.textContent = profile.username || name;
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
        const intro = document.querySelector('.fav-heading>div>p:last-child');
        if (intro) intro.textContent = 'Projects and developers you saved for later.';
      }
    } catch (e) {}
  }

  // Initialize
  try {
    await loadFavoriteEntities();
  } catch (error) {
    console.error('Unable to load favorited projects and profiles from Supabase.', error);
    window.alert('Unable to load your saved items. Check your connection and try again.');
  }
  loadUserProfile();
  updateCategoryOptions();
  updateTypeOptions();
  updateSortOptions();
  updateCounters();
  updateFavoriteTabIndicator();
  window.addEventListener('resize', updateFavoriteTabIndicator);
  renderCurrentTab();

})();
