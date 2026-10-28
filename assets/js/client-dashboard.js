const clientProfile=JSON.parse(localStorage.getItem('devmatch-profile-client')||'{}');
const clientName=clientProfile.displayName||'Client';
const clientNameParts=clientName.trim().split(/\s+/).filter(Boolean);
document.getElementById('topUserName').textContent=clientName;
document.getElementById('userAvatar').textContent=clientNameParts.slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CL';
const notificationReadIds=new Set(JSON.parse(localStorage.getItem('devmatch-client-notifications-read')||'[]'));
const unreadNotificationCount=['jessica-comment','rizky-message'].filter(id=>!notificationReadIds.has(id)).length;
document.querySelectorAll('.client-notification-count').forEach(count=>{
  count.textContent=String(unreadNotificationCount);
  count.hidden=unreadNotificationCount===0;
});
const notificationDot=document.querySelector('.client-icon-button i');
if(notificationDot)notificationDot.hidden=unreadNotificationCount===0;
const hour=new Date().getHours();
document.getElementById('greeting').textContent=(hour<12?'Good morning, ':hour<18?'Good afternoon, ':'Good evening, ')+clientNameParts[0];

const sampleProjects=window.DEVMATCH_SAMPLE_PROJECTS;
const favoritesKey='devmatch-client-favorites';
const requestsKey='devmatch-client-requests';
let favorites=JSON.parse(localStorage.getItem(favoritesKey)||'[]');
let requests=JSON.parse(localStorage.getItem(requestsKey)||'[]');
let activeCategory='All';
let activeType='All';
let activePrice='All';
let activeSpecialty='All';
let activeSort='newest';
let activeQuery='';
let favoritesOnly=false;
let activeRequestFilter='all';
let activeRequestQuery='';
let activeRequestSort='newest';
let activeRequestDetailId=null;
const grid=document.getElementById('projectGrid');
const discoverGrid=document.getElementById('discoverGrid');

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

function getFilteredProjects(){
  const filtered=sampleProjects.filter(project=>{
    const categoryMatches=activeCategory==='All'||project.category===activeCategory||project.type===activeCategory;
    const typeMatches=activeType==='All'||project.type===activeType;
    const price=Number(String(project.price).replace(/\D/g,''))||0;
    const priceMatches=activePrice==='All'||activePrice==='under-5'&&price<5000000||activePrice==='5-to-8'&&price>=5000000&&price<=8000000||activePrice==='over-8'&&price>8000000;
    const specialtyMatches=activeSpecialty==='All'||project.specialty===activeSpecialty;
    const queryMatches=!activeQuery||[project.title,project.type,project.category,project.description,project.developer,project.specialty].join(' ').toLowerCase().includes(activeQuery);
    return categoryMatches&&typeMatches&&priceMatches&&specialtyMatches&&queryMatches&&(!favoritesOnly||favorites.includes(project.id));
  });
  if(activeSort==='oldest')filtered.reverse();
  if(activeSort==='price-low'||activeSort==='price-high'){
    filtered.sort((first,second)=>{
      const firstPrice=Number(String(first.price).replace(/\D/g,''))||0;
      const secondPrice=Number(String(second.price).replace(/\D/g,''))||0;
      return activeSort==='price-low'?firstPrice-secondPrice:secondPrice-firstPrice;
    });
  }
  return filtered;
}

function projectCardMarkup(project,discover=false){
  const favorite=favorites.includes(project.id);
  return `
    <article class="client-project-card" data-project="${escapeHtml(project.id)}" tabindex="0" role="link" aria-label="View ${escapeHtml(project.title)} details">
      <div class="project-art ${project.art}">
        <span class="art-label">${escapeHtml(project.type)}</span>
        <button class="favorite-button" type="button" data-favorite="${escapeHtml(project.id)}" aria-pressed="${favorite}" aria-label="${favorite?'Remove from':'Add to'} favorites">
          <svg viewBox="0 0 24 24"><path d="m20.8 4.6-1.4-1.4a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>
        </button>
        ${artMarkup(project)}
      </div>
      <div class="project-body">
        <div class="project-meta"><b>${escapeHtml(project.category)}</b><span>${escapeHtml(project.age)}</span></div>
        <h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.description)}</p>
        ${discover?`<div class="discover-card-price"><span>STARTING FROM</span><strong>${escapeHtml(project.price)}</strong><span class="discover-card-arrow" aria-hidden="true">→</span></div>`:`<div class="project-price">${escapeHtml(project.price)}</div>`}
        <div class="project-by"><span class="developer-avatar">${escapeHtml(project.initials)}</span>${escapeHtml(project.developer)}<span class="developer-location">${escapeHtml(project.location)}</span></div>
        <button class="project-card-view" type="button" data-project-open="${escapeHtml(project.id)}">View details <span aria-hidden="true">→</span></button>
      </div>
    </article>`;
}

function renderProjects(){
  const filtered=getFilteredProjects();
  grid.innerHTML=filtered.map(project=>projectCardMarkup(project)).join('');
  discoverGrid.innerHTML=filtered.map(project=>projectCardMarkup(project,true)).join('');
  document.getElementById('emptyState').hidden=filtered.length>0;
  document.getElementById('discoverEmptyState').hidden=filtered.length>0;
  document.getElementById('discoverProjectCount').textContent=String(sampleProjects.length);
  document.getElementById('discoverResultsCount').textContent=`${filtered.length} project${filtered.length===1?'':'s'}`;
  document.querySelectorAll('[data-category-count]').forEach(count=>{
    const category=count.dataset.categoryCount;
    const total=category==='All'?sampleProjects.length:sampleProjects.filter(project=>project.category===category).length;
    count.textContent=`${total} project${total===1?'':'s'}`;
  });
  document.getElementById('resultsLabel').textContent=activeQuery||activeCategory!=='All'
    ?`${filtered.length} project${filtered.length===1?'':'s'} found.`
    :'Explore ready-to-build ideas from independent developers.';
  document.getElementById('discoverResultsNote').textContent=activeSort==='newest'?'· showing newest first':activeSort==='oldest'?'· showing oldest first':activeSort==='price-low'?'· lowest price first':'· highest price first';
  document.getElementById('favoriteCount').textContent=String(favorites.length);
}

