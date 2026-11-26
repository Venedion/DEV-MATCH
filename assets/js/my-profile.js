(function(){
  'use strict';

  const params=new URLSearchParams(location.search);
  const role=params.get('role')==='client'?'client':params.get('role')==='dev'?'dev':getStoredRole();
  const isDeveloper=role==='dev';
  const profileKey=`devmatch-profile-${role}`;
  const savedProfile=readStorage(profileKey,{});
  const profile=savedProfile&&typeof savedProfile==='object'&&!Array.isArray(savedProfile)?savedProfile:{};
  const profileContact=window.DEVMATCH_PROFILE_CONTACT;
  const isPreview=params.get('preview')==='1';
  const initials=name=>String(name||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||(isDeveloper?'DM':'CL');
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const displayName=String(profile.displayName||'').trim()||(isDeveloper?'Developer':'Client');
  const username=String(profile.username||'').replace(/^@/,'');
  const city=profile.city||'';
  const country=profile.country||'';
  const publicProfileUrlPromise=Promise.resolve().then(async()=>{
    const backend=window.devMatchBackend;
    if(!backend||!backend.ready||typeof backend.publicProfileUrl!=='function'){
      throw new Error('Public profile sharing is unavailable.');
    }
    const user=await backend.ready;
    const path=user&&backend.publicProfileUrl(user.id,role);
    if(!path)throw new Error('The public profile URL could not be created.');
    return new URL(path,location.href).href;
  });
  publicProfileUrlPromise.catch(()=>{});
  const specialty=(Array.isArray(profile.specialty)?profile.specialty:typeof profile.specialty==='string'?[profile.specialty]:[]).map(value=>String(value).trim()).filter(Boolean).map(value=>value==='Other'&&typeof profile.specialtyOther==='string'&&profile.specialtyOther.trim()?profile.specialtyOther.trim():value);
  const specialtyDetails={
    'Full-stack':{description:'Front + back end',icon:'<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>'},
    Frontend:{description:'Web interfaces',icon:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>'},
    Backend:{description:'APIs & databases',icon:'<path d="M6 3v6m0 4v8M12 3v3m0 4v11M18 3v9m0 4v5M3 9h6m0 1h6m0 2h6m-6 4h6"/>'},
    'UI/UX':{description:'Design & research',icon:'<path d="m15 5 4 4M4 20l4-.8L19.2 8a2.8 2.8 0 0 0-4-4L4 15.2 4 20z"/>'},
    Mobile:{description:'Android & iOS',icon:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/>'},
    'Game Dev':{description:'Unity, Roblox...',icon:'<path d="m7 7 10 0a4 4 0 0 1 3.8 5.2l-1.2 4a2 2 0 0 1-3.3.9L14 15H10l-2.3 2.1a2 2 0 0 1-3.3-.9l-1.2-4A4 4 0 0 1 7 7z"/><path d="M7 10v4m-2-2h4m7-1h.01M17 13h.01"/>'},
    Other:{description:'Tell us more',icon:'<path d="M12 5v14m-7-7h14"/>'}
  };
  const title=isDeveloper?(specialty.length?`${specialty.slice(0,2).join(' & ')} Developer`:'Developer'):'Client';
  const bio=String(profile.bio||'').trim();
  const skills=Array.isArray(profile.skills)?profile.skills.map(skill=>String(skill).trim()).filter(Boolean):normalizeList(profile.skills,[]);
  const experiences=Array.isArray(profile.experiences)
    ?profile.experiences.filter(item=>item&&typeof item==='object'&&(item.title||item.company)).sort((left,right)=>{
      const getPeriodOrder=experience=>{
        const period=String(experience.period||'');
        const years=period.match(/\d{4}/g)||[];
        return {
          current:/\b(present|sekarang|current)\b/i.test(period),
          endYear:Number(years[years.length-1]||years[0]||0),
          startYear:Number(years[0]||0)
        };
      };
      const leftOrder=getPeriodOrder(left);
      const rightOrder=getPeriodOrder(right);
      return Number(rightOrder.current)-Number(leftOrder.current)
        ||rightOrder.endYear-leftOrder.endYear
        ||rightOrder.startYear-leftOrder.startYear;
    })
    :[];
  const projects=isDeveloper?loadDeveloperProjects():loadClientRequests();
  const profileOverview=document.querySelector('[data-profile-overview]');
  const clientProfileDesktopLayout=window.matchMedia('(min-width:821px) and (orientation:landscape)');
  const toast=document.getElementById('profileToast');
  let toastTimer;
  let clientProfileMetricsChannel=null;
  let clientProfileMetricsRefreshTimer=null;

  function readStorage(key,fallback){
    try{
      const value=localStorage.getItem(key);
      return value?JSON.parse(value):fallback;
    }catch(error){
      console.warn(`Unable to read ${key} from browser storage.`,error);
      return fallback;
    }
  }

  function getStoredRole(){
    try{
      const activeRole=sessionStorage.getItem('devmatch-active-role');
      if(activeRole==='client'||activeRole==='dev')return activeRole;
      const hasClient=Boolean(localStorage.getItem('devmatch-profile-client'));
      const hasDeveloper=Boolean(localStorage.getItem('devmatch-profile-dev'));
      return hasClient&&!hasDeveloper?'client':'dev';
    }catch(error){
      console.warn('Unable to determine the active profile role from browser storage.',error);
      return 'dev';
    }
  }

  function normalizeList(value,fallback){
    const items=Array.isArray(value)?value:typeof value==='string'?value.split(/[,;\n]/):[];
    const normalized=items.map(item=>String(item).trim()).filter(Boolean);
    return normalized.length?normalized:fallback;
  }

  function safeExternalUrl(value){
    if(!value)return '';
    try{
      const url=new URL(/^https?:\/\//i.test(value)?value:`https://${value}`);
      return ['http:','https:'].includes(url.protocol)?url.href:'';
    }catch(error){
      return '';
    }
  }

  function formatJoined(){
    if(profile.joined)return profile.joined;
    const created=Number(profile.createdAt);
    if(Number.isFinite(created)&&created>0)return new Date(created).toLocaleDateString('en-US',{month:'short',year:'numeric'});
    return '';
  }

  function formatCompact(value){
    return new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value).replace('K','k');
  }

  function setText(id,value){
    const element=document.getElementById(id);
    if(element)element.textContent=value;
  }

  function setLink(id,href){
    const element=document.getElementById(id);
    if(element)element.href=href;
  }

  function configureRole(){
    const profileUrl=`devmatch-my-profile.html?role=${role}`;
    const settingsUrl=`devmatch-settings.html?role=${role}#account`;
    const profileDetailsUrl=`devmatch-settings.html?role=${role}&edit=profile-details#profile-details`;
    const specializationUrl=`devmatch-settings.html${isDeveloper?'?role=dev&edit=specialization':'?role=client&edit=specialization'}#profile-details`;
    const skillsUrl=`devmatch-settings.html${isDeveloper?'?role=dev&edit=skills':'?role=client&edit=skills'}#profile-details`;
    const experienceUrl=`devmatch-settings.html${isDeveloper?'?role=dev&edit=experience':'?role=client&edit=experience'}#profile-details`;
    const dashboardUrl=isDeveloper?'devmatch-dashboard.html':'devmatch-client-dashboard.html';
    const notificationsUrl=isDeveloper?'devmatch-developer-notifications.html':'devmatch-notifications.html';
    const chatUrl=isDeveloper?'devmatch-chat.html':'devmatch-chat.html?role=client';
    document.documentElement.lang='en';
    document.body.classList.toggle('client-shell-page',!isDeveloper);
    document.body.classList.toggle('client-profile-view',!isDeveloper);
    document.body.classList.toggle('developer-profile-view',isDeveloper);
    window.DEVMATCH_SIDEBAR_NAVIGATION?.setWorkspace(role);
    document.body.classList.toggle('profile-preview-mode',isPreview);
    document.title=`${displayName} — My Profile | DEV-MATCH`;
    document.querySelectorAll('#brandLink,#overviewLink').forEach(link=>link.href=dashboardUrl);
    setLink('devModeLink','devmatch-dashboard.html');
    setLink('clientModeLink','devmatch-client-dashboard.html');
    document.getElementById('devModeLink').classList.toggle('active',isDeveloper);
    document.getElementById('clientModeLink').classList.toggle('active',!isDeveloper);
    setLink('notificationsLink',notificationsUrl);
    setLink('notificationsNavLink',notificationsUrl);
    setLink('userMenu',profileUrl);
    setLink('profileNavLink',profileUrl);
    setLink('settingsLink',settingsUrl.replace('#account',''));
    setLink('manageConnectedAppsLink',settingsUrl.replace('#account','#integrations'));
    setLink('editSkillsLink',skillsUrl);
    setLink('editExperienceLink',experienceUrl);
    setLink('editProfileMobile',profileDetailsUrl);
    setLink('messagesLink',chatUrl);
    setLink('projectsLink',isDeveloper?'devmatch-my-projects.html':`${dashboardUrl}#requests`);
    setLink('findProjectsLink',isDeveloper?'devmatch-find-projects.html':'devmatch-discover-projects.html');
    setLink('findClientsLink',isDeveloper?'devmatch-find-clients.html':'devmatch-find-developers.html');
    setLink('favoritesLink',`devmatch-favorites.html${isDeveloper?'':'?role=client'}`);
    setLink('editSpecializationLink',specializationUrl);
    setLink('createAction',isDeveloper?'devmatch-my-projects.html?create=1':`${dashboardUrl}#requests`);
    setLink('allProjectsLink',isDeveloper?'devmatch-my-projects.html':`${dashboardUrl}#requests`);
    setText('overviewLinkLabel',isDeveloper?'Overview':'Home');
    setText('findProjectsLinkLabel',isDeveloper?'Find Projects':'Discover Projects');
    setText('findClientsLinkLabel',isDeveloper?'Find Clients':'Developers');
    setText('topUserRole',isDeveloper?'Developer':'Client');
    setText('workspaceTitle',isDeveloper?'Developer workspace':'Client workspace');
    setText('workspaceSubtitle',isDeveloper?'Showcase & find clients':'Discover & hire');
    const workspaceIcon=document.getElementById('workspaceIcon');
    if(isDeveloper)workspaceIcon.innerHTML='<span class="developer-mode-icon" aria-hidden="true"></span>';
    else workspaceIcon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    setText('createActionLabel',isDeveloper?'Add Project':'Post a Request');
    setText('projectsLinkLabel',isDeveloper?'My Projects':'My Requests');
    document.getElementById('workspaceBadge').classList.toggle('client-workspace-mode',!isDeveloper);
    document.querySelector('.workspace-icon').classList.toggle('client-workspace-icon',!isDeveloper);
    document.getElementById('identitySpecialty').hidden=!isDeveloper&&!profile.industry;
    document.querySelector('.about-card').hidden=true;
    document.getElementById('skillsCard').hidden=!isDeveloper;
    document.getElementById('experienceCard').hidden=!isDeveloper;
    const quickContactCard=document.querySelector('.contact-card');
    const connectedAppsCard=document.getElementById('connectedAppsCard');
    const profileShowcase=document.querySelector('.profile-showcase');
    const profileDetails=document.querySelector('.profile-details');
    const profileColumns=document.querySelector('.profile-columns');
    const developerDetailsDesktop=document.getElementById('developerDetailsDesktop');
    const developerDetailCards=[
      document.getElementById('specializationCard'),
      document.getElementById('skillsCard'),
      document.getElementById('experienceCard')
    ];
    document.getElementById('clientProfileActions').append(document.querySelector('.profile-actions'));
    document.getElementById('clientProfileSide').hidden=false;
    document.getElementById('clientCompanyDetails').append(document.getElementById('roleInfoCard'));
    const moveProfileContent=()=>{
      const desktop=clientProfileDesktopLayout.matches;
      const quickContactTarget=document.getElementById(desktop?'clientQuickContactDesktop':'clientQuickContactMobile');
      if(quickContactCard.parentElement!==quickContactTarget)quickContactTarget.append(quickContactCard);
      developerDetailsDesktop.hidden=!isDeveloper||!desktop;
      if(desktop){
        const connectedAppsTarget=document.getElementById('clientConnectedAppsDesktop');
        const showcaseTarget=document.getElementById('clientShowcaseDesktop');
        if(connectedAppsCard.parentElement!==connectedAppsTarget)connectedAppsTarget.append(connectedAppsCard);
        if(profileShowcase.parentElement!==showcaseTarget)showcaseTarget.append(profileShowcase);
        if(isDeveloper)developerDetailCards.forEach(card=>developerDetailsDesktop.append(card));
      }else{
        if(profileShowcase.parentElement!==profileColumns)profileColumns.append(profileShowcase);
        if(isDeveloper)developerDetailCards.forEach(card=>profileDetails.append(card));
        if(connectedAppsCard.parentElement!==profileDetails)profileDetails.append(connectedAppsCard);
      }
    };
    moveProfileContent();
    clientProfileDesktopLayout.addEventListener('change',moveProfileContent);
    window.addEventListener('resize',moveProfileContent);
    if(!isDeveloper&&profile.industry)setText('identitySpecialty',profile.industry);
    setText('identityBio',bio||'No bio added yet.');
    setText('mobileIdentityBio',bio||'No bio added yet.');
    setText('aboutHeading',isDeveloper?'About':'About the business');
    setText('aboutCopy',bio||'No bio added yet.');
    setText('skillsHeading',isDeveloper?'Skills & Tech Stacks':'Services & Focus');
    setText('showcaseHeading',isDeveloper?'Selected work':'Open project requests');
    setText('showcaseDescription',isDeveloper?'Published projects from your portfolio.':'Open requests shared with developers.');
    setText('statProjectsCaption',isDeveloper?'projects':'open requests');
    setText('statSavesLabel',isDeveloper?'Project favorites':'Request saves');
    setText('statRatingLabel',isDeveloper?'Client rating':'Developer rating');
    setText('profileReviewsTabLabel',isDeveloper?'Client Reviews':'Developer Reviews');
    setText('reviewsHeading',isDeveloper?'Client Reviews':'Developer Reviews');
    setText('reviewsDescription',isDeveloper?'Feedback from clients after completed projects.':'Feedback from developers after completed projects.');
    setText('contactIntro',isDeveloper?'Have a project in mind? Let’s talk.':'Interested in working together? Get in touch.');
    const previewProfile=document.getElementById('previewProfile');
    previewProfile.href=`${profileUrl}&preview=1`;
    previewProfile.target=isDeveloper?'_blank':'_self';
    previewProfile.rel='noopener noreferrer';
    const editProfile=document.getElementById('editProfile');
    editProfile.href=settingsUrl;
    editProfile.removeAttribute('target');
    editProfile.removeAttribute('rel');
    if(isPreview){
      previewProfile.hidden=true;
      editProfile.hidden=true;
      document.getElementById('previewBanner').hidden=false;
      setLink('returnFromPreview',profileUrl);
    }
    if(!isDeveloper){
      document.getElementById('statProjectsCaption').textContent='open requests';
      document.getElementById('statSavesLabel').textContent='Request saves';
      document.getElementById('statRatingLabel').textContent='Developer rating';
    }
    profileContact.configureDirectMessageLink(document.getElementById('directMessageLink'),chatUrl,true);
    setLink('whatsappLink',profile.whatsapp?`https://wa.me/${String(profile.whatsapp).replace(/\D/g,'')}`:'#');
    document.getElementById('whatsappLink').classList.toggle('disabled',!String(profile.whatsapp||'').replace(/\D/g,''));
    const instagramUrl=profileContact.instagramUrl(profile.instagram||'');
    const instagramLink=document.getElementById('instagramLink');
    instagramLink.hidden=isDeveloper||!instagramUrl;
    if(instagramUrl)setLink('instagramLink',instagramUrl);
    if(isPreview){
      document.getElementById('profileNavLink').hidden=true;
      document.querySelector('.side-add').hidden=true;
    }
  }

  function loadDeveloperProjects(){
    const saved=readStorage('devmatch-dashboard-projects',[]);
    if(Array.isArray(saved)&&saved.length){
      const published=saved.map((item,index)=>item&&({...item,id:item.id||`saved-${index}`})).filter(item=>item&&item.status!=='draft');
      const showcase=published.slice(0,6).map(item=>({
        id:item.id,
        title:item.title||'Untitled project',
        category:item.category||item.type||'Project',
        description:item.description||'No description provided.',
        price:item.price||'Not specified',
        views:Number(item.views)||0,
        favorites:Number(item.favorites)||0,
        art:item.art||'website'
      }));
      showcase.totalCount=published.length;
      showcase.totalViews=published.reduce((sum,item)=>sum+(Number(item.views)||0),0);
      showcase.totalFavorites=published.reduce((sum,item)=>sum+(Number(item.favorites)||0),0);
      return showcase;
    }
    const showcase=[];
    showcase.totalCount=0;
    showcase.totalFavorites=0;
    showcase.totalViews=0;
    return showcase;
  }

  function loadClientRequests(){
    const requests=readStorage('devmatch-client-requests',[]);
    const openRequests=Array.isArray(requests)?requests.filter(item=>item&&item.status==='open'):[];
    const showcase=openRequests.slice(0,6).map(item=>({
      id:item.id,
      title:item.title||'Untitled request',
      category:item.category||item.projectType||'Project request',
      description:item.description||'No description provided.',
      price:item.budget||formatBudget(item.budgetFrom,item.budgetTo),
      views:Number(item.views)||0,
      favorites:Number(item.saves??item.favorites)||0,
      art:'website'
    }));
    showcase.totalCount=openRequests.length;
    showcase.totalViews=openRequests.reduce((sum,item)=>sum+(Number(item.views)||0),0);
    showcase.totalFavorites=openRequests.reduce((sum,item)=>sum+(Number(item.saves??item.favorites)||0),0);
    return showcase;
  }

  function formatBudget(from,to){
    if(from&&to)return `Rp ${Number(from).toLocaleString('id-ID')} – Rp ${Number(to).toLocaleString('id-ID')}`;
    return 'Budget not set';
  }

  function renderIdentity(){
    const avatar=initials(displayName);
    setAvatar('userAvatar',profile.avatar,avatar);
    setText('topUserName',username||displayName);
    setText('identityHandle',username?`@${username}`:'');
    document.getElementById('identityHandle').hidden=!username;
    const location=[city,country].filter(Boolean).join(', ');
    setText('identityLocationText',location);
    document.getElementById('identityLocation').hidden=!location;
    setText('identitySpecialty',isDeveloper?title:profile.industry||'');
    const joined=formatJoined();
    setText('identityJoined',joined?`Joined ${joined}`:'');
    document.getElementById('identityJoined').hidden=!joined;
    const identity={
      role:isDeveloper?'developer':'client',
      name:displayName,
      username,
      avatar:profile.avatar,
      initials:avatar,
      location,
      bio:bio||'No bio added yet.'
    };
    if(isDeveloper)identity.availability=profile.availability||'';
    window.DEVMATCH_PROFILE_OVERVIEW.render(profileOverview,identity);
  }

  function setAvatar(id,imageUrl,fallback){
    const element=document.getElementById(id);
    if(!element)return;
    let validImage=typeof imageUrl==='string'&&/^data:image\/(?:jpeg|png);base64,/.test(imageUrl);
    if(typeof imageUrl==='string'&&imageUrl.startsWith('https://')){
      try{
        const url=new URL(imageUrl);
        validImage=url.origin==='https://yxwktllqbmhustmhdaqi.supabase.co'
          &&url.pathname.startsWith('/storage/v1/object/public/project-media/');
      }catch{
        validImage=false;
      }
    }
    if(!validImage){
      element.textContent=fallback;
      return;
    }
    const image=document.createElement('img');
    image.src=imageUrl;
    image.alt='';
    image.setAttribute('aria-hidden','true');
    element.replaceChildren(image);
  }

  function renderRoleInfo(){
    const root=document.getElementById('roleInfoCard');
    if(isDeveloper){
      const contracts=normalizeList(profile.contractTypes,[]);
      const hourlyRate=profile.hourlyRate?`${profile.hourlyRate} / hour`:'Not provided';
      root.innerHTML=`<div class="card-heading"><h2>Rates &amp; Work Terms</h2></div><div class="role-info-grid"><div class="role-info-item"><small>HOURLY RATE</small><strong>${escapeHtml(hourlyRate)}</strong></div><div class="role-info-item"><small>MINIMUM PROJECT</small><strong>${escapeHtml(profile.minProjectPrice||'Not provided')}</strong></div></div>${contracts.length?`<div class="contract-list">${contracts.map(item=>`<span>${escapeHtml(item)}</span>`).join('')}</div>`:'<p class="empty-state">No work terms added yet.</p>'}`;
    }else{
      const businessLocation=[city,country].filter(Boolean).join(', ')||'Not provided';
      root.innerHTML=`<div class="card-heading"><h2>Company Details</h2></div><div class="role-info-grid"><div class="role-info-item"><small>BUSINESS NAME</small><strong>${escapeHtml(profile.companyName||profile.displayName||'Not provided')}</strong></div><div class="role-info-item"><small>INDUSTRY</small><strong>${escapeHtml(profile.industry||'Not provided')}</strong></div><div class="role-info-item"><small>NPWP STATUS</small><strong>${profile.npwp?'On file':'-'}</strong></div><div class="role-info-item"><small>BUSINESS LOCATION</small><strong>${escapeHtml(businessLocation)}</strong></div></div>`;
    }
  }

  function renderSkills(){
    document.getElementById('skillList').innerHTML=skills.length
      ?skills.map(skill=>`<span class="profile-skill-value">${escapeHtml(skill)}</span>`).join('')
      :'<span class="empty-state">No skills added yet.</span>';
  }

  function renderSpecialization(){
    const card=document.getElementById('specializationCard');
    const root=document.getElementById('specializationList');
    if(!card||!root)return;
    card.hidden=!isDeveloper;
    root.innerHTML=specialty.length
      ?specialty.map(item=>{
        const details=specialtyDetails[item]||Object.entries(specialtyDetails)
          .find(([name])=>name.toLowerCase()===item.toLowerCase())?.[1]||specialtyDetails.Other;
        return `<div class="profile-specialty-card"><svg viewBox="0 0 24 24" aria-hidden="true">${details.icon}</svg><b>${escapeHtml(item)}</b><small>${escapeHtml(details.description)}</small></div>`;
      }).join('')
      :'<span class="empty-state">No specialization added yet.</span>';
  }

  function renderExperience(){
    const root=document.getElementById('experienceList');
    if(!experiences.length){
      root.innerHTML='<li class="empty-state">Experience will appear here when it is added to your profile.</li>';
      return;
    }
    root.innerHTML=experiences.map((item,experienceIndex)=>{
      const companyLine=[item.company,item.period].filter(Boolean).join(' · ');
      const linkLabel=String(item.link||'').trim();
      const href=safeExternalUrl(linkLabel);
      const filePaths=Array.isArray(item.filePaths)?item.filePaths.map(path=>typeof path==='string'?path:''):[];
      const supportingFiles=Array.isArray(item.files)
        ? item.files.map((file,fileIndex)=>({
          name:typeof file==='string'?file:String(file?.name||''),
          fileIndex
        })).filter(file=>file.name)
        : [];
      const fileMarkup=supportingFiles.map(({name,fileIndex})=>{
        const escapedFileName=escapeHtml(name);
        return filePaths[fileIndex]
          ? `<button class="experience-file-download" type="button" data-download-experience-file data-experience-index="${experienceIndex}" data-file-index="${fileIndex}" aria-label="Download ${escapedFileName}" title="Download ${escapedFileName}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 19v2h14v-2"/></svg><span>${escapedFileName}</span></button>`
          : `<span class="experience-file-name">${escapedFileName}</span>`;
      }).join('');
      return `<li class="experience-item"><span class="experience-marker" aria-hidden="true"></span><div class="experience-copy"><b class="profile-experience-value">${escapeHtml(item.title||'Experience')}</b>${companyLine?`<span class="profile-experience-value">${escapeHtml(companyLine)}</span>`:''}${href?`<a class="experience-proof-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkLabel)}</a>`:''}${fileMarkup?`<div class="experience-file-list">${fileMarkup}</div>`:''}</div></li>`;
    }).join('');
  }

  const connectedAppIcons={
    Instagram:{
      color:'#c13584',
      svg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="18" cy="6" r="1" fill="currentColor" stroke="none"/></svg>'
    },
    WhatsApp:{
      color:'#25d366',
      svg:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path transform="translate(3.6 3.6) scale(.7)" d="M17.5 14.4c-.3-.1-1.8-.9-2.1-1-.3-.1-.5-.1-.7.1s-.8 1-.9 1.2c-.2.2-.4.2-.7.1s-1.3-.5-2.5-1.5c-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5s0-.4-.1-.5c-.1-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.2-1.2 2.9 1.2 3.4 1.4 3.6c.2.2 2.4 3.7 5.8 5.1 3.4 1.4 3.4.9 4 .9.6 0 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.1-.3-.2-.6-.3z" fill="currentColor"/></svg>'
    },
    GitHub:{
      color:'#24292e',
      svg:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>'
    },
    Google:{
      color:'#ea4335',
      svg:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>'
    },
    LinkedIn:{
      color:'#0a66c2',
      svg:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>'
    }
  };

  function renderConnectedApps(){
    const isConnected=(field,defaultValue)=>typeof profile[field]==='boolean'?profile[field]:defaultValue;
    const apps=isDeveloper?[
      {name:'WhatsApp Business',icon:connectedAppIcons.WhatsApp,connected:isConnected('whatsappConnected',Boolean(String(profile.whatsapp||'').replace(/\D/g,''))),verified:Boolean(profile.whatsappVerified)},
      {name:'GitHub',icon:connectedAppIcons.GitHub,connected:isConnected('githubConnected',Boolean(profile.github||profile.githubUrl)),verified:Boolean(profile.githubVerified)},
      {name:'Google',icon:connectedAppIcons.Google,connected:isConnected('googleConnected',false),verified:Boolean(profile.googleVerified)},
      {name:'LinkedIn',icon:connectedAppIcons.LinkedIn,connected:isConnected('linkedinConnected',Boolean(profile.linkedin||profile.linkedinUrl)),verified:Boolean(profile.linkedinVerified)}
    ]:[
      {name:'Instagram',icon:connectedAppIcons.Instagram,connected:isConnected('instagramConnected',Boolean(String(profile.instagram||'').trim()))},
      {name:'WhatsApp Business',icon:connectedAppIcons.WhatsApp,connected:isConnected('whatsappConnected',Boolean(String(profile.whatsapp||'').replace(/\D/g,'')))},
      {name:'Google Account',icon:connectedAppIcons.Google,connected:isConnected('googleConnected',/^[A-Z0-9._%+-]+@gmail\.com$/i.test(String(profile.email||'')))},
      {name:'LinkedIn',icon:connectedAppIcons.LinkedIn,connected:isConnected('linkedinConnected',Boolean(profile.linkedinUrl||profile.linkedin))}
    ];
    document.getElementById('connectedList').innerHTML=apps.map(app=>{
      const status=app.verified?'Verified':app.connected?'Connected':'Not connected';
      return `<div class="connected-app"><div class="connected-app-info"><span class="app-icon" style="color:${app.icon.color}">${app.icon.svg}</span><b>${app.name}</b></div><span class="app-status${app.connected?' connected':''}${app.verified?' verified':''}">${status}</span></div>`;
    }).join('');
  }

  function renderProjectCard(project){
    const art=project.art==='dashboard'?'dashboard':project.art==='store'?'store':'website';
    const target=isDeveloper
      ?`devmatch-my-projects.html?project=${encodeURIComponent(project.id)}`
      :`devmatch-client-dashboard.html?role=client#request-detail/${encodeURIComponent(project.id)}`;
    return `<a class="showcase-project" href="${escapeHtml(target)}" aria-label="${escapeHtml(project.title)} — view details"><div class="project-art art-${art}" aria-hidden="true"><div class="project-browser"><div class="browser-bar"><i></i><i></i><i></i></div><div class="browser-content"><span class="art-accent"></span></div></div></div><div class="project-copy"><span class="project-category">${escapeHtml(project.category||'Project')}</span><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.description)}</p><footer class="project-footer"><strong>${escapeHtml(project.price||'Not specified')}</strong><span class="project-metric">◉ <b>${formatCompact(project.views)}</b> &nbsp;♡ <b>${formatCompact(project.favorites)}</b></span></footer></div></a>`;
  }

  function renderProjects(){
    setText('statProjects',String(projects.totalCount??projects.length));
    document.getElementById('projectGrid').innerHTML=projects.length?projects.map(renderProjectCard).join(''):`<p class="empty-state">${isDeveloper?'You have no published projects yet. Add a project to build your showcase.':'You have no open requests yet. Open project requests will appear here.'}</p>`;
    if(!isDeveloper){
      const manage=document.getElementById('allProjectsLink');
      manage.innerHTML='View requests <svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h20M17 8l5 4-5 4"/></svg>';
    }
  }

  async function renderReviews(){
    const root=document.getElementById('reviewList');
    window.DEVMATCH_SKELETON?.rows(root,3);
    window.DEVMATCH_SKELETON?.text(document.getElementById('statRating'),'Loading average rating','42px');
    window.DEVMATCH_SKELETON?.text(document.getElementById('statReviews'),'Loading review count','56px');
    try{
      const user=await window.devMatchBackend.ready;
      if(!user)throw new Error('Authentication is required to load profile reviews.');
      const reviews=await window.devMatchBackend.loadProfileReviews(user.id);
      if(!reviews.length){
        root.innerHTML=isDeveloper
          ?'<p class="empty-state">Client reviews will appear here after a completed project.</p>'
          :'<p class="empty-state">Developer reviews will appear here after a completed project.</p>';
        setText('statRating','—');
        setText('mobileStatRating','-');
        setText('statReviews','no reviews yet');
        renderProfileOverviewStatistics();
        return;
      }
      root.innerHTML=reviews.slice(0,8).map(review=>{
        const stars=Math.round(review.rating);
        return `<article class="review-item"><span class="review-avatar">${escapeHtml(review.reviewerInitials||initials(review.reviewerName))}</span><div class="review-copy"><h3>${escapeHtml(review.reviewerName)}</h3><small>${escapeHtml(review.projectTitle||'Completed project')}</small><p>${escapeHtml(review.text)}</p></div><span class="review-rating" aria-label="${stars} out of 5 stars">${'★'.repeat(stars)}</span></article>`;
      }).join('');
      const average=reviews.reduce((sum,item)=>sum+item.rating,0)/reviews.length;
      setText('statRating',`★ ${average.toFixed(1)}`);
      setText('mobileStatRating',average.toFixed(1));
      setText('statReviews',`from ${reviews.length} reviews`);
      renderProfileOverviewStatistics();
    }catch(error){
      console.error('Unable to load profile reviews from Supabase.',error);
      root.innerHTML='<p class="empty-state">Reviews could not be loaded. Check your connection and try again.</p>';
      setText('statRating','—');
      setText('mobileStatRating','-');
      setText('statReviews','unable to load reviews');
      renderProfileOverviewStatistics();
    }
  }

  function renderProfileOverviewStatistics(){
    window.DEVMATCH_PROFILE_OVERVIEW.render(profileOverview,{
      statistics:{
        views:document.getElementById('mobileStatViews').textContent.trim()||'0',
        favorites:document.getElementById('mobileStatFavorites').textContent.trim()||'0',
        rating:document.getElementById('mobileStatRating').textContent.trim()||'-'
      }
    });
  }

  async function refreshClientProfileMetrics(userId){
    try{
      const metrics=await window.devMatchBackend.loadClientProfileMetrics(userId);
      setText('mobileStatViews',formatCompact(metrics.views));
      setText('mobileStatFavorites',formatCompact(metrics.favorites));
    }catch(error){
      console.error('Unable to load client profile metrics from Supabase.',error);
      setText('mobileStatViews','—');
      setText('mobileStatFavorites','—');
    }
    renderProfileOverviewStatistics();
  }

  function scheduleClientProfileMetricsRefresh(userId){
    if(document.hidden||clientProfileMetricsRefreshTimer!==null)return;
    clientProfileMetricsRefreshTimer=window.setTimeout(()=>{
      clientProfileMetricsRefreshTimer=null;
      if(!document.hidden)void refreshClientProfileMetrics(userId);
    },250);
  }

  async function initializeClientProfileMetrics(){
    if(isDeveloper)return;
    try{
      const user=await window.devMatchBackend.ready;
      if(!user)return;
      await refreshClientProfileMetrics(user.id);
      const {data,error}=await window.devMatchBackend.client.auth.getSession();
      if(error)throw error;
      if(data.session?.user.id!==user.id)return;
      await window.devMatchBackend.client.realtime.setAuth(data.session.access_token);
      clientProfileMetricsChannel=window.devMatchBackend.client
        .channel(`devmatch-client-profile-metrics:${user.id}`,{config:{private:true}})
        .on('broadcast',{event:'refresh'},()=>scheduleClientProfileMetricsRefresh(user.id))
        .subscribe(status=>{
          if(status==='SUBSCRIBED')scheduleClientProfileMetricsRefresh(user.id);
          else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
            console.error('Unable to subscribe to client profile metric updates.',status);
          }
        });
      window.addEventListener('pagehide',()=>{
        if(clientProfileMetricsChannel){
          void window.devMatchBackend.client.removeChannel(clientProfileMetricsChannel);
          clientProfileMetricsChannel=null;
        }
      },{once:true});
      document.addEventListener('visibilitychange',()=>{
        if(!document.hidden)scheduleClientProfileMetricsRefresh(user.id);
      });
    }catch(error){
      console.error('Unable to initialize live client profile metrics.',error);
    }
  }

  function renderActivity(){
    let activity=[];
    if(isDeveloper){
      activity=projects.slice(0,4).map(project=>({icon:'↗',title:'Published a showcase project',detail:project.title,time:'Recent update'}));
    }else{
      const requests=readStorage('devmatch-client-requests',[]);
      activity=(Array.isArray(requests)?requests:[]).flatMap(request=>(request.activity||[]).map(entry=>({
        icon:'•',title:entry.name?`${entry.name} ${entry.action||'interacted with your request'}`:'Request activity',
        detail:request.title||'Project request',time:entry.time||'Recently'
      }))).slice(0,8);
    }
    document.getElementById('activityList').innerHTML=activity.length?activity.map(item=>`<article class="activity-item"><span class="activity-icon" aria-hidden="true">${escapeHtml(item.icon)}</span><p class="activity-copy"><b>${escapeHtml(item.title)}</b><br>${escapeHtml(item.detail)}</p><time>${escapeHtml(item.time)}</time></article>`).join(''):`<p class="empty-state">New profile activity and inquiries will appear here.</p>`;
    setText('activityDescription',isDeveloper?'Recent work added to your showcase.':'Recent activity across your project requests.');
  }

  function renderStats(){
    setText('statViewsLabel',isDeveloper?'Project views':'Request views');
    if(isDeveloper){
      const views=projects.totalViews??projects.reduce((sum,item)=>sum+(Number(item.views)||0),0);
      const favorites=projects.totalFavorites??projects.reduce((sum,item)=>sum+(Number(item.favorites)||0),0);
      setText('statSaves',formatCompact(projects.totalFavorites??favorites));
      setText('statViews',formatCompact(views));
    }else{
      const requests=readStorage('devmatch-client-requests',[]);
      const safeRequests=Array.isArray(requests)?requests:[];
      const saves=safeRequests.reduce((sum,item)=>sum+(Number(item.saves??item.favorites)||0),0);
      const views=safeRequests.reduce((sum,item)=>sum+(Number(item.views)||0),0);
      setText('statSaves',formatCompact(saves));
      setText('statViews',formatCompact(views));
    }
    setText('mobileStatFavorites',isDeveloper?document.getElementById('statSaves').textContent.trim()||'0':'—');
    setText('mobileStatViews',isDeveloper?document.getElementById('statViews').textContent.trim()||'0':'—');
    renderProfileOverviewStatistics();
  }

  function showToast(message,isError){
    clearTimeout(toastTimer);
    toast.textContent=message;
    toast.classList.toggle('error',Boolean(isError));
    toast.classList.add('show');
    toastTimer=setTimeout(()=>toast.classList.remove('show'),3000);
  }

  async function copyProfileUrl(url){
    try{
      if(navigator.clipboard&&window.isSecureContext){
        await navigator.clipboard.writeText(url);
      }else{
        const field=document.createElement('textarea');
        field.value=url;
        field.setAttribute('readonly','');
        field.style.position='fixed';
        field.style.opacity='0';
        document.body.append(field);
        field.select();
        const copied=typeof document.execCommand==='function'&&document.execCommand('copy');
        field.remove();
        if(!copied)throw new Error('Clipboard copy was not permitted.');
      }
    }catch(error){
      throw new Error('Unable to copy the profile link.',{cause:error});
    }
  }

  function openProfileShareDialog(url){
    const dialog=document.getElementById('profileShareDialog');
    const whatsapp=document.getElementById('shareProfileWhatsapp');
    const message=`Check out ${displayName}'s profile on DEV-MATCH: ${url}`;
    whatsapp.href=`https://wa.me/?text=${encodeURIComponent(message)}`;
    dialog.dataset.profileUrl=url;
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.setAttribute('open','');
    document.getElementById('copyProfileLink').focus();
  }

  async function shareProfile(){
    if(window.matchMedia('(orientation: portrait)').matches){
      try{
        const url=await publicProfileUrlPromise;
        if(typeof navigator.share==='function'){
          try{
            await navigator.share({title:`${displayName} | DEV-MATCH`,text:`Check out ${displayName}'s profile on DEV-MATCH.`,url});
            return;
          }catch(error){
            if(error&&error.name==='AbortError')return;
            console.warn('Native sharing is unavailable; showing the share options.',error);
          }
        }
        openProfileShareDialog(url);
      }catch(error){
        console.error('Unable to prepare the public profile link.',error);
        showToast('Unable to prepare the public profile link. Please try again.',true);
      }
      return;
    }

    const url=new URL(`devmatch-my-profile.html?role=${role}`,location.href).href;
    try{
      await copyProfileUrl(url);
      showToast('Profile link copied to clipboard.');
    }catch(error){
      console.error('Unable to copy the profile link.',error);
      showToast('Could not copy the link. Please copy the page URL manually.',true);
    }
  }

  function activateTab(button,focus){
    const selected=button.dataset.profileTab;
    document.querySelectorAll('.profile-tab').forEach(tab=>{
      const active=tab===button;
      tab.classList.toggle('active',active);
      tab.setAttribute('aria-selected',String(active));
      tab.tabIndex=active?0:-1;
    });
    document.querySelectorAll('.tab-panel').forEach(panel=>{
      const active=panel.id===`panel${selected[0].toUpperCase()}${selected.slice(1)}`;
      panel.hidden=!active;
      panel.classList.toggle('active',active);
    });
    updateTabIndicator(button);
    if(focus)button.focus();
  }

  function updateTabIndicator(button=document.querySelector('.profile-tab.active')){
    const tabs=document.querySelector('.profile-tabs');
    if(!tabs||!button)return;
    const tabBounds=button.getBoundingClientRect();
    const tabsBounds=tabs.getBoundingClientRect();
    const left=tabBounds.left-tabsBounds.left-tabs.clientLeft+tabs.scrollLeft;
    tabs.style.setProperty('--profile-tab-indicator-left',`${left}px`);
    tabs.style.setProperty('--profile-tab-indicator-width',`${tabBounds.width}px`);
  }

  configureRole();
  renderIdentity();
  renderRoleInfo();
  renderSpecialization();
  renderSkills();
  renderExperience();
  document.getElementById('experienceList').addEventListener('click',async event=>{
    const button=event.target.closest('[data-download-experience-file]');
    if(!button)return;
    const experienceIndex=Number(button.dataset.experienceIndex);
    const fileIndex=Number(button.dataset.fileIndex);
    const experience=experiences[experienceIndex];
    const path=Array.isArray(experience?.filePaths)?experience.filePaths[fileIndex]:'';
    const file=experience?.files?.[fileIndex];
    const fileName=typeof file==='string'?file:String(file?.name||'');
    if(!Number.isInteger(experienceIndex)||!Number.isInteger(fileIndex)||!path||!fileName){
      console.error('Unable to access the selected profile experience file.');
      showToast('Unable to download this supporting file.',true);
      return;
    }
    button.disabled=true;
    try{
      const url=await window.devMatchBackend.createPrivateFileUrl(path,fileName);
      const link=document.createElement('a');
      link.href=url;
      link.target='_blank';
      link.rel='noopener noreferrer';
      link.click();
    }catch(error){
      console.error('Unable to access the private experience file.',error);
      showToast(error.message||'Unable to download this supporting file.',true);
    }finally{
      button.disabled=false;
    }
  });
  renderConnectedApps();
  renderProjects();
  void renderReviews();
  renderActivity();
  renderStats();
  void initializeClientProfileMetrics();
  document.getElementById('shareProfile').addEventListener('click',shareProfile);
  document.getElementById('shareProfileMobile').addEventListener('click',shareProfile);
  const profileShareDialog=document.getElementById('profileShareDialog');
  const closeProfileShareDialog=()=>{
    if(typeof profileShareDialog.close==='function'&&profileShareDialog.open)profileShareDialog.close();
    else{
      profileShareDialog.removeAttribute('open');
      document.getElementById('shareProfileMobile').focus();
    }
  };
  document.getElementById('closeProfileShare').addEventListener('click',closeProfileShareDialog);
  document.getElementById('copyProfileLink').addEventListener('click',async()=>{
    const url=profileShareDialog.dataset.profileUrl;
    if(!url){
      console.error('The public profile URL is missing from the share dialog.');
      showToast('Unable to prepare the public profile link. Please try again.',true);
      return;
    }
    try{
      await copyProfileUrl(url);
      closeProfileShareDialog();
      showToast('Profile link copied to clipboard.');
    }catch(error){
      console.error('Unable to copy the public profile link.',error);
      showToast('Could not copy the link. Please try again.',true);
    }
  });
  document.getElementById('shareProfileWhatsapp').addEventListener('click',closeProfileShareDialog);
  profileShareDialog.addEventListener('click',event=>{
    if(event.target===profileShareDialog)closeProfileShareDialog();
  });
  profileShareDialog.addEventListener('close',()=>document.getElementById('shareProfileMobile').focus());
  document.querySelectorAll('.profile-tab').forEach((button,index,tabs)=>{
    button.addEventListener('click',()=>activateTab(button,false));
    button.addEventListener('keydown',event=>{
      const offset=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;
      if(!offset)return;
      event.preventDefault();
      activateTab(tabs[(index+offset+tabs.length)%tabs.length],true);
    });
  });
  requestAnimationFrame(()=>updateTabIndicator());
  window.addEventListener('resize',()=>updateTabIndicator());
  document.querySelector('.profile-tabs').addEventListener('scroll',()=>updateTabIndicator(),{passive:true});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>updateTabIndicator());
})();


// test
