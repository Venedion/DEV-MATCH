(function(){
const profile=JSON.parse(localStorage.getItem('devmatch-profile-dev')||'{}');
const displayName=profile.displayName||'Developer';
const nameParts=displayName.trim().split(/\s+/).filter(Boolean);
document.getElementById('topUserName').textContent=displayName;
document.getElementById('userAvatar').textContent=nameParts.slice(0,2).map(part=>part[0]).join('').toUpperCase()||'DM';

const storageKey='devmatch-dashboard-projects';
const overridesKey='devmatch-my-projects-overrides';
const removedKey='devmatch-my-projects-removed';
const seedProjects=[
  {id:'sample-restaurant',title:'Restaurant Website Development',type:'Website',category:'Company Profile',price:'Rp 3.500.000',priceType:'Starting from',status:'published',views:245,favorites:32,comments:8,art:'food',updated:12},
  {id:'sample-pos',title:'Kasir Kopi POS',type:'Web App',category:'POS',price:'Rp 6.000.000',priceType:'Fixed price',status:'published',views:1920,favorites:128,comments:21,art:'dashboard',updated:11},
  {id:'sample-booking',title:'Klinik Booking App',type:'Android / iOS',category:'Booking',price:'Rp 3jt — Rp 7jt',priceType:'Custom quote',status:'published',views:1310,favorites:86,comments:14,art:'booking',updated:10},
  {id:'sample-inventory',title:'Gudang Pro Inventory',type:'Desktop App',category:'Inventory',price:'Rp 7.500.000',priceType:'Negotiable',status:'published',views:712,favorites:38,comments:5,art:'inventory',updated:9},
  {id:'sample-loyalty',title:'Poin Loyalty App',type:'Android / iOS',category:'Other',price:'Rp 9.000.000',priceType:'Starting from',status:'draft',views:null,favorites:null,comments:null,art:'loyalty',updated:8},
  {id:'sample-northwind',title:'Northwind Company Profile',type:'Website',category:'Company Profile',price:'Rp 4.500.000',priceType:'Negotiable',status:'published',views:860,favorites:41,comments:6,art:'northwind',updated:7},
  {id:'sample-analytics',title:'Analytics Dashboard Kit',type:'Web App',category:'Dashboard',price:'Rp 4.200.000',priceType:'Fixed price',status:'published',views:640,favorites:29,comments:4,art:'analytics',updated:6},
  {id:'sample-store',title:'LUMA Online Store',type:'Website',category:'E-Commerce',price:'Rp 8.000.000',priceType:'Starting from',status:'published',views:590,favorites:35,comments:7,art:'store',updated:5},
  {id:'sample-portfolio',title:'Personal Portfolio Website',type:'Website',category:'Portfolio',price:'Rp 2.500.000',priceType:'Starting from',status:'published',views:430,favorites:24,comments:3,art:'northwind',updated:4},
  {id:'sample-appointment',title:'Doctor Appointment System',type:'Web App',category:'Booking',price:'Rp 5.500.000',priceType:'Negotiable',status:'published',views:380,favorites:18,comments:4,art:'booking',updated:3},
  {id:'sample-catalog',title:'Product Catalog App',type:'Android / iOS',category:'E-Commerce',price:'Rp 6.500.000',priceType:'Fixed price',status:'draft',views:null,favorites:null,comments:null,art:'loyalty',updated:2},
  {id:'sample-invoice',title:'Invoice Management Tool',type:'Web App',category:'Business',price:'Rp 3.800.000',priceType:'Starting from',status:'published',views:215,favorites:12,comments:2,art:'analytics',updated:1}
];
const savedProjects=JSON.parse(localStorage.getItem(storageKey)||'[]');
let migratedSavedProjects=false;
savedProjects.forEach((project,index)=>{
  if(!project.id){
    project.id=`saved-${index}-${Date.now()}`;
    migratedSavedProjects=true;
  }
});
if(migratedSavedProjects)localStorage.setItem(storageKey,JSON.stringify(savedProjects));
const overrides=JSON.parse(localStorage.getItem(overridesKey)||'{}');
const removed=new Set(JSON.parse(localStorage.getItem(removedKey)||'[]'));
let projects=[
  ...seedProjects.filter(project=>!removed.has(project.id)).map(project=>({...project,...overrides[project.id]})),
  ...savedProjects.map((project,index)=>({...project,id:project.id||`saved-${index}`,category:project.category||project.type,priceType:project.priceType||'Starting from',status:project.status||'published',views:Number(project.views)||0,favorites:Number(project.favorites)||0,comments:Number(project.comments)||0,art:project.art||'dashboard',updated:project.updated||0}))
];
const rows=document.getElementById('managedProjectRows');
const search=document.getElementById('projectSearch');
const headerSearch=document.getElementById('headerSearch');
const sortSelect=document.getElementById('projectSort');
const pagination=document.getElementById('pagination');
const emptyState=document.getElementById('emptyProjects');
const tableSummary=document.getElementById('resultSummary');
const perPage=6;
let currentStatus=new URLSearchParams(location.search).get('status')==='favorites'?'published':'all';
let currentPage=1;
let query='';
let editingId=null;
let visibleProjects=[];

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function formatMetric(value){
  return value===null||value===undefined?'—':Number(value).toLocaleString('en-US');
}
function filteredProjects(){
  const filtered=projects.filter(project=>(currentStatus==='all'||project.status===currentStatus)&&(!query||`${project.title} ${project.type} ${project.category} ${project.price}`.toLowerCase().includes(query)));
  if(sortSelect.value==='title')filtered.sort((a,b)=>a.title.localeCompare(b.title));
  if(sortSelect.value==='price')filtered.sort((a,b)=>(Number(String(a.price).replace(/[^\d]/g,''))||0)-(Number(String(b.price).replace(/[^\d]/g,''))||0));
  if(sortSelect.value==='views')filtered.sort((a,b)=>(b.views||0)-(a.views||0));
  if(sortSelect.value==='updated')filtered.sort((a,b)=>(b.updated||0)-(a.updated||0));
  return filtered;
}
function thumbnail(project){
  return `<span class="project-thumb art-${escapeHtml(project.art)}" aria-hidden="true">${project.coverImage?`<img src="${escapeHtml(project.coverImage)}" alt="">`:'<i class="mock-top"></i><i class="mock-line"></i><i class="mock-line short"></i><i class="mock-block"></i>'}</span>`;
}
function renderPagination(pageCount){
  if(pageCount<=1){pagination.innerHTML='';return;}
  const buttons=[`<button class="page-button" type="button" data-page="${currentPage-1}" aria-label="Previous page" ${currentPage===1?'disabled':''}>‹</button>`];
  const pageNumbers=pageCount<=4?Array.from({length:pageCount},(_,i)=>i+1):[1,2,3,'…',pageCount];
  pageNumbers.forEach(page=>{
    if(page==='…')buttons.push('<span class="page-ellipsis" aria-hidden="true">…</span>');
    else buttons.push(`<button class="page-button${page===currentPage?' active':''}" type="button" data-page="${page}" aria-label="Page ${page}" aria-current="${page===currentPage?'page':'false'}">${page}</button>`);
  });
  buttons.push(`<button class="page-button" type="button" data-page="${currentPage+1}" aria-label="Next page" ${currentPage===pageCount?'disabled':''}>›</button>`);
  pagination.innerHTML=buttons.join('');
}
function render(){
  const filtered=filteredProjects();
  const pageCount=Math.max(1,Math.ceil(filtered.length/perPage));
  currentPage=Math.min(currentPage,pageCount);
  visibleProjects=filtered.slice((currentPage-1)*perPage,currentPage*perPage);
  rows.innerHTML=visibleProjects.map(project=>`
    <tr>
      <td><div class="project-cell">${thumbnail(project)}<div><h2 class="project-title">${escapeHtml(project.title)}</h2><p class="project-subtitle">${escapeHtml(project.type)} · ${escapeHtml(project.category)}</p></div></div></td>
      <td><span class="price-type">${escapeHtml(project.priceType)}</span><span class="price-value">${escapeHtml(project.price||'Contact for price')}</span></td>
      <td><span class="status-badge${project.status==='draft'?' draft':''}">${project.status==='draft'?'Draft':'Published'}</span></td>
      <td class="metric">${formatMetric(project.views)}</td><td class="metric">${formatMetric(project.favorites)}</td><td class="metric">${formatMetric(project.comments)}</td>
      <td><div class="row-actions">
        <button class="row-action" type="button" data-action="view" data-id="${escapeHtml(project.id)}" aria-label="View ${escapeHtml(project.title)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button class="row-action" type="button" data-action="edit" data-id="${escapeHtml(project.id)}" aria-label="Edit ${escapeHtml(project.title)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6 4 4M4 20l4-.8L19 8a2.8 2.8 0 0 0-4-4L4 15z"/></svg></button>
        <button class="row-action delete" type="button" data-action="delete" data-id="${escapeHtml(project.id)}" aria-label="Delete ${escapeHtml(project.title)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16m-10 4v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg></button>
      </div></td>
    </tr>`).join('');
  emptyState.hidden=filtered.length>0;
  document.querySelector('.project-table').hidden=filtered.length===0;
  document.querySelector('.table-footer').hidden=filtered.length===0;
  const start=filtered.length?(currentPage-1)*perPage+1:0;
  const end=Math.min(currentPage*perPage,filtered.length);
  tableSummary.textContent=`Showing ${start}–${end} of ${filtered.length} projects`;
  renderPagination(pageCount);
  document.getElementById('allCount').textContent=String(projects.length);
  document.getElementById('publishedCount').textContent=String(projects.filter(project=>project.status==='published').length);
  document.getElementById('draftCount').textContent=String(projects.filter(project=>project.status==='draft').length);
}
function storeSavedProjects(){
  localStorage.setItem(storageKey,JSON.stringify(savedProjects));
}
function persistSeedChange(project){
  overrides[project.id]={...project};
  localStorage.setItem(overridesKey,JSON.stringify(overrides));
}
const editor=document.getElementById('projectEditor');
const projectsPage=document.getElementById('projectsList');
const form=document.getElementById('projectForm');
const selectedMedia=[];
let previewUrls=[];
let galleryUrls=[];
let existingCoverImage='';
function showEditor(project=null){
  form.reset();
  selectedMedia.length=0;
  previewUrls.forEach(url=>URL.revokeObjectURL(url));
  previewUrls=[];
  galleryUrls.forEach(url=>URL.revokeObjectURL(url));
  galleryUrls=[];
  editingId=project?.id||null;
  existingCoverImage=project?.coverImage||'';
  document.getElementById('editorTitle').textContent=project?(project.status==='draft'?'Edit draft':'Edit project'):'Add a new project';
  document.getElementById('editorBreadcrumbCurrent').textContent=project?'Edit':'New';
  document.getElementById('projectMessage').textContent='';
  document.getElementById('mediaMessage').textContent='';
  document.getElementById('mediaPreviewList').replaceChildren();
  if(project){
    form.elements.title.value=project.title==='Untitled project'?'':project.title;
    form.elements.description.value=project.description||'';
    form.elements.link.value=project.link||'';
    [...form.elements.type].find(option=>option.value===project.type)?.click();
    [...form.elements.category].find(option=>option.value===project.category)?.click();
    [...form.elements.priceType].find(option=>option.value===project.priceType)?.click();
    form.elements.price.value=project.priceValue||String(project.price||'').replace(/^Rp\s*/,'').replace(/\./g,'');
    form.elements.priceMin.value=project.priceMin||'';
    form.elements.priceMax.value=project.priceMax||'';
    form.querySelectorAll('[name="services"]').forEach(input=>{input.checked=(project.services||[]).includes(input.value)});
  }
  projectsPage.hidden=true;
  document.getElementById('projectPreviewMode').hidden=true;
  editor.hidden=false;
  updateEditor();
  editor.scrollIntoView({block:'start'});
  form.elements.title.focus();
}
function closeEditor(){
  editor.hidden=true;
  document.getElementById('projectPreviewMode').hidden=true;
  projectsPage.hidden=false;
  editingId=null;
  const url=new URL(window.location.href);
  if(url.searchParams.has('create')){
    url.searchParams.delete('create');
    history.replaceState(null,'',url);
  }
  render();
}
function previewProjectData(){
  return {
    title:form.elements.title.value.trim(),
    description:form.elements.description.value.trim(),
    link:form.elements.link.value.trim(),
    type:form.elements.type.value,
    category:form.elements.category.value,
    priceType:form.elements.priceType.value,
    price:currentPrice(),
    services:[...form.querySelectorAll('[name="services"]:checked')].map(input=>input.value),
    coverImage:existingCoverImage
  };
}
function populatePreviewMode(project){
  document.getElementById('previewModeType').textContent=project.type||'Project type';
  document.getElementById('previewModeCategory').textContent=project.category||'Project category';
  document.getElementById('previewModeTitle').textContent=project.title||'Untitled project';
  document.getElementById('previewGalleryBrand').textContent=project.title||'Your project';
  document.getElementById('previewModeDescription').textContent=project.description||'Add a description so clients can understand what this project offers.';
  document.getElementById('previewModePriceType').textContent=(project.priceType||'Pricing not selected').toUpperCase();
  document.getElementById('previewModePrice').textContent=project.price&&project.price!=='Contact for price'?project.price:'Price not set';
  document.getElementById('previewDetailsType').textContent=project.type||'Not selected';
  document.getElementById('previewDetailsCategory').textContent=project.category||'Not selected';
  document.getElementById('previewDetailsPricing').textContent=project.priceType||'Not selected';
  let safeLink='';
  try{
    const parsedLink=new URL(project.link);
    if(parsedLink.protocol==='http:'||parsedLink.protocol==='https:')safeLink=parsedLink.href;
  }catch{}
  const link=document.getElementById('previewModeLink');
  const linkWrap=document.getElementById('previewModeLinkWrap');
  link.href=safeLink||'#';
  link.textContent=safeLink?new URL(safeLink).hostname:'';
  linkWrap.hidden=!safeLink;
  document.getElementById('previewDetailsLink').textContent=safeLink?new URL(safeLink).hostname:'Not added';
  const serviceContainer=document.getElementById('previewModeServices');
  const services=[...new Set(project.services||[])];
  serviceContainer.replaceChildren();
  if(services.length){
    services.forEach(service=>{
      const item=document.createElement('div');
      item.className='preview-service-item';
      const check=document.createElement('span');
      check.textContent='✓';
      const label=document.createElement('b');
      label.textContent=service;
      item.append(check,label);
      serviceContainer.append(item);
    });
  }else{
    const empty=document.createElement('p');
    empty.className='preview-no-services';
    empty.textContent='No included services selected.';
    serviceContainer.append(empty);
  }
  const profile=JSON.parse(localStorage.getItem('devmatch-profile-dev')||'{}');
  const developerName=profile.displayName||displayName;
  const profileNameParts=developerName.trim().split(/\s+/).filter(Boolean);
  document.getElementById('previewModeDeveloper').textContent=developerName;
  document.getElementById('previewModeAvatar').textContent=profileNameParts.slice(0,2).map(part=>part[0]).join('').toUpperCase()||'DM';
  document.getElementById('previewModeHandle').textContent=`@${profile.username||profileNameParts.join('').toLowerCase()||'developer'} · ${[profile.city,profile.country].filter(Boolean).join(', ')||'Indonesia'}`;
  document.getElementById('previewModeAvailability').textContent=profile.availability||'Open for hiring';
  document.getElementById('previewModeSpecialty').textContent=(profile.specialty||[])[0]||'Developer';
  document.getElementById('previewModeBio').textContent=profile.bio||profile.about||'Developer profile information will appear here.';
  document.querySelector('.preview-price-card>p').textContent=project.priceType==='Fixed price'
    ?'Fixed project pricing. Confirm final scope with the developer.'
    :project.priceType==='Custom quote'
      ?'The final quote can be confirmed with the developer.'
      :'Pricing details can be discussed with the developer.';
  const hero=document.getElementById('previewGalleryHero');
  let cover=hero.querySelector('.preview-gallery-cover');
  const selectedCoverIndex=selectedMedia.findIndex(file=>file.type.startsWith('image/'));
  const coverSource=selectedCoverIndex>=0?previewUrls[0]:project.coverImage||'';
  if(coverSource){
    if(!cover){cover=document.createElement('img');cover.className='preview-gallery-cover';cover.alt='Project cover';hero.prepend(cover)}
    cover.src=coverSource;
  }else if(cover)cover.remove();
  hero.classList.toggle('has-cover',Boolean(coverSource));
  galleryUrls.forEach(url=>URL.revokeObjectURL(url));
  galleryUrls=[];
  const thumbnails=document.getElementById('previewGalleryThumbnails');
  thumbnails.replaceChildren();
  const mediaItems=selectedMedia.length?[...selectedMedia]:coverSource?[{type:'image/jpeg',name:'Project cover',saved:true}]:[];
  if(project.coverImage&&selectedCoverIndex<0&&selectedMedia.length)mediaItems.unshift({type:'image/jpeg',name:'Existing project cover',saved:true});
  let activeMediaIndex=mediaItems.findIndex(file=>file.type.startsWith('image/'));
  if(activeMediaIndex<0)activeMediaIndex=0;
  mediaItems.forEach((file,index)=>{
    const item=document.createElement('button');
    item.type='button';
    item.className='preview-gallery-thumb'+(index===activeMediaIndex?' active':'');
    item.setAttribute('aria-label',file.type.startsWith('video/')?'Project demo video':`Project screenshot ${index+1}`);
    if(file.type.startsWith('image/')){
      const image=document.createElement('img');
      const url=file.saved?coverSource:URL.createObjectURL(file);
      if(!file.saved)galleryUrls.push(url);
      image.src=url;
      image.alt='';
      item.append(image);
      item.addEventListener('click',()=>{
        activeMediaIndex=index;
        hero.classList.add('has-cover');
        let heroImage=hero.querySelector('.preview-gallery-cover');
        if(!heroImage){heroImage=document.createElement('img');heroImage.className='preview-gallery-cover';heroImage.alt='Project screenshot';hero.prepend(heroImage)}
        heroImage.src=url;
        document.getElementById('previewGalleryCount').textContent=`${activeMediaIndex+1} / ${mediaCount}`;
        thumbnails.querySelectorAll('.preview-gallery-thumb').forEach(thumb=>thumb.classList.toggle('active',thumb===item));
      });
    }else{
      item.classList.add('video');
      item.textContent='▶';
      item.disabled=true;
      item.title='Video playback is not available in this preview.';
    }
    thumbnails.append(item);
  });
  const mediaCount=mediaItems.length;
  document.getElementById('previewGalleryCount').textContent=mediaCount?`${activeMediaIndex+1} / ${mediaCount}`:'0 / 0';
}
function showProjectPreview(project){
  populatePreviewMode(project);
  editor.hidden=true;
  projectsPage.hidden=true;
  document.getElementById('projectPreviewMode').hidden=false;
  document.getElementById('projectPreviewMode').scrollIntoView({block:'start'});
}
function openPreview(project){
  const previewMedia=document.getElementById('previewThumb');
  const coverSource=project.coverImage||(selectedMedia.some(file=>file.type.startsWith('image/'))?previewUrls[0]:'');
  let cover=previewMedia.querySelector('.full-preview-cover');
  if(coverSource){
    if(!cover){cover=document.createElement('img');cover.className='full-preview-cover';cover.alt='Project cover';previewMedia.prepend(cover)}
    cover.src=coverSource;
  }else if(cover)cover.remove();
  previewMedia.classList.toggle('has-cover',Boolean(coverSource));
  document.getElementById('previewDialogType').textContent=project.type||'Project type';
  document.getElementById('previewCategory').textContent=project.category||'Project category';
  document.getElementById('previewDialogTitle').textContent=project.title||'Untitled project';
  document.getElementById('previewDialogDescription').textContent=project.description||'Add a description to help clients understand this project.';
  document.getElementById('previewDialogPriceType').textContent=project.priceType||'Pricing not selected';
  document.getElementById('previewDialogPrice').textContent=project.price&&project.price!=='Contact for price'?project.price:'Price not set';
  const link=document.getElementById('previewLink');
  let safeLink='';
  try{
    const parsedLink=new URL(project.link);
    if(parsedLink.protocol==='http:'||parsedLink.protocol==='https:')safeLink=parsedLink.href;
  }catch{}
  link.hidden=!safeLink;
  link.href=safeLink||'#';
  link.textContent=safeLink?new URL(safeLink).hostname:'';
  const services=[...new Set(project.services||[])];
  const serviceSection=document.getElementById('previewServicesSection');
  const serviceList=document.getElementById('previewServices');
  serviceSection.hidden=!services.length;
  serviceList.replaceChildren(...services.map(service=>{
    const item=document.createElement('span');
    item.textContent=service;
    return item;
  }));
  document.getElementById('previewDialogOwner').textContent=displayName;
  document.getElementById('previewDialogAvatar').textContent=nameParts.slice(0,2).map(part=>part[0]).join('').toUpperCase()||'DM';
  document.getElementById('projectPreviewDialog').showModal();
}

function moneyValue(value){
  const digits=String(value||'').replace(/\D/g,'');
  return digits?`Rp ${Number(digits).toLocaleString('id-ID')}`:'';
}
function currentPrice(){
  const priceType=form.elements.priceType.value;
  if(priceType==='Custom quote'){
    const min=moneyValue(form.elements.priceMin.value);
    const max=moneyValue(form.elements.priceMax.value);
    return min&&max?`${min} — ${max}`:min||max;
  }
  return moneyValue(form.elements.price.value);
}
function hasCompletePrice(){
  const priceType=form.elements.priceType.value;
  if(!priceType)return false;
  return priceType==='Custom quote'
    ?Boolean(form.elements.priceMin.value.trim()&&form.elements.priceMax.value.trim())
    :Boolean(form.elements.price.value.trim());
}
function compressCoverImage(file){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    const objectUrl=URL.createObjectURL(file);
    image.onload=()=>{
      URL.revokeObjectURL(objectUrl);
      const scale=Math.min(1,800/image.width,500/image.height);
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.width*scale));
      canvas.height=Math.max(1,Math.round(image.height*scale));
      const context=canvas.getContext('2d');
      if(!context){reject(new Error('Could not prepare the project cover image.'));return}
      context.drawImage(image,0,0,canvas.width,canvas.height);
      resolve(canvas.toDataURL('image/jpeg',.76));
    };
    image.onerror=()=>{
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read the selected project cover image.'));
    };
    image.src=objectUrl;
  });
}
function updateEditor(){
  const title=form.elements.title.value.trim();
  const description=form.elements.description.value.trim();
  const type=form.elements.type.value;
  const category=form.elements.category.value;
  const priceType=form.elements.priceType.value;
  const price=currentPrice();
  const hasImage=selectedMedia.some(file=>file.type.startsWith('image/'))||Boolean(existingCoverImage);
  const hasVideo=selectedMedia.some(file=>file.type.startsWith('video/'));
  const checks=[
    Boolean(title&&description),
    hasImage,
    Boolean(type&&category),
    hasCompletePrice()
  ];
  const completed=checks.filter(Boolean).length;
  document.getElementById('titleCount').textContent=String(form.elements.title.value.length);
  document.getElementById('descriptionCount').textContent=String(form.elements.description.value.length);
  document.getElementById('previewTitle').textContent=title||'Untitled project';
  document.getElementById('previewHeroTitle').textContent=title||'Showcase your project.';
  document.getElementById('previewDescription').textContent=description||'Your project description will appear here.';
  document.getElementById('previewType').textContent=type||'Project type';
  document.querySelector('.preview-company>span').textContent=category||'Project category';
  document.getElementById('previewPriceType').textContent=priceType||'Choose pricing';
  document.getElementById('previewPrice').textContent=price||'Rp 0';
  document.getElementById('previewOwner').textContent=displayName;
  document.getElementById('previewAvatar').textContent=nameParts.slice(0,2).map(part=>part[0]).join('').toUpperCase()||'DM';
  const previewMedia=document.getElementById('listingPreviewMedia');
  const coverSource=selectedMedia.some(file=>file.type.startsWith('image/'))?previewUrls[0]:existingCoverImage;
  let cover=previewMedia.querySelector('.preview-cover-image');
  if(coverSource){
    if(!cover){cover=document.createElement('img');cover.className='preview-cover-image';cover.alt='Project screenshot preview';previewMedia.prepend(cover)}
    cover.src=coverSource;
  }else if(cover)cover.remove();
  previewMedia.classList.toggle('has-cover',Boolean(coverSource));
  document.getElementById('checklistCount').textContent=`${completed} / 4`;
  ['checkName','checkMedia','checkType','checkPrice'].forEach((id,index)=>{
    const item=document.getElementById(id);
    item.classList.toggle('complete',checks[index]);
    item.querySelector('span').textContent=checks[index]?'✓':'×';
  });
  const videoItem=document.getElementById('checkVideo');
  videoItem.classList.toggle('complete',hasVideo);
  videoItem.querySelector('span').textContent=hasVideo?'✓':'×';
  document.querySelectorAll('.pricing-option').forEach(option=>option.classList.toggle('selected',option.querySelector('input').checked));
  document.getElementById('priceRangeField').hidden=priceType!=='Custom quote';
  document.getElementById('singlePriceField').hidden=!priceType||priceType==='Custom quote';
  document.getElementById('priceHelper').textContent=!priceType?'Select a pricing option to continue.':price?`Shown as “${priceType} ${price}”.`:'Enter a price to show it on your project card.';
}
function renderSelectedMedia(){
  const list=document.getElementById('mediaPreviewList');
  list.replaceChildren();
  previewUrls.forEach(url=>URL.revokeObjectURL(url));
  previewUrls=[];
  selectedMedia.forEach((file,index)=>{
    const item=document.createElement('div');
    item.className='media-preview-item';
    if(file.type.startsWith('image/')){
      const image=document.createElement('img');
      const url=URL.createObjectURL(file);
      previewUrls.push(url);
      image.src=url;
      image.alt=`Project screenshot ${index+1}`;
      item.append(image);
    }else{
      item.classList.add('video-preview-item');
      item.textContent=`▶ ${file.name}`;
    }
    const remove=document.createElement('button');
    remove.type='button';
    remove.setAttribute('aria-label',`Remove ${file.name}`);
    remove.textContent='×';
    remove.addEventListener('click',()=>{
      selectedMedia.splice(index,1);
      renderSelectedMedia();
      updateEditor();
    });
    item.append(remove);
    list.append(item);
  });
}
function addMedia(files){
  const message=document.getElementById('mediaMessage');
  message.textContent='';
  const accepted=[];
  for(const file of files){
    const image=file.type.startsWith('image/');
    const video=file.type.startsWith('video/');
    const sizeLimit=image?5*1024*1024:50*1024*1024;
    if((!image&&!video)||file.size>sizeLimit){
      message.textContent=`${file.name} wasn't added. Use PNG, JPG, or WebP up to 5 MB, or MP4/WebM up to 50 MB.`;
      continue;
    }
    if(selectedMedia.length+accepted.length>=8){
      message.textContent='You can add up to 8 files.';
      break;
    }
    accepted.push(file);
  }
  selectedMedia.push(...accepted);
  renderSelectedMedia();
  updateEditor();
}
async function saveProject(status){
  const title=form.elements.title.value.trim();
  const description=form.elements.description.value.trim();
  const priceType=form.elements.priceType.value;
  const projectMessage=document.getElementById('projectMessage');
  if(status==='published'){
    const missing=[];
    if(!title||!description)missing.push('project name and description');
    if(!selectedMedia.some(file=>file.type.startsWith('image/'))&&!existingCoverImage)missing.push('at least one screenshot');
    if(!form.elements.type.value||!form.elements.category.value)missing.push('project type and category');
    if(!priceType)missing.push('a pricing option');
    else if(!hasCompletePrice())missing.push(priceType==='Custom quote'?'both ends of the price range':'a price');
    if(missing.length){
      projectMessage.textContent=`Before publishing, add ${missing.join(', ')}.`;
      document.getElementById('projectPreviewMode').hidden=true;
      editor.hidden=false;
      editor.querySelector('.publish-checklist').scrollIntoView({block:'center',behavior:'smooth'});
      return;
    }
  }
  const chosenCover=selectedMedia.find(file=>file.type.startsWith('image/'));
  let coverImage=existingCoverImage;
  if(chosenCover){
    try{
      coverImage=await compressCoverImage(chosenCover);
    }catch(error){
      projectMessage.textContent=error.message;
      document.getElementById('projectPreviewMode').hidden=true;
      editor.hidden=false;
      return;
    }
  }
  const projectData={
    title:title||'Untitled project',
    description,
    link:form.elements.link.value.trim(),
    type:form.elements.type.value,
    category:form.elements.category.value,
    priceType,
    price:currentPrice()||'Contact for price',
    priceValue:priceType==='Custom quote'?'':form.elements.price.value.trim(),
    priceMin:form.elements.priceMin.value.trim(),
    priceMax:form.elements.priceMax.value.trim(),
    services:[...form.querySelectorAll('[name="services"]:checked')].map(input=>input.value),
    mediaCount:selectedMedia.length||(existingCoverImage?1:0),
    coverImage,
    status,
    updated:Date.now()
  };
  if(editingId){
    const existing=projects.find(item=>item.id===editingId);
    if(existing){
      Object.assign(existing,projectData);
      if(editingId.startsWith('sample-'))persistSeedChange(existing);
      else{
        const savedIndex=savedProjects.findIndex(item=>item.id===editingId);
        if(savedIndex>=0){savedProjects[savedIndex]={...savedProjects[savedIndex],...projectData};storeSavedProjects()}
      }
    }
  }else{
    const newProject={...projectData,id:`project-${Date.now()}`,views:0,favorites:0,comments:0,art:'dashboard'};
    savedProjects.unshift(newProject);
    projects.push(newProject);
    storeSavedProjects();
  }
  closeEditor();
}

