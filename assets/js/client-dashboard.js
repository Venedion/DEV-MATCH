const clientProfile=JSON.parse(localStorage.getItem('devmatch-profile-client')||'{}');
const clientName=clientProfile.displayName||'Client';
const clientNameParts=clientName.trim().split(/\s+/).filter(Boolean);
document.getElementById('topUserName').textContent=clientProfile.username||clientName;
document.getElementById('userAvatar').textContent=clientNameParts.slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CL';
window.devMatchBackend.ready.then(user=>{
  if(!user)return;
  const profile=JSON.parse(localStorage.getItem('devmatch-profile-client')||'{}');
  const name=String(profile.displayName||'Client');
  document.getElementById('topUserName').textContent=profile.username||name;
  document.getElementById('userAvatar').textContent=name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CL';
});
document.querySelectorAll('.client-notification-count').forEach(count=>{count.textContent='';count.hidden=true;});
const notificationDot=document.querySelector('.client-icon-button i');
if(notificationDot)notificationDot.hidden=true;
const hour=new Date().getHours();
document.getElementById('greeting').textContent=hour<12?'Good morning,':hour<18?'Good afternoon,':'Good evening,';

let marketplaceProjects=[];
let marketplaceLoaded=false;
let marketplaceFailed=false;
let favoritesLoaded=false;
let favoritesFailed=false;
const favoritesKey='devmatch-client-project-favorites';
if(localStorage.getItem(favoritesKey)===null){const legacy=localStorage.getItem('devmatch-client-favorites');if(legacy!==null)localStorage.setItem(favoritesKey,legacy);}
const requestsKey='devmatch-client-requests';
let favorites=JSON.parse(localStorage.getItem(favoritesKey)||'[]');
let favoritesRevision=0;
let favoriteStateReady;
let requests=JSON.parse(localStorage.getItem(requestsKey)||'[]');
let requestDashboardMetrics=null;
const pageSkeletons=window.DEVMATCH_SKELETON;
pageSkeletons?.rows(document.getElementById('requestList'),3);
['requestStatOpen','requestStatClosed','requestStatDraft','requestStatViews','requestStatSaves','requestStatComments']
  .forEach(id=>pageSkeletons?.text(document.getElementById(id),'Loading request metrics','42px'));
['requestCountAll','requestCountOpen','requestCountClosed','requestCountDraft']
  .forEach(id=>pageSkeletons?.text(document.getElementById(id),'Loading request count','24px'));
function formatDashboardMetric(value){
  return value!==null&&value!==undefined&&Number.isFinite(Number(value))
    ?Number(value).toLocaleString('id-ID')
    :'—';
}
function renderRequestDetailClientMetrics(){
  document.getElementById('requestDetailClientProjects').textContent=formatDashboardMetric(requestDashboardMetrics?.projects);
  document.getElementById('requestDetailClientViews').textContent=formatDashboardMetric(requestDashboardMetrics?.views);
  document.getElementById('requestDetailClientFavorites').textContent=formatDashboardMetric(requestDashboardMetrics?.favorites);
}
const requestsReady=window.devMatchBackend.ready.then(user=>user
  ?window.devMatchBackend.loadOwnedProjects('request',requests)
  :null
).then(records=>{
  if(!records)return false;
  requests=records;
  localStorage.setItem(requestsKey,JSON.stringify(requests));
  renderRequests();
  return true;
}).catch(error=>{
  console.error('Unable to load your project requests from Supabase.',error);
  document.getElementById('requestsMessage').textContent='Unable to load your requests. Check your connection and try again.';
  renderRequests();
  return false;
});
let activeCategory='All';
let activeType='All';
let activePrice='All';
let activeSpecialty='All';
let activeSort='newest';
let activeQuery='';
let activeRequestFilter='all';
let activeRequestQuery='';
let activeRequestSort='newest';
let activeRequestDetailId=null;
const expandedRequestCommentReplies=new Set();
let activeRequestViewId=null;
let requestActivityEntries=[];
let requestActivityState='loading';
let savingRequest=false;
const discoverGrid=document.getElementById('discoverGrid');
const homeRecommendedGrid=document.getElementById('homeRecommendedGrid');
const homeSavedList=document.getElementById('homeSavedList');

function renderHomeLoading(container,kind='data',count=3){
  container.setAttribute('aria-busy','true');
  container.innerHTML=Array.from({length:count},()=>kind==='person'
    ?'<div class="home-skeleton-row home-skeleton-person" aria-hidden="true"><i class="home-skeleton-avatar"></i><span><i class="home-skeleton-bar"></i><i class="home-skeleton-bar short"></i></span></div>'
    :'<div class="home-skeleton-row" aria-hidden="true"><i class="home-skeleton-bar"></i><i class="home-skeleton-bar short"></i></div>'
  ).join('');
}

function renderHomeMessage(container,message,linkText,href){
  container.setAttribute('aria-busy','false');
  container.replaceChildren();
  const paragraph=document.createElement('p');
  paragraph.className='home-coming-soon';
  paragraph.setAttribute('role','status');
  paragraph.textContent=message;
  if(linkText&&href){
    const link=document.createElement('a');
    link.className='home-inline-link';
    link.href=href;
    link.textContent=linkText;
    paragraph.append(' ',link);
  }
  container.append(paragraph);
}

function renderHomeError(container,message,retry){
  container.setAttribute('aria-busy','false');
  container.replaceChildren();
  const paragraph=document.createElement('p');
  paragraph.className='home-coming-soon';
  paragraph.setAttribute('role','status');
  paragraph.textContent=message;
  const button=document.createElement('button');
  button.className='request-secondary-button';
  button.type='button';
  button.textContent='Try again';
  button.addEventListener('click',retry,{once:true});
  container.append(paragraph,button);
}

function renderHomeRecommendationLoading(){
  homeRecommendedGrid.setAttribute('aria-busy','true');
  homeRecommendedGrid.innerHTML=Array.from({length:4},()=>'<div class="home-skeleton-card" aria-hidden="true"><i class="home-skeleton-bar"></i><i class="home-skeleton-bar short"></i><i class="home-skeleton-bar"></i></div>').join('');
  const status=document.getElementById('homeRecommendedStatus');
  status.hidden=true;
  status.replaceChildren();
}

async function loadHomeFavorites(){
  favoritesLoaded=false;
  favoritesFailed=false;
  renderHomeProjects();
  try{
    const user=await window.devMatchBackend.ready;
    if(!user)throw new Error('Sign in to load saved projects.');
    const revision=favoritesRevision;
    const records=await window.devMatchBackend.loadFavorites();
    if(revision!==favoritesRevision){
      favoritesLoaded=true;
      renderHomeProjects();
      return true;
    }
    favorites=records.filter(item=>item.type==='project').map(item=>item.id);
    const developerIds=records.filter(item=>item.type==='developer').map(item=>item.id);
    localStorage.setItem(favoritesKey,JSON.stringify(favorites));
    localStorage.setItem('devmatch-client-dev-favorites',JSON.stringify(developerIds));
    window.DEVMATCH_NAV_BADGES?.updateFavorites();
    favoritesLoaded=true;
    renderProjects();
    return true;
  }catch(error){
    console.error('Unable to load project favorites from Supabase.',error);
    favoritesLoaded=true;
    favoritesFailed=true;
    renderHomeProjects();
    return null;
  }
}

