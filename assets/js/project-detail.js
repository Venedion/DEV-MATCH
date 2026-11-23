(function(){
  'use strict';
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
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
  function ensureProjectDetailDialog(){
    const existing=document.getElementById('projectDetailDialog');
    if(existing)return existing;
    const template=document.createElement('template');
    template.innerHTML=`<dialog class="project-detail-dialog" id="projectDetailDialog" aria-labelledby="projectTitle">
      <div class="detail-dialog-bar">
        <a class="detail-brand" href="devmatch-client-dashboard.html"><img class="brand-mark" src="assets/images/devmatch-logo.png" width="35" height="35" alt="" aria-hidden="true"><span>DEV-MATCH</span></a>
        <span class="detail-modal-label">Project details</span>
        <button class="close-detail" id="closeProjectDetail" type="button" aria-label="Close project details"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 3 10 10M13 3 3 13"/></svg></button>
      </div>
      <div class="detail-page">
        <div class="detail-error" id="detailError" role="alert" hidden></div>
        <div id="projectContent" hidden>
          <section class="project-detail-grid">
            <article class="detail-main-column">
              <div class="project-cover" id="projectCover" aria-hidden="true"></div>
              <div class="preview-project-body">
                <div class="preview-project-category"><span id="projectCategory"></span><span>· Published project</span></div>
                <h1 id="projectTitle"></h1>
                <p class="project-subtitle" id="projectSummary"></p>
                <div class="preview-project-metrics"><span>◉ <b id="projectViews">0</b> views</span><span>♡ <b id="projectFavorites">0</b> favorites</span><span>▢ <b id="commentCount">0</b> comments</span></div>
                <nav class="preview-project-tabs" aria-label="Project overview sections"><a href="#projectAbout">Overview</a><a href="#projectIncluded">What's included</a><span>Comments</span></nav>
              </div>
              <section class="detail-section" id="projectAbout">
                <h2>About this project</h2>
                <p id="projectOverview"></p>
                <p id="projectStack"></p>
              </section>
              <section class="detail-section included-section" id="projectIncluded">
                <h2>What's included</h2>
                <div class="included-grid" id="projectIncludedGrid"></div>
              </section>
              <section class="detail-section">
                <h2>Project details</h2>
                <dl class="project-facts">
                  <div><dt>Project type</dt><dd id="projectType"></dd></div>
                  <div><dt>Category</dt><dd id="projectFactCategory"></dd></div>
                  <div><dt>Pricing type</dt><dd id="projectPriceType">Starting from</dd></div>
                  <div><dt>Project preview</dt><dd><a id="projectLink" target="_blank" rel="noopener noreferrer" hidden></a><span id="projectLinkUnavailable">Not provided</span></dd></div>
                  <div><dt>Created</dt><dd id="projectCreated"></dd></div>
                </dl>
              </section>
              <section class="detail-section comments-section comment-system">
                <div class="comments-heading comment-system-heading"><h2>Comments</h2><label class="sort-comments"><select aria-label="Sort comments"><option>Newest</option><option>Oldest</option></select></label></div>
                <form class="comment-form comment-system-form" id="commentForm">
                  <span class="comment-avatar comment-system-avatar" id="clientInitials">CL</span>
                  <div class="comment-compose"><label class="visually-hidden" for="commentInput">Write a comment</label><textarea id="commentInput" maxlength="1000" placeholder="Ask the developer a question about this project..." required></textarea><button type="submit" aria-label="Post comment"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22 2 11 13M22 2 15 22 11 13 2 9 22 2"/></svg></button></div>
                </form>
                <div class="comment-list comment-system-list" id="commentList" aria-live="polite"></div>
              </section>
            </article>
            <aside class="developer-card">
              <section class="preview-price-card">
                <span class="preview-side-eyebrow" id="projectPriceLabel">PROJECT PRICE</span>
                <strong id="projectPrice"></strong>
                <p id="projectPriceDescription">Fixed project pricing. Confirm final scope with the developer.</p>
                <div class="preview-delivery-note">◷ <span>Delivery time can be discussed with the developer.</span></div>
                <a class="chat-developer preview-contact-button" id="chatDeveloperLink" href="devmatch-chat.html?role=client"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.5a8 8 0 0 1-8 8H6l-2.5 1.5.8-4.1a8 8 0 1 1 16.2-5.4Z"/><path d="M8.5 12h.01M12.5 12h.01M16.5 12h.01"/></svg><span>Contact Developer</span></a>
                <button class="project-favorite-action preview-favorite-button" id="projectFavoriteAction" type="button" aria-pressed="false" aria-label="Add project to favorites" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><span>Add to Favorites</span></button>
              </section>
              <section class="preview-developer-card">
                <p class="developer-card-label">About the developer</p>
                <div class="developer-profile"><span class="developer-profile-avatar" id="developerInitials"></span><div><h2 id="developerName"></h2><p class="developer-location"><svg class="developer-location-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg><span id="developerLocation"></span></p></div></div>
                <div class="developer-badges"><span class="developer-status"><i></i>Open for hiring</span><span class="developer-specialty" id="developerSpecialty"></span></div>
                <p class="developer-help" id="developerBio"></p>
                <dl class="developer-stats"><div><dt>Projects</dt><dd id="developerProjects"></dd></div><div><dt>Views</dt><dd id="developerViews"></dd></div><div><dt>Favorites</dt><dd id="developerFavorites"></dd></div></dl>
                <a class="view-developer-profile arrow-action" id="viewDeveloperProfile" href="devmatch-developer-profile.html"><span>View full profile</span><svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h20M17 8l5 4-5 4"/></svg></a>
              </section>
              <p class="preview-protection-note">♧ &nbsp; Agree on scope, timeline and payment terms in writing before you start.</p>
            </aside>
          </section>
        </div>
      </div>
    </dialog>`;
    document.body.append(template.content);
    return document.getElementById('projectDetailDialog');
  }
  const dialog=ensureProjectDetailDialog();
  const content=document.getElementById('projectContent');
  const commentsRoot=document.getElementById('commentList');
  const projectFavoritesKey='devmatch-client-project-favorites';
  let activeProject=null,comments=[],commentOrder='Newest',commenterRoles=new Map();
  let projectFavorites=[],replyTo=null,expandedReplies=new Set(),modalHistoryPending=false;
  const pageTitle=document.title;
  let modalPageTitle=pageTitle;
  const initials=name=>(String(name||'').match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'DM';
  const formatMetric=value=>{
    if(value===null||value===undefined||value==='')return 'Not available';
    const count=Number(value);
    return Number.isSafeInteger(count)&&count>=0?new Intl.NumberFormat().format(count):'Not available';
  };
  function chatUrl(id){return `devmatch-chat.html?role=client&project=${encodeURIComponent(id)}`;}
  function safeHttpUrl(value){
    if(typeof value!=='string'||!value.trim())return '';
    try{
      const parsed=new URL(/^[a-z][a-z\d+.-]*:/i.test(value)?value:`https://${value}`);
      return ['http:','https:'].includes(parsed.protocol)?parsed.href:'';
    }catch{return '';}
  }
  function renderIncludedServices(services){
    const descriptions={
      'Source code included':'Full repository handed over',
      'Documentation included':'Setup & admin guide',
      'Deployment included':'Hosting + domain setup',
      'Maintenance included':'Bug fixes after launch',
      'Commercial use included':'Client may resell / reuse'
    };
    const grid=document.getElementById('projectIncludedGrid');
    const selected=[...new Set(Array.isArray(services)?services:[])];
    if(!selected.length){
      grid.innerHTML='<p class="included-empty">No included services selected.</p>';
      return;
    }
    grid.innerHTML=selected.map(service=>`
      <div><span class="included-check">✓</span><span><b>${escapeHtml(service)}</b><small>${escapeHtml(descriptions[service]||'Included with this project')}</small></span></div>
    `).join('');
  }
  function renderProjectFavoriteButton(saved){
    const button=document.getElementById('projectFavoriteAction');
    button.setAttribute('aria-pressed',String(saved));
    button.setAttribute('aria-label',saved?'Remove project from favorites':'Add project to favorites');
    button.querySelector('span').textContent=saved?'Remove from Favorites':'Add to Favorites';
  }
  async function toggleProjectFavorite(){
    if(!activeProject)return;
    const button=document.getElementById('projectFavoriteAction');
    button.disabled=true;
    try{
      const user=await window.devMatchBackend.ready;
      if(!user){location.href='devmatch-auth.html?mode=login';return;}
      const saved=projectFavorites.includes(activeProject.id);
      if(saved&&!await window.DEVMATCH_FAVORITE_FEEDBACK.confirmRemoval(
        document.getElementById('favoriteRemoveDialog'),
        document.getElementById('favoriteRemoveMessage'),
        activeProject.title
      ))return;
      await window.devMatchBackend.setFavorite('project',activeProject.id,!saved);
      projectFavorites=saved?projectFavorites.filter(id=>id!==activeProject.id):[...projectFavorites,activeProject.id];
      renderProjectFavoriteButton(!saved);
      window.DEVMATCH_NAV_BADGES?.updateFavorites();
      try{localStorage.setItem(projectFavoritesKey,JSON.stringify(projectFavorites));}
      catch(storageError){console.error('Unable to cache project favorites in this browser.',storageError);}
      window.dispatchEvent(new CustomEvent('devmatch:project-favorite-change',{
        detail:{projectId:activeProject.id,saved:!saved,favorites:projectFavorites}
      }));
    }catch(error){
      console.error('Unable to update saved projects in Supabase.',error);
      window.alert('Unable to update this favorite. Please try again.');
    }finally{
      button.disabled=false;
    }
  }
  async function loadCommenterRoles(){
    try{commenterRoles=await window.devMatchBackend.loadCommentAuthorRoles(comments);}
    catch(error){console.error('Unable to load project commenter profiles from Supabase.',error);commenterRoles=new Map();}
  }
  function profileAnchor(comment,content,className){
    const profileUrl=window.devMatchBackend.publicProfileUrl(comment.userId,comment.workspaceRole||commenterRoles.get(comment.userId));
    if(!profileUrl)return content;
    const name=comment.name||'DEV-MATCH member';
    return `<a class="${className}" href="${escapeHtml(profileUrl)}" aria-label="View ${escapeHtml(name)} profile">${content}</a>`;
  }
  function submitCommentOnEnter(event){
    if(event.key!=='Enter'||event.shiftKey||event.isComposing||event.keyCode===229)return;
    event.preventDefault();
    if(event.repeat)return;
    const form=event.target.form;
    if(form&&!form.querySelector('button[type="submit"]').disabled)form.requestSubmit();
  }
  function formatCommentTime(value){
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
  function renderComments(){
    document.getElementById('commentCount').textContent=String(comments.length);
    const ordered=commentOrder==='Newest'?comments:[...comments].reverse();
    const commentIds=new Set(ordered.map(comment=>comment.id));
    const repliesByParent=new Map();
    ordered.forEach(comment=>{
      if(!comment.parentCommentId||!commentIds.has(comment.parentCommentId))return;
      if(!repliesByParent.has(comment.parentCommentId))repliesByParent.set(comment.parentCommentId,[]);
      repliesByParent.get(comment.parentCommentId).push(comment);
    });
    const commentById=new Map(comments.map(comment=>[comment.id,comment]));
    const collectDescendants=commentId=>{
      const descendants=[];
      const visit=repliesByParent.get(commentId)||[];
      visit.forEach(reply=>{
        descendants.push(reply);
        descendants.push(...collectDescendants(reply.id));
      });
      return descendants;
    };
    const renderComment=(comment,isRoot=false)=>{
      const name=escapeHtml(comment.name||'DEV-MATCH member');
      const avatar=profileAnchor(comment,`<span class="comment-avatar comment-system-avatar">${escapeHtml(comment.initials||'CL')}</span>`,'comment-profile-avatar-link');
      const author=profileAnchor(comment,name,'comment-profile-name-link');
      const role=comment.workspaceRole||commenterRoles.get(comment.userId);
      const roleBadge=role==='dev'?'<small class="comment-system-role">Developer</small>':role==='client'?'<small class="comment-system-role">Client</small>':'';
      const parentComment=comment.parentCommentId?commentById.get(comment.parentCommentId):null;
      const parentRole=parentComment?.workspaceRole||commenterRoles.get(parentComment?.userId);
      const parentRoleBadge=parentRole==='dev'?'<small class="comment-system-role">Developer</small>':parentRole==='client'?'<small class="comment-system-role">Client</small>':'';
      const replyTarget=parentComment&&!isRoot?`<small class="comment-reply-target comment-system-target"><span class="comment-reply-arrow comment-system-target-arrow">▸</span> <span class="comment-reply-name comment-system-target-name">${escapeHtml(parentComment.name||'Member')}</span> ${parentRoleBadge}</small>`:'';
      const isReplying=replyTo===comment.id;
      const replies=isRoot?collectDescendants(comment.id):[];
      const commentTime=formatCommentTime(comment.time);
      const replyToggle=replies.length
        ?(expandedReplies.has(comment.id)
          ?''
          :`<button type="button" class="view-replies-link comment-system-view-replies" data-view-replies="${escapeHtml(comment.id)}" aria-expanded="false">View ${replies.length} ${replies.length===1?'reply':'replies'}</button>`)
        :'';
      const replyButton=isReplying
        ?''
        :`<div class="comment-actions comment-system-actions${replies.length?' has-replies':''}"><time class="comment-system-time">${escapeHtml(commentTime)}</time><span class="comment-action-controls comment-system-action-controls"><button type="button" class="reply-link comment-system-reply" data-reply="${escapeHtml(comment.id)}" aria-expanded="false">Reply</button>${replyToggle}</span></div>`;
      const replyForm=isReplying
        ?`<form class="comment-reply-form comment-system-reply-form" data-inline-reply="${escapeHtml(comment.id)}"><label for="projectReplyInput">Reply</label><div><textarea id="projectReplyInput" maxlength="1000" placeholder="Write a reply…" aria-label="Reply to ${name}" required></textarea><button type="submit" aria-label="Post reply"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22 2 11 13M22 2 15 22 11 13 2 9 22 2"/></svg></button></div></form>`
        :'';
      const expandedRepliesMarkup=isRoot&&expandedReplies.has(comment.id)
        ?`<div class="comment-replies comment-system-replies">${replies.map(reply=>renderComment(reply,false)).join('')}<button type="button" class="view-replies-link comment-system-view-replies hide-replies-link" data-view-replies="${escapeHtml(comment.id)}" aria-expanded="true">Hide replies</button></div>`
        :'';
      return `<article class="comment-item comment-system-item">${avatar}<div class="comment-system-body"><p class="comment-author comment-system-author">${author} ${roleBadge}${replyTarget}</p><p class="comment-text comment-system-text">${escapeHtml(comment.text)}</p>${replyButton}</div></article>${replyForm}${expandedRepliesMarkup}`;
    };
    commentsRoot.innerHTML=ordered
      .filter(comment=>!comment.parentCommentId||!commentIds.has(comment.parentCommentId))
      .map(comment=>renderComment(comment,true)).join('');
  }
  commentsRoot.addEventListener('click',event=>{
    const viewReplies=event.target.closest('[data-view-replies]');
    if(viewReplies){
      const commentId=viewReplies.dataset.viewReplies;
      if(expandedReplies.has(commentId))expandedReplies.delete(commentId);
      else expandedReplies.add(commentId);
      renderComments();
      return;
    }
    const button=event.target.closest('[data-reply]');
    if(!button)return;
    replyTo=replyTo===button.dataset.reply?null:button.dataset.reply;
    renderComments();
    if(replyTo)commentsRoot.querySelector('[data-inline-reply] textarea')?.focus();
  });
  commentsRoot.addEventListener('input',event=>{
    if(event.target.matches('[data-inline-reply] textarea'))event.target.setCustomValidity('');
  });
  commentsRoot.addEventListener('keydown',event=>{
    if(event.target.matches('[data-inline-reply] textarea'))submitCommentOnEnter(event);
  });
  function showError(message){
    const error=document.getElementById('detailError');error.textContent=message;error.hidden=false;content.hidden=true;
    if(!dialog.open)dialog.showModal();
  }
  window.openProjectDetails=async function(projectId){
    if(typeof projectId!=='string'||!projectId.trim()){
      showError('Project details could not be opened because the project link is missing its ID.');
      return;
    }
    replyTo=null;
    expandedReplies.clear();
    document.querySelector('#commentForm button[type="submit"]').setAttribute('aria-label','Post comment');
    const errorElement=document.getElementById('detailError');
    errorElement.hidden=true;content.hidden=true;
    window.DEVMATCH_SKELETON?.text(document.getElementById('projectTitle'),'Loading project details','56%');
    if(!dialog.open){
      modalPageTitle=document.title;
      history.pushState({...history.state,projectDetailDialog:true},'',location.href);
      modalHistoryPending=true;
      dialog.showModal();
    }
    try{
      const {data:row,error}=await window.devMatchBackend.client.from('projects')
        .select('id,owner_id,title,project_type,category,price,cover_image,status,data,created_at,updated_at')
        .eq('id',projectId).eq('project_kind','portfolio').eq('status','published').maybeSingle();
      if(error)throw error;
      if(!row){showError('Project details could not be found. This project may no longer be published.');return;}
      const data=row.data&&typeof row.data==='object'?row.data:{};
      activeProject={id:row.id,title:String(row.title||''),category:String(row.category||''),type:String(row.project_type||''),
        description:String(data.description||data.overview||''),overview:String(data.overview||data.description||''),
        price:String(row.price||data.price||''),stack:Array.isArray(data.stack)?data.stack.join(', '):String(data.stack||''),
        link:String(data.link||data.url||''),coverImage:safeProjectCover(row.cover_image||data.coverImage),
        priceType:String(data.priceType||data.price_type||''),created:row.created_at||row.updated_at,ownerId:row.owner_id};
      let developerName='DEV-MATCH member',developerLocation='Location not provided',specialty='Developer',developerBio='No biography provided.';
      const user=await window.devMatchBackend.ready;
      let accountRole=null,favoritesLoadFailed=false,viewRecordFailed=false,engagementMetricsAvailable=true;
      const developerMetrics={projects:null,views:null,favorites:null};
      let projectViewCount=0;
      if(user){
        try{
          const viewResult=await window.devMatchBackend.recordProjectView(row.id);
          if(Number.isSafeInteger(viewResult)&&viewResult>=0)projectViewCount=viewResult;
        }
        catch(error){console.error('Unable to record the portfolio project view in Supabase.',error);viewRecordFailed=true;}
        let account=null;
        try{account=await window.devMatchBackend.loadProfile(user);}
        catch(error){console.error('Unable to load the active workspace profile for project details.',error);}
        accountRole=account?.account_role||null;
        if(account?.account_role==='client'){
          try{
            const metricColumns='display_name,username,profile_data,published_portfolio_count,published_portfolio_views_count,published_portfolio_favorites_count';
            const legacyColumns='display_name,username,profile_data,published_portfolio_count';
            let personResult=await window.devMatchBackend.client.from('directory_people')
              .select(metricColumns).eq('id',row.owner_id).eq('account_role','dev').maybeSingle();
            if(personResult.error&&['42703','PGRST204'].includes(personResult.error.code)
              &&/published_portfolio_(views|favorites)_count/.test(personResult.error.message||'')){
              engagementMetricsAvailable=false;
              personResult=await window.devMatchBackend.client.from('directory_people')
                .select(legacyColumns).eq('id',row.owner_id).eq('account_role','dev').maybeSingle();
            }
            if(personResult.error)throw personResult.error;
            const person=personResult.data;
            if(person){
              const profile=person.profile_data||{};
              developerName=String(person.display_name||developerName);
              developerLocation=String(profile.city||developerLocation);
              specialty=String(profile.specialtyOther||profile.specialty||specialty);
              developerBio=String(profile.bio||developerBio);
              developerMetrics.projects=person.published_portfolio_count;
              if(engagementMetricsAvailable){
                developerMetrics.views=person.published_portfolio_views_count;
                developerMetrics.favorites=person.published_portfolio_favorites_count;
              }
            }
          }catch(error){
            console.error('Unable to load the developer directory profile for project details.',error);
            engagementMetricsAvailable=false;
          }
        }
      }
      const favoriteButton=document.getElementById('projectFavoriteAction');
      favoriteButton.hidden=accountRole!=='client';
      favoriteButton.disabled=false;
      projectFavorites=[];
      if(accountRole==='client'){
        try{
          const records=await window.devMatchBackend.loadFavorites();
          projectFavorites=records.filter(item=>item.type==='project').map(item=>item.id);
          try{localStorage.setItem(projectFavoritesKey,JSON.stringify(projectFavorites));}
          catch(storageError){console.error('Unable to cache project favorites in this browser.',storageError);}
        }catch(error){
          console.error('Unable to load project favorites from Supabase.',error);
          favoriteButton.disabled=true;
          favoritesLoadFailed=true;
        }
      }
      renderProjectFavoriteButton(projectFavorites.includes(row.id));
      const created=new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(activeProject.created));
      document.title=`${activeProject.title} — DEV-MATCH`;
      document.getElementById('projectCategory').textContent=activeProject.category;
      document.getElementById('projectTitle').textContent=activeProject.title;
      document.getElementById('projectSummary').textContent=activeProject.description;
      document.getElementById('projectPrice').textContent=activeProject.price||'Price not specified';
      const priceLabel=activeProject.priceType||'PROJECT PRICE';
      document.getElementById('projectPriceLabel').textContent=String(priceLabel).toUpperCase();
      document.getElementById('projectPriceType').textContent=activeProject.priceType||'Starting from';
      document.getElementById('projectPriceDescription').textContent=activeProject.priceType==='Fixed price'
        ?'Fixed project pricing. Confirm final scope with the developer.'
        :activeProject.priceType==='Custom quote'
          ?'The final quote can be confirmed with the developer.'
          :'Pricing details can be discussed with the developer.';
      document.getElementById('projectViews').textContent=formatMetric(developerMetrics.views);
      document.getElementById('projectFavorites').textContent=projectFavorites.includes(row.id)?'1':'0';
      document.getElementById('projectOverview').textContent=activeProject.overview;
      document.getElementById('projectStack').textContent=activeProject.stack?`Built with ${activeProject.stack}.`:'Technology stack not provided.';
      renderIncludedServices(data.services);
      document.getElementById('projectType').textContent=activeProject.type;
      document.getElementById('projectFactCategory').textContent=activeProject.category;
      document.getElementById('projectCreated').textContent=created;
      const projectLink=document.getElementById('projectLink');
      const safeProjectUrl=safeHttpUrl(activeProject.link);
      projectLink.hidden=!safeProjectUrl;
      document.getElementById('projectLinkUnavailable').hidden=Boolean(safeProjectUrl);
      if(safeProjectUrl){projectLink.href=safeProjectUrl;projectLink.textContent=activeProject.link;}
      const cover=document.getElementById('projectCover');
      cover.className=`project-cover ${['food-art','dashboard-art','analytics-art','store-art','inventory-art'].includes(data.art)?data.art:'dashboard-art'}`;
      cover.replaceChildren();
      if(activeProject.coverImage){
        const image=document.createElement('img');
        image.className='project-cover-image';
        image.src=activeProject.coverImage;
        image.alt='';
        cover.append(image);
        cover.classList.add('has-uploaded-image');
      }
      document.getElementById('developerInitials').textContent=initials(developerName);
      document.getElementById('developerName').textContent=developerName;
      document.getElementById('developerLocation').textContent=developerLocation;
      document.getElementById('developerSpecialty').textContent=specialty;
      document.getElementById('developerBio').textContent=developerBio;
      document.getElementById('developerProjects').textContent=formatMetric(developerMetrics.projects);
      document.getElementById('developerViews').textContent=formatMetric(developerMetrics.views);
      document.getElementById('developerFavorites').textContent=formatMetric(developerMetrics.favorites);
      document.getElementById('viewDeveloperProfile').href=`devmatch-developer-profile.html?developer=${encodeURIComponent(row.owner_id)}`;
      document.getElementById('chatDeveloperLink').href=user?chatUrl(row.id):'devmatch-auth.html?mode=login';
      const clientName='Client';
      document.getElementById('clientInitials').textContent=initials(clientName);
      try{comments=(await window.devMatchBackend.loadProjectComments(row.id)).comments;}
      catch(commentError){console.error('Unable to load public project comments from Supabase.',commentError);comments=[];errorElement.textContent='Project loaded, but comments could not be loaded.';errorElement.hidden=false;}
      await loadCommenterRoles();
      commentOrder=document.querySelector('.sort-comments select').value;
      renderComments();content.hidden=false;
      const warnings=[];
      if(viewRecordFailed)warnings.push('Project view could not be recorded.');
      if(favoritesLoadFailed)warnings.push('Favorites could not be loaded.');
      if(!engagementMetricsAvailable)warnings.push('Developer views and favorites are not available.');
      if(warnings.length){
        errorElement.textContent=[errorElement.hidden?'':errorElement.textContent,...warnings].filter(Boolean).join(' ');
        errorElement.hidden=false;
      }
    }catch(error){
      console.error('Unable to load public project details from Supabase.',error);
      const detail=String(error?.message||error||'').trim();
      const message=detail
        ?`Project details could not be loaded: ${detail}`
        :'Project details could not be loaded. Check your connection and try again.';
      showError(message);
    }
  };
  document.getElementById('closeProjectDetail').addEventListener('click',()=>dialog.close());
  document.getElementById('projectFavoriteAction').addEventListener('click',toggleProjectFavorite);
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{
    document.title=modalPageTitle||pageTitle;
    if(document.body.dataset.projectDetailRoute==='true'&&!document.referrer){
      location.replace('devmatch-discover-projects.html');
      return;
    }
    if(modalHistoryPending){modalHistoryPending=false;history.back();}
  });
  window.addEventListener('popstate',()=>{
    if(dialog.open){modalHistoryPending=false;dialog.close();}
  });
  document.querySelector('.sort-comments select').addEventListener('change',event=>{commentOrder=event.target.value;renderComments();});
  commentsRoot.addEventListener('submit',async event=>{
    const form=event.target.closest('[data-inline-reply]');
    if(!form)return;
    event.preventDefault();
    const input=form.querySelector('textarea');
    const text=input.value.trim();
    if(!text){input.setCustomValidity('Please enter a reply before posting.');input.reportValidity();return;}
    input.setCustomValidity('');
    try{
      const user=await window.devMatchBackend.ready;
      if(!user){location.href='devmatch-auth.html?mode=login';return;}
      const submit=form.querySelector('button[type="submit"]');
      submit.disabled=true;
      const parentId=form.dataset.inlineReply;
      comments.push(await window.devMatchBackend.addProjectCommentReply(activeProject.id,parentId,text));
      expandedReplies.add(parentId);
      await loadCommenterRoles();
      replyTo=null;
      renderComments();
    }
    catch(error){
      console.error('Unable to save the project reply to Supabase.',error);
      window.alert('Unable to post your reply. Please log in and try again.');
      form.querySelector('button[type="submit"]').disabled=false;
    }
  });
  document.getElementById('commentForm').addEventListener('submit',async event=>{
    event.preventDefault();const input=document.getElementById('commentInput');const text=input.value.trim();
    if(!text){input.setCustomValidity('Please enter a comment before posting.');input.reportValidity();return;}
    input.setCustomValidity('');
    try{
      comments.push(await window.devMatchBackend.addProjectComment(activeProject.id,text));
      await loadCommenterRoles();
      input.value='';
      input.placeholder='Write a comment…';
      renderComments();
    }
    catch(error){console.error('Unable to save the project comment to Supabase.',error);window.alert('Unable to post your comment. Please log in and try again.');}
  });
  document.getElementById('commentInput').addEventListener('keydown',submitCommentOnEnter);
  document.getElementById('commentInput').addEventListener('input',event=>event.target.setCustomValidity(''));
  if(document.body.dataset.projectDetailRoute==='true'){
    const projectId=new URLSearchParams(location.search).get('project');
    if(projectId)window.openProjectDetails(projectId);
    else{
      dialog.showModal();
      showError('Project details could not be opened because the project link is missing its ID.');
    }
  }
})();
