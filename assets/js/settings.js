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
    const defaults = {
      displayName: isDeveloper ? 'Rizky Aditya' : 'Client User',
      username: isDeveloper ? 'rizkyaditya' : 'clientbiz',
      email: isDeveloper ? 'rizky.aditya@example.com' : 'client@bistrobiz.com',
      city: isDeveloper ? 'Medan' : 'Jakarta',
      country: 'Indonesia',
      bio: isDeveloper ? 'Business websites and POS systems for Indonesian SMEs. 5 years shipping Laravel + React.' : 'Looking for high quality developers to build restaurant and commerce web apps.',
      whatsapp: '6281234567890',
      whatsappConnected: true,
      googleConnected: true,
      specialty: isDeveloper ? ['Full-stack'] : [],
      skills: isDeveloper
        ? ['React', 'Next.js', 'Laravel', 'Supabase', 'Figma', 'Tailwind CSS']
        : ['Small business', 'Food & Beverage', 'E-Commerce'],
      experiences: isDeveloper
        ? [
            { title: 'Independent Developer', company: 'Freelance', period: '2022 – Present', link: '', files: [] },
            { title: 'Web Developer', company: 'Digital projects', period: '2020 – 2022', link: '', files: [] }
          ]
        : [{ title: 'Business Owner', company: 'PT Ombak Bistro Mandiri', period: 'Present', link: '', files: [] }],
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
    let shouldPersistDefaults = false;
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(storageKey);
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
          console.warn('Stored profile data is not a valid profile object.');
          return defaults;
        }
        shouldPersistDefaults = true;
      }
    } catch (e) {
      console.warn('Failed to load profile', e);
      return defaults;
    }
    if (shouldPersistDefaults) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(defaults));
      } catch (error) {
        console.warn('Unable to persist the initial profile data.', error);
      }
    }
    return defaults;
  }

  let profileData = getProfile();
  const connectionDefaults = {
    whatsappConnected: Boolean(String(profileData.whatsapp || '').replace(/\D/g, '')),
    githubConnected: Boolean(profileData.githubUsername || profileData.github || profileData.githubUrl),
    googleConnected: true,
    linkedinConnected: Boolean(profileData.linkedinUrl || profileData.linkedin)
  };
  let connectionDefaultsChanged = false;
  Object.entries(connectionDefaults).forEach(([field, defaultValue]) => {
    if (typeof profileData[field] !== 'boolean') {
      profileData[field] = defaultValue;
      connectionDefaultsChanged = true;
    }
  });
  if (connectionDefaultsChanged) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(profileData));
    } catch (error) {
      console.warn('Unable to persist connected app status defaults.', error);
    }
  }

  let profileSkills = [];
  let isEditingSkills = false;
  let experienceDraft = [];
  let nextExperienceId = 0;
  const skillTags = document.getElementById('settingsSkillTags');
  const skillInput = document.getElementById('settingsSkills');
  const skillEditor = document.getElementById('settingsSkillEditor');
  const skillHint = document.getElementById('settingsSkillsHint');
  const skillActions = document.getElementById('settingsSkillsActions');
  const editSkillsButton = document.getElementById('editProfileSkills');
  const experienceEntries = document.getElementById('settingsExperienceEntries');

  function normalizeSkills(value, fallback) {
    if (Array.isArray(value)) {
      return [...new Map(value.map(skill => String(skill).trim()).filter(Boolean)
        .map(skill => [skill.toLowerCase(), skill])).values()];
    }
    if (typeof value === 'string') {
      const skills = value.split(/[,\n]/).map(skill => skill.trim()).filter(Boolean);
      return skills.length ? [...new Map(skills.map(skill => [skill.toLowerCase(), skill])).values()] : fallback;
    }
    return fallback;
  }

  function renderSkillTags() {
    if (!skillTags) return;
    skillTags.innerHTML = profileSkills.map((skill, index) =>
      `<span class="settings-skill-tag"><span class="settings-skill-value">${escapeHtml(skill)}</span>${isEditingSkills ? `<button type="button" data-remove-skill="${index}" aria-label="Remove skill">×</button>` : ''}</span>`
    ).join('');
    if (!profileSkills.length && !isEditingSkills) {
      skillTags.innerHTML = '<span class="settings-skill-empty">No skills added yet.</span>';
    }
  }

  function setSkillsEditing(editing) {
    isEditingSkills = editing;
    skillInput.hidden = !editing;
    skillHint.hidden = !editing;
    skillActions.hidden = !editing;
    skillEditor.classList.toggle('is-editing', editing);
    editSkillsButton.querySelector('span').textContent = editing ? 'Cancel' : 'Edit';
    editSkillsButton.querySelector('svg').hidden = editing;
    renderSkillTags();
    if (editing) skillInput.focus();
  }

  function addProfileSkill(value) {
    const skill = value.trim().replace(/,+$/, '').trim();
    if (!skill || profileSkills.some(existing => existing.toLowerCase() === skill.toLowerCase())) return;
    profileSkills.push(skill);
    renderSkillTags();
  }

  function renderExperienceEntries() {
    if (!experienceEntries) return;
    experienceEntries.innerHTML = experienceDraft.map((entry, index) => `
      <fieldset class="settings-experience-entry" data-experience-id="${entry.id}">
        <div class="settings-experience-entry-heading"><b>Experience <span>${index + 1}</span></b>${entry.editing
          ? `<button class="settings-experience-remove" type="button" data-remove-experience="${entry.id}" aria-label="Remove experience ${index + 1}" title="Remove experience"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2m3 0-.9 14H5.9L5 6"/><path d="M10 11v5m4-5v5"/></svg></button>`
          : `<button class="settings-experience-edit" type="button" data-edit-experience="${entry.id}">Edit</button>`}</div>
        <div class="settings-experience-fields">
          <label class="settings-field"><span class="settings-label"><span>Job title</span><span class="settings-required-mark" aria-hidden="true">*</span></span><input class="settings-input" data-experience-field="title" aria-describedby="settingsExperienceError" maxlength="80" placeholder="e.g. Frontend Developer" value="${escapeHtml(entry.title)}"${entry.editing ? '' : ' disabled'} required></label>
          <label class="settings-field"><span class="settings-label"><span>Company</span><span class="settings-required-mark" aria-hidden="true">*</span></span><input class="settings-input" data-experience-field="company" aria-describedby="settingsExperienceError" maxlength="80" placeholder="Company name" value="${escapeHtml(entry.company)}"${entry.editing ? '' : ' disabled'} required></label>
          <label class="settings-field"><span class="settings-label"><span>Period</span><span class="settings-required-mark" aria-hidden="true">*</span></span><input class="settings-input" data-experience-field="period" aria-describedby="settingsExperienceError" maxlength="60" placeholder="e.g. 2022 – Present" value="${escapeHtml(entry.period)}"${entry.editing ? '' : ' disabled'} required></label>
          <label class="settings-field"><span class="settings-label"><span>Portfolio link</span><small>(Optional)</small></span><input class="settings-input" data-experience-field="link" type="url" placeholder="https://example.com" value="${escapeHtml(entry.link)}"${entry.editing ? '' : ' disabled'}></label>
          <label class="settings-field span-2"><span class="settings-label"><span>Upload supporting files</span><small>(Optional)</small></span><input class="settings-input" data-experience-file type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" multiple${entry.editing ? '' : ' disabled'}><span class="settings-hint settings-experience-files${entry.files.length?' settings-experience-file-value':''}">${escapeHtml(entry.files.join(', ') || 'PDF, DOC, DOCX, JPG, or PNG')}</span></label>
        </div>
      </fieldset>`
    ).join('');
  }

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
    const defaultSkills = isDeveloper
      ? ['React', 'Next.js', 'Laravel', 'Supabase', 'Figma', 'Tailwind CSS']
      : ['Small business', 'Food & Beverage', 'E-Commerce'];
    const defaultExperiences = isDeveloper
      ? [
          { title: 'Independent Developer', company: 'Freelance', period: '2022 – Present', link: '', files: [] },
          { title: 'Web Developer', company: 'Digital projects', period: '2020 – 2022', link: '', files: [] }
        ]
      : [{ title: 'Business Owner', company: profileData.companyName || 'Independent', period: 'Present', link: '', files: [] }];

    setVal('settingsDisplayName', profileData.displayName);
    setVal('settingsUsername', profileData.username || 'user');
    setVal('settingsEmail', profileData.email || 'user@example.com');
    setVal('settingsCity', profileData.city || 'Medan');
    setVal('settingsBio', profileData.bio || '');
    setVal('settingsWhatsapp', profileData.whatsapp || '');
    profileSkills = normalizeSkills(profileData.skills, defaultSkills);
    renderSkillTags();
    experienceDraft = (Array.isArray(profileData.experiences) ? profileData.experiences : defaultExperiences)
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        id: String(++nextExperienceId),
        title: String(item.title || ''),
        company: String(item.company || ''),
        period: String(item.period || ''),
        link: String(item.link || ''),
        files: Array.isArray(item.files) ? item.files.map(String) : []
      }));
    renderExperienceEntries();

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

    setAvatar(userAvatarEl, profileData.avatar, initials);
    if (topUserNameEl) topUserNameEl.textContent = name;
    setAvatar(settingsAvatarPreview, profileData.avatar, initials);
  }

  function setAvatar(element, imageUrl, initials) {
    if (!element) return;
    const validImage = typeof imageUrl === 'string' && /^data:image\/(?:jpeg|png);base64,/.test(imageUrl);
    if (!validImage) {
      element.textContent = initials;
      return;
    }

    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    element.replaceChildren(image);
  }

  function compressAvatar(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try {
          const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
          if (!largestSide || largestSide > 10000 || image.naturalWidth * image.naturalHeight > 40000000) {
            throw new Error('Choose a valid image with dimensions under 10,000 pixels per side.');
          }

          const scale = Math.min(1, 512 / largestSide);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Image processing is not available in this browser.');

          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('The selected file could not be opened as an image.'));
      };
      image.src = objectUrl;
    });
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
        renderAppConnection('WhatsApp', profileData.whatsappConnected ?? Boolean(profileData.whatsapp));
        renderAppConnection('Google', profileData.googleConnected ?? true);
      } catch (err) {
        showToast('Error saving profile changes');
      }
    });
  }

  const profileDetailsForm = document.getElementById('profileDetailsForm');
  if (profileDetailsForm) {
    const experienceError = document.getElementById('settingsExperienceError');
    profileDetailsForm.addEventListener('submit', event => event.preventDefault());

    editSkillsButton.addEventListener('click', () => {
      if (isEditingSkills) {
        profileSkills = normalizeSkills(profileData.skills, []);
        skillInput.value = '';
        setSkillsEditing(false);
        return;
      }
      setSkillsEditing(true);
    });

    document.getElementById('saveProfileSkills').addEventListener('click', () => {
      addProfileSkill(skillInput.value);
      skillInput.value = '';
      try {
        profileData.skills = [...profileSkills];
        localStorage.setItem(storageKey, JSON.stringify(profileData));
        setSkillsEditing(false);
        showToast('Skills & Tech Stacks saved successfully!');
      } catch (error) {
        console.error('Unable to save profile skills.', error);
        showToast('Unable to save skills. Please try again.');
      }
    });

    document.getElementById('saveProfileExperience').addEventListener('click', () => {
      const incompleteExperience = experienceDraft.find(entry =>
        !entry.title.trim() || !entry.company.trim() || !entry.period.trim()
      );
      if (incompleteExperience) {
        const entryError = window.devMatchI18n?.getLanguage() === 'id'
          ? 'Lengkapi jabatan, perusahaan, dan periode untuk setiap pengalaman.'
          : 'Enter a job title, company, and period for each experience.';
        experienceError.textContent = entryError;
        experienceError.hidden = false;
        if (!incompleteExperience.editing) {
          incompleteExperience.editing = true;
          renderExperienceEntries();
        }
        const entryElement = experienceEntries.querySelector(`[data-experience-id="${incompleteExperience.id}"]`);
        const titleInput = entryElement.querySelector('[data-experience-field="title"]');
        const companyInput = entryElement.querySelector('[data-experience-field="company"]');
        const periodInput = entryElement.querySelector('[data-experience-field="period"]');
        titleInput.setAttribute('aria-invalid', String(!incompleteExperience.title.trim()));
        companyInput.setAttribute('aria-invalid', String(!incompleteExperience.company.trim()));
        periodInput.setAttribute('aria-invalid', String(!incompleteExperience.period.trim()));
        [titleInput, companyInput, periodInput].find(input => input.getAttribute('aria-invalid') === 'true').focus();
        return;
      }

      experienceError.textContent = '';
      experienceError.hidden = true;
      try {
        const savedExperiences = experienceDraft.map(({ title, company, period, link, files }) => ({
          title: title.trim(),
          company: company.trim(),
          period: period.trim(),
          link: link.trim(),
          files: [...files]
        }));
        profileData.experiences = savedExperiences;
        localStorage.setItem(storageKey, JSON.stringify(profileData));
        experienceDraft = savedExperiences.map((entry, index) => ({
          ...entry,
          id: String(index + 1),
          editing: false
        }));
        nextExperienceId = experienceDraft.length;
        renderExperienceEntries();
        showToast('Experience saved successfully!');
      } catch (error) {
        console.error('Unable to save profile experience.', error);
        showToast('Unable to save experience. Please try again.');
      }
    });

    skillInput.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        addProfileSkill(skillInput.value);
        skillInput.value = '';
      } else if (event.key === 'Backspace' && !skillInput.value && profileSkills.length) {
        profileSkills.pop();
        renderSkillTags();
      }
    });

    skillTags.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-skill]');
      if (!button || !isEditingSkills) return;
      profileSkills.splice(Number(button.dataset.removeSkill), 1);
      renderSkillTags();
      skillInput.focus();
    });

    document.getElementById('addProfileExperience').addEventListener('click', () => {
      experienceDraft.push({ id: String(++nextExperienceId), title: '', company: '', period: '', link: '', files: [], editing: true });
      renderExperienceEntries();
      const lastEntry = experienceEntries.lastElementChild;
      lastEntry.querySelector('[data-experience-field="title"]').focus();
    });

    experienceEntries.addEventListener('click', event => {
      const editButton = event.target.closest('[data-edit-experience]');
      if (editButton) {
        const entry = experienceDraft.find(item => item.id === editButton.dataset.editExperience);
        if (!entry) return;
        entry.editing = true;
        renderExperienceEntries();
        experienceEntries.querySelector(`[data-experience-id="${entry.id}"] [data-experience-field="title"]`).focus();
        return;
      }

      const button = event.target.closest('[data-remove-experience]');
      if (!button) return;
      experienceDraft = experienceDraft.filter(entry => entry.id !== button.dataset.removeExperience);
      nextExperienceId = experienceDraft.reduce((max, entry) => Math.max(max, Number(entry.id) || 0), 0);
      renderExperienceEntries();
    });

    experienceEntries.addEventListener('input', event => {
      const input = event.target.closest('[data-experience-field]');
      if (!input) return;
      const entry = experienceDraft.find(item => item.id === input.closest('[data-experience-id]').dataset.experienceId);
      if (entry) entry[input.dataset.experienceField] = input.value;
      if (input.value.trim()) input.removeAttribute('aria-invalid');
      if (experienceError.hidden) return;
      experienceError.textContent = '';
      experienceError.hidden = true;
    });

    experienceEntries.addEventListener('change', event => {
      const input = event.target.closest('[data-experience-file]');
      if (!input) return;
      const entry = experienceDraft.find(item => item.id === input.closest('[data-experience-id]').dataset.experienceId);
      if (!entry) return;
      entry.files = Array.from(input.files || []).map(file => file.name);
      const fileNames = input.nextElementSibling;
      fileNames.textContent = entry.files.join(', ') || 'PDF, DOC, DOCX, JPG, or PNG';
      fileNames.classList.toggle('settings-experience-file-value', entry.files.length > 0);
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

  const appConnectionFields = {
    WhatsApp: 'whatsappConnected',
    GitHub: 'githubConnected',
    Google: 'googleConnected',
    LinkedIn: 'linkedinConnected'
  };

  const appDetailText = {
    WhatsApp: profile => formatWhatsapp(profile.whatsapp || ''),
    GitHub: profile => profile.githubUsername || 'GitHub account connected',
    Google: profile => profile.googleEmail || profile.email || 'Google account connected',
    LinkedIn: profile => profile.linkedinUrl || 'LinkedIn profile connected'
  };

  function formatWhatsapp(value) {
    const digits = String(value).replace(/\D/g, '');
    if (!digits) return '';
    if (!digits.startsWith('62')) return value;
    const localNumber = digits.slice(2);
    const formatted = localNumber.replace(/^(\d{3})(\d{4})(\d+)$/, '$1-$2-$3');
    return `+62 ${formatted}`;
  }

  function renderAppConnection(app, connected) {
    const detail = document.querySelector(`[data-app-detail="${app}"]`);
    const editButton = document.querySelector(`[data-app-edit="${app}"]`);
    const toggleButton = document.querySelector(`[data-app-toggle="${app}"]`);
    if (detail) {
      detail.textContent = connected
        ? appDetailText[app](profileData)
        : detail.dataset.disconnectedText;
    }
    if (editButton) editButton.hidden = !connected;
    if (toggleButton) {
      toggleButton.dataset.connected = String(connected);
      toggleButton.textContent = connected ? 'Connected' : 'Connect';
      toggleButton.classList.toggle('primary', connected);
    }
  }

  document.querySelectorAll('[data-app-toggle]').forEach(btn => {
    const field = appConnectionFields[btn.dataset.appToggle];
    const connected = field && typeof profileData[field] === 'boolean'
      ? profileData[field]
      : btn.dataset.connected === 'true';
    renderAppConnection(btn.dataset.appToggle, connected);
  });

  // Password Change Simulation
  const passwordForm = document.getElementById('passwordForm');
  if (passwordForm) {
    const newPasswordInput = document.getElementById('newPassword');
    const passwordMeter = document.getElementById('newPasswordMeter');
    const passwordStrengthText = document.getElementById('newPasswordStrengthText');
    const passwordRequirementItems = Array.from(document.querySelectorAll('[data-password-requirement]'));
    const newPasswordRequirements = [
      {
        id: 'length',
        passes: value => value.length >= 8,
        message: 'Password needs at least 8 characters.'
      },
      {
        id: 'uppercase',
        passes: value => /[A-Z]/.test(value),
        message: 'Password needs at least one uppercase letter.'
      },
      {
        id: 'special',
        passes: value => /[^A-Za-z0-9]/.test(value),
        message: 'Password needs at least one special character, such as ! or #.'
      }
    ];

    function updatePasswordStrength(value) {
      const score = value
        ? Math.max(1, [
            value.length >= 8,
            /[a-z]/.test(value) && /[A-Z]/.test(value),
            /\d/.test(value),
            /[^A-Za-z0-9]/.test(value) || value.length >= 14
          ].filter(Boolean).length)
        : 0;
      const strength = ['', 'weak', 'fair', 'good', 'strong'][score];
      const labels = ['', 'Weak password', 'Fair password', 'Good password', 'Strong password'];

      passwordMeter.className = `password-strength-meter${strength ? ` ${strength}` : ''}`;
      Array.from(passwordMeter.children).forEach((bar, index) => {
        bar.classList.toggle('on', index < score);
      });
      passwordStrengthText.textContent = labels[score] || 'Password strength will appear as you type.';
      passwordStrengthText.className = `password-strength-text${strength ? ` ${strength}` : ''}`;

      passwordRequirementItems.forEach(item => {
        const requirement = newPasswordRequirements.find(rule => rule.id === item.dataset.passwordRequirement);
        item.classList.toggle('met', requirement.passes(value));
      });
    }

    const passwordFields = [
      {
        input: document.getElementById('currentPassword'),
        error: document.getElementById('currentPasswordError'),
        validate: value => value ? '' : 'Please enter your current password.'
      },
      {
        input: newPasswordInput,
        error: document.getElementById('newPasswordError'),
        validate: value => {
          if (!value) return 'Please enter a new password.';
          const unmetRequirement = newPasswordRequirements.find(rule => !rule.passes(value));
          if (unmetRequirement) return unmetRequirement.message;
          return '';
        }
      },
      {
        input: document.getElementById('confirmPassword'),
        error: document.getElementById('confirmPasswordError'),
        validate: value => {
          if (!value) return 'Please confirm your new password.';
          if (value !== document.getElementById('newPassword').value) return 'The passwords do not match.';
          return '';
        }
      }
    ];

    function validatePasswordField(field) {
      const message = field.validate(field.input.value);
      field.error.textContent = message;
      field.error.hidden = !message;
      field.input.setAttribute('aria-invalid', String(Boolean(message)));
      return !message;
    }

    passwordFields.forEach(field => {
      field.input.addEventListener('input', () => {
        if (field.input === newPasswordInput) updatePasswordStrength(field.input.value);
        if (!field.error.hidden) validatePasswordField(field);
        if (field.input.id === 'newPassword') {
          const confirmField = passwordFields[2];
          if (!confirmField.error.hidden) validatePasswordField(confirmField);
        }
      });
    });

    passwordForm.addEventListener('passwordchange:rejected', () => {
      const currentPasswordField = passwordFields[0];
      currentPasswordField.error.textContent = 'Current password is incorrect.';
      currentPasswordField.error.hidden = false;
      currentPasswordField.input.setAttribute('aria-invalid', 'true');
      currentPasswordField.input.focus();
    });

    passwordForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const isValid = passwordFields.map(validatePasswordField).every(Boolean);
      if (!isValid) {
        const firstInvalidField = passwordFields.find(field => field.input.getAttribute('aria-invalid') === 'true');
        firstInvalidField.input.focus();
        return;
      }

      showToast('Password updated successfully!');
      passwordForm.reset();
      updatePasswordStrength('');
      passwordFields.forEach(field => {
        field.error.hidden = true;
        field.error.textContent = '';
        field.input.removeAttribute('aria-invalid');
      });
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
  const interfaceLanguageSelect = document.getElementById('settingLanguage');
  if (interfaceLanguageSelect && window.devMatchI18n) {
    interfaceLanguageSelect.value = window.devMatchI18n.getLanguage();
  }

  if (preferencesForm) {
    preferencesForm.addEventListener('submit', function(e) {
      e.preventDefault();
      if (interfaceLanguageSelect && window.devMatchI18n) {
        try {
          window.devMatchI18n.setLanguage(interfaceLanguageSelect.value);
        } catch (error) {
          console.error('Unable to save interface language preference.', error);
          showToast('Unable to save language preference. Please try again.');
          return;
        }
      }
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

  let pendingDisconnect = null;
  const appDisconnectDialog = document.getElementById('appDisconnectDialog');
  const appDisconnectTitle = document.getElementById('appDisconnectTitle');
  const appDisconnectDescription = document.getElementById('appDisconnectDescription');
  const confirmAppDisconnect = document.getElementById('confirmAppDisconnect');

  // Connected Apps toggle
  document.querySelectorAll('[data-app-toggle]').forEach(btn => {
    btn.addEventListener('click', function() {
      const app = this.dataset.appToggle;
      const field = appConnectionFields[app];
      const isConnected = this.dataset.connected === 'true';

      if (isConnected) {
        pendingDisconnect = { button: this, field, app };
        appDisconnectTitle.textContent = `Disconnect ${app}?`;
        appDisconnectDescription.textContent = `This will disconnect ${app} from your DEV-MATCH account.`;
        appDisconnectDialog.showModal();
      } else {
        updateAppConnection(this, field, true, app);
      }
    });
  });

  confirmAppDisconnect.addEventListener('click', () => {
    if (!pendingDisconnect) return;
    const { button, field, app } = pendingDisconnect;
    if (updateAppConnection(button, field, false, app)) {
      pendingDisconnect = null;
      appDisconnectDialog.close();
    }
  });

  document.getElementById('cancelAppDisconnect').addEventListener('click', () => {
    pendingDisconnect = null;
    appDisconnectDialog.close();
  });

  appDisconnectDialog.addEventListener('click', event => {
    if (event.target === appDisconnectDialog) {
      pendingDisconnect = null;
      appDisconnectDialog.close();
    }
  });

  appDisconnectDialog.addEventListener('close', () => {
    pendingDisconnect = null;
  });

  function updateAppConnection(button, field, connected, app) {
    if (!field) {
      console.error(`No profile connection field is configured for ${app}.`);
      showToast(`Could not update ${app} connection.`);
      return false;
    }

    const updatedProfile = { ...profileData, [field]: connected };
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedProfile));
    } catch (error) {
      console.error(`Unable to save ${app} connection status.`, error);
      showToast(`Could not save ${app} connection status.`);
      return false;
    }

    profileData = updatedProfile;
    renderAppConnection(app, connected);
    showToast(connected ? `Connected ${app} successfully` : `Disconnected ${app}`);
    return true;
  }

  const appEditDialog = document.getElementById('appEditDialog');
  const appEditForm = document.getElementById('appEditForm');
  const appEditTitle = document.getElementById('appEditTitle');
  const appEditDescription = document.getElementById('appEditDescription');
  const appEditLabel = document.getElementById('appEditLabel');
  const appEditValue = document.getElementById('appEditValue');
  appEditValue.addEventListener('input', () => appEditValue.setCustomValidity(''));
  let editingApp = '';
  const appEditConfig = {
    WhatsApp: {
      title: 'Edit WhatsApp number',
      description: 'Update the phone number connected to WhatsApp Business.',
      label: 'WhatsApp number',
      type: 'tel',
      placeholder: '+62 812-3456-7890',
      getValue: profile => profile.whatsapp || '',
      save: value => ({ whatsapp: value.replace(/\D/g, ''), whatsappConnected: true }),
      validate: value => {
        const digits = value.replace(/\D/g, '');
        return digits.length >= 8 && digits.length <= 15
          ? ''
          : 'Enter a valid phone number with 8 to 15 digits.';
      }
    },
    Google: {
      title: 'Edit Google account',
      description: 'Update the email address connected to your Google account.',
      label: 'Google account email',
      type: 'email',
      placeholder: 'name@example.com',
      getValue: profile => profile.googleEmail || profile.email || '',
      save: value => ({ googleEmail: value.trim(), googleConnected: true }),
      validate: () => ''
    },
    GitHub: {
      title: 'Edit GitHub account',
      description: 'Update the username connected to your GitHub account.',
      label: 'GitHub username',
      type: 'text',
      placeholder: 'username',
      getValue: profile => profile.githubUsername || '',
      save: value => ({ githubUsername: value.trim().replace(/^@/, ''), githubConnected: true }),
      validate: value => /^[A-Za-z0-9-]{1,39}$/.test(value.trim().replace(/^@/, ''))
        ? ''
        : 'Enter a valid GitHub username.'
    },
    LinkedIn: {
      title: 'Edit LinkedIn profile',
      description: 'Update the profile URL connected to LinkedIn.',
      label: 'LinkedIn profile URL',
      type: 'url',
      placeholder: 'https://www.linkedin.com/in/username',
      getValue: profile => profile.linkedinUrl || '',
      save: value => ({ linkedinUrl: value.trim(), linkedinConnected: true }),
      validate: value => {
        try {
          const url = new URL(value.trim());
          return url.protocol === 'https:' && /(^|\.)linkedin\.com$/i.test(url.hostname)
            ? ''
            : 'Enter an HTTPS LinkedIn profile URL.';
        } catch (error) {
          return 'Enter a valid LinkedIn profile URL.';
        }
      }
    }
  };

  document.querySelectorAll('[data-app-edit]').forEach(button => {
    button.addEventListener('click', () => {
      editingApp = button.dataset.appEdit;
      const config = appEditConfig[editingApp];
      if (!config || !appEditDialog || !appEditValue) return;
      appEditTitle.textContent = config.title;
      appEditDescription.textContent = config.description;
      appEditLabel.textContent = config.label;
      appEditValue.type = config.type;
      appEditValue.placeholder = config.placeholder;
      appEditValue.value = config.getValue(profileData);
      appEditValue.setCustomValidity('');
      appEditDialog.showModal();
      appEditValue.focus();
    });
  });

  if (appEditForm) {
    appEditForm.addEventListener('submit', event => {
      event.preventDefault();
      const config = appEditConfig[editingApp];
      if (!config || !appEditValue) return;
      const value = appEditValue.value.trim();
      const validationMessage = config.validate(value);
      appEditValue.setCustomValidity(validationMessage);
      if (!appEditForm.reportValidity()) return;

      const updatedProfile = { ...profileData, ...config.save(value) };
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedProfile));
      } catch (error) {
        console.error(`Unable to save ${editingApp} account details.`, error);
        showToast(`Could not save ${editingApp} account details.`);
        return;
      }

      profileData = updatedProfile;
      renderAppConnection(editingApp, true);
      if (editingApp === 'WhatsApp') {
        const whatsappField = document.getElementById('settingsWhatsapp');
        if (whatsappField) whatsappField.value = profileData.whatsapp;
      }
      appEditDialog.close();
      showToast(`${editingApp} account details updated.`);
    });
  }

  if (appEditDialog) {
    appEditDialog.addEventListener('click', event => {
      if (event.target === appEditDialog) appEditDialog.close();
    });
    document.getElementById('cancelAppEdit').addEventListener('click', () => appEditDialog.close());
  }

  // Upload and save profile avatar
  const changeAvatarBtn = document.getElementById('changeAvatarBtn');
  const avatarUpload = document.getElementById('avatarUpload');
  const avatarMenu = document.getElementById('avatarMenu');
  const avatarMenuOptions = document.getElementById('avatarMenuOptions');
  const chooseAvatarBtn = document.getElementById('chooseAvatarBtn');
  const resetAvatarBtn = document.getElementById('resetAvatarBtn');
  let avatarMenuCloseTimer;

  function setAvatarMenuOpen(open) {
    if (!changeAvatarBtn || !avatarMenuOptions) return;
    clearTimeout(avatarMenuCloseTimer);
    changeAvatarBtn.setAttribute('aria-expanded', String(open));
    avatarMenuOptions.setAttribute('aria-hidden', String(!open));
    avatarMenuOptions.inert = !open;

    if (open) {
      avatarMenuOptions.hidden = false;
      requestAnimationFrame(() => avatarMenuOptions.classList.add('is-open'));
      return;
    }

    avatarMenuOptions.classList.remove('is-open');
    avatarMenuCloseTimer = setTimeout(() => {
      if (changeAvatarBtn.getAttribute('aria-expanded') === 'false') {
        avatarMenuOptions.hidden = true;
      }
    }, 180);
  }

  if (changeAvatarBtn && avatarUpload && avatarMenu && avatarMenuOptions) {
    changeAvatarBtn.addEventListener('click', () => {
      setAvatarMenuOpen(changeAvatarBtn.getAttribute('aria-expanded') !== 'true');
    });

    chooseAvatarBtn.addEventListener('click', () => {
      setAvatarMenuOpen(false);
      avatarUpload.click();
    });

    resetAvatarBtn.addEventListener('click', () => {
      const updatedProfile = { ...profileData };
      delete updatedProfile.avatar;
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedProfile));
      } catch (error) {
        console.error('Unable to reset the profile photo.', error);
        showToast('Could not reset the photo. Check available browser storage and try again.');
        setAvatarMenuOpen(false);
        return;
      }

      profileData = updatedProfile;
      updateAvatarPreview();
      setAvatarMenuOpen(false);
      showToast('Profile photo reset to default.');
    });

    document.addEventListener('click', event => {
      if (!avatarMenu.contains(event.target)) setAvatarMenuOpen(false);
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && changeAvatarBtn.getAttribute('aria-expanded') === 'true') {
        setAvatarMenuOpen(false);
        changeAvatarBtn.focus();
      }
    });

    avatarUpload.addEventListener('change', async function() {
      const file = this.files && this.files[0];
      if (!file) return;

      if (!['image/png', 'image/jpeg'].includes(file.type)) {
        showToast('Choose a PNG or JPG image.');
        this.value = '';
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        showToast('Choose an image up to 2 MB.');
        this.value = '';
        return;
      }

      changeAvatarBtn.disabled = true;
      try {
        let avatar;
        try {
          avatar = await compressAvatar(file);
        } catch (error) {
          console.error('Unable to process the uploaded profile photo.', error);
          showToast(error.message || 'The selected image could not be processed.');
          return;
        }

        const updatedProfile = { ...profileData, avatar };
        try {
          localStorage.setItem(storageKey, JSON.stringify(updatedProfile));
        } catch (error) {
          console.error('Unable to save the uploaded profile photo.', error);
          showToast('Could not save the photo. Check available browser storage and try again.');
          return;
        }
        profileData = updatedProfile;
        updateAvatarPreview();
        showToast('Profile photo updated successfully!');
      } finally {
        changeAvatarBtn.disabled = false;
        this.value = '';
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
