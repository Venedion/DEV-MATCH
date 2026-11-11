(function () {
  'use strict';

  const main = document.querySelector('[data-marketplace]');
  const isRequestsPage = main.dataset.marketplace === 'requests';
  const projects = Array.isArray(window.DEVMATCH_SAMPLE_PROJECTS) ? window.DEVMATCH_SAMPLE_PROJECTS : [];
  const requests = Array.isArray(window.DEVMATCH_SAMPLE_REQUESTS) ? window.DEVMATCH_SAMPLE_REQUESTS : [];
  const favoritesKey = isRequestsPage ? 'devmatch-developer-project-favorites' : 'devmatch-client-project-favorites';
  if (localStorage.getItem(favoritesKey) === null) {
    const legacy = localStorage.getItem('devmatch-client-favorites');
    if (legacy !== null) localStorage.setItem(favoritesKey, legacy);
  }
  const searchInput = document.getElementById('marketSearch');
  const topSearchInput = document.getElementById('topSearchInput');
  const grid = document.getElementById('projectGrid');
  const emptyState = document.getElementById('emptyState');
  const dialog = document.getElementById('projectDialog');
  const summary = document.getElementById('resultsSummary');
  const categoryButtons = [...document.querySelectorAll('[data-category]')];
  const loadMoreButton = document.getElementById('loadMore');
  const remainingCount = document.getElementById('remainingCount');
  let favoriteIds = readFavorites();
  const favoriteStateReady = window.devMatchBackend.ready.then(user => user
    ? window.devMatchBackend.loadFavorites()
    : null
  ).then(records => {
    if (!records) return false;
    favoriteIds = records.filter(item => item.type === 'project').map(item => item.id);
    localStorage.setItem(favoritesKey, JSON.stringify(favoriteIds));
    render();
    return true;
  }).catch(error => {
    console.error('Unable to load project favorites from Supabase.', error);
    window.alert('Unable to load favorites. Check your connection and try again.');
    return null;
  });
  let activeCategory = 'all';
  let query = '';
  let view = 'grid';
  let visibleCount = 3;
  const budgetValues = { mode: 'all', lower: '', from: '', to: '' };
  const dropdownConfigs = [
    { selectId: 'typeFilter', triggerId: 'typeFilterTrigger', menuId: 'typeFilterMenu', width: 180 },
    { selectId: 'budgetFilter', triggerId: 'budgetFilterTrigger', menuId: 'budgetFilterMenu', width: 430, align: 'left', custom: true },
    { selectId: 'stackFilter', triggerId: 'stackFilterTrigger', menuId: 'stackFilterMenu', width: 180 },
    { selectId: 'sortFilter', triggerId: 'sortFilterTrigger', menuId: 'sortFilterMenu', width: 205, align: 'right' }
  ];

  function closeDropdown(menu, trigger){
    if(menu.matches(':popover-open'))menu.hidePopover();
    trigger.setAttribute('aria-expanded','false');
  }

  function syncDropdownLabels(){
    dropdownConfigs.forEach(({selectId,triggerId,menuId})=>{
      const select=document.getElementById(selectId);
      const trigger=document.getElementById(triggerId);
      const menu=document.getElementById(menuId);
      if(!select||!trigger||!menu)return;
      if(selectId==='budgetFilter'){
        const amount=Number(budgetValues.lower);
        const from=Number(budgetValues.from);
        const to=Number(budgetValues.to);
        let label='All budgets';
        if(budgetValues.mode==='lower-than')label=budgetValues.lower?`Lower than Rp ${amount.toLocaleString('id-ID')}`:'Lower than...';
        if(budgetValues.mode==='higher-than')label=budgetValues.lower?`Higher than Rp ${amount.toLocaleString('id-ID')}`:'Higher than...';
        if(budgetValues.mode==='range'){
          const fromText=budgetValues.from?from.toLocaleString('id-ID'):'From...';
          const toText=budgetValues.to?to.toLocaleString('id-ID'):'To...';
          label=`Rp ${fromText} – ${toText}`;
        }
        trigger.querySelector('span').textContent=label;
        menu.querySelectorAll('[data-budget-mode]').forEach(option=>{
          option.setAttribute('aria-pressed',String(option.dataset.budgetMode===budgetValues.mode));
        });
        return;
      }
      const selectedOption=select.selectedOptions[0];
      trigger.querySelector('span').textContent=selectedOption.textContent;
      menu.querySelectorAll('[data-value]').forEach(option=>{
        option.setAttribute('aria-checked',String(option.dataset.value===select.value));
      });
    });
  }

  function initializeDropdowns(){
    if(!document.getElementById('typeFilterTrigger'))return;
    dropdownConfigs.forEach(config=>{
      const select=document.getElementById(config.selectId);
      const trigger=document.getElementById(config.triggerId);
      const menu=document.getElementById(config.menuId);
      if(!config.custom)[...select.options].forEach(option=>{
        const item=document.createElement('button');
        item.type='button';
        item.setAttribute('role','menuitemradio');
        item.dataset.value=option.value;
        item.textContent=option.textContent;
        item.addEventListener('click',()=>{
          select.value=option.value;
          syncDropdownLabels();
          select.dispatchEvent(new Event('change',{bubbles:true}));
          closeDropdown(menu,trigger);
          trigger.focus();
        });
        menu.append(item);
      });
      trigger.addEventListener('click',()=>{
        if(menu.matches(':popover-open')){
          closeDropdown(menu,trigger);
          return;
        }
        dropdownConfigs.forEach(other=>{
          if(other===config)return;
          closeDropdown(document.getElementById(other.menuId),document.getElementById(other.triggerId));
        });
        menu.showPopover();
        const triggerBounds=trigger.getBoundingClientRect();
        const menuBounds=menu.getBoundingClientRect();
        const preferredWidth=config.custom
          ?budgetValues.mode==='all'?165:430
          :config.width;
        const menuWidth=Math.min(config.custom?preferredWidth:Math.max(triggerBounds.width,preferredWidth),window.innerWidth-20);
        const left=config.align==='right'
          ?Math.max(10,Math.min(triggerBounds.right-menuWidth,window.innerWidth-menuWidth-10))
          :Math.max(10,Math.min(triggerBounds.left,window.innerWidth-menuWidth-10));
        const spaceBelow=window.innerHeight-triggerBounds.bottom-8;
        const top=spaceBelow>=menuBounds.height||spaceBelow>=triggerBounds.top
          ?triggerBounds.bottom+6
          :Math.max(10,triggerBounds.top-menuBounds.height-6);
        menu.style.left=`${left}px`;
        menu.style.top=`${top}px`;
        menu.style.width=`${menuWidth}px`;
        menu.style.minWidth=config.custom?'0px':`${menuWidth}px`;
        trigger.setAttribute('aria-expanded','true');
        if(config.custom){
          const activeMode=menu.querySelector(`[data-budget-mode="${budgetValues.mode}"]`);
          activeMode?.focus({preventScroll:true});
        }else menu.querySelector(`[data-value="${select.value}"]`)?.focus({preventScroll:true});
      });
      menu.addEventListener('toggle',()=>{
        trigger.setAttribute('aria-expanded',String(menu.matches(':popover-open')));
      });
      menu.addEventListener('keydown',event=>{
        if(event.key==='Escape'){
          closeDropdown(menu,trigger);
          trigger.focus();
        }
      });
      window.addEventListener('resize',()=>closeDropdown(menu,trigger));
      window.addEventListener('scroll',event=>{
        if(!menu.contains(event.target))closeDropdown(menu,trigger);
      },{capture:true,passive:true});
    });
    const budgetMenu=document.getElementById('budgetFilterMenu');
    const budgetTrigger=document.getElementById('budgetFilterTrigger');
    const budgetSingleLabel=document.getElementById('budgetSingleValueLabel');
    const budgetSingleInput=document.getElementById('budgetSingleValue');
    const budgetRangeValues=document.getElementById('budgetRangeValues');
    const budgetFromInput=document.getElementById('budgetFromValue');
    const budgetToInput=document.getElementById('budgetToValue');
    const budgetMenuValues=document.getElementById('budgetMenuValues');
    const budgetRangeError=document.getElementById('budgetRangeError');
    const budgetRangeHint=document.getElementById('budgetRangeHint');
    budgetSingleInput.value=budgetValues.lower;
    budgetFromInput.value=budgetValues.from;
    budgetToInput.value=budgetValues.to;

    function positionBudgetMenu(){
      const triggerBounds=budgetTrigger.getBoundingClientRect();
      const preferredWidth=budgetValues.mode==='all'?165:430;
      const menuWidth=Math.min(preferredWidth,window.innerWidth-20);
      budgetMenu.style.width=`${menuWidth}px`;
      budgetMenu.style.minWidth='0px';
      const left=Math.max(10,Math.min(triggerBounds.left,window.innerWidth-menuWidth-10));
      const menuHeight=budgetMenu.getBoundingClientRect().height;
      const spaceBelow=window.innerHeight-triggerBounds.bottom-8;
      const top=spaceBelow>=menuHeight||spaceBelow>=triggerBounds.top
        ?triggerBounds.bottom+6
        :Math.max(10,triggerBounds.top-menuHeight-6);
      budgetMenu.style.left=`${left}px`;
      budgetMenu.style.top=`${top}px`;
    }

    function updateBudgetFields(){
      const needsValues=budgetValues.mode!=='all';
      const isRange=budgetValues.mode==='range';
      budgetMenuValues.hidden=!needsValues;
      budgetSingleLabel.hidden=isRange;
      budgetRangeValues.hidden=!isRange;
      budgetRangeHint.textContent=isRange
        ?'Enter both amounts to filter projects.'
        :'Enter an amount to filter projects.';
      budgetRangeError.hidden=!(isRange&&budgetValues.from&&budgetValues.to&&Number(budgetValues.from)>Number(budgetValues.to));
      budgetMenu.classList.toggle('has-values',needsValues);
      if(budgetMenu.matches(':popover-open'))positionBudgetMenu();
      syncDropdownLabels();
    }

    budgetMenu.querySelectorAll('[data-budget-mode]').forEach(option=>{
      option.addEventListener('click',()=>{
        budgetValues.mode=option.dataset.budgetMode;
        document.getElementById('budgetFilter').value=budgetValues.mode;
        if(budgetValues.mode==='all'){
          budgetValues.lower='';
          budgetValues.from='';
          budgetValues.to='';
          budgetSingleInput.value='';
          budgetFromInput.value='';
          budgetToInput.value='';
        }
        updateBudgetFields();
        document.getElementById('budgetFilter').dispatchEvent(new Event('change',{bubbles:true}));
        if(budgetValues.mode==='all'){
          closeDropdown(budgetMenu,budgetTrigger);
          budgetTrigger.focus();
        }else{
          (budgetValues.mode==='range'?budgetFromInput:budgetSingleInput).focus({preventScroll:true});
        }
      });
    });
    const updateBudgetValue=()=>{
      budgetValues.lower=budgetSingleInput.value;
      budgetValues.from=budgetFromInput.value;
      budgetValues.to=budgetToInput.value;
      updateBudgetFields();
      document.getElementById('budgetFilter').dispatchEvent(new Event('change',{bubbles:true}));
    };
    [budgetSingleInput,budgetFromInput,budgetToInput].forEach(input=>input.addEventListener('input',updateBudgetValue));
    budgetMenu.addEventListener('keydown',event=>{
      if(event.key==='Escape'){
        closeDropdown(budgetMenu,budgetTrigger);
        budgetTrigger.focus();
      }
    });
    document.addEventListener('pointerdown',event=>{
      dropdownConfigs.forEach(({triggerId,menuId})=>{
        const trigger=document.getElementById(triggerId);
        const menu=document.getElementById(menuId);
        if(menu.matches(':popover-open')&&!menu.contains(event.target)&&!trigger.contains(event.target)){
          closeDropdown(menu,trigger);
        }
      });
    });
    updateBudgetFields();
    syncDropdownLabels();
  }

  function readFavorites() {
    try {
      const saved = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
      return Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : [];
    } catch (error) {
      console.warn('Could not read DEV-MATCH favorites from localStorage.', error);
      return [];
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(favoritesKey, JSON.stringify(favoriteIds));
    } catch (error) {
      console.warn('Could not save DEV-MATCH favorites to localStorage.', error);
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  function priceValue(project) {
    return isRequestsPage ? project.budget : Number(String(project.price).replace(/\D/g, '')) || 0;
  }

  function categoryMatch(item) {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'Android / iOS') return item.type === 'Android / iOS';
    return item.category === activeCategory;
  }

  function getItems() {
    const source = isRequestsPage ? requests : projects;
    const type = document.getElementById('typeFilter').value;
    const budget = document.getElementById('budgetFilter').value;
    const stack = document.getElementById('stackFilter').value.toLowerCase();
    const filtered = source.filter(item => {
      const price = priceValue(item);
      const lower = Number(budgetValues.mode === 'range' ? budgetValues.from : budgetValues.lower);
      const upper = Number(budgetValues.to);
      const hasLower = budgetValues.mode === 'range' ? budgetValues.from !== '' : budgetValues.lower !== '';
      const hasUpper = budgetValues.mode === 'range' && budgetValues.to !== '';
      const invalidRange = budgetValues.mode === 'range' && hasLower && hasUpper && lower > upper;
      const budgetMatch = isRequestsPage
        ? !invalidRange && (
          budgetValues.mode === 'all'
          || budgetValues.mode === 'lower-than' && (!hasLower || price < lower)
          || budgetValues.mode === 'higher-than' && (!hasLower || price > lower)
          || budgetValues.mode === 'range' && (!hasLower || !hasUpper || price >= lower && price <= upper)
        )
        : budget === 'all'
          || budget === 'under-3' && price < 3000000
          || budget === '3-to-6' && price >= 3000000 && price <= 6000000
          || budget === 'over-6' && price > 6000000;
      const stacks = isRequestsPage ? item.stack : String(item.stack).split(/\s+(?:and|,)\s+/);
      const stackMatch = stack === 'all' || stacks.some(value => value.toLowerCase().includes(stack));
      const text = isRequestsPage
        ? [item.title, item.description, item.category, item.type, item.client, item.location, ...item.stack, 'developer'].join(' ')
        : [item.title, item.description, item.category, item.type, item.developer, item.location, item.stack, 'developer'].join(' ');
      const searchTerms = query.replace(/\btoko\b/g, 'online').split(/\s+/).filter(Boolean);
      return categoryMatch(item) && (type === 'all' || item.type === type) && budgetMatch && stackMatch
        && (!query || searchTerms.every(term => text.toLowerCase().includes(term)));
    });

    const sort = document.getElementById('sortFilter').value;
    if (sort === 'price-low') filtered.sort((a, b) => priceValue(a) - priceValue(b));
    if (sort === 'price-high') filtered.sort((a, b) => priceValue(b) - priceValue(a));
    if (sort === 'popular') filtered.sort((a, b) => (b.popularity || Number(b.developerFavorites) || 0) - (a.popularity || Number(a.developerFavorites) || 0));
    if (sort === 'newest') filtered.sort((a, b) => isRequestsPage ? requests.indexOf(a) - requests.indexOf(b) : projects.indexOf(a) - projects.indexOf(b));
    return filtered;
  }

  function artwork(item, includeFavorite = true) {
    const art = isRequestsPage
      ? 'dashboard-art'
      : item.art || 'food-art';
    let markup = '<span class="art-title"></span><span class="art-copy"></span><div class="art-graphic"></div>';
    if (art === 'dashboard-art') markup = '<div class="mini-bars"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
    if (art === 'analytics-art') markup = '<div class="analytics-stats"><i></i><i></i><i></i></div><div class="analytics-graph"></div>';
    const favorite = favoriteIds.includes(item.id);
    const favoriteButton = isRequestsPage || !includeFavorite ? '' : `<button class="favorite-button" type="button" data-favorite="${escapeHtml(item.id)}" aria-pressed="${favorite}" aria-label="${favorite ? 'Remove from' : 'Save to'} Favorites"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>`;
    const artLabel = isRequestsPage ? `${item.category} · ${item.type}` : item.type;
    return `<div class="project-art ${escapeHtml(art)}"><span class="art-label">${escapeHtml(artLabel)}</span>${favoriteButton}<div class="art-window"><div class="art-header"><i></i><i></i><i></i></div><div class="art-layout"><div class="art-sidebar"></div><div class="art-content">${markup}</div></div></div></div>`;
  }

  function renderProject(item) {
    const stack = String(item.stack).split(/\s+(?:and|,)\s+/).filter(Boolean).slice(0, 3);
    const catalogContent = `<div class="project-meta"><b class="catalog-category">${escapeHtml(item.category)}</b><span>${escapeHtml(item.age)}</span></div>
      <button class="project-title" type="button" data-detail="${escapeHtml(item.id)}">${escapeHtml(item.title)}</button>
      <p class="project-description">${escapeHtml(item.description)}</p>
      <strong class="catalog-price">${escapeHtml(item.price)}</strong>
      <div class="project-by catalog-project-by">
        <span class="developer-avatar">${escapeHtml(item.initials)}</span>
        <span class="developer-info"><b>${escapeHtml(item.developer)}</b></span>
        <span class="rating" aria-label="Rating 4.9 out of 5"><span>★</span> 4.9</span>
      </div>
      <div class="catalog-actions"><button class="catalog-detail-link" type="button" data-detail="${escapeHtml(item.id)}">View details <span aria-hidden="true">→</span></button></div>`;
    const requestContent = `<div class="project-meta"><span class="project-type-pill">${escapeHtml(item.type)}</span><span class="open-pill">Open · ${escapeHtml(item.days)}</span></div>
      <button class="project-title" type="button" data-detail="${escapeHtml(item.id)}">${escapeHtml(item.title)}</button>
      <p class="project-description">${escapeHtml(item.description)}</p>
      <strong class="request-budget">${escapeHtml(item.budgetLabel)}</strong>
      <div class="request-detail-row"><span><svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/></svg>${escapeHtml(item.location)}</span><span>${escapeHtml(item.client)}</span></div>
      <div class="tech-tags">${stack.map(value => `<span>${escapeHtml(value)}</span>`).join('')}</div>
      <div class="card-actions"><a class="button-primary" href="devmatch-chat.html?role=dev&amp;request=${encodeURIComponent(item.id)}">Submit proposal <span aria-hidden="true">→</span></a></div>`;
    return `<article class="project-card${isRequestsPage ? '' : ' catalog-card'}" data-card-detail="${escapeHtml(item.id)}" tabindex="0" aria-label="Open details for ${escapeHtml(item.title)}">
      ${artwork(item)}
      <div class="project-body">
        ${isRequestsPage ? requestContent : catalogContent}
      </div>
    </article>`;
  }

  function updateCategoryCounts() {
    const source = isRequestsPage ? requests : projects;
    document.querySelectorAll('[data-category-count]').forEach(label => {
      const category = label.dataset.categoryCount;
      const count = category === 'all' ? source.length : source.filter(item => category === 'Android / iOS' ? item.type === category : item.category === category).length;
      const countLabel = count === 1 ? 'project' : 'projects';
      label.textContent = `${count} ${countLabel}`;
    });
    categoryButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === activeCategory)));
  }

  function updateNotificationCount() {
    const badge = document.getElementById('clientNotificationCount');
    if (!badge) return;
    try {
      const readIds = new Set(JSON.parse(localStorage.getItem('devmatch-client-notifications-read') || '[]'));
      const unreadCount = ['jessica-comment', 'rizky-message'].filter(id => !readIds.has(id)).length;
      badge.textContent = String(unreadCount);
      badge.hidden = unreadCount === 0;
    } catch (error) {
      console.warn('Could not read DEV-MATCH notification state from localStorage.', error);
    }
  }

  window.devMatchBackend.ready.then(user => user
    ? window.devMatchBackend.loadNotificationReads()
    : null
  ).then(readIds => {
    if (!readIds) return;
    localStorage.setItem('devmatch-client-notifications-read', JSON.stringify(readIds));
    updateNotificationCount();
  }).catch(error => {
    console.error('Unable to load notification status from Supabase.', error);
    window.alert('Unable to load notification status. Check your connection and try again.');
  });

  function updateFavoriteCount() {
    if (window.DEVMATCH_NAV_BADGES) {
      window.DEVMATCH_NAV_BADGES.updateFavorites();
    } else {
      document.getElementById('favoriteCount').textContent = String(favoriteIds.length);
    }
  }

  function render() {
    const filtered = getItems();
    const shown = filtered.slice(0, visibleCount);
    grid.classList.toggle('is-list', view === 'list');
    grid.innerHTML = shown.map(renderProject).join('');
    emptyState.hidden = filtered.length !== 0;
    summary.textContent = isRequestsPage
      ? `Showing ${filtered.length} ${filtered.length === 1 ? 'project' : 'projects'}`
      : `Showing ${filtered.length} ${filtered.length === 1 ? 'project' : 'projects'}`;
    updateFavoriteCount();
    updateNotificationCount();
    const remaining = Math.max(0, filtered.length - shown.length);
    remainingCount.textContent = remaining
      ? isRequestsPage
        ? `Showing ${shown.length} of ${filtered.length} projects`
        : `Showing ${shown.length} of ${filtered.length} projects`
      : '';
    loadMoreButton.hidden = remaining === 0;
    updateCategoryCounts();
  }

  function selectedItem(id) {
    const source = isRequestsPage ? requests : projects;
    return source.find(item => item.id === id);
  }

  function showDetails(id) {
    const item = selectedItem(id);
    if (!item) {
      console.error(`DEV-MATCH project details not found for "${id}".`);
      return;
    }
    if (isRequestsPage) {
      window.location.href = `devmatch-find-project-detail.html?request=${encodeURIComponent(item.id)}`;
    } else {
      window.location.href = `devmatch-discover-project-detail.html?project=${encodeURIComponent(item.id)}`;
    }
  }

  initializeDropdowns();
  document.getElementById('marketSearchForm').addEventListener('submit', event => {
    event.preventDefault();
    query = searchInput.value.trim().toLowerCase();
    searchInput.value = query ? searchInput.value : '';
    visibleCount = 3;
    render();
  });
  searchInput.addEventListener('input', () => {
    query = searchInput.value.trim().toLowerCase();
    visibleCount = 3;
    render();
  });
  topSearchInput.addEventListener('input', () => {
    searchInput.value = topSearchInput.value;
    query = topSearchInput.value.trim().toLowerCase();
    visibleCount = 3;
    render();
  });
  document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => {
    searchInput.value = button.dataset.query;
    topSearchInput.value = button.dataset.query;
    query = button.dataset.query.toLowerCase();
    visibleCount = 3;
    render();
    searchInput.focus();
  }));
  categoryButtons.forEach(button => button.addEventListener('click', () => {
    activeCategory = button.dataset.category;
    categoryButtons.forEach(category => {
      const active = category === button;
      category.classList.toggle('is-active', active);
      category.setAttribute('aria-pressed', String(active));
    });
    visibleCount = 3;
    render();
  }));
  ['typeFilter', 'budgetFilter', 'stackFilter', 'sortFilter'].forEach(id => document.getElementById(id).addEventListener('change', () => {
    visibleCount = 3;
    render();
  }));
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    view = button.dataset.view;
    document.querySelectorAll('[data-view]').forEach(option => {
      const selected = option === button;
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
    render();
  }));
  document.querySelector('[data-reset]').addEventListener('click', () => {
    query = '';
    activeCategory = 'all';
    searchInput.value = '';
    topSearchInput.value = '';
    ['typeFilter', 'budgetFilter', 'stackFilter'].forEach(id => { document.getElementById(id).value = 'all'; });
    document.getElementById('sortFilter').value = 'popular';
    if(isRequestsPage){
      budgetValues.mode = 'all';
      budgetValues.lower = '';
      budgetValues.from = '';
      budgetValues.to = '';
      ['budgetSingleValue', 'budgetFromValue', 'budgetToValue'].forEach(id => { document.getElementById(id).value = ''; });
      document.getElementById('budgetMenuValues').hidden = true;
      document.getElementById('budgetSingleValueLabel').hidden = false;
      document.getElementById('budgetRangeValues').hidden = true;
      document.getElementById('budgetRangeError').hidden = true;
      document.getElementById('budgetFilterMenu').classList.remove('has-values');
    }
    syncDropdownLabels();
    categoryButtons.forEach(button => {
      const active = button.dataset.category === 'all';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    visibleCount = 3;
    render();
  });
  grid.addEventListener('click', async event => {
    const favoriteButton = event.target.closest('[data-favorite]');
    if (favoriteButton) {
      const authenticated = await favoriteStateReady;
      if (authenticated === null) return;
      const id = favoriteButton.dataset.favorite;
      const saved = favoriteIds.includes(id);
      if (authenticated) {
        try {
          await window.devMatchBackend.setFavorite('project', id, !saved);
        } catch (error) {
          console.error('Unable to update project favorite in Supabase.', error);
          window.alert('Unable to save this favorite. Please try again.');
          return;
        }
      }
      favoriteIds = saved ? favoriteIds.filter(value => value !== id) : [...favoriteIds, id];
      saveFavorites();
      render();
      return;
    }
    const detailButton = event.target.closest('[data-detail]');
    if (detailButton) showDetails(detailButton.dataset.detail);
    else if (!event.target.closest('a, button, input, select, textarea, summary')) {
      const card = event.target.closest('[data-card-detail]');
      if (card) showDetails(card.dataset.cardDetail);
    }
  });
  grid.addEventListener('keydown', event => {
    if (event.target.matches('[data-card-detail]') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      showDetails(event.target.dataset.cardDetail);
    } else if (event.key === 'Enter' && event.target.matches('[data-detail]')) {
      showDetails(event.target.dataset.detail);
    }
  });
  loadMoreButton.addEventListener('click', () => {
    visibleCount += 6;
    render();
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-close-dialog]')) dialog.close();
    if (event.target === dialog) dialog.close();
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchInput.focus();
    }
  });

  render();
})();