favoriteStateReady=loadHomeFavorites();

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function safeProjectCover(value){
  if(typeof value!=='string')return '';
  if(/^data:image\/(?:jpeg|png|webp);base64,/i.test(value))return value;
  try{
    const url=new URL(value);
    return url.origin==='https://yxwktllqbmhustmhdaqi.supabase.co'
      &&url.pathname.startsWith('/storage/v1/object/public/project-media/')
      ?value:'';
  }catch{
    return '';
  }
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
  const filtered=marketplaceProjects.filter(project=>{
    const categoryMatches=activeCategory==='All'||project.category===activeCategory||project.type===activeCategory;
    const typeMatches=activeType==='All'||project.type===activeType;
    const price=Number(String(project.price).replace(/\D/g,''))||0;
    const priceMatches=activePrice==='All'||price>0&&(activePrice==='under-5'&&price<5000000||activePrice==='5-to-8'&&price>=5000000&&price<=8000000||activePrice==='over-8'&&price>8000000);
    const specialties=Array.isArray(project.specialties)?project.specialties:[project.specialty].filter(Boolean);
    const specialtyMatches=activeSpecialty==='All'||specialties.includes(activeSpecialty);
    const queryMatches=!activeQuery||[project.title,project.type,project.category,project.description,project.developer,project.specialty].join(' ').toLowerCase().includes(activeQuery);
    return categoryMatches&&typeMatches&&priceMatches&&specialtyMatches&&queryMatches;
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
  const artwork=project.coverImage
    ?`<img class="project-cover-image" src="${escapeHtml(project.coverImage)}" alt="" loading="lazy">`
    :artMarkup(project);
  return `
    <article class="client-project-card" data-project="${escapeHtml(project.id)}" tabindex="0" role="link" aria-label="View ${escapeHtml(project.title)} details">
      <div class="project-art ${project.art}">
        <span class="art-label">${escapeHtml(project.type)}</span>
        <button class="favorite-button" type="button" data-favorite="${escapeHtml(project.id)}" aria-pressed="${favorite}" aria-label="${favorite?'Remove':'Add'} ${escapeHtml(project.title)} ${favorite?'from':'to'} favorites">
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        ${artwork}
      </div>
      <div class="project-body">
        <div class="project-meta"><b>${escapeHtml(project.category)}</b><span>${escapeHtml(project.age)}</span></div>
        <h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.description)}</p>
        ${discover?`<strong class="project-price">${escapeHtml(project.price)}</strong>`:`<strong class="project-price">${escapeHtml(project.price)}</strong>`}
        <div class="project-by catalog-project-by">
          <span class="developer-avatar">${escapeHtml(project.initials)}</span>
          <span class="developer-info"><b>${escapeHtml(project.developer)}</b><small>${escapeHtml(project.handle||'')}</small></span>
        </div>
      </div>
    </article>`;
}

function renderProjects(){
  const filtered=getFilteredProjects();
  const isLoading=!marketplaceLoaded&&!marketplaceFailed;
  if(isLoading)pageSkeletons?.cards(discoverGrid,4,'dashboard-project');
  else discoverGrid.innerHTML=filtered.map(project=>projectCardMarkup(project,true)).join('');
  const emptyMessage=marketplaceFailed
    ?'Projects could not be loaded. Check your connection and try again.'
    :marketplaceLoaded?'No projects match these filters. Try changing your search or filters.':'Loading published projects…';
  const discoverEmptyState=document.getElementById('discoverEmptyState');
  discoverEmptyState.textContent=emptyMessage;
  discoverEmptyState.hidden=isLoading||filtered.length>0;
  if(isLoading){
    pageSkeletons?.text(document.getElementById('discoverProjectCount'),'Loading project count','24px');
    pageSkeletons?.text(document.getElementById('discoverResultsCount'),'Loading project count','82px');
  }else if(marketplaceFailed){
    document.getElementById('discoverProjectCount').textContent='—';
    document.getElementById('discoverResultsCount').textContent='— projects';
  }else{
    document.getElementById('discoverProjectCount').textContent=String(marketplaceProjects.length);
    document.getElementById('discoverResultsCount').textContent=`${filtered.length} project${filtered.length===1?'':'s'}`;
  }
  document.getElementById('discoverResultsNote').textContent=activeSort==='newest'?'· showing newest first':activeSort==='oldest'?'· showing oldest first':activeSort==='price-low'?'· lowest price first':'· highest price first';
  document.getElementById('favoriteCount').textContent=String(favorites.length);
  renderHomeProjects();
}

function renderHomeProjects(){
  if(!favoritesLoaded){
    renderHomeLoading(homeSavedList);
  }else if(favoritesFailed){
    renderHomeError(homeSavedList,'Unable to load saved projects.',retryHomeProjectData);
  }else if(!marketplaceLoaded){
    renderHomeLoading(homeSavedList);
  }else if(marketplaceFailed){
    renderHomeError(homeSavedList,'Unable to load saved projects.',retryHomeProjectData);
  }else{
    const savedProjects=marketplaceProjects.filter(project=>favorites.includes(project.id)).slice(0,3);
    if(savedProjects.length){
      homeSavedList.innerHTML=savedProjects.map(project=>`
        <button class="home-saved-item" type="button" data-project-open="${escapeHtml(project.id)}">
          <span><b>${escapeHtml(project.title)}</b><small>${escapeHtml(project.category)} · ${escapeHtml(project.developer)}</small></span>
          <strong>${escapeHtml(project.price)}</strong>
        </button>`).join('');
      homeSavedList.setAttribute('aria-busy','false');
    }else{
      renderHomeMessage(homeSavedList,'No saved projects yet. Browse projects to find something to save.','Browse projects','devmatch-discover-projects.html');
    }
  }

  const recommendedStatus=document.getElementById('homeRecommendedStatus');
  if(!marketplaceLoaded||!favoritesLoaded){
    renderHomeRecommendationLoading();
    return;
  }
  if(marketplaceFailed||favoritesFailed){
    homeRecommendedGrid.replaceChildren();
    homeRecommendedGrid.setAttribute('aria-busy','false');
    recommendedStatus.hidden=false;
    renderHomeError(recommendedStatus,'Unable to load recommendations.',retryHomeProjectData);
    return;
  }
  const favoriteCategories=new Set(marketplaceProjects
    .filter(project=>favorites.includes(project.id))
    .map(project=>project.category));
  const unsavedProjects=marketplaceProjects.filter(project=>!favorites.includes(project.id));
  const related=unsavedProjects.filter(project=>favoriteCategories.has(project.category));
  const recommendations=[...related,...unsavedProjects.filter(project=>!favoriteCategories.has(project.category))].slice(0,4);
  homeRecommendedGrid.setAttribute('aria-busy','false');
  recommendedStatus.replaceChildren();
  homeRecommendedGrid.innerHTML=recommendations.map(project=>projectCardMarkup(project,true)).join('');
  recommendedStatus.hidden=recommendations.length>0;
  if(!recommendations.length){
    renderHomeMessage(recommendedStatus,'No recommendations available yet. Explore the full project catalog.','Discover projects','devmatch-discover-projects.html');
  }
}

function retryHomeProjectData(){
  if(favoritesFailed)favoriteStateReady=loadHomeFavorites();
  if(marketplaceFailed)void loadPublicProjects();
}

function renderHomeMetrics(metrics){
  const values={
    openRequests:metrics?.openRequests,
    newInquiries:metrics?.newInquiries,
    awaitingDeveloperReply:metrics?.awaitingDeveloperReply,
    activeProjects:metrics?.activeProjects
  };
  Object.entries(values).forEach(([key,value])=>{
    const target=document.querySelector(`[data-home-metric-value="${key}"]`);
    target.textContent=formatDashboardMetric(value);
  });
  document.querySelector('.home-metrics').setAttribute('aria-busy','false');
}

function formatHomeRelativeTime(value){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return 'Recently';
  const minutes=Math.max(0,Math.floor((Date.now()-date.getTime())/60000));
  if(minutes<1)return 'Just now';
  if(minutes<60)return `${minutes}m ago`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours}h ago`;
  const days=Math.floor(hours/24);
  return days<7?`${days}d ago`:date.toLocaleDateString();
}

function renderHomeAttention(items){
  const list=document.getElementById('homeAttentionList');
  if(!items.length){
    renderHomeMessage(list,'You’re all caught up. New inquiries and messages will appear here.');
    return;
  }
  list.innerHTML=items.map(item=>{
    const developer=String(item.developer||'Developer');
    const initials=developer.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'?';
    const context=String(item.context||'your conversation');
    const message=item.type==='inquiry'
      ?`messaged you about “${context}”`
      :item.type==='awaiting-reply'
        ?`hasn’t replied about “${context}” yet`
        :`finished “${context}”; your rating is pending`;
    const action=item.type==='inquiry'?'Open chat':item.type==='awaiting-reply'?'Reply':'Rate';
    const conversationId=encodeURIComponent(item.conversationId);
    const href=item.type==='rate'
      ?`devmatch-chat.html?role=client&conversation=${conversationId}&review=1`
      :`devmatch-chat.html?role=client&conversation=${conversationId}`;
    return `<article class="home-attention-item">
      <span class="home-attention-avatar" aria-hidden="true">${escapeHtml(initials)}</span>
      <div class="home-attention-copy"><b>${escapeHtml(developer)}</b><p>${escapeHtml(message)}</p><small>${escapeHtml(formatHomeRelativeTime(item.createdAt))}</small></div>
      <a class="request-secondary-button" href="${escapeHtml(href)}" aria-label="${escapeHtml(action)} — ${escapeHtml(developer)} — ${escapeHtml(context)}">${action}</a>
    </article>`;
  }).join('');
  list.setAttribute('aria-busy','false');
}

function renderHomeChecklistLoading(){
  const section=document.getElementById('homeGettingStarted');
  section.hidden=true;
  section.setAttribute('aria-busy','true');
}

function renderHomeChecklist(state){
  const section=document.getElementById('homeGettingStarted');
  const checklist=document.getElementById('homeChecklist');
  const items=[
    {key:'profileComplete',label:'Complete your profile',action:'Complete profile',href:'devmatch-my-profile.html?role=client'},
    {key:'exploredProjects',label:'Explore projects',action:'Browse projects',href:'devmatch-discover-projects.html'},
    {key:'postedRequest',label:'Post your first request',action:'Post a request',href:'devmatch-client-dashboard.html#request-new'}
  ];
  const allComplete=items.every(item=>state[item.key]===true);
  section.setAttribute('aria-busy','false');
  section.hidden=allComplete;
  checklist.innerHTML=allComplete?'':items.map((item,index)=>{
    const complete=state[item.key]===true;
    return `<div class="home-checklist-item${complete?' is-complete':''}" role="listitem">
      <span class="home-checklist-mark" aria-hidden="true">${complete?'✓':index+1}</span>
      <span class="home-checklist-label">${item.label}</span>
      ${complete?'<span class="home-checklist-action">Done</span>':`<a class="home-checklist-action" href="${item.href}">${item.action}</a>`}
    </div>`;
  }).join('');
}

function renderHomeDashboardLoading(){
  renderHomeChecklistLoading();
  renderHomeLoading(document.getElementById('homeAttentionList'),'person',3);
  renderHomeLoading(document.getElementById('homePostedRequests'),'data',3);
  renderHomeLoading(document.getElementById('homeSentConversations'),'data',3);
  const metrics=document.querySelector('.home-metrics');
  metrics.setAttribute('aria-busy','true');
  document.querySelectorAll('[data-home-metric-value]').forEach(target=>{
    target.innerHTML='<span class="home-skeleton-bar home-metric-skeleton" aria-hidden="true"></span>';
  });
  const status=document.getElementById('homeMetricsStatus');
  status.hidden=true;
  status.replaceChildren();
}

function formatPostedRequestBudget(request){
  if(request.budgetFrom&&request.budgetTo){
    return `${formatRequestMoney(request.budgetFrom)} — ${formatRequestMoney(request.budgetTo)}`;
  }
  const budget=String(request.price||'').trim();
  return /^\d+$/.test(budget)?formatRequestMoney(budget):budget||'Budget not set';
}

function renderHomeRequestLists(postedRequests,sentConversations){
  const postedList=document.getElementById('homePostedRequests');
  if(!postedRequests.length){
    renderHomeMessage(postedList,'No posted requests yet. Start with your first request.','Post a request','devmatch-client-dashboard.html#request-new');
  }else{
    postedList.innerHTML=postedRequests.map(request=>{
      const status=request.status==='open'?'Open':'Closed';
      const inquiries=Number(request.inquiries).toLocaleString('id-ID');
      return `<button class="home-data-row home-data-button" type="button" data-home-request-open="${escapeHtml(request.id)}" aria-label="View ${escapeHtml(request.title)} request details">
        <span class="home-data-row-copy"><b>${escapeHtml(request.title)}</b><small>${escapeHtml(formatPostedRequestBudget(request))} · ${inquiries} inquiries</small></span>
        <span class="home-data-row-meta"><b>${status}</b></span>
      </button>`;
    }).join('');
    postedList.setAttribute('aria-busy','false');
  }

  const sentList=document.getElementById('homeSentConversations');
  if(!sentConversations.length){
    renderHomeMessage(sentList,'No conversations about developer projects yet. Explore projects to start one.','Browse projects','devmatch-discover-projects.html');
  }else{
    sentList.innerHTML=sentConversations.map(conversation=>{
      const status=conversation.status==='awaiting-reply'?'Awaiting reply':'Replied';
      return `<a class="home-data-row home-data-link" href="devmatch-discover-project-detail.html?project=${encodeURIComponent(conversation.projectId)}">
        <span class="home-data-row-copy"><b>${escapeHtml(conversation.project)}</b><small>${escapeHtml(conversation.developer)}</small></span>
        <span class="home-data-row-meta"><b>${status}</b><small>${escapeHtml(formatHomeRelativeTime(conversation.createdAt))}</small></span>
      </a>`;
    }).join('');
    sentList.setAttribute('aria-busy','false');
  }
}

document.getElementById('homePostedRequests').addEventListener('click',async event=>{
  const row=event.target.closest('[data-home-request-open]');
  if(!row)return;
  if(!await requestsReady)return;
  const request=requests.find(item=>item.id===row.dataset.homeRequestOpen);
  if(request){
    showRequestDetailPage(request);
    return;
  }
  history.replaceState(null,'','#requests');
  showClientView('requests');
  document.getElementById('requestsMessage').textContent='This request is no longer available. Review your full request list.';
});

async function loadHomeDashboard({showLoading=true}={}){
  const status=document.getElementById('homeMetricsStatus');
  if(showLoading)renderHomeDashboardLoading();
  try{
    const {data,error}=await window.devMatchBackend.client.functions.invoke('client-home',{
      body:{action:'dashboard'}
    });
    if(error)throw error;
    const result=data?.data;
    const metrics=result?.metrics;
    const metricKeys=['openRequests','newInquiries','awaitingDeveloperReply'];
    if(!metrics||metricKeys.some(key=>!Number.isSafeInteger(metrics[key])||metrics[key]<0)
      ||!Array.isArray(result.attention)
      ||result.attention.some(item=>!['inquiry','awaiting-reply','rate'].includes(item.type)
        ||typeof item.conversationId!=='string'||!item.conversationId)
      ||!Array.isArray(result.postedRequests)
      ||!Array.isArray(result.sentConversations)
      ||!result.gettingStarted
      ||['profileComplete','exploredProjects','postedRequest'].some(key=>typeof result.gettingStarted[key]!=='boolean')
      ||result.postedRequests.some(item=>!item||typeof item.id!=='string'||!['open','closed'].includes(item.status)
        ||!Number.isSafeInteger(item.inquiries)||item.inquiries<0)
      ||result.sentConversations.some(item=>!item||typeof item.conversationId!=='string'
        ||typeof item.projectId!=='string'||!item.projectId
        ||!['awaiting-reply','replied'].includes(item.status))){
      throw new Error('Dashboard service returned invalid data.');
    }
    renderHomeMetrics({...metrics,activeProjects:0});
    status.hidden=true;
    renderHomeAttention(result.attention);
    renderHomeRequestLists(result.postedRequests,result.sentConversations);
    renderHomeChecklist(result.gettingStarted);
  }catch(error){
    console.error('Unable to load client home data.',error);
    status.hidden=false;
    const retry=()=>void loadHomeDashboard();
    document.querySelector('.home-metrics').setAttribute('aria-busy','false');
    renderHomeMetrics({});
    renderHomeError(status,'Unable to load workspace summary.',retry);
    renderHomeError(document.getElementById('homeAttentionList'),'Unable to load updates.',retry);
    renderHomeError(document.getElementById('homePostedRequests'),'Unable to load your requests.',retry);
    renderHomeError(document.getElementById('homeSentConversations'),'Unable to load conversations about developer projects.',retry);
    const checklistSection=document.getElementById('homeGettingStarted');
    checklistSection.hidden=false;
    checklistSection.setAttribute('aria-busy','false');
    renderHomeError(document.getElementById('homeChecklist'),'Unable to load your checklist.',retry);
  }
}

async function loadHomeConversations(){
  const list=document.getElementById('homeConversationList');
  renderHomeLoading(list,'person',3);
  try{
    const {data,error}=await window.devMatchBackend.client.functions.invoke('chat-api',{
      body:{action:'list-dashboard-conversations',workspaceRole:'client'}
    });
    if(error)throw error;
    if(!data||!Array.isArray(data.data))throw new Error('Chat service returned an invalid conversation list.');
    const conversations=data.data.slice().sort((first,second)=>{
      const firstDate=Date.parse(first.last_message_at||first.updated_at||'');
      const secondDate=Date.parse(second.last_message_at||second.updated_at||'');
      return (Number.isFinite(secondDate)?secondDate:0)-(Number.isFinite(firstDate)?firstDate:0);
    }).slice(0,5);
    if(!conversations.length){
      renderHomeMessage(list,'No conversations yet. Browse projects to start a conversation.','Browse projects','devmatch-discover-projects.html');
      return;
    }
    list.innerHTML=conversations.map(conversation=>{
      const contact=conversation.contact||{};
      const name=String(contact.display_name||contact.username||'Unavailable account');
      const initials=name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'?';
      const message=conversation.last_message;
      const preview=message
        ?String(message.text||((message.attachments||[]).length?'Attachment':'Message')).slice(0,100)
        :'No messages yet';
      const timestamp=conversation.last_message_at||conversation.updated_at;
      const date=timestamp?new Date(timestamp):null;
      const time=date&&!Number.isNaN(date.getTime())
        ?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(date)
        :'';
      return `<a class="home-conversation-item" href="devmatch-chat.html?role=client&amp;conversation=${encodeURIComponent(conversation.id)}">
        <span class="home-conversation-avatar" aria-hidden="true">${escapeHtml(initials)}</span>
        <span class="home-conversation-copy"><b>${escapeHtml(name)}</b><small>${escapeHtml(preview)}</small></span>
        <time>${escapeHtml(time)}</time>
      </a>`;
    }).join('');
    list.setAttribute('aria-busy','false');
  }catch(error){
    console.error('Unable to load recent conversations for the client dashboard.',error);
    renderHomeError(list,'Unable to load recent conversations.',()=>void loadHomeConversations());
  }
}

window.addEventListener('devmatch:project-favorite-change',event=>{
  const change=event.detail;
  if(!change||typeof change.projectId!=='string'||typeof change.saved!=='boolean')return;
  favoritesRevision++;
  favorites=Array.isArray(change.favorites)
    ?[...new Set(change.favorites.filter(id=>typeof id==='string'))]
    :change.saved
      ?[...new Set([...favorites,change.projectId])]
      :favorites.filter(id=>id!==change.projectId);
  localStorage.setItem(favoritesKey,JSON.stringify(favorites));
  renderProjects();
  window.DEVMATCH_NAV_BADGES?.updateFavorites();
});

async function loadPublicProjects(){
  marketplaceLoaded=false;
  marketplaceFailed=false;
  renderHomeProjects();
  pageSkeletons?.cards(discoverGrid,4,'dashboard-project');
  pageSkeletons?.text(document.getElementById('discoverProjectCount'),'Loading project count','24px');
  pageSkeletons?.text(document.getElementById('discoverResultsCount'),'Loading project count','82px');
  try{
    const user=await window.devMatchBackend.ready;
    if(!user)throw new Error('Sign in to browse published projects.');
    const client=window.devMatchBackend.client;
    const {data:rows,error}=await client.from('projects')
      .select('id,owner_id,title,project_type,category,price,cover_image,status,data,created_at,updated_at')
      .eq('project_kind','portfolio')
      .eq('status','published')
      .order('updated_at',{ascending:false});
    if(error)throw error;
    const ownerIds=[...new Set((rows||[]).map(row=>row.owner_id).filter(Boolean))];
    let peopleById=new Map();
    if(ownerIds.length){
      const {data:people,error:peopleError}=await client.from('directory_people')
        .select('id,display_name,username,account_role,profile_data')
        .eq('account_role','dev')
        .in('id',ownerIds);
      if(peopleError)throw peopleError;
      peopleById=new Map((people||[]).map(person=>[person.id,person]));
    }
    marketplaceProjects=(rows||[]).map(row=>{
      const data=row.data&&typeof row.data==='object'&&!Array.isArray(row.data)?row.data:{};
      const person=peopleById.get(row.owner_id);
      const profile=person?.profile_data&&typeof person.profile_data==='object'?person.profile_data:{};
      const displayName=String(person?.display_name||'DEV-MATCH member');
      const specialtyValues=Array.isArray(data.specialties)?data.specialties
        :Array.isArray(profile.specialty)?profile.specialty
          :String(data.specialty||profile.specialty||'').split(/[,\n]/);
      const specialties=[...new Set(specialtyValues.map(value=>String(value).trim()).filter(Boolean))];
      const createdAt=new Date(row.created_at||row.updated_at||Date.now());
      const rawPrice=String(row.price||data.price||data.budgetLabel||data.budget||'');
      return {
        ...data,
        id:row.id,
        title:String(row.title||data.title||'Untitled project'),
        type:String(row.project_type||data.projectType||data.type||'Project'),
        category:String(row.category||data.category||'Other'),
        description:String(data.description||data.overview||''),
        specialty:specialties[0]||'',
        specialties,
        price:rawPrice||'Contact for pricing',
        developer:displayName,
        handle:person?.username?`@${String(person.username).replace(/^@/,'')}`:'',
        initials:(displayName.match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'DM',
        location:[profile.city,profile.country].filter(Boolean).join(', ')||'Location not provided',
        age:Number.isNaN(createdAt.getTime())
          ?'Recently published'
          :new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(createdAt),
        coverImage:safeProjectCover(row.cover_image||data.coverImage),
        art:'dashboard-art'
      };
    });
    marketplaceFailed=false;
  }catch(error){
    console.error('Unable to load published projects from Supabase.',error);
    marketplaceProjects=[];
    marketplaceFailed=true;
  }finally{
    marketplaceLoaded=true;
    renderProjects();
  }
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
  document.getElementById('requestStatViews').textContent=formatDashboardMetric(requestDashboardMetrics?.views);
  document.getElementById('requestStatSaves').textContent=formatDashboardMetric(requestDashboardMetrics?.favorites);
  document.getElementById('requestStatComments').textContent=formatDashboardMetric(requestDashboardMetrics?.comments);
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
  document.getElementById('requestShowingCount').textContent=`Showing ${filtered.length} projects`;
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
    const negotiableBadge=request.negotiable===true?'<span class="request-card-tag">Negotiable</span>':'';
    return `<article class="request-item request-card" data-request-card="${escapeHtml(request.id)}">
      <div class="request-card-topline"><div class="request-card-badges"><span class="request-status ${status}">${status}</span><span class="request-card-tag">${escapeHtml(category)}</span><span class="request-card-tag">${escapeHtml(type)}</span></div>
      <div class="request-card-menu"><details><summary aria-label="More actions for request">•••</summary><div><button type="button" data-request-action="${moreAction}" data-request-id="${escapeHtml(request.id)}">${moreLabel}</button>${status!=='draft'?`<button type="button" data-request-action="draft" data-request-id="${escapeHtml(request.id)}">Save as draft</button>`:''}<button class="danger" type="button" data-request-action="delete" data-request-id="${escapeHtml(request.id)}">Delete request</button></div></details></div></div>
      <h2>${escapeHtml(request.title||'Untitled request')}</h2>
      <div class="request-card-facts"><div><small>BUDGET</small><b class="request-card-budget-value">${escapeHtml(budget)}${negotiableBadge}</b></div><div><small>DEADLINE</small><b>${deadline?escapeHtml(formatDeadline(request.deadline)):'Not set'}${daysLeft===null?'':` · ${escapeHtml(deadlineNote)}`}</b></div><div><small>REQUIRED</small><span>${specialties.length?specialties.map(specialty=>`<i>${escapeHtml(specialty)}</i>`).join(''):'Not specified'}</span></div></div>
      <footer class="request-card-footer"><span class="request-card-metrics"><span>◉ ${views}</span><span>♡ ${saves}</span><span>▢ ${comments}</span>${referenceCount?`<span class="request-card-new">${referenceCount} ref</span>`:''}</span><div class="request-card-actions"><button type="button" class="request-card-secondary request-edit-button" data-edit-request="${escapeHtml(request.id)}">Edit</button></div></footer>
    </article>`;
  }).join('');
}

async function handleProjectGridClick(event){
  const openButton=event.target.closest('[data-project-open]');
  if(openButton){
    window.openProjectDetails(openButton.dataset.projectOpen);
    return;
  }
  const button=event.target.closest('[data-favorite]');
  if(button){
    const authenticated=await favoriteStateReady;
    if(authenticated===null)return;
    const id=button.dataset.favorite;
    const saved=favorites.includes(id);
    if(saved){
      const project=marketplaceProjects.find(item=>item.id===id);
      if(!project||!await window.DEVMATCH_FAVORITE_FEEDBACK.confirmRemoval(
        document.getElementById('favoriteRemoveDialog'),
        document.getElementById('favoriteRemoveMessage'),
        project.title
      ))return;
    }
    if(authenticated){
      try{
        await window.devMatchBackend.setFavorite('project',id,!saved);
      }catch(error){
        console.error('Unable to update project favorite in Supabase.',error);
        window.alert('Unable to save this favorite. Please try again.');
        return;
      }
    }
    favorites=saved?favorites.filter(item=>item!==id):[...favorites,id];
    localStorage.setItem(favoritesKey,JSON.stringify(favorites));
    renderProjects();
    window.DEVMATCH_NAV_BADGES?.updateFavorites();
    window.DEVMATCH_FAVORITE_FEEDBACK.showToast(
      document.getElementById('favoriteActionToast'),
      saved?'Project removed from your favorites':'Project added to your favorites',
      saved?async()=>{
        try{
          if(authenticated)await window.devMatchBackend.setFavorite('project',id,true);
        }catch(error){
          console.error('Unable to restore project favorite in Supabase.',error);
          window.alert('Unable to restore this favorite. Please try again.');
          return false;
        }
        if(!favorites.includes(id))favorites=[...favorites,id];
        localStorage.setItem(favoritesKey,JSON.stringify(favorites));
        renderProjects();
        window.DEVMATCH_NAV_BADGES?.updateFavorites();
        return true;
      }:null,
      saved ? null : {tab: 'projects'}
    );
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
[discoverGrid,homeRecommendedGrid,homeSavedList].forEach(projectGrid=>{
  projectGrid.addEventListener('click',handleProjectGridClick);
  projectGrid.addEventListener('keydown',handleProjectGridKeydown);
});
function searchProjects(value,preserveFilters=false){
  activeQuery=value.trim().toLowerCase();
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
  document.getElementById('discoverSearchInput').value=value;
  renderProjects();
}
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
  const viewingDetail=view==='request-detail';
  const viewingRequests=view==='requests'||viewingDetail;
  const viewingHome=!discovering&&!composingRequest&&!viewingRequests&&!viewingDetail;
  document.body.classList.toggle('request-composer-open',composingRequest);
  document.body.classList.toggle('client-requests-view',view==='requests');
  document.getElementById('discover').hidden=!discovering;
  document.getElementById('homeDashboard').hidden=!viewingHome;
  document.getElementById('requests').hidden=!viewingRequests;
  document.getElementById('requestDetailPage').hidden=!viewingDetail;
  document.getElementById('requestComposer').hidden=!composingRequest;
  document.querySelectorAll('.client-nav-item').forEach(item=>{
    const active=discovering
    ?item.dataset.navKey==='discover'||item.hasAttribute('data-discover-nav')
    :composingRequest
      ?item.hasAttribute('data-request-nav')
      :viewingRequests||viewingDetail
        ?item.hasAttribute('data-request-nav')
        :(item.dataset.mobileClientView==='home'||item.getAttribute('href')==='#home');
    item.classList.toggle('active',active);
    if(active)item.setAttribute('aria-current','page');
    else item.removeAttribute('aria-current');
  });
  window.DEVMATCH_SIDEBAR_NAVIGATION?.updateMobileBottomNavigationIndicator();
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
document.querySelectorAll('.client-nav-item[data-request-nav]:not(.mobile-bottom-nav__item)').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();
  history.replaceState(null,'','#requests');
  showClientView('requests');
}));
document.addEventListener('click',event=>{
  if(event.defaultPrevented||!(event.target instanceof Element))return;
  const link=event.target.closest('.mobile-bottom-nav [data-mobile-client-view="home"],.mobile-bottom-nav [data-mobile-client-view="requests"]');
  if(!link)return;
  const view=link.dataset.mobileClientView;
  event.preventDefault();
  history.replaceState(null,'',view==='requests'?'#requests':'#home');
  showClientView(view);
});
document.querySelectorAll('.client-nav-item[data-favorites-filter]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();
  showClientView('home');
  document.querySelectorAll('.client-nav-item').forEach(item=>{
    const active=item===link;
    item.classList.toggle('active',active);
    if(active)item.setAttribute('aria-current','page');
    else item.removeAttribute('aria-current');
  });
  if(link.hasAttribute('data-favorites-filter')){
    document.getElementById('homeSavedSection').scrollIntoView({behavior:'smooth',block:'center'});
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
  const attachments=[...retainedAttachments.filter(item=>!removedAttachmentIds.has(item.path)).map(item=>({name:item.name,path:item.path,source:'saved'})),...pendingReferenceFiles.map((file,index)=>({name:file.name,index,source:'pending'}))];
  list.hidden=attachments.length===0;
  list.replaceChildren(...attachments.map(attachment=>{
    const item=document.createElement('li');
    const name=document.createElement('span');
    name.textContent=attachment.name;
    const remove=document.createElement('button');
    remove.type='button';
    remove.dataset.removeAttachment=attachment.source==='saved'?attachment.path:String(attachment.index);
    remove.dataset.attachmentSource=attachment.source;
    remove.setAttribute('aria-label',`Remove ${attachment.name}`);
    remove.textContent='×';
    item.append(name,remove);
    return item;
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
  const referenceCount=request.references.length+retainedAttachments.filter(item=>!removedAttachmentIds.has(item.path)).length+pendingReferenceFiles.length;
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
  const savedAttachments=Array.isArray(request?.attachments)?request.attachments:[];
  const legacyAttachmentCount=savedAttachments.filter(item=>!item||typeof item.path!=='string'||!item.path).length;
  retainedAttachments=savedAttachments.filter(item=>item&&typeof item.path==='string'&&item.path);
  removedAttachmentIds=new Set();
  document.getElementById('requestPageTitle').textContent=request?'Edit project request':'Post a project request';
  document.querySelector('[data-post-request]').innerHTML=request?'Update Project Request <svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h20M17 8l5 4-5 4"/></svg>':'Post Project Request <svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h20M17 8l5 4-5 4"/></svg>';
  document.getElementById('requestComposerMessage').textContent=legacyAttachmentCount
    ?'Some older attachments were saved only in this browser and are no longer available. Reattach them if needed.'
    :'';
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
    requestForm.elements.budgetFrom.value=window.devMatchMoneyInput.format(request.budgetFrom||'');
    requestForm.elements.budgetTo.value=window.devMatchMoneyInput.format(request.budgetTo||'');
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
async function renderPrivateAttachmentLinks(request,container,statusElement,unavailableMessage){
  const attachments=Array.isArray(request.attachments)?request.attachments:[];
  container.dataset.requestId=String(request.id);
  container.replaceChildren();
  statusElement.hidden=true;
  if(!attachments.length)return;
  pageSkeletons?.status(statusElement,'Loading reference files',1);
  statusElement.hidden=false;
  const unavailable=[];
  await Promise.all(attachments.map(async attachment=>{
    const item=document.createElement(container.tagName==='UL'?'li':'div');
    container.append(item);
    if(!attachment||typeof attachment.path!=='string'||!attachment.path){
      item.textContent=unavailableMessage;
      unavailable.push(attachment?.name||'attachment');
      return;
    }
    pageSkeletons?.text(item,`Loading ${attachment.name||'reference file'}`,'64%');
    try{
      const url=await window.devMatchBackend.createPrivateFileUrl(attachment.path,attachment.name);
      if(container.dataset.requestId!==String(request.id))return;
      const link=document.createElement('a');
      link.href=url;
      link.target='_blank';
      link.rel='noopener noreferrer';
      link.textContent=attachment.name||'Download reference file';
      item.replaceChildren(link);
    }catch(error){
      console.error('Unable to create a private reference-file link.',error);
      if(container.dataset.requestId!==String(request.id))return;
      item.textContent=`${attachment.name||'Reference file'} — unavailable`;
      unavailable.push(attachment.name||'attachment');
    }
  }));
  if(container.dataset.requestId!==String(request.id))return;
  statusElement.textContent=unavailable.length
    ?'Some reference files are unavailable to your account.'
    :'Files are private and available only to authorized viewers.';
  statusElement.hidden=unavailable.length===0;
}
function showRequestDetails(request){
  const dialog=document.getElementById('requestViewDialog');
  activeRequestViewId=request.id;
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
  const attachmentStatus=document.getElementById('requestViewAttachmentStatus');
  renderPrivateAttachmentLinks(
    request,
    attachmentList,
    attachmentStatus,
    'This older attachment is no longer available. Ask the owner to reattach it.'
  );
  referenceSection.hidden=!linkContainer.children.length&&!(request.attachments||[]).length;
  document.getElementById('requestViewStatus').textContent=`${Number(request.views)||0} views · ${Number(request.saves??request.favorites)||0} saved · ${Number(request.commentCount??request.comments)||0} comments`;
  dialog.showModal();
}
function renderRequestDetailProjectFacts(request,{category,type}){
  const container=document.getElementById('requestDetailProjectFacts');
  const created=Number(request.created);
  const createdLabel=Number.isFinite(created)&&created>0
    ?new Date(created).toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric'})
    :'Not available';
  const references=Array.isArray(request.references)?request.references:[];
  const facts=[
    ['Project type',type==='Project type not set'?'Not provided':type],
    ['Category',category==='Category not selected'?'Not provided':category],
    ['Target start',request.targetStart?formatMonth(request.targetStart):'Not provided'],
    ['Reference links',references],
    ['Created',createdLabel]
  ];
  container.replaceChildren();
  facts.forEach(([label,value])=>{
    const row=document.createElement('div');
    const term=document.createElement('dt');
    const description=document.createElement('dd');
    term.textContent=label;
    if(label==='Reference links'){
      value.forEach(reference=>{
        try{
          const url=new URL(reference);
          if(!['http:','https:'].includes(url.protocol))return;
          const link=document.createElement('a');
          link.href=url.href;
          link.target='_blank';
          link.rel='noopener noreferrer';
          link.textContent=url.hostname+url.pathname;
          description.append(link);
        }catch(error){
          console.warn('Skipping an invalid project request reference link.',error);
        }
      });
      if(!description.childElementCount)description.textContent='Not provided';
    }else{
      description.textContent=value;
    }
    row.append(term,description);
    container.append(row);
  });
}
async function showRequestDetailPage(request,{preserveScroll=false,focusComments=false}={}){
  const detailDialog=document.getElementById('requestDetailPage');
  const previousScrollTop=detailDialog.scrollTop;
  if(activeRequestDetailId!==request.id)expandedRequestCommentReplies.clear();
  activeRequestDetailId=request.id;
  let currentUserId=null;
  let repliesSupported=true;
  let commentsLoadFailed=false;
  try{
    const user=await window.devMatchBackend.ready;
    currentUserId=user?.id||null;
  }catch(error){
    console.error('Unable to verify the current account for request replies.',error);
  }
  let comments=[];
  try{
    const result=await window.devMatchBackend.loadProjectComments(request.id);
    comments=result.comments;
    repliesSupported=result.repliesSupported;
  }catch(error){
    console.error('Unable to load project request comments from Supabase.',error);
    commentsLoadFailed=true;
  }
  if(activeRequestDetailId!==request.id)return;
  let commenterRoles=new Map();
  try{commenterRoles=await window.devMatchBackend.loadCommentAuthorRoles(comments);}
  catch(error){console.error('Unable to load request commenter profiles from Supabase.',error);}
  const profileLink=(comment,node,className)=>{
    const href=window.devMatchBackend.publicProfileUrl(comment.userId,comment.workspaceRole||commenterRoles.get(comment.userId));
    if(!href)return node;
    const link=document.createElement('a');
    link.className=className;
    link.href=href;
    link.setAttribute('aria-label',`View ${comment.name||'member'} profile`);
    link.append(node);
    return link;
  };
  const name=clientProfile.displayName||'Client';
  const initials=name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CL';
  const location=[clientProfile.city,clientProfile.country].filter(Boolean).join(', ')||'Indonesia';
  const status=request.status==='open'||request.status==='closed'?request.status:'draft';
  const category=request.category==='Other'&&request.categoryOther?`Other · ${request.categoryOther}`:request.category||'Category not selected';
  const type=request.projectType==='Other'&&request.projectTypeOther?`Other · ${request.projectTypeOther}`:request.projectType||'Project type not set';
  const specialties=(request.specialties||[]).map(specialty=>specialty==='Other'&&request.specialtyOther?`Other · ${request.specialtyOther}`:specialty);
  const views=Number(request.views)||0;
  const saves=Number(request.saves??request.favorites)||0;
  const commentCount=comments.length;
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
  const detailAttachments=document.getElementById('requestDetailAttachments');
  const detailAttachmentStatus=document.getElementById('requestDetailAttachmentStatus');
  document.getElementById('requestDetailReferences').hidden=!(request.attachments||[]).length;
  renderPrivateAttachmentLinks(
    request,
    detailAttachments,
    detailAttachmentStatus,
    'This older attachment is no longer available. Ask the owner to reattach it.'
  );
  document.getElementById('requestDetailBudget').textContent=request.budgetFrom&&request.budgetTo
    ?`${formatRequestMoney(request.budgetFrom)} — ${formatRequestMoney(request.budgetTo)}`
    :request.budget||'Not set';
  const negotiableBadge=document.getElementById('requestDetailNegotiable');
  negotiableBadge.hidden=request.negotiable!==true;
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
  renderRequestDetailProjectFacts(request,{category,type});
  document.getElementById('requestDetailCommentCount').textContent=String(commentCount);
  const commentsList=document.getElementById('requestDetailCommentsList');
  const commentsStatus=document.getElementById('requestDetailCommentsStatus');
  commentsStatus.hidden=!commentsLoadFailed&&repliesSupported;
  if(commentsLoadFailed)commentsStatus.textContent='Unable to load comments. Check your connection and try again.';
  else if(!repliesSupported)commentsStatus.textContent='Comments are visible, but replies require the latest database migration.';
  const commentSort=document.getElementById('requestDetailCommentSort');
  const formatCommentTime=value=>{
    if(typeof value!=='string'||!value)return '';
    const date=new Date(value);
    return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date);
  };
  const renderRequestDetailComments=()=>{
    commentsList.replaceChildren();
    const ordered=[...comments].sort((a,b)=>{
      const aTime=Date.parse(a.time)||0;
      const bTime=Date.parse(b.time)||0;
      return commentSort.value==='newest'?bTime-aTime:aTime-bTime;
    });
    const commentsByParent=new Map();
    ordered.forEach(comment=>{
      const parentId=comment.parentCommentId||null;
      if(!commentsByParent.has(parentId))commentsByParent.set(parentId,[]);
      commentsByParent.get(parentId).push(comment);
    });
    const commentById=new Map(comments.map(comment=>[comment.id,comment]));
    const collectDescendants=commentId=>{
      const descendants=[];
      const visit=commentsByParent.get(commentId)||[];
      visit.forEach(reply=>{
        descendants.push(reply);
        descendants.push(...collectDescendants(reply.id));
      });
      return descendants;
    };
    const appendComment=(comment,parentContainer,isRoot=false)=>{
      const thread=document.createElement('div');
      thread.className='request-detail-comment-thread';
      const item=document.createElement('article');
      item.className='request-detail-comment comment-system-item';
      item.dataset.commentId=comment.id;
      const authorRow=document.createElement('div');
      authorRow.className='request-detail-comment-author comment-system-author';
      const avatar=document.createElement('span');
      avatar.className='request-detail-avatar comment-system-avatar';
      avatar.textContent=comment.initials||String(comment.name||'Member').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();
      const avatarLink=profileLink(comment,avatar,'comment-profile-avatar-link');
      const author=document.createElement('strong');
      author.textContent=comment.name||'Member';
      authorRow.append(profileLink(comment,author,'comment-profile-name-link'));
      const role=comment.workspaceRole||commenterRoles.get(comment.userId);
      if(role==='dev'||role==='client'){
        const roleBadge=document.createElement('small');
        roleBadge.className='request-detail-comment-role comment-system-role';
        roleBadge.textContent=role==='dev'?'Developer':'Client';
        authorRow.append(roleBadge);
      }
      if(!isRoot&&comment.parentCommentId){
        const parentComment=commentById.get(comment.parentCommentId);
        const replyTarget=document.createElement('small');
        replyTarget.className='request-detail-comment-reply-target comment-system-target';
        const parentRole=parentComment?.workspaceRole||commenterRoles.get(parentComment?.userId);
        replyTarget.innerHTML='';
        const arrow=document.createElement('span');
        arrow.className='request-detail-comment-reply-arrow comment-system-target-arrow';
        arrow.textContent='▸';
        const name=document.createElement('span');
        name.className='request-detail-comment-reply-name comment-system-target-name';
        name.textContent=parentComment?.name||'Member';
        replyTarget.append(arrow,document.createTextNode(' '),name);
        if(parentRole==='dev'||parentRole==='client'){
          const roleBadge=document.createElement('small');
          roleBadge.className='request-detail-comment-role comment-system-role';
          roleBadge.textContent=parentRole==='dev'?'Developer':'Client';
          replyTarget.append(document.createTextNode(' '),roleBadge);
        }
        authorRow.append(replyTarget);
      }
      const message=document.createElement('p');
      message.className='comment-system-text';
      message.textContent=comment.text||'';
      const body=document.createElement('div');
      body.className='comment-system-body';
      body.append(authorRow,message);
      item.append(avatarLink,body);
      const actions=document.createElement('div');
      actions.className='comment-system-actions';
      const time=document.createElement('time');
      time.className='comment-system-time';
      time.dateTime=comment.time||'';
      time.textContent=formatCommentTime(comment.time);
      actions.append(time);
      if(repliesSupported&&currentUserId&&comment.userId!==currentUserId){
        const replyButton=document.createElement('button');
        replyButton.className='request-detail-comment-reply-toggle comment-system-reply';
        replyButton.type='button';
        replyButton.dataset.commentReplyToggle='';
        replyButton.setAttribute('aria-expanded','false');
        replyButton.textContent='Reply';
        const form=document.createElement('form');
        form.className='request-detail-comment-reply-form comment-system-reply-form';
        form.dataset.commentReplyForm='';
        form.dataset.parentCommentId=comment.id;
        form.hidden=true;
        const input=document.createElement('textarea');
        input.maxLength=1000;
        input.required=true;
        input.placeholder='Write a reply…';
        input.id=`request-detail-reply-${comment.id}`;
        input.setAttribute('aria-label',`Reply to ${comment.name||'member'}`);
        input.addEventListener('keydown',event=>{
          if(event.key!=='Enter'||event.shiftKey||event.isComposing||event.keyCode===229)return;
          event.preventDefault();
          if(!event.repeat&&!submit.disabled)form.requestSubmit();
        });
        const label=document.createElement('label');
        label.htmlFor=input.id;
        label.textContent='Reply';
        const compose=document.createElement('div');
        compose.className='request-detail-comment-reply-compose';
        const submit=document.createElement('button');
        submit.type='submit';
        submit.setAttribute('aria-label','Send reply');
        submit.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22 2 11 13M22 2 15 22 11 13 2 9 22 2"/></svg>';
        compose.append(input,submit);
        const status=document.createElement('p');
        status.className='request-detail-comment-reply-status';
        status.setAttribute('role','status');
        status.setAttribute('aria-live','polite');
        status.hidden=true;
        form.append(label,compose,status);
        actions.append(replyButton);
        body.append(form);
      }
      body.append(actions);
      thread.append(item);
      const replies=isRoot?collectDescendants(comment.id):[];
      if(replies.length){
        const replyList=document.createElement('div');
        replyList.className='request-detail-comment-replies comment-system-replies';
        replyList.hidden=!expandedRequestCommentReplies.has(comment.id);
        const replyToggle=document.createElement('button');
        replyToggle.className='request-detail-comment-replies-toggle comment-system-view-replies';
        replyToggle.type='button';
        replyToggle.dataset.commentRepliesToggle='';
        replyToggle.dataset.replyCount=String(replies.length);
        replyToggle.setAttribute('aria-expanded',String(!replyList.hidden));
        replyToggle.textContent=replyList.hidden
          ?`View ${replies.length} ${replies.length===1?'reply':'replies'}`
          :'Hide replies';
        replies.forEach(reply=>appendComment(reply,replyList,false));
        if(replyList.hidden)thread.append(replyToggle,replyList);
        else thread.append(replyList,replyToggle);
      }
      parentContainer.append(thread);
    };
    (commentsByParent.get(null)||[]).forEach(comment=>appendComment(comment,commentsList,true));
    document.getElementById('requestDetailCommentsEmpty').hidden=comments.length>0||commentCount>0;
    if(commentCount>comments.length){
      const note=document.createElement('p');
      note.className='request-detail-comment-note';
      note.textContent=`${commentCount} comment${commentCount===1?'':'s'} recorded. Full discussion is not available in this browser yet.`;
      commentsList.append(note);
    }
  };
  commentSort.onchange=renderRequestDetailComments;
  renderRequestDetailComments();
  const commenters=new Map(comments
    .filter(comment=>comment.userId!==currentUserId)
    .map(comment=>[comment.userId||comment.name,comment]));
  const commentersList=document.getElementById('requestDetailCommentersList');
  commentersList.replaceChildren();
  commenters.forEach(entry=>{
    const person=document.createElement('div');
    person.className='request-detail-commenter';
    const avatar=document.createElement('span');
    avatar.className='request-detail-avatar';
    avatar.textContent=entry.initials||String(entry.name).trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
    const personName=document.createElement('strong');
    personName.textContent=entry.name;
    person.append(
      profileLink(entry,avatar,'comment-profile-avatar-link'),
      profileLink(entry,personName,'comment-profile-name-link')
    );
    commentersList.append(person);
  });
  document.getElementById('requestDetailCommentersEmpty').hidden=commenters.size>0;
  renderRequestDetailClientMetrics();
  const statusButton=document.querySelector('[data-detail-status-action]');
  statusButton.textContent=status==='open'?'Close request':status==='closed'?'Reopen request':'Publish request';
  statusButton.dataset.nextStatus=status==='open'?'closed':'open';
  history.replaceState(null,'',`#request-detail/${encodeURIComponent(request.id)}`);
  showClientView('request-detail');
  if(!detailDialog.open)detailDialog.showModal();
  detailDialog.scrollTop=preserveScroll?previousScrollTop:0;
  if(focusComments){
    document.getElementById('requestDetailComments').scrollIntoView({behavior:'smooth',block:'start'});
  }
}
async function updateRequestStatus(requestId,status){
  if(!await requestsReady)return;
  const updatedRequest=requests.find(request=>request.id===requestId);
  if(!updatedRequest)return;
  const changedRequest={...updatedRequest,status,updated:Date.now()};
  try{
    await window.devMatchBackend.saveOwnedProject('request',changedRequest);
  }catch(error){
    console.error('Unable to update the project request in Supabase.',error);
    document.getElementById('requestsMessage').textContent='Could not update this request. Check your connection and try again.';
    return;
  }
  const updatedRequests=requests.map(request=>request.id===requestId?changedRequest:request);
  try{
    localStorage.setItem(requestsKey,JSON.stringify(updatedRequests));
  }catch(error){
    console.error('Unable to update the project request status.',error);
    document.getElementById('requestsMessage').textContent='Could not update this request. Browser storage may be full.';
    return;
  }
  requests=updatedRequests;
  document.getElementById('requestsMessage').textContent=status==='closed'
    ?'Request closed. You can reopen it anytime.'
    :status==='draft'
      ?'Request saved as a draft.'
      :'Request reopened.';
  renderRequests();
  if(activeRequestDetailId===requestId){
    const updatedRequest=requests.find(request=>request.id===requestId);
    if(updatedRequest)showRequestDetailPage(updatedRequest);
  }
}
async function deleteRequest(requestId){
  if(!await requestsReady)return;
  const request=requests.find(item=>item.id===requestId);
  if(!request||!window.confirm(`Delete "${request.title||'this request'}"? This cannot be undone.`))return;
  try{
    await window.devMatchBackend.deleteOwnedProject('request',requestId);
  }catch(error){
    console.error('Unable to delete the project request from Supabase.',error);
    document.getElementById('requestsMessage').textContent='Could not delete this request. Check your connection and try again.';
    return;
  }
  const updatedRequests=requests.filter(item=>item.id!==requestId);
  requests=updatedRequests;
  try{
    localStorage.setItem(requestsKey,JSON.stringify(updatedRequests));
  }catch(error){
    console.warn('The request was deleted from Supabase, but its local cache could not be updated.',error);
  }
  document.getElementById('requestsMessage').textContent='Request deleted.';
  renderRequests();
  if(activeRequestDetailId===requestId){
    activeRequestDetailId=null;
    const detailDialog=document.getElementById('requestDetailPage');
    if(detailDialog.open)detailDialog.close();
    history.replaceState(null,'','#requests');
    showClientView('requests');
  }
  const attachmentPaths=(request.attachments||[]).map(attachment=>attachment?.path).filter(path=>typeof path==='string'&&path);
  if(attachmentPaths.length){
    try{
      await window.devMatchBackend.removeUploadedFiles('private-uploads',attachmentPaths);
    }catch(error){
      console.error('Unable to remove deleted request attachments from Supabase Storage.',error);
      document.getElementById('requestsMessage').textContent='Request deleted, but some reference files could not be removed from storage.';
    }
  }
}
async function saveRequest(status){
  if(!await requestsReady){
    document.getElementById('requestComposerMessage').textContent='Your account requests are not ready to save. Reload the page and try again.';
    return;
  }
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
  const savedAttachments=retainedAttachments.filter(item=>!removedAttachmentIds.has(item.path));
  const totalAttachments=savedAttachments.length+pendingReferenceFiles.length;
  if(totalAttachments>5){
    message.textContent='Attach no more than 5 reference files.';
    return;
  }
  const supportedTypes=new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]);
  if(pendingReferenceFiles.some(file=>!supportedTypes.has(file.type)||file.size>10*1024*1024)){
    message.textContent='Use PDF, DOC, DOCX, JPG, PNG, or WebP files no larger than 10 MB each.';
    return;
  }
  if(savingRequest)return;
  savingRequest=true;
  document.querySelectorAll('[data-save-request-draft],[data-post-request]').forEach(button=>{button.disabled=true;});
  const saveDraftButton=document.querySelector('[data-save-request-draft]');
  const postButton=document.querySelector('[data-post-request]');
  message.textContent='Saving request…';
  const {referenceFiles,...requestData}=data;
  const removedPaths=[...removedAttachmentIds].filter(path=>typeof path==='string'&&path);
  const request={...requestData,attachments:savedAttachments,id:editingRequestId||'',status,updated:Date.now()};
  try{
    request.id=await window.devMatchBackend.saveOwnedProject('request',request);
  }catch(error){
    console.error('Unable to save the project request to Supabase.',error);
    message.textContent='Could not save this request. Check your connection and try again.';
    savingRequest=false;
    document.querySelectorAll('[data-save-request-draft],[data-post-request]').forEach(button=>{button.disabled=false;});
    return;
  }
  const updatedRequests=[...requests];
  const existingIndex=updatedRequests.findIndex(item=>item.id===request.id);
  if(existingIndex>=0)updatedRequests[existingIndex]=request;
  else updatedRequests.unshift(request);
  requests=updatedRequests;
  try{
    localStorage.setItem(requestsKey,JSON.stringify(updatedRequests));
  }catch(error){
    console.warn('The request was saved to Supabase, but its local cache could not be updated.',error);
  }
  renderRequests();
  editingRequestId=request.id;
  retainedAttachments=savedAttachments;
  removedAttachmentIds.clear();

  let cleanupWarning=false;
  if(removedPaths.length){
    try{
      await window.devMatchBackend.removeUploadedFiles('private-uploads',removedPaths);
    }catch(error){
      cleanupWarning=true;
      console.error('Unable to remove deleted reference files from Supabase Storage.',error);
    }
  }

  if(pendingReferenceFiles.length){
    const uploaded=[];
    try{
      message.textContent='Uploading reference files…';
      for(const file of pendingReferenceFiles){
        uploaded.push(await window.devMatchBackend.uploadPrivateFile('request',request.id,file));
      }
      const requestWithAttachments={...request,attachments:[...savedAttachments,...uploaded],updated:Date.now()};
      await window.devMatchBackend.saveOwnedProject('request',requestWithAttachments);
      request.attachments=requestWithAttachments.attachments;
      request.updated=requestWithAttachments.updated;
      const withAttachments=requests.map(item=>item.id===request.id?request: item);
      requests=withAttachments;
      try{
        localStorage.setItem(requestsKey,JSON.stringify(withAttachments));
      }catch(error){
        console.warn('Reference files are saved, but the local request cache could not be updated.',error);
      }
      renderRequests();
      retainedAttachments=request.attachments;
    }catch(error){
      console.error('Unable to save reference files to Supabase Storage.',error);
      let cleanupFailed=false;
      if(uploaded.length){
        try{
          await window.devMatchBackend.removeUploadedFiles('private-uploads',uploaded.map(file=>file.path));
        }catch(cleanupError){
          cleanupFailed=true;
          console.error('Unable to clean up uploaded request files after the database update failed.',cleanupError);
        }
      }
      message.textContent=cleanupFailed
        ?'The request was saved, but its attachments could not be saved or cleaned up. Please contact support before retrying.'
        :cleanupWarning
          ?'The request was saved, but its attachments could not be saved and some removed files could not be deleted. Try again.'
          :'The request was saved, but its attachments could not be saved. Check your connection and try again.';
      savingRequest=false;
      document.querySelectorAll('[data-save-request-draft],[data-post-request]').forEach(button=>{button.disabled=false;});
      return;
    }
  }
  if(saveDraftButton)saveDraftButton.disabled=false;
  if(postButton)postButton.disabled=false;
  savingRequest=false;
  pendingReferenceFiles=[];
  retainedAttachments=[...(request.attachments||[])];
  removedAttachmentIds.clear();
  renderReferenceAttachments();
  if(cleanupWarning)document.getElementById('requestsMessage').textContent='Request saved, but some removed files could not be deleted from storage.';
  editingRequestId=null;
  history.replaceState(null,'','#requests');
  showClientView('requests');
}
document.querySelectorAll('[data-open-request]').forEach(button=>button.addEventListener('click',()=>openRequestComposer()));
document.querySelectorAll('[data-back-to-requests]').forEach(button=>button.addEventListener('click',()=>{
  const detailDialog=document.getElementById('requestDetailPage');
  if(detailDialog.open)detailDialog.close();
  activeRequestDetailId=null;
  history.replaceState(null,'','#requests');
  showClientView('requests');
}));
document.getElementById('requestDetailPage').addEventListener('close',()=>{
  activeRequestDetailId=null;
  if(location.hash.startsWith('#request-detail/'))history.replaceState(null,'','#requests');
});
document.querySelector('[data-save-request-draft]').addEventListener('click',()=>saveRequest('draft'));
document.querySelector('[data-post-request]').addEventListener('click',()=>saveRequest('open'));
requestForm.addEventListener('input',updateRequestPreview);
requestForm.addEventListener('change',event=>{
  if(event.target.name==='category'||event.target.name==='specialties')syncConditionalFields();
  updateRequestPreview();
});
document.getElementById('requestReferenceFiles').addEventListener('change',event=>{
  const message=document.getElementById('requestComposerMessage');
  const files=[...event.target.files];
  event.target.value='';
  const currentCount=retainedAttachments.filter(item=>!removedAttachmentIds.has(item.path)).length+pendingReferenceFiles.length;
  const supportedTypes=new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]);
  const valid=files.filter(file=>supportedTypes.has(file.type)&&file.size<=10*1024*1024);
  if(valid.length!==files.length){
    message.textContent='Use PDF, DOC, DOCX, JPG, PNG, or WebP files no larger than 10 MB each.';
    return;
  }
  if(currentCount+valid.length>5){
    message.textContent='Attach no more than 5 reference files.';
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
  document.querySelectorAll('#requestFilterMenu [data-request-sort]').forEach(option=>{
    option.setAttribute('aria-checked',String(option.dataset.requestSort===event.target.value));
  });
  renderRequests();
});
const requestFilterTrigger=document.getElementById('requestFilterTrigger');
const requestFilterMenu=document.getElementById('requestFilterMenu');
function closeRequestFilterMenu(returnFocus=false){
  if(requestFilterMenu.matches(':popover-open'))requestFilterMenu.hidePopover();
  requestFilterTrigger.setAttribute('aria-expanded','false');
  if(returnFocus)requestFilterTrigger.focus();
}
requestFilterTrigger.addEventListener('click',()=>{
  if(requestFilterMenu.matches(':popover-open')){
    closeRequestFilterMenu();
    return;
  }
  requestFilterMenu.showPopover();
  const bounds=requestFilterTrigger.getBoundingClientRect();
  const menuBounds=requestFilterMenu.getBoundingClientRect();
  const width=Math.min(Math.max(bounds.width,190),window.innerWidth-20);
  const left=Math.max(10,Math.min(bounds.right-width,window.innerWidth-width-10));
  const top=window.innerHeight-bounds.bottom>=menuBounds.height+8
    ?bounds.bottom+6
    :Math.max(10,bounds.top-menuBounds.height-6);
  requestFilterMenu.style.left=`${left}px`;
  requestFilterMenu.style.top=`${top}px`;
  requestFilterMenu.style.width=`${width}px`;
  requestFilterTrigger.setAttribute('aria-expanded','true');
  requestFilterMenu.querySelector(`[data-request-filter="${activeRequestFilter}"]`)?.focus({preventScroll:true});
});
requestFilterMenu.addEventListener('click',event=>{
  const option=event.target.closest('[data-request-sort]');
  if(!option)return;
  const sort=document.getElementById('requestSort');
  sort.value=option.dataset.requestSort;
  sort.dispatchEvent(new Event('change',{bubbles:true}));
  closeRequestFilterMenu(true);
});
requestFilterMenu.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    event.preventDefault();
    closeRequestFilterMenu(true);
  }
});
requestFilterMenu.addEventListener('toggle',()=>{
  requestFilterTrigger.setAttribute('aria-expanded',String(requestFilterMenu.matches(':popover-open')));
});
document.addEventListener('pointerdown',event=>{
  if(requestFilterMenu.matches(':popover-open')&&!requestFilterMenu.contains(event.target)&&!requestFilterTrigger.contains(event.target)){
    closeRequestFilterMenu();
  }
});
window.addEventListener('resize',()=>closeRequestFilterMenu());
window.addEventListener('scroll',()=>closeRequestFilterMenu(),{capture:true,passive:true});
document.querySelectorAll('[data-request-filter]').forEach(button=>button.addEventListener('click',()=>{
  activeRequestFilter=button.dataset.requestFilter;
  document.getElementById('requestFilterLabel').textContent='Filter';
  document.querySelectorAll('#requestFilterMenu [data-request-filter]').forEach(option=>{
    option.setAttribute('aria-checked',String(option.dataset.requestFilter===activeRequestFilter));
  });
  if(requestFilterMenu.contains(button))closeRequestFilterMenu(true);
  renderRequests();
}));
const requestList=document.getElementById('requestList');
function closeRequestCardMenus(except=null){
  requestList.querySelectorAll('.request-card-menu details[open]').forEach(details=>{
    if(details!==except)details.open=false;
  });
}
document.addEventListener('click',event=>{
  if(!requestList.contains(event.target))closeRequestCardMenus();
});
requestList.addEventListener('click',event=>{
  const clickedMenu=event.target.closest('.request-card-menu details');
  const openedMenu=requestList.querySelector('.request-card-menu details[open]');
  if(openedMenu&&openedMenu!==clickedMenu){
    closeRequestCardMenus();
    const clickedCard=event.target.closest('[data-request-card]');
    if(clickedCard&&!event.target.closest('button,a,input,select,textarea,summary,[data-request-ignore-open]'))return;
  }
  const card=event.target.closest('[data-request-card]');
  if(card&&!event.target.closest('button,a,input,select,textarea,summary,[data-request-ignore-open]')){
    const request=requests.find(item=>item.id===card.dataset.requestCard);
    if(request){
      showRequestDetailPage(request);
      return;
    }
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
  if(actionButton.dataset.requestAction==='draft')updateRequestStatus(request.id,'draft');
  if(actionButton.dataset.requestAction==='delete')deleteRequest(request.id);
});
document.getElementById('requestDetailPage').addEventListener('click',event=>{
  const repliesToggle=event.target.closest('[data-comment-replies-toggle]');
  if(repliesToggle){
    const thread=repliesToggle.closest('.request-detail-comment-thread');
    const replyList=thread?.querySelector('.request-detail-comment-replies');
    if(replyList){
      replyList.hidden=!replyList.hidden;
      repliesToggle.setAttribute('aria-expanded',String(!replyList.hidden));
      if(replyList.hidden)expandedRequestCommentReplies.delete(repliesToggle.closest('.request-detail-comment-thread').querySelector('.request-detail-comment').dataset.commentId);
      else expandedRequestCommentReplies.add(repliesToggle.closest('.request-detail-comment-thread').querySelector('.request-detail-comment').dataset.commentId);
      repliesToggle.textContent=replyList.hidden
        ?`View ${repliesToggle.dataset.replyCount} ${Number(repliesToggle.dataset.replyCount)===1?'reply':'replies'}`
        :'Hide replies';
    }
    return;
  }
  const replyToggle=event.target.closest('[data-comment-reply-toggle]');
  if(replyToggle){
    const form=replyToggle.parentElement.querySelector('[data-comment-reply-form]');
    if(form){
      form.hidden=!form.hidden;
      replyToggle.setAttribute('aria-expanded',String(!form.hidden));
      if(!form.hidden)form.querySelector('textarea').focus();
    }
    return;
  }
  if(event.target.closest('[data-edit-detail-request]')){
    const request=requests.find(item=>item.id===activeRequestDetailId);
    if(request){
      document.getElementById('requestDetailPage').close();
      openRequestComposer(request);
    }
    return;
  }
  if(event.target.closest('[data-detail-status-action]')){
    const button=event.target.closest('[data-detail-status-action]');
    updateRequestStatus(activeRequestDetailId,button.dataset.nextStatus);
    return;
  }
  if(event.target.closest('[data-detail-delete]'))deleteRequest(activeRequestDetailId);
});
document.getElementById('requestDetailPage').addEventListener('submit',async event=>{
  const form=event.target.closest('[data-comment-reply-form]');
  if(!form)return;
  event.preventDefault();
  const input=form.querySelector('textarea');
  const submit=form.querySelector('button[type="submit"]');
  const status=form.querySelector('[role="status"]');
  const text=input.value.trim();
  if(!text){
    status.textContent='Write a reply before sending.';
    status.hidden=false;
    input.focus();
    return;
  }
  submit.disabled=true;
  status.textContent='Sending reply…';
  status.hidden=false;
  const requestId=activeRequestDetailId;
  try{
    await window.devMatchBackend.addProjectCommentReply(
      requestId,
      form.dataset.parentCommentId,
      text
    );
    expandedRequestCommentReplies.add(form.dataset.parentCommentId);
    if(activeRequestDetailId===requestId&&!document.getElementById('requestDetailPage').hidden){
      const request=requests.find(item=>item.id===requestId);
      if(request){
        await showRequestDetailPage(request,{preserveScroll:true});
        const pageStatus=document.getElementById('requestDetailCommentsStatus');
        pageStatus.textContent='Reply sent. The developer has been notified.';
        pageStatus.hidden=false;
      }
    }
  }catch(error){
    console.error('Unable to send a reply to the project comment.',error);
    status.textContent='Unable to send your reply. Check your connection and try again.';
    status.hidden=false;
    submit.disabled=false;
  }
});
document.querySelectorAll('[data-close-request-view]').forEach(button=>button.addEventListener('click',()=>document.getElementById('requestViewDialog').close()));
document.getElementById('requestViewDialog').addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close()});
document.querySelector('[data-request-view-details]').addEventListener('click',()=>{
  const request=requests.find(item=>item.id===activeRequestViewId);
  document.getElementById('requestViewDialog').close();
  if(request)showRequestDetailPage(request);
});
renderProjects();
if(requests.length&&!document.documentElement.classList.contains('devmatch-auth-pending-root'))renderRequests();
const requestActivityList=document.getElementById('requestActivityList');
pageSkeletons?.rows(requestActivityList,3);

