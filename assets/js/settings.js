(function() {
  'use strict';

  // Helper escape
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  // Determine active role (dev or client)
  const params = new URLSearchParams(window.location.search);
  const role = params.get('role') === 'client' ? 'client' : 'dev';
  const isDeveloper = role === 'dev';
  const storageKey = isDeveloper ? 'devmatch-profile-dev' : 'devmatch-profile-client';

  // Load profile from localStorage
  function getProfile() {
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(storageKey);
        if (data) return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load profile', e);
    }
    return {
      displayName: isDeveloper ? 'Rizky Aditya' : 'Client User',
      username: isDeveloper ? 'rizkyaditya' : 'clientbiz',
      email: isDeveloper ? 'rizky.aditya@example.com' : 'client@bistrobiz.com',
      city: isDeveloper ? 'Medan' : 'Jakarta',
      country: 'Indonesia',
      bio: isDeveloper ? 'Business websites and POS systems for Indonesian SMEs. 5 years shipping Laravel + React.' : 'Looking for high quality developers to build restaurant and commerce web apps.',
      whatsapp: '6281234567890',
      availability: 'Open for hiring',
      hourlyRate: 'Rp 150.000',
      minProjectPrice: 'Rp 3.500.000',
      bankName: 'BCA',
      accountNumber: '8820192841',
      accountHolder: 'Rizky Aditya',
      companyName: 'PT Ombak Bistro Mandiri',
      industry: 'Food & Beverage',
      npwp: '09.254.891.2-121.000'
    };
  }

  let profileData = getProfile();

  // Toast Helper
  const toastEl = document.getElementById('settingsToast');
  const toastTextEl = document.getElementById('settingsToastText');
  let toastTimeout = null;

  function showToast(msg) {
    if (!toastEl) return;
    clearTimeout(toastTimeout);
    toastTextEl.textContent = msg;
    toastEl.classList.add('show');
    toastTimeout = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 3500);
  }

  // DOM elements
  const navBtns = document.querySelectorAll('.settings-nav-btn');
  const panels = document.querySelectorAll('.settings-panel');
  const userAvatarEl = document.getElementById('userAvatar');
  const topUserNameEl = document.getElementById('topUserName');
  const settingsAvatarPreview = document.getElementById('settingsAvatarPreview');

  // Tab switching
  function switchTab(tabId) {
    navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    panels.forEach(panel => {
      const match = panel.id === `panel-${tabId}`;
      panel.hidden = !match;
    });

    // Update URL hash without jumping
    if (history.replaceState) {
      history.replaceState(null, '', `#${tabId}`);
    }
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Check URL Hash on load
  function initHashTab() {
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(`panel-${hash}`)) {
      switchTab(hash);
    } else {
      switchTab('account');
    }
  }

  // Populate Profile Inputs
  function populateForm() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    };

    setVal('settingsDisplayName', profileData.displayName);
    setVal('settingsUsername', profileData.username || 'user');
    setVal('settingsEmail', profileData.email || 'user@example.com');
    setVal('settingsCity', profileData.city || 'Medan');
    setVal('settingsBio', profileData.bio || '');
    setVal('settingsWhatsapp', profileData.whatsapp || '');

    if (isDeveloper) {
      setVal('settingsHourlyRate', profileData.hourlyRate || 'Rp 150.000');
      setVal('settingsMinProject', profileData.minProjectPrice || 'Rp 3.500.000');
      setVal('settingsAvailability', profileData.availability || 'Open for hiring');
      setVal('settingsBankName', profileData.bankName || 'BCA');
      setVal('settingsBankAccount', profileData.accountNumber || '8820192841');
      setVal('settingsAccountHolder', profileData.accountHolder || profileData.displayName);
    } else {
      setVal('settingsCompanyName', profileData.companyName || 'Ombak Bistro');
      setVal('settingsIndustry', profileData.industry || 'Food & Beverage');
      setVal('settingsNpwp', profileData.npwp || '');
    }

    updateAvatarPreview();
  }

  function updateAvatarPreview() {
    const name = typeof profileData.displayName === 'string' && profileData.displayName.trim()
      ? profileData.displayName.trim()
      : (isDeveloper ? 'Rizky Aditya' : 'Client');
    const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'RA';

    if (userAvatarEl) userAvatarEl.textContent = initials;
    if (topUserNameEl) topUserNameEl.textContent = name;
    if (settingsAvatarPreview) settingsAvatarPreview.textContent = initials;
  }

  // Account Form Submission
  const accountForm = document.getElementById('accountForm');
  if (accountForm) {
    accountForm.addEventListener('submit', function(e) {
      e.preventDefault();
      profileData.displayName = document.getElementById('settingsDisplayName').value.trim();
      profileData.username = document.getElementById('settingsUsername').value.trim();
      profileData.email = document.getElementById('settingsEmail').value.trim();
      profileData.city = document.getElementById('settingsCity').value.trim();
      profileData.bio = document.getElementById('settingsBio').value.trim();
      profileData.whatsapp = document.getElementById('settingsWhatsapp').value.trim().replace(/\D/g, '');

      try {
        localStorage.setItem(storageKey, JSON.stringify(profileData));
        showToast('Profile and account details saved successfully!');
        updateAvatarPreview();
      } catch (err) {
        showToast('Error saving profile changes');
      }
    });
  }

  // Role Specific Form Submission (Dev rates/payouts OR Client company/billing)
  const roleForm = document.getElementById('roleSpecificForm');
  if (roleForm) {
    roleForm.addEventListener('submit', function(e) {
      e.preventDefault();
      if (isDeveloper) {
        profileData.hourlyRate = document.getElementById('settingsHourlyRate').value.trim();
        profileData.minProjectPrice = document.getElementById('settingsMinProject').value.trim();
        profileData.availability = document.getElementById('settingsAvailability').value;
        profileData.bankName = document.getElementById('settingsBankName').value;
        profileData.accountNumber = document.getElementById('settingsBankAccount').value.trim();
        profileData.accountHolder = document.getElementById('settingsAccountHolder').value.trim();
      } else {
        profileData.companyName = document.getElementById('settingsCompanyName').value.trim();
        profileData.industry = document.getElementById('settingsIndustry').value.trim();
        profileData.npwp = document.getElementById('settingsNpwp').value.trim();
      }

      try {
        localStorage.setItem(storageKey, JSON.stringify(profileData));
        showToast(isDeveloper ? 'Developer rates & payout settings updated!' : 'Company & billing details saved!');
      } catch (err) {
        showToast('Error saving settings');
      }
    });
  }

  // Password Change Simulation
  const passwordForm = document.getElementById('passwordForm');
  if (passwordForm) {
    passwordForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const current = document.getElementById('currentPassword').value;
      const nextPass = document.getElementById('newPassword').value;
      const confirmPass = document.getElementById('confirmPassword').value;

      if (!current) {
        alert('Please enter your current password.');
        return;
      }
      if (nextPass.length < 8) {
        alert('New password must be at least 8 characters.');
        return;
      }
      if (nextPass !== confirmPass) {
        alert('New passwords do not match.');
        return;
      }

      showToast('Password updated successfully!');
      passwordForm.reset();
    });
  }

  // 2FA Switch toggle simulation
  const twoFactorToggle = document.getElementById('twoFactorToggle');
  if (twoFactorToggle) {
    twoFactorToggle.addEventListener('change', function() {
      if (this.checked) {
        showToast('Two-Factor Authentication (2FA) enabled with authenticator app.');
      } else {
        showToast('Two-Factor Authentication (2FA) disabled.');
      }
    });
  }

  // Log out other sessions
  const logoutSessionsBtn = document.getElementById('logoutSessionsBtn');
  if (logoutSessionsBtn) {
    logoutSessionsBtn.addEventListener('click', function() {
      if (confirm('Are you sure you want to log out of all other active sessions?')) {
        document.querySelectorAll('.settings-session-item:not(.current-session)').forEach(el => el.remove());
        showToast('Logged out of all other devices.');
      }
    });
  }

  // Notification Preferences Form
  const notifForm = document.getElementById('notificationsForm');
  if (notifForm) {
    notifForm.addEventListener('submit', function(e) {
      e.preventDefault();
      showToast('Notification preferences updated!');
    });
  }

  // Privacy Preferences Form
  const privacyForm = document.getElementById('privacyForm');
  if (privacyForm) {
    privacyForm.addEventListener('submit', function(e) {
      e.preventDefault();
      showToast('Privacy & visibility settings updated!');
    });
  }

  // General Platform Preferences Form
  const preferencesForm = document.getElementById('preferencesForm');
  if (preferencesForm) {
    preferencesForm.addEventListener('submit', function(e) {
      e.preventDefault();
      showToast('Platform locale and preferences saved!');
    });
  }

  // Danger Zone - Deactivate & Delete
  const deactivateBtn = document.getElementById('deactivateAccountBtn');
  if (deactivateBtn) {
    deactivateBtn.addEventListener('click', function() {
      const confirmed = prompt('To confirm deactivation, please type "DEACTIVATE":');
      if (confirmed === 'DEACTIVATE') {
        showToast('Account scheduled for deactivation.');
      } else if (confirmed) {
        alert('Confirmation text did not match. Action cancelled.');
      }
    });
  }

  const deleteAccountBtn = document.getElementById('deleteAccountBtn');
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', function() {
      const confirmed = prompt('WARNING: This will permanently delete your projects, chats, and profile. Type "DELETE PERMANENTLY" to confirm:');
      if (confirmed === 'DELETE PERMANENTLY') {
        try {
          localStorage.removeItem(storageKey);
          alert('Your account data has been wiped. Returning to landing page.');
          window.location.href = 'devmatch-landing.html';
        } catch (e) {
          window.location.href = 'devmatch-landing.html';
        }
      } else if (confirmed) {
        alert('Confirmation phrase did not match. Account was not deleted.');
      }
    });
  }

  // Connected Apps toggle
  document.querySelectorAll('[data-app-toggle]').forEach(btn => {
    btn.addEventListener('click', function() {
      const app = this.dataset.appToggle;
      const isConnected = this.dataset.connected === 'true';

      if (isConnected) {
        if (confirm(`Disconnect ${app} from your DEV-MATCH account?`)) {
          this.dataset.connected = 'false';
          this.textContent = 'Connect';
          this.classList.remove('primary');
          showToast(`Disconnected ${app}`);
        }
      } else {
        this.dataset.connected = 'true';
        this.textContent = 'Connected';
        this.classList.add('primary');
        showToast(`Connected ${app} successfully`);
      }
    });
  });

  // Change avatar dummy action
  const changeAvatarBtn = document.getElementById('changeAvatarBtn');
  if (changeAvatarBtn) {
    changeAvatarBtn.addEventListener('click', function() {
      const initials = prompt('Enter your initials for avatar (1-2 letters):', settingsAvatarPreview ? settingsAvatarPreview.textContent : 'DM');
      if (initials && initials.trim()) {
        const clean = initials.trim().slice(0, 2).toUpperCase();
        if (settingsAvatarPreview) settingsAvatarPreview.textContent = clean;
        if (userAvatarEl) userAvatarEl.textContent = clean;
        showToast('Avatar initials updated!');
      }
    });
  }

  // Setup mode links in topbar / sidebar
  function setupWorkspaceLinks() {
    document.body.classList.toggle('client-shell-page', !isDeveloper);
    if (!isDeveloper) {
      const updateNavLink = (label, href, replacementLabel = label) => {
        const link = [...document.querySelectorAll('.side-nav a')]
          .find(item => item.textContent.trim().startsWith(label));
        if (!link) return;

        link.href = href;
        const textNode = [...link.childNodes]
          .find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (textNode) textNode.textContent = ` ${replacementLabel}`;
      };

      const brand = document.querySelector('.topbar .brand');
      if (brand) brand.href = 'devmatch-client-dashboard.html';
      const userLink = document.querySelector('.topbar .user-menu');
      if (userLink) userLink.href = 'devmatch-my-profile.html?role=client';

      updateNavLink('Overview', 'devmatch-client-dashboard.html#home', 'Home');
      updateNavLink('Messages', 'devmatch-chat.html?role=client');
      updateNavLink('My Projects', 'devmatch-client-dashboard.html#requests', 'My Requests');
      updateNavLink('Find Projects', 'devmatch-discover-projects.html', 'Discover Projects');
      updateNavLink('Find Clients', 'devmatch-find-developers.html', 'Developers');
      updateNavLink('Favorites', 'devmatch-favorites.html?role=client');
      updateNavLink('Notifications', 'devmatch-notifications.html');
      updateNavLink('Profile', 'devmatch-my-profile.html?role=client');
      updateNavLink('Settings', 'devmatch-settings.html?role=client');

      const notificationsUrl = 'devmatch-notifications.html';
      document.querySelectorAll('.notification-button, .client-icon-button').forEach(link => {
        link.href = notificationsUrl;
      });
      document.querySelectorAll('.mode').forEach(m => m.classList.remove('active'));
      const clientMode = document.querySelector('.mode-switch a[href*="client"]');
      if (clientMode) clientMode.classList.add('active');

      const workspaceBadge = document.getElementById('workspaceBadge');
      if (workspaceBadge) {
        workspaceBadge.innerHTML = `<span class="workspace-icon"><svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span><span><b>Client workspace</b><small>Discover &amp; hire</small></span>`;
      }

      const sideAdd = document.querySelector('.side-add');
      if (sideAdd) {
        sideAdd.href = 'devmatch-client-dashboard.html#requests';
        sideAdd.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>Post a Request`;
      }

    }
  }

  // Initialize
  setupWorkspaceLinks();
  populateForm();
  initHashTab();

})();
