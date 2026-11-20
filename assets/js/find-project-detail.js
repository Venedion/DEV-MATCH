(async function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  const projectId=params.get('request');
  if(params.get('modal')==='1'){
    document.body.classList.add('is-modal-detail');
    const base=document.createElement('base');
    base.target='_top';
    document.head.prepend(base);
  }
  const layout=document.getElementById('requestDetailLayout');
  const notFound=document.getElementById('requestNotFound');
  const status=document.getElementById('requestStatus');
  const favoriteToast=document.getElementById('favoriteActionToast');
  const favoriteRemoveDialog=document.getElementById('favoriteRemoveDialog');
  const favoriteRemoveMessage=document.getElementById('favoriteRemoveMessage');
  const favoritesKey='devmatch-developer-project-favorites';
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const initials=name=>(String(name||'').match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'CL';
  function formatCommentTime(value){
    if(typeof value!=='string'||!value)return '';
    const date=new Date(value);
    return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date);
  }
  let project=null,comments=[],favorites=[],viewRecordFailed=false,commenterRoles=new Map();
  let currentUserId=null,repliesSupported=true,replyTo=null;
  async function loadCommenterRoles(){
    try{commenterRoles=await window.devMatchBackend.loadCommentAuthorRoles(comments);}
    catch(error){console.error('Unable to load project commenter profiles from Supabase.',error);commenterRoles=new Map();}
  }
  function profileAnchor(comment,content,className){
    const profileUrl=window.devMatchBackend.publicProfileUrl(comment.userId,commenterRoles.get(comment.userId));
    if(!profileUrl)return content;
    const name=comment.name||'DEV-MATCH member';
    return `<a class="${className}" href="${escapeHtml(profileUrl)}" aria-label="View ${escapeHtml(name)} profile">${content}</a>`;
  }
  function renderComments(){
    const ordered=document.getElementById('commentSort').value==='newest'?[...comments].reverse():comments;
    document.getElementById('commentsCount').textContent=String(comments.length);
    document.getElementById('requestCommentCount').textContent=`▢ ${comments.length} comments`;
    document.getElementById('commentsEmpty').hidden=comments.length>0;
    const commentIds=new Set(ordered.map(comment=>comment.id));
    const repliesByParent=new Map();
    ordered.forEach(comment=>{
      if(!comment.parentCommentId||!commentIds.has(comment.parentCommentId))return;
      if(!repliesByParent.has(comment.parentCommentId))repliesByParent.set(comment.parentCommentId,[]);
      repliesByParent.get(comment.parentCommentId).push(comment);
    });
    const renderComment=comment=>{
      const name=escapeHtml(comment.name||'DEV-MATCH member');
      const avatar=profileAnchor(comment,`<span class="find-detail-avatar">${escapeHtml(comment.initials||'CL')}</span>`,'comment-profile-avatar-link');
      const author=profileAnchor(comment,name,'comment-profile-name-link');
      const isReplying=replyTo===comment.id;
      const replyButton=currentUserId&&repliesSupported&&!isReplying
        ?`<button class="find-comment-reply" type="button" data-comment-reply="${escapeHtml(comment.id)}" aria-expanded="false">Reply</button>`
        :'';
      const replyForm=isReplying
        ?`<form class="find-comment-reply-form" data-inline-reply="${escapeHtml(comment.id)}"><label for="findReplyInput">Reply</label><div><textarea id="findReplyInput" maxlength="1000" placeholder="Write a reply…" aria-label="Reply to ${name}" required></textarea><button type="submit" aria-label="Post reply"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22 2 11 13M22 2 15 22 11 13 2 9 22 2"/></svg></button></div></form>`
        :'';
      const replyBadge=comment.parentCommentId?'<small class="find-comment-reply-badge">Reply</small>':'';
      const replies=repliesByParent.get(comment.id)||[];
      return `<article class="find-comment"><div>${avatar}</div><div class="find-comment-body"><strong>${author} ${replyBadge}</strong><time datetime="${escapeHtml(comment.time||'')}">${escapeHtml(formatCommentTime(comment.time))}</time><p>${escapeHtml(comment.text||'')}</p>${replyButton}</div></article>${replyForm}${replies.length?`<div class="find-comment-replies">${replies.map(renderComment).join('')}</div>`:''}`;
    };
    document.getElementById('requestComments').innerHTML=ordered
      .filter(comment=>!comment.parentCommentId||!commentIds.has(comment.parentCommentId))
      .map(renderComment).join('');
  }
  function clearReplyTarget(){
    replyTo=null;
  }
  function submitCommentOnEnter(event){
    if(event.key!=='Enter'||event.shiftKey||event.isComposing||event.keyCode===229)return;
    event.preventDefault();
    if(event.repeat)return;
    const form=event.target.form;
    if(form&&!form.querySelector('button[type="submit"]').disabled)form.requestSubmit();
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
    const {count:clientRequestCount,error:clientRequestCountError}=await window.devMatchBackend.client.from('projects')
      .select('id',{count:'exact',head:true}).eq('owner_id',row.owner_id).eq('project_kind','request').eq('status','open');
    if(clientRequestCountError)throw clientRequestCountError;
    const data=row.data&&typeof row.data==='object'?row.data:{};
    project={...data,id:row.id,title:row.title,type:row.project_type,category:row.category,
      budgetLabel:row.price||data.budgetLabel||data.budget||'Budget not specified',
      description:String(data.description||data.overview||''),overview:String(data.overview||data.description||''),
      stack:Array.isArray(data.stack)?data.stack:String(data.stack||''),
      features:Array.isArray(data.features)?data.features:[],location:String(data.location||'Location not provided'),
      popularity:0,ownerId:row.owner_id,createdAt:row.created_at||row.updated_at};
    let clientName='DEV-MATCH member',profileLocation='Location not provided',accountRole=null;
    const user=await window.devMatchBackend.ready;
    currentUserId=user?.id||null;
    if(user){
      try{await window.devMatchBackend.recordProjectView(project.id);}
      catch(error){console.error('Unable to record the project request view in Supabase.',error);viewRecordFailed=true;}
      const account = await window.devMatchBackend.loadProfile(user);
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
    document.getElementById('requestTypeLabel').textContent=project.category;
    document.getElementById('requestPreviewCategory').textContent=[project.category,project.type].filter(Boolean).join(' · ');
    document.getElementById('requestPreviewTitle').textContent=project.title;
    document.getElementById('requestPreviewDescription').textContent=project.description;
    document.getElementById('asideClientAvatar').textContent=project.initials;
    document.getElementById('asideClientName').textContent=clientName;
    const clientProfileUrl=`devmatch-client-profile.html?client=${encodeURIComponent(row.owner_id)}&from=find-projects`;
    document.getElementById('asideClientAvatarLink').href=clientProfileUrl;
    document.getElementById('asideClientAvatarLink').setAttribute('aria-label',`View ${clientName} profile`);
    document.getElementById('asideClientNameLink').href=clientProfileUrl;
    document.getElementById('asideClientLocation').textContent=project.location;
    document.getElementById('asideClientMeta').textContent=`Posted ${date}`;
    document.getElementById('asideClientRequestCount').textContent=String(clientRequestCount??0);
    document.getElementById('requestTags').innerHTML=[project.category,project.type].filter(Boolean).map(value=>`<span>${escapeHtml(value)}</span>`).join('');
    document.getElementById('requestTitle').textContent=project.title;
    document.getElementById('requestDescription').textContent=project.description;
    document.getElementById('requestBudget').textContent=project.budgetLabel;
    document.getElementById('requestOverview').textContent=project.overview;
    document.getElementById('requestFeatures').innerHTML=project.features.map(feature=>`<li>${escapeHtml(feature)}</li>`).join('');
    document.getElementById('requestRequirementsSection').hidden=project.features.length===0;
    const stackValues=(Array.isArray(project.stack)?project.stack:String(project.stack).split(/\s+(?:and|,)\s+/)).filter(Boolean);
    document.getElementById('requestStack').innerHTML=stackValues.map(value=>`<span>${escapeHtml(value)}</span>`).join('');
    document.getElementById('requestSpecialtySection').hidden=stackValues.length===0;
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
      if(saved&&!await window.DEVMATCH_FAVORITE_FEEDBACK.confirmRemoval(
        favoriteRemoveDialog,
        favoriteRemoveMessage,
        project.title
      ))return;
      try{
        await window.devMatchBackend.setFavorite('project',project.id,!saved);
        favorites=saved?favorites.filter(id=>id!==project.id):[...favorites,project.id];
        updateSaveButton(!saved);
        window.DEVMATCH_NAV_BADGES?.updateFavorites();
        window.DEVMATCH_FAVORITE_FEEDBACK.showToast(
          favoriteToast,
          saved?'Request removed from your favorites':'Request added to your favorites',
          saved?async()=>{
            try{await window.devMatchBackend.setFavorite('project',project.id,true);}
            catch(error){
              console.error('Unable to restore saved project request in Supabase.',error);
              window.alert('Unable to restore this favorite. Please try again.');
              return false;
            }
            if(!favorites.includes(project.id))favorites=[...favorites,project.id];
            updateSaveButton(true);
            window.DEVMATCH_NAV_BADGES?.updateFavorites();
            return true;
          }:null
        );
      }catch(error){console.error('Unable to update saved project requests in Supabase.',error);window.alert('Unable to save this request. Please try again.');}
    });
    const {data:similar,error:similarError}=await window.devMatchBackend.client.from('projects')
      .select('id,title,price,category').eq('project_kind','request').eq('status','open').neq('id',project.id)
      .order('updated_at',{ascending:false}).limit(4);
    if(similarError)throw similarError;
    renderSimilarRequests(similar||[]);
    let commentsFailed=false;
    try{
      const result=await window.devMatchBackend.loadProjectComments(project.id);
      comments=result.comments;
      repliesSupported=result.repliesSupported;
    }
    catch(error){console.error('Unable to load public project comments from Supabase.',error);status.textContent='Project details loaded, but comments could not be loaded.';commentsFailed=true;}
    await loadCommenterRoles();
    renderComments();
    if(commentsFailed)status.textContent='Project details loaded, but comments could not be loaded.';
    else if(viewRecordFailed)status.textContent='Project details loaded, but the view could not be recorded.';
    status.hidden=!commentsFailed&&!viewRecordFailed;layout.hidden=false;
    document.getElementById('commentSort').addEventListener('change',renderComments);
    document.getElementById('commentInput').addEventListener('keydown',submitCommentOnEnter);
    document.getElementById('requestComments').addEventListener('click',event=>{
      const button=event.target.closest('[data-comment-reply]');
      if(!button||!currentUserId)return;
      const parent=comments.find(comment=>comment.id===button.dataset.commentReply);
      if(!parent)return;
      replyTo=replyTo===parent.id?null:parent.id;
      renderComments();
      if(replyTo)document.querySelector('#requestComments [data-inline-reply] textarea').focus();
    });
    document.getElementById('requestComments').addEventListener('keydown',event=>{
      if(event.target.matches('[data-inline-reply] textarea'))submitCommentOnEnter(event);
    });
    document.getElementById('requestComments').addEventListener('submit',async event=>{
      const form=event.target.closest('[data-inline-reply]');
      if(!form)return;
      event.preventDefault();
      const input=form.querySelector('textarea');
      const text=input.value.trim();
      if(!text){input.setCustomValidity('Please enter a reply before posting.');input.reportValidity();return;}
      input.setCustomValidity('');
      const submit=form.querySelector('button[type="submit"]');
      submit.disabled=true;
      try{
        const user=await window.devMatchBackend.ready;
        if(!user){location.href='devmatch-auth.html?mode=login';return;}
        comments.push(await window.devMatchBackend.addProjectCommentReply(project.id,form.dataset.inlineReply,text));
        await loadCommenterRoles();
        clearReplyTarget();
        renderComments();
      }
      catch(error){
        console.error('Unable to save the project request reply to Supabase.',error);
        window.alert('Unable to post your reply. Please try again.');
        submit.disabled=false;
      }
    });
    document.getElementById('requestComments').addEventListener('input',event=>{
      if(event.target.matches('[data-inline-reply] textarea'))event.target.setCustomValidity('');
    });
    document.getElementById('commentForm').addEventListener('submit',async event=>{
      event.preventDefault();const input=document.getElementById('commentInput');const text=input.value.trim();
      const user=await window.devMatchBackend.ready;
      if(!user){location.href='devmatch-auth.html?mode=login';return;}
      if(!text){input.setCustomValidity('Please enter a comment before posting.');input.reportValidity();return;}
      input.setCustomValidity('');
      try{
        comments.push(await window.devMatchBackend.addProjectComment(project.id,text));
        await loadCommenterRoles();
        input.value='';
        renderComments();
      }
      catch(error){console.error('Unable to save the project request comment to Supabase.',error);window.alert('Unable to post your comment. Please log in and try again.');}
    });
    document.getElementById('commentInput').addEventListener('input',event=>event.target.setCustomValidity(''));
  }catch(error){
    console.error('Unable to load the public project request from Supabase.',error);
    status.textContent='Project details could not be loaded. Check your connection and try again.';
  }
})();
