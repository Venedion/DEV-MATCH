(function(){
  'use strict';

  const requestId=new URLSearchParams(location.search).get('request');
  const requests=Array.isArray(window.DEVMATCH_SAMPLE_REQUESTS)?window.DEVMATCH_SAMPLE_REQUESTS:[];
  const request=requests.find(item=>item.id===requestId);
  const layout=document.getElementById('requestDetailLayout');
  const notFound=document.getElementById('requestNotFound');
  const favoritesKey='devmatch-developer-project-favorites';
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let comments=[];
  let favorites=readJson(favoritesKey,[]);
  let favoriteStateReady=Promise.resolve(false);

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
  const saveButton=document.getElementById('saveRequestButton');
  const updateSaveButton=isSaved=>{
    saveButton.setAttribute('aria-pressed',String(isSaved));
    saveButton.setAttribute('aria-label',isSaved?'Remove saved request':'Save request');
  };
  updateSaveButton(Array.isArray(favorites)&&favorites.includes(request.id));
  favoriteStateReady=window.devMatchBackend.ready.then(async user=>{
    if(!user)return false;
    const records=await window.devMatchBackend.loadFavorites();
    favorites=records.filter(item=>item.type==='project').map(item=>item.id);
    localStorage.setItem(favoritesKey,JSON.stringify(favorites));
    updateSaveButton(favorites.includes(request.id));
    return true;
  }).catch(error=>{
    console.error('Unable to load saved project requests from Supabase.',error);
    window.alert('Unable to load saved requests. Check your connection and try again.');
    return null;
  });
  saveButton.addEventListener('click',async()=>{
    const authenticated=await favoriteStateReady;
    if(authenticated===null)return;
    const isSaved=favorites.includes(request.id);
    const updated=isSaved?favorites.filter(id=>id!==request.id):[...favorites,request.id];
    if(authenticated){
      try{
        await window.devMatchBackend.setFavorite('project',request.id,!isSaved);
      }catch(error){
        console.error('Unable to update saved project requests in Supabase.',error);
        window.alert('Unable to save this request. Please try again.');
        return;
      }
    }
    try{
      localStorage.setItem(favoritesKey,JSON.stringify(updated));
      favorites=updated;
      updateSaveButton(!isSaved);
    }catch(error){
      console.error('Unable to update saved project requests.',error);
    }
  });
  try{
    comments=await window.devMatchBackend.loadProjectComments(request.id);
  }catch(error){
    console.error('Unable to load project request comments from Supabase.',error);
    window.alert('Unable to load project comments. Check your connection and try again.');
  }
  renderComments();
  renderSimilarRequests();
  layout.hidden=false;

  document.getElementById('commentSort').addEventListener('change',renderComments);
  document.getElementById('commentForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const input=document.getElementById('commentInput');
    const text=input.value.trim();
    if(!text){
      input.setCustomValidity('Please enter a comment before posting.');
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    try{
      comments.push(await window.devMatchBackend.addProjectComment(request.id,text));
    }catch(error){
      console.error('Unable to save the project request comment to Supabase.',error);
      window.alert('Unable to post your comment. Please log in and try again.');
      return;
    }
    input.value='';
    renderComments();
  });
  document.getElementById('commentInput').addEventListener('input',event=>event.target.setCustomValidity(''));
})();