function requestActivityTime(value){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return 'Recently';
  const minutes=Math.max(0,Math.floor((Date.now()-date.getTime())/60000));
  if(minutes<1)return 'Just now';
  if(minutes<60)return `${minutes}m ago`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours}h ago`;
  const days=Math.floor(hours/24);
  return days<7?`${days}d ago`:date.toLocaleDateString();
}

function requestActivityType(kind){
  const value=String(kind||'').toLowerCase();
  if(value.includes('reply'))return 'replied to your comment on';
  if(value.includes('comment')||value.includes('reply'))return 'commented on';
  if(value.includes('favorite')||value.includes('favourite')||value.includes('save'))return 'saved';
  if(value.includes('message')||value.includes('conversation'))return 'sent a message about';
  if(value.includes('rating')||value.includes('review'))return 'left a rating for';
  return 'updated';
}

function requestActivityDateGroup(value){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return {key:'unknown',label:'Recently'};
  const today=new Date();
  const dateNumber=Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());
  const todayNumber=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
  const daysAgo=Math.round((todayNumber-dateNumber)/86400000);
  if(daysAgo===0)return {key:'today',label:'Today'};
  if(daysAgo===1)return {key:'yesterday',label:'Yesterday'};
  const day=date.toLocaleDateString('en-US',{weekday:'short'});
  const month=date.toLocaleDateString('en-US',{month:'short'});
  return {
    key:`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    label:`${day}, ${String(date.getDate()).padStart(2,'0')} ${month} ${date.getFullYear()}`
  };
}

