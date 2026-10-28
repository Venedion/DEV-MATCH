(function(){
  'use strict';

  const params=new URLSearchParams(location.search);
  const role=params.get('role')==='client'?'client':params.get('role')==='dev'?'dev':getStoredRole();
  const isDeveloper=role==='dev';
  const profileKey=`devmatch-profile-${role}`;
  const savedProfile=readStorage(profileKey,{});
  const profile=savedProfile&&typeof savedProfile==='object'&&!Array.isArray(savedProfile)?savedProfile:{};
  const isPreview=params.get('preview')==='1';
  const initials=name=>String(name||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||(isDeveloper?'DM':'CL');
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const displayName=profile.displayName|| (isDeveloper?'Rizky Aditya':'Client User');
  const username=String(profile.username|| (isDeveloper?'rizkyaditya':'clientbiz')).replace(/^@/,'');
  const city=profile.city|| (isDeveloper?'Medan':'Jakarta');
  const country=profile.country||'Indonesia';
  const specialty=(Array.isArray(profile.specialty)?profile.specialty:[profile.specialty||'']).filter(Boolean);
  const title=isDeveloper?(specialty.length?`${specialty.slice(0,2).join(' & ')} Developer`:'Full-stack Developer'):'Small Business Owner';
  const bio=profile.bio||(isDeveloper
    ?'I build reliable web experiences for growing businesses, with a focus on practical tools, thoughtful design, and projects that help teams work better.'
    :'Building a business with a focus on great customer experiences. I am looking for thoughtful digital solutions to help the business grow.');
  const skills=normalizeList(profile.skills,isDeveloper?['React','Next.js','Laravel','Supabase','Figma','Tailwind CSS']:['Small business','Food & Beverage','E-Commerce']);
  const experiences=Array.isArray(profile.experiences)?profile.experiences.filter(item=>item&&typeof item==='object'&&(item.title||item.company)):defaultExperiences();
  const projects=isDeveloper?loadDeveloperProjects():loadClientRequests();
  const toast=document.getElementById('profileToast');
  let toastTimer;

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
      const activeRole=localStorage.getItem('devmatch-active-role');
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

  function defaultExperiences(){
    return isDeveloper
      ?[{title:'Independent Developer',company:'Freelance · 2022 – Present',link:''},{title:'Web Developer',company:'Digital projects · 2020 – 2022',link:''}]
      :[{title:'Business Owner',company:profile.companyName||'Independent · Present',link:''}];
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
    return 'Sep 2026';
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
    const settingsUrl=`devmatch-settings.html${isDeveloper?'':'?role=client'}#account`;
    const dashboardUrl=isDeveloper?'devmatch-dashboard.html':'devmatch-client-dashboard.html';
    const notificationsUrl=isDeveloper?'devmatch-developer-notifications.html':'devmatch-notifications.html';
    const chatUrl=`devmatch-chat.html?role=${isDeveloper?'client':'dev'}`;
    document.documentElement.lang='en';
    document.body.classList.toggle('profile-preview-mode',isPreview);
    document.title=`${displayName} — My Profile | DEV-MATCH`;
    document.querySelectorAll('#brandLink,#overviewLink').forEach(link=>link.href=dashboardUrl);
    setLink('devModeLink',`devmatch-my-profile.html?role=dev`);
    setLink('clientModeLink',`devmatch-my-profile.html?role=client`);
    document.getElementById('devModeLink').classList.toggle('active',isDeveloper);
    document.getElementById('clientModeLink').classList.toggle('active',!isDeveloper);
    setLink('notificationsLink',notificationsUrl);
    setLink('notificationsNavLink',notificationsUrl);
    setLink('userMenu',profileUrl);
    setLink('profileNavLink',profileUrl);
    setLink('settingsLink',settingsUrl.replace('#account',''));
    setLink('messagesLink',chatUrl);
    setLink('projectsLink',isDeveloper?'devmatch-my-projects.html':`${dashboardUrl}#requests`);
    setLink('createAction',isDeveloper?'devmatch-my-projects.html?create=1':`${dashboardUrl}#requests`);
    setLink('allProjectsLink',isDeveloper?'devmatch-my-projects.html':`${dashboardUrl}#requests`);
    setText('topUserRole',isDeveloper?'Developer':'Client');
    setText('workspaceTitle',isDeveloper?'Developer workspace':'Client workspace');
    setText('workspaceSubtitle',isDeveloper?'Showcase & find clients':'Discover & hire');
    setText('workspaceIcon',isDeveloper?'</>':'▣');
    setText('createActionLabel',isDeveloper?'Add Project':'Post a Request');
    setText('projectsLinkLabel',isDeveloper?'My Projects':'My Requests');
    document.getElementById('workspaceBadge').classList.toggle('client-workspace-mode',!isDeveloper);
    document.querySelector('.workspace-icon').classList.toggle('client-workspace-icon',!isDeveloper);
    document.getElementById('identitySpecialty').hidden=!isDeveloper&&!profile.industry;
    if(!isDeveloper&&profile.industry)setText('identitySpecialty',profile.industry);
    setText('identityBio',bio);
    setText('aboutHeading',isDeveloper?'About':'About the business');
    setText('aboutCopy',bio);
    setText('skillsHeading',isDeveloper?'Skills & Tech Stacks':'Services & Focus');
    setText('showcaseHeading',isDeveloper?'Selected work':'Open project requests');
    setText('showcaseDescription',isDeveloper?'A few projects that show what I can build.':'Projects currently shared with developers.');
    setText('statProjectsCaption',isDeveloper?'projects':'open requests');
    setText('statSavesLabel',isDeveloper?'Project favorites':'Request saves');
    setText('statRatingLabel',isDeveloper?'Client rating':'Developer rating');
    setText('contactIntro',isDeveloper?'Have a project in mind? Let’s talk.':'Interested in working together? Get in touch.');
    document.getElementById('editProfile').href=settingsUrl;
    document.getElementById('previewProfile').href=`${profileUrl}&preview=1`;
    if(isPreview){
      document.getElementById('editProfile').hidden=true;
      document.getElementById('previewProfile').hidden=true;
      document.getElementById('previewBanner').hidden=false;
      setLink('returnFromPreview',profileUrl);
    }
    if(!isDeveloper){
      document.getElementById('statProjectsCaption').textContent='open requests';
      document.getElementById('statSavesLabel').textContent='Request saves';
      document.getElementById('statRatingLabel').textContent='Developer rating';
    }
    setLink('directMessageLink',chatUrl);
    setLink('whatsappLink',profile.whatsapp?`https://wa.me/${String(profile.whatsapp).replace(/\D/g,'')}`:'#');
    document.getElementById('whatsappLink').classList.toggle('disabled',!String(profile.whatsapp||'').replace(/\D/g,''));
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
        description:item.description||`${item.type||'Digital product'} built for a growing business.`,
        price:item.price||'Contact for pricing',
        views:Number(item.views)||0,
        favorites:Number(item.favorites)||0,
        art:item.art||'website'
      }));
      showcase.totalCount=published.length;
      showcase.totalViews=published.reduce((sum,item)=>sum+(Number(item.views)||0),0);
      showcase.totalFavorites=published.reduce((sum,item)=>sum+(Number(item.favorites)||0),0);
      return showcase;
    }
    const showcase=[
      {id:'sample-restaurant',title:'Restaurant Website',category:'Company Profile',description:'A warm, responsive website with a digital menu and easy reservations.',price:'Rp 3.500.000',views:245,favorites:32,art:'website'},
      {id:'sample-pos',title:'Small Business POS',category:'Web App',description:'A simple sales and inventory dashboard for a neighborhood café.',price:'Rp 6.000.000',views:1920,favorites:128,art:'dashboard'},
      {id:'sample-store',title:'Online Storefront',category:'E-Commerce',description:'A clean shopping experience with product discovery and checkout.',price:'Rp 4.500.000',views:860,favorites:41,art:'store'},
      {id:'sample-booking',title:'Booking Platform',category:'Web App',description:'A lightweight booking system that keeps appointments organized.',price:'Rp 3.000.000',views:540,favorites:28,art:'dashboard'}
    ];
    showcase.totalCount=12;
    showcase.totalFavorites=864;
    showcase.totalViews=12400;
    return showcase;
  }

  function loadClientRequests(){
    const requests=readStorage('devmatch-client-requests',[]);
    const openRequests=Array.isArray(requests)?requests.filter(item=>item&&item.status==='open'):[];
    const showcase=openRequests.slice(0,6).map(item=>({
      id:item.id,
      title:item.title||'Untitled request',
      category:item.category||item.projectType||'Project request',
      description:item.description||'An open project request looking for the right developer.',
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
    const availability=profile.availability||'Open for hiring';
    const avatar=initials(displayName);
    setText('profileName',displayName);
    setText('profileAvatar',avatar);
    setText('userAvatar',avatar);
    setText('topUserName',displayName);
    setText('identityHandle',`@${username}`);
    setText('identityLocation',[city,country].filter(Boolean).join(', '));
    setText('identitySpecialty',isDeveloper?title:profile.industry||'');
    setText('identityJoined',`Joined ${formatJoined()}`);
    const availabilityBadge=document.getElementById('availabilityBadge');
    availabilityBadge.querySelector('span').textContent=availability;
    availabilityBadge.classList.toggle('busy',availability.toLowerCase().includes('busy'));
    availabilityBadge.classList.toggle('unavailable',/not available|closed/i.test(availability));
  }

  function renderRoleInfo(){
    const root=document.getElementById('roleInfoCard');
    if(isDeveloper){
      const contracts=normalizeList(profile.contractTypes, ['Milestone-based','Fixed-price','Consultation']);
      root.innerHTML=`<div class="card-heading"><h2>Rates &amp; Work Terms</h2></div><div class="role-info-grid"><div class="role-info-item"><small>HOURLY RATE</small><strong>${escapeHtml(profile.hourlyRate||'Rp 150.000')} / hour</strong></div><div class="role-info-item"><small>MINIMUM PROJECT</small><strong>${escapeHtml(profile.minProjectPrice||'Rp 3.500.000')}</strong></div></div><div class="contract-list">${contracts.map(item=>`<span>${escapeHtml(item)}</span>`).join('')}</div>`;
    }else{
      root.innerHTML=`<div class="card-heading"><h2>Company Details</h2></div><div class="role-info-grid"><div class="role-info-item"><small>BUSINESS NAME</small><strong>${escapeHtml(profile.companyName||displayName)}</strong></div><div class="role-info-item"><small>INDUSTRY</small><strong>${escapeHtml(profile.industry||'Small business')}</strong></div><div class="role-info-item"><small>NPWP STATUS</small><strong>${profile.npwp?'On file':'Not provided'}</strong></div><div class="role-info-item"><small>BUSINESS LOCATION</small><strong>${escapeHtml([city,country].filter(Boolean).join(', '))}</strong></div></div>`;
    }
  }

  function renderSkills(){
    document.getElementById('skillList').innerHTML=skills.map(skill=>`<span>${escapeHtml(skill)}</span>`).join('');
  }

  function renderExperience(){
    const root=document.getElementById('experienceList');
    if(!experiences.length){
      root.innerHTML='<li class="empty-state">Experience will appear here when it is added to your profile.</li>';
      return;
    }
    root.innerHTML=experiences.map(item=>{
      const company=item.company||'Independent';
      const href=safeExternalUrl(item.link);
      return `<li class="experience-item"><span class="experience-marker" aria-hidden="true"></span><div class="experience-copy"><b>${escapeHtml(item.title||'Experience')}</b><span>${escapeHtml(company)}${item.period?` · ${escapeHtml(item.period)}`:''}</span>${href?`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">View proof <span aria-hidden="true">↗</span></a>`:''}</div></li>`;
    }).join('');
  }

  function renderConnectedApps(){
    const apps=[
      {name:'WhatsApp Business',icon:'WA',connected:Boolean(String(profile.whatsapp||'').replace(/\D/g,'')),verified:Boolean(profile.whatsappVerified)},
      {name:'GitHub',icon:'GH',connected:Boolean(profile.github||profile.githubUrl),verified:Boolean(profile.githubVerified)},
      {name:'Google',icon:'G',connected:Boolean(profile.googleConnected),verified:Boolean(profile.googleVerified)},
      {name:'LinkedIn',icon:'in',connected:Boolean(profile.linkedin||profile.linkedinUrl),verified:Boolean(profile.linkedinVerified)}
    ];
    document.getElementById('connectedList').innerHTML=apps.map(app=>{
      const status=app.verified?'Verified':app.connected?'Connected':'Not connected';
      return `<div class="connected-app"><div class="connected-app-info"><span class="app-icon">${app.icon}</span><b>${app.name}</b></div><span class="app-status${app.connected?' connected':''}${app.verified?' verified':''}">${status}</span></div>`;
    }).join('');
  }

  function renderProjectCard(project){
    const art=project.art==='dashboard'?'dashboard':project.art==='store'?'store':'website';
    const target=isDeveloper
      ?`devmatch-my-projects.html?project=${encodeURIComponent(project.id)}`
      :`devmatch-client-dashboard.html?role=client#request-detail/${encodeURIComponent(project.id)}`;
    return `<a class="showcase-project" href="${escapeHtml(target)}" aria-label="${escapeHtml(project.title)} — view details"><div class="project-art art-${art}" aria-hidden="true"><div class="project-browser"><div class="browser-bar"><i></i><i></i><i></i></div><div class="browser-content"><span class="art-accent"></span></div></div></div><div class="project-copy"><span class="project-category">${escapeHtml(project.category||'Project')}</span><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.description)}</p><footer class="project-footer"><strong>${escapeHtml(project.price||'Contact for pricing')}</strong><span class="project-metric">◉ <b>${formatCompact(project.views)}</b> &nbsp;♡ <b>${formatCompact(project.favorites)}</b></span></footer></div></a>`;
  }

  function renderProjects(){
    setText('statProjects',String(projects.totalCount??projects.length));
    document.getElementById('projectGrid').innerHTML=projects.length?projects.map(renderProjectCard).join(''):`<p class="empty-state">${isDeveloper?'Your published projects will appear here. Add a project to start building your showcase.':'No open requests right now. Open project requests will appear here for developers to discover.'}</p>`;
    if(!isDeveloper){
      const manage=document.getElementById('allProjectsLink');
      manage.textContent='View requests →';
    }
  }

  function renderReviews(){
    const root=document.getElementById('reviewList');
    if(!isDeveloper){
      root.innerHTML='<p class="empty-state">Reviews from developers will appear here after a completed project.</p>';
      setText('statRating','—');
      setText('statReviews','no reviews yet');
      return;
    }
    const reviews=readStorage('devmatch-profile-reviews',[]);
    if(!Array.isArray(reviews)||!reviews.length){
      root.innerHTML='<p class="empty-state">Client reviews will appear here after a completed project. Keep delivering great work to build your reputation.</p>';
      return;
    }
    root.innerHTML=reviews.slice(0,8).map(review=>{
      const name=review.name||review.client||'Client';
      const stars=Math.max(1,Math.min(5,Number(review.rating)||5));
      return `<article class="review-item"><span class="review-avatar">${escapeHtml(initials(name))}</span><div class="review-copy"><h3>${escapeHtml(name)}</h3><small>${escapeHtml(review.project||'Completed project')}</small><p>${escapeHtml(review.comment||review.text||'')}</p></div><span class="review-rating" aria-label="${stars} out of 5 stars">${'★'.repeat(stars)}</span></article>`;
    }).join('');
    const average=reviews.reduce((sum,item)=>sum+(Number(item.rating)||5),0)/reviews.length;
    setText('statRating',`★ ${average.toFixed(1)}`);
    setText('statReviews',`from ${reviews.length} reviews`);
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
  }

  function showToast(message,isError){
    clearTimeout(toastTimer);
    toast.textContent=message;
    toast.classList.toggle('error',Boolean(isError));
    toast.classList.add('show');
    toastTimer=setTimeout(()=>toast.classList.remove('show'),3000);
  }

  async function shareProfile(){
    const url=new URL(`devmatch-my-profile.html?role=${role}`,location.href).href;
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
        const copied=document.execCommand('copy');
        field.remove();
        if(!copied)throw new Error('Clipboard copy was not permitted.');
      }
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
    if(focus)button.focus();
  }

  configureRole();
  renderIdentity();
  renderRoleInfo();
  renderSkills();
  renderExperience();
  renderConnectedApps();
  renderProjects();
  renderReviews();
  renderActivity();
  renderStats();
  document.getElementById('shareProfile').addEventListener('click',shareProfile);
  document.querySelectorAll('.profile-tab').forEach((button,index,tabs)=>{
    button.addEventListener('click',()=>activateTab(button,false));
    button.addEventListener('keydown',event=>{
      const offset=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;
      if(!offset)return;
      event.preventDefault();
      activateTab(tabs[(index+offset+tabs.length)%tabs.length],true);
    });
  });
})();
