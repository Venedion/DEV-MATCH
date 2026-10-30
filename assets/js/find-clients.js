/**
 * Find Clients Page Logic - DEV-MATCH
 * Replicates design from "Find Clients.pdf"
 */

(function () {
  'use strict';

  const FAVORITES_KEY = 'devmatch-favorite-clients';

  // Client Dataset matching the PDF UI Design exactly
  const CLIENTS_DATA = Array.isArray(window.DEVMATCH_SAMPLE_CLIENTS) ? window.DEVMATCH_SAMPLE_CLIENTS : [
    {
      id: 'jessica-sitorus',
      contactId: 'jessica',
      name: 'Jessica Sitorus',
      initials: 'JS',
      business: 'Kopi Ombak — Café',
      category: 'Café',
      businessType: 'Café / F&B',
      type: 'Client',
      openRequestsCount: 3,
      location: 'Medan',
      activeText: 'Active 2h ago',
      orderIndex: 1,
      requests: [
        {
          id: 'req-js-1',
          title: 'Sistem Kasir & POS Multi-cabang',
          category: 'POS',
          type: 'Web App',
          budget: 'Rp 6.500.000',
          description: 'Membutuhkan sistem kasir cloud untuk 2 outlet kedai kopi kami, dengan sinkronisasi inventaris stok biji kopi, laporan penjualan harian, dan integrasi pembayaran QRIS.',
          tags: ['POS', 'Cloud', 'Inventory', 'QRIS']
        },
        {
          id: 'req-js-2',
          title: 'Website Menu Digital & Reservasi Meja',
          category: 'Company Profile',
          type: 'Website',
          budget: 'Rp 3.500.000',
          description: 'Website katalog menu interaktif dengan foto hidangan dan formulir reservasi meja yang langsung mengirim konfirmasi via WhatsApp ke pelanggan.',
          tags: ['Next.js', 'WhatsApp API', 'Responsive']
        },
        {
          id: 'req-js-3',
          title: 'Program Loyalty & Kupon Digital Pelanggan',
          category: 'Marketing',
          type: 'Web App',
          budget: 'Rp 2.800.000',
          description: 'Fitur stempel digital pelanggan setia berdasarkan nomor handphone saat transaksi di meja kasir.',
          tags: ['Loyalty', 'Web App', 'Promotion']
        }
      ]
    },
    {
      id: 'andreas-halim',
      contactId: 'andreas',
      name: 'Andreas Halim',
      initials: 'AH',
      business: 'Halim Fashion — Retail',
      category: 'Retail',
      businessType: 'Retail / Fashion',
      type: 'Client',
      openRequestsCount: 1,
      location: 'Medan',
      activeText: 'Active 5h ago',
      orderIndex: 2,
      requests: [
        {
          id: 'req-ah-1',
          title: 'Katalog Fashion & Integrasi WhatsApp Checkout',
          category: 'E-Commerce',
          type: 'Website',
          budget: 'Rp 4.500.000',
          description: 'Toko butik pakaian butuh website katalog modern dengan fitur filter ukuran/warna, live stok barang, dan tombol direct order ke admin WhatsApp.',
          tags: ['E-Commerce', 'Catalog', 'WhatsApp Checkout']
        }
      ]
    },
    {
      id: 'klinik-sehat-bersama',
      contactId: 'klinik-sehat',
      name: 'Klinik Sehat Bersama',
      initials: 'KS',
      business: 'Healthcare clinic',
      category: 'Healthcare',
      businessType: 'Healthcare',
      type: 'Client',
      openRequestsCount: 2,
      location: 'Pematangsiantar',
      activeText: 'Active 1d ago',
      orderIndex: 3,
      requests: [
        {
          id: 'req-ks-1',
          title: 'Sistem Booking Janji Dokter & Pasien',
          category: 'Booking',
          type: 'Web App',
          budget: 'Rp 5.500.000',
          description: 'Website pendaftaran antrean dan janji temu pasien dengan dokter spesialis, lengkap dengan pengingat otomatis sebelum jadwal konsultasi.',
          tags: ['Booking', 'Antrean', 'WhatsApp Reminder']
        },
        {
          id: 'req-ks-2',
          title: 'Aplikasi Rekam Medis Ringan & Jadwal Dokter',
          category: 'Healthcare',
          type: 'Web App',
          budget: 'Rp 7.000.000',
          description: 'Sistem internal staf administrasi klinik untuk mengelola riwayat kunjungan pasien dan jadwal dokter jaga.',
          tags: ['Dashboard', 'Internal System', 'Security']
        }
      ]
    },
    {
      id: 'toko-sinar-jaya',
      contactId: 'sinar-jaya',
      name: 'Toko Sinar Jaya',
      initials: 'SJ',
      business: 'Building materials',
      category: 'Building materials',
      businessType: 'Building materials',
      type: 'Client',
      openRequestsCount: 1,
      location: 'Medan',
      activeText: 'Active 2d ago',
      orderIndex: 4,
      requests: [
        {
          id: 'req-sj-1',
          title: 'Aplikasi Manajemen Stok Material & Surat Jalan',
          category: 'Inventory',
          type: 'Web App',
          budget: 'Rp 5.000.000',
          description: 'Aplikasi gudang bahan bangunan untuk mencatat semen, besi, keramik masuk dan keluar serta cetak surat jalan pengiriman ke proyek pembeli.',
          tags: ['Inventory', 'Surat Jalan', 'Cetak PDF']
        }
      ]
    },
    {
      id: 'maria-nainggolan',
      contactId: 'maria',
      name: 'Maria Nainggolan',
      initials: 'MN',
      business: 'Homestay — Hospitality',
      category: 'Hospitality',
      businessType: 'Hospitality',
      type: 'Client',
      openRequestsCount: 1,
      location: 'Toba',
      activeText: 'Active 3d ago',
      orderIndex: 5,
      requests: [
        {
          id: 'req-mn-1',
          title: 'Website Reservasi Kamar Danau Toba & Payment Gateway',
          category: 'Booking',
          type: 'Website',
          budget: 'Rp 4.200.000',
          description: 'Website showcase penginapan tepi Danau Toba dengan kalender ketersediaan kamar, galeri foto pemandangan, dan pembayaran instan QRIS/Transfer.',
          tags: ['Hospitality', 'Midtrans', 'Kalender Booking']
        }
      ]
    },
    {
      id: 'cv-maju-bersama',
      contactId: 'maju-bersama',
      name: 'CV Maju Bersama',
      initials: 'MB',
      business: 'Distribution',
      category: 'Distribution',
      businessType: 'Distribution',
      type: 'Client',
      openRequestsCount: 2,
      location: 'Binjai',
      activeText: 'Active 4d ago',
      orderIndex: 6,
      requests: [
        {
          id: 'req-mb-1',
          title: 'Sistem Tracking Kurir & Pengiriman Barang',
          category: 'Logistics',
          type: 'Web App',
          budget: 'Rp 8.000.000',
          description: 'Aplikasi tracking rute pengiriman armada truk distribusi barang konsumsi untuk toko grosir di Sumatera Utara.',
          tags: ['Tracking', 'GPS', 'Distribusi']
        },
        {
          id: 'req-mb-2',
          title: 'Portal B2B Order & Invoice Otomatis',
          category: 'E-Commerce',
          type: 'Web App',
          budget: 'Rp 6.500.000',
          description: 'Portal pemesanan khusus toko retail langganan untuk repeat order barang tanpa harus chat manual.',
          tags: ['B2B', 'Invoicing', 'Order Portal']
        }
      ]
    },
    {
      id: 'budi-santoso',
      contactId: 'budi',
      name: 'Budi Santoso',
      initials: 'BS',
      business: 'Santoso Logistics — Ekspedisi',
      category: 'Distribution',
      businessType: 'Distribution',
      type: 'Client',
      openRequestsCount: 1,
      location: 'Medan',
      activeText: 'Active 5d ago',
      orderIndex: 7,
      requests: [
        {
          id: 'req-bs-1',
          title: 'Cek Ongkir & Pelacakan Resi Ekspedisi Lokal',
          category: 'Logistics',
          type: 'Website',
          budget: 'Rp 3.800.000',
          description: 'Widget kalkulator ongkos kirim antar-kabupaten di Sumut dan formulir tracking no resi untuk konsumen.',
          tags: ['Cek Ongkir', 'Resi', 'Logistik']
        }
      ]
    },
    {
      id: 'dewi-lestari',
      contactId: 'dewi',
      name: 'Dewi Lestari',
      initials: 'DL',
      business: 'Aroma Bakery — Café',
      category: 'Café',
      businessType: 'Café / F&B',
      type: 'Client',
      openRequestsCount: 2,
      location: 'Pematangsiantar',
      activeText: 'Active 6d ago',
      orderIndex: 8,
      requests: [
        {
          id: 'req-dl-1',
          title: 'Pre-order Kue Ulang Tahun & Custom Cake Builder',
          category: 'E-Commerce',
          type: 'Web App',
          budget: 'Rp 4.000.000',
          description: 'Form interaktif pemesanan kue ulang tahun dengan pilihan rasa, ukuran, ucapan, dan tanggal antar.',
          tags: ['Custom Cake', 'Pre-order', 'F&B']
        }
      ]
    },
    {
      id: 'pt-prima-solusindo',
      contactId: 'prima',
      name: 'PT Prima Solusindo',
      initials: 'PS',
      business: 'Konsultan Bisnis & Legal',
      category: 'Services',
      businessType: 'Services',
      type: 'Client',
      openRequestsCount: 0,
      location: 'Bandung',
      activeText: 'Active 1w ago',
      orderIndex: 9,
      requests: []
    },
    {
      id: 'hendra-wijaya',
      contactId: 'hendra',
      name: 'Hendra Wijaya',
      initials: 'HW',
      business: 'Wijaya Auto Parts — Retail',
      category: 'Retail',
      businessType: 'Retail / Fashion',
      type: 'Client',
      openRequestsCount: 1,
      location: 'Jakarta',
      activeText: 'Active 1w ago',
      orderIndex: 10,
      requests: [
        {
          id: 'req-hw-1',
          title: 'Katalog Sparepart Mobil & Filter Seri Kendaraan',
          category: 'E-Commerce',
          type: 'Web App',
          budget: 'Rp 6.000.000',
          description: 'Pencarian sparepart berdasarkan merk mobil, tahun keluaran, dan nomor seri onderdil.',
          tags: ['Catalog', 'Search Filter', 'Sparepart']
        }
      ]
    },
    {
      id: 'rina-susanti',
      contactId: 'rina',
      name: 'Rina Susanti',
      initials: 'RS',
      business: 'Klinik Gigi Harmoni — Healthcare',
      category: 'Healthcare',
      businessType: 'Healthcare',
      type: 'Client',
      openRequestsCount: 1,
      location: 'Surabaya',
      activeText: 'Active 2w ago',
      orderIndex: 11,
      requests: [
        {
          id: 'req-rs-1',
          title: 'Reservasi Pasien Dokter Gigi & Reminder WhatsApp',
          category: 'Booking',
          type: 'Website',
          budget: 'Rp 4.500.000',
          description: 'Sistem booking perawatan gigi (scaling, tambal, behel) dengan pemilihan jam senggang dokter.',
          tags: ['Booking', 'Klinik Gigi', 'WhatsApp']
        }
      ]
    },
    {
      id: 'toko-emas-berkah',
      contactId: 'emas-berkah',
      name: 'Toko Emas Berkah',
      initials: 'TE',
      business: 'Perhiasan & Retail',
      category: 'Retail',
      businessType: 'Retail / Fashion',
      type: 'Client',
      openRequestsCount: 0,
      location: 'Yogyakarta',
      activeText: 'Active 2w ago',
      orderIndex: 12,
      requests: []
    }
  ];

  // State
  let searchQuery = '';
  let searchScope = 'all';
  let selectedBusinessType = 'all';
  let selectedLocation = 'all';
  let hasOpenRequestsOnly = true; // Enabled by default per PDF design (solid dark pill)
  let sortOrder = 'newest';
  let favoriteIds = getSavedFavorites();

  // Elements
  const searchInput = document.getElementById('clientSearchInput');
  const topSearchInput = document.getElementById('topSearchInput');
  const searchScopeSelect = document.getElementById('searchScopeSelect');
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

  // Helpers
  function getSavedFavorites() {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored !== null) {
        const data = JSON.parse(stored);
        return Array.isArray(data) ? data : [];
      }
      const defaultFavs = ['jessica-sitorus', 'klinik-sehat-bersama'];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(defaultFavs));
      return defaultFavs;
    } catch (e) {
      return ['jessica-sitorus', 'klinik-sehat-bersama'];
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
      if (sortOrder === 'newest') {
        return a.orderIndex - b.orderIndex;
      } else {
        return b.orderIndex - a.orderIndex;
      }
    });
  }

  // Render Client Cards
  function renderClients() {
    const clients = getFilteredClients();

    if (clients.length === 0) {
      clientsGrid.innerHTML = '';
      emptyState.classList.add('show');
    } else {
      emptyState.classList.remove('show');
      clientsGrid.innerHTML = clients.map(client => {
        const isFav = favoriteIds.includes(client.id);
        const reqText = client.openRequestsCount === 1 ? '1 open request' : `${client.openRequestsCount} open requests`;

        return `
          <article class="client-card" data-client-id="${escapeHtml(client.id)}">
            <div class="client-card-top">
              <div class="client-profile-group">
                <div class="client-avatar-badge">${escapeHtml(client.initials)}</div>
                <div class="client-name-business">
                  <h2 class="client-name-title">${escapeHtml(client.name)}</h2>
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
        clientsCountEl.textContent = '120 clients';
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
          Hubungi Klien via Chat
        </a>
        <button class="btn-dialog-close" type="button" data-close-dialog>Tutup</button>
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
        sortOrder = 'newest';
        sortNewestBtn.classList.add('active');
        sortOldestBtn.classList.remove('active');
        renderClients();
      });
      sortOldestBtn.addEventListener('click', () => {
        sortOrder = 'oldest';
        sortOldestBtn.classList.add('active');
        sortNewestBtn.classList.remove('active');
        renderClients();
      });
    }

    // Delegate Card Actions (Favorite, View Requests)
    if (clientsGrid) {
      clientsGrid.addEventListener('click', e => {
        // Favorite button
        const favBtn = e.target.closest('.btn-card-favorite');
        if (favBtn) {
          const id = favBtn.dataset.favoriteId;
          const idx = favoriteIds.indexOf(id);
          if (idx > -1) {
            favoriteIds.splice(idx, 1);
            showToast('Dihapus dari Favorites');
          } else {
            favoriteIds.push(id);
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

  // Init
  initEvents();
  renderClients();
})();