function createRequestActivityItem(entry){
  const item=document.createElement('article');
  item.className='request-activity-item';
  const avatar=document.createElement('span');
  avatar.className='request-activity-avatar';
  avatar.textContent=entry.initials||'•';
  const copy=document.createElement('p');
  const actor=document.createElement('b');
  actor.textContent=entry.actorName;
  const title=document.createElement('strong');
  title.textContent=entry.title;
  copy.append(actor,document.createTextNode(` ${requestActivityType(entry.kind)} `),title);
  const time=document.createElement('small');
  time.textContent=requestActivityTime(entry.created_at);
  item.append(avatar,copy,time);
  return item;
}

function renderRequestActivityDialog(){
  const list=document.getElementById('requestActivityDialogList');
  list.replaceChildren();
  if(requestActivityState==='loading'){
    pageSkeletons?.rows(list,3);
    return;
  }
  if(requestActivityState==='error'||!requestActivityEntries.length){
    const message=document.createElement('p');
    message.className='request-activity-empty';
    message.setAttribute('role','status');
    message.textContent=requestActivityState==='loading'
      ?'Loading activity…'
      :requestActivityState==='error'
        ?'Unable to load activity. Check your connection and try again.'
        :'Recent request activity will appear here.';
    list.append(message);
    return;
  }
  const groups=[];
  const groupsByKey=new Map();
  requestActivityEntries.forEach(entry=>{
    const dateGroup=requestActivityDateGroup(entry.created_at);
    let group=groupsByKey.get(dateGroup.key);
    if(!group){
      group={label:dateGroup.label,entries:[]};
      groupsByKey.set(dateGroup.key,group);
      groups.push(group);
    }
    group.entries.push(entry);
  });
  groups.forEach(group=>{
    const section=document.createElement('section');
    section.className='request-activity-date-group';
    const heading=document.createElement('h3');
    heading.textContent=group.label;
    section.append(heading,...group.entries.map(createRequestActivityItem));
    list.append(section);
  });
}

