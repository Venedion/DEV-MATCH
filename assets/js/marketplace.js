(function () {
  'use strict';

  const main = document.querySelector('[data-marketplace]');
  const isRequestsPage = main.dataset.marketplace === 'requests';
  const projects = Array.isArray(window.DEVMATCH_SAMPLE_PROJECTS) ? window.DEVMATCH_SAMPLE_PROJECTS : [];
  const requests = Array.isArray(window.DEVMATCH_SAMPLE_REQUESTS) ? window.DEVMATCH_SAMPLE_REQUESTS : [];
  const favoritesKey = 'devmatch-client-favorites';
  const searchInput = document.getElementById('marketSearch');
  const topSearchInput = document.getElementById('topSearchInput');
  const grid = document.getElementById('projectGrid');
  const emptyState = document.getElementById('emptyState');
  const dialog = document.getElementById('projectDialog');
  const dialogContent = document.getElementById('dialogContent');
  const summary = document.getElementById('resultsSummary');
  const categoryButtons = [...document.querySelectorAll('[data-category]')];
  const loadMoreButton = document.getElementById('loadMore');
  const remainingCount = document.getElementById('remainingCount');
  let favoriteIds = readFavorites();
  let activeCategory = 'all';
  let query = '';
  let view = 'grid';
  let visibleCount = 3;

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
      const budgetMatch = budget === 'all'
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
    const favoriteButton = isRequestsPage || !includeFavorite ? '' : `<button class="favorite-button" type="button" data-favorite="${escapeHtml(item.id)}" aria-pressed="${favorite}" aria-label="${favorite ? 'Hapus dari' : 'Simpan ke'} Favorites"><svg viewBox="0 0 24 24"><path d="m20.8 4.6-1.4-1.4a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg></button>`;
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
        <span class="rating" aria-label="Rating 4.9 dari 5"><span>★</span> 4.9</span>
      </div>
      <div class="catalog-actions"><button class="catalog-detail-link" type="button" data-detail="${escapeHtml(item.id)}">Lihat detail <span aria-hidden="true">→</span></button></div>`;
    const requestContent = `<div class="project-meta"><span class="project-type-pill">${escapeHtml(item.type)}</span><span class="open-pill">Terbuka · ${escapeHtml(item.days)}</span></div>
      <button class="project-title" type="button" data-detail="${escapeHtml(item.id)}">${escapeHtml(item.title)}</button>
      <p class="project-description">${escapeHtml(item.description)}</p>
      <strong class="request-budget">${escapeHtml(item.budgetLabel)}</strong>
      <div class="request-detail-row"><span><svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/></svg>${escapeHtml(item.location)}</span><span>${escapeHtml(item.client)}</span></div>
      <div class="tech-tags">${stack.map(value => `<span>${escapeHtml(value)}</span>`).join('')}</div>
      <div class="card-actions"><a class="button-primary" href="devmatch-chat.html?role=dev&amp;request=${encodeURIComponent(item.id)}">Kirim Penawaran <span aria-hidden="true">→</span></a></div>`;
    return `<article class="project-card${isRequestsPage ? '' : ' catalog-card'}" data-card-detail="${escapeHtml(item.id)}" tabindex="0" aria-label="Buka detail ${escapeHtml(item.title)}">
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
      label.textContent = `${count} proyek`;
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

  function render() {
    const filtered = getItems();
    const shown = filtered.slice(0, visibleCount);
    grid.classList.toggle('is-list', view === 'list');
    grid.innerHTML = shown.map(renderProject).join('');
    emptyState.hidden = filtered.length !== 0;
    summary.textContent = `Menampilkan ${filtered.length} proyek ditemukan`;
    document.getElementById('favoriteCount').textContent = String(favoriteIds.length);
    updateNotificationCount();
    const remaining = Math.max(0, filtered.length - shown.length);
    remainingCount.textContent = remaining ? `Menampilkan ${shown.length} dari ${filtered.length} proyek` : '';
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

    const stack = isRequestsPage ? item.stack : String(item.stack).split(/\s+(?:and|,)\s+/);
    const owner = isRequestsPage ? item.client : item.developer;
    const location = item.location;
    const overview = isRequestsPage ? item.description : item.overview || item.description;
    const sections = isRequestsPage
      ? `<h3>Kebutuhan utama</h3><ul>${item.features.map(feature => `<li>${escapeHtml(feature)}</li>`).join('')}</ul><h3>Tentang klien</h3><p>${escapeHtml(item.client)} sedang mencari developer untuk membantu operasional bisnisnya di ${escapeHtml(item.location)}.</p>`
      : `<h3>Gambaran proyek</h3><p>${escapeHtml(overview)}</p><h3>Spesifikasi teknis</h3><p>Dibangun menggunakan ${escapeHtml(item.stack)} dengan tampilan responsif dan pengalaman yang optimal di desktop maupun mobile.</p><h3>Portofolio developer</h3><p>${escapeHtml(item.developerBio || `${item.developer} berpengalaman mengembangkan solusi digital untuk bisnis.`)}</p>`;
    const chatUrl = `devmatch-chat.html?${isRequestsPage ? 'role=dev&request=' : 'role=client&project='}${encodeURIComponent(item.id)}`;
    dialogContent.innerHTML = `<span class="project-type-pill">${escapeHtml(item.category)} · ${escapeHtml(item.type)}</span><h2 id="dialogTitle">${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><div class="dialog-cover">${artwork(item, false)}</div>${sections}<div class="tech-tags">${stack.map(value => `<span>${escapeHtml(value)}</span>`).join('')}</div><div class="dialog-facts"><div class="dialog-fact"><small>${isRequestsPage ? 'Budget klien' : 'Harga proyek'}</small><b>${escapeHtml(isRequestsPage ? item.budgetLabel : item.price)}</b></div><div class="dialog-fact"><small>${isRequestsPage ? 'Klien' : 'Developer'}</small><b>${escapeHtml(owner)}</b></div><div class="dialog-fact"><small>Lokasi</small><b>${escapeHtml(location)}</b></div><div class="dialog-fact"><small>Status</small><b>${isRequestsPage ? 'Menerima penawaran' : `Dipublikasikan ${escapeHtml(item.created || item.age)}`}</b></div></div><div class="dialog-actions"><a class="button-primary" href="${chatUrl}">${isRequestsPage ? 'Hubungi klien' : 'Chat developer'} <span aria-hidden="true">→</span></a><button class="button-secondary" type="button" data-close-dialog>Tutup detail</button></div>`;
    dialog.showModal();
  }

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
    categoryButtons.forEach(button => {
      const active = button.dataset.category === 'all';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    visibleCount = 3;
    render();
  });
  grid.addEventListener('click', event => {
    const favoriteButton = event.target.closest('[data-favorite]');
    if (favoriteButton) {
      const id = favoriteButton.dataset.favorite;
      favoriteIds = favoriteIds.includes(id) ? favoriteIds.filter(value => value !== id) : [...favoriteIds, id];
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