function renderRequests(){
  const container=document.getElementById('requestList');
  const counts=requests.reduce((total,request)=>{
    const status=request.status==='open'||request.status==='closed'?request.status:'draft';
    total[status]++;
    return total;
  },{open:0,closed:0,draft:0});
  document.getElementById('requestStatOpen').textContent=String(counts.open);
  document.getElementById('requestStatClosed').textContent=String(counts.closed);
  document.getElementById('requestStatDraft').textContent=String(counts.draft);
  document.getElementById('requestStatViews').textContent=String(requests.reduce((sum,request)=>sum+(Number(request.views)||0),0).toLocaleString('id-ID'));
  document.getElementById('requestStatSaves').textContent=String(requests.reduce((sum,request)=>sum+(Number(request.saves??request.favorites)||0),0).toLocaleString('id-ID'));
  document.getElementById('requestStatComments').textContent=String(requests.reduce((sum,request)=>sum+(Number(request.commentCount??request.comments)||0),0).toLocaleString('id-ID'));
  document.getElementById('requestCountAll').textContent=String(requests.length);
  document.getElementById('requestCountOpen').textContent=String(counts.open);
  document.getElementById('requestCountClosed').textContent=String(counts.closed);
  document.getElementById('requestCountDraft').textContent=String(counts.draft);
  const filtered=requests.filter(request=>{
    const status=request.status==='open'||request.status==='closed'?request.status:'draft';
    const queryMatches=!activeRequestQuery||[request.title,request.category,request.categoryOther,request.projectType,request.description,request.specialtyOther,...(request.specialties||[])].join(' ').toLowerCase().includes(activeRequestQuery);
    return (activeRequestFilter==='all'||status===activeRequestFilter)&&queryMatches;
  }).sort((first,second)=>{
    const firstUpdated=Number(first.updated)||0;
    const secondUpdated=Number(second.updated)||0;
    return activeRequestSort==='oldest'?firstUpdated-secondUpdated:secondUpdated-firstUpdated;
  });
  const activity=requests.flatMap(request=>(request.activity||[]).map(entry=>({...entry,requestTitle:request.title||'Project request'})))
    .sort((first,second)=>(Number(second.created)||0)-(Number(first.created)||0)).slice(0,4);
  const activityList=document.getElementById('requestActivityList');
  activityList.replaceChildren();
  if(activity.length){
    activity.forEach(entry=>{
      const item=document.createElement('article');
      item.className='request-activity-item';
      const avatar=document.createElement('span');
      avatar.className='request-activity-avatar';
      avatar.textContent=String(entry.initials||entry.name||'').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'•';
      const copy=document.createElement('p');
      const name=document.createElement('b');
      name.textContent=entry.name||'A developer';
      copy.append(name,document.createTextNode(` ${entry.action||'interacted with'} `));
      const title=document.createElement('strong');
      title.textContent=entry.requestTitle;
      copy.append(title);
      const time=document.createElement('small');
      time.textContent=entry.time||'Recently';
      item.append(avatar,copy,time);
      activityList.append(item);
    });
  }else{
    const empty=document.createElement('p');
    empty.className='request-activity-empty';
    empty.textContent='Developer views, saves, and comments will appear here once your requests get noticed.';
    activityList.append(empty);
  }
  if(!filtered.length){
    container.replaceChildren();
    const empty=document.getElementById('requestsEmpty');
    empty.textContent=requests.length
      ?'No requests match these filters. Try another search or status.'
      :'No requests yet. Post a request to let developers know what you need.';
    empty.hidden=false;
    return;
  }
  document.getElementById('requestsEmpty').hidden=true;
  container.innerHTML=filtered.map((request,index)=>{
    if(!request.id)request.id=`request-${index}`;
    const budget=request.budgetFrom&&request.budgetTo
      ?`${formatRequestMoney(request.budgetFrom)} — ${formatRequestMoney(request.budgetTo)}`
      :request.budget||'Budget not set';
    const status=request.status==='open'||request.status==='closed'?request.status:'draft';
    const category=request.category==='Other'&&request.categoryOther?`Other · ${request.categoryOther}`:request.category||'Category not selected';
    const type=request.projectType==='Other'&&request.projectTypeOther?`Other · ${request.projectTypeOther}`:request.projectType||'Project type not set';
    const specialties=(request.specialties||[]).map(specialty=>specialty==='Other'&&request.specialtyOther?`Other · ${request.specialtyOther}`:specialty);
    const deadline=parseIsoDate(request.deadline);
    const daysLeft=deadline?Math.ceil((new Date(deadline.getFullYear(),deadline.getMonth(),deadline.getDate())-new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()))/86400000):null;
    const deadlineNote=daysLeft===null?'Choose a deadline':daysLeft<0?`${Math.abs(daysLeft)} days overdue`:daysLeft===0?'Due today':`${daysLeft} days left`;
    const referenceCount=(request.references||[]).length+(request.attachments||[]).length;
    const views=Number(request.views)||0;
    const saves=Number(request.saves??request.favorites)||0;
    const comments=Number(request.commentCount??request.comments)||0;
    const moreAction=status==='open'?'close':status==='closed'?'reopen':'publish';
    const moreLabel=status==='open'?'Close request':status==='closed'?'Reopen request':'Publish request';
    return `<article class="request-item request-card" data-request-card="${escapeHtml(request.id)}">
      <div class="request-card-topline"><div class="request-card-badges"><span class="request-status ${status}">${status}</span><span class="request-card-tag">${escapeHtml(category)}</span><span class="request-card-tag">${escapeHtml(type)}</span>${request.negotiable?'<span class="request-card-tag">Negotiable</span>':''}</div>
      <div class="request-card-menu"><details><summary aria-label="More actions for request">•••</summary><div><button type="button" data-request-action="${moreAction}" data-request-id="${escapeHtml(request.id)}">${moreLabel}</button><button class="danger" type="button" data-request-action="delete" data-request-id="${escapeHtml(request.id)}">Delete request</button></div></details></div></div>
      <h2>${escapeHtml(request.title||'Untitled request')}</h2>
      <div class="request-card-facts"><div><small>BUDGET</small><b>${escapeHtml(budget)}</b></div><div><small>DEADLINE</small><b>${deadline?escapeHtml(formatDeadline(request.deadline)):'Not set'}${daysLeft===null?'':` · ${escapeHtml(deadlineNote)}`}</b></div><div><small>REQUIRED</small><span>${specialties.length?specialties.map(specialty=>`<i>${escapeHtml(specialty)}</i>`).join(''):'Not specified'}</span></div></div>
      <footer class="request-card-footer"><span class="request-card-metrics"><span>◉ ${views}</span><span>♡ ${saves}</span><span>▢ ${comments}</span>${referenceCount?`<span class="request-card-new">${referenceCount} ref</span>`:''}</span><div class="request-card-actions"><button type="button" class="request-card-secondary" data-request-detail="${escapeHtml(request.id)}">More</button><button type="button" class="request-card-secondary" data-edit-request="${escapeHtml(request.id)}">Edit</button><button type="button" class="request-card-primary" data-request-action="view" data-request-id="${escapeHtml(request.id)}">View request <span aria-hidden="true">→</span></button></div></footer>
    </article>`;
  }).join('');
}