const requestActivityDialog=document.getElementById('requestActivityDialog');
document.getElementById('openRequestActivity').addEventListener('click',()=>{
  renderRequestActivityDialog();
  requestActivityDialog.showModal();
});
document.querySelector('[data-close-request-activity]').addEventListener('click',()=>requestActivityDialog.close());
requestActivityDialog.addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close()});

async function loadClientWorkspaceIdentity(backend,user){
  try{
    const profile=await backend.loadProfile(user);
    if(profile.account_role!=='client')throw new Error('Client workspace profile is unavailable.');
    const name=String(profile.display_name||profile.username||user.email||'').trim();
    if(!name)throw new Error('Your account name is unavailable.');
    document.getElementById('homeUserName').textContent=name;
    document.getElementById('homeIdentityStatus').hidden=true;
  }catch(error){
    console.error('Unable to load the client workspace identity.',error);
    const status=document.getElementById('homeIdentityStatus');
    status.replaceChildren();
    const message=document.createElement('span');
    message.textContent='Unable to load your workspace profile.';
    const retry=document.createElement('button');
    retry.className='request-secondary-button';
    retry.type='button';
    retry.textContent='Try again';
    retry.addEventListener('click',()=>void loadClientWorkspaceIdentity(backend,user),{once:true});
    status.append(message,retry);
    status.hidden=false;
  }
}

