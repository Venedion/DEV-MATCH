(function(){
const projects=window.DEVMATCH_SAMPLE_PROJECTS;
const profiles={
  '@rizkyaditya':{
    gender:'Male',experience:'5 years',age:'27',joined:'Mar 2025',
    about:'I help Indonesian SMEs go digital with fast, reliable websites and POS systems. 5 years shipping Laravel + React for cafés, clinics and retailers across North Sumatra.',
    skills:['React','Laravel','Next.js','MySQL','PostgreSQL','Tailwind','Figma','Docker'],
    experienceItems:[['Senior Web Developer','Sinar Digital · 2023 – Present'],['Full-stack Developer','Freelance · 2021 – 2023'],['Junior Developer','PT Kode Nusantara · 2020 – 2021']],
    links:[['Code','github.com/rizkyaditya'],['Profile','linkedin.com/in/rizkyaditya'],['Website','rizkyaditya.dev']],
    projectFavorites:'864',views:'12.4k',
    portfolio:[
      {title:'Restaurant Website Development',category:'COMPANY PROFILE',type:'Website',description:'Modern responsive website for a restaurant business — menu, reservations and maps.',price:'Rp 3.500.000',age:'3w ago',art:'food-art',views:'245',favorites:'32',id:'restaurant'},
      {title:'Kasir Kopi POS',category:'POS',type:'Web App',description:'Café POS with recipe-based stock deduction and shift closing reports.',price:'Rp 6.000.000',age:'1mo ago',art:'dashboard-art',views:'1.2k',favorites:'96',id:'pos'},
      {title:'Northwind Company Profile',category:'COMPANY PROFILE',type:'Website',description:'Corporate website with CMS, careers page and bilingual content.',price:'Rp 4.500.000',age:'2mo ago',art:'northwind-art',views:'860',favorites:'41',id:'northwind'},
      {title:'Toko Bangunan Inventory',category:'INVENTORY',type:'Web App',description:'Stock, purchase orders and delivery notes for a building-materials store.',price:'Rp 3.000.000 — Rp 7.000.000',age:'3mo ago',art:'inventory-art',views:'540',favorites:'28',id:'inventory'}
    ]
  }
};
const defaultProfile=(project)=>({
  gender:'Not specified',experience:'5 years',age:'—',joined:'Mar 2025',
  about:project.developerBio,
  skills:['React','JavaScript','UI Design','Web Development'],
  experienceItems:[[`${project.specialty} Developer`,'Independent · 2022 – Present'],['Web Developer','Freelance · 2020 – 2022']],
  links:[['Code','github.com'],['Website',project.link]],
  projectFavorites:project.developerFavorites,views:project.developerViews,
  portfolio:projects.filter(item=>item.developer===project.developer).map(item=>({
    title:item.title,category:item.category.toUpperCase(),type:item.type,description:item.description,
    price:item.price,age:item.age,art:item.art,views:'245',favorites:'32',id:item.id
  }))
});
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function normalizeProfileList(value,fallback){
  const values=Array.isArray(value)?value:typeof value==='string'?value.split(/[,\n]/):[];
  const normalized=values.map(item=>String(item).trim()).filter(Boolean);
  return normalized.length||Array.isArray(value)?normalized:fallback;
}
const params=new URLSearchParams(location.search);
const requestedProject=projects.find(item=>item.id===params.get('developer'));
const project=requestedProject||projects[0];
const profile=profiles[project.handle]||defaultProfile(project);
let savedDeveloperProfile=null;
try{
  const saved=localStorage.getItem('devmatch-profile-dev');
  const parsed=saved?JSON.parse(saved):null;
  if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))savedDeveloperProfile=parsed;
}catch(error){
  console.warn('Unable to load the saved developer profile.',error);
}
const projectUsername=project.handle.replace(/^@/,'').toLowerCase();
const savedUsername=String(savedDeveloperProfile?.username||'').replace(/^@/,'').toLowerCase();
const savedName=String(savedDeveloperProfile?.displayName||'').trim().toLowerCase();
const accountMatchesProject=Boolean(savedDeveloperProfile&&(
  (savedUsername&&savedUsername===projectUsername)||
  (savedName&&savedName===project.developer.toLowerCase())
));
const displayedSpecialties=accountMatchesProject
  ?normalizeProfileList(savedDeveloperProfile.specialty,[project.specialty])
  :[project.specialty];
