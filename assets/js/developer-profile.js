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
const params=new URLSearchParams(location.search);
const requestedProject=projects.find(item=>item.id===params.get('developer'));
const project=requestedProject||projects[0];
const profile=profiles[project.handle]||defaultProfile(project);
const developerProjects=projects.filter(item=>item.developer===project.developer);
const portfolio=profile.portfolio;
const profileName=project.developer;
const initials=project.initials;
const favoriteKey='devmatch-client-dev-favorites';
if(localStorage.getItem('devmatch-client-project-favorites')===null){const legacy=localStorage.getItem('devmatch-client-favorites');if(legacy!==null)localStorage.setItem('devmatch-client-project-favorites',legacy);}
const favoriteDeveloper=(window.DEVMATCH_SAMPLE_DEVELOPERS||[]).find(developer=>developer.handle===project.handle);
const favoriteId=favoriteDeveloper?.id||project.handle;
const favorites=JSON.parse(localStorage.getItem(favoriteKey)||'[]');

document.title=`${profileName} — DEV-MATCH`;
document.getElementById('breadcrumbName').textContent=profileName;
document.getElementById('developerName').textContent=profileName;
document.getElementById('developerInitials').textContent=initials;
document.getElementById('developerHandle').textContent=project.handle;
document.getElementById('developerLocation').textContent=`${project.location}, Indonesia`;
document.getElementById('developerRole').textContent=`${project.specialty} developer`;
document.getElementById('developerJoined').textContent=profile.joined;
document.getElementById('statProjects').textContent=project.developerProjects;
document.getElementById('statProjectFavorites').textContent=profile.projectFavorites;
document.getElementById('statDeveloperFavorites').textContent=project.developerFavorites;
document.getElementById('statViews').textContent=profile.views;
document.getElementById('developerAbout').textContent=profile.about;
document.getElementById('developerGender').textContent=profile.gender;
document.getElementById('developerExperience').textContent=profile.experience;
document.getElementById('developerAge').textContent=profile.age;
document.getElementById('portfolioCount').textContent=project.developerProjects;
const chatTarget=`devmatch-chat.html?role=client&project=${encodeURIComponent(project.id)}`;
document.getElementById('contactDeveloper').href=chatTarget;
document.getElementById('sidebarContactDeveloper').href=chatTarget;
document.getElementById('developerSkills').innerHTML=profile.skills.map(skill=>`<span>${escapeHtml(skill)}</span>`).join('');
document.getElementById('developerExperienceList').innerHTML=profile.experienceItems.map(([role,detail])=>`<li><b>${escapeHtml(role)}</b><span>${escapeHtml(detail)}</span></li>`).join('');
document.getElementById('developerLinks').innerHTML=profile.links.map(([label,url])=>`<a href="${url.startsWith('http')?'':'https://'}${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><span class="link-icon">${label==='Code'?'‹ ›':label==='Website'?'◎':'♙'}</span><span>${escapeHtml(url)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6m-11 5L20 4M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></svg></a>`).join('');

const client=JSON.parse(localStorage.getItem('devmatch-profile-client')||'{}');
document.getElementById('clientName').textContent=client.displayName||'Client';
document.getElementById('clientInitials').textContent=(client.displayName||'Client').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CL';
const favoriteButton=document.getElementById('favoriteDeveloper');
function renderFavoriteButton(saved){
  favoriteButton.setAttribute('aria-pressed',String(saved));
  favoriteButton.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><span>${saved?'Favorited':'Favorite'}</span>`;
}
renderFavoriteButton(favorites.includes(favoriteId));
favoriteButton.addEventListener('click',()=>{
  const current=JSON.parse(localStorage.getItem(favoriteKey)||'[]');
  const alreadyFavorited=current.includes(favoriteId);
  const updated=alreadyFavorited?current.filter(id=>id!==favoriteId):[...current,favoriteId];
  localStorage.setItem(favoriteKey,JSON.stringify(updated));
  renderFavoriteButton(updated.includes(favoriteId));
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
function artContent(item){
  if(item.art==='dashboard-art')return '<div class="mock-dashboard"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
  if(item.art==='northwind-art')return '<div class="mock-northwind"><b>Building<br>better futures.</b><i></i></div>';
  if(item.art==='inventory-art')return '<div class="mock-inventory"><b>Inventory</b><i></i><i></i><i></i><i></i></div>';
  return '<div class="mock-food"><b>Savor every<br>moment.</b><i></i></div>';
}
function viewCount(value){
  const count=parseFloat(value.replace(/[^\d.]/g,''))||0;
  return value.toLowerCase().includes('k')?count*1000:count;
}
function renderProjects(){
  const savedProjects=JSON.parse(localStorage.getItem('devmatch-client-project-favorites')||'[]');
  const items=portfolio.filter(item=>(activeFilter==='All'||item.type===activeFilter)&&(!activeQuery||`${item.title} ${item.description} ${item.type}`.toLowerCase().includes(activeQuery)));
  const sort=sortSelect.value;
  items.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='newest'?portfolio.indexOf(a)-portfolio.indexOf(b):viewCount(b.views)-viewCount(a.views));
  grid.innerHTML=items.map(item=>`<article class="portfolio-card">
    <div class="portfolio-art ${escapeHtml(item.art)}"><span class="art-tag">${escapeHtml(item.type)}</span><button type="button" class="project-favorite" data-project-favorite="${escapeHtml(item.id)}" aria-label="${savedProjects.includes(item.id)?'Remove':'Add'} ${escapeHtml(item.title)} ${savedProjects.includes(item.id)?'from':'to'} favorites" aria-pressed="${savedProjects.includes(item.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>${artContent(item)}</div>
    <div class="portfolio-card-body"><div class="project-card-meta"><b>${escapeHtml(item.category)}</b><span>${escapeHtml(item.age)}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><div class="portfolio-price"><span><small> ${item.price.includes('—')?'CUSTOM QUOTE':'STARTING FROM'}</small><b>${escapeHtml(item.price)}</b></span><a href="devmatch-discover-projects.html" aria-label="Explore ${escapeHtml(item.title)}">→</a></div><div class="portfolio-by"><span>${escapeHtml(initials)}</span><b>${escapeHtml(profileName)}</b><small>◎ ${escapeHtml(item.views)} &nbsp;♡ ${escapeHtml(item.favorites)}</small></div></div>
  </article>`).join('');
  document.querySelectorAll('[data-project-favorite]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.projectFavorite;
    const saved=JSON.parse(localStorage.getItem('devmatch-client-project-favorites')||'[]');
    const updated=saved.includes(id)?saved.filter(value=>value!==id):[...saved,id];
    localStorage.setItem('devmatch-client-project-favorites',JSON.stringify(updated));
    renderProjects();
  }));
  empty.hidden=items.length>0;
}
function renderComments(){
  const comments=developerProjects.flatMap(item=>JSON.parse(localStorage.getItem(`devmatch-project-comments-${item.id}`)||'[]').map(comment=>({...comment,project:item.title})));
  commentsPanel.innerHTML=comments.length?comments.map(comment=>`<article><span>${escapeHtml(comment.initials||'CL')}</span><div><b>${escapeHtml(comment.name)}</b><small>on ${escapeHtml(comment.project)}</small><p>${escapeHtml(comment.text)}</p></div></article>`).join(''):'<p>No comments yet. Comments from project discussions will appear here.</p>';
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
  if(!showProjects)renderComments();
});
document.getElementById('profileSearch').addEventListener('input',event=>{
  activeQuery=event.target.value.trim().toLowerCase();
  renderProjects();
});
renderProjects();
})();
