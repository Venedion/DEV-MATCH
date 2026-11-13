(async function(){
  'use strict';
  const projectId=new URLSearchParams(location.search).get('request');
  const layout=document.getElementById('requestDetailLayout');
  const notFound=document.getElementById('requestNotFound');
  const status=document.getElementById('requestStatus');
  const favoritesKey='devmatch-developer-project-favorites';
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const initials=name=>(String(name||'').match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'CL';
  let project=null,comments=[],favorites=[],viewRecordFailed=false;
  function renderComments(){
    const ordered=document.getElementById('commentSort').value==='newest'?[...comments].reverse():comments;
    document.getElementById('commentsCount').textContent=String(comments.length);
    document.getElementById('requestCommentCount').textContent=`▢ ${comments.length} comments`;
    document.getElementById('commentsEmpty').hidden=comments.length>0;
    document.getElementById('requestComments').innerHTML=ordered.map(comment=>`<article class="find-comment"><span class="find-detail-avatar">${escapeHtml(comment.initials||'CL')}</span><div><strong>${escapeHtml(comment.name||'DEV-MATCH member')} <small>${escapeHtml(comment.role||'Member')}</small></strong><time>${escapeHtml(comment.time||'')}</time><p>${escapeHtml(comment.text||'')}</p></div></article>`).join('');
  }
  function renderSimilarRequests(rows){
    document.getElementById('similarRequests').innerHTML=rows.filter(row=>row.id!==project.id).slice(0,3).map(row=>`<a class="find-similar-request" href="devmatch-find-project-detail.html?request=${encodeURIComponent(row.id)}"><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.price||'Budget not specified')}</small></a>`).join('');
  }
  if(!projectId){status.hidden=true;notFound.hidden=false;return;}
  status.hidden=false;status.textContent='Loading project request…';
  try{
    const {data:row,error}=await window.devMatchBackend.client.from('projects')
      .select('id,owner_id,title,project_type,category,price,data,status,created_at,updated_at')
      .eq('id',projectId).eq('project_kind','request').eq('status','open').maybeSingle();
    if(error)throw error;
    if(!row){status.hidden=true;notFound.hidden=false;return;}
    const data=row.data&&typeof row.data==='object'?row.data:{};
    project={...data,id:row.id,title:row.title,type:row.project_type,category:row.category,
      budgetLabel:row.price||data.budgetLabel||data.budget||'Budget not specified',
      description:String(data.description||data.overview||''),stack:Array.isArray(data.stack)?data.stack:String(data.stack||''),
      features:Array.isArray(data.features)?data.features:[],location:String(data.location||'Location not provided'),
      popularity:0,ownerId:row.owner_id,createdAt:row.created_at||row.updated_at};
    let clientName='DEV-MATCH member',profileLocation='Location not provided',accountRole=null;
    const user=await window.devMatchBackend.ready;
    if(user){
      try{await window.devMatchBackend.recordProjectView(project.id);}
      catch(error){console.error('Unable to record the project request view in Supabase.',error);viewRecordFailed=true;}
      const {data:account,error:accountError}=await window.devMatchBackend.client.from('profiles')
        .select('account_role').eq('id',user.id).single();
      if(accountError)throw accountError;
      accountRole=account.account_role;
      if(accountRole==='dev'){
        const {data:person,error:personError}=await window.devMatchBackend.client.from('directory_people')
          .select('id,display_name,account_role,profile_data').eq('id',row.owner_id).eq('account_role','client').maybeSingle();
        if(personError)throw personError;
        if(person){
          clientName=person.display_name||clientName;
          profileLocation=String(person.profile_data?.city||profileLocation);
        }
        const records=await window.devMatchBackend.loadFavorites();
        favorites=records.filter(item=>item.type==='project').map(item=>item.id);
      }
    }
    const date=new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(project.createdAt));
    const budgetMatch=String(project.budgetLabel).replace(/[^\d]/g,'');
    const budget=Number(budgetMatch)||0;
    const days=new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(project.createdAt));
    project.client=clientName;project.initials=initials(clientName);project.location=profileLocation;project.days=days;project.budget=budget;
    document.title=`${project.title} — Find Projects | DEV-MATCH`;
    document.getElementById('requestCategory').textContent=project.category;
    document.getElementById('requestBreadcrumbTitle').textContent=project.title;
    document.getElementById('requestClientAvatar').textContent=project.initials;
    document.getElementById('asideClientAvatar').textContent=project.initials;
    document.getElementById('requestClientName').textContent=clientName;
    document.getElementById('asideClientName').textContent=clientName;
    document.getElementById('requestClientMeta').textContent=`${clientName} · ${project.location} · Posted ${date}`;
    document.getElementById('asideClientLocation').textContent=project.location;
    document.getElementById('asideClientCategory').textContent=project.category;
    document.getElementById('requestTags').innerHTML=[project.category,project.type].filter(Boolean).map(value=>`<span>${escapeHtml(value)}</span>`).join('');
    document.getElementById('requestTitle').textContent=project.title;
    document.getElementById('requestDescription').textContent=project.description;
    document.getElementById('requestBudget').textContent=project.budgetLabel;
    document.getElementById('requestPosted').textContent=date;
    document.getElementById('requestLocation').textContent=project.location;
    document.getElementById('requestOverview').textContent=project.description;
    document.getElementById('requestFeatures').innerHTML=project.features.map(feature=>`<li>${escapeHtml(feature)}</li>`).join('');
    document.getElementById('requestStack').innerHTML=(Array.isArray(project.stack)?project.stack:String(project.stack).split(/\s+(?:and|,)\s+/)).filter(Boolean).map(value=>`<span>${escapeHtml(value)}</span>`).join('');
    document.getElementById('requestPopularity').textContent='';
    document.getElementById('contactClient').href=user&&accountRole==='dev'?`devmatch-chat.html?role=dev&request=${encodeURIComponent(project.id)}`:'devmatch-auth.html?mode=login';
    const saveButton=document.getElementById('saveRequestButton');
    saveButton.hidden=!user||accountRole!=='dev';
    const updateSaveButton=saved=>{saveButton.setAttribute('aria-pressed',String(saved));saveButton.setAttribute('aria-label',saved?'Remove saved request':'Save request');};
    updateSaveButton(favorites.includes(project.id));
    saveButton.addEventListener('click',async()=>{
      const activeUser=await window.devMatchBackend.ready;
      if(!activeUser){location.href='devmatch-auth.html?mode=login';return;}
      const saved=favorites.includes(project.id);
      try{
        await window.devMatchBackend.setFavorite('project',project.id,!saved);
        favorites=saved?favorites.filter(id=>id!==project.id):[...favorites,project.id];
        updateSaveButton(!saved);
      }catch(error){console.error('Unable to update saved project requests in Supabase.',error);window.alert('Unable to save this request. Please try again.');}
    });
    const {data:similar,error:similarError}=await window.devMatchBackend.client.from('projects')
      .select('id,title,price,category').eq('project_kind','request').eq('status','open').neq('id',project.id)
      .order('updated_at',{ascending:false}).limit(4);
    if(similarError)throw similarError;
    renderSimilarRequests(similar||[]);
    let commentsFailed=false;
    try{comments=await window.devMatchBackend.loadProjectComments(project.id);}
    catch(error){console.error('Unable to load public project comments from Supabase.',error);status.textContent='Project details loaded, but comments could not be loaded.';commentsFailed=true;}
    renderComments();
    if(commentsFailed)status.textContent='Project details loaded, but comments could not be loaded.';
    else if(viewRecordFailed)status.textContent='Project details loaded, but the view could not be recorded.';
    status.hidden=!commentsFailed&&!viewRecordFailed;layout.hidden=false;
    document.getElementById('commentSort').addEventListener('change',renderComments);
    document.getElementById('commentForm').addEventListener('submit',async event=>{
      event.preventDefault();const input=document.getElementById('commentInput');const text=input.value.trim();
      if(!await window.devMatchBackend.ready){location.href='devmatch-auth.html?mode=login';return;}
      if(!text){input.setCustomValidity('Please enter a comment before posting.');input.reportValidity();return;}
      input.setCustomValidity('');
      try{comments.push(await window.devMatchBackend.addProjectComment(project.id,text));input.value='';renderComments();}
      catch(error){console.error('Unable to save the project request comment to Supabase.',error);window.alert('Unable to post your comment. Please log in and try again.');}
    });
    document.getElementById('commentInput').addEventListener('input',event=>event.target.setCustomValidity(''));
  }catch(error){
    console.error('Unable to load the public project request from Supabase.',error);
    status.textContent='Project details could not be loaded. Check your connection and try again.';
  }
})();