const displayedSkills=accountMatchesProject&&savedDeveloperProfile.skills!==undefined
  ?normalizeProfileList(savedDeveloperProfile.skills,[])
  :profile.skills;
const displayedExperience=accountMatchesProject&&Array.isArray(savedDeveloperProfile.experiences)
  ?savedDeveloperProfile.experiences
    .filter(item=>item&&typeof item==='object'&&(item.title||item.company))
    .map(item=>({
      title:item.title||'Experience',
      company:item.company||'Independent',
      period:item.period||'',
      files:Array.isArray(item.files)?item.files.map(String).filter(Boolean):[]
    }))
  :profile.experienceItems.map(([title,detail])=>({title,company:detail,period:'',files:[]}));
const developerProjects=projects.filter(item=>item.developer===project.developer);
const portfolio=profile.portfolio;
const profileName=project.developer;
const initials=project.initials;
const favoriteKey='devmatch-client-dev-favorites';
if(localStorage.getItem('devmatch-client-project-favorites')===null){const legacy=localStorage.getItem('devmatch-client-favorites');if(legacy!==null)localStorage.setItem('devmatch-client-project-favorites',legacy);}
const favoriteDeveloper=(window.DEVMATCH_SAMPLE_DEVELOPERS||[]).find(developer=>developer.handle===project.handle);
const favoriteId=favoriteDeveloper?.id||project.handle;
let favorites=JSON.parse(localStorage.getItem(favoriteKey)||'[]');
let favoriteProjectIds=JSON.parse(localStorage.getItem('devmatch-client-project-favorites')||'[]');

document.title=`${profileName} — DEV-MATCH`;
document.getElementById('breadcrumbName').textContent=profileName;
document.getElementById('developerName').textContent=profileName;
document.getElementById('developerInitials').textContent=initials;
document.getElementById('developerHandle').textContent=project.handle;
document.getElementById('developerLocation').textContent=`${project.location}, Indonesia`;
document.getElementById('developerRole').textContent=`${displayedSpecialties.slice(0,2).join(' & ')||project.specialty} developer`;
document.getElementById('developerJoined').textContent=profile.joined;
document.getElementById('statProjects').textContent=project.developerProjects;
document.getElementById('statProjectFavorites').textContent=profile.projectFavorites;
document.getElementById('statDeveloperFavorites').textContent=project.developerFavorites;
document.getElementById('statViews').textContent=profile.views;
document.getElementById('developerAbout').textContent=profile.about;
document.getElementById('developerAboutCard').textContent=profile.about;
document.getElementById('developerExperience').textContent=profile.experience;
document.getElementById('developerLocationCard').textContent=`${project.location}, Indonesia`;
document.getElementById('portfolioCount').textContent=project.developerProjects;
const chatTarget=`devmatch-chat.html?role=client&project=${encodeURIComponent(project.id)}`;
document.getElementById('contactDeveloper').href=chatTarget;
document.getElementById('sidebarContactDeveloper').href=chatTarget;
document.getElementById('developerSpecialties').innerHTML=displayedSpecialties.length?displayedSpecialties.map(item=>`<div class="profile-specialty-card"><b>${escapeHtml(item)}</b></div>`).join(''):'<span>No specialization added yet.</span>';
document.getElementById('developerSkills').innerHTML=displayedSkills.length?displayedSkills.map(skill=>`<span>${escapeHtml(skill)}</span>`).join(''):'<span>No skills added yet.</span>';
document.getElementById('developerExperienceList').innerHTML=displayedExperience.length?displayedExperience.map(item=>`<li class="experience-item"><span class="experience-marker" aria-hidden="true"></span><div class="experience-copy"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.company)}${item.period?` · ${escapeHtml(item.period)}`:''}</span>${item.files.length?`<small class="experience-files">${escapeHtml(item.files.join(', '))}</small>`:''}</div></li>`).join(''):'<li class="empty-state">No experience added yet.</li>';
document.getElementById('developerLinks').innerHTML=profile.links.map(([label,url])=>`<a href="${url.startsWith('http')?'':'https://'}${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><span class="public-link-icon">${label==='Code'?'‹ ›':label==='Website'?'◎':'♙'}</span><span><b>${escapeHtml(label)}</b><small>${escapeHtml(url)}</small></span><span aria-hidden="true">↗</span></a>`).join('');

