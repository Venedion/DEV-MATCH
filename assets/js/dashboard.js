const profile=JSON.parse(localStorage.getItem('devmatch-profile-dev')||'{}');
const displayName=typeof profile.displayName==='string'&&profile.displayName.trim()
  ? profile.displayName.trim()
  : 'Rizky Aditya';
const nameParts=displayName.trim().split(/\s+/).filter(Boolean);
document.getElementById('welcomeName').textContent=nameParts[0]||'Rizky';
document.getElementById('topUserName').textContent=displayName;
document.getElementById('userAvatar').textContent=nameParts.slice(0,2).map(part=>part[0]).join('').toUpperCase()||'DM';
const notificationReadIds=new Set(JSON.parse(localStorage.getItem('devmatch-dev-notifications-read')||'[]'));
const unreadNotificationCount=['jessica-comment','rizky-message'].filter(id=>!notificationReadIds.has(id)).length;
document.getElementById('developerNotificationCount').textContent=String(unreadNotificationCount);
document.getElementById('developerNotificationCount').hidden=unreadNotificationCount===0;
document.querySelector('.notification-button i').hidden=unreadNotificationCount===0;
window.devMatchBackend.ready.then(user=>user?window.devMatchBackend.loadNotificationReads():null).then(readIds=>{
  if(!readIds)return;
  localStorage.setItem('devmatch-dev-notifications-read',JSON.stringify(readIds));
  const unreadCount=['jessica-comment','rizky-message'].filter(id=>!readIds.includes(id)).length;
  document.getElementById('developerNotificationCount').textContent=String(unreadCount);
  document.getElementById('developerNotificationCount').hidden=unreadCount===0;
  document.querySelector('.notification-button i').hidden=unreadCount===0;
}).catch(error=>{
  console.error('Unable to load notification status from Supabase.',error);
  window.alert('Unable to load notification status. Check your connection and try again.');
});
window.devMatchBackend.ready.then(user=>user?window.devMatchBackend.loadFavorites():null).then(records=>{
  if(!records)return;
  const projectIds=records.filter(item=>item.type==='project').map(item=>item.id);
  const clientIds=records.filter(item=>item.type==='client').map(item=>item.id);
  localStorage.setItem('devmatch-developer-project-favorites',JSON.stringify(projectIds));
  localStorage.setItem('devmatch-favorite-clients',JSON.stringify(clientIds));
  window.DEVMATCH_NAV_BADGES?.updateFavorites();
}).catch(error=>{
  console.error('Unable to load favorites from Supabase.',error);
  window.alert('Unable to load favorites. Check your connection and try again.');
});

try {
  const chatConvs = JSON.parse(localStorage.getItem('devmatch_chat_conversations_v2') || '[]');
  const chatUnread = chatConvs.length ? chatConvs.reduce((sum, c) => sum + (c.unreadCount || 0), 0) : 3;
  const floatingBadge = document.getElementById('floatingChatBadge');
  if (floatingBadge) {
    floatingBadge.textContent = String(chatUnread);
    floatingBadge.hidden = chatUnread === 0;
  }
} catch (e) {}

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

