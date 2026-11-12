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
  let privateProfileFieldsLoaded = false;

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
      googleConnected: false,
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
      companyName: 'PT Ombak Bistro Mandiri',
      industry: 'Food & Beverage',
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
    googleConnected: false,
    linkedinConnected: Boolean(profileData.linkedinUrl || profileData.linkedin)
  };
  Object.entries(connectionDefaults).forEach(([field, defaultValue]) => {
    if (typeof profileData[field] !== 'boolean') {
      profileData[field] = defaultValue;
    }
  });

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
    experienceEntries.innerHTML = experienceDraft.map((entry, index) => `
      <fieldset class="settings-experience-entry" data-experience-id="${entry.id}">
        <div class="settings-experience-entry-heading"><b>Experience <span>${index + 1}</span></b>${entry.editing
          ? `<button class="settings-experience-remove" type="button" data-remove-experience="${entry.id}" aria-label="Remove experience ${index + 1}" title="Remove experience"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2m3 0-.9 14H5.9L5 6"/><path d="M10 11v5m4-5v5"/></svg></button>`
          : `<button class="settings-experience-edit" type="button" data-edit-experience="${entry.id}">Edit</button>`}</div>
        <div class="settings-experience-fields">
          <label class="settings-field"><span class="settings-label"><span>Job title</span><span class="settings-required-mark" aria-hidden="true">*</span></span><input class="settings-input" data-experience-field="title" aria-describedby="settingsExperience-${entry.id}-title-error" maxlength="80" placeholder="e.g. Frontend Developer" value="${escapeHtml(entry.title)}"${entry.editing ? '' : ' disabled'} required><span class="settings-field-error" id="settingsExperience-${entry.id}-title-error" data-experience-error="title" role="alert" hidden></span></label>
          <label class="settings-field"><span class="settings-label"><span>Company</span><span class="settings-required-mark" aria-hidden="true">*</span></span><input class="settings-input" data-experience-field="company" aria-describedby="settingsExperience-${entry.id}-company-error" maxlength="80" placeholder="Company name" value="${escapeHtml(entry.company)}"${entry.editing ? '' : ' disabled'} required><span class="settings-field-error" id="settingsExperience-${entry.id}-company-error" data-experience-error="company" role="alert" hidden></span></label>
          <div class="settings-field"><span class="settings-label"><span>Period</span><span class="settings-required-mark" aria-hidden="true">*</span></span><div class="settings-experience-period-control"><div class="settings-experience-year-field"><input class="settings-input" data-experience-year="startYear" aria-label="Start year" aria-describedby="settingsExperience-${entry.id}-startYear-error" inputmode="numeric" pattern="[0-9]{4}" placeholder="YYYY" value="${escapeHtml(entry.startYear)}"${entry.editing ? '' : ' disabled'} required><span class="settings-field-error" id="settingsExperience-${entry.id}-startYear-error" data-experience-error="startYear" role="alert" hidden></span></div><span class="settings-experience-period-separator" aria-hidden="true">–</span><div class="settings-experience-year-field"><input class="settings-input" data-experience-year="endYear" aria-label="End year" aria-describedby="settingsExperience-${entry.id}-endYear-error" inputmode="numeric" pattern="[0-9]{4}" placeholder="YYYY" value="${escapeHtml(entry.endYear)}"${entry.editing ? '' : ' disabled'} required></div><span class="settings-field-error settings-experience-period-error" id="settingsExperience-${entry.id}-endYear-error" data-experience-error="endYear" role="alert" hidden></span></div></div>
          <label class="settings-field"><span class="settings-label"><span>Portfolio link</span><small>(Optional)</small></span><input class="settings-input" data-experience-field="link" type="url" placeholder="https://example.com" value="${escapeHtml(entry.link)}"${entry.editing ? '' : ' disabled'}></label>
          <label class="settings-field span-2"><span class="settings-label"><span>Upload supporting files</span><small>(Optional)</small></span><input class="settings-input" data-experience-file type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" multiple${entry.editing ? '' : ' disabled'}><span class="settings-hint settings-experience-files${entry.files.length?' settings-experience-file-value':''}">${escapeHtml(entry.files.join(', ') || 'PDF, DOC, DOCX, JPG, or PNG')}</span></label>
        </div>
        ${entry.editing ? `<footer class="settings-card-footer settings-experience-entry-footer"><button class="settings-btn primary" type="button" data-save-experience="${entry.id}">Save Experience</button></footer>` : ''}
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
    profileSpecialties = normalizeSpecialties(profileData.specialty === undefined && isDeveloper
      ? ['Full-stack']
      : profileData.specialty);
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
      : defaultExperiences;
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
          files: Array.isArray(item.files) ? item.files.map(String) : []
        }));
    renderExperienceEntries();

    if (isDeveloper) {
      setVal('settingsHourlyRate', formatRupiah(profileData.hourlyRate || '150000'));
      setVal('settingsMinProject', formatRupiah(profileData.minProjectPrice || '3500000'));
      setVal('settingsAvailability', profileData.availability || 'Open for hiring');
      setVal('settingsBankName', profileData.bankName || 'BCA');
      setVal('settingsBankAccount', profileData.accountNumber || '');
      setVal('settingsAccountHolder', profileData.accountHolder || '');
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

  async function persistProfile(value, options){
    await window.devMatchBackend.saveProfile(value, options);
  }
  // Identity changes require a separate verified flow, not a profile save.
  ['settingsEmail','settingsUsername'].forEach(id=>{
    const input=document.getElementById(id);
    if(input){input.readOnly=true;input.title='This account identifier cannot be changed here.';}
  });

  // Account Form Submission
  const accountForm = document.getElementById('accountForm');
  if (accountForm) {
    accountForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      profileData.displayName = document.getElementById('settingsDisplayName').value.trim();
      profileData.username = document.getElementById('settingsUsername').value.trim();
      profileData.email = document.getElementById('settingsEmail').value.trim();
      profileData.city = document.getElementById('settingsCity').value.trim();
      profileData.bio = document.getElementById('settingsBio').value.trim();
      profileData.whatsapp = document.getElementById('settingsWhatsapp').value.trim().replace(/\D/g, '');

      try {
        await persistProfile(profileData);
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
      try {
        const savedExperience = {
          title: entry.title.trim(),
          company: entry.company.trim(),
          period: `${entry.startYear.trim()} – ${entry.endYear.trim()}`,
          link: entry.link.trim(),
          files: [...entry.files]
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
        localStorage.setItem(storageKey, JSON.stringify({ ...profileData, experiences: savedExperiences }));
        profileData.experiences = savedExperiences;
        await persistProfile(profileData);
        experienceDraft = savedExperiences.map((savedEntry, index) => ({
          id: String(index + 1),
          persistedIndex: index,
          title: String(savedEntry.title || ''),
          company: String(savedEntry.company || ''),
          ...parseExperiencePeriod(savedEntry.period),
          link: String(savedEntry.link || ''),
          files: Array.isArray(savedEntry.files) ? savedEntry.files.map(String) : [],
          editing: false
        }));
        nextExperienceId = experienceDraft.length;
        renderExperienceEntries();
        showToast('Experience saved successfully!');
      } catch (error) {
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

    document.getElementById('addProfileExperience').addEventListener('click', () => {
      experienceDraft.push({ id: String(++nextExperienceId), persistedIndex: null, title: '', company: '', startYear: '', endYear: 'Present', link: '', files: [], editing: true });
      renderExperienceEntries();
      const lastEntry = experienceEntries.lastElementChild;
      lastEntry.querySelector('[data-experience-field="title"]').focus();
    });

    experienceEntries.addEventListener('focusin', event => {
      const input = event.target.closest('[data-experience-year="endYear"]');
      if (input?.value === 'Present') input.select();
    });

    let pendingExperienceDeleteId = null;
    const experienceDeleteDialog = document.getElementById('experienceDeleteDialog');
    const experienceDeleteTitle = document.getElementById('experienceDeleteTitle');
    const experienceDeleteDescription = document.getElementById('experienceDeleteDescription');

    function removeExperience(entryId) {
      const entryIndex = experienceDraft.findIndex(entry => entry.id === entryId);
      if (entryIndex < 0) return;
      const entry = experienceDraft[entryIndex];
      if (Number.isInteger(entry.persistedIndex)) {
        const savedExperiences = Array.isArray(profileData.experiences)
          ? [...profileData.experiences]
          : [];
        savedExperiences.splice(entry.persistedIndex, 1);
        try {
          localStorage.setItem(storageKey, JSON.stringify({ ...profileData, experiences: savedExperiences }));
          profileData.experiences = savedExperiences;
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
      experienceDraft.splice(entryIndex, 1);
      nextExperienceId = experienceDraft.reduce((max, entry) => Math.max(max, Number(entry.id) || 0), 0);
      renderExperienceEntries();
    }

    document.getElementById('confirmExperienceDelete').addEventListener('click', () => {
      if (pendingExperienceDeleteId) removeExperience(pendingExperienceDeleteId);
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

      const saveButton = event.target.closest('[data-save-experience]');
      if (saveButton) {
        const entry = experienceDraft.find(item => item.id === saveButton.dataset.saveExperience);
        if (entry) saveExperience(entry);
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
        ? `Apakah Anda yakin ingin menghapus pengalaman nomor ${entryIndex + 1}? Tindakan ini tidak dapat dibatalkan.`
        : `Are you sure you want to delete experience ${entryIndex + 1}? This cannot be undone.`;
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
      entry.files = Array.from(input.files || []).map(file => file.name);
      const fileNames = input.nextElementSibling;
      fileNames.textContent = entry.files.join(', ') || 'PDF, DOC, DOCX, JPG, or PNG';
      fileNames.classList.toggle('settings-experience-file-value', entry.files.length > 0);
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

    resetAvatarBtn.addEventListener('click', async () => {
      const updatedProfile = { ...profileData };
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
          await persistProfile(updatedProfile);
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
  initHashTab();
  (async () => {
    ['bankName', 'accountNumber', 'accountHolder', 'npwp'].forEach(field => delete profileData[field]);
    try {
      Object.assign(profileData, await window.devMatchBackend.loadPrivateProfileFields());
      privateProfileFieldsLoaded = true;
      populateForm();
    } catch (error) {
      console.error('Unable to load private payout and tax details.', error);
      populateForm();
      showToast('Unable to load private payout and tax details. Reload the page and try again.');
    }
  })();

})();
