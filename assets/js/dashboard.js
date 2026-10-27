const profile=JSON.parse(localStorage.getItem('devmatch-profile-dev')||'{}');
const displayName=profile.displayName||'Developer';
const nameParts=displayName.trim().split(/\s+/).filter(Boolean);
document.getElementById('welcomeName').textContent=nameParts[0]||'Developer';
document.getElementById('topUserName').textContent=displayName;
document.getElementById('userAvatar').textContent=nameParts.slice(0,2).map(part=>part[0]).join('').toUpperCase()||'DM';
const notificationReadIds=new Set(JSON.parse(localStorage.getItem('devmatch-dev-notifications-read')||'[]'));
const unreadNotificationCount=['jessica-comment','rizky-message'].filter(id=>!notificationReadIds.has(id)).length;
document.getElementById('developerNotificationCount').textContent=String(unreadNotificationCount);
document.getElementById('developerNotificationCount').hidden=unreadNotificationCount===0;
document.querySelector('.notification-button i').hidden=unreadNotificationCount===0;

const defaultProjects=[
  {title:'Restaurant Website',type:'Website',views:2480,price:'Rp 3.500.000'},
  {title:'Kasir Pintar POS',type:'Web App',views:1920,price:'Rp 6.000.000'},
  {title:'Klinik Booking App',type:'Android / iOS',views:1310,price:'Rp 5.000.000'},
  {title:'Gudang Inventory',type:'Web App',views:980,price:'Rp 4.500.000'}
];
const projectStorageKey='devmatch-dashboard-projects';
const savedProjects=JSON.parse(localStorage.getItem(projectStorageKey)||'[]');
const projects=[...savedProjects,...defaultProjects];
const projectList=document.getElementById('projectList');

function renderProjects(){
  const maxViews=Math.max(...projects.map(project=>Number(project.views)||0),1);
  projectList.innerHTML=projects.slice(0,5).map((project,index)=>`
    <article class="project-row">
      <div class="project-info">
        <span class="project-thumb" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5m8-5v5M7 13h4m-4 3h8"/></svg></span>
        <div><h3 class="project-name">${escapeHtml(project.title)}</h3><p class="project-type">${escapeHtml(project.type)}</p></div>
        <p class="project-views">${Number(project.views||0).toLocaleString('en-US')}<small>views</small></p>
      </div>
      <div class="project-bar"><i style="width:${Math.max(8,Math.round((Number(project.views)||0)/maxViews*100))}%"></i></div>
    </article>`).join('');
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

renderProjects();
document.getElementById('totalProjects').textContent=String(12+savedProjects.length);

const ranges={
  7:{views:'2,860',viewsPath:'M0 177 C55 170 75 135 130 147 S205 107 263 119 S332 70 388 98 S455 127 510 92 S620 38 700 28',favoritesPath:'M0 200 C55 195 76 176 130 184 S204 166 263 173 S332 150 388 160 S455 167 510 148 S620 126 700 112',labels:['Oct 17','Oct 18','Oct 19','Oct 20','Oct 21','Oct 22','Oct 23']},
  30:{views:'12,480',viewsPath:'M0 174 C35 164 44 128 96 143 S157 104 208 111 S278 65 328 94 S390 123 439 96 S505 35 555 58 S628 52 700 23',favoritesPath:'M0 198 C52 194 61 174 112 183 S171 162 221 171 S279 148 332 157 S387 166 442 148 S504 131 555 137 S632 112 700 104',labels:['Sep 7','Sep 12','Sep 17','Sep 22','Sep 27','Oct 2','Oct 6']},
  90:{views:'38,920',viewsPath:'M0 190 C45 180 75 156 120 164 S188 130 235 143 S300 112 350 126 S420 84 470 101 S535 70 585 82 S645 40 700 18',favoritesPath:'M0 207 C55 196 85 187 130 192 S195 171 245 180 S310 159 360 166 S430 140 480 151 S540 126 590 136 S650 111 700 96',labels:['Jul 26','Aug 5','Aug 15','Aug 25','Sep 4','Sep 14','Oct 6']}
};

function updateRange(range){
  const data=ranges[range];
  if(!data)return;
  document.getElementById('chartViews').textContent=data.views;
  document.getElementById('totalViews').textContent=data.views;
  document.getElementById('viewsLine').setAttribute('d',data.viewsPath);
  document.getElementById('viewsArea').setAttribute('d',data.viewsPath+' V212 H0Z');
  document.getElementById('favoritesLine').setAttribute('d',data.favoritesPath);
  document.getElementById('chartLabels').innerHTML=data.labels.map(label=>`<span>${label}</span>`).join('');
  document.querySelector('.comparison').textContent='vs last '+range+' days';
  document.querySelectorAll('[data-chart-range]').forEach(button=>button.classList.toggle('selected',button.dataset.chartRange===String(range)));
  document.getElementById('dateRange').value=String(range);
  document.getElementById('periodValue').textContent=`Last ${range} days`;
  document.querySelectorAll('#periodOptions [data-range]').forEach(option=>option.setAttribute('aria-selected',String(option.dataset.range===String(range))));
}

document.querySelectorAll('[data-chart-range]').forEach(button=>button.addEventListener('click',()=>updateRange(button.dataset.chartRange)));
const periodSelect=document.getElementById('periodSelect');
const periodTrigger=document.getElementById('periodTrigger');
const periodOptions=document.getElementById('periodOptions');
function setPeriodMenuOpen(open){
  periodSelect.classList.toggle('open',open);
  periodTrigger.setAttribute('aria-expanded',String(open));
  periodOptions.hidden=!open;
}
periodTrigger.addEventListener('click',()=>setPeriodMenuOpen(periodOptions.hidden));
periodOptions.addEventListener('click',event=>{
  const option=event.target.closest('[data-range]');
  if(!option)return;
  updateRange(option.dataset.range);
  setPeriodMenuOpen(false);
  periodTrigger.focus();
});
periodTrigger.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'||event.key==='Enter'||event.key===' '){
    event.preventDefault();
    setPeriodMenuOpen(true);
    periodOptions.querySelector('[aria-selected="true"]')?.focus();
  }
});
periodOptions.addEventListener('keydown',event=>{
  const options=[...periodOptions.querySelectorAll('[role="option"]')];
  const index=options.indexOf(document.activeElement);
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();
    options[(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length].focus();
  }else if(event.key==='Enter'||event.key===' '){
    event.preventDefault();
    document.activeElement.click();
  }else if(event.key==='Escape'){
    setPeriodMenuOpen(false);
    periodTrigger.focus();
  }else if(event.key==='Tab'){
    setPeriodMenuOpen(false);
  }
});
document.addEventListener('click',event=>{
  if(!periodSelect.contains(event.target))setPeriodMenuOpen(false);
});

document.querySelectorAll('[data-target]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelector(button.dataset.target)?.scrollIntoView({behavior:'smooth',block:'start'});
}));
document.querySelectorAll('.nav-item[href^="#"]').forEach(link=>link.addEventListener('click',()=>{
  document.querySelectorAll('.nav-item').forEach(item=>item.classList.remove('active'));
  link.classList.add('active');
}));

const search=document.getElementById('searchInput');
search.addEventListener('input',()=>{
  const query=search.value.trim().toLowerCase();
  document.querySelectorAll('.project-row').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(query));
  document.querySelectorAll('.comment').forEach(row=>row.hidden=!!query&&!row.textContent.toLowerCase().includes(query));
});
document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();
    search.focus();
  }
});