function handleProjectGridClick(event){
  const openButton=event.target.closest('[data-project-open]');
  if(openButton){
    window.openProjectDetails(openButton.dataset.projectOpen);
    return;
  }
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
}
function handleProjectGridKeydown(event){
  const card=event.target.closest('[data-project]');
  if(card&&(event.key==='Enter'||event.key===' ')&&event.target===card){
    event.preventDefault();
    window.openProjectDetails(card.dataset.project);
  }
}
[grid,discoverGrid].forEach(projectGrid=>{
  projectGrid.addEventListener('click',handleProjectGridClick);
  projectGrid.addEventListener('keydown',handleProjectGridKeydown);
});
document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{
  favoritesOnly=false;
  activeQuery='';
  activeCategory=button.dataset.category;
  activeType='All';
  activePrice='All';
  activeSpecialty='All';
  document.querySelectorAll('[data-category]').forEach(item=>item.classList.toggle('selected',item===button));
  document.getElementById('searchInput').value='';
  document.getElementById('heroSearchInput').value='';
  document.getElementById('discoverSearchInput').value='';
  document.getElementById('discoverCategory').value=activeCategory;
  document.getElementById('discoverType').value='All';
  document.getElementById('discoverPrice').value='All';
  document.getElementById('discoverSpecialty').value='All';
  renderProjects();
}));
document.querySelectorAll('[data-query]').forEach(button=>button.addEventListener('click',()=>{
  searchProjects(button.dataset.query);
  document.getElementById('projects').scrollIntoView({behavior:'smooth'});
}));
function searchProjects(value,preserveFilters=false){
  activeQuery=value.trim().toLowerCase();
  favoritesOnly=false;
  if(!preserveFilters){
    activeCategory='All';
    activeType='All';
    activePrice='All';
    activeSpecialty='All';
    activeSort='newest';
    document.getElementById('discoverCategory').value='All';
    document.getElementById('discoverType').value='All';
    document.getElementById('discoverPrice').value='All';
    document.getElementById('discoverSpecialty').value='All';
    document.getElementById('discoverSort').value='newest';
    document.querySelectorAll('[data-category]').forEach(button=>button.classList.toggle('selected',button.dataset.category==='All'));
  }
  document.getElementById('searchInput').value=value;
  document.getElementById('heroSearchInput').value=value;
  document.getElementById('discoverSearchInput').value=value;
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
document.getElementById('discoverSearchForm').addEventListener('submit',event=>{
  event.preventDefault();
  searchProjects(document.getElementById('discoverSearchInput').value,true);
});
document.getElementById('discoverSearchInput').addEventListener('input',event=>{
  searchProjects(event.target.value,true);
});
document.getElementById('discoverCategory').addEventListener('change',event=>{
  activeCategory=event.target.value;
  favoritesOnly=false;
  document.querySelectorAll('[data-category]').forEach(button=>button.classList.toggle('selected',button.dataset.category===activeCategory));
  renderProjects();
});
document.getElementById('discoverType').addEventListener('change',event=>{activeType=event.target.value;renderProjects()});
document.getElementById('discoverPrice').addEventListener('change',event=>{activePrice=event.target.value;renderProjects()});
document.getElementById('discoverSpecialty').addEventListener('change',event=>{activeSpecialty=event.target.value;renderProjects()});
document.getElementById('discoverSort').addEventListener('change',event=>{activeSort=event.target.value;renderProjects()});
function showClientView(view){
  const discovering=view==='discover';
  const composingRequest=view==='request';
  const viewingRequests=view==='requests';
  const viewingDetail=view==='request-detail';
  const viewingHome=!discovering&&!composingRequest&&!viewingRequests&&!viewingDetail;
  document.body.classList.toggle('request-composer-open',composingRequest);
  ['.client-hero','.category-list','.client-projects','.client-demo-note'].forEach(selector=>{
    document.querySelector(selector).hidden=!viewingHome;
  });
  document.getElementById('discover').hidden=!discovering;
  document.getElementById('requests').hidden=!viewingRequests;
  document.getElementById('requestDetailPage').hidden=!viewingDetail;
  document.getElementById('requestComposer').hidden=!composingRequest;
  document.querySelectorAll('.client-nav-item').forEach(item=>item.classList.toggle('active',discovering
    ?item.hasAttribute('data-discover-nav')
    :composingRequest
      ?item.hasAttribute('data-request-nav')
      :viewingRequests||viewingDetail
        ?item.hasAttribute('data-request-nav')
        :item.getAttribute('href')==='#home'));
  if(discovering)document.querySelector('[data-discover-nav]').focus({preventScroll:true});
}
document.querySelectorAll('[data-discover-nav]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();
  history.replaceState(null,'','#discover');
  showClientView('discover');
}));
document.querySelector('.client-nav-item[href="#home"]').addEventListener('click',event=>{
  event.preventDefault();
  history.replaceState(null,'','#home');
  showClientView('home');
});
document.querySelectorAll('.client-nav-item[data-request-nav]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();
  history.replaceState(null,'','#requests');
  showClientView('requests');
}));
document.querySelectorAll('.client-nav-item[data-favorites-filter]').forEach(link=>link.addEventListener('click',()=>{
  showClientView('home');
  document.querySelectorAll('.client-nav-item').forEach(item=>item.classList.toggle('active',item===link));
  if(link.hasAttribute('data-favorites-filter')){
    activeQuery='';
    activeCategory='All';
    activeType='All';
    activePrice='All';
    activeSpecialty='All';
    favoritesOnly=true;
    document.getElementById('discoverCategory').value='All';
    document.getElementById('discoverType').value='All';
    document.getElementById('discoverPrice').value='All';
    document.getElementById('discoverSpecialty').value='All';
    document.getElementById('searchInput').value='';
    document.getElementById('heroSearchInput').value='';
    document.getElementById('discoverSearchInput').value='';
    document.getElementById('discoverSort').value='newest';
    activeSort='newest';
    document.querySelectorAll('[data-category]').forEach(categoryButton=>categoryButton.classList.toggle('selected',categoryButton.dataset.category==='All'));
    renderProjects();
  }
}));
document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();
    document.getElementById('searchInput').focus();
  }
});

