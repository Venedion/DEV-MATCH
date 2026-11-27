(function(){
  'use strict';
  const heart='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  const wa='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20l1.2-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>';
  const pin='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const initials=name=>(String(name||'').match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'DM';
  function safeProjectCover(value){
    if(typeof value!=='string'||!value.trim())return '';
    try{
      const url=new URL(value);
      return url.origin==='https://yxwktllqbmhustmhdaqi.supabase.co'
        &&url.pathname.startsWith('/storage/v1/object/public/project-media/')?url.href:'';
    }catch{return '';}
  }
  const themeToggle=document.getElementById('themeToggle');
  function isDarkTheme(){return document.documentElement.dataset.theme?document.documentElement.dataset.theme==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;}
  function updateThemeToggle(){const dark=isDarkTheme();themeToggle.setAttribute('aria-pressed',String(dark));const label=dark?'Switch to light mode':'Switch to dark mode';themeToggle.setAttribute('aria-label',label);themeToggle.title=label;}
  themeToggle.addEventListener('click',()=>{const theme=isDarkTheme()?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('devmatch-landing-theme',theme);}catch(error){console.warn('Unable to save the landing page theme preference.',error);}updateThemeToggle();});
  updateThemeToggle();
  const projectGrid=document.getElementById('projGrid'),developerGrid=document.getElementById('devGrid');
  const projectStatus=document.getElementById('landingProjectStatus'),directoryStatus=document.getElementById('landingDirectoryStatus');
  let projects=[],projectsLoaded=false;
  projectGrid.addEventListener('click',event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest('a[data-project-detail]');
    if(!link||typeof window.openProjectDetails!=='function')return;
    event.preventDefault();
    window.openProjectDetails(link.dataset.projectDetail);
  });
  function renderProjects(){
    projectGrid.innerHTML=projects.length?projects.map((project,index)=>`<article class="card">
      <a class="landing-project-link" data-project-detail="${escapeHtml(project.id)}" href="devmatch-discover-project-detail.html?project=${encodeURIComponent(project.id)}" aria-label="View ${escapeHtml(project.title)}">
      <div class="thumb landing-art-${index%4}${project.coverImage?' has-image':''}">${project.coverImage?`<img class="landing-project-image" data-project-cover src="${escapeHtml(project.coverImage)}" alt="" loading="lazy" decoding="async">`:''}<span class="type">${escapeHtml(project.type)}</span><div class="mock"><i style="width:22%"></i><div style="flex:1;display:grid;gap:6px;align-content:start"><i style="height:10px;width:60%"></i><i style="height:36px"></i><i style="height:10px;width:80%"></i></div></div></div>
      <div class="pbody"><div class="meta"><span>${escapeHtml(project.category)}</span><span>${escapeHtml(project.date)}</span></div><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.description)}</p><div class="price"><small>Published project</small><b>${escapeHtml(project.price||'Price not specified')}</b></div></div></a></article>`).join('')
      :projectsLoaded?'<p class="landing-empty" role="status">No published projects are available yet.</p>':'';
  }
  projectGrid.addEventListener('error',event=>{
    const image=event.target.closest('img[data-project-cover]');
    if(!image)return;
    image.closest('.thumb')?.classList.remove('has-image');
    image.remove();
  },true);
  async function loadProjects(){
    projectStatus.hidden=false;
    window.DEVMATCH_SKELETON?.status(projectStatus,'Loading published projects');
    window.DEVMATCH_SKELETON?.cards(projectGrid,4,'landing-project');
    try{
      const {data,error}=await window.devMatchBackend.client.rpc('get_landing_featured_projects');
      if(error)throw error;
      projects=(data||[]).map(row=>{
        const detail=row.data&&typeof row.data==='object'?row.data:{};
        const mediaImages=Array.isArray(detail.media)?detail.media.filter(value=>
          typeof value==='string'&&/\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.test(value)
        ):[];
        const coverImage=[row.cover_image,detail.coverImage,...mediaImages].map(safeProjectCover).find(Boolean)||'';
        return {id:row.id,title:String(row.title||detail.title||''),type:String(row.project_type||detail.projectType||detail.type||''),
          category:String(row.category||detail.category||''),price:String(row.price||detail.price||''),description:String(detail.description||detail.overview||''),
          coverImage,date:new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(row.created_at||row.updated_at))};
      });
      projectsLoaded=true;
      renderProjects();projectStatus.hidden=true;
    }catch(error){console.error('Unable to load public projects for the landing page.',error);projects=[];projectsLoaded=false;renderProjects();projectStatus.textContent='Published projects could not be loaded. Check your connection and try again.';}
  }
  function renderDevelopers(people){
    developerGrid.innerHTML=people.length?people.map(person=>{
      const profile=person.profile_data||{},name=String(person.display_name||'DEV-MATCH member');
      const skills=Array.isArray(profile.skills)?profile.skills.map(String):[];
      const specialty=String(profile.specialtyOther||profile.specialty||'Developer');
      const location=String(profile.city||'Location not provided');
      const availability=String(profile.availability||'Availability not provided');
      return `<article class="card dcard"><div class="dh"><span class="av">${escapeHtml(initials(name))}</span><div><b>${escapeHtml(name)}</b><span>${pin}${escapeHtml(location)}</span></div></div>
        <div class="tags"><span class="status s-free">● ${escapeHtml(availability)}</span><span class="t">${escapeHtml(specialty)}</span></div>
        <p>${escapeHtml(profile.bio||'No biography provided.')}</p><div class="tags">${skills.slice(0,4).map(skill=>`<span class="m">${escapeHtml(skill)}</span>`).join('')}</div>
        <div class="dstats"><div><b>${Number(person.published_portfolio_count)||0}</b><small>Published projects</small></div></div>
        <div class="acts"><a class="btn ghost sm2" href="devmatch-developer-profile.html?developer=${encodeURIComponent(person.id)}">View Profile</a><a class="btn sm2" href="devmatch-chat.html?contact=${encodeURIComponent(person.id)}&amp;role=client">${wa}Contact</a></div></article>`;
    }).join(''):'<p class="landing-empty" role="status">No developer profiles are available yet.</p>';
  }
  async function loadDirectory(){
    directoryStatus.hidden=false;
    window.DEVMATCH_SKELETON?.status(directoryStatus,'Loading developer directory');
    window.DEVMATCH_SKELETON?.cards(developerGrid,4,'landing-developer');
    try{
      const user=await window.devMatchBackend.ready;
      if(!user){developerGrid.innerHTML='';directoryStatus.textContent='Sign in to browse developer profiles.';return;}
      window.DEVMATCH_SKELETON?.status(directoryStatus,'Loading developer directory');
      const account = await window.devMatchBackend.loadProfile(user);
      if(account.account_role!=='client'){
        developerGrid.innerHTML='';
        directoryStatus.textContent='Developer profiles are available to client accounts.';
        return;
      }
      const {data,error}=await window.devMatchBackend.client.rpc('get_landing_featured_developers');
      if(error)throw error;
      renderDevelopers(data||[]);directoryStatus.hidden=true;
    }catch(error){console.error('Unable to load the developer directory for the landing page.',error);developerGrid.innerHTML='';directoryStatus.textContent='Developer profiles could not be loaded. Check your connection and try again.';}
  }
  function setMode(mode){
    const dev=mode==='dev';
    document.getElementById('loginLink').href='devmatch-auth.html?mode=login&role='+(dev?'dev':'client');
    document.getElementById('startLink').href='devmatch-role.html?role='+(dev?'dev':'client');
  }
  document.getElementById('p-dev').onmouseenter=()=>setMode('dev');
  document.getElementById('p-cli').onmouseenter=()=>setMode('cli');
  loadProjects();
  loadDirectory();
})();
