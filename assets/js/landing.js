(function(){
  'use strict';
  const heart='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  const wa='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20l1.2-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>';
  const pin='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const initials=name=>(String(name||'').match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'DM';
  const themeToggle=document.getElementById('themeToggle');
  function isDarkTheme(){return document.documentElement.dataset.theme?document.documentElement.dataset.theme==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;}
  function updateThemeToggle(){const dark=isDarkTheme();themeToggle.setAttribute('aria-pressed',String(dark));const label=dark?'Switch to light mode':'Switch to dark mode';themeToggle.setAttribute('aria-label',label);themeToggle.title=label;}
  themeToggle.addEventListener('click',()=>{const theme=isDarkTheme()?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('devmatch-landing-theme',theme);}catch(error){console.warn('Unable to save the landing page theme preference.',error);}updateThemeToggle();});
  updateThemeToggle();
  const chips=document.getElementById('chips'),projectGrid=document.getElementById('projGrid'),developerGrid=document.getElementById('devGrid');
  const projectStatus=document.getElementById('landingProjectStatus'),directoryStatus=document.getElementById('landingDirectoryStatus');
  const types=['All projects','Website','Web App','Android / iOS','Desktop App'];
  let activeType='All projects',projects=[],projectsLoaded=false;
  function renderProjects(){
    chips.innerHTML=types.map(type=>`<button class="chip" aria-pressed="${type===activeType}" data-type="${escapeHtml(type)}">${escapeHtml(type)}</button>`).join('');
    const filtered=projects.filter(project=>activeType==='All projects'||project.type===activeType);
    projectGrid.innerHTML=filtered.length?filtered.map((project,index)=>`<article class="card">
      <a class="landing-project-link" href="devmatch-discover-project-detail.html?project=${encodeURIComponent(project.id)}" aria-label="View ${escapeHtml(project.title)}">
      <div class="thumb landing-art-${index%4}"><span class="type">${escapeHtml(project.type)}</span><div class="mock"><i style="width:22%"></i><div style="flex:1;display:grid;gap:6px;align-content:start"><i style="height:10px;width:60%"></i><i style="height:36px"></i><i style="height:10px;width:80%"></i></div></div></div>
      <div class="pbody"><div class="meta"><span>${escapeHtml(project.category)}</span><span>${escapeHtml(project.date)}</span></div><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.description)}</p><div class="price"><small>Published project</small><b>${escapeHtml(project.price||'Price not specified')}</b></div></div></a></article>`).join('')
      :projectsLoaded?'<p class="landing-empty" role="status">No published projects in this category yet.</p>':'';
  }
  chips.addEventListener('click',event=>{const button=event.target.closest('[data-type]');if(!button)return;activeType=button.dataset.type;renderProjects();});
  async function loadProjects(){
    projectStatus.hidden=false;projectStatus.textContent='Loading published projects…';
    try{
      const {data,error}=await window.devMatchBackend.client.from('projects')
        .select('id,title,project_type,category,price,data,created_at,updated_at')
        .eq('project_kind','portfolio').eq('status','published').order('updated_at',{ascending:false}).limit(8);
      if(error)throw error;
      projects=(data||[]).map(row=>{
        const detail=row.data&&typeof row.data==='object'?row.data:{};
        return {id:row.id,title:String(row.title||detail.title||''),type:String(row.project_type||detail.projectType||detail.type||''),
          category:String(row.category||detail.category||''),price:String(row.price||detail.price||''),description:String(detail.description||detail.overview||''),
          date:new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(row.created_at||row.updated_at))};
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
    try{
      const user=await window.devMatchBackend.ready;
      if(!user){developerGrid.innerHTML='';directoryStatus.textContent='Sign in to browse developer profiles.';return;}
      directoryStatus.textContent='Loading developer directory…';
      const {data:account,error:accountError}=await window.devMatchBackend.client.from('profiles')
        .select('account_role').eq('id',user.id).single();
      if(accountError)throw accountError;
      if(account.account_role!=='client'){
        developerGrid.innerHTML='';
        directoryStatus.textContent='Developer profiles are available to client accounts.';
        return;
      }
      const {data,error}=await window.devMatchBackend.client.from('directory_people')
        .select('id,display_name,account_role,profile_data,published_portfolio_count').eq('account_role','dev').limit(4);
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
