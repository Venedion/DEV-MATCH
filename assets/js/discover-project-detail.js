(async function(){
  'use strict';
  const projectId=new URLSearchParams(location.search).get('project');
  const layout=document.getElementById('projectDetailLayout');
  const notFound=document.getElementById('projectNotFound');
  const status=document.getElementById('projectStatus');
  const favoriteToast=document.getElementById('favoriteActionToast');
  const favoriteRemoveDialog=document.getElementById('favoriteRemoveDialog');
  const favoriteRemoveMessage=document.getElementById('favoriteRemoveMessage');
  const favoritesKey='devmatch-client-project-favorites';
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const initials=name=>(String(name||'').match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'DM';
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
  function readJson(key,fallback){try{const value=localStorage.getItem(key);return value?JSON.parse(value):fallback;}catch{return fallback;}}
  async function loadCommenterRoles(){
    try{commenterRoles=await window.devMatchBackend.loadCommentAuthorRoles(comments);}
    catch(error){console.error('Unable to load project commenter profiles from Supabase.',error);commenterRoles=new Map();}
  }
  async function refreshProjectComments(){
    const result=await window.devMatchBackend.loadProjectComments(project.id);
    const replyInput=document.querySelector('#commentList [data-inline-reply] textarea');
    const replyDraft=replyInput?.value;
    const replyHadFocus=replyInput===document.activeElement;
    comments=result.comments;
    repliesSupported=result.repliesSupported;
    await loadCommenterRoles();
    renderComments();
    const refreshedReplyInput=document.querySelector('#commentList [data-inline-reply] textarea');
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
  function updateFavoriteButtons(saved){
    const button=document.getElementById('detailFavoriteAction');
    button.setAttribute('aria-pressed',String(saved));
    button.querySelector('span').textContent=saved?'Added to Favorites':'Add to Favorites';
  }
  function renderComments(){
    const ordered=document.getElementById('commentSort').value==='newest'?[...comments].reverse():comments;
    document.getElementById('detailCommentCount').textContent=String(comments.length);
    document.getElementById('commentsHeadingCount').textContent=String(comments.length);
    document.getElementById('projectCommentsStat').textContent=`${comments.length} comments`;
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
      const avatar=profileAnchor(comment,`<span class="discover-detail-avatar comment-system-avatar">${escapeHtml(comment.initials||'CL')}</span>`,'comment-profile-avatar-link');
      const author=profileAnchor(comment,name,'comment-profile-name-link');
      const role=comment.workspaceRole||commenterRoles.get(comment.userId);
      const roleBadge=role==='dev'
        ?'<small class="discover-comment-role-badge comment-system-role">Developer</small>'
        :role==='client'
          ?'<small class="discover-comment-role-badge comment-system-role">Client</small>'
          :'';
      const parentComment=comment.parentCommentId?commentById.get(comment.parentCommentId):null;
      const parentRole=parentComment?.workspaceRole||commenterRoles.get(parentComment?.userId);
      const parentRoleBadge=parentRole==='dev'?'<small class="discover-comment-role-badge comment-system-role">Developer</small>':parentRole==='client'?'<small class="discover-comment-role-badge comment-system-role">Client</small>':'';
      const replyTarget=parentComment&&!isRoot?`<small class="discover-comment-reply-target comment-system-target"><span class="discover-comment-reply-arrow comment-system-target-arrow">▸</span> <span class="discover-comment-reply-name comment-system-target-name">${escapeHtml(parentComment.name||'Member')}</span> ${parentRoleBadge}</small>`:'';
      const isReplying=replyTo===comment.id;
      const replyButton=currentUserId&&repliesSupported&&!isReplying
        ?`<button class="discover-comment-reply comment-system-reply" type="button" data-comment-reply="${escapeHtml(comment.id)}">Reply</button>`
        :'';
      const replyForm=isReplying
        ?`<form class="discover-comment-reply-form comment-system-reply-form" data-inline-reply="${escapeHtml(comment.id)}"><label for="discoverReplyInput">Reply</label><div><textarea id="discoverReplyInput" maxlength="1000" placeholder="Write a reply…" aria-label="Reply to ${name}" required></textarea><button type="submit" aria-label="Post reply"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22 2 11 13M22 2 15 22 11 13 2 9 22 2"/></svg></button></div></form>`
        :'';
      const replies=isRoot?collectDescendants(comment.id):[];
      const replyToggle=replies.length
        ?(expandedReplies.has(comment.id)
          ?''
          :`<button class="discover-comment-replies-toggle comment-system-view-replies" type="button" data-view-replies="${escapeHtml(comment.id)}" aria-expanded="false">View ${replies.length} ${replies.length===1?'reply':'replies'}</button>`)
        :'';
      const renderedReplies=isRoot&&expandedReplies.has(comment.id)
        ?`<div class="discover-comment-replies comment-system-replies">${replies.map(reply=>renderComment(reply,false)).join('')}<button class="discover-comment-replies-toggle comment-system-view-replies hide-replies-toggle" type="button" data-view-replies="${escapeHtml(comment.id)}" aria-expanded="true">Hide replies</button></div>`
        :'';
      return `<article class="discover-comment comment-system-item"><div>${avatar}</div><div class="discover-comment-body comment-system-body"><strong class="comment-system-author">${author} ${roleBadge}${replyTarget}</strong><p class="comment-system-text">${escapeHtml(comment.text||'')}</p><div class="comment-system-actions"><time class="comment-system-time" datetime="${escapeHtml(comment.time||'')}">${escapeHtml(formatCommentTime(comment.time))}</time><span class="comment-system-action-controls">${replyButton}${replyToggle}</span></div>${replyForm}</div></article>${renderedReplies}`;
    };
    document.getElementById('commentList').innerHTML=ordered
      .filter(comment=>!comment.parentCommentId||!commentIds.has(comment.parentCommentId))
      .map(comment=>renderComment(comment,true)).join('');
  }
  function submitCommentOnEnter(event){
    if(event.key!=='Enter'||event.shiftKey||event.isComposing||event.keyCode===229)return;
    event.preventDefault();
    if(event.repeat)return;
    const form=event.target.form;
    if(form&&!form.querySelector('button[type="submit"]').disabled)form.requestSubmit();
  }
  function initializeDetailLayout(){
    const preview=document.getElementById('projectPreview');
    const art=['food-art','dashboard-art','analytics-art','store-art','inventory-art'].includes(project.art)?project.art:'dashboard-art';
    preview.classList.add(art);
    document.getElementById('previewCategory').textContent=project.category;
    document.getElementById('previewHeading').textContent=project.title;
    document.getElementById('previewDescription').textContent=project.description;
    document.getElementById('thumbnailTitle').textContent=project.title;
    const targets={overview:'detailOverviewSection',included:'detailIncludedSection',details:'detailFactsSection',comments:'commentsSection'};
    const tabs=document.querySelectorAll('[data-project-tab]');
    tabs.forEach(button=>button.addEventListener('click',()=>{
      tabs.forEach(tab=>{
        const active=tab===button;
        tab.classList.toggle('is-active',active);
        if(active)tab.setAttribute('aria-current','location');
        else tab.removeAttribute('aria-current');
      });
      const section=document.getElementById(targets[button.dataset.projectTab]);
      section.focus({preventScroll:true});
      section.scrollIntoView({block:'start',inline:'nearest'});
    }));
    const services=[...new Set(Array.isArray(project.services)?project.services:[])];
    const included=document.getElementById('detailIncludedServices');
    included.replaceChildren(...services.map(service=>{
      const item=document.createElement('li');
      item.textContent=service;
      return item;
    }));
    included.hidden=!services.length;
    document.getElementById('detailIncludedEmpty').hidden=Boolean(services.length);
    document.getElementById('detailTypeFull').textContent=project.type;
    document.getElementById('detailCategory').textContent=project.category;
    document.getElementById('detailCreatedFull').textContent=project.created;
    document.getElementById('detailMetaType').textContent=project.type;
    document.getElementById('detailMetaCategory').textContent=project.category;
    document.getElementById('detailMetaCreated').textContent=project.created;
  }
  async function setFavorite(){
    const user=await window.devMatchBackend.ready;
    if(!user){location.href='devmatch-auth.html?mode=login';return;}
    const saved=favorites.includes(project.id);
    if(saved&&!await window.DEVMATCH_FAVORITE_FEEDBACK.confirmRemoval(
      favoriteRemoveDialog,
      favoriteRemoveMessage,
      project.title
    ))return;
    try{
      await window.devMatchBackend.setFavorite('project',project.id,!saved);
      favorites=saved?favorites.filter(id=>id!==project.id):[...favorites,project.id];
      localStorage.setItem(favoritesKey,JSON.stringify(favorites));
      updateFavoriteButtons(!saved);document.getElementById('favoriteCount').textContent=String(favorites.length);
      window.DEVMATCH_NAV_BADGES?.updateFavorites();
      window.DEVMATCH_FAVORITE_FEEDBACK.showToast(
        favoriteToast,
        saved?'Project removed from your favorites':'Project added to your favorites',
        saved?async()=>{
          try{await window.devMatchBackend.setFavorite('project',project.id,true);}
          catch(error){
            console.error('Unable to restore project favorite in Supabase.',error);
            window.alert('Unable to restore this favorite. Please try again.');
            return false;
          }
          if(!favorites.includes(project.id))favorites=[...favorites,project.id];
          localStorage.setItem(favoritesKey,JSON.stringify(favorites));
          updateFavoriteButtons(true);
          document.getElementById('favoriteCount').textContent=String(favorites.length);
          window.DEVMATCH_NAV_BADGES?.updateFavorites();
          return true;
        }:null,
        saved ? null : {tab: 'projects'}
      );
    }catch(error){console.error('Unable to update saved projects in Supabase.',error);window.alert('Unable to save this project. Please try again.');}
  }
  if(!projectId){status.hidden=true;notFound.hidden=false;layout.hidden=true;return;}
  status.hidden=false;
  window.DEVMATCH_SKELETON?.status(status,'Loading project details');
  try{
    const {data:row,error}=await window.devMatchBackend.client.from('projects')
      .select('id,owner_id,title,project_type,category,price,cover_image,status,data,created_at,updated_at')
      .eq('id',projectId).eq('project_kind','portfolio').eq('status','published').maybeSingle();
    if(error)throw error;
    if(!row){status.hidden=true;notFound.hidden=false;layout.hidden=true;return;}
    const data=row.data&&typeof row.data==='object'?row.data:{};
    project={...data,id:row.id,title:row.title,type:row.project_type,category:row.category,
      price:row.price||data.price||'',description:String(data.description||data.overview||''),
      overview:String(data.overview||data.description||''),stack:Array.isArray(data.stack)?data.stack.join(', '):String(data.stack||''),
      created:new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(row.created_at||row.updated_at)),
      link:String(data.link||data.url||''),ownerId:row.owner_id,art:String(data.art||''),views:'—',favorites:'—',initials:'DM'};
    let developerName='DEV-MATCH member',developerLocation='Location not provided',specialty='Developer',developerBio='No biography provided.';
    const user=await window.devMatchBackend.ready;
    currentUserId=user?.id||null;
    let accountRole=null;
    if(user){
      try{await window.devMatchBackend.recordProjectView(project.id);}
      catch(error){console.error('Unable to record the public project view in Supabase.',error);viewRecordFailed=true;}
      const account = await window.devMatchBackend.loadProfile(user);
      accountRole=account.account_role;
      if(accountRole==='client'){
        const {data:person,error:personError}=await window.devMatchBackend.client.from('directory_people')
          .select('id,display_name,username,account_role,profile_data,published_portfolio_count')
          .eq('id',row.owner_id).eq('account_role','dev').maybeSingle();
        if(personError)throw personError;
        if(person){
          const profile=person.profile_data||{};
          developerName=String(person.display_name||developerName);
          developerLocation=String(profile.city||developerLocation);
          specialty=String(profile.specialtyOther||profile.specialty||specialty);
          developerBio=String(profile.bio||developerBio);
        }
        const records=await window.devMatchBackend.loadFavorites();
        favorites=records.filter(item=>item.type==='project').map(item=>item.id);
      }
    }
    project.initials=initials(developerName);
    document.title=`${project.title} — Discover Projects | DEV-MATCH`;
    document.getElementById('detailBreadcrumbTitle').textContent=project.title;
    document.getElementById('detailBreadcrumbCategory').textContent=project.category;
    document.getElementById('detailTitle').textContent=project.title;
    document.getElementById('detailPrice').textContent=project.price||'Price not specified';
    document.getElementById('detailOverview').textContent=project.overview;
    document.getElementById('detailStack').textContent=project.stack;
    document.getElementById('detailDeveloperViews').textContent='—';
    document.getElementById('detailDeveloperFavorites').textContent='—';
    document.getElementById('detailDeveloperProjects').textContent=user?'':'';
    document.getElementById('asideDeveloperAvatar').textContent=project.initials;
    document.getElementById('asideDeveloperName').textContent=developerName;
    document.getElementById('asideDeveloperHandle').textContent='';
    document.getElementById('detailDeveloperBio').textContent=developerBio;
    document.getElementById('asideDeveloperLocation').textContent=developerLocation;
    document.getElementById('asideDeveloperSpecialty').textContent=specialty;
    document.getElementById('contactDeveloper').href=user&&accountRole==='client'?`devmatch-chat.html?role=client&project=${encodeURIComponent(project.id)}`:'devmatch-auth.html?mode=login';
    document.getElementById('developerProfileLink').href=`devmatch-developer-profile.html?developer=${encodeURIComponent(row.owner_id)}`;
    document.getElementById('clientCommentAvatar').textContent=initials(readJson('devmatch-profile-client',{}).displayName||'Client');
    const liveLink=document.getElementById('detailLiveLink');
    let safeLiveUrl='';
    try{const parsed=new URL(/^[a-z][a-z\d+.-]*:/i.test(project.link)?project.link:`https://${project.link}`);if(['http:','https:'].includes(parsed.protocol))safeLiveUrl=parsed.href;}catch{}
    if(safeLiveUrl){
      liveLink.href=safeLiveUrl;liveLink.textContent=project.link;liveLink.hidden=false;
      const liveDemo=document.getElementById('detailLiveDemo');liveDemo.href=safeLiveUrl;liveDemo.hidden=false;
    }
    const {data:rows,error:projectsError}=await window.devMatchBackend.client.from('projects')
      .select('id').eq('owner_id',row.owner_id).eq('project_kind','portfolio').eq('status','published');
    if(projectsError)throw projectsError;
    document.getElementById('detailDeveloperProjects').textContent=String(rows.length);
    document.getElementById('favoriteCount').textContent=String(favorites.length);
    const favoriteButton=document.getElementById('detailFavoriteAction');
    favoriteButton.hidden=!user||accountRole!=='client';
    updateFavoriteButtons(favorites.includes(project.id));
    let commentsFailed=false;
    try{
      const result=await window.devMatchBackend.loadProjectComments(project.id);
      comments=result.comments;
      repliesSupported=result.repliesSupported;
    }
    catch(error){console.error('Unable to load public project comments from Supabase.',error);commentsFailed=true;}
    await loadCommenterRoles();
    initializeDetailLayout();renderComments();layout.hidden=false;
    subscribeToProjectComments();
    document.getElementById('detailFavoriteAction').addEventListener('click',setFavorite);
    document.getElementById('commentSort').addEventListener('change',renderComments);
    document.getElementById('commentInput').addEventListener('keydown',submitCommentOnEnter);
    document.getElementById('commentList').addEventListener('click',event=>{
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
      if(replyTo)document.querySelector('#commentList [data-inline-reply] textarea').focus();
    });
    document.getElementById('commentList').addEventListener('keydown',event=>{
      if(event.target.matches('[data-inline-reply] textarea'))submitCommentOnEnter(event);
    });
    document.getElementById('commentList').addEventListener('input',event=>{
      if(event.target.matches('[data-inline-reply] textarea'))event.target.setCustomValidity('');
    });
    document.getElementById('commentList').addEventListener('submit',async event=>{
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
        replyTo=null;
        renderComments();
      }catch(error){
        console.error('Unable to save the project reply to Supabase.',error);
        window.alert('Unable to post your reply. Please try again.');
        submit.disabled=false;
      }
    });
    document.getElementById('commentForm').addEventListener('submit',async event=>{
      event.preventDefault();const input=document.getElementById('commentInput');const text=input.value.trim();
      if(!text){input.setCustomValidity('Please enter a comment before posting.');input.reportValidity();return;}
      input.setCustomValidity('');
      try{
        const user=await window.devMatchBackend.ready;
        if(!user){location.href='devmatch-auth.html?mode=login';return;}
        const addedComment=await window.devMatchBackend.addProjectComment(project.id,text);
        if(!comments.some(comment=>comment.id===addedComment.id))comments.push(addedComment);
        await loadCommenterRoles();
        input.value='';
        renderComments();
      }
      catch(error){console.error('Unable to save the project comment to Supabase.',error);window.alert('Unable to post your comment. Please log in and try again.');}
    });
    document.getElementById('commentInput').addEventListener('input',event=>event.target.setCustomValidity(''));
    if(commentsFailed)status.textContent='Project details loaded, but comments could not be loaded.';
    else if(viewRecordFailed)status.textContent='Project details loaded, but the view could not be recorded.';
    status.hidden=!commentsFailed&&!viewRecordFailed;
    if(location.hash==='#commentsSection')document.querySelector('[data-project-tab="comments"]').click();
  }catch(error){
    console.error('Unable to load the public project from Supabase.',error);
    status.textContent='Project details could not be loaded. Check your connection and try again.';
  }
})();
