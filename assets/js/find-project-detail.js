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
  function formatRequestDate(value,options={dateStyle:'medium'}){
    if(typeof value!=='string'||!value.trim())return '';
    const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(value);
    const monthOnly=/^\d{4}-\d{2}$/.test(value);
    const date=new Date(dateOnly?`${value}T00:00:00`:monthOnly?`${value}-01T00:00:00`:value);
    return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat(undefined,options).format(date);
  }
  function formatRequestMoney(value){
    const amount=String(value||'').replace(/\D/g,'');
    return amount?`Rp ${Number(amount).toLocaleString('id-ID')}`:'';
  }
  function renderReferenceLinks(references){
    const container=document.getElementById('requestReferenceLinks');
    container.replaceChildren();
    references.forEach(reference=>{
      if(typeof reference!=='string'||!reference.trim())return;
      const item=document.createElement('div');
      try{
        const url=new URL(reference);
        if(!['http:','https:'].includes(url.protocol))throw new TypeError('Unsupported reference URL protocol.');
        const link=document.createElement('a');
        link.href=url.href;
        link.target='_blank';
        link.rel='noopener noreferrer';
        link.textContent=url.hostname+url.pathname;
        item.append(link);
      }catch{
        item.textContent=reference;
      }
      container.append(item);
    });
    if(!container.childElementCount)container.textContent='Not provided';
  }
  async function renderReferenceFiles(requestId,attachments){
    const container=document.getElementById('requestReferenceFiles');
    const statusElement=document.getElementById('requestReferenceFilesStatus');
    container.dataset.requestId=requestId;
    container.replaceChildren();
    statusElement.hidden=true;
    if(!attachments.length)return;
    window.DEVMATCH_SKELETON?.status(statusElement,'Loading reference files',1);
    statusElement.hidden=false;
    let unavailable=0;
    await Promise.all(attachments.map(async attachment=>{
      const item=document.createElement('li');
      container.append(item);
      const name=typeof attachment?.name==='string'&&attachment.name?attachment.name:'Reference file';
      if(typeof attachment?.path!=='string'||!attachment.path){
        item.textContent=`${name} — unavailable`;
        unavailable++;
        return;
      }
      window.DEVMATCH_SKELETON?.text(item,`Loading ${name}`,'64%');
      try{
        const url=await window.devMatchBackend.createPrivateFileUrl(attachment.path,name);
        if(container.dataset.requestId!==requestId)return;
        const link=document.createElement('a');
        link.href=url;
        link.target='_blank';
        link.rel='noopener noreferrer';
        link.textContent=name;
        item.replaceChildren(link);
      }catch(error){
        console.error('Unable to create a private reference-file link.',error);
        if(container.dataset.requestId!==requestId)return;
        item.textContent=`${name} — unavailable`;
        unavailable++;
      }
    }));
    if(container.dataset.requestId!==requestId)return;
    statusElement.textContent=unavailable?'Some reference files could not be loaded.':'';
    statusElement.hidden=unavailable===0;
  }
  function formatCommentTime(value){
    if(typeof value!=='string'||!value)return '';
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return '';
    const minutes=Math.max(0,Math.floor((Date.now()-date.getTime())/60000));
    if(minutes<1)return 'Just now';
    if(minutes<60)return `${minutes}m ago`;
    const hours=Math.floor(minutes/60);
    if(hours<24)return `${hours}h ago`;
    const days=Math.floor(hours/24);
    return days<7?`${days}d ago`:date.toLocaleDateString();
  }
  let project=null,comments=[],favorites=[],viewRecordFailed=false,commenterRoles=new Map();
  let currentUserId=null,repliesSupported=true,replyTo=null,expandedReplies=new Set();
  async function loadCommenterRoles(){
    try{commenterRoles=await window.devMatchBackend.loadCommentAuthorRoles(comments);}
    catch(error){console.error('Unable to load project commenter profiles from Supabase.',error);commenterRoles=new Map();}
  }
  async function refreshProjectComments(){
    const result=await window.devMatchBackend.loadProjectComments(project.id);
    const replyInput=document.querySelector('#requestComments [data-inline-reply] textarea');
    const replyDraft=replyInput?.value;
    const replyHadFocus=replyInput===document.activeElement;
    comments=result.comments;
    repliesSupported=result.repliesSupported;
    await loadCommenterRoles();
    renderComments();
    const refreshedReplyInput=document.querySelector('#requestComments [data-inline-reply] textarea');
    if(refreshedReplyInput&&replyDraft!==undefined){
      refreshedReplyInput.value=replyDraft;
      if(replyHadFocus)refreshedReplyInput.focus();
    }
  }
  function subscribeToProjectComments(){
    const client=window.devMatchBackend.client;
    const channel=client.channel(`project-comments:${project.id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'comments',filter:`project_id=eq.${project.id}`},()=>{
        void refreshProjectComments().catch(error=>console.error('Unable to refresh project comments from Supabase.',error));
      })
      .subscribe(status=>{
        if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.error('Project comment real-time updates are unavailable.',status);
      });
    window.addEventListener('pagehide',()=>{void client.removeChannel(channel);},{once:true});
  }
  function profileAnchor(comment,content,className){
    const profileUrl=window.devMatchBackend.publicProfileUrl(comment.userId,comment.workspaceRole||commenterRoles.get(comment.userId));
    if(!profileUrl)return content;
    const name=comment.name||'DEV-MATCH member';
    return `<a class="${className}" href="${escapeHtml(profileUrl)}" aria-label="View ${escapeHtml(name)} profile">${content}</a>`;
  }
  function renderComments(){
    const ordered=document.getElementById('commentSort').value==='newest'?[...comments].reverse():comments;
    document.getElementById('commentsCount').textContent=String(comments.length);
    document.getElementById('commentsEmpty').hidden=comments.length>0;
    const commentIds=new Set(ordered.map(comment=>comment.id));
    const repliesByParent=new Map();
    ordered.forEach(comment=>{
      if(!comment.parentCommentId||!commentIds.has(comment.parentCommentId))return;
      if(!repliesByParent.has(comment.parentCommentId))repliesByParent.set(comment.parentCommentId,[]);
      repliesByParent.get(comment.parentCommentId).push(comment);
    });
    const collectDescendants=commentId=>{
      const descendants=[];
      const visit=repliesByParent.get(commentId)||[];
      visit.forEach(reply=>{
        descendants.push(reply);
        descendants.push(...collectDescendants(reply.id));
      });
      return descendants;
    };
    const commentById=new Map(comments.map(comment=>[comment.id,comment]));
    const renderComment=(comment,isRoot=false)=>{
      const name=escapeHtml(comment.name||'DEV-MATCH member');
      const avatar=profileAnchor(comment,`<span class="find-detail-avatar comment-system-avatar">${escapeHtml(comment.initials||'CL')}</span>`,'comment-profile-avatar-link');
      const author=profileAnchor(comment,name,'comment-profile-name-link');
      const isReplying=replyTo===comment.id;
      const replyButton=currentUserId&&repliesSupported&&!isReplying
        ?`<button class="find-comment-reply comment-system-reply" type="button" data-comment-reply="${escapeHtml(comment.id)}" aria-expanded="false">Reply</button>`
        :'';
      const replyForm=isReplying
        ?`<form class="find-comment-reply-form" data-inline-reply="${escapeHtml(comment.id)}"><label for="findReplyInput">Reply</label><div><textarea id="findReplyInput" maxlength="1000" placeholder="Write a reply…" aria-label="Reply to ${name}" required></textarea><button type="submit" aria-label="Post reply"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22 2 11 13M22 2 15 22 11 13 2 9 22 2"/></svg></button></div></form>`
        :'';
      const role=comment.workspaceRole||commenterRoles.get(comment.userId);
      const roleBadge=role==='dev'
        ?'<small class="find-comment-role-badge comment-system-role">Developer</small>'
        :role==='client'
          ?'<small class="find-comment-role-badge comment-system-role">Client</small>'
          :'';
      const parentComment=comment.parentCommentId?commentById.get(comment.parentCommentId):null;
      const parentRole=parentComment?.workspaceRole||commenterRoles.get(parentComment?.userId);
      const parentRoleBadge=parentRole==='dev'?'<small class="find-comment-role-badge comment-system-role">Developer</small>':parentRole==='client'?'<small class="find-comment-role-badge comment-system-role">Client</small>':'';
      const replyTarget=parentComment&&!isRoot?`<small class="find-comment-reply-target comment-system-target"><span class="find-comment-reply-arrow comment-system-target-arrow">▸</span> <span class="find-comment-reply-name comment-system-target-name">${escapeHtml(parentComment.name||'Member')}</span> ${parentRoleBadge}</small>`:'';
      const replies=isRoot?collectDescendants(comment.id):[];
      const replyToggle=replies.length
        ?(expandedReplies.has(comment.id)
          ?''
          :`<button class="find-comment-replies-toggle comment-system-view-replies" type="button" data-view-replies="${escapeHtml(comment.id)}" aria-expanded="false">View ${replies.length} ${replies.length===1?'reply':'replies'}</button>`)
        :'';
      const renderedReplies=isRoot&&expandedReplies.has(comment.id)
        ?`<div class="find-comment-replies comment-system-replies">${replies.map(reply=>renderComment(reply,false)).join('')}<button class="find-comment-replies-toggle comment-system-view-replies hide-replies-toggle" type="button" data-view-replies="${escapeHtml(comment.id)}" aria-expanded="true">Hide replies</button></div>`
        :'';
      return `<article class="find-comment comment-system-item"><div>${avatar}</div><div class="find-comment-body comment-system-body"><strong class="comment-system-author">${author} ${roleBadge}${replyTarget}</strong><p class="comment-system-text">${escapeHtml(comment.text||'')}</p><div class="comment-system-actions"><time class="comment-system-time" datetime="${escapeHtml(comment.time||'')}">${escapeHtml(formatCommentTime(comment.time))}</time><span class="comment-system-action-controls">${replyButton}${replyToggle}</span></div>${replyForm}</div></article>${renderedReplies}`;
    };
    document.getElementById('requestComments').innerHTML=ordered
      .filter(comment=>!comment.parentCommentId||!commentIds.has(comment.parentCommentId))
      .map(comment=>renderComment(comment,true)).join('');
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
  status.hidden=false;
  window.DEVMATCH_SKELETON?.status(status,'Loading project request');
  try{
    const {data:row,error}=await window.devMatchBackend.client.from('projects')
      .select('id,owner_id,title,project_type,category,price,data,status,created_at,updated_at')
      .eq('id',projectId).eq('project_kind','request').eq('status','open').maybeSingle();
    if(error)throw error;
    if(!row){status.hidden=true;notFound.hidden=false;return;}
    const {count:clientRequestCount,error:clientRequestCountError}=await window.devMatchBackend.client.from('projects')
      .select('id',{count:'exact',head:true}).eq('owner_id',row.owner_id).eq('project_kind','request').eq('status','open');
    if(clientRequestCountError)throw clientRequestCountError;
    const data=row.data&&typeof row.data==='object'&&!Array.isArray(row.data)?row.data:{};
    const categoryValue=String(row.category||data.category||'');
    const typeValue=String(row.project_type||data.projectType||data.type||'');
    const category=categoryValue==='Other'&&data.categoryOther?`Other · ${data.categoryOther}`:categoryValue;
    const type=typeValue==='Other'&&data.projectTypeOther?`Other · ${data.projectTypeOther}`:typeValue;
    const specialties=Array.isArray(data.specialties)?data.specialties
      :Array.isArray(data.stack)?data.stack
        :data.specialty?[data.specialty]:[];
    const budgetLabel=String(row.price||data.price||data.budget||data.budgetLabel
      ||(data.budgetFrom&&data.budgetTo?`${formatRequestMoney(data.budgetFrom)} — ${formatRequestMoney(data.budgetTo)}`:'')
      ||'Budget not specified');
    project={...data,id:row.id,title:String(row.title||data.title||'Project request'),type,category,
      description:String(data.description||data.overview||''),overview:String(data.overview||''),
      stack:specialties.map(value=>String(value).trim()).filter(Boolean),
      features:Array.isArray(data.features)?data.features:[],location:String(data.location||'Location not provided'),
      references:Array.isArray(data.references)?data.references:[],
      attachments:Array.isArray(data.attachments)?data.attachments:[],
      negotiable:data.negotiable===true,deadline:String(data.deadline||''),targetStart:String(data.targetStart||''),
      budgetLabel,popularity:0,ownerId:row.owner_id,createdAt:row.created_at||row.updated_at};
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
    const date=formatRequestDate(project.createdAt)||'Date unavailable';
    project.client=clientName;project.initials=initials(clientName);project.location=profileLocation;
    document.title=`${project.title} — Find Projects | DEV-MATCH`;
    document.getElementById('requestCategory').textContent=project.category;
    document.getElementById('requestBreadcrumbTitle').textContent=project.title;
    document.getElementById('requestClientAvatar').textContent=project.initials;
    document.getElementById('requestClientName').textContent=clientName;
    document.getElementById('requestClientMeta').textContent=project.location;
    const clientProfileUrl=`devmatch-client-profile.html?client=${encodeURIComponent(row.owner_id)}&from=find-projects`;
    document.getElementById('requestClientAvatarLink').href=clientProfileUrl;
    document.getElementById('requestClientNameLink').href=clientProfileUrl;
    document.getElementById('asideClientAvatar').textContent=project.initials;
    document.getElementById('asideClientName').textContent=clientName;
    document.getElementById('asideClientAvatarLink').href=clientProfileUrl;
    document.getElementById('asideClientAvatarLink').setAttribute('aria-label',`View ${clientName} profile`);
    document.getElementById('asideClientNameLink').href=clientProfileUrl;
    document.getElementById('asideClientLocation').textContent=project.location;
    const clientProjectsCount=clientRequestCount??0;
    const formatCount=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value))?Number(value).toLocaleString('id-ID'):'—';
    document.getElementById('asideClientProjects').textContent=formatCount(clientProjectsCount);
    document.getElementById('asideClientViews').textContent=formatCount(0);
    document.getElementById('asideClientFavorites').textContent=formatCount(0);
    document.getElementById('requestTitle').textContent=project.title;
    document.getElementById('requestDescription').textContent=project.description;
    document.getElementById('requestProjectType').textContent=project.type||'Not provided';
    document.getElementById('requestProjectCategory').textContent=project.category||'Not provided';
    document.getElementById('requestBudget').textContent=budgetLabel;
    document.getElementById('requestNegotiableFact').hidden=!project.negotiable;
    const deadline=formatRequestDate(project.deadline,{dateStyle:'long'});
    document.getElementById('requestDeadline').textContent=deadline;
    document.getElementById('requestDeadlineFact').hidden=!deadline;
    const targetStart=formatRequestDate(project.targetStart,{month:'long',year:'numeric'});
    document.getElementById('requestTargetStart').textContent=targetStart||'Not provided';
    document.getElementById('requestCreated').textContent=date;
    document.getElementById('requestOverview').textContent=project.overview;
    document.getElementById('requestOverviewSection').hidden=!project.overview;
    document.getElementById('requestFeatures').innerHTML=project.features.map(feature=>`<li>${escapeHtml(feature)}</li>`).join('');
    document.getElementById('requestRequirementsSection').hidden=project.features.length===0;
    const stackValues=project.stack.map(value=>value==='Other'&&data.specialtyOther?`Other · ${data.specialtyOther}`:value);
    document.getElementById('requestStack').innerHTML=stackValues.map(value=>`<span>${escapeHtml(value)}</span>`).join('');
    document.getElementById('requestSpecialtySection').hidden=stackValues.length===0;
    renderReferenceLinks(project.references);
    document.getElementById('requestReferencesSection').hidden=project.attachments.length===0;
    await renderReferenceFiles(project.id,project.attachments);
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
          }:null,
          saved ? null : {tab: 'projects'}
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
    subscribeToProjectComments();
    document.getElementById('commentSort').addEventListener('change',renderComments);
    document.getElementById('commentInput').addEventListener('keydown',submitCommentOnEnter);
    document.getElementById('requestComments').addEventListener('click',event=>{
      const viewReplies=event.target.closest('[data-view-replies]');
      if(viewReplies){
        const commentId=viewReplies.dataset.viewReplies;
        if(expandedReplies.has(commentId))expandedReplies.delete(commentId);
        else expandedReplies.add(commentId);
        renderComments();
        return;
      }
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
        const parentId=form.dataset.inlineReply;
        const addedReply=await window.devMatchBackend.addProjectCommentReply(project.id,parentId,text);
        if(!comments.some(comment=>comment.id===addedReply.id))comments.push(addedReply);
        expandedReplies.add(parentId);
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
        const addedComment=await window.devMatchBackend.addProjectComment(project.id,text);
        if(!comments.some(comment=>comment.id===addedComment.id))comments.push(addedComment);
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