const requestForm=document.getElementById('requestComposerForm');
let editingRequestId=null;
const deadlinePicker=document.querySelector('[data-request-date-picker]');
const deadlineInput=deadlinePicker.querySelector('[name="deadline"]');
const deadlineTrigger=deadlinePicker.querySelector('.request-date-trigger');
const deadlinePanel=deadlinePicker.querySelector('.request-date-panel');
const deadlineGrid=deadlinePicker.querySelector('.request-date-days');
const monthPicker=document.querySelector('[data-month-picker]');
const monthInput=monthPicker.querySelector('[name="targetStart"]');
const monthTrigger=monthPicker.querySelector('.request-month-trigger');
const monthPanel=monthPicker.querySelector('.request-month-panel');
const monthGrid=monthPicker.querySelector('.request-month-grid');
let monthPickerYear=new Date().getFullYear();
let deadlinePickerYear=new Date().getFullYear();
let deadlinePickerMonth=new Date().getMonth();
let pendingReferenceFiles=[];
let retainedAttachments=[];
let removedAttachmentIds=new Set();
let requestAttachmentDatabasePromise=null;
const monthNames=Array.from({length:12},(_,index)=>new Intl.DateTimeFormat('en',{month:'long'}).format(new Date(2026,index,1)));
const shortMonthNames=Array.from({length:12},(_,index)=>new Intl.DateTimeFormat('en',{month:'short'}).format(new Date(2026,index,1)));
function isoDate(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function parseIsoDate(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if(!match)return null;
  const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]));
  return date.getFullYear()===Number(match[1])&&date.getMonth()===Number(match[2])-1&&date.getDate()===Number(match[3])?date:null;
}
function formatDeadline(value){
  const date=parseIsoDate(value);
  return date?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(date):value;
}
function formatMonth(value){
  const match=/^(\d{4})-(\d{2})$/.exec(value);
  return match?`${shortMonthNames[Number(match[2])-1]} ${match[1]}`:value;
}
function syncRequestPickers(){
  deadlineTrigger.querySelector('[data-date-label]').textContent=deadlineInput.value?formatDeadline(deadlineInput.value):'Choose a date';
  deadlineGrid.querySelectorAll('button[data-date]').forEach(button=>{
    button.classList.toggle('is-selected',button.dataset.date===deadlineInput.value);
  });
  const selectedMonth=monthInput.value;
  const monthMatch=/^(\d{4})-(\d{2})$/.exec(selectedMonth);
  monthTrigger.querySelector('[data-month-label]').textContent=monthMatch?`${shortMonthNames[Number(monthMatch[2])-1]} ${monthMatch[1]}`:'Choose…';
  const selectedMonthIndex=monthMatch?Number(monthMatch[2])-1:-1;
  monthGrid.querySelectorAll('button').forEach((button,index)=>{
    button.classList.toggle('is-selected',monthPickerYear===Number(monthMatch?.[1])&&index===selectedMonthIndex);
  });
}
function renderMonthPicker(){
  monthPanel.querySelector('[data-month-year]').textContent=String(monthPickerYear);
  monthGrid.replaceChildren(...monthNames.map((name,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.textContent=name;
    button.setAttribute('aria-label',`${name} ${monthPickerYear}`);
    button.classList.toggle('is-current',monthPickerYear===new Date().getFullYear()&&index===new Date().getMonth());
    button.addEventListener('click',()=>{
      monthInput.value=`${monthPickerYear}-${String(index+1).padStart(2,'0')}`;
      syncRequestPickers();
      closeMonthPicker();
      monthTrigger.focus();
      monthInput.dispatchEvent(new Event('change',{bubbles:true}));
    });
    return button;
  }));
  syncRequestPickers();
}
function renderDeadlineCalendar(){
  const firstDay=new Date(deadlinePickerYear,deadlinePickerMonth,1);
  const offset=(firstDay.getDay()+6)%7;
  const daysInMonth=new Date(deadlinePickerYear,deadlinePickerMonth+1,0).getDate();
  const daysInPreviousMonth=new Date(deadlinePickerYear,deadlinePickerMonth,0).getDate();
  deadlinePanel.querySelector('[data-date-month]').textContent=`${monthNames[deadlinePickerMonth]} ${deadlinePickerYear}`;
  const today=isoDate(new Date());
  const days=Array.from({length:Math.ceil((offset+daysInMonth)/7)*7},(_,index)=>{
    const day=index-offset+1;
    let year=deadlinePickerYear;
    let month=deadlinePickerMonth;
    let date=day;
    let outside=false;
    if(day<1){outside=true;date=daysInPreviousMonth+day;month--;if(month<0){month=11;year--}}
    else if(day>daysInMonth){outside=true;date=day-daysInMonth;month++;if(month>11){month=0;year++}}
    const value=`${year}-${String(month+1).padStart(2,'0')}-${String(date).padStart(2,'0')}`;
    const button=document.createElement('button');
    button.type='button';
    button.textContent=String(date);
    button.dataset.date=value;
    button.setAttribute('aria-label',formatDeadline(value));
    button.classList.toggle('is-outside',outside);
    button.classList.toggle('is-today',value===today);
    button.classList.toggle('is-selected',value===deadlineInput.value);
    button.disabled=value<today;
    return button;
  });
  deadlineGrid.replaceChildren(...days);
}
function openDeadlinePicker(){
  const selected=parseIsoDate(deadlineInput.value)||new Date();
  deadlinePickerYear=selected.getFullYear();
  deadlinePickerMonth=selected.getMonth();
  renderDeadlineCalendar();
  deadlinePanel.hidden=false;
  const anchor=deadlineTrigger.getBoundingClientRect();
  const panel=deadlinePanel.getBoundingClientRect();
  const left=Math.max(8,Math.min(anchor.left,window.innerWidth-panel.width-8));
  const top=window.innerHeight-anchor.bottom>=panel.height+8
    ?anchor.bottom+7
    :Math.max(8,anchor.top-panel.height-7);
  deadlinePanel.style.left=`${left}px`;
  deadlinePanel.style.top=`${top}px`;
  deadlineTrigger.setAttribute('aria-expanded','true');
  const selectedButton=deadlineGrid.querySelector('.is-selected:not(:disabled)');
  (selectedButton||deadlineGrid.querySelector('button:not(:disabled)'))?.focus();
}
function closeDeadlinePicker(returnFocus=false){
  deadlinePanel.hidden=true;
  deadlinePanel.style.removeProperty('left');
  deadlinePanel.style.removeProperty('top');
  deadlineTrigger.setAttribute('aria-expanded','false');
  if(returnFocus)deadlineTrigger.focus();
}
function openMonthPicker(){
  const match=/^(\d{4})-\d{2}$/.exec(monthInput.value);
  monthPickerYear=match?Number(match[1]):new Date().getFullYear();
  renderMonthPicker();
  monthPanel.classList.toggle('opens-above',window.innerHeight-monthTrigger.getBoundingClientRect().bottom<280);
  monthPanel.hidden=false;
  monthTrigger.setAttribute('aria-expanded','true');
  const selected=monthGrid.querySelector('.is-selected');
  (selected||monthGrid.querySelector('button')).focus();
}
function closeMonthPicker(returnFocus=false){
  monthPanel.hidden=true;
  monthPanel.classList.remove('opens-above');
  monthTrigger.setAttribute('aria-expanded','false');
  if(returnFocus)monthTrigger.focus();
}
deadlineTrigger.addEventListener('click',()=>{
  if(deadlinePanel.hidden)openDeadlinePicker();
  else closeDeadlinePicker();
});
deadlineTrigger.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'){event.preventDefault();openDeadlinePicker()}
});
deadlineGrid.addEventListener('click',event=>{
  const day=event.target.closest('button[data-date]');
  if(!day||day.disabled)return;
  deadlineInput.value=day.dataset.date;
  syncRequestPickers();
  closeDeadlinePicker(true);
  deadlineInput.dispatchEvent(new Event('change',{bubbles:true}));
});
deadlinePanel.querySelectorAll('[data-date-nav]').forEach(button=>button.addEventListener('click',()=>{
  deadlinePickerMonth+=Number(button.dataset.dateNav);
  if(deadlinePickerMonth<0){deadlinePickerMonth=11;deadlinePickerYear--}
  if(deadlinePickerMonth>11){deadlinePickerMonth=0;deadlinePickerYear++}
  renderDeadlineCalendar();
  deadlineGrid.querySelector('button:not(:disabled)')?.focus();
}));
deadlinePanel.querySelector('[data-date-clear]').addEventListener('click',()=>{
  deadlineInput.value='';
  syncRequestPickers();
  closeDeadlinePicker(true);
  deadlineInput.dispatchEvent(new Event('change',{bubbles:true}));
});
deadlinePanel.querySelector('[data-date-today]').addEventListener('click',()=>{
  deadlineInput.value=isoDate(new Date());
  syncRequestPickers();
  closeDeadlinePicker(true);
  deadlineInput.dispatchEvent(new Event('change',{bubbles:true}));
});
deadlinePanel.addEventListener('keydown',event=>{
  const days=[...deadlineGrid.querySelectorAll('button:not(:disabled)')];
  const current=days.indexOf(document.activeElement);
  if(event.key==='Escape'){event.preventDefault();closeDeadlinePicker(true)}
  else if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(event.key)){
    event.preventDefault();
    const step=event.key==='ArrowDown'?7:event.key==='ArrowUp'?-7:event.key==='ArrowRight'?1:-1;
    days[(current+step+days.length)%days.length]?.focus();
  }else if(event.key==='Home'){event.preventDefault();days[0]?.focus()}
  else if(event.key==='End'){event.preventDefault();days[days.length-1]?.focus()}
});
monthTrigger.addEventListener('click',()=>{
  if(monthPanel.hidden)openMonthPicker();
  else closeMonthPicker();
});
monthTrigger.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'){
    event.preventDefault();
    if(monthPanel.hidden)openMonthPicker();
  }
});
monthPanel.querySelectorAll('[data-year-step]').forEach(button=>button.addEventListener('click',()=>{
  monthPickerYear+=Number(button.dataset.yearStep);
  renderMonthPicker();
  monthGrid.querySelector('button').focus();
}));
monthPanel.querySelector('[data-month-clear]').addEventListener('click',()=>{
  monthInput.value='';
  syncRequestPickers();
  closeMonthPicker(true);
  monthInput.dispatchEvent(new Event('change',{bubbles:true}));
});
monthPanel.querySelector('[data-month-current]').addEventListener('click',()=>{
  const today=new Date();
  monthPickerYear=today.getFullYear();
  monthInput.value=`${monthPickerYear}-${String(today.getMonth()+1).padStart(2,'0')}`;
  syncRequestPickers();
  closeMonthPicker(true);
  monthInput.dispatchEvent(new Event('change',{bubbles:true}));
});
monthPanel.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeMonthPicker(true)}
});
document.addEventListener('click',event=>{
  if(!deadlinePicker.contains(event.target))closeDeadlinePicker();
  if(!monthPicker.contains(event.target))closeMonthPicker();
});
requestForm.addEventListener('reset',()=>window.setTimeout(()=>{
  syncRequestPickers();
  syncConditionalFields();
  renderReferenceAttachments();
  updateRequestPreview();
},0));
const categoryOtherField=document.querySelector('[data-category-other]');
const specialtyOtherField=document.querySelector('[data-specialty-other]');
function syncConditionalFields(){
  const categoryOther=requestForm.querySelector('[name="category"]:checked')?.value==='Other';
  const specialtyOther=[...requestForm.querySelectorAll('[name="specialties"]:checked')].some(input=>input.value==='Other');
  categoryOtherField.hidden=!categoryOther;
  specialtyOtherField.hidden=!specialtyOther;
  if(!categoryOther)requestForm.elements.categoryOther.value='';
  if(!specialtyOther)requestForm.elements.specialtyOther.value='';
}
function renderReferenceAttachments(){
  const list=document.getElementById('requestAttachmentList');
  const attachments=[...retainedAttachments.filter(item=>!removedAttachmentIds.has(item.id)).map(item=>({name:item.name,id:item.id,source:'saved'})),...pendingReferenceFiles.map((file,index)=>({name:file.name,index,source:'pending'}))];
  list.hidden=attachments.length===0;
  list.replaceChildren(...attachments.map(attachment=>{
    const item=document.createElement('li');
    const name=document.createElement('span');
    name.textContent=attachment.name;
    const remove=document.createElement('button');
    remove.type='button';
    remove.dataset.removeAttachment=attachment.source==='saved'?attachment.id:String(attachment.index);
    remove.dataset.attachmentSource=attachment.source;
    remove.setAttribute('aria-label',`Remove ${attachment.name}`);
    remove.textContent='×';
    item.append(name,remove);
    return item;
  }));
}
function openRequestAttachmentDatabase(){
  if(!('indexedDB' in window))return Promise.reject(new Error('This browser does not support local file storage.'));
  if(!requestAttachmentDatabasePromise){
    requestAttachmentDatabasePromise=new Promise((resolve,reject)=>{
      const opening=indexedDB.open('devmatch-client-request-files',1);
      opening.onupgradeneeded=()=>{
        if(!opening.result.objectStoreNames.contains('attachments'))opening.result.createObjectStore('attachments',{keyPath:'id'});
      };
      opening.onsuccess=()=>resolve(opening.result);
      opening.onerror=()=>reject(opening.error||new Error('Could not open local file storage.'));
    });
  }
  return requestAttachmentDatabasePromise;
}
function persistRequestAttachments(requestId,files,removeIds){
  return openRequestAttachmentDatabase().then(database=>new Promise((resolve,reject)=>{
    const transaction=database.transaction('attachments','readwrite');
    const store=transaction.objectStore('attachments');
    const saved=[];
    files.forEach((file,index)=>{
      const id=`${requestId}:${Date.now()}:${index}:${Math.random().toString(36).slice(2,8)}`;
      store.put({id,requestId,name:file.name,type:file.type,size:file.size,blob:file});
      saved.push({id,name:file.name,type:file.type,size:file.size});
    });
    removeIds.forEach(id=>store.delete(id));
    transaction.oncomplete=()=>resolve(saved);
    transaction.onerror=()=>reject(transaction.error||new Error('Could not save reference images.'));
    transaction.onabort=()=>reject(transaction.error||new Error('Saving reference images was interrupted.'));
  }));
}
function requestFormData(){
  const data=new FormData(requestForm);
  const budgetFrom=String(data.get('budgetFrom')||'').replace(/\D/g,'');
  const budgetTo=String(data.get('budgetTo')||'').replace(/\D/g,'');
  return {
    title:String(data.get('title')||'').trim(),
    category:String(data.get('category')||''),
    categoryOther:String(data.get('categoryOther')||'').trim(),
    projectType:String(data.get('projectType')||''),
    description:String(data.get('description')||'').trim(),
    references:String(data.get('references')||'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean),
    referenceFiles:[...data.getAll('referenceFiles')].filter(file=>file instanceof File&&file.size),
    budgetFrom,
    budgetTo,
    budget:budgetFrom&&budgetTo?`${formatRequestMoney(budgetFrom)} — ${formatRequestMoney(budgetTo)}`:'',
    negotiable:data.has('negotiable'),
    deadline:String(data.get('deadline')||''),
    targetStart:String(data.get('targetStart')||''),
    specialties:data.getAll('specialties').map(String),
    specialtyOther:String(data.get('specialtyOther')||'').trim()
  };
}
function formatRequestMoney(value){
  const amount=Number(String(value||'').replace(/\D/g,''));
  return amount?`Rp ${amount.toLocaleString('id-ID')}`:'';
}
function updateRequestPreview(){
  if(!requestForm)return;
  const request=requestFormData();
  document.getElementById('requestTitleCount').textContent=String(requestForm.elements.title.value.length);
  document.getElementById('requestDescriptionCount').textContent=String(requestForm.elements.description.value.length);
  document.getElementById('requestPreviewTitle').textContent=request.title||'Your project title';
  document.getElementById('requestPreviewCategory').textContent=request.category==='Other'&&request.categoryOther?`Other · ${request.categoryOther}`:request.category||'Category';
  document.getElementById('requestPreviewType').textContent=request.projectType||'Project type';
  document.getElementById('requestPreviewDescription').textContent=request.description||'Your project description will appear here to help developers understand what you need.';
  const referenceCount=request.references.length+retainedAttachments.filter(item=>!removedAttachmentIds.has(item.id)).length+pendingReferenceFiles.length;
  const referenceNote=document.getElementById('requestPreviewReferences');
  referenceNote.hidden=!referenceCount;
  referenceNote.textContent=referenceCount?`${referenceCount} reference${referenceCount===1?'':'s'} attached`: '';
  const budgetLabel=request.budget||((request.budgetFrom||request.budgetTo)?`${formatRequestMoney(request.budgetFrom)||'—'} — ${formatRequestMoney(request.budgetTo)||'—'}`:'Budget not set');
  document.getElementById('requestPreviewBudget').textContent=request.negotiable?`${budgetLabel} · Negotiable`:budgetLabel;
  document.getElementById('requestPreviewDeadline').textContent=request.deadline?formatDeadline(request.deadline):'Not set';
  const specialties=document.getElementById('requestPreviewSpecialtyTags');
  specialties.replaceChildren();
  if(request.specialties.length){
    request.specialties.forEach(specialty=>{
      const tag=document.createElement('i');
      tag.textContent=specialty==='Other'&&request.specialtyOther?`Other · ${request.specialtyOther}`:specialty;
      specialties.append(tag);
    });
  }else{
    const empty=document.createElement('i');
    empty.textContent='Choose specialization';
    specialties.append(empty);
  }
}
function openRequestComposer(request=null){
  requestForm.reset();
  editingRequestId=request?.id||null;
  pendingReferenceFiles=[];
  retainedAttachments=[...(request?.attachments||[])];
  removedAttachmentIds=new Set();
  document.getElementById('requestPageTitle').textContent=request?'Edit project request':'Post a project request';
  document.querySelector('[data-post-request]').innerHTML=request?'Update Project Request <span aria-hidden="true">→</span>':'Post Project Request <span aria-hidden="true">→</span>';
  document.getElementById('requestComposerMessage').textContent='';
  const profile=JSON.parse(localStorage.getItem('devmatch-profile-client')||'{}');
  const profileName=profile.displayName||'Client';
  document.getElementById('requestPreviewName').textContent=profileName;
  document.getElementById('requestPreviewAvatar').textContent=profileName.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CL';
  document.querySelector('.request-preview-owner small').textContent=`Preview · ${[profile.city,profile.country].filter(Boolean).join(', ')||'Indonesia'}`;
  if(request){
    requestForm.elements.title.value=request.title||'';
    requestForm.elements.description.value=request.description||'';
    requestForm.elements.categoryOther.value=request.categoryOther||'';
    requestForm.elements.projectType.value=request.projectType||'';
    requestForm.elements.references.value=(request.references||[]).join('\n');
    requestForm.elements.specialtyOther.value=request.specialtyOther||'';
    requestForm.elements.budgetFrom.value=request.budgetFrom||'';
    requestForm.elements.budgetTo.value=request.budgetTo||'';
    requestForm.elements.negotiable.checked=Boolean(request.negotiable);
    requestForm.elements.deadline.value=request.deadline||'';
    requestForm.elements.targetStart.value=request.targetStart||'';
    [...requestForm.querySelectorAll('[name="category"]')].forEach(input=>{input.checked=input.value===request.category});
    requestForm.querySelectorAll('[name="specialties"]').forEach(input=>{input.checked=(request.specialties||[]).includes(input.value)});
  }
  syncRequestPickers();
  syncConditionalFields();
  renderReferenceAttachments();
  updateRequestPreview();
  history.replaceState(null,'','#request-new');
  showClientView('request');
  window.scrollTo({top:0,behavior:'smooth'});
  if(!request)requestForm.elements.title.focus({preventScroll:true});
}
function showRequestDetails(request){
  const dialog=document.getElementById('requestViewDialog');
  document.getElementById('requestViewTitle').textContent=request.title||'Untitled request';
  const meta=document.getElementById('requestViewMeta');
  const category=request.category==='Other'&&request.categoryOther?`Other · ${request.categoryOther}`:request.category||'Category not selected';
  const type=request.projectType==='Other'&&request.projectTypeOther?`Other · ${request.projectTypeOther}`:request.projectType||'Project type not set';
  meta.replaceChildren();
  [request.status||'draft',category,type].forEach((label,index)=>{
    const tag=document.createElement('span');
    tag.className=index===0?`request-status ${request.status||'draft'}`:'request-card-tag';
    tag.textContent=label;
    meta.append(tag);
  });
  document.getElementById('requestViewDescription').textContent=request.description||'No description provided.';
  document.getElementById('requestViewBudget').textContent=request.budgetFrom&&request.budgetTo
    ?`${formatRequestMoney(request.budgetFrom)} — ${formatRequestMoney(request.budgetTo)}${request.negotiable?' · Negotiable':''}`
    :request.budget|| (request.negotiable?'Negotiable':'Not set');
  document.getElementById('requestViewDeadline').textContent=request.deadline?formatDeadline(request.deadline):'Not set';
  document.getElementById('requestViewStart').textContent=request.targetStart?formatMonth(request.targetStart):'Not set';
  document.getElementById('requestViewSpecialties').textContent=(request.specialties||[]).map(specialty=>specialty==='Other'&&request.specialtyOther?`Other · ${request.specialtyOther}`:specialty).join(', ')||'Not specified';
  const referenceSection=document.getElementById('requestViewReferences');
  const linkContainer=document.getElementById('requestViewLinks');
  const attachmentList=document.getElementById('requestViewAttachments');
  linkContainer.replaceChildren();
  attachmentList.replaceChildren();
  (request.references||[]).forEach(reference=>{
    try{
      const url=new URL(reference);
      if(!['http:','https:'].includes(url.protocol))return;
      const link=document.createElement('a');
      link.href=url.href;
      link.target='_blank';
      link.rel='noopener noreferrer';
      link.textContent=url.hostname+url.pathname;
      linkContainer.append(link);
    }catch{}
  });
  (request.attachments||[]).forEach(attachment=>{
    const item=document.createElement('li');
    item.textContent=attachment.name||'Reference image';
    attachmentList.append(item);
  });
  referenceSection.hidden=!linkContainer.children.length&&!attachmentList.children.length;
  document.getElementById('requestViewStatus').textContent=`${Number(request.views)||0} views · ${Number(request.saves??request.favorites)||0} saved · ${Number(request.commentCount??request.comments)||0} comments`;
  dialog.showModal();
}
function showRequestDetailPage(request){
  activeRequestDetailId=request.id;
  const name=clientProfile.displayName||'Client';
  const initials=name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CL';
  const location=[clientProfile.city,clientProfile.country].filter(Boolean).join(', ')||'Indonesia';
  const status=request.status==='open'||request.status==='closed'?request.status:'draft';
  const category=request.category==='Other'&&request.categoryOther?`Other · ${request.categoryOther}`:request.category||'Category not selected';
  const type=request.projectType==='Other'&&request.projectTypeOther?`Other · ${request.projectTypeOther}`:request.projectType||'Project type not set';
  const specialties=(request.specialties||[]).map(specialty=>specialty==='Other'&&request.specialtyOther?`Other · ${request.specialtyOther}`:specialty);
  const views=Number(request.views)||0;
  const saves=Number(request.saves??request.favorites)||0;
  const commentCount=Number(request.commentCount??(Array.isArray(request.comments)?request.comments.length:request.comments))||0;
  document.getElementById('requestDetailBreadcrumbTitle').textContent=request.title||'Project request';
  document.getElementById('requestDetailOwner').textContent=name;
  document.getElementById('requestDetailLocation').textContent=location;
  document.getElementById('requestDetailAvatar').textContent=initials;
  document.getElementById('requestDetailAsideName').textContent=name;
  document.getElementById('requestDetailAsideLocation').textContent=location;
  document.getElementById('requestDetailAsideAvatar').textContent=initials;
  document.getElementById('requestDetailStatus').textContent=status;
  document.getElementById('requestDetailStatus').className=`request-detail-status ${status}`;
  document.getElementById('requestDetailTitle').textContent=request.title||'Untitled request';
  document.getElementById('requestDetailDescription').textContent=request.description||'No description provided.';
  document.getElementById('requestDetailBudget').textContent=request.budgetFrom&&request.budgetTo
    ?`${formatRequestMoney(request.budgetFrom)} — ${formatRequestMoney(request.budgetTo)}`
    :request.budget||'Not set';
  const negotiableBadge=document.getElementById('requestDetailNegotiable');
  negotiableBadge.hidden=!request.negotiable;
  const deadline=parseIsoDate(request.deadline);
  document.getElementById('requestDetailDeadline').textContent=deadline?formatDeadline(request.deadline):'Not set';
  const deadlineRemaining=document.getElementById('requestDetailDeadlineRemaining');
  if(deadline){
    const today=new Date();
    const todayAtMidnight=new Date(today.getFullYear(),today.getMonth(),today.getDate());
    const deadlineAtMidnight=new Date(deadline.getFullYear(),deadline.getMonth(),deadline.getDate());
    const daysLeft=Math.ceil((deadlineAtMidnight-todayAtMidnight)/86400000);
    deadlineRemaining.textContent=daysLeft<0
      ?`${Math.abs(daysLeft)} day${daysLeft===-1?'':'s'} overdue`
      :daysLeft===0?'Due today':`${daysLeft} day${daysLeft===1?'':'s'} left`;
    deadlineRemaining.hidden=false;
  }else{
    deadlineRemaining.textContent='';
    deadlineRemaining.hidden=true;
  }
  const meta=document.getElementById('requestDetailMeta');
  meta.replaceChildren();
  [category,type].forEach(label=>{
    const tag=document.createElement('span');
    tag.textContent=label;
    meta.append(tag);
  });
  const specialtyContainer=document.getElementById('requestDetailSpecialties');
  specialtyContainer.replaceChildren();
  if(specialties.length){
    specialties.forEach(specialty=>{
      const tag=document.createElement('span');
      tag.textContent=specialty;
      specialtyContainer.append(tag);
    });
  }else{
    const empty=document.createElement('span');
    empty.textContent='Not specified';
    specialtyContainer.append(empty);
  }
  document.getElementById('requestDetailViews').textContent=`◉ ${views.toLocaleString('id-ID')} views`;
  document.getElementById('requestDetailSaves').textContent=`♡ ${saves.toLocaleString('id-ID')} favorites`;
  document.getElementById('requestDetailComments').textContent=`▢ ${commentCount.toLocaleString('id-ID')} comments`;
  const created=Number(request.created||request.updated);
  document.getElementById('requestDetailCreated').textContent=Number.isFinite(created)&&created>0
    ?`Created ${new Date(created).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}`
    :'Date not available';
  document.getElementById('requestDetailCommentCount').textContent=String(commentCount);
  const comments=Array.isArray(request.comments)?request.comments:[];
  const commentsList=document.getElementById('requestDetailCommentsList');
  commentsList.replaceChildren();
  comments.forEach(comment=>{
    const item=document.createElement('article');
    item.className='request-detail-comment';
    const author=document.createElement('strong');
    author.textContent=comment.name||comment.author||'Developer';
    const message=document.createElement('p');
    message.textContent=comment.text||comment.message||'';
    item.append(author,message);
    commentsList.append(item);
  });
  document.getElementById('requestDetailCommentsEmpty').hidden=comments.length>0||commentCount>0;
  if(commentCount>comments.length){
    const note=document.createElement('p');
    note.className='request-detail-comment-note';
    note.textContent=`${commentCount} comment${commentCount===1?'':'s'} recorded. Full discussion is not available in this browser yet.`;
    commentsList.append(note);
  }
  const commenters=new Map();
  (request.activity||[]).filter(entry=>/comment/i.test(entry.action||'')&&entry.name).forEach(entry=>commenters.set(entry.name,entry));
  const commentersList=document.getElementById('requestDetailCommentersList');
  commentersList.replaceChildren();
  commenters.forEach(entry=>{
    const person=document.createElement('div');
    person.className='request-detail-commenter';
    const avatar=document.createElement('span');
    avatar.className='request-detail-avatar';
    avatar.textContent=String(entry.initials||entry.name).trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
    const personName=document.createElement('strong');
    personName.textContent=entry.name;
    person.append(avatar,personName);
    commentersList.append(person);
  });
  document.getElementById('requestDetailCommentersEmpty').hidden=commenters.size>0;
  document.getElementById('requestDetailRequestCount').textContent=String(requests.length);
  document.getElementById('requestDetailOpenCount').textContent=String(requests.filter(item=>item.status==='open').length);
  const statusButton=document.querySelector('[data-detail-status-action]');
  statusButton.textContent=status==='open'?'Close request':status==='closed'?'Reopen request':'Publish request';
  statusButton.dataset.nextStatus=status==='open'?'closed':'open';
  history.replaceState(null,'',`#request-detail/${encodeURIComponent(request.id)}`);
  showClientView('request-detail');
  window.scrollTo({top:0,behavior:'smooth'});
}
function updateRequestStatus(requestId,status){
  const updatedRequests=requests.map(request=>request.id===requestId?{...request,status,updated:Date.now()}:request);
  try{
    localStorage.setItem(requestsKey,JSON.stringify(updatedRequests));
  }catch(error){
    console.error('Unable to update the project request status.',error);
    document.getElementById('requestsMessage').textContent='Could not update this request. Browser storage may be full.';
    return;
  }
  requests=updatedRequests;
  document.getElementById('requestsMessage').textContent=status==='closed'?'Request closed. You can reopen it anytime.':'Request reopened.';
  renderRequests();
  if(activeRequestDetailId===requestId){
    const updatedRequest=requests.find(request=>request.id===requestId);
    if(updatedRequest)showRequestDetailPage(updatedRequest);
  }
}
async function deleteRequest(requestId){
  const request=requests.find(item=>item.id===requestId);
  if(!request||!window.confirm(`Delete "${request.title||'this request'}"? This cannot be undone.`))return;
  const updatedRequests=requests.filter(item=>item.id!==requestId);
  try{
    localStorage.setItem(requestsKey,JSON.stringify(updatedRequests));
  }catch(error){
    console.error('Unable to delete the project request.',error);
    document.getElementById('requestsMessage').textContent='Could not delete this request. Browser storage may be full.';
    return;
  }
  requests=updatedRequests;
  document.getElementById('requestsMessage').textContent='Request deleted.';
  renderRequests();
  if(activeRequestDetailId===requestId){
    activeRequestDetailId=null;
    history.replaceState(null,'','#requests');
    showClientView('requests');
  }
  if(request.attachments?.length){
    try{
      await persistRequestAttachments(request.id,[],request.attachments.map(attachment=>attachment.id));
    }catch(error){
      console.error('Unable to remove deleted request reference images.',error);
      document.getElementById('requestsMessage').textContent='Request deleted, but some local reference images could not be removed.';
    }
  }
}
async function saveRequest(status){
  const data=requestFormData();
  const message=document.getElementById('requestComposerMessage');
  message.textContent='';
  if(status==='open'){
    if(!data.title||!data.category||!data.description){
      message.textContent='Add a project title, choose a category, and describe what you need before posting.';
      if(!data.title)requestForm.elements.title.focus();
      else if(!data.category)requestForm.querySelector('[name="category"]').focus();
      else requestForm.elements.description.focus();
      return;
    }
    if(!data.projectType){
      message.textContent='Choose the project type so developers know what kind of work is needed.';
      requestForm.querySelector('[name="projectType"]').focus();
      return;
    }
    if(!parseIsoDate(data.deadline)){
      message.textContent='Choose a deadline date before posting your project request.';
      deadlineTrigger.focus();
      return;
    }
    if(data.category==='Other'&&!data.categoryOther){
      message.textContent='Please describe the project category you selected as Other.';
      requestForm.elements.categoryOther.focus();
      return;
    }
    if(data.specialties.includes('Other')&&!data.specialtyOther){
      message.textContent='Please describe the specialization you selected as Other.';
      requestForm.elements.specialtyOther.focus();
      return;
    }
    if(Boolean(data.budgetFrom)!==Boolean(data.budgetTo)){
      message.textContent='Complete both ends of the budget range, or clear both amounts.';
      (!data.budgetFrom?requestForm.elements.budgetFrom:requestForm.elements.budgetTo).focus();
      return;
    }
    if(!data.negotiable&&(!data.budgetFrom||!data.budgetTo)){
      message.textContent='Add both ends of your budget range, or mark the budget as negotiable.';
      (!data.budgetFrom?requestForm.elements.budgetFrom:requestForm.elements.budgetTo).focus();
      return;
    }
    if(data.budgetFrom&&data.budgetTo&&Number(data.budgetFrom)>Number(data.budgetTo)){
      message.textContent='The “Budget to” amount must be at least the “Budget from” amount.';
      requestForm.elements.budgetTo.focus();
      return;
    }
    if(!data.specialties.length){
      message.textContent='Choose at least one required specialization.';
      requestForm.querySelector('[name="specialties"]').focus();
      return;
    }
  }
  if(data.references.length>5){
    message.textContent='Add no more than 5 reference links.';
    requestForm.elements.references.focus();
    return;
  }
  const invalidReference=data.references.find(reference=>{
    try{
      const url=new URL(reference);
      return !['http:','https:'].includes(url.protocol);
    }catch{
      return true;
    }
  });
  if(invalidReference){
    message.textContent='Check your reference links. Each link must start with http:// or https://.';
    requestForm.elements.references.focus();
    return;
  }
  const totalAttachments=retainedAttachments.filter(item=>!removedAttachmentIds.has(item.id)).length+pendingReferenceFiles.length;
  if(totalAttachments>5){
    message.textContent='Attach no more than 5 reference images.';
    return;
  }
  const existingIndex=requests.findIndex(item=>item.id===editingRequestId);
  const id=editingRequestId||`request-${Date.now()}`;
  let attachments=retainedAttachments.filter(item=>!removedAttachmentIds.has(item.id));
  if(pendingReferenceFiles.length||removedAttachmentIds.size){
    try{
      const saved=await persistRequestAttachments(id,pendingReferenceFiles,[...removedAttachmentIds]);
      attachments=[...attachments,...saved];
    }catch(error){
      console.error('Unable to save project reference images.',error);
      message.textContent='Could not save reference images in this browser. Please try again or remove the images.';
      return;
    }
  }
  const {referenceFiles,...requestData}=data;
  const request={...requestData,attachments,id,status,updated:Date.now()};
  const updatedRequests=[...requests];
  if(existingIndex>=0)updatedRequests[existingIndex]=request;
  else updatedRequests.unshift(request);
  try{
    localStorage.setItem(requestsKey,JSON.stringify(updatedRequests));
  }catch(error){
    console.error('Unable to save the project request in browser storage.',error);
    message.textContent='Could not save this request. Browser storage may be full.';
    return;
  }
  requests=updatedRequests;
  renderRequests();
  editingRequestId=null;
  history.replaceState(null,'','#requests');
  showClientView('requests');
}
document.querySelectorAll('[data-open-request]').forEach(button=>button.addEventListener('click',()=>openRequestComposer()));
document.querySelectorAll('[data-back-to-requests]').forEach(button=>button.addEventListener('click',()=>{
  activeRequestDetailId=null;
  history.replaceState(null,'','#requests');
  showClientView('requests');
}));
document.querySelector('[data-save-request-draft]').addEventListener('click',()=>saveRequest('draft'));
document.querySelector('[data-post-request]').addEventListener('click',()=>saveRequest('open'));
requestForm.addEventListener('input',updateRequestPreview);
requestForm.addEventListener('change',event=>{
  if(event.target.name==='category'||event.target.name==='specialties')syncConditionalFields();
  updateRequestPreview();
});
requestForm.addEventListener('input',event=>{
  if(event.target.name==='budgetFrom'||event.target.name==='budgetTo')event.target.value=event.target.value.replace(/\D/g,'');
});
document.getElementById('requestReferenceFiles').addEventListener('change',event=>{
  const message=document.getElementById('requestComposerMessage');
  const files=[...event.target.files];
  event.target.value='';
  const currentCount=retainedAttachments.filter(item=>!removedAttachmentIds.has(item.id)).length+pendingReferenceFiles.length;
  const valid=files.filter(file=>['image/png','image/jpeg','image/webp'].includes(file.type)&&file.size<=5*1024*1024);
  if(valid.length!==files.length){
    message.textContent='Only PNG, JPG, or WebP images up to 5 MB each can be attached.';
    return;
  }
  if(currentCount+valid.length>5){
    message.textContent='Attach no more than 5 reference images.';
    return;
  }
  pendingReferenceFiles.push(...valid);
  message.textContent='';
  renderReferenceAttachments();
  updateRequestPreview();
});
document.getElementById('requestAttachmentList').addEventListener('click',event=>{
  const button=event.target.closest('[data-remove-attachment]');
  if(!button)return;
  if(button.dataset.attachmentSource==='saved')removedAttachmentIds.add(button.dataset.removeAttachment);
  else pendingReferenceFiles.splice(Number(button.dataset.removeAttachment),1);
  renderReferenceAttachments();
  updateRequestPreview();
});
requestForm.addEventListener('submit',event=>{
  event.preventDefault();
  saveRequest('open');
});
document.getElementById('requestSearch').addEventListener('input',event=>{
  activeRequestQuery=event.target.value.trim().toLowerCase();
  renderRequests();
});
document.getElementById('requestSort').addEventListener('change',event=>{
  activeRequestSort=event.target.value;
  renderRequests();
});
document.querySelectorAll('[data-request-filter]').forEach(button=>button.addEventListener('click',()=>{
  activeRequestFilter=button.dataset.requestFilter;
  document.querySelectorAll('.request-status-tabs [data-request-filter]').forEach(tab=>{
    const active=tab.dataset.requestFilter===activeRequestFilter;
    tab.classList.toggle('active',active);
    tab.setAttribute('aria-selected',String(active));
  });
  renderRequests();
}));
document.getElementById('requestList').addEventListener('click',event=>{
  const detailButton=event.target.closest('[data-request-detail]');
  if(detailButton){
    const request=requests.find(item=>item.id===detailButton.dataset.requestDetail);
    if(request)showRequestDetailPage(request);
    return;
  }
  const button=event.target.closest('[data-edit-request]');
  if(button){
    const request=requests.find(item=>item.id===button.dataset.editRequest);
    if(request)openRequestComposer(request);
    return;
  }
  const actionButton=event.target.closest('[data-request-action]');
  if(!actionButton)return;
  const details=actionButton.closest('details');
  if(details)details.open=false;
  const request=requests.find(item=>item.id===actionButton.dataset.requestId);
  if(!request)return;
  if(actionButton.dataset.requestAction==='view')showRequestDetails(request);
  if(actionButton.dataset.requestAction==='close')updateRequestStatus(request.id,'closed');
  if(actionButton.dataset.requestAction==='reopen'||actionButton.dataset.requestAction==='publish')updateRequestStatus(request.id,'open');
  if(actionButton.dataset.requestAction==='delete')deleteRequest(request.id);
});
document.getElementById('requestDetailPage').addEventListener('click',event=>{
  if(event.target.closest('[data-edit-detail-request]')){
    const request=requests.find(item=>item.id===activeRequestDetailId);
    if(request)openRequestComposer(request);
    return;
  }
  if(event.target.closest('[data-detail-status-action]')){
    const button=event.target.closest('[data-detail-status-action]');
    updateRequestStatus(activeRequestDetailId,button.dataset.nextStatus);
    return;
  }
  if(event.target.closest('[data-detail-delete]'))deleteRequest(activeRequestDetailId);
});
document.querySelectorAll('[data-close-request-view]').forEach(button=>button.addEventListener('click',()=>document.getElementById('requestViewDialog').close()));
document.getElementById('requestViewDialog').addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close()});
renderProjects();
renderRequests();
syncRequestPickers();
syncConditionalFields();
renderReferenceAttachments();
updateRequestPreview();
if(location.hash==='#discover')showClientView('discover');
else if(location.hash==='#requests')showClientView('requests');
else if(location.hash==='#request-new')openRequestComposer();
else if(location.hash.startsWith('#request-detail/')){
  try{
    const requestId=decodeURIComponent(location.hash.slice('#request-detail/'.length));
    const request=requests.find(item=>item.id===requestId);
    if(request)showRequestDetailPage(request);
    else showClientView('requests');
  }catch(error){
    console.error('Unable to open the requested project detail.',error);
    showClientView('requests');
  }
}
