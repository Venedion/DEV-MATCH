const clientProfile=JSON.parse(localStorage.getItem('devmatch-profile-client')||'{}');
const clientName=clientProfile.displayName||'Client';
const clientNameParts=clientName.trim().split(/\s+/).filter(Boolean);
document.getElementById('topUserName').textContent=clientName;
document.getElementById('userAvatar').textContent=clientNameParts.slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CL';
const hour=new Date().getHours();
document.getElementById('greeting').textContent=(hour<12?'Good morning, ':hour<18?'Good afternoon, ':'Good evening, ')+clientNameParts[0];

const sampleProjects=window.DEVMATCH_SAMPLE_PROJECTS;
const favoritesKey='devmatch-client-favorites';
const requestsKey='devmatch-client-requests';
let favorites=JSON.parse(localStorage.getItem(favoritesKey)||'[]');
let requests=JSON.parse(localStorage.getItem(requestsKey)||'[]');
let activeCategory='All';
let activeQuery='';
let favoritesOnly=false;
const grid=document.getElementById('projectGrid');

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function artMarkup(project){
  const artwork=project.art==='dashboard-art'
    ?'<div class="mini-bars"><i></i><i></i><i></i><i></i><i></i><i></i></div>'
    :project.art==='analytics-art'
      ?'<div class="analytics-stats"><i></i><i></i><i></i></div><div class="analytics-graph"></div>'
      :'<span class="art-title"></span><span class="art-copy"></span><div class="art-graphic"></div>';
  return `<div class="art-window"><div class="art-header"><i></i><i></i><i></i></div><div class="art-layout"><div class="art-sidebar"></div><div class="art-content">${artwork}</div></div></div>`;
}

function renderProjects(){
  const filtered=sampleProjects.filter(project=>{
    const categoryMatches=activeCategory==='All'||project.category===activeCategory||project.type===activeCategory;
    const queryMatches=!activeQuery||[project.title,project.type,project.category,project.description,project.developer].join(' ').toLowerCase().includes(activeQuery);
    return categoryMatches&&queryMatches&&(!favoritesOnly||favorites.includes(project.id));
  });
  grid.innerHTML=filtered.map(project=>`
    <article class="client-project-card" data-project="${escapeHtml(project.id)}" tabindex="0" role="link" aria-label="View ${escapeHtml(project.title)} details">
      <div class="project-art ${project.art}">
        <span class="art-label">${escapeHtml(project.type)}</span>
        <button class="favorite-button" type="button" data-favorite="${project.id}" aria-pressed="${favorites.includes(project.id)}" aria-label="${favorites.includes(project.id)?'Remove from':'Add to'} favorites">
          <svg viewBox="0 0 24 24"><path d="m20.8 4.6-1.4-1.4a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>
        </button>
        ${artMarkup(project)}
      </div>
      <div class="project-body">
        <div class="project-meta"><b>${escapeHtml(project.category)}</b><span>${escapeHtml(project.age)}</span></div>
        <h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.description)}</p>
        <div class="project-price">${escapeHtml(project.price)}</div>
        <div class="project-by"><span class="developer-avatar">${escapeHtml(project.initials)}</span>${escapeHtml(project.developer)}<span class="developer-location">${escapeHtml(project.location)}</span></div>
      </div>
    </article>`).join('');
  document.getElementById('emptyState').hidden=filtered.length>0;
  document.getElementById('resultsLabel').textContent=activeQuery||activeCategory!=='All'
    ?`${filtered.length} project${filtered.length===1?'':'s'} found.`
    :'Explore ready-to-build ideas from independent developers.';
  document.getElementById('favoriteCount').textContent=String(favorites.length);
}

function renderRequests(){
  const container=document.getElementById('requestList');
  if(!requests.length){
    container.innerHTML='<p class="request-empty">No requests yet. Post a project request to let developers know what you need.</p>';
    return;
  }
  container.innerHTML=requests.map(request=>`<article class="request-item"><h3>${escapeHtml(request.title)}</h3><p>${escapeHtml(request.category)}${request.budget?' · '+escapeHtml(request.budget):''}</p><span class="request-status">Draft</span></article>`).join('');
}

grid.addEventListener('click',event=>{
  const button=event.target.closest('[data-favorite]');
  if(button){
    const id=button.dataset.favorite;
    favorites=favorites.includes(id)?favorites.filter(item=>item!==id):[...favorites,id];
    localStorage.setItem(favoritesKey,JSON.stringify(favorites));
    renderProjects();
    return;
  }
  const card=event.target.closest('[data-project]');
  if(card){
    window.openProjectDetails(card.dataset.project);
  }
});
grid.addEventListener('keydown',event=>{
  const card=event.target.closest('[data-project]');
  if(card&&(event.key==='Enter'||event.key===' ')&&event.target===card){
    event.preventDefault();
    window.openProjectDetails(card.dataset.project);
  }
});
document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{
  favoritesOnly=false;
  activeCategory=button.dataset.category;
  document.querySelectorAll('[data-category]').forEach(item=>item.classList.toggle('selected',item===button));
  renderProjects();
}));
document.querySelectorAll('[data-query]').forEach(button=>button.addEventListener('click',()=>{
  activeQuery=button.dataset.query.toLowerCase();
  document.getElementById('heroSearchInput').value=button.dataset.query;
  renderProjects();
  document.getElementById('projects').scrollIntoView({behavior:'smooth'});
}));
function searchProjects(value){
  activeQuery=value.trim().toLowerCase();
  activeCategory='All';
  favoritesOnly=false;
  document.querySelectorAll('[data-category]').forEach(button=>button.classList.toggle('selected',button.dataset.category==='All'));
  document.getElementById('searchInput').value=value;
  document.getElementById('heroSearchInput').value=value;
  renderProjects();
}
document.getElementById('heroSearch').addEventListener('submit',event=>{
  event.preventDefault();
  searchProjects(document.getElementById('heroSearchInput').value);
  document.getElementById('projects').scrollIntoView({behavior:'smooth'});
});
document.getElementById('searchInput').addEventListener('input',event=>{
  searchProjects(event.target.value);
});
document.querySelectorAll('.client-nav-item[href^="#"]').forEach(link=>link.addEventListener('click',()=>{
  document.querySelectorAll('.client-nav-item').forEach(item=>item.classList.remove('active'));
  link.classList.add('active');
  if(link.hasAttribute('data-favorites-filter')){
    activeQuery='';
    activeCategory='All';
    favoritesOnly=true;
    renderProjects();
  }
}));
document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();
    document.getElementById('searchInput').focus();
  }
});

const requestDialog=document.getElementById('requestDialog');
const requestForm=document.getElementById('requestForm');
document.querySelectorAll('[data-open-request]').forEach(button=>button.addEventListener('click',()=>requestDialog.showModal()));
document.querySelectorAll('[data-close-request]').forEach(button=>button.addEventListener('click',()=>requestDialog.close()));
requestDialog.addEventListener('click',event=>{if(event.target===requestDialog)requestDialog.close()});
requestForm.addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(requestForm);
  const request={title:String(data.get('title')).trim(),category:String(data.get('category')),budget:String(data.get('budget')).trim(),description:String(data.get('description')).trim()};
  if(!request.title)return;
  requests.unshift(request);
  localStorage.setItem(requestsKey,JSON.stringify(requests));
  renderRequests();
  requestForm.reset();
  requestDialog.close();
});
renderProjects();
renderRequests();