async function loadClientDashboardData(){
  const backend=window.devMatchBackend;
  const client=backend.client;
  try{
    const user=await backend.ready;
    if(!user)return;
    const identityTask=loadClientWorkspaceIdentity(backend,user);
    const homeDashboardTask=loadHomeDashboard({showLoading:false});
    const metricsTask=client.rpc('get_dashboard_metrics', {p_role: 'client'}).then(({data,error})=>{
      if(error)throw error;
      requestDashboardMetrics=typeof data==='string'?JSON.parse(data):data;
      if(!requestDashboardMetrics||typeof requestDashboardMetrics!=='object'
        ||['projects','views','favorites','comments'].some(key=>requestDashboardMetrics[key]==null||!Number.isFinite(Number(requestDashboardMetrics[key])))){
        throw new Error('Dashboard metrics are unavailable.');
      }
      renderRequests();
      renderRequestDetailClientMetrics();
    }).catch(error=>{
      console.error('Unable to load request dashboard metrics.',error);
      requestDashboardMetrics=null;
      renderRequestDetailClientMetrics();
      document.getElementById('requestsMessage').textContent='Unable to load dashboard metrics. Check your connection and try again.';
    });
    const notificationRowsTask=client.from('notifications')
      .select('id,actor_id,actor_role,kind,project_id,conversation_id,created_at')
      .eq('recipient_id',user.id).eq('recipient_role','client')
      .order('created_at',{ascending:false})
      .then(({data,error})=>{
        if(error)throw error;
        return data||[];
      });
    const activityTask=(async()=>{
      const notifications=await notificationRowsTask;
      const entries=notifications.slice().sort((a,b)=>{
        const timeA=new Date(a.created_at).getTime();
        const timeB=new Date(b.created_at).getTime();
        if(!Number.isFinite(timeA))return Number.isFinite(timeB)?1:0;
        if(!Number.isFinite(timeB))return -1;
        return timeB-timeA;
      });
      if(!entries.length){
        requestActivityEntries=[];
        requestActivityState='empty';
        if(requestActivityDialog.open)renderRequestActivityDialog();
        const empty=document.createElement('p');
        empty.className='request-activity-empty';
        empty.textContent='Recent request activity will appear here.';
        requestActivityList.replaceChildren(empty);
        return;
      }
      const actorIds=[...new Set(entries.map(entry=>entry.actor_id).filter(Boolean))];
      const projectIds=[...new Set(entries.map(entry=>entry.project_id).filter(Boolean))];
      const [actorsResult,projectsResult]=await Promise.all([
        actorIds.length?client.from('directory_people').select('id,username,display_name,account_role').in('id',actorIds):Promise.resolve({data:[],error:null}),
        projectIds.length?client.from('projects').select('id,title').in('id',projectIds):Promise.resolve({data:[],error:null})
      ]);
      if(actorsResult.error)throw actorsResult.error;
      if(projectsResult.error)throw projectsResult.error;
      const names=new Map((actorsResult.data||[]).map(actor=>[actor.id + ':' + actor.account_role, actor.username || actor.display_name]));
      const titles=new Map((projectsResult.data||[]).map(project=>[project.id,project.title]));
      requestActivityEntries=entries.map(entry=>{
        const actorName=names.get(entry.actor_id + ':' + entry.actor_role)||'A member';
        return {
          ...entry,
          actorName,
          title:titles.get(entry.project_id)||(entry.conversation_id?'your conversation':'your request'),
          initials:String(actorName).trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()
        };
      });
      requestActivityState='loaded';
      if(requestActivityDialog.open)renderRequestActivityDialog();
      requestActivityList.replaceChildren();
      requestActivityEntries.slice(0,5).forEach(entry=>requestActivityList.append(createRequestActivityItem(entry)));
    })().catch(error=>{
      console.error('Unable to load recent request activity.',error);
      requestActivityState='error';
      if(requestActivityDialog.open)renderRequestActivityDialog();
      const message=document.createElement('p');
      message.className='request-activity-empty';
      message.setAttribute('role','status');
      message.textContent='Unable to load activity. Check your connection and try again.';
      requestActivityList.replaceChildren(message);
    });
    const unreadTask=(async()=>{
      const [readIds,notifications]=await Promise.all([
        backend.loadNotificationReads(),
        notificationRowsTask
      ]);
      const unread=(notifications||[]).filter(entry=>!readIds.includes(entry.id)).length;
      document.querySelectorAll('.client-notification-count').forEach(count=>{
        count.textContent=String(unread);
        count.hidden=unread===0;
      });
      if(notificationDot)notificationDot.hidden=unread===0;
    })().catch(error=>console.error('Unable to load notification count.',error));
    const conversationsTask=loadHomeConversations();
    await Promise.all([identityTask,homeDashboardTask,metricsTask,activityTask,unreadTask,conversationsTask]);
  }catch(error){
    console.error('Unable to load client dashboard data.',error);
  }
}

renderHomeDashboardLoading();
loadClientDashboardData();
loadPublicProjects();
syncRequestPickers();
syncConditionalFields();
renderReferenceAttachments();
updateRequestPreview();
if(location.hash==='#discover')showClientView('discover');
else if(location.hash==='#requests')showClientView('requests');
else if(location.hash==='#request-new')openRequestComposer();
else if(location.hash.startsWith('#request-detail/')){
  void (async()=>{
    try{
      await requestsReady;
      const requestId=decodeURIComponent(location.hash.slice('#request-detail/'.length));
      const request=requests.find(item=>item.id===requestId);
      if(request)showRequestDetailPage(request,{focusComments:new URLSearchParams(location.search).get('section')==='comments'});
      else showClientView('requests');
    }catch(error){
      console.error('Unable to open the requested project detail.',error);
      showClientView('requests');
    }
  })();
}