function renderProjects(projectScale=1){
  const visibleProjects=projects
    .map(project=>({...project,rangeViews:Math.max(0,Math.round((Number(project.views)||0)*projectScale))}))
    .sort((first,second)=>second.rangeViews-first.rangeViews);
  const maxViews=Math.max(...visibleProjects.map(project=>project.rangeViews),1);
  projectList.innerHTML=visibleProjects.slice(0,5).map(project=>`
    <article class="project-row">
      <div class="project-info">
        <span class="project-thumb" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5m8-5v5M7 13h4m-4 3h8"/></svg></span>
        <div><h3 class="project-name">${escapeHtml(project.title)}</h3><p class="project-type">${escapeHtml(project.type)}</p></div>
        <p class="project-views">${project.rangeViews.toLocaleString('en-US')}<small>views</small></p>
      </div>
      <div class="project-bar"><i style="width:${Math.max(8,Math.round(project.rangeViews/maxViews*100))}%"></i></div>
    </article>`).join('');
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

renderProjects();

const ranges={
  7:{projects:3,views:2860,favorites:184,comments:37,projectScale:.23,trends:['↗ +1 this week','↗ +8.2%','↗ +6.1%','↗ +4.8%'],viewsPath:'M0 177 C55 170 75 135 130 147 S205 107 263 119 S332 70 388 98 S455 127 510 92 S620 38 700 28',favoritesPath:'M0 200 C55 195 76 176 130 184 S204 166 263 173 S332 150 388 160 S455 167 510 148 S620 126 700 112'},
  30:{projects:12,views:12480,favorites:864,comments:156,projectScale:1,trends:['↗ +2 this month','↗ +12.4%','↗ +8.1%','↗ +5.3%'],viewsPath:'M0 174 C35 164 44 128 96 143 S157 104 208 111 S278 65 328 94 S390 123 439 96 S505 35 555 58 S628 52 700 23',favoritesPath:'M0 198 C52 194 61 174 112 183 S171 162 221 171 S279 148 332 157 S387 166 442 148 S504 131 555 137 S632 112 700 104'},
  90:{projects:36,views:38920,favorites:2679,comments:487,projectScale:3.12,trends:['↗ +6 this quarter','↗ +18.7%','↗ +16.2%','↗ +11.5%'],viewsPath:'M0 190 C45 180 75 156 120 164 S188 130 235 143 S300 112 350 126 S420 84 470 101 S535 70 585 82 S645 40 700 18',favoritesPath:'M0 207 C55 196 85 187 130 192 S195 171 245 180 S310 159 360 166 S430 140 480 151 S540 126 590 136 S650 111 700 96'},
  lifetime:{projects:54,views:152640,favorites:10492,comments:2864,projectScale:12.23,trends:['↗ 54 projects','↗ 152,640 views','↗ 10,492 favorites','↗ 2,864 comments'],viewsPath:'M0 190 C45 180 75 156 120 164 S188 130 235 143 S300 112 350 126 S420 84 470 101 S535 70 585 82 S645 40 700 18',favoritesPath:'M0 207 C55 196 85 187 130 192 S195 171 245 180 S310 159 360 166 S430 140 480 151 S540 126 590 136 S650 111 700 96'}
};

const periodSelect=document.getElementById('periodSelect');
const periodTrigger=document.getElementById('periodTrigger');
const periodOptions=document.getElementById('periodOptions');
const periodIcon=document.querySelector('.period-icon-wrap');
const customRangeForm=document.getElementById('customRangeForm');
const rangeStartInput=document.getElementById('rangeStart');
const rangeEndInput=document.getElementById('rangeEnd');
const rangeError=document.getElementById('rangeError');
const today=new Date();
today.setHours(0,0,0,0);

periodTrigger.prepend(periodIcon);

function toInputDate(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function parseInputDate(value){
  const [year,month,day]=value.split('-').map(Number);
  return new Date(year,month-1,day);
}

function dateLabel(date,includeYear=false){
  return date.toLocaleDateString('en-US',{month:'short',day:'numeric',...(includeYear?{year:'numeric'}:{})});
}

function formatNumber(value){
  return Math.round(value).toLocaleString('en-US');
}

function formatPeriodLabel(start,end){
  const includeYear=start.getFullYear()!==end.getFullYear();
  return `${dateLabel(start,includeYear)} – ${dateLabel(end,true)}`;
}

function updateChart(data,start,end,days){
  document.getElementById('viewsLine').setAttribute('d',data.viewsPath);
  document.getElementById('viewsArea').setAttribute('d',data.viewsPath+' V212 H0Z');
  document.getElementById('favoritesLine').setAttribute('d',data.favoritesPath);
  const tickCount=Math.min(7,days);
  const tickDates=Array.from({length:tickCount},(_,index)=>{
    const date=new Date(start);
    date.setDate(start.getDate()+Math.round(index*(days-1)/Math.max(tickCount-1,1)));
    return date;
  });
  document.getElementById('chartLabels').innerHTML=tickDates.map(date=>`<span>${dateLabel(date,start.getFullYear()!==end.getFullYear())}</span>`).join('');
  const axisMax=Math.max(500,Math.ceil(data.views/8/500)*500);
  document.querySelector('.y-labels').innerHTML=[axisMax,Math.round(axisMax*.75),Math.round(axisMax*.5),Math.round(axisMax*.25),0].map(value=>`<span>${value>=1000?`${Number((value/1000).toFixed(1))}k`:value}</span>`).join('');
  document.getElementById('chartViews').textContent=formatNumber(data.views);
  document.getElementById('totalViews').textContent=formatNumber(data.views);
}

function updateActivity(start,end,isLifetime){
  const startValue=toInputDate(start);
  const endValue=toInputDate(end);
  document.querySelectorAll('.comment-list,.interaction-list').forEach(list=>{
    const items=[...list.querySelectorAll('.comment,.interaction-list > p:not(.range-empty)')];
    let visibleCount=0;
    items.forEach(item=>{
      const eventDateValue=toInputDate(today);
      item.hidden=!isLifetime&&(eventDateValue<startValue||eventDateValue>endValue);
      if(!item.hidden)visibleCount+=1;
    });
    let emptyState=list.querySelector('.range-empty');
    if(!emptyState){
      emptyState=document.createElement('p');
      emptyState.className='range-empty';
      list.append(emptyState);
    }
    emptyState.textContent=list.classList.contains('comment-list')
      ? 'No comments in this date range.'
      : 'No interactions in this date range.';
    emptyState.hidden=visibleCount>0;
  });
}

function updateDashboard(selection){
  const periodText=selection.key==='lifetime'
    ? 'Lifetime'
    : selection.key==='custom'
      ? formatPeriodLabel(selection.start,selection.end)
      : `Last ${selection.days} days`;
  const data=selection.key==='custom'
    ? {
        ...ranges['30'],
        key:'custom',
        projects:Math.max(1,Math.round(ranges['30'].projects*selection.days/30)),
        views:Math.round(ranges['30'].views*selection.days/30),
        favorites:Math.round(ranges['30'].favorites*selection.days/30),
        comments:Math.round(ranges['30'].comments*selection.days/30),
        projectScale:selection.days/30,
        trends:[
          `↗ +${Math.round(2*selection.days/30)} project${Math.round(2*selection.days/30)===1?'':'s'}`,
          ...ranges['30'].trends.slice(1)
        ]
      }
    : {...ranges[selection.key],key:selection.key};
  const comparisonText=selection.key==='lifetime'
    ? 'all time'
    : selection.key==='custom'
      ? `vs ${periodText}`
      : `vs previous ${selection.days} days`;

  document.getElementById('periodValue').textContent=periodText;
  document.getElementById('dateRange').value=selection.key;
  document.getElementById('rangeDescription').textContent=selection.key==='lifetime'
    ? 'Here’s how your projects have performed over their lifetime.'
    : selection.key==='custom'
      ? `Here’s how your projects performed from ${periodText}.`
      : `Here’s how your projects performed over the last ${selection.days} days.`;
  const statValues=document.querySelectorAll('.stats .stat-card > strong');
  statValues[0].textContent=formatNumber(data.projects+savedProjects.length);
  statValues[1].textContent=formatNumber(data.views);
  statValues[2].textContent=formatNumber(data.favorites);
  statValues[3].textContent=formatNumber(data.comments);
  document.querySelectorAll('.stat-card .comparison').forEach(element=>element.textContent=comparisonText);
  document.querySelectorAll('.stats .stat-card .trend').forEach((element,index)=>element.textContent=data.trends[index]);
  document.querySelector('.chart-summary .trend').textContent=data.trends[1];
  renderProjects(data.projectScale);
  updateChart(data,selection.start,selection.end,selection.days);
  updateActivity(selection.start,selection.end,selection.key==='lifetime');
  document.querySelectorAll('[data-chart-range]').forEach(button=>{
    button.classList.toggle('selected',selection.key===button.dataset.chartRange);
  });
  document.querySelectorAll('.period-presets [data-range]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.range===selection.key));
  });
}

function applyPreset(range){
  const end=new Date(today);
  const start=new Date(today);
  let days;
  if(range==='lifetime'){
    start.setFullYear(2000,0,1);
    days=Math.floor((end-start)/86400000)+1;
  }else{
    days=Number(range);
    start.setDate(start.getDate()-days+1);
  }
  updateDashboard({key:range,days,start,end});
  rangeError.hidden=true;
}

function setPeriodMenuOpen(open){
  periodSelect.classList.toggle('open',open);
  periodTrigger.setAttribute('aria-expanded',String(open));
  periodOptions.hidden=!open;
}

rangeEndInput.max=toInputDate(today);
rangeStartInput.value=toInputDate(new Date(today.getFullYear(),today.getMonth(),today.getDate()-29));
rangeEndInput.value=toInputDate(today);
rangeStartInput.max=rangeEndInput.value;
rangeEndInput.min=rangeStartInput.value;
rangeStartInput.addEventListener('change',()=>{rangeEndInput.min=rangeStartInput.value;});
rangeEndInput.addEventListener('change',()=>{rangeStartInput.max=rangeEndInput.value;});
document.querySelectorAll('[data-chart-range]').forEach(button=>button.addEventListener('click',()=>{
  applyPreset(button.dataset.chartRange);
}));
document.querySelectorAll('.period-presets [data-range]').forEach(button=>button.addEventListener('click',()=>{
  applyPreset(button.dataset.range);
  setPeriodMenuOpen(false);
  periodTrigger.focus();
}));
customRangeForm.addEventListener('submit',event=>{
  event.preventDefault();
  const start=parseInputDate(rangeStartInput.value);
  const end=parseInputDate(rangeEndInput.value);
  if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||start>end||end>today){
    rangeError.textContent='Choose a valid date range that ends today or earlier.';
    rangeError.hidden=false;
    return;
  }
  const days=Math.floor((end-start)/86400000)+1;
  rangeError.hidden=true;
  updateDashboard({key:'custom',days,start,end});
  setPeriodMenuOpen(false);
  periodTrigger.focus();
});
periodTrigger.addEventListener('click',()=>setPeriodMenuOpen(periodOptions.hidden));
periodTrigger.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'||event.key==='Enter'||event.key===' '){
    event.preventDefault();
    setPeriodMenuOpen(true);
    periodOptions.querySelector('[aria-pressed="true"]')?.focus();
  }
});
periodOptions.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    setPeriodMenuOpen(false);
    periodTrigger.focus();
  }
});
document.addEventListener('click',event=>{
  if(!periodSelect.contains(event.target))setPeriodMenuOpen(false);
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!periodOptions.hidden){
    setPeriodMenuOpen(false);
    periodTrigger.focus();
  }
});
applyPreset('30');

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