const client=JSON.parse(localStorage.getItem('devmatch-profile-client')||'{}');
document.getElementById('clientName').textContent=client.displayName||'Client';
document.getElementById('clientInitials').textContent=(client.displayName||'Client').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CL';
const favoriteButton=document.getElementById('favoriteDeveloper');
function renderFavoriteButton(saved){
  favoriteButton.setAttribute('aria-pressed',String(saved));
  favoriteButton.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><span>${saved?'Favorited':'Favorite'}</span>`;
}
const favoriteStateReady=window.devMatchBackend.ready.then(user=>user
  ?window.devMatchBackend.loadFavorites()
  :null
).then(records=>{
  if(!records)return false;
  favorites=records.filter(item=>item.type==='developer').map(item=>item.id);
  favoriteProjectIds=records.filter(item=>item.type==='project').map(item=>item.id);
  localStorage.setItem(favoriteKey,JSON.stringify(favorites));
  localStorage.setItem('devmatch-client-project-favorites',JSON.stringify(favoriteProjectIds));
  renderFavoriteButton(favorites.includes(favoriteId));
  renderProjects();
  return true;
}).catch(error=>{
  console.error('Unable to load favorites from Supabase.',error);
  window.alert('Unable to load favorites. Check your connection and try again.');
  return null;
});
renderFavoriteButton(favorites.includes(favoriteId));
favoriteButton.addEventListener('click',async()=>{
  const authenticated=await favoriteStateReady;
  if(authenticated===null)return;
  const alreadyFavorited=favorites.includes(favoriteId);
  if(authenticated){
    try{
      await window.devMatchBackend.setFavorite('developer',favoriteId,!alreadyFavorited);
    }catch(error){
      console.error('Unable to update developer favorite in Supabase.',error);
      window.alert('Unable to save this favorite. Please try again.');
      return;
    }
  }
  favorites=alreadyFavorited?favorites.filter(id=>id!==favoriteId):[...favorites,favoriteId];
  localStorage.setItem(favoriteKey,JSON.stringify(favorites));
  renderFavoriteButton(!alreadyFavorited);
  const favoritesCount=Number(document.getElementById('statDeveloperFavorites').textContent)+(alreadyFavorited?-1:1);
  document.getElementById('statDeveloperFavorites').textContent=String(favoritesCount);
});
document.getElementById('copyProfileLink').addEventListener('click',async()=>{
  try{
    await navigator.clipboard.writeText(location.href);
    document.getElementById('copyProfileLink').textContent='✓';
  }catch(error){
    document.getElementById('copyProfileLink').setAttribute('aria-label','Copying is not available in this browser');
  }
});

let activeFilter='All';
let activeTab='projects';
let activeQuery='';
const filters=['All','Website','Web App','Android / iOS'];
const filtersRoot=document.getElementById('portfolioFilters');
const grid=document.getElementById('portfolioGrid');
const empty=document.getElementById('portfolioEmpty');
const commentsPanel=document.getElementById('commentsPanel');
const sortSelect=document.getElementById('sortProjects');
filtersRoot.innerHTML=filters.map(filter=>`<button type="button" class="${filter==='All'?'active':''}" data-filter="${escapeHtml(filter)}">${escapeHtml(filter)} <small>${filter==='All'?portfolio.length:portfolio.filter(item=>item.type===filter).length}</small></button>`).join('');
function viewCount(value){
  const count=parseFloat(value.replace(/[^\d.]/g,''))||0;
  return value.toLowerCase().includes('k')?count*1000:count;
}
function renderProjects(){
  const items=portfolio.filter(item=>(activeFilter==='All'||item.type===activeFilter)&&(!activeQuery||`${item.title} ${item.description} ${item.type}`.toLowerCase().includes(activeQuery)));
  const sort=sortSelect.value;
  items.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='newest'?portfolio.indexOf(a)-portfolio.indexOf(b):viewCount(b.views)-viewCount(a.views));
  grid.innerHTML=items.map(item=>{
    const art=item.art==='dashboard-art'?'dashboard':item.art==='store-art'?'store':'website';
    return `<article class="showcase-project">
      <div class="project-art art-${art}"><div class="project-browser" aria-hidden="true"><div class="browser-bar"><i></i><i></i><i></i></div><div class="browser-content"><span class="art-accent"></span></div></div><button type="button" class="public-project-favorite" data-project-favorite="${escapeHtml(item.id)}" aria-label="${favoriteProjectIds.includes(item.id)?'Remove':'Add'} ${escapeHtml(item.title)} ${favoriteProjectIds.includes(item.id)?'from':'to'} favorites" aria-pressed="${favoriteProjectIds.includes(item.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0l-1.06 1.06-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button></div>
      <div class="project-copy"><span class="project-category">${escapeHtml(item.category)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><footer class="project-footer"><strong>${escapeHtml(item.price)}</strong><span class="project-metric">◉ <b>${escapeHtml(item.views)}</b> &nbsp;♡ <b>${escapeHtml(item.favorites)}</b></span></footer></div>
    </article>`;
  }).join('');
  document.querySelectorAll('[data-project-favorite]').forEach(button=>button.addEventListener('click',async()=>{
    const authenticated=await favoriteStateReady;
    if(authenticated===null)return;
    const id=button.dataset.projectFavorite;
    const saved=favoriteProjectIds.includes(id);
    if(authenticated){
      try{
        await window.devMatchBackend.setFavorite('project',id,!saved);
      }catch(error){
        console.error('Unable to update project favorite in Supabase.',error);
        window.alert('Unable to save this favorite. Please try again.');
        return;
      }
    }
    favoriteProjectIds=saved?favoriteProjectIds.filter(value=>value!==id):[...favoriteProjectIds,id];
    localStorage.setItem('devmatch-client-project-favorites',JSON.stringify(favoriteProjectIds));
    renderProjects();
  }));
  empty.hidden=items.length>0;
}
async function renderComments(){
  const projectComments=await Promise.all(developerProjects.map(async item=>
    (await window.devMatchBackend.loadProjectComments(item.id)).map(comment=>({...comment,project:item.title}))
  ));
  const comments=projectComments.flat();
  commentsPanel.innerHTML=comments.length?comments.map(comment=>`<article class="review-item"><span class="review-avatar">${escapeHtml(comment.initials||'CL')}</span><div class="review-copy"><h3>${escapeHtml(comment.name)}</h3><small>on ${escapeHtml(comment.project)}</small><p>${escapeHtml(comment.text)}</p></div></article>`).join(''):'<p class="empty-state">No comments yet. Comments from project discussions will appear here.</p>';
}
filtersRoot.addEventListener('click',event=>{
  const button=event.target.closest('[data-filter]');
  if(!button)return;
  activeFilter=button.dataset.filter;
  filtersRoot.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button));
  renderProjects();
});
sortSelect.addEventListener('change',renderProjects);
document.querySelector('.portfolio-tabs').addEventListener('click',event=>{
  const button=event.target.closest('[data-tab]');
  if(!button)return;
  activeTab=button.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(tab=>{
    const selected=tab===button;
    tab.classList.toggle('active',selected);
    tab.setAttribute('aria-selected',String(selected));
  });
  const showProjects=activeTab==='projects';
  filtersRoot.hidden=!showProjects;
  grid.hidden=!showProjects;
  sortSelect.parentElement.hidden=!showProjects;
  commentsPanel.hidden=showProjects;
  empty.hidden=showProjects||portfolio.length>0;
  if(!showProjects)renderComments().catch(error=>{
    console.error('Unable to load developer portfolio comments from Supabase.',error);
    window.alert('Unable to load comments. Check your connection and try again.');
  });
});
document.getElementById('profileSearch').addEventListener('input',event=>{
  activeQuery=event.target.value.trim().toLowerCase();
  renderProjects();
});
renderProjects();
})();