document.querySelectorAll('[data-open-project]').forEach(button=>button.addEventListener('click',()=>showEditor()));
document.querySelector('[data-editor-cancel]').addEventListener('click',closeEditor);
document.querySelector('[data-save-draft]').addEventListener('click',()=>saveProject('draft'));
document.querySelector('[data-preview-form]').addEventListener('click',()=>{
  updateEditor();
  showProjectPreview(previewProjectData());
});
document.querySelector('[data-exit-preview]').addEventListener('click',()=>{
  document.getElementById('projectPreviewMode').hidden=true;
  editor.hidden=false;
  editor.scrollIntoView({block:'start'});
});
document.querySelector('[data-publish-preview]').addEventListener('click',()=>saveProject('published'));
form.addEventListener('input',updateEditor);
form.addEventListener('change',event=>{
  if(event.target.name==='media'){
    addMedia([...event.target.files]);
    event.target.value='';
  }
  updateEditor();
});
form.addEventListener('submit',event=>{
  event.preventDefault();
  saveProject('published');
});
const mediaDropzone=document.getElementById('mediaDropzone');
mediaDropzone.addEventListener('dragover',event=>{event.preventDefault();mediaDropzone.classList.add('dragging')});
mediaDropzone.addEventListener('dragleave',()=>mediaDropzone.classList.remove('dragging'));
mediaDropzone.addEventListener('drop',event=>{
  event.preventDefault();
  mediaDropzone.classList.remove('dragging');
  addMedia([...event.dataTransfer.files]);
});
document.querySelectorAll('[data-close-preview]').forEach(button=>button.addEventListener('click',()=>document.getElementById('projectPreviewDialog').close()));
document.getElementById('projectPreviewDialog').addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close()});
document.querySelector('[data-status="all"]').parentElement.addEventListener('click',event=>{
  const button=event.target.closest('[data-status]');
  if(!button)return;
  currentStatus=button.dataset.status;
  currentPage=1;
  document.querySelectorAll('[data-status]').forEach(tab=>{
    const active=tab===button;
    tab.classList.toggle('active',active);
    tab.setAttribute('aria-selected',String(active));
  });
  render();
});
rows.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');
  if(!button)return;
  const project=projects.find(item=>item.id===button.dataset.id);
  if(!project)return;
  if(button.dataset.action==='view')openPreview(project);
  if(button.dataset.action==='edit')showEditor(project);
  if(button.dataset.action==='delete'){
    if(!window.confirm(`Delete "${project.title}" from your projects?`))return;
    if(project.id.startsWith('sample-')){
      removed.add(project.id);
      localStorage.setItem(removedKey,JSON.stringify([...removed]));
    }else{
      const index=savedProjects.findIndex(item=>item.id===project.id);
      if(index>=0){savedProjects.splice(index,1);storeSavedProjects()}
    }
    projects=projects.filter(item=>item.id!==project.id);
    render();
  }
});
pagination.addEventListener('click',event=>{
  const button=event.target.closest('[data-page]');
  if(!button||button.disabled)return;
  currentPage=Number(button.dataset.page);
  render();
});
function applySearch(value){
  query=value.trim().toLowerCase();
  currentPage=1;
  search.value=value;
  headerSearch.value=value;
  render();
}
search.addEventListener('input',()=>applySearch(search.value));
headerSearch.addEventListener('input',()=>applySearch(headerSearch.value));
sortSelect.addEventListener('change',()=>{currentPage=1;render()});
document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();
    headerSearch.focus();
  }
});
if(currentStatus==='published'){
  document.querySelectorAll('[data-status]').forEach(tab=>{
    const active=tab.dataset.status==='published';
    tab.classList.toggle('active',active);
    tab.setAttribute('aria-selected',String(active));
  });
}
render();
if(new URLSearchParams(window.location.search).get('create')==='1')showEditor();
})();
