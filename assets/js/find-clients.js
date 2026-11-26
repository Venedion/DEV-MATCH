/**
 * Find Clients Page Logic - DEV-MATCH
 * Replicates design from "Find Clients.pdf"
 */

(function () {
  'use strict';

  const FAVORITES_KEY = 'devmatch-favorite-clients';
  const clientProfileOptions = window.DEVMATCH_CLIENT_PROFILE_OPTIONS;

  let CLIENTS_DATA = [];
  let clientLocationRegions = {};
  let locationOptionsError = '';
  let locationRegionSearchQuery = '';

  // State
  let searchQuery = '';
  let searchScope = 'name';
  let selectedBusinessType = 'all';
  let selectedLocation = {country: 'all', regions: []};
  let locationFilterDraft = {country: 'all', regions: []};
  let hasOpenRequestsOnly = false;
  let sortOrder = 'rating';
  let favoriteIds = getSavedFavorites();
  let mobileFilterDraft = null;
  const mobileClientsFilterBreakpoint = window.matchMedia('(orientation: portrait)');

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
  const sortRatingBtn = document.getElementById('sortRatingBtn');
  const mobileClientsActions = document.querySelector('.mobile-clients-actions');
  const mobileClientsSortControl = document.querySelector('.mobile-clients-sort-control');
  const mobileClientsSortToggle = document.getElementById('mobileClientsSortToggle');
  const mobileClientsSortMenu = document.getElementById('mobileClientsSortMenu');
  const mobileClientsFilterToggle = document.getElementById('mobileClientsFilterToggle');
  const mobileClientsFilterPanel = document.getElementById('mobileClientsFilterPanel');
  const mobileClientsFilterFields = document.getElementById('mobileClientsFilterFields');
  const mobileClientsFilterReset = document.getElementById('mobileClientsFilterReset');
  const mobileClientsFilterApply = document.getElementById('mobileClientsFilterApply');
  const locationCountryOptions = document.getElementById('locationCountryOptions');
  const locationRegionSection = document.getElementById('locationRegionSection');
  const locationRegionHeading = document.getElementById('locationRegionHeading');
  const locationRegionSearch = document.getElementById('locationRegionSearch');
  const locationRegionOptions = document.getElementById('locationRegionOptions');
  const locationRegionEmpty = document.getElementById('locationRegionEmpty');
  const locationFilterApply = document.getElementById('locationFilterApply');
  const locationFilterStatus = document.getElementById('locationFilterStatus');
  const clientDialog = document.getElementById('clientDialog');
  const dialogContent = document.getElementById('dialogContent');
  const dialogCloseBtn = document.getElementById('dialogCloseBtn');
  const favoriteToastEl = document.getElementById('favoriteActionToast');
  const favoriteRemoveDialog = document.getElementById('favoriteRemoveDialog');
  const favoriteRemoveMessage = document.getElementById('favoriteRemoveMessage');
  const favoriteCountEl = document.getElementById('favoriteCount');
  const projectRequestsTabCount = document.getElementById('projectRequestsTabCount');
  const clientsTabCount = document.getElementById('clientsTabCount');
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

  function showToast(msg, undoCallback, favoriteLink) {
    window.DEVMATCH_FAVORITE_FEEDBACK.showToast(favoriteToastEl, msg, undoCallback, favoriteLink);
  }

  function updateFavoriteBadge() {
    if (window.DEVMATCH_NAV_BADGES) window.DEVMATCH_NAV_BADGES.updateFavorites();
    else if (favoriteCountEl) favoriteCountEl.textContent = String(favoriteIds.length);
  }

  function syncClientFilterDropdown(dropdown, value, defaultLabel) {
    if (!dropdown) return;
    const trigger = dropdown.querySelector('.filter-pill-btn');
    const label = trigger?.querySelector('.filter-label-text');
    const items = [...dropdown.querySelectorAll('.dropdown-item')];
    const selectedItem = items.find(item => item.dataset.value === value);
    items.forEach(item => item.classList.toggle('selected', item === selectedItem));
    dropdown.querySelectorAll('.mobile-client-filter-option').forEach(item => {
      item.setAttribute('aria-pressed', String(item.dataset.value === value));
    });
    if (label) {
      label.textContent = value === 'all'
        ? defaultLabel
        : selectedItem?.textContent.trim().replace('✓', '') || defaultLabel;
    }
    trigger?.classList.toggle('has-value', value !== 'all');
    trigger?.setAttribute('aria-expanded', 'false');
    dropdown.classList.remove('open');
  }

  function syncClientFilterControls(state) {
    syncClientFilterDropdown(businessTypeDropdown, state.businessType, 'Business type');
    syncLocationFilterLabel(state.location);
    if (btnToggleOpenRequests) {
      btnToggleOpenRequests.classList.toggle('inactive', !state.hasOpenRequestsOnly);
      btnToggleOpenRequests.setAttribute('aria-pressed', String(state.hasOpenRequestsOnly));
    }
  }

  function copyLocationFilter(location) {
    return {
      country: location?.country || 'all',
      regions: Array.isArray(location?.regions) ? [...new Set(location.regions)] : []
    };
  }

  function syncLocationFilterLabel(location) {
    if (!locationDropdown) return;
    const label = locationDropdown.querySelector('.filter-label-text');
    const trigger = locationDropdown.querySelector('.filter-pill-btn');
    const value = copyLocationFilter(location);
    const country = clientProfileOptions.countries.find(item => item === value.country);
    if (label) {
      label.textContent = !country
        ? 'Location'
        : value.regions.length
          ? `${country} · ${value.regions.length} ${locationRegionType(country).toLocaleLowerCase()}`
          : country;
    }
    trigger?.classList.toggle('has-value', Boolean(country));
    trigger?.setAttribute('aria-expanded', String(locationDropdown.classList.contains('open')));
  }

  function locationRegionType(country) {
    if (country === 'Malaysia') return 'states';
    if (country === 'Singapore') return 'regions';
    return 'provinces';
  }

  function populateBusinessTypeOptions() {
    const menu = businessTypeDropdown?.querySelector('.dropdown-menu');
    if (!menu) return;
    const options = ['all', ...clientProfileOptions.businessTypes];
    menu.replaceChildren(...options.map(value => {
      const option = document.createElement('button');
      option.className = 'dropdown-item';
      option.type = 'button';
      option.dataset.value = value;
      option.textContent = value === 'all' ? 'All Business Types' : value;
      if (value === 'all') option.classList.add('selected');
      return option;
    }));
  }

  function selectLocationCountry(country) {
    if (locationFilterDraft.country === country) return;
    locationFilterDraft = {country, regions: []};
    locationRegionSearchQuery = '';
    if (locationRegionSearch) locationRegionSearch.value = '';
    renderLocationFilterOptions();
    if (country !== 'all') {
      requestAnimationFrame(() => locationRegionSection?.scrollIntoView({block: 'nearest'}));
    }
  }

  function toggleLocationRegion(region) {
    const selected = new Set(locationFilterDraft.regions);
    if (selected.has(region)) selected.delete(region);
    else selected.add(region);
    locationFilterDraft.regions = [...selected];
    renderLocationFilterOptions();
  }

  function selectAllLocationRegions() {
    locationFilterDraft.regions = [];
    renderLocationFilterOptions();
  }

  function createLocationOptionCheckmark() {
    const checkmark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    checkmark.setAttribute('viewBox', '0 0 24 24');
    checkmark.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm5 12 4 4L19 6');
    checkmark.append(path);
    return checkmark;
  }

  function renderLocationFilterOptions() {
    if (!locationCountryOptions || !locationRegionOptions || !locationRegionSection) return;
    const regionListScrollTop = locationRegionOptions.scrollTop;
    locationCountryOptions.replaceChildren(...[
      {value: 'all', label: 'All countries'},
      ...clientProfileOptions.countries.map(country => ({value: country, label: country}))
    ].map(({value, label}) => {
      const button = document.createElement('button');
      button.className = 'location-country-option';
      button.type = 'button';
      button.dataset.country = value;
      button.setAttribute('aria-pressed', String(locationFilterDraft.country === value));
      button.setAttribute('aria-expanded', String(locationFilterDraft.country === value && value !== 'all'));
      button.setAttribute('aria-controls', 'locationRegionSection');
      const labelElement = document.createElement('span');
      labelElement.textContent = label;
      button.append(labelElement, createLocationOptionCheckmark());
      button.addEventListener('click', event => {
        event.stopPropagation();
        selectLocationCountry(value);
      });
      return button;
    }));

    const country = clientProfileOptions.countries.find(item => item === locationFilterDraft.country);
    locationRegionSection.hidden = !country;
    locationRegionOptions.replaceChildren();
    if (country) {
      if (locationRegionHeading) {
        const type = country === 'Malaysia' ? 'STATE' : country === 'Singapore' ? 'REGION' : 'PROVINCE';
        locationRegionHeading.textContent = type;
      }
      const regions = clientLocationRegions[country] || [];
      const query = locationRegionSearchQuery.trim().toLocaleLowerCase();
      const matchingRegions = regions.filter(region => region.name.toLocaleLowerCase().includes(query));
      const allOption = regions.length ? document.createElement('button') : null;
      if (allOption) {
        const label = country === 'Malaysia' ? 'All states' : country === 'Singapore' ? 'All regions' : 'All provinces';
        allOption.className = 'location-region-option location-region-all-option';
        allOption.type = 'button';
        allOption.setAttribute('aria-pressed', String(locationFilterDraft.regions.length === 0));
        const labelElement = document.createElement('span');
        labelElement.textContent = label;
        allOption.append(labelElement, createLocationOptionCheckmark());
        allOption.addEventListener('click', event => {
          event.stopPropagation();
          selectAllLocationRegions();
        });
      }
      locationRegionOptions.replaceChildren(...[
        ...(allOption ? [allOption] : []),
        ...matchingRegions.map(region => {
          const button = document.createElement('button');
          button.className = 'location-region-option';
          button.type = 'button';
          button.dataset.region = region.name;
          button.setAttribute('aria-pressed', String(locationFilterDraft.regions.includes(region.name)));
          button.addEventListener('click', event => {
            event.stopPropagation();
            toggleLocationRegion(region.name);
          });
          const label = document.createElement('span');
          label.textContent = region.name;
          button.append(label, createLocationOptionCheckmark());
          return button;
        })
      ]);
      locationRegionOptions.scrollTop = regionListScrollTop;
      if (locationRegionEmpty) {
        locationRegionEmpty.hidden = Boolean(locationOptionsError) || !regions.length || matchingRegions.length > 0;
      }
      if (locationFilterStatus) {
        locationFilterStatus.hidden = !locationOptionsError && regions.length > 0;
        locationFilterStatus.textContent = locationOptionsError
          || (regions.length ? '' : 'Loading location options…');
      }
    } else if (locationFilterStatus) {
      locationFilterStatus.hidden = true;
      locationFilterStatus.textContent = '';
      if (locationRegionEmpty) locationRegionEmpty.hidden = true;
    }
  }

  async function loadClientLocationOptions() {
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
      clientLocationRegions = groups;
      locationOptionsError = '';
      renderLocationFilterOptions();
      renderClients();
    } catch (error) {
      console.error('Unable to load client location filter options.', error);
      locationOptionsError = 'Location options could not be loaded. Refresh the page to try again.';
      renderLocationFilterOptions();
    }
  }

  function setMobileClientFilterPanelOpen(isOpen) {
    if (!mobileClientsFilterPanel || !mobileClientsFilterToggle) return;
    mobileClientsFilterPanel.hidden = !isOpen;
    mobileClientsFilterToggle.setAttribute('aria-expanded', String(isOpen));
    mobileClientsActions?.classList.toggle('mobile-filter-open', isOpen);
  }

  function discardMobileClientFilterDraft() {
    mobileFilterDraft = null;
    locationFilterDraft = copyLocationFilter(selectedLocation);
    syncClientFilterControls({
      businessType: selectedBusinessType,
      location: selectedLocation,
      hasOpenRequestsOnly
    });
    renderLocationFilterOptions();
    setMobileClientFilterPanelOpen(false);
  }

  function applyMobileClientFilterDraft() {
    if (!mobileFilterDraft) return;
    selectedBusinessType = mobileFilterDraft.businessType;
    selectedLocation = copyLocationFilter(locationFilterDraft);
    hasOpenRequestsOnly = mobileFilterDraft.hasOpenRequestsOnly;
    mobileFilterDraft = null;
    locationFilterDraft = copyLocationFilter(selectedLocation);
    syncLocationFilterLabel(selectedLocation);
    setMobileClientFilterPanelOpen(false);
    renderClients();
  }

  function resetMobileClientFilters() {
    selectedBusinessType = 'all';
    selectedLocation = {country: 'all', regions: []};
    hasOpenRequestsOnly = false;
    mobileFilterDraft = null;
    locationFilterDraft = copyLocationFilter(selectedLocation);
    syncClientFilterControls({
      businessType: selectedBusinessType,
      location: selectedLocation,
      hasOpenRequestsOnly
    });
    renderLocationFilterOptions();
    setMobileClientFilterPanelOpen(false);
    renderClients();
  }

  function syncClientSortControls() {
    sortNewestBtn?.classList.toggle('active', sortOrder === 'az');
    sortOldestBtn?.classList.toggle('active', sortOrder === 'za');
    sortRatingBtn?.classList.toggle('active', sortOrder === 'rating');
    mobileClientsSortMenu?.querySelectorAll('[data-sort-value]').forEach(option => {
      option.setAttribute('aria-checked', String(option.dataset.sortValue === sortOrder));
    });
  }

  function getClientRegion(client) {
    const groups = clientLocationRegions[client.country] || [];
    const rawLocation = String(client.profileCity || '').trim();
    if (!rawLocation) return '';
    const [firstPart, ...remainingParts] = rawLocation.split(',');
    const prefix = firstPart.trim().toLocaleLowerCase();
    const matchingRegion = groups.find(region => region.name.toLocaleLowerCase() === prefix);
    if (matchingRegion) return matchingRegion.name;
    if (remainingParts.length) return firstPart.trim();

    const city = rawLocation.toLocaleLowerCase();
    const matches = groups.filter(region => region.cities.some(item =>
      item.name.toLocaleLowerCase() === city
    ));
    return matches.length === 1 ? matches[0].name : '';
  }

  function setClientSortOrder(order) {
    sortOrder = order;
    syncClientSortControls();
    renderClients();
  }

  function initializeMobileClientActions() {
    const filterRow = document.querySelector('.clients-filter-row');
    const filterPills = filterRow?.querySelector('.filter-left-pills');
    if (!filterRow || !filterPills || !mobileClientsActions
      || !mobileClientsFilterToggle || !mobileClientsFilterFields) return;

    [
      [businessTypeDropdown, 'BUSINESS TYPE']
    ].forEach(([dropdown, heading]) => {
      const options = document.createElement('div');
      options.className = 'mobile-client-filter-options';
      options.setAttribute('role', 'group');
      options.setAttribute('aria-label', `${heading} options`);

      const section = document.createElement('div');
      section.className = 'mobile-client-filter-section';
      const title = document.createElement('span');
      title.className = 'mobile-client-filter-heading';
      title.textContent = heading;
      section.append(title, options);

      dropdown?.querySelectorAll('.dropdown-item').forEach(option => {
        const button = document.createElement('button');
        button.className = 'mobile-client-filter-option';
        button.type = 'button';
        button.dataset.value = option.dataset.value;
        button.setAttribute('aria-pressed', String(option.classList.contains('selected')));

        const label = document.createElement('span');
        label.textContent = option.textContent.trim();
        const checkmark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        checkmark.setAttribute('viewBox', '0 0 24 24');
        checkmark.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'm5 12 4 4L19 6');
        checkmark.append(path);

        button.append(label, checkmark);
        options.append(button);
      });

      dropdown?.append(section);
    });

    const filterPlaceholder = document.createComment('client filter controls placement');
    filterPills.before(filterPlaceholder);

    function syncLayout() {
      if (mobileClientsFilterBreakpoint.matches) {
        mobileClientsFilterFields.append(filterPills);
        return;
      }

      if (mobileFilterDraft) discardMobileClientFilterDraft();
      filterPlaceholder.parentNode?.insertBefore(filterPills, filterPlaceholder.nextSibling);
    }

    mobileClientsFilterToggle.addEventListener('click', () => {
      if (mobileFilterDraft) {
        discardMobileClientFilterDraft();
        return;
      }
      mobileFilterDraft = {
        businessType: selectedBusinessType,
        location: copyLocationFilter(selectedLocation),
        hasOpenRequestsOnly
      };
      locationFilterDraft = copyLocationFilter(mobileFilterDraft.location);
      syncClientFilterControls(mobileFilterDraft);
      renderLocationFilterOptions();
      setMobileClientFilterPanelOpen(true);
    });

    mobileClientsFilterReset?.addEventListener('click', resetMobileClientFilters);
    mobileClientsFilterApply?.addEventListener('click', applyMobileClientFilterDraft);
    locationFilterApply?.addEventListener('click', () => {
      const location = copyLocationFilter(locationFilterDraft);
      if (mobileFilterDraft) {
        mobileFilterDraft.location = location;
        syncLocationFilterLabel(location);
        return;
      }
      selectedLocation = location;
      locationDropdown?.classList.remove('open');
      syncLocationFilterLabel(selectedLocation);
      renderClients();
    });
    locationRegionSearch?.addEventListener('input', () => {
      locationRegionSearchQuery = locationRegionSearch.value;
      renderLocationFilterOptions();
    });

    function closeSortMenu({focusToggle = false} = {}) {
      if (mobileClientsSortMenu?.matches(':popover-open')) mobileClientsSortMenu.hidePopover();
      mobileClientsSortToggle?.setAttribute('aria-expanded', 'false');
      if (focusToggle) mobileClientsSortToggle?.focus();
    }

    mobileClientsSortToggle?.addEventListener('click', () => {
      if (!mobileClientsSortMenu) return;
      if (mobileClientsSortMenu.matches(':popover-open')) {
        closeSortMenu();
        return;
      }

      mobileClientsSortMenu.showPopover();
      const triggerBounds = mobileClientsSortToggle.getBoundingClientRect();
      const menuBounds = mobileClientsSortMenu.getBoundingClientRect();
      const menuWidth = Math.min(220, window.innerWidth - 20);
      const left = Math.max(10, Math.min(
        triggerBounds.right - menuWidth,
        window.innerWidth - menuWidth - 10
      ));
      const spaceBelow = window.innerHeight - triggerBounds.bottom - 8;
      const top = spaceBelow >= menuBounds.height || spaceBelow >= triggerBounds.top
        ? triggerBounds.bottom + 6
        : Math.max(10, triggerBounds.top - menuBounds.height - 6);
      mobileClientsSortMenu.style.left = `${left}px`;
      mobileClientsSortMenu.style.top = `${top}px`;
      mobileClientsSortMenu.style.width = `${menuWidth}px`;
      mobileClientsSortMenu.style.minWidth = `${menuWidth}px`;
      mobileClientsSortToggle.setAttribute('aria-expanded', 'true');
      mobileClientsSortMenu.querySelector(`[data-sort-value="${sortOrder}"]`)?.focus({preventScroll: true});
    });

    mobileClientsSortMenu?.addEventListener('click', event => {
      const option = event.target.closest('[data-sort-value]');
      if (!option) return;
      setClientSortOrder(option.dataset.sortValue);
      closeSortMenu({focusToggle: true});
    });

    mobileClientsSortMenu?.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSortMenu({focusToggle: true});
      }
    });
    mobileClientsSortMenu?.addEventListener('toggle', () => {
      mobileClientsSortToggle?.setAttribute(
        'aria-expanded',
        String(mobileClientsSortMenu.matches(':popover-open'))
      );
    });

    document.addEventListener('click', event => {
      if (mobileClientsSortMenu?.matches(':popover-open')
        && !mobileClientsSortControl?.contains(event.target)) {
        closeSortMenu();
      }
    });
    window.addEventListener('resize', () => closeSortMenu());
    window.addEventListener('scroll', () => closeSortMenu(), {capture: true, passive: true});

    document.addEventListener('click', event => {
      if (mobileFilterDraft
        && !mobileClientsFilterPanel?.contains(event.target)
        && !mobileClientsFilterToggle.contains(event.target)) {
        discardMobileClientFilterDraft();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && mobileFilterDraft) {
        discardMobileClientFilterDraft();
        mobileClientsFilterToggle.focus();
      }
    });

    mobileClientsFilterBreakpoint.addEventListener('change', syncLayout);
    syncLayout();
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
      if (selectedLocation.country !== 'all') {
        if (client.country.toLocaleLowerCase() !== selectedLocation.country.toLocaleLowerCase()) return false;
        if (selectedLocation.regions.length
          && !selectedLocation.regions.some(region =>
            region.toLocaleLowerCase() === getClientRegion(client).toLocaleLowerCase()
          )) return false;
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
      if (sortOrder === 'requests') {
        return b.openRequestsCount - a.openRequestsCount || a.name.localeCompare(b.name);
      }
      if (sortOrder === 'rating') {
        return b.adjustedRating - a.adjustedRating || b.ratingCount - a.ratingCount || a.name.localeCompare(b.name);
      }
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
        const clientProfileUrl = `devmatch-client-profile.html?client=${encodeURIComponent(client.id)}&from=find-clients`;

        return `
          <article class="client-card" data-client-id="${escapeHtml(client.id)}" data-profile-url="${escapeHtml(clientProfileUrl)}" tabindex="0" aria-label="View ${escapeHtml(client.name)} profile">
            <div class="client-card-top">
              <div class="client-profile-group">
                <a class="client-avatar-badge" href="${clientProfileUrl}" aria-label="View ${escapeHtml(client.name)} profile">${escapeHtml(client.initials)}</a>
                <div class="client-name-business">
                  <h2 class="client-name-title"><a href="${clientProfileUrl}" aria-label="View ${escapeHtml(client.name)} profile">${escapeHtml(client.name)}</a></h2>
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
              <p class="client-rating-badge">${client.ratingCount === 0 ? 'Belum ada rating'
                : client.ratingCount < 3 ? 'New'
                  : `★ ${client.overallRating.toFixed(1)} · ${client.ratingCount} reviews`}</p>
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
      if (!searchQuery && selectedBusinessType === 'all'
        && selectedLocation.country === 'all' && selectedLocation.regions.length === 0
        && hasOpenRequestsOnly) {
        clientsCountEl.textContent = `${clients.length} clients`;
      } else {
        clientsCountEl.textContent = `${clients.length} clients`;
      }
    }

    updateFavoriteBadge();
  }

  // Open "View Requests" Modal Dialog
  async function openClientRequestsModal(clientId) {
    const client = CLIENTS_DATA.find(c => c.id === clientId);
    if (!client || !clientDialog || !dialogContent) return;

    let reqs = client.requests;
    if (!Array.isArray(reqs)) {
      if (client.openRequestsCount === 0) {
        reqs = client.requests = [];
      } else {
        try {
          if (!client.requestsTask) {
            client.requestsTask = window.devMatchBackend.client.from('projects')
              .select('id,title,project_type,category,price,data')
              .eq('owner_id',client.id).eq('project_kind','request').eq('status','open')
              .order('updated_at',{ascending:false})
              .then(({data,error})=>{
                if(error)throw error;
                return (data||[]).map(row=>{
                  const data=row.data&&typeof row.data==='object'?row.data:{};
                  return {
                    id:row.id,title:row.title,category:row.category,type:row.project_type,
                    budget:row.price||data.budgetLabel||data.budget||'',
                    description:data.description||data.overview||'',
                    tags:Array.isArray(data.stack)?data.stack:[]
                  };
                });
              }).catch(error=>{
                client.requestsTask=null;
                throw error;
              });
          }
          reqs = client.requests = await client.requestsTask;
          client.requestsTask=null;
        } catch (error) {
          console.error('Unable to load open requests for the selected client.',error);
          window.alert("Unable to load this client's open requests. Please try again.");
          return;
        }
      }
    }
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
    initializeMobileClientActions();

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
        (searchInput || topSearchInput)?.focus();
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

      businessTypeDropdown.addEventListener('click', e => {
        const item = e.target.closest('.dropdown-item, .mobile-client-filter-option');
        if (item) {
          const val = item.dataset.value;
          const isDraft = Boolean(mobileFilterDraft);
          if (isDraft) mobileFilterDraft.businessType = val;
          else selectedBusinessType = val;
          syncClientFilterDropdown(businessTypeDropdown, val, 'Business type');
          if (!isDraft) renderClients();
          return;
        }

        if (e.target.closest('.filter-pill-btn')) {
          const isOpen = !businessTypeDropdown.classList.contains('open');
          businessTypeDropdown.classList.toggle('open', isOpen);
          trigger?.setAttribute('aria-expanded', String(isOpen));
          if (locationDropdown) {
            locationDropdown.classList.remove('open');
            locationDropdown.querySelector('.filter-pill-btn')?.setAttribute('aria-expanded', 'false');
          }
        }
      });
    }

    // Location Dropdown
    if (locationDropdown) {
      const trigger = locationDropdown.querySelector('.filter-pill-btn');

      locationDropdown.addEventListener('click', e => {
        if (e.target.closest('.filter-pill-btn')) {
          const isOpen = !locationDropdown.classList.contains('open');
          locationDropdown.classList.toggle('open', isOpen);
          trigger?.setAttribute('aria-expanded', String(isOpen));
          if (isOpen) {
            locationFilterDraft = copyLocationFilter(selectedLocation);
            renderLocationFilterOptions();
          } else {
            locationFilterDraft = copyLocationFilter(selectedLocation);
          }
          if (businessTypeDropdown) {
            businessTypeDropdown.classList.remove('open');
            businessTypeDropdown.querySelector('.filter-pill-btn')?.setAttribute('aria-expanded', 'false');
          }
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
        if (!mobileFilterDraft) {
          locationFilterDraft = copyLocationFilter(selectedLocation);
          renderLocationFilterOptions();
        }
        if (businessTypeDropdown) {
          businessTypeDropdown.classList.remove('open');
          businessTypeDropdown.querySelector('.filter-pill-btn')?.setAttribute('aria-expanded', 'false');
        }
        if (locationDropdown) {
          locationDropdown.classList.remove('open');
          locationDropdown.querySelector('.filter-pill-btn')?.setAttribute('aria-expanded', 'false');
        }
      }
    });

    // Has Open Requests Toggle
    if (btnToggleOpenRequests) {
      btnToggleOpenRequests.addEventListener('click', () => {
        const isDraft = Boolean(mobileFilterDraft);
        const nextValue = !(isDraft ? mobileFilterDraft.hasOpenRequestsOnly : hasOpenRequestsOnly);
        if (isDraft) mobileFilterDraft.hasOpenRequestsOnly = nextValue;
        else hasOpenRequestsOnly = nextValue;
        btnToggleOpenRequests.classList.toggle('inactive', !nextValue);
        btnToggleOpenRequests.setAttribute('aria-pressed', String(nextValue));
        if (!isDraft) renderClients();
      });
    }

    // Sort Newest / Oldest
    if (sortNewestBtn && sortOldestBtn) {
      sortNewestBtn.addEventListener('click', () => {
        setClientSortOrder('az');
      });
      sortOldestBtn.addEventListener('click', () => {
        setClientSortOrder('za');
      });
    }
    sortRatingBtn?.addEventListener('click', () => setClientSortOrder('rating'));

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
          const client = CLIENTS_DATA.find(item => item.id === id);
          if (saved && !await window.DEVMATCH_FAVORITE_FEEDBACK.confirmRemoval(
            favoriteRemoveDialog,
            favoriteRemoveMessage,
            client?.name || 'this client'
          )) return;
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
          } else {
            favoriteIds = [...favoriteIds, id];
          }
          saveFavorites(favoriteIds);
          renderClients();
          showToast(
            saved ? 'Client removed from your favorites' : 'Client added to your favorites',
            saved ? async () => {
              try {
                if (authenticated) await window.devMatchBackend.setFavorite('client', id, true);
              } catch (error) {
                console.error('Unable to restore client favorite in Supabase.', error);
                window.alert('Unable to restore this favorite. Please try again.');
                return false;
              }
              if (!favoriteIds.includes(id)) favoriteIds = [...favoriteIds, id];
              saveFavorites(favoriteIds);
              renderClients();
              return true;
            } : null,
            saved ? null : {tab: 'clients'}
          );
          return;
        }

        // View requests button
        const viewBtn = e.target.closest('[data-action="view-requests"]');
        if (viewBtn) {
          const id = viewBtn.dataset.clientId;
          openClientRequestsModal(id);
          return;
        }

        const card = e.target.closest('.client-card');
        if (card && !e.target.closest('a, button, input, select, textarea')) {
          window.location.assign(card.dataset.profileUrl);
        }
      });

      clientsGrid.addEventListener('keydown', e => {
        const card = e.target.closest('.client-card');
        if (!card || e.target !== card || e.key !== 'Enter') return;
        e.preventDefault();
        window.location.assign(card.dataset.profileUrl);
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
        selectedLocation = {country: 'all', regions: []};
        hasOpenRequestsOnly = false;
        mobileFilterDraft = null;
        locationFilterDraft = copyLocationFilter(selectedLocation);
        setMobileClientFilterPanelOpen(false);
        if (searchInput) searchInput.value = '';
        if (topSearchInput) topSearchInput.value = '';
        syncClientFilterControls({
          businessType: selectedBusinessType,
          location: selectedLocation,
          hasOpenRequestsOnly
        });
        renderLocationFilterOptions();
        renderClients();
      });
    }
  }

  async function loadClients() {
    const status = document.getElementById('directoryStatus');
    status.hidden = false;
    window.DEVMATCH_SKELETON?.status(status,'Loading client directory');
    window.DEVMATCH_SKELETON?.cards(clientsGrid,6,'client');
    window.DEVMATCH_SKELETON?.text(clientsCountEl,'Loading client count','70px');
    try {
      const user = await window.devMatchBackend.ready;
      if (!user) throw new Error('Sign in with a developer account to browse the client directory.');
      const account = await window.devMatchBackend.loadProfile(user);
      if (account.account_role !== 'dev') throw new Error('The client directory is available in developer mode.');
      const [
        {data: people, count: clientCount, error: peopleError},
        {count: projectRequestCount, error: projectsError}
      ] = await Promise.all([
        window.devMatchBackend.client.from('directory_people')
          .select('id,display_name,username,account_role,profile_data,open_request_count', {count:'exact'})
          .eq('account_role', 'client'),
        window.devMatchBackend.client.from('projects')
          .select('id', {count:'exact',head:true})
          .eq('project_kind', 'request').eq('status', 'open')
      ]);
      if (peopleError) throw peopleError;
      if (projectsError) throw projectsError;
      const ratingSummaries = await window.devMatchBackend.loadDirectoryRatingSummaries(
        (people || []).map(person => person.id), 'client'
      );
      if (clientCount === null || projectRequestCount === null) {
        throw new Error('The client or project request count was not returned by Supabase.');
      }
      if (projectRequestsTabCount && projectRequestCount !== null) projectRequestsTabCount.textContent = String(projectRequestCount);
      if (clientsTabCount && clientCount !== null) clientsTabCount.textContent = String(clientCount);
      CLIENTS_DATA = (people || []).map((person,index) => {
        const profile = person.profile_data || {};
        const name = String(person.display_name || 'DEV-MATCH member');
        const category = String(profile.industry || '');
        return {id:person.id,contactId:person.id,name,initials:(name.match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'DM',
          business:String(profile.companyName || name),category,businessType:category||'Business type not provided',type:'Client',
          country:String(profile.country || ''),profileCity:String(profile.city || ''),
          openRequestsCount:Number(person.open_request_count)||0,location:String(profile.city || 'Location not provided'),activeText:'Profile listed',
          ratingCount:ratingSummaries.get(person.id)?.reviewCount||0,
          overallRating:ratingSummaries.get(person.id)?.overallRating||null,
          adjustedRating:ratingSummaries.get(person.id)?.adjustedRating??4,
          orderIndex:index};
      });
      status.hidden = true;
      emptyState.hidden = CLIENTS_DATA.length > 0;
      renderClients();
    } catch (error) {
      console.error('Unable to load the client directory from Supabase.', error);
      if (projectRequestsTabCount) projectRequestsTabCount.textContent = '—';
      if (clientsTabCount) clientsTabCount.textContent = '—';
      status.textContent = error.message && /Sign in|available in developer mode/.test(error.message)
        ? error.message : 'The client directory could not be loaded. Check your connection and try again.';
      status.hidden = false;
      CLIENTS_DATA = [];
      clientsCountEl.textContent = '— clients';
      emptyState.hidden = true;
      renderClients();
    }
  }

  populateBusinessTypeOptions();
  renderLocationFilterOptions();
  initEvents();
  emptyState.hidden = true;
  loadClients();
  loadClientLocationOptions();
})();
