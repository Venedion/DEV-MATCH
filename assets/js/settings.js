(function() {
  'use strict';
  document.body.classList.add('devmatch-settings-loading');
  const settingsContent = document.querySelector('.settings-content');
  settingsContent?.setAttribute('inert', '');
  settingsContent?.setAttribute('aria-busy', 'true');
  const settingsMasks = {
    field: [
      '#accountForm input:not([type="hidden"]):not([type="file"])',
      '#accountForm select', '#accountForm textarea',
      '#profileDetailsForm input:not([type="hidden"]):not([type="file"])',
      '#profileDetailsForm select', '#profileDetailsForm textarea',
      '#roleSpecificForm input:not([type="hidden"]):not([type="file"])',
      '#roleSpecificForm select', '#roleSpecificForm textarea',
      '#notificationsForm select', '#privacyForm select', '#preferencesForm select'
    ],
    text: ['#settingsAvatarPreview', '#panel-integrations [data-app-detail]', '#panel-integrations [data-app-toggle]'],
    surface: ['#settingsSpecialtyGrid', '#settingsSkillTags', '#settingsExperienceEntries', '#notificationsForm .settings-switch']
  };
  Object.entries(settingsMasks).forEach(([type, selectors]) => {
    selectors.forEach(selector => document.querySelectorAll(selector).forEach(element => {
      element.setAttribute('data-devmatch-auth-mask', type);
    }));
  });

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
  const profileContact = window.DEVMATCH_PROFILE_CONTACT;
  const storageKey = isDeveloper ? 'devmatch-profile-dev' : 'devmatch-profile-client';
  let privateProfileFieldsLoaded = false;

  function configureRoleSpecificSettings() {
    document.getElementById('developerSpecificFields').hidden = !isDeveloper;
    document.getElementById('clientSpecificFields').hidden = isDeveloper;
    document.getElementById('settingsWebsiteField').hidden = !isDeveloper;
    document.getElementById('roleTabLabel').textContent = isDeveloper ? 'Rates & Payouts' : 'Company & Billing';
    document.getElementById('roleHeaderTitle').textContent = isDeveloper ? 'Developer Rates & Payout Settings' : 'Client Company & Billing Settings';
    document.getElementById('roleHeaderDesc').textContent = isDeveloper
      ? 'Configure your baseline pricing, accepted engagements, and bank payout details.'
      : 'Manage your business profile and billing information.';
    document.getElementById('settingsSkillsHeading').textContent = isDeveloper ? 'Skills & Tech Stacks' : 'Preferred Skills & Technology';
    document.getElementById('settingsSkillsDescription').textContent = isDeveloper
      ? 'Update the skills shown on your public profile.'
      : 'Update the skills or technologies you prefer for your project.';
    document.getElementById('editProfileSkills').setAttribute('aria-label', isDeveloper ? 'Edit Skills & Tech Stacks' : 'Edit Preferred Skills & Technology');
    document.getElementById('settingsSpecialtyCard').hidden = !isDeveloper;
    document.getElementById('settingsSkillsCard').hidden = !isDeveloper;
    document.getElementById('settingsExperienceCard').hidden = !isDeveloper;
  }

  configureRoleSpecificSettings();

  // Load profile from localStorage
  function getProfile() {
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(storageKey);
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
          console.warn('Stored profile data is not a valid profile object.');
        }
      }
    } catch (e) {
      console.warn('Failed to load profile', e);
    }
    return {};
  }

  let profileData = getProfile();
  function applyConnectionDefaults(profile) {
    const connectionDefaults = {
      whatsappConnected: Boolean(String(profile.whatsapp || '').replace(/\D/g, '')),
      githubConnected: Boolean(profile.githubUsername || profile.github || profile.githubUrl),
      googleConnected: false,
      linkedinConnected: Boolean(profile.linkedinUrl || profile.linkedin)
    };
    Object.entries(connectionDefaults).forEach(([field, defaultValue]) => {
      if (typeof profile[field] !== 'boolean') profile[field] = defaultValue;
    });
  }
  applyConnectionDefaults(profileData);

  let profileSkills = [];
  let isEditingSkills = false;
  let experienceDraft = [];
  let nextExperienceId = 0;
  const MAX_EXPERIENCE_FILE_SIZE = 5 * 1024 * 1024;
  const skillTags = document.getElementById('settingsSkillTags');
  const skillInput = document.getElementById('settingsSkills');
  const skillEditor = document.getElementById('settingsSkillEditor');
  const skillHint = document.getElementById('settingsSkillsHint');
  const skillActions = document.getElementById('settingsSkillsActions');
  const editSkillsButton = document.getElementById('editProfileSkills');
  const experienceEntries = document.getElementById('settingsExperienceEntries');
  const addExperienceBottomButton = document.getElementById('addProfileExperienceBottom');
  const specialtyGrid = document.getElementById('settingsSpecialtyGrid');
  const editSpecialtiesButton = document.getElementById('editProfileSpecialties');
  const specialtyActions = document.getElementById('settingsSpecialtyActions');
  const specialtyChoices = [
    { name: 'Full-stack', description: 'Front + back end', icon: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>' },
    { name: 'Frontend', description: 'Web interfaces', icon: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>' },
    { name: 'Backend', description: 'APIs & databases', icon: '<path d="M6 3v6m0 4v8M12 3v3m0 4v11M18 3v9m0 4v5M3 9h6m0 1h6m0 2h6m-6 4h6"/>' },
    { name: 'UI/UX', description: 'Design & research', icon: '<path d="m15 5 4 4M4 20l4-.8L19.2 8a2.8 2.8 0 0 0-4-4L4 15.2 4 20z"/>' },
    { name: 'Mobile', description: 'Android & iOS', icon: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/>' },
    { name: 'Game Dev', description: 'Unity, Roblox...', icon: '<path d="m7 7 10 0a4 4 0 0 1 3.8 5.2l-1.2 4a2 2 0 0 1-3.3.9L14 15H10l-2.3 2.1a2 2 0 0 1-3.3-.9l-1.2-4A4 4 0 0 1 7 7z"/><path d="M7 10v4m-2-2h4m7-1h.01M17 13h.01"/>' },
    { name: 'Other', description: 'Tell us more', icon: '<path d="M12 5v14m-7-7h14"/>' }
  ];
  let profileSpecialties = [];
  let specialtyDraft = [];
  let profileSpecialtyOther = '';
  let specialtyOtherDraft = '';
  let isEditingSpecialties = false;

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

  function getAgeRangeFromBirthday(value) {
    if (!value) return '';
    const birthday = new Date(value);
    if (Number.isNaN(birthday.getTime())) return '';
    const age = Math.max(0, Math.floor((Date.now() - birthday.getTime()) / (365.2425 * 24 * 60 * 60 * 1000)));
    if (age < 18) return 'Under 18';
    if (age < 25) return '18–24';
    if (age < 35) return '25–34';
    if (age < 45) return '35–44';
    return '45+';
  }

  function localDateValue(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function normalizeSpecialties(value) {
    const specialties = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\n]/) : [];
    return [...new Map(specialties.map(item => String(item).trim()).filter(Boolean)
      .map(item => [item.toLowerCase(), item])).values()];
  }

  function renderSpecialties() {
    if (!specialtyGrid) return;
    const additionalChoices = specialtyDraft
      .filter(name => !specialtyChoices.some(choice => choice.name.toLowerCase() === name.toLowerCase()))
      .map(name => ({ name, description: 'Specialization', icon: specialtyChoices[specialtyChoices.length - 1].icon }));
    const choices = isEditingSpecialties
      ? [...specialtyChoices, ...additionalChoices]
      : profileSpecialties.map(name => specialtyChoices.find(choice => choice.name.toLowerCase() === name.toLowerCase())
        || { name, description: 'Specialization', icon: specialtyChoices[specialtyChoices.length - 1].icon });
    specialtyGrid.classList.toggle('is-editing', isEditingSpecialties);
    specialtyGrid.innerHTML = choices.map(choice => `
      <button class="specialty-card" type="button" data-profile-specialty="${escapeHtml(choice.name)}" aria-pressed="${isEditingSpecialties ? specialtyDraft.some(item => item.toLowerCase() === choice.name.toLowerCase()) : profileSpecialties.some(item => item.toLowerCase() === choice.name.toLowerCase())}"${isEditingSpecialties ? '' : ' disabled'}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${choice.icon}</svg>
        <b>${escapeHtml(!isEditingSpecialties && choice.name === 'Other' && profileSpecialtyOther ? profileSpecialtyOther : choice.name)}</b>
        <small>${escapeHtml(!isEditingSpecialties && choice.name === 'Other' && profileSpecialtyOther ? 'Custom specialization' : choice.description)}</small>
      </button>`).join('');
    const otherField = document.getElementById('settingsSpecialtyOtherField');
    const otherInput = document.getElementById('settingsSpecialtyOther');
    const otherError = document.getElementById('settingsSpecialtyOtherError');
    otherField.hidden = !isEditingSpecialties || !specialtyDraft.some(item => item.toLowerCase() === 'other');
    otherInput.value = specialtyOtherDraft;
    otherInput.removeAttribute('aria-invalid');
    otherError.hidden = true;
  }

  function setSpecialtiesEditing(editing) {
    isEditingSpecialties = editing;
    specialtyDraft = [...profileSpecialties];
    specialtyOtherDraft = profileSpecialtyOther;
    specialtyActions.hidden = !editing;
    editSpecialtiesButton.querySelector('span').textContent = editing ? 'Cancel' : 'Edit';
    editSpecialtiesButton.querySelector('svg').hidden = editing;
    renderSpecialties();
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

  function parseExperiencePeriod(period) {
    const value = String(period || '').trim();
    const range = value.match(/^(\d{4})\s*(?:-|–|—|to)\s*(\d{4}|present|sekarang)$/i);
    if (range) {
      return {
        startYear: range[1],
        endYear: /^(present|sekarang)$/i.test(range[2]) ? 'Present' : range[2]
      };
    }
    if (/^(present|sekarang)$/i.test(value)) return { startYear: '', endYear: 'Present' };
    const year = value.match(/\b\d{4}\b/);
    return { startYear: year ? year[0] : '', endYear: '' };
  }

  function renderExperienceEntries() {
    if (!experienceEntries) return;
    if (addExperienceBottomButton) addExperienceBottomButton.hidden = experienceDraft.length === 0;
    experienceEntries.innerHTML = experienceDraft.map((entry, index) => {
      const selectedFiles = entry.pendingFiles?.length
        ? entry.pendingFiles.map(file => file.name)
        : entry.files;
      const selectedFileNames = selectedFiles.join(', ') || 'No file chosen';
      return `
      <fieldset class="settings-experience-entry" data-experience-id="${entry.id}">
        <div class="settings-experience-entry-heading"><b>Experience <span>${index + 1}</span></b>${entry.editing
          ? `<button class="settings-experience-remove" type="button" data-remove-experience="${entry.id}" aria-label="Remove experience ${index + 1}" title="Remove experience"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2m3 0-.9 14H5.9L5 6"/><path d="M10 11v5m4-5v5"/></svg></button>`
          : `<button class="settings-experience-edit" type="button" data-edit-experience="${entry.id}">Edit</button>`}</div>
        <div class="settings-experience-fields">
          <label class="settings-field"><span class="settings-label"><span>Job title</span><span class="settings-required-mark" aria-hidden="true">*</span></span><input class="settings-input" data-experience-field="title" aria-describedby="settingsExperience-${entry.id}-title-error" maxlength="80" placeholder="e.g. Frontend Developer" value="${escapeHtml(entry.title)}"${entry.editing ? '' : ' disabled'} required><span class="settings-field-error" id="settingsExperience-${entry.id}-title-error" data-experience-error="title" role="alert" hidden></span></label>
          <label class="settings-field"><span class="settings-label"><span>Company</span><span class="settings-required-mark" aria-hidden="true">*</span></span><input class="settings-input" data-experience-field="company" aria-describedby="settingsExperience-${entry.id}-company-error" maxlength="80" placeholder="Company name" value="${escapeHtml(entry.company)}"${entry.editing ? '' : ' disabled'} required><span class="settings-field-error" id="settingsExperience-${entry.id}-company-error" data-experience-error="company" role="alert" hidden></span></label>
          <div class="settings-field"><span class="settings-label"><span>Period</span><span class="settings-required-mark" aria-hidden="true">*</span></span><div class="settings-experience-period-control"><div class="settings-experience-year-field"><input class="settings-input" data-experience-year="startYear" aria-label="Start year" aria-describedby="settingsExperience-${entry.id}-startYear-error" inputmode="numeric" pattern="[0-9]{4}" placeholder="YYYY" value="${escapeHtml(entry.startYear)}"${entry.editing ? '' : ' disabled'} required><span class="settings-field-error" id="settingsExperience-${entry.id}-startYear-error" data-experience-error="startYear" role="alert" hidden></span></div><span class="settings-experience-period-separator" aria-hidden="true">–</span><div class="settings-experience-year-field"><input class="settings-input" data-experience-year="endYear" aria-label="End year" aria-describedby="settingsExperience-${entry.id}-endYear-error" inputmode="numeric" pattern="[0-9]{4}" placeholder="YYYY" value="${escapeHtml(entry.endYear)}"${entry.editing ? '' : ' disabled'} required></div><span class="settings-field-error settings-experience-period-error" id="settingsExperience-${entry.id}-endYear-error" data-experience-error="endYear" role="alert" hidden></span></div></div>
          <label class="settings-field"><span class="settings-label"><span>Portfolio link</span><small class="form-optional">Optional</small></span><input class="settings-input" data-experience-field="link" type="url" placeholder="${entry.editing ? 'https://example.com' : (entry.link ? '' : '-')}" value="${escapeHtml(entry.link)}"${entry.editing ? '' : ' disabled'}></label>
          <div class="settings-field span-2"><span class="settings-label"><span>Upload supporting files</span><small class="form-optional">Optional</small></span><div class="settings-experience-file-picker${entry.editing ? '' : ' is-disabled'}"><button class="settings-experience-file-action" type="button" data-choose-experience-file aria-describedby="settingsExperience-${entry.id}-file-size settingsExperience-${entry.id}-file-error"${entry.editing ? '' : ' disabled'}>Choose file</button><span class="settings-experience-file-name" data-experience-file-name title="${escapeHtml(selectedFileNames)}">${escapeHtml(selectedFileNames)}</span><input class="settings-experience-file-input" data-experience-file type="file" aria-label="Upload supporting files" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"${entry.editing ? '' : ' disabled'}></div><span class="settings-hint" id="settingsExperience-${entry.id}-file-size">Maximum file size: 5 MB.</span><span class="settings-field-error" id="settingsExperience-${entry.id}-file-error" data-experience-file-error role="alert" hidden></span>${entry.filePaths.map((_, fileIndex) => {
            const fileName = escapeHtml(entry.files[fileIndex] || `file ${fileIndex + 1}`);
            return `<div class="settings-experience-file-row"><button class="settings-hint settings-experience-file-download" type="button" data-download-experience-file="${entry.id}" data-file-index="${fileIndex}" aria-label="Download ${fileName}" title="Download ${fileName}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 19v2h14v-2"/></svg><span class="settings-experience-file-row-name">${fileName}</span></button>${entry.editing ? `<button class="settings-experience-file-remove" type="button" data-remove-experience-file="${entry.id}" data-file-index="${fileIndex}" aria-label="Remove supporting file" title="Remove supporting file"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2m3 0-.9 14H5.9L5 6"/><path d="M10 11v5m4-5v5"/></svg></button>` : ''}</div>`;
          }).join('')}</div>
        </div>
        ${entry.editing ? `<footer class="settings-card-footer settings-experience-entry-footer"><button class="settings-experience-cancel" type="button" data-cancel-experience="${entry.id}">Cancel</button><button class="settings-btn primary" type="button" data-save-experience="${entry.id}">Save</button></footer>` : ''}
      </fieldset>`
    }).join('');
  }

  // Toast Helper
  const toastEl = document.getElementById('settingsToast');
  const toastTextEl = document.getElementById('settingsToastText');
  const toastUndoButton = document.getElementById('settingsToastUndo');
  let toastTimeout = null;

  function showToast(msg, undoCallback, duration = 3500) {
    if (!toastEl) return;
    clearTimeout(toastTimeout);
    toastTextEl.textContent = msg;
    if (toastUndoButton) {
      toastUndoButton.hidden = !undoCallback;
      toastUndoButton.onclick = undoCallback
        ? async () => {
            toastUndoButton.disabled = true;
            try {
              const shouldDismiss = await undoCallback();
              if (shouldDismiss !== false) toastEl.classList.remove('show');
            } finally {
              toastUndoButton.disabled = false;
            }
          }
        : null;
    }
    toastEl.classList.add('show');
    toastTimeout = setTimeout(() => {
      toastEl.classList.remove('show');
    }, duration);
  }

  function priceDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function formatRupiah(value) {
    const digits = priceDigits(value);
    return digits ? `Rp ${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}` : '';
  }

  // DOM elements
  const navBtns = document.querySelectorAll('.settings-nav-btn');
  const panels = document.querySelectorAll('.settings-panel');
  const userAvatarEl = document.getElementById('userAvatar');
  const topUserNameEl = document.getElementById('topUserName');
  const settingsAvatarPreview = document.getElementById('settingsAvatarPreview');
  const settingsCountrySelect = document.getElementById('settingsCountry');
  const settingsCityInput = document.getElementById('settingsCity');
  const settingsLocationPicker = document.getElementById('settingsLocationPicker');
  const settingsLocationOptions = document.getElementById('settingsLocationOptions');
  const settingsLocationLabel = document.getElementById('settingsLocationLabel');
  const settingsLocationHint = document.getElementById('settingsLocationHint');
  const settingsLocationError = document.getElementById('settingsLocationError');
  const settingsLocationCountries = window.DEVMATCH_CLIENT_PROFILE_OPTIONS.countries;
  let settingsLocationRegions = {Indonesia: [], Malaysia: [], Singapore: []};
  let settingsLocationGroup = null;
  let settingsLocationLoadError = '';
  let settingsLocationDataReady = false;
  let settingsLocationInitialValue = {country: 'Indonesia', city: ''};
  const mobileSettingsDetailBreakpoint = window.matchMedia('(orientation: portrait)');
  const settingsPage = document.querySelector('.settings-page');
  let mobileSettingsDetailPage;
  let mobileSettingsDetailContent;
  let mobileSettingsDetailTitle;
  let mobileSettingsDetailPanel;
  let mobileSettingsDetailPlaceholder;
  let mobileSettingsDetailCloseTimer;
  let mobileSettingsPreviousOverflow = '';
  let mobileSettingsPreviousInert = [];
  let closeExperienceEditors = () => {};

  function getSettingsLocationLabels(country) {
    if (country === 'Malaysia') return {parent: 'State', parentPlural: 'states', child: 'City', childPlural: 'cities'};
    if (country === 'Singapore') return {parent: 'Region', parentPlural: 'regions', child: 'Area', childPlural: 'areas'};
    return {parent: 'Province', parentPlural: 'provinces', child: 'City', childPlural: 'cities'};
  }

  function settingsLocationArticle(value) {
    return /^[aeiou]/i.test(value) ? 'an' : 'a';
  }

  function canonicalSettingsLocation(value, country) {
    const normalized = String(value || '').trim().toLocaleLowerCase();
    if (!normalized) return '';
    const matches = [];
    (settingsLocationRegions[country] || []).forEach(group => {
      group.cities.forEach(city => {
        const canonical = `${group.name}, ${city.name}`;
        const cityNames = country === 'Indonesia' && group.code === '31'
          ? [city.name, `Administrasi ${city.name}`]
          : [city.name];
        const locationFormats = cityNames.flatMap(name => [
          `${group.name}, ${name}`,
          `${name}, ${group.localName || group.name}`,
          `${name}, ${group.name}`
        ]);
        if (locationFormats.some(location => normalized === location.toLocaleLowerCase())
          || cityNames.some(name => normalized === name.toLocaleLowerCase())) {
          matches.push(canonical);
        }
      });
    });
    return matches.length === 1 ? matches[0] : '';
  }

  async function loadSettingsLocationOptions() {
    const load = async path => {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Location data request failed with status ${response.status}.`);
      return response.json();
    };

    try {
      const [indonesiaData, internationalData] = await Promise.all([
        load('assets/data/indonesia-regions.json?v=20261121-location-alpha-v1'),
        load('assets/data/malaysia-singapore-regions.json?v=20261122-malaysia-singapore-v1')
      ]);
      const validGroups = groups => Array.isArray(groups) && groups.length > 0 && groups.every(group =>
        typeof group.code === 'string' && typeof group.name === 'string'
        && Array.isArray(group.cities) && group.cities.length > 0
        && group.cities.every(city => typeof city.code === 'string' && typeof city.name === 'string'));
      if (!Array.isArray(indonesiaData.provinces) || indonesiaData.provinces.length !== 38
        || !validGroups(indonesiaData.provinces)) {
        throw new Error('The Indonesian province and city list is incomplete.');
      }
      if (!internationalData.countries
        || !validGroups(internationalData.countries.Malaysia)
        || !validGroups(internationalData.countries.Singapore)) {
        throw new Error('The Malaysia and Singapore location list is incomplete.');
      }

      settingsLocationRegions = {
        Indonesia: indonesiaData.provinces,
        Malaysia: internationalData.countries.Malaysia,
        Singapore: internationalData.countries.Singapore
      };
      settingsLocationDataReady = true;
    } catch (error) {
      settingsLocationLoadError = 'Location options could not be loaded. Please refresh the page.';
      console.error('Unable to load location options for Settings.', error);
    }
    renderSettingsLocationControls();
  }

  function renderSettingsLocationControls() {
    if (!settingsCountrySelect || !settingsCityInput) return;
    const country = settingsLocationCountries.includes(settingsCountrySelect.value)
      ? settingsCountrySelect.value
      : 'Indonesia';
    const labels = getSettingsLocationLabels(country);
    settingsLocationLabel.textContent = `${labels.parent}, ${labels.child}`;
    settingsCityInput.placeholder = `Search ${settingsLocationArticle(labels.parent)} ${labels.parent.toLocaleLowerCase()} or ${settingsLocationArticle(labels.child)} ${labels.child.toLocaleLowerCase()}`;
    settingsLocationHint.textContent = settingsLocationLoadError
      || `Search and select ${settingsLocationArticle(labels.parent)} ${labels.parent.toLocaleLowerCase()}, then ${settingsLocationArticle(labels.child)} ${labels.child.toLocaleLowerCase()}.`;
    settingsLocationPicker?.classList.remove('open');
    settingsLocationOptions.hidden = true;
    settingsLocationGroup = null;
  }

  function renderSettingsLocationOptions(query = '') {
    const country = settingsCountrySelect.value;
    const labels = getSettingsLocationLabels(country);
    settingsLocationOptions.setAttribute('aria-label', `${labels.parent} and ${labels.child} options`);
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (settingsLocationLoadError) {
      settingsLocationOptions.innerHTML = `<div class="settings-location-message" role="status">${escapeHtml(settingsLocationLoadError)}</div>`;
      return;
    }
    if (!settingsLocationDataReady) {
      settingsLocationOptions.innerHTML = '<div class="settings-location-message" role="status">Loading location options…</div>';
      return;
    }

    const groups = settingsLocationRegions[country] || [];
    const entries = settingsLocationGroup
      ? settingsLocationGroup.cities.map(city => ({type: 'city', code: city.code, name: city.name}))
      : groups.map(group => ({type: 'group', code: group.code, name: group.name, aliases: [group.localName].filter(Boolean)}));
    const matches = entries.filter(entry => [entry.name, ...(entry.aliases || [])]
      .some(name => name.toLocaleLowerCase().includes(normalizedQuery)))
      .sort((first, second) => first.name.localeCompare(second.name, 'en', {sensitivity: 'base'}));
    const backButton = settingsLocationGroup
      ? `<button class="settings-location-back" type="button" role="option" data-location-back>All ${labels.parentPlural}</button>`
      : '';
    const heading = settingsLocationGroup
      ? `<div class="settings-location-heading" role="presentation">${labels.childPlural[0].toLocaleUpperCase() + labels.childPlural.slice(1)} in ${escapeHtml(settingsLocationGroup.name)}</div>`
      : '';
    const options = matches.map(entry => `<button class="settings-location-option" type="button" role="option" data-location-option="${entry.type}" data-location-code="${escapeHtml(entry.code)}">${escapeHtml(entry.name)}</button>`).join('');
    settingsLocationOptions.innerHTML = `${backButton}${heading}${options || '<div class="settings-location-message" role="status">No matches found</div>'}`;
  }

  function openSettingsLocationPicker() {
    if (!settingsLocationPicker || settingsLocationPicker.classList.contains('open')) return;
    settingsLocationGroup = null;
    settingsCityInput.value = '';
    const labels = getSettingsLocationLabels(settingsCountrySelect.value);
    settingsCityInput.placeholder = `Search ${settingsLocationArticle(labels.parent)} ${labels.parent.toLocaleLowerCase()}`;
    settingsCityInput.setAttribute('aria-label', `Search ${settingsLocationArticle(labels.parent)} ${labels.parent.toLocaleLowerCase()}`);
    renderSettingsLocationOptions();
    settingsLocationPicker.classList.add('open');
    settingsLocationOptions.hidden = false;
    settingsCityInput.setAttribute('aria-expanded', 'true');
    settingsLocationPicker.querySelector('.settings-location-toggle')?.setAttribute('aria-expanded', 'true');
  }

  function closeSettingsLocationPicker({restoreValue = true} = {}) {
    if (!settingsLocationPicker || !settingsCityInput || !settingsLocationOptions) return;
    settingsLocationPicker.classList.remove('open');
    settingsLocationOptions.hidden = true;
    settingsCityInput.setAttribute('aria-expanded', 'false');
    settingsLocationPicker.querySelector('.settings-location-toggle')?.setAttribute('aria-expanded', 'false');
    settingsCityInput.removeAttribute('aria-label');
    settingsCityInput.value = restoreValue ? profileData.city || '' : '';
    settingsLocationGroup = null;
    renderSettingsLocationControls();
  }

  function selectSettingsLocationOption(option) {
    if (option.hasAttribute('data-location-back')) {
      settingsLocationGroup = null;
      settingsCityInput.value = '';
      const labels = getSettingsLocationLabels(settingsCountrySelect.value);
      settingsCityInput.placeholder = `Search ${settingsLocationArticle(labels.parent)} ${labels.parent.toLocaleLowerCase()}`;
      settingsCityInput.setAttribute('aria-label', `Search ${settingsLocationArticle(labels.parent)} ${labels.parent.toLocaleLowerCase()}`);
      renderSettingsLocationOptions();
      settingsCityInput.focus();
      return;
    }
    if (option.dataset.locationOption === 'group') {
      settingsLocationGroup = settingsLocationRegions[settingsCountrySelect.value]
        .find(group => group.code === option.dataset.locationCode) || null;
      if (!settingsLocationGroup) return;
      const labels = getSettingsLocationLabels(settingsCountrySelect.value);
      settingsCityInput.value = '';
      settingsCityInput.placeholder = `Search ${labels.childPlural} in ${settingsLocationGroup.name}`;
      settingsCityInput.setAttribute('aria-label', `Search ${labels.childPlural} in ${settingsLocationGroup.name}`);
      renderSettingsLocationOptions();
      settingsCityInput.focus();
      return;
    }
    if (option.dataset.locationOption === 'city' && settingsLocationGroup) {
      const city = settingsLocationGroup.cities.find(item => item.code === option.dataset.locationCode);
      if (!city) return;
      profileData.city = `${settingsLocationGroup.name}, ${city.name}`;
      settingsCityInput.value = profileData.city;
      settingsLocationError.hidden = true;
      settingsCityInput.removeAttribute('aria-invalid');
      closeSettingsLocationPicker();
      settingsCityInput.focus();
    }
  }

  function validateSettingsLocation() {
    const country = settingsCountrySelect.value;
    const city = settingsCityInput.value.trim();
    const changed = country !== settingsLocationInitialValue.country || city !== settingsLocationInitialValue.city;
    const valid = !changed || !city || (
      settingsLocationDataReady
      && country === profileData.country
      && city === profileData.city
    );
    settingsLocationError.hidden = valid;
    settingsCityInput.setAttribute('aria-invalid', String(!valid));
    if (!valid) settingsCityInput.focus();
    return valid;
  }

  const settingsLocationDataPromise = loadSettingsLocationOptions();

  settingsCountrySelect.addEventListener('change', () => {
    if (settingsCountrySelect.value === profileData.country) {
      renderSettingsLocationControls();
      return;
    }
    profileData.country = settingsCountrySelect.value;
    profileData.city = '';
    settingsLocationError.hidden = true;
    settingsCityInput.removeAttribute('aria-invalid');
    closeSettingsLocationPicker({restoreValue: false});
    renderSettingsLocationControls();
  });

  settingsCityInput.addEventListener('input', () => renderSettingsLocationOptions(settingsCityInput.value));
  settingsCityInput.addEventListener('focus', openSettingsLocationPicker);
  settingsLocationPicker.addEventListener('click', event => {
    const toggle = event.target.closest('.settings-location-toggle');
    if (toggle) {
      if (settingsLocationPicker.classList.contains('open')) closeSettingsLocationPicker();
      else {
        openSettingsLocationPicker();
        settingsCityInput.focus();
      }
      return;
    }
    const option = event.target.closest('#settingsLocationOptions [role="option"]');
    if (option) {
      event.stopPropagation();
      selectSettingsLocationOption(option);
    }
  });
  settingsLocationPicker.addEventListener('mousedown', event => {
    if (event.target.closest('#settingsLocationOptions button')) event.preventDefault();
  });
  settingsLocationPicker.addEventListener('keydown', event => {
    if (event.target === settingsCityInput) {
      if (event.key === 'Tab' && settingsLocationPicker.classList.contains('open')) {
        closeSettingsLocationPicker();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSettingsLocationPicker();
        settingsCityInput.focus();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (settingsLocationOptions.hidden) openSettingsLocationPicker();
        settingsLocationOptions.querySelector('[role="option"]')?.focus();
      } else if (event.key === 'Enter' && settingsLocationPicker.classList.contains('open')) {
        event.preventDefault();
        settingsLocationOptions.querySelector('[data-location-option]')?.click();
      }
      return;
    }
    const option = event.target.closest('#settingsLocationOptions [role="option"]');
    if (!option) return;
    if (event.key === 'Tab') {
      event.preventDefault();
      closeSettingsLocationPicker();
      (event.shiftKey ? settingsCityInput : document.getElementById('settingsBio'))?.focus();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSettingsLocationPicker();
      settingsCityInput.focus();
      return;
    }
    const options = [...settingsLocationOptions.querySelectorAll('[role="option"]')];
    const index = options.indexOf(option);
    const nextIndex = event.key === 'ArrowDown' ? Math.min(index + 1, options.length - 1)
      : event.key === 'ArrowUp' ? index > 0 ? index - 1 : -1
        : event.key === 'Home' ? 0
          : event.key === 'End' ? options.length - 1
            : null;
    if (nextIndex === null) return;
    event.preventDefault();
    if (nextIndex < 0) settingsCityInput.focus();
    else options[nextIndex]?.focus();
  });
  document.addEventListener('click', event => {
    if (settingsLocationPicker && !settingsLocationPicker.contains(event.target)) {
      closeSettingsLocationPicker();
    }
  });

  function returnToMobileSettingsMenu() {
    if (!mobileSettingsDetailBreakpoint.matches) {
      closeMobileSettingsDetail();
      return;
    }
    const menuRole = isDeveloper ? 'dev' : 'client';
    window.location.assign(`devmatch-my-profile.html?role=${menuRole}&openSettings=1`);
  }

  function createMobileSettingsDetailPage() {
    if (!settingsPage || navBtns.length === 0) return;

    mobileSettingsDetailPage = document.createElement('section');
    mobileSettingsDetailPage.className = 'mobile-settings-detail-page';
    mobileSettingsDetailPage.id = 'mobileSettingsDetailPage';
    mobileSettingsDetailPage.setAttribute('role', 'dialog');
    mobileSettingsDetailPage.setAttribute('aria-modal', 'true');
    mobileSettingsDetailPage.setAttribute('aria-labelledby', 'mobileSettingsDetailTitle');
    mobileSettingsDetailPage.setAttribute('aria-busy', 'true');
    mobileSettingsDetailPage.hidden = true;

    const header = document.createElement('header');
    header.className = 'mobile-settings-detail-header';
    const backButton = document.createElement('button');
    backButton.className = 'mobile-settings-detail-back';
    backButton.type = 'button';
    backButton.setAttribute('aria-label', 'Back to Settings categories');
    backButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
    mobileSettingsDetailTitle = document.createElement('h1');
    mobileSettingsDetailTitle.className = 'mobile-settings-detail-title';
    mobileSettingsDetailTitle.id = 'mobileSettingsDetailTitle';
    header.append(backButton, mobileSettingsDetailTitle);

    mobileSettingsDetailContent = document.createElement('div');
    mobileSettingsDetailContent.className = 'mobile-settings-detail-content';
    mobileSettingsDetailContent.inert = document.body.classList.contains('devmatch-settings-loading');
    mobileSettingsDetailContent.setAttribute('aria-busy', String(mobileSettingsDetailContent.inert));
    mobileSettingsDetailPage.append(header, mobileSettingsDetailContent);
    document.body.appendChild(mobileSettingsDetailPage);

    backButton.addEventListener('click', returnToMobileSettingsMenu);
  }

  function lockMobileSettingsBackground() {
    mobileSettingsPreviousOverflow = document.body.style.overflow;
    mobileSettingsPreviousInert = [...document.querySelectorAll(
      'body > header.topbar, body > .sidebar, body > .client-sidebar, body > main, body > .mobile-bottom-nav, body > .floating-chat'
    )].map(element => ({element, inert: element.inert}));
    mobileSettingsPreviousInert.forEach(({element}) => { element.inert = true; });
    document.body.style.overflow = 'hidden';
  }

  function openMobileSettingsDetail(tabId) {
    if (!mobileSettingsDetailPage || !mobileSettingsDetailBreakpoint.matches) return;
    const panel = document.getElementById(`panel-${tabId}`);
    const navButton = Array.from(navBtns).find(button => button.dataset.tab === tabId);
    if (!panel || !navButton) return;
    if (mobileSettingsDetailPanel === panel && !mobileSettingsDetailPage.hidden) {
      if (mobileSettingsDetailCloseTimer !== undefined) {
        clearTimeout(mobileSettingsDetailCloseTimer);
        mobileSettingsDetailCloseTimer = undefined;
        lockMobileSettingsBackground();
        requestAnimationFrame(() => {
          mobileSettingsDetailPage.classList.add('is-open');
          mobileSettingsDetailPage.querySelector('.mobile-settings-detail-back')?.focus();
        });
      }
      return;
    }

    if (mobileSettingsDetailPanel && mobileSettingsDetailPlaceholder) {
      mobileSettingsDetailPlaceholder.replaceWith(mobileSettingsDetailPanel);
    }

    const titleSource = navButton.cloneNode(true);
    titleSource.querySelector('.settings-nav-badge')?.remove();
    mobileSettingsDetailTitle.textContent = titleSource.textContent.trim();
    mobileSettingsDetailPlaceholder = document.createComment('settings detail panel position');
    panel.before(mobileSettingsDetailPlaceholder);
    mobileSettingsDetailContent.replaceChildren(panel);
    panel.hidden = false;
    mobileSettingsDetailPanel = panel;

    clearTimeout(mobileSettingsDetailCloseTimer);
    mobileSettingsDetailCloseTimer = undefined;
    lockMobileSettingsBackground();
    mobileSettingsDetailPage.hidden = false;
    requestAnimationFrame(() => {
      mobileSettingsDetailPage.classList.add('is-open');
      mobileSettingsDetailPage.querySelector('.mobile-settings-detail-back')?.focus();
    });
  }

  function closeMobileSettingsDetail(immediate = false) {
    if (!mobileSettingsDetailPage || mobileSettingsDetailPage.hidden) return;
    mobileSettingsDetailPage.classList.remove('is-open');
    document.body.style.overflow = mobileSettingsPreviousOverflow;
    mobileSettingsPreviousInert.forEach(({element, inert}) => { element.inert = inert; });
    mobileSettingsPreviousInert = [];

    const finishClosing = () => {
      mobileSettingsDetailPage.hidden = true;
      if (mobileSettingsDetailPanel && mobileSettingsDetailPlaceholder) {
        mobileSettingsDetailPlaceholder.replaceWith(mobileSettingsDetailPanel);
      }
      mobileSettingsDetailPanel = null;
      mobileSettingsDetailPlaceholder = null;
      mobileSettingsDetailCloseTimer = undefined;
      Array.from(navBtns).find(button => button.classList.contains('active'))?.focus();
    };

    clearTimeout(mobileSettingsDetailCloseTimer);
    mobileSettingsDetailCloseTimer = undefined;
    if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishClosing();
      return;
    }
    mobileSettingsDetailCloseTimer = window.setTimeout(finishClosing, 240);
  }

  createMobileSettingsDetailPage();

  // Tab switching
  function switchTab(tabId, updateLocation = true) {
    const activeTab = Array.from(navBtns).find(btn => btn.classList.contains('active'))?.dataset.tab;
    if (activeTab === 'profile-details' && tabId !== activeTab) closeExperienceEditors();

    navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    panels.forEach(panel => {
      const match = panel.id === `panel-${tabId}`;
      panel.hidden = !match;
    });

    // Update URL hash without jumping
    if (updateLocation && history.replaceState) {
      history.replaceState(null, '', `#${tabId}`);
    }
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
      if (mobileSettingsDetailBreakpoint.matches) openMobileSettingsDetail(btn.dataset.tab);
    });
  });

  mobileSettingsDetailBreakpoint.addEventListener('change', event => {
    if (event.matches) {
      const activeTab = Array.from(navBtns).find(button => button.classList.contains('active'))?.dataset.tab || 'account';
      openMobileSettingsDetail(activeTab);
    } else {
      closeMobileSettingsDetail(true);
    }
  });

  document.addEventListener('keydown', event => {
    if (!mobileSettingsDetailPage || mobileSettingsDetailPage.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      returnToMobileSettingsMenu();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = [...mobileSettingsDetailPage.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.hidden && !element.closest('[inert]') && element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });

  // Check URL Hash on load
  function initHashTab() {
    const hash = window.location.hash.replace('#', '');
    const target = hash ? document.getElementById(hash) : null;
    const targetPanel = target?.closest('.settings-panel');
    const panelTab = targetPanel?.id.startsWith('panel-')
      ? targetPanel.id.slice('panel-'.length)
      : hash && document.getElementById(`panel-${hash}`)
        ? hash
        : 'account';
    switchTab(panelTab, false);
    if (hash && Array.from(navBtns).some(button => button.dataset.tab === panelTab)) {
      openMobileSettingsDetail(panelTab);
    }
    return target && targetPanel && target !== targetPanel ? target : null;
  }

  function openProfileDetailsTarget() {
    if (params.get('edit') !== null && window.location.hash.replace('#', '') === 'profile-details') {
      switchTab('profile-details');
      if (mobileSettingsDetailBreakpoint.matches) openMobileSettingsDetail('profile-details');
    }
    const target = params.get('edit');
    if (target === 'specialization') {
      setSpecialtiesEditing(true);
      document.getElementById('settingsSpecialtyCard')?.scrollIntoView({ block: 'start' });
      editSpecialtiesButton?.focus();
    } else if (target === 'skills' && isDeveloper) {
      setSkillsEditing(true);
      document.getElementById('settingsSkillsCard')?.scrollIntoView({ block: 'start' });
      skillInput?.focus();
    } else if (target === 'experience') {
      document.getElementById('settingsExperienceCard')?.scrollIntoView({ block: 'start' });
    }
  }

  // Populate Profile Inputs
  function populateForm() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    };
    setVal('settingsDisplayName', profileData.displayName);
    setVal('settingsUsername', profileData.username || '');
    savedUsername = window.DEVMATCH_USERNAME.normalize(profileData.username || '');
    validateSettingsUsername();
    setVal('settingsEmail', profileData.email || '');
    setVal('settingsGender', profileData.gender || '');
    setVal('settingsBirthday', profileData.birthday || '');
    document.getElementById('settingsBirthday').max = localDateValue();
    document.getElementById('settingsBirthdayHint').textContent = !profileData.birthday && profileData.ageRange
      ? 'Your existing age range is preserved. Birthday was not retained from earlier setup; enter it to update your age range.'
      : 'Private. Only your age range is shown publicly.';
    setVal('settingsWebsite', profileData.website || '');
    setVal('settingsInstagram', profileContact.normalizeInstagramUsername(profileData.instagram || ''));
    profileData.country = settingsLocationCountries.includes(profileData.country)
      ? profileData.country
      : 'Indonesia';
    settingsCountrySelect.value = profileData.country;
    settingsCountrySelect.dispatchEvent(new Event('change', {bubbles: true}));
    profileData.city = canonicalSettingsLocation(profileData.city, profileData.country)
      || (typeof profileData.city === 'string' ? profileData.city : '');
    settingsCityInput.value = profileData.city;
    settingsLocationInitialValue = {country: profileData.country, city: profileData.city};
    renderSettingsLocationControls();
    setVal('settingsBio', profileData.bio || '');
    const whatsappParts = profileContact.splitWhatsappNumber(
      profileData.whatsapp || '',
      profileData.whatsappDialCode,
      profileData.country
    );
    setVal('settingsWhatsappDialCode', whatsappParts.dialCode);
    document.getElementById('settingsWhatsappDialCode').dispatchEvent(new Event('change', {bubbles: true}));
    setVal('settingsWhatsapp', whatsappParts.number);
    const industrySelect = document.getElementById('settingsIndustry');
    const industries = window.DEVMATCH_CLIENT_PROFILE_OPTIONS.businessTypes;
    const industry = String(profileData.industry || '');
    industrySelect.innerHTML = `<option value="">Choose an industry</option>${industries.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}${industry && !industries.includes(industry) ? `<option value="${escapeHtml(industry)}">${escapeHtml(industry)}</option>` : ''}`;
    industrySelect.value = industry;
    profileSkills = normalizeSkills(profileData.skills, []);
    renderSkillTags();
    profileSpecialties = normalizeSpecialties(profileData.specialty);
    profileSpecialtyOther = typeof profileData.specialtyOther === 'string' ? profileData.specialtyOther : '';
    if (profileSpecialtyOther && !profileSpecialties.some(item => item.toLowerCase() === 'other')) {
      profileSpecialties.push('Other');
    }
    specialtyDraft = [...profileSpecialties];
    specialtyOtherDraft = profileSpecialtyOther;
    document.getElementById('settingsSpecialtyCard').hidden = !isDeveloper;
    renderSpecialties();
    const savedExperiences = Array.isArray(profileData.experiences)
      ? profileData.experiences
      : [];
    profileData.experiences = savedExperiences;
    experienceDraft = savedExperiences
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item && typeof item === 'object')
      .map(({ item, index }) => ({
          id: String(++nextExperienceId),
          persistedIndex: index,
          title: String(item.title || ''),
          company: String(item.company || ''),
          ...parseExperiencePeriod(item.period),
          link: String(item.link || ''),
          files: Array.isArray(item.files) ? item.files.map(file => typeof file === 'string' ? file : String(file?.name || '')) : [],
          filePaths: Array.isArray(item.filePaths) ? item.filePaths.map(String) : [],
          removedFilePaths: [],
          pendingFiles: []
        }));
    renderExperienceEntries();

    if (isDeveloper) {
      setVal('settingsHourlyRate', formatRupiah(profileData.hourlyRate || ''));
      setVal('settingsMinProject', formatRupiah(profileData.minProjectPrice || ''));
      setVal('settingsAvailability', profileData.availability || '');
      setVal('settingsExperienceLevel', profileData.experience || '');
      setVal('settingsBankName', profileData.bankName || '');
      setVal('settingsBankAccount', profileData.accountNumber || '');
      setVal('settingsAccountHolder', profileData.accountHolder || '');
    } else {
      setVal('settingsCompanyName', profileData.companyName || '');
      setVal('settingsIndustry', profileData.industry || '');
      setVal('settingsNpwp', profileData.npwp || '');
    }

    updateAvatarPreview();
  }

  function updateAvatarPreview() {
    const name = typeof profileData.displayName === 'string' && profileData.displayName.trim()
      ? profileData.displayName.trim()
      : (isDeveloper ? 'Developer' : 'Client');
    const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'DM';

    setAvatar(userAvatarEl, profileData.avatar, initials);
    if (topUserNameEl) topUserNameEl.textContent = profileData.username || name;
    setAvatar(settingsAvatarPreview, profileData.avatar, initials);
  }

  function setAvatar(element, imageUrl, initials) {
    if (!element) return;
    let validImage = typeof imageUrl === 'string' && /^data:image\/(?:jpeg|png);base64,/.test(imageUrl);
    if (typeof imageUrl === 'string' && imageUrl.startsWith('https://')) {
      try {
        const url = new URL(imageUrl);
        validImage = url.origin === 'https://yxwktllqbmhustmhdaqi.supabase.co'
          && url.pathname.startsWith('/storage/v1/object/public/project-media/');
      } catch {
        validImage = false;
      }
    }
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

  async function persistProfile(value, options){
    await window.devMatchBackend.saveProfile(value, options);
  }
  const settingsUsernameInput = document.getElementById('settingsUsername');
  const settingsUsernameError = document.getElementById('settingsUsernameError');
  const settingsUsernameStatus = document.getElementById('settingsUsernameStatus');
  const saveUsernameButton = document.getElementById('saveUsername');
  let savedUsername = window.DEVMATCH_USERNAME.normalize(profileData.username || '');
  let usernameValidationTimer;
  let usernameValidationRequest = 0;

  function setUsernameError(message) {
    settingsUsernameError.textContent = message || '';
    settingsUsernameError.hidden = !message;
    if (message) settingsUsernameInput.setAttribute('aria-invalid', 'true');
    else settingsUsernameInput.removeAttribute('aria-invalid');
  }

  function usernameChangeIsRestricted() {
    const changedAt = Date.parse(profileData.usernameChangedAt || '');
    return Number.isFinite(changedAt)
      && Date.now() < changedAt + window.DEVMATCH_USERNAME.cooldownMs;
  }

  function validateSettingsUsername() {
    const raw = settingsUsernameInput.value;
    const username = window.DEVMATCH_USERNAME.normalize(raw);
    if (raw !== username) settingsUsernameInput.value = username;
    clearTimeout(usernameValidationTimer);
    const requestId = ++usernameValidationRequest;
    settingsUsernameStatus.textContent = '';

    if (username === savedUsername) {
      setUsernameError('');
      saveUsernameButton.disabled = true;
      return;
    }

    const validation = window.DEVMATCH_USERNAME.validate(username);
    if (!validation.valid) {
      setUsernameError(validation.message);
      saveUsernameButton.disabled = true;
      return;
    }

    if (usernameChangeIsRestricted()) {
      setUsernameError(window.DEVMATCH_USERNAME.messages.cooldown);
      saveUsernameButton.disabled = true;
      return;
    }

    const uppercaseNotice = raw !== username
      && window.DEVMATCH_USERNAME.validate(raw).message === window.DEVMATCH_USERNAME.messages.lowercase;
    setUsernameError(uppercaseNotice ? window.DEVMATCH_USERNAME.messages.lowercase : '');
    settingsUsernameStatus.textContent = 'Checking username availability…';
    saveUsernameButton.disabled = true;

    usernameValidationTimer = setTimeout(async () => {
      try {
        const available = await window.DEVMATCH_USERNAME.isAvailable(username);
        if (requestId !== usernameValidationRequest || settingsUsernameInput.value !== username) return;
        if (!available) {
          setUsernameError(window.DEVMATCH_USERNAME.messages.taken);
          settingsUsernameStatus.textContent = '';
          saveUsernameButton.disabled = true;
          return;
        }
        setUsernameError('');
        settingsUsernameStatus.textContent = 'Username is available.';
        saveUsernameButton.disabled = false;
      } catch (error) {
        if (requestId !== usernameValidationRequest) return;
        console.error('Unable to check username availability.', error);
        setUsernameError('Unable to check username right now. Please try again.');
        settingsUsernameStatus.textContent = '';
        saveUsernameButton.disabled = true;
      }
    }, 400);
  }

  settingsUsernameInput.addEventListener('input', validateSettingsUsername);
  saveUsernameButton.addEventListener('click', async () => {
    const username = window.DEVMATCH_USERNAME.normalize(settingsUsernameInput.value);
    const validation = window.DEVMATCH_USERNAME.validate(username);
    if (!validation.valid) {
      setUsernameError(validation.message);
      return;
    }
    if (username === savedUsername) return;
    if (usernameChangeIsRestricted()) {
      setUsernameError(window.DEVMATCH_USERNAME.messages.cooldown);
      saveUsernameButton.disabled = true;
      return;
    }

    saveUsernameButton.disabled = true;
    setUsernameError('');
    settingsUsernameStatus.textContent = 'Updating username…';
    try {
      const updated = await window.devMatchBackend.changeUsername(username);
      savedUsername = updated.username;
      profileData.username = updated.username;
      profileData.usernameChangedAt = updated.usernameChangedAt;
      settingsUsernameInput.value = updated.username;
      const topUserName = document.getElementById('topUserName');
      if (topUserName) topUserName.textContent = updated.username;
      settingsUsernameStatus.textContent = 'Username updated successfully.';
      showToast('Username updated successfully!');
    } catch (error) {
      console.error('Unable to update username.', error);
      setUsernameError(Object.values(window.DEVMATCH_USERNAME.messages).includes(error.message)
        ? error.message
        : 'Unable to update username. Please try again.');
      settingsUsernameStatus.textContent = '';
      saveUsernameButton.disabled = false;
    }
  });
  const emailInput = document.getElementById('settingsEmail');
  if (emailInput) {
    emailInput.readOnly = true;
    emailInput.title = 'This account identifier cannot be changed here.';
  }

  // Account Form Submission
  const accountForm = document.getElementById('accountForm');
  if (accountForm) {
    const settingsWhatsappInput = document.getElementById('settingsWhatsapp');
    const settingsInstagramInput = document.getElementById('settingsInstagram');
    settingsWhatsappInput.addEventListener('input', () => {
      settingsWhatsappInput.value = profileContact.normalizeLocalNumber(
        settingsWhatsappInput.value,
        document.getElementById('settingsWhatsappDialCode').value
      );
    });
    settingsInstagramInput.addEventListener('input', () => settingsInstagramInput.setCustomValidity(''));
    settingsInstagramInput.addEventListener('blur', () => {
      settingsInstagramInput.value = profileContact.normalizeInstagramUsername(settingsInstagramInput.value);
    });
    accountForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!privateProfileFieldsLoaded) {
        showToast('Cannot save profile details until private data loads successfully. Reload the page and try again.');
        return;
      }
      if (!validateSettingsLocation()) return;
      const instagramUsername = profileContact.normalizeInstagramUsername(settingsInstagramInput.value);
      if (instagramUsername && !profileContact.isValidInstagramUsername(instagramUsername)) {
        settingsInstagramInput.setCustomValidity('Enter an Instagram username without a link.');
        settingsInstagramInput.reportValidity();
        return;
      }
      settingsInstagramInput.setCustomValidity('');
      profileData.displayName = document.getElementById('settingsDisplayName').value.trim();
      profileData.email = document.getElementById('settingsEmail').value.trim();
      profileData.gender = document.getElementById('settingsGender').value;
      profileData.birthday = document.getElementById('settingsBirthday').value;
      if (profileData.birthday) profileData.ageRange = getAgeRangeFromBirthday(profileData.birthday);
      profileData.country = settingsCountrySelect.value;
      profileData.city = settingsCityInput.value.trim();
      profileData.bio = document.getElementById('settingsBio').value.trim();
      profileData.whatsappDialCode = profileContact.normalizeDialCode(
        document.getElementById('settingsWhatsappDialCode').value
      );
      profileData.whatsapp = profileContact.combineWhatsappNumber(
        profileData.whatsappDialCode,
        settingsWhatsappInput.value
      );
      profileData.whatsappCustomized = true;
      if (isDeveloper) profileData.website = document.getElementById('settingsWebsite').value.trim();
      profileData.instagram = instagramUsername;

      try {
        await persistProfile(profileData, {includePrivateFields: true});
        settingsLocationInitialValue = {country: profileData.country, city: profileData.city};
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

    editSpecialtiesButton.addEventListener('click', () => {
      setSpecialtiesEditing(!isEditingSpecialties);
    });

    specialtyGrid.addEventListener('click', event => {
      const button = event.target.closest('[data-profile-specialty]');
      if (!button || !isEditingSpecialties) return;
      const specialty = button.dataset.profileSpecialty;
      const selected = specialtyDraft.some(item => item.toLowerCase() === specialty.toLowerCase());
      specialtyDraft = selected
        ? specialtyDraft.filter(item => item.toLowerCase() !== specialty.toLowerCase())
        : [...specialtyDraft, specialty];
      if (selected && specialty.toLowerCase() === 'other') specialtyOtherDraft = '';
      renderSpecialties();
      [...specialtyGrid.querySelectorAll('[data-profile-specialty]')]
        .find(item => item.dataset.profileSpecialty === specialty)
        ?.focus();
    });

    document.getElementById('settingsSpecialtyOther').addEventListener('input', event => {
      specialtyOtherDraft = event.target.value;
      if (event.target.dataset.validationAttempted === 'true') {
        const isValid = Boolean(specialtyOtherDraft.trim());
        event.target.setAttribute('aria-invalid', String(!isValid));
        document.getElementById('settingsSpecialtyOtherError').hidden = isValid;
      }
    });

    document.getElementById('saveProfileSpecialties').addEventListener('click', async () => {
      if (specialtyDraft.some(item => item.toLowerCase() === 'other') && !specialtyOtherDraft.trim()) {
        const otherInput = document.getElementById('settingsSpecialtyOther');
        otherInput.dataset.validationAttempted = 'true';
        otherInput.setAttribute('aria-invalid', 'true');
        document.getElementById('settingsSpecialtyOtherError').hidden = false;
        otherInput.focus();
        return;
      }
      try {
        profileData.specialty = [...specialtyDraft];
        profileData.specialtyOther = specialtyDraft.some(item => item.toLowerCase() === 'other')
          ? specialtyOtherDraft.trim()
          : '';
        await persistProfile(profileData);
        profileSpecialties = [...specialtyDraft];
        profileSpecialtyOther = profileData.specialtyOther;
        setSpecialtiesEditing(false);
        showToast('Specialization saved successfully!');
      } catch (error) {
        console.error('Unable to save profile specialization.', error);
        showToast('Unable to save specialization. Please try again.');
      }
    });

    document.getElementById('saveProfileSkills').addEventListener('click', async () => {
      addProfileSkill(skillInput.value);
      skillInput.value = '';
      try {
        profileData.skills = [...profileSkills];
        await persistProfile(profileData);
        setSkillsEditing(false);
        showToast('Skills & Tech Stacks saved successfully!');
      } catch (error) {
        console.error('Unable to save profile skills.', error);
        showToast('Unable to save skills. Please try again.');
      }
    });

    function validateExperienceEntry(entry) {
      const entryElement = experienceEntries.querySelector(`[data-experience-id="${entry.id}"]`);
      const currentYear = new Date().getFullYear();
      const hasStartYear = /^\d{4}$/.test(entry.startYear);
      const hasNumericEndYear = /^\d{4}$/.test(entry.endYear);
      const startYearIsFuture = hasStartYear && Number(entry.startYear) > currentYear;
      const endYearIsFuture = hasNumericEndYear && Number(entry.endYear) > currentYear;
      const yearsOutOfOrder = hasStartYear && hasNumericEndYear
        && Number(entry.startYear) > Number(entry.endYear);
      const validStartYear = hasStartYear && !startYearIsFuture;
      const validEndYear = /^(?:\d{4}|Present)$/.test(entry.endYear)
        && !startYearIsFuture && !endYearIsFuture && !yearsOutOfOrder;
      const isIndonesian = window.devMatchI18n?.getLanguage() === 'id';
      const startYearError = !hasStartYear
        ? isIndonesian ? 'Masukkan tahun mulai dengan 4 digit.' : 'Enter a 4-digit start year.'
        : '';
      const endYearErrors = [];

      if (!/^(?:\d{4}|Present)$/.test(entry.endYear)) {
        endYearErrors.push(isIndonesian
          ? 'Masukkan tahun selesai 4 digit atau kosongkan untuk Present.'
          : 'Enter a 4-digit end year, or leave blank for Present.');
      } else {
        if (startYearIsFuture || endYearIsFuture) {
          endYearErrors.push(isIndonesian
            ? 'Tahun tidak boleh melebihi tahun ini.'
            : 'Year cannot be later than current year.');
        }
        if (yearsOutOfOrder) {
          endYearErrors.push(isIndonesian
            ? 'Tahun selesai tidak boleh lebih kecil dari tahun mulai.'
            : 'End year cannot be earlier than start year.');
        }
      }

      const valid = {
        title: Boolean(entry.title.trim()),
        company: Boolean(entry.company.trim()),
        startYear: validStartYear,
        endYear: validEndYear
      };
      const messages = {
        title: isIndonesian ? 'Jabatan wajib diisi.' : 'Job title is required.',
        company: isIndonesian ? 'Nama perusahaan wajib diisi.' : 'Company name is required.',
        startYear: startYearError,
        endYear: endYearErrors.join('\n')
      };
      const fields = ['title', 'company', 'startYear', 'endYear'];
      let firstInvalidInput = null;

      fields.forEach(field => {
        const input = field === 'startYear' || field === 'endYear'
          ? entryElement.querySelector(`[data-experience-year="${field}"]`)
          : entryElement.querySelector(`[data-experience-field="${field}"]`);
        const error = entryElement.querySelector(`[data-experience-error="${field}"]`);
        input.setAttribute('aria-invalid', String(!valid[field]));
        error.textContent = valid[field] ? '' : messages[field];
        error.hidden = valid[field] || !messages[field];
        if (!valid[field] && !firstInvalidInput) firstInvalidInput = input;
      });

      return firstInvalidInput;
    }

    async function saveExperience(entry) {
      const firstInvalidInput = validateExperienceEntry(entry);
      if (firstInvalidInput) {
        entry.showValidationErrors = true;
        firstInvalidInput.focus();
        return;
      }

      entry.showValidationErrors = false;
      const uploadedFiles = [];
      const replacedFilePaths = [...(entry.filePaths || [])];
      const removedFilePaths = [...(entry.removedFilePaths || [])];
      try {
        for (const file of entry.pendingFiles || []) {
          uploadedFiles.push(await window.devMatchBackend.uploadPrivateFile('experience', '', file));
        }
        const savedExperience = {
          title: entry.title.trim(),
          company: entry.company.trim(),
          period: `${entry.startYear.trim()} – ${entry.endYear.trim()}`,
          link: entry.link.trim(),
          files: uploadedFiles.length ? uploadedFiles.map(file => file.name) : [...entry.files],
          filePaths: uploadedFiles.length ? uploadedFiles.map(file => file.path) : [...(entry.filePaths || [])]
        };
        const savedExperiences = Array.isArray(profileData.experiences)
          ? [...profileData.experiences]
          : [];
        const isNewExperience = !Number.isInteger(entry.persistedIndex);
        const nextSavedEntry = isNewExperience
          ? experienceDraft.slice(experienceDraft.indexOf(entry) + 1)
            .find(item => Number.isInteger(item.persistedIndex))
          : null;
        const experienceIndex = isNewExperience
          ? nextSavedEntry?.persistedIndex ?? savedExperiences.length
          : entry.persistedIndex;
        if (isNewExperience) savedExperiences.splice(experienceIndex, 0, savedExperience);
        else savedExperiences[experienceIndex] = savedExperience;
        const updatedProfile = {...profileData, experiences: savedExperiences};
        await persistProfile(updatedProfile);
        profileData = updatedProfile;
        localStorage.setItem(storageKey, JSON.stringify(updatedProfile));
        experienceDraft = savedExperiences.map((savedEntry, index) => ({
          id: String(index + 1),
          persistedIndex: index,
          title: String(savedEntry.title || ''),
          company: String(savedEntry.company || ''),
          ...parseExperiencePeriod(savedEntry.period),
          link: String(savedEntry.link || ''),
          files: Array.isArray(savedEntry.files) ? savedEntry.files.map(String) : [],
          filePaths: Array.isArray(savedEntry.filePaths) ? savedEntry.filePaths.map(String) : [],
          removedFilePaths: [],
          pendingFiles: [],
          editing: false
        }));
        nextExperienceId = experienceDraft.length;
        renderExperienceEntries();
        const cleanupPaths = [...new Set([
          ...removedFilePaths,
          ...(uploadedFiles.length ? replacedFilePaths : [])
        ])];
        if (cleanupPaths.length) {
          try {
            await window.devMatchBackend.removeUploadedFiles('private-uploads', cleanupPaths);
          } catch (cleanupError) {
            console.error('Experience was saved, but supporting files could not be deleted.', cleanupError);
            showToast('Experience saved, but some supporting files could not be deleted.');
            return;
          }
        }
        showToast('Experience saved successfully!');
      } catch (error) {
        if (uploadedFiles.length) {
          try {
            await window.devMatchBackend.removeUploadedFiles(
              'private-uploads',
              uploadedFiles.map(file => file.path)
            );
          } catch (cleanupError) {
            console.error('Unable to remove uploaded experience files after a failed save.', cleanupError);
          }
        }
        console.error('Unable to save profile experience.', error);
        showToast('Unable to save experience. Please try again.');
      }
    }

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

    function addProfileExperience() {
      experienceDraft.push({ id: String(++nextExperienceId), persistedIndex: null, title: '', company: '', startYear: '', endYear: 'Present', link: '', files: [], filePaths: [], removedFilePaths: [], pendingFiles: [], editing: true });
      renderExperienceEntries();
      const lastEntry = experienceEntries.lastElementChild;
      lastEntry.scrollIntoView({ behavior: 'smooth', block: 'end' });
      lastEntry.querySelector('[data-experience-field="title"]').focus({ preventScroll: true });
    }

    document.getElementById('addProfileExperience').addEventListener('click', addProfileExperience);
    document.getElementById('addProfileExperienceBottom').addEventListener('click', addProfileExperience);

    experienceEntries.addEventListener('focusin', event => {
      const input = event.target.closest('[data-experience-year="endYear"]');
      if (input?.value === 'Present') input.select();
    });

    let pendingExperienceDeleteId = null;
    let pendingExperienceDeletion = null;
    const experienceDeleteDialog = document.getElementById('experienceDeleteDialog');
    const experienceDeleteTitle = document.getElementById('experienceDeleteTitle');
    const experienceDeleteDescription = document.getElementById('experienceDeleteDescription');
    const EXPERIENCE_UNDO_DURATION = 4500;

    async function finalizeExperienceDeletion(deletion = pendingExperienceDeletion) {
      if (!deletion || pendingExperienceDeletion !== deletion) return;
      clearTimeout(deletion.timeout);
      pendingExperienceDeletion = null;
      if (!deletion.cleanupPaths.length) return;

      try {
        await window.devMatchBackend.removeUploadedFiles('private-uploads', deletion.cleanupPaths);
      } catch (error) {
        console.error('Experience was removed, but supporting files could not be deleted.', error);
        showToast('Experience removed, but some stored files could not be deleted.');
      }
    }

    async function undoExperienceDeletion(deletion) {
      if (pendingExperienceDeletion !== deletion) return false;
      clearTimeout(deletion.timeout);
      const restoreIndex = Number.isInteger(deletion.persistedIndex)
        ? Math.min(deletion.persistedIndex, (profileData.experiences || []).length)
        : null;

      if (deletion.savedExperience) {
        const savedExperiences = Array.isArray(profileData.experiences)
          ? [...profileData.experiences]
          : [];
        savedExperiences.splice(restoreIndex, 0, deletion.savedExperience);
        const updatedProfile = {...profileData, experiences: savedExperiences};
        try {
          await persistProfile(updatedProfile);
          profileData = updatedProfile;
          localStorage.setItem(storageKey, JSON.stringify(updatedProfile));
        } catch (error) {
          console.error('Unable to restore the deleted profile experience.', error);
          deletion.timeout = setTimeout(
            () => finalizeExperienceDeletion(deletion),
            EXPERIENCE_UNDO_DURATION
          );
          showToast(
            'Unable to restore experience. Please try again.',
            () => undoExperienceDeletion(deletion),
            EXPERIENCE_UNDO_DURATION
          );
          return false;
        }

        experienceDraft.forEach(item => {
          if (Number.isInteger(item.persistedIndex) && item.persistedIndex >= restoreIndex) {
            item.persistedIndex += 1;
          }
        });
      }

      const restoredEntry = {
        ...deletion.entry,
        files: [...deletion.entry.files],
        filePaths: [...deletion.entry.filePaths],
        removedFilePaths: [...deletion.entry.removedFilePaths],
        pendingFiles: [...deletion.entry.pendingFiles]
      };
      if (restoreIndex !== null) restoredEntry.persistedIndex = restoreIndex;
      const draftIndex = restoreIndex === null
        ? experienceDraft.length
        : experienceDraft.findIndex(item =>
            Number.isInteger(item.persistedIndex) && item.persistedIndex >= restoreIndex
          );
      experienceDraft.splice(draftIndex < 0 ? experienceDraft.length : draftIndex, 0, restoredEntry);
      nextExperienceId = experienceDraft.reduce((max, entry) => Math.max(max, Number(entry.id) || 0), 0);
      pendingExperienceDeletion = null;
      renderExperienceEntries();

      const retainedPaths = new Set(
        (deletion.savedExperience?.filePaths || []).map(String)
      );
      const cleanupPaths = deletion.cleanupPaths.filter(path => !retainedPaths.has(String(path)));
      if (cleanupPaths.length) {
        try {
          await window.devMatchBackend.removeUploadedFiles('private-uploads', cleanupPaths);
        } catch (error) {
          console.error('Experience was restored, but removed supporting files could not be deleted.', error);
          showToast('Experience restored, but some removed files could not be deleted.');
          return false;
        }
      }
      return true;
    }

    async function removeExperience(entryId) {
      const entryIndex = experienceDraft.findIndex(entry => entry.id === entryId);
      if (entryIndex < 0) return;
      if (pendingExperienceDeletion) {
        await finalizeExperienceDeletion();
      }
      const entry = experienceDraft[entryIndex];
      let savedExperience = null;
      if (Number.isInteger(entry.persistedIndex)) {
        const savedExperiences = Array.isArray(profileData.experiences)
          ? [...profileData.experiences]
          : [];
        savedExperience = savedExperiences[entry.persistedIndex];
        savedExperiences.splice(entry.persistedIndex, 1);
        try {
          const updatedProfile = {...profileData, experiences: savedExperiences};
          await persistProfile(updatedProfile);
          profileData = updatedProfile;
          localStorage.setItem(storageKey, JSON.stringify(updatedProfile));
          experienceDraft.forEach(item => {
            if (Number.isInteger(item.persistedIndex) && item.persistedIndex > entry.persistedIndex) {
              item.persistedIndex -= 1;
            }
          });
        } catch (error) {
          console.error('Unable to remove profile experience.', error);
          showToast('Unable to remove experience. Please try again.');
          return;
        }
      }
      const deletion = {
        entry: {
          ...entry,
          files: [...entry.files],
          filePaths: [...entry.filePaths],
          removedFilePaths: [...entry.removedFilePaths],
          pendingFiles: [...entry.pendingFiles]
        },
        savedExperience: savedExperience && typeof savedExperience === 'object'
          ? {...savedExperience}
          : null,
        persistedIndex: entry.persistedIndex,
        cleanupPaths: [...new Set([
          ...(Array.isArray(entry.filePaths) ? entry.filePaths : []),
          ...(Array.isArray(entry.removedFilePaths) ? entry.removedFilePaths : [])
        ])],
        timeout: null
      };
      experienceDraft.splice(entryIndex, 1);
      nextExperienceId = experienceDraft.reduce((max, entry) => Math.max(max, Number(entry.id) || 0), 0);
      renderExperienceEntries();
      pendingExperienceDeletion = deletion;
      showToast(
        'Experience removed successfully!',
        () => undoExperienceDeletion(deletion),
        EXPERIENCE_UNDO_DURATION
      );
      deletion.timeout = setTimeout(
        () => finalizeExperienceDeletion(deletion),
        EXPERIENCE_UNDO_DURATION
      );
    }

    function cancelExperienceEdit(entryId) {
      const entryIndex = experienceDraft.findIndex(entry => entry.id === entryId);
      if (entryIndex < 0) return;
      const entry = experienceDraft[entryIndex];
      if (!Number.isInteger(entry.persistedIndex)) {
        experienceDraft.splice(entryIndex, 1);
        nextExperienceId = experienceDraft.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
        renderExperienceEntries();
        return;
      }

      const savedEntry = profileData.experiences?.[entry.persistedIndex];
      if (!savedEntry || typeof savedEntry !== 'object') {
        console.error('Unable to restore the saved profile experience.');
        showToast('Unable to cancel experience changes. Please reload and try again.');
        return;
      }
      Object.assign(entry, {
        title: String(savedEntry.title || ''),
        company: String(savedEntry.company || ''),
        ...parseExperiencePeriod(savedEntry.period),
        link: String(savedEntry.link || ''),
        files: Array.isArray(savedEntry.files) ? savedEntry.files.map(String) : [],
        filePaths: Array.isArray(savedEntry.filePaths) ? savedEntry.filePaths.map(String) : [],
        removedFilePaths: [],
        pendingFiles: [],
        editing: false,
        showValidationErrors: false
      });
      renderExperienceEntries();
    }

    closeExperienceEditors = exceptId => {
      experienceDraft
        .filter(entry => entry.editing && entry.id !== exceptId)
        .map(entry => entry.id)
        .forEach(cancelExperienceEdit);
    };

    document.getElementById('confirmExperienceDelete').addEventListener('click', async () => {
      if (pendingExperienceDeleteId) await removeExperience(pendingExperienceDeleteId);
      experienceDeleteDialog.close();
    });

    document.getElementById('cancelExperienceDelete').addEventListener('click', () => {
      experienceDeleteDialog.close();
    });

    experienceDeleteDialog.addEventListener('click', event => {
      if (event.target === experienceDeleteDialog) experienceDeleteDialog.close();
    });

    experienceDeleteDialog.addEventListener('close', () => {
      pendingExperienceDeleteId = null;
    });

    experienceEntries.addEventListener('click', async event => {
      const chooseFileButton = event.target.closest('[data-choose-experience-file]');
      if (chooseFileButton) {
        const input = chooseFileButton.closest('.settings-experience-file-picker')?.querySelector('[data-experience-file]');
        if (!input) {
          console.error('Unable to open the experience file picker.');
          showToast('Unable to open the file picker. Please try again.');
          return;
        }
        input.click();
        return;
      }

      const removeFileButton = event.target.closest('[data-remove-experience-file]');
      if (removeFileButton) {
        const entry = experienceDraft.find(item => item.id === removeFileButton.dataset.removeExperienceFile);
        const fileIndex = Number(removeFileButton.dataset.fileIndex);
        if (!entry?.editing || !Number.isInteger(fileIndex) || fileIndex < 0) return;
        const [removedPath] = entry.filePaths.splice(fileIndex, 1);
        entry.files.splice(fileIndex, 1);
        if (removedPath) entry.removedFilePaths.push(removedPath);
        renderExperienceEntries();
        const entryElement = experienceEntries.querySelector(`[data-experience-id="${entry.id}"]`);
        (entryElement.querySelector('[data-remove-experience-file]') || entryElement.querySelector('[data-experience-file]')).focus();
        return;
      }

      const downloadButton = event.target.closest('[data-download-experience-file]');
      if (downloadButton) {
        const entry = experienceDraft.find(item => item.id === downloadButton.dataset.downloadExperienceFile);
        const path = entry?.filePaths?.[Number(downloadButton.dataset.fileIndex)];
        if (!path) return;
        downloadButton.disabled = true;
        try {
          const fileName = entry.files[Number(downloadButton.dataset.fileIndex)];
          const url = await window.devMatchBackend.createPrivateFileUrl(path, fileName);
          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.click();
        } catch (error) {
          console.error('Unable to access the private experience file.', error);
          showToast(error.message || 'Unable to open this supporting file.');
        } finally {
          downloadButton.disabled = false;
        }
        return;
      }

      const editButton = event.target.closest('[data-edit-experience]');
      if (editButton) {
        const entryId = editButton.dataset.editExperience;
        closeExperienceEditors(entryId);
        const entry = experienceDraft.find(item => item.id === entryId);
        if (!entry) return;
        entry.editing = true;
        renderExperienceEntries();
        experienceEntries.querySelector(`[data-experience-id="${entry.id}"] [data-experience-field="title"]`).focus();
        return;
      }

      const saveButton = event.target.closest('[data-save-experience]');
      if (saveButton) {
        const entry = experienceDraft.find(item => item.id === saveButton.dataset.saveExperience);
        if (entry) saveExperience(entry);
        return;
      }

      const cancelButton = event.target.closest('[data-cancel-experience]');
      if (cancelButton) {
        cancelExperienceEdit(cancelButton.dataset.cancelExperience);
        return;
      }

      const button = event.target.closest('[data-remove-experience]');
      if (!button) return;
      const entryIndex = experienceDraft.findIndex(entry => entry.id === button.dataset.removeExperience);
      if (entryIndex < 0) return;
      pendingExperienceDeleteId = experienceDraft[entryIndex].id;
      const isIndonesian = window.devMatchI18n?.getLanguage() === 'id';
      experienceDeleteTitle.textContent = isIndonesian ? 'Hapus pengalaman?' : 'Delete experience?';
      experienceDeleteDescription.textContent = isIndonesian
        ? `Apakah Anda yakin ingin menghapus pengalaman nomor ${entryIndex + 1}?`
        : `Are you sure you want to delete experience ${entryIndex + 1}?`;
      experienceDeleteDialog.showModal();
    });

    experienceEntries.addEventListener('input', event => {
      const yearInput = event.target.closest('[data-experience-year]');
      if (yearInput) {
        const entry = experienceDraft.find(item => item.id === yearInput.closest('[data-experience-id]').dataset.experienceId);
        if (!entry) return;
        const year = yearInput.value.replace(/\D/g, '').slice(0, 4);
        if (yearInput.value !== year) yearInput.value = year;
        entry[yearInput.dataset.experienceYear] = year;
        if (entry.showValidationErrors) validateExperienceEntry(entry);
        return;
      }

      const input = event.target.closest('[data-experience-field]');
      if (!input) return;
      const entry = experienceDraft.find(item => item.id === input.closest('[data-experience-id]').dataset.experienceId);
      if (entry) entry[input.dataset.experienceField] = input.value;
      if (entry?.showValidationErrors) validateExperienceEntry(entry);
    });

    experienceEntries.addEventListener('focusout', event => {
      const yearInput = event.target.closest('[data-experience-year="endYear"]');
      if (!yearInput || yearInput.value) return;
      const entry = experienceDraft.find(item => item.id === yearInput.closest('[data-experience-id]').dataset.experienceId);
      if (!entry) return;
      yearInput.value = 'Present';
      entry.endYear = 'Present';
      if (entry.showValidationErrors) validateExperienceEntry(entry);
    });

    experienceEntries.addEventListener('change', event => {
      const input = event.target.closest('[data-experience-file]');
      if (!input) return;
      const entry = experienceDraft.find(item => item.id === input.closest('[data-experience-id]').dataset.experienceId);
      if (!entry) return;
      const fileError = input.closest('.settings-field')?.querySelector('[data-experience-file-error]');
      if (!fileError) {
        console.error('Unable to display experience file validation errors.');
        showToast('Unable to validate the selected file. Please try again.');
        return;
      }
      const selectedFiles = Array.from(input.files || []);
      if (selectedFiles.length > 1) {
        input.value = '';
        fileError.textContent = '';
        fileError.hidden = true;
        showToast('Only one supporting file can be selected per experience.');
        return;
      }
      if (selectedFiles[0]?.size > MAX_EXPERIENCE_FILE_SIZE) {
        input.value = '';
        fileError.textContent = 'Supporting file must be 5 MB or smaller.';
        fileError.hidden = false;
        return;
      }
      fileError.textContent = '';
      fileError.hidden = true;
      entry.pendingFiles = selectedFiles;
      const names = entry.pendingFiles.length
        ? entry.pendingFiles.map(file => file.name)
        : entry.files;
      const fileNames = input.closest('.settings-experience-file-picker')?.querySelector('[data-experience-file-name]');
      if (!fileNames) {
        console.error('Unable to display the selected experience files.');
        showToast('Unable to display the selected files. Please try again.');
        return;
      }
      fileNames.textContent = names.join(', ') || 'No file chosen';
      fileNames.title = fileNames.textContent;
    });
  }

  // Role Specific Form Submission (Dev rates/payouts OR Client company/billing)
  const roleForm = document.getElementById('roleSpecificForm');
  if (roleForm) {
    if (isDeveloper) {
      ['settingsHourlyRate', 'settingsMinProject'].forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener('input', () => {
          const digitsBeforeCursor = priceDigits(input.value.slice(0, input.selectionStart)).length;
          const formatted = formatRupiah(input.value);
          if (input.value !== formatted) {
            input.value = formatted;
            let cursor = 3;
            if (digitsBeforeCursor) {
              let digitsSeen = 0;
              for (let index = 0; index < formatted.length; index++) {
                if (/\d/.test(formatted[index])) digitsSeen++;
                if (digitsSeen === digitsBeforeCursor) {
                  cursor = index + 1;
                  break;
                }
              }
            }
            input.setSelectionRange(cursor, cursor);
          }
        });
      });
    }

    roleForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!privateProfileFieldsLoaded) {
        showToast('Cannot save settings until private payout and tax details load successfully.');
        return;
      }
      if (isDeveloper) {
        profileData.hourlyRate = formatRupiah(document.getElementById('settingsHourlyRate').value);
        profileData.minProjectPrice = formatRupiah(document.getElementById('settingsMinProject').value);
        profileData.availability = document.getElementById('settingsAvailability').value;
        profileData.experience = document.getElementById('settingsExperienceLevel').value;
        profileData.bankName = document.getElementById('settingsBankName').value;
        profileData.accountNumber = document.getElementById('settingsBankAccount').value.trim();
        profileData.accountHolder = document.getElementById('settingsAccountHolder').value.trim();
      } else {
        profileData.companyName = document.getElementById('settingsCompanyName').value.trim();
        profileData.industry = document.getElementById('settingsIndustry').value.trim();
        profileData.npwp = document.getElementById('settingsNpwp').value.trim();
      }

      try {
        await persistProfile(profileData, {includePrivateFields: true});
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
    const parts = profileContact.splitWhatsappNumber(value, '', '');
    return parts.number ? `+${parts.dialCode} ${parts.number}` : '';
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

    passwordForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const isValid = passwordFields.map(validatePasswordField).every(Boolean);
      if (!isValid) {
        const firstInvalidField = passwordFields.find(field => field.input.getAttribute('aria-invalid') === 'true');
        firstInvalidField.input.focus();
        return;
      }

      const button=passwordForm.querySelector('[type="submit"]');
      if(button?.disabled)return;
      if(button)button.disabled=true;
      try{
        await window.devMatchBackend.changePassword(passwordFields[0].input.value,newPasswordInput.value);
      }catch(error){
        if(error.code==='invalid_credentials'||error.code==='invalid_login_credentials')passwordForm.dispatchEvent(new Event('passwordchange:rejected'));
        else showToast(error.message||'Unable to update password. Please try again.');
        return;
      }finally{if(button)button.disabled=false;}
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

  const twoFactorToggle=document.getElementById('twoFactorToggle');
  if(twoFactorToggle){twoFactorToggle.disabled=true;twoFactorToggle.checked=false;}
  document.querySelectorAll('.settings-session-item:not(.current-session)').forEach(item=>{
    if(item.parentElement.querySelector('.current-session'))item.remove();
  });
  const logoutSessionsBtn=document.getElementById('logoutSessionsBtn');
  if(logoutSessionsBtn)logoutSessionsBtn.addEventListener('click',async()=>{
    if(logoutSessionsBtn.disabled||!confirm('Log out all other sessions?'))return;
    logoutSessionsBtn.disabled=true;
    try{
      const {error}=await window.devMatchBackend.client.auth.signOut({scope:'others'});
      if(error)throw error;
      showToast('Other sessions signed out. Existing access tokens expire according to the session policy.');
    }catch(error){showToast(error.message||'Unable to sign out other sessions.');}
    finally{logoutSessionsBtn.disabled=false;}
  });

  // Notification Preferences Form
  async function savePreferences(form){
    const values=Object.fromEntries([...form.querySelectorAll('input,select,textarea')].map((field,index)=>[field.id||String(index),field.type==='checkbox'?field.checked:field.value]));
    const updated={...profileData,preferences:{...profileData.preferences,[form.id]:values}};
    await persistProfile(updated);profileData=updated;
  }
  const notifForm = document.getElementById('notificationsForm');
  if (notifForm) {
    notifForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      try{await savePreferences(notifForm);showToast('Notification preferences saved.');}
      catch(error){showToast('Unable to save notification preferences. Please try again.');}
    });
  }

  // Privacy Preferences Form
  const privacyForm = document.getElementById('privacyForm');
  if (privacyForm) {
    privacyForm.addEventListener('submit', function(e) {
      e.preventDefault();
      showToast('Privacy controls are not available yet. Your account data remains private.');
    });
  }

  // General Platform Preferences Form
  const preferencesForm = document.getElementById('preferencesForm');
  const interfaceLanguageSelect = document.getElementById('settingLanguage');
  if (interfaceLanguageSelect && window.devMatchI18n) {
    interfaceLanguageSelect.value = window.devMatchI18n.getLanguage();
  }

  if (preferencesForm) {
    preferencesForm.addEventListener('submit', async function(e) {
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
      try{await savePreferences(preferencesForm);showToast('Platform preferences saved.');}
      catch(error){showToast('Unable to save preferences. Please try again.');}
    });
  }

  // Account removal requires a server operation; do not imitate it in browser storage.
  [notifForm,preferencesForm].filter(Boolean).forEach(form=>{
    const saved=profileData.preferences?.[form.id]||{};
    form.querySelectorAll('input,select,textarea').forEach((field,index)=>{
      const key=field.id||String(index);
      if(Object.hasOwn(saved,key)){
        if(field.type==='checkbox')field.checked=Boolean(saved[key]);
        else{field.value=saved[key];field.dispatchEvent(new Event('change',{bubbles:true}));}
      }
      if(field.type==='checkbox'&&!field.getAttribute('aria-label')){
        const label=field.closest('.settings-toggle-row')?.querySelector('h3')?.textContent;
        if(label)field.setAttribute('aria-label',label.trim());
      }
    });
  });
  privacyForm?.querySelectorAll('select,button[type="submit"]').forEach(field=>{field.disabled=true;});
  ['deactivateAccountBtn','deleteAccountBtn'].forEach(id=>{const button=document.getElementById(id);if(button){button.disabled=true;button.title='Account removal is not available yet.';}});

  let pendingDisconnect = null;
  const appDisconnectDialog = document.getElementById('appDisconnectDialog');
  const appDisconnectTitle = document.getElementById('appDisconnectTitle');
  const appDisconnectDescription = document.getElementById('appDisconnectDescription');
  const confirmAppDisconnect = document.getElementById('confirmAppDisconnect');

  // Connected Apps toggle
  document.querySelectorAll('[data-app-toggle]').forEach(btn => {
    btn.addEventListener('click', async function() {
      const app = this.dataset.appToggle;
      const field = appConnectionFields[app];
      const isConnected = this.dataset.connected === 'true';

      if (isConnected) {
        pendingDisconnect = { button: this, field, app };
        appDisconnectTitle.textContent = `Disconnect ${app}?`;
        appDisconnectDescription.textContent = `This will disconnect ${app} from your DEV-MATCH account.`;
        appDisconnectDialog.showModal();
      } else {
        await updateAppConnection(this, field, true, app);
      }
    });
  });

  confirmAppDisconnect.addEventListener('click', async () => {
    if (!pendingDisconnect) return;
    const { button, field, app } = pendingDisconnect;
    if (await updateAppConnection(button, field, false, app)) {
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

  async function updateAppConnection(button, field, connected, app) {
    if (!field) {
      console.error(`No profile connection field is configured for ${app}.`);
      showToast(`Could not update ${app} connection.`);
      return false;
    }

    const updatedProfile = { ...profileData, [field]: connected };
    try {
      await persistProfile(updatedProfile);
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
      save: value => {
        const parts = profileContact.splitWhatsappNumber(value, profileData.whatsappDialCode, profileData.country);
        return {
          whatsappDialCode: parts.dialCode,
          whatsapp: profileContact.combineWhatsappNumber(parts.dialCode, parts.number),
          whatsappCustomized: true,
          whatsappConnected: true
        };
      },
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
    appEditForm.addEventListener('submit', async event => {
      event.preventDefault();
      const config = appEditConfig[editingApp];
      if (!config || !appEditValue) return;
      const value = appEditValue.value.trim();
      const validationMessage = config.validate(value);
      appEditValue.setCustomValidity(validationMessage);
      if (!appEditForm.reportValidity()) return;

      const updatedProfile = { ...profileData, ...config.save(value) };
      try {
        await persistProfile(updatedProfile);
      } catch (error) {
        console.error(`Unable to save ${editingApp} account details.`, error);
        showToast(`Could not save ${editingApp} account details.`);
        return;
      }

      profileData = updatedProfile;
      renderAppConnection(editingApp, true);
      if (editingApp === 'WhatsApp') {
        const whatsappField = document.getElementById('settingsWhatsapp');
        const whatsappDialCode = document.getElementById('settingsWhatsappDialCode');
        const parts = profileContact.splitWhatsappNumber(
          profileData.whatsapp,
          profileData.whatsappDialCode,
          profileData.country
        );
        if (whatsappField) whatsappField.value = parts.number;
        if (whatsappDialCode) whatsappDialCode.value = parts.dialCode;
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

    resetAvatarBtn.addEventListener('click', async () => {
      const updatedProfile = { ...profileData };
      const previousAvatar = profileData.avatar;
      delete updatedProfile.avatar;
      try {
        await persistProfile(updatedProfile);
      } catch (error) {
        console.error('Unable to reset the profile photo.', error);
        showToast('Could not reset the photo. Check available browser storage and try again.');
        setAvatarMenuOpen(false);
        return;
      }

      profileData = updatedProfile;
      updateAvatarPreview();
      setAvatarMenuOpen(false);
      try {
        await window.devMatchBackend.removeProfileAvatar(previousAvatar);
        showToast('Profile photo reset to default.');
      } catch (error) {
        console.error('Profile photo was reset, but the old Storage file could not be removed.', error);
        showToast('Profile photo reset. The old file could not be removed from Storage.');
      }
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
      let uploadedAvatar = null;
      try {
        let avatar;
        try {
          const compressed = await compressAvatar(file);
          const response = await fetch(compressed);
          const blob = await response.blob();
          uploadedAvatar = await window.devMatchBackend.uploadProfileAvatar(blob);
          avatar = uploadedAvatar.url;
        } catch (error) {
          console.error('Unable to upload the profile photo to Supabase Storage.', error);
          showToast(error.message || 'The selected image could not be uploaded.');
          return;
        }

        const updatedProfile = { ...profileData, avatar };
        try {
          await persistProfile(updatedProfile);
        } catch (error) {
          console.error('Unable to save the uploaded profile photo reference.', error);
          if (uploadedAvatar) {
            try {
              await window.devMatchBackend.removeUploadedFiles('project-media', [uploadedAvatar.path]);
            } catch (cleanupError) {
              console.error('Unable to remove the uploaded photo after profile save failed.', cleanupError);
            }
          }
          showToast('The photo uploaded, but its profile reference could not be saved.');
          return;
        }
        const previousAvatar = profileData.avatar;
        profileData = updatedProfile;
        updateAvatarPreview();
        try {
          await window.devMatchBackend.removeProfileAvatar(previousAvatar);
          showToast('Profile photo updated successfully!');
        } catch (error) {
          console.error('Profile photo was updated, but the previous Storage file could not be removed.', error);
          showToast('Profile photo updated. The previous file could not be removed from Storage.');
        }
      } finally {
        changeAvatarBtn.disabled = false;
        this.value = '';
      }
    });
  }

  // Setup mode links in topbar / sidebar
  function setupWorkspaceLinks() {
    document.body.classList.toggle('client-shell-page', !isDeveloper);
    window.DEVMATCH_SIDEBAR_NAVIGATION?.setWorkspace(isDeveloper ? 'developer' : 'client');
    if (!isDeveloper) {
      const brand = document.querySelector('.topbar .brand');
      if (brand) brand.href = 'devmatch-client-dashboard.html';
      const userLink = document.querySelector('.topbar .user-menu');
      if (userLink) userLink.href = 'devmatch-my-profile.html?role=client';

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
  if (mobileSettingsDetailBreakpoint.matches && !window.location.hash) {
    const menuRole = isDeveloper ? 'dev' : 'client';
    window.location.replace(`devmatch-my-profile.html?role=${menuRole}&openSettings=1`);
    return;
  }
  const hashScrollTarget = initHashTab();
  (async () => {
    try {
      const user = await window.devMatchBackend.ready;
      if (!user) return;
      profileData = getProfile();
      applyConnectionDefaults(profileData);
      ['bankName', 'accountNumber', 'accountHolder', 'npwp', 'birthday'].forEach(field => delete profileData[field]);
      Object.assign(profileData, await window.devMatchBackend.loadPrivateProfileFields());
      await settingsLocationDataPromise;
      privateProfileFieldsLoaded = true;
      populateForm();
      openProfileDetailsTarget();
    } catch (error) {
      console.error('Unable to load saved profile settings.', error);
      await settingsLocationDataPromise;
      populateForm();
      openProfileDetailsTarget();
      showToast('Unable to load saved profile settings. Reload the page and try again.');
    } finally {
      document.body.classList.remove('devmatch-settings-loading');
      settingsContent?.removeAttribute('inert');
      settingsContent?.removeAttribute('aria-busy');
      mobileSettingsDetailContent?.removeAttribute('inert');
      mobileSettingsDetailContent?.setAttribute('aria-busy', 'false');
      mobileSettingsDetailPage?.setAttribute('aria-busy', 'false');
      if (mobileSettingsDetailPage && !mobileSettingsDetailPage.hidden) {
        mobileSettingsDetailPage.querySelector('.mobile-settings-detail-back')?.focus();
      }
      if (hashScrollTarget && window.location.hash === `#${hashScrollTarget.id}`) {
        requestAnimationFrame(() => hashScrollTarget.scrollIntoView({block: 'start', behavior: 'instant'}));
      }
    }
  })();

})();
