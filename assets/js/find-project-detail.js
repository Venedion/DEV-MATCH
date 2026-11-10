(function(){
  'use strict';

  const requestId=new URLSearchParams(location.search).get('request');
  const requests=Array.isArray(window.DEVMATCH_SAMPLE_REQUESTS)?window.DEVMATCH_SAMPLE_REQUESTS:[];
  const request=requests.find(item=>item.id===requestId);
  const layout=document.getElementById('requestDetailLayout');
  const notFound=document.getElementById('requestNotFound');
  const commentsKey=`devmatch-request-comments-${requestId}`;
  const favoritesKey='devmatch-developer-project-favorites';
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let comments=[];

  function readJson(key,fallback){
    try{
      const value=localStorage.getItem(key);
      return value?JSON.parse(value):fallback;
    }catch(error){
      console.warn(`Unable to read ${key} from browser storage.`,error);
      return fallback;
    }
  }

  function renderComments(){
    const ordered=document.getElementById('commentSort').value==='newest'?[...comments].reverse():comments;
    document.getElementById('commentsCount').textContent=String(comments.length);
    document.getElementById('requestCommentCount').textContent=`▢ ${comments.length} comments`;
    document.getElementById('commentsEmpty').hidden=comments.length>0;
    document.getElementById('requestComments').innerHTML=ordered.map(comment=>`
      <article class="find-comment">
        <span class="find-detail-avatar">${escapeHtml(comment.initials||'CL')}</span>
        <div><strong>${escapeHtml(comment.name||'Client')} <small>${escapeHtml(comment.role||'Client')}</small></strong><time>${escapeHtml(comment.time||'')}</time><p>${escapeHtml(comment.text||'')}</p></div>
      </article>`).join('');
  }

  function renderSimilarRequests(){
    const similar=requests.filter(item=>item.id!==request.id)
      .sort((left,right)=>Number(right.category===request.category)-Number(left.category===request.category))
      .slice(0,3);
    document.getElementById('similarRequests').innerHTML=similar.map(item=>`
      <a class="find-similar-request" href="devmatch-find-project-detail.html?request=${encodeURIComponent(item.id)}">
        <strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.budgetLabel)}</small>
      </a>`).join('');
  }

  if(!request){
    notFound.hidden=false;
    return;
  }

  document.title=`${request.title} — Find Projects | DEV-MATCH`;
  document.getElementById('requestCategory').textContent=request.category;
  document.getElementById('requestBreadcrumbTitle').textContent=request.title;
  document.getElementById('requestClientAvatar').textContent=request.initials;
  document.getElementById('asideClientAvatar').textContent=request.initials;
  document.getElementById('requestClientName').textContent=request.client;
  document.getElementById('asideClientName').textContent=request.client;
  document.getElementById('requestClientMeta').textContent=`${request.client} · ${request.location} · Posted ${request.days}`;
  document.getElementById('asideClientLocation').textContent=request.location;
  document.getElementById('asideClientCategory').textContent=request.category;
  document.getElementById('requestTags').innerHTML=[request.category,request.type].map(value=>`<span>${escapeHtml(value)}</span>`).join('');
  document.getElementById('requestTitle').textContent=request.title;
  document.getElementById('requestDescription').textContent=request.description;
  document.getElementById('requestBudget').textContent=request.budgetLabel;
  document.getElementById('requestPosted').textContent=request.days;
  document.getElementById('requestLocation').textContent=request.location;
  document.getElementById('requestOverview').textContent=request.description;
  document.getElementById('requestFeatures').innerHTML=(Array.isArray(request.features)?request.features:[])
    .map(feature=>`<li>${escapeHtml(feature)}</li>`).join('');
  document.getElementById('requestStack').innerHTML=(Array.isArray(request.stack)?request.stack:String(request.stack||'').split(/\s+(?:and|,)\s+/))
    .filter(Boolean).map(value=>`<span>${escapeHtml(value)}</span>`).join('');
  document.getElementById('requestPopularity').textContent=`◉ ${Number(request.popularity)||0} popularity`;
  document.getElementById('contactClient').href=`devmatch-chat.html?role=dev&request=${encodeURIComponent(request.id)}`;
  document.getElementById('developerAvatar').textContent=(()=>{
    const profile=readJson('devmatch-profile-dev',{});
    const name=profile.displayName||'Rizky Aditya';
    return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'DV';
  })();
  const favorites=readJson(favoritesKey,[]);
  const saveButton=document.getElementById('saveRequestButton');
  const updateSaveButton=isSaved=>{
    saveButton.setAttribute('aria-pressed',String(isSaved));
    saveButton.setAttribute('aria-label',isSaved?'Remove saved request':'Save request');
  };
  updateSaveButton(Array.isArray(favorites)&&favorites.includes(request.id));
  saveButton.addEventListener('click',()=>{
    const current=readJson(favoritesKey,[]);
    const saved=Array.isArray(current)?current:[];
    const isSaved=saved.includes(request.id);
    const updated=isSaved?saved.filter(id=>id!==request.id):[...saved,request.id];
    try{
      localStorage.setItem(favoritesKey,JSON.stringify(updated));
      updateSaveButton(!isSaved);
    }catch(error){
      console.error('Unable to update saved project requests.',error);
    }
  });
  comments=readJson(commentsKey,[]);
  if(!Array.isArray(comments))comments=[];
  renderComments();
  renderSimilarRequests();
  layout.hidden=false;

  document.getElementById('commentSort').addEventListener('change',renderComments);
  document.getElementById('commentForm').addEventListener('submit',event=>{
    event.preventDefault();
    const input=document.getElementById('commentInput');
    const text=input.value.trim();
    if(!text){
      input.setCustomValidity('Please enter a comment before posting.');
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    const profile=readJson('devmatch-profile-dev',{});
    const name=profile.displayName||'Rizky Aditya';
    const initials=name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'DV';
    comments.push({name,initials,text,role:'Developer',time:'just now'});
    try{
      localStorage.setItem(commentsKey,JSON.stringify(comments));
    }catch(error){
      comments.pop();
      console.error('Unable to save the project request comment.',error);
      return;
    }
    input.value='';
    renderComments();
  });
  document.getElementById('commentInput').addEventListener('input',event=>event.target.setCustomValidity(''));
})();
