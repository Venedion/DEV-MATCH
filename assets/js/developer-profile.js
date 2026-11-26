(async function(){
  'use strict';
  const requestedId=new URLSearchParams(location.search).get('developer');
  const status=document.getElementById('profileStatus');
  const identity=document.querySelector('.profile-identity-card');
  const profileLayout=document.getElementById('clientProfileLayout');
  const columns=document.querySelector('.profile-columns');
  const desktopProfileLayout=window.matchMedia('(min-width:821px) and (orientation:landscape)');
  window.DEVMATCH_SKELETON?.status(status,'Loading developer profile');
  const favoriteToast=document.getElementById('favoriteActionToast');
  const favoriteRemoveDialog=document.getElementById('favoriteRemoveDialog');
  const favoriteRemoveMessage=document.getElementById('favoriteRemoveMessage');
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const initials=name=>(String(name||'').match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'DM';
  const compactOverviewCount=value=>value===null?'Unavailable':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value).replace('K','k');
  function safeExternalUrl(value){
    if(typeof value!=='string'||!value.trim())return null;
    try{
      const url=new URL(value.trim());
      return url.protocol==='https:'||url.protocol==='http:'?url.href:null;
    }catch{return null;}
  }
  const specialtyDetails={
    'Full-stack':{description:'Front + back end',icon:'<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>'},
    Frontend:{description:'Web interfaces',icon:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>'},
    Backend:{description:'APIs & databases',icon:'<path d="M6 3v6m0 4v8M12 3v3m0 4v11M18 3v9m0 4v5M3 9h6m0 1h6m0 2h6m-6 4h6"/>'},
    'UI/UX':{description:'Design & research',icon:'<path d="m15 5 4 4M4 20l4-.8L19.2 8a2.8 2.8 0 0 0-4-4L4 15.2 4 20z"/>'},
    Mobile:{description:'Android & iOS',icon:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/>'},
    'Game Dev':{description:'Unity, Roblox...',icon:'<path d="m7 7 10 0a4 4 0 0 1 3.8 5.2l-1.2 4a2 2 0 0 1-3.3.9L14 15H10l-2.3 2.1a2 2 0 0 1-3.3-.9l-1.2-4A4 4 0 0 1 7 7z"/><path d="M7 10v4m-2-2h4m7-1h.01M17 13h.01"/>'},
    Other:{description:'Custom specialization',icon:'<path d="M12 5v14m-7-7h14"/>'}
  };
  const connectedAppIcons={
    WhatsApp:{
      color:'#25d366',
      svg:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path transform="translate(3.6 3.6) scale(.7)" d="M17.5 14.4c-.3-.1-1.8-.9-2.1-1-.3-.1-.5-.1-.7.1s-.8 1-.9 1.2c-.2.2-.4.2-.7.1s-1.3-.5-2.5-1.5c-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5s0-.4-.1-.5c-.1-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.2-1.2 2.9 1.2 3.4 1.4 3.6c.2.2 2.4 3.7 5.8 5.1 3.4 1.4 3.4.9 4 .9.6 0 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.1-.3-.2-.6-.3z" fill="currentColor"/></svg>'
    },
    GitHub:{
      color:'#24292e',
      svg:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>'
    },
    Google:{
      color:'#ea4335',
      svg:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>'
    },
    LinkedIn:{
      color:'#0a66c2',
      svg:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>'
    }
  };
  let projects=[],favoriteDeveloper=false,accountRole=null,publicProfileProjects=null,commenterRoles=new Map();
  let profileComments=[],profileCommentSort='newest';
  const expandedProfileCommentReplies=new Set();
  let profileDeveloperIdentity={};
  let profileRating=null,profileRatingCount=0,profileRatingLabel='Belum ada rating',reviewsLoadFailed=false;
  let activeFilter='All',activeQuery='';
  const filtersRoot=document.getElementById('portfolioFilters');
  const grid=document.getElementById('portfolioGrid');
  const empty=document.getElementById('portfolioEmpty');
  const reviewsPanel=document.getElementById('publicReviewsPanel');
  const commentsPanel=document.getElementById('commentsPanel');
  const sortSelect=document.getElementById('sortProjects');
  grid.addEventListener('click',event=>{
    const link=event.target.closest('[data-project-detail]');
    if(!link||typeof window.openProjectDetails!=='function'||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    window.openProjectDetails(link.dataset.projectDetail);
  });
  grid.addEventListener('keydown',event=>{
    if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-project-detail]')){
      event.preventDefault();
      window.openProjectDetails(event.target.dataset.projectDetail);
    }
  });
  function showError(message){
    status.hidden=false;status.textContent=message;
    identity.hidden=true;profileLayout.hidden=true;columns.hidden=true;
  }
  function moveProfileContent(){
    const desktop=desktopProfileLayout.matches;
    const profileActions=document.querySelector('.profile-actions');
    const quickContactCard=document.querySelector('.contact-card');
    const connectedAppsCard=document.getElementById('connectedAppsCard');
    const profileShowcase=document.querySelector('.profile-showcase');
    const profileDetails=document.querySelector('.profile-details');
    const developerDetailsDesktop=document.getElementById('developerDetailsDesktop');
    const developerDetailCards=[
      document.getElementById('developerSpecialtiesCard'),
      document.getElementById('developerSkillsCard'),
      document.getElementById('developerExperienceCard')
    ];
    document.getElementById('clientProfileActions').append(profileActions);
    document.getElementById('clientProfileSide').hidden=false;
    document.getElementById('clientCompanyDetails').append(document.getElementById('roleInfoCard'));
    document.getElementById(`clientQuickContact${desktop?'Desktop':'Mobile'}`).append(quickContactCard);
    developerDetailsDesktop.hidden=!desktop;
    if(desktop){
      document.getElementById('clientConnectedAppsDesktop').append(connectedAppsCard);
      document.getElementById('clientShowcaseDesktop').append(profileShowcase);
      developerDetailCards.forEach(card=>developerDetailsDesktop.append(card));
    }else{
      columns.append(profileShowcase);
      developerDetailCards.forEach(card=>profileDetails.append(card));
      profileDetails.append(connectedAppsCard);
    }
  }
  async function loadDeveloperDirectoryProfile(profileId){
    const directory=window.devMatchBackend.client.from('directory_people');
    const metricColumns='id,display_name,username,account_role,profile_data,published_portfolio_count,published_portfolio_views_count,published_portfolio_favorites_count';
    const legacyColumns='id,display_name,username,account_role,profile_data,published_portfolio_count';
    let metricsAvailable=true;
    let result=await directory.select(metricColumns).eq('id',profileId).eq('account_role','dev').maybeSingle();
    if(result.error&&['42703','PGRST204'].includes(result.error.code)
      &&/published_portfolio_(views|favorites)_count/.test(result.error.message||'')){
      metricsAvailable=false;
      result=await directory.select(legacyColumns).eq('id',profileId).eq('account_role','dev').maybeSingle();
    }
    if(result.error)throw result.error;
    return {person:result.data,metricsAvailable};
  }
  function projectRecord(row){
    const data=row.data&&typeof row.data==='object'?row.data:{};
    return {...data,id:row.id,title:String(row.title||data.title||''),type:String(row.project_type||data.projectType||data.type||''),
      category:String(row.category||data.category||''),description:String(data.description||data.overview||''),
      price:String(row.price||data.price||''),coverImage:String(row.cover_image||data.coverImage||''),created:row.created_at||row.updated_at};
  }
  function normalizeList(value){
    const items=Array.isArray(value)?value:typeof value==='string'?value.split(/[,;\n]/):[];
    return items.map(item=>String(item).trim()).filter(Boolean);
  }
  function publicCount(value){
    if(value===null||value===undefined||value==='')return null;
    const count=Number(value);
    return Number.isSafeInteger(count)&&count>=0?count:null;
  }
  function safeExternalUrl(value){
    if(typeof value!=='string')return '';
    const raw=String(value||'').trim();
    if(!raw||(/^[a-z][a-z\d+.-]*:/i.test(raw)&&!/^https?:\/\//i.test(raw)))return '';
    try{
      const url=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
      return ['http:','https:'].includes(url.protocol)?url.href:'';
    }catch(error){return '';}
  }
  function setAvatar(id,imageUrl,fallback){
    const element=document.getElementById(id);
    if(!element)return;
    let validImage=typeof imageUrl==='string'&&/^data:image\/(?:jpeg|png);base64,/.test(imageUrl);
    if(typeof imageUrl==='string'&&imageUrl.startsWith('https://')){
      try{
        const url=new URL(imageUrl);
        validImage=url.origin==='https://yxwktllqbmhustmhdaqi.supabase.co'
          &&url.pathname.startsWith('/storage/v1/object/public/project-media/');
      }catch(error){validImage=false;}
    }
    if(!validImage){
      element.textContent=fallback;
      return;
    }
    const image=document.createElement('img');
    image.src=imageUrl;
    image.alt='';
    image.addEventListener('error',()=>{element.textContent=fallback;});
    element.replaceChildren(image);
  }
  function profileExperiences(profile){
    return (Array.isArray(profile.experiences)?profile.experiences:[])
      .filter(item=>item&&typeof item==='object'&&(item.title||item.company))
      .map(item=>({...item,period:String(item.period||[item.startYear,item.endYear].filter(Boolean).join(' – ')).trim()}))
      .sort((left,right)=>{
        const order=item=>{
          const years=String(item.period||'').match(/\d{4}/g)||[];
          return {current:/\b(present|sekarang|current)\b/i.test(item.period||''),end:Number(years[years.length-1]||years[0]||0)};
        };
        const a=order(left),b=order(right);
        return Number(b.current)-Number(a.current)||b.end-a.end;
      });
  }
  function renderExperience(experiences){
    const root=document.getElementById('developerExperienceList');
    root.innerHTML=experiences.length?experiences.map(item=>{
      const details=[item.company,item.period].map(value=>String(value||'').trim()).filter(Boolean).join(' · ');
      const linkLabel=String(item.link||'').trim();
      const href=safeExternalUrl(linkLabel);
      return `<li><b>${escapeHtml(item.title||'Experience')}</b>${details?`<small>${escapeHtml(details)}</small>`:''}${href?`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Portfolio link</a>`:''}</li>`;
    }).join(''):'<li class="empty-state">No public experience added.</li>';
  }
  function renderConnectedApps(profile){
    const isConnected=(field,defaultValue)=>typeof profile[field]==='boolean'?profile[field]:defaultValue;
    const phone=String(profile.whatsapp||'').replace(/\D/g,'');
    const githubValue=String(profile.githubUrl||profile.github||'').trim();
    const githubUrl=safeExternalUrl(githubValue);
    const githubUsername=String(profile.githubUsername||(!githubValue.includes('/')?githubValue:'')).trim().replace(/^@/,'');
    const githubHref=githubUrl&&new URL(githubUrl).hostname.toLowerCase().endsWith('github.com')
      ?githubUrl
      :githubUsername?`https://github.com/${encodeURIComponent(githubUsername)}`:'https://github.com/';
    const linkedinValue=String(profile.linkedinUrl||profile.linkedin||'').trim();
    const linkedinUrl=safeExternalUrl(linkedinValue);
    const linkedinUsername=String(profile.linkedinUsername||(!linkedinValue.includes('/')?linkedinValue:'')).trim().replace(/^@/,'');
    const linkedinHref=linkedinUrl&&new URL(linkedinUrl).hostname.toLowerCase().endsWith('linkedin.com')
      ?linkedinUrl
      :linkedinUsername?`https://www.linkedin.com/in/${encodeURIComponent(linkedinUsername)}`:'https://www.linkedin.com/';
    const apps=[
      {name:'WhatsApp Business',icon:connectedAppIcons.WhatsApp,connected:isConnected('whatsappConnected',Boolean(phone)),href:phone?`https://wa.me/${phone}`:'https://www.whatsapp.com/'},
      {name:'GitHub',icon:connectedAppIcons.GitHub,connected:isConnected('githubConnected',Boolean(profile.github||profile.githubUrl)),href:githubHref},
      {name:'Google',icon:connectedAppIcons.Google,connected:isConnected('googleConnected',false),href:safeExternalUrl(profile.googleUrl)||'https://www.google.com/'},
      {name:'LinkedIn',icon:connectedAppIcons.LinkedIn,connected:isConnected('linkedinConnected',Boolean(profile.linkedin||profile.linkedinUrl)),href:linkedinHref}
    ];
    const root=document.getElementById('developerConnectedApps');
    const connectedApps=apps.filter(app=>app.connected);
    root.innerHTML=connectedApps.length?connectedApps.map(app=>
      `<a class="connected-app connected-app-link" href="${escapeHtml(app.href)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(app.name)}"><span class="connected-app-info"><span class="app-icon" style="color:${app.icon.color}">${app.icon.svg}</span><b>${escapeHtml(app.name)}</b></span><svg class="connected-app-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></a>`
    ).join(''):'<p class="empty-state">No connected apps.</p>';
  }
  function renderFavoriteButton(){
    const button=document.getElementById('favoriteDeveloper');
    button.hidden=accountRole!=='client';
    const saved=favoriteDeveloper;
    button.setAttribute('aria-pressed',String(saved));
    button.innerHTML=`♡ <span>${saved?'Favorited':'Favorite'}</span>`;
  }
  function renderProjects(){
    const filtered=projects.filter(item=>(activeFilter==='All'||item.type===activeFilter)&&
      (!activeQuery||`${item.title} ${item.description} ${item.type} ${item.category}`.toLowerCase().includes(activeQuery)));
    const sort=sortSelect.value;
    const time=value=>{const parsed=Date.parse(value);return Number.isFinite(parsed)?parsed:0;};
    filtered.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title)
      :time(b.created)-time(a.created)||a.title.localeCompare(b.title));
    grid.innerHTML=filtered.map(item=>`
      <article class="showcase-project portfolio-catalog-card" data-project-detail="${escapeHtml(item.id)}" tabindex="0" role="link" aria-label="View ${escapeHtml(item.title)} details">
        <div class="project-art art-dashboard">${item.coverImage
          ?`<img class="portfolio-card-cover" src="${escapeHtml(item.coverImage)}" alt="${escapeHtml(item.title)}" loading="lazy">`
          :'<div class="project-browser" aria-hidden="true"><div class="browser-bar"><i></i><i></i><i></i></div><div class="browser-content"><span class="art-accent"></span></div></div>'}</div>
        <div class="project-copy">
          <span class="project-category">${escapeHtml(item.category)}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description)}</p>
          <strong class="portfolio-catalog-price">${escapeHtml(item.price||'Price not specified')}</strong>
          <footer class="project-footer portfolio-catalog-footer">
            <span class="developer-avatar">${escapeHtml(profileDeveloperIdentity.initials||'DM')}</span>
            <span class="developer-info"><b>${escapeHtml(profileDeveloperIdentity.name||'DEV-MATCH member')}</b><small>${escapeHtml(profileDeveloperIdentity.handle||'')}</small></span>
            <span class="rating" aria-label="${reviewsLoadFailed?'Developer rating unavailable':profileRatingCount?`Developer rating ${profileRating.toFixed(1)} out of 5`:'Belum ada rating'}">${reviewsLoadFailed?'Unavailable':profileRatingCount<3?profileRatingLabel:`<span>★</span> ${profileRating.toFixed(1)}`}</span>
          </footer>
        </div>
      </article>`).join('');
    empty.textContent=projects.length?'No projects match this filter.':'No public projects have been added yet.';
    empty.hidden=filtered.length>0;
  }
  function renderComments(comments){
    profileComments=comments;
    const ordered=[...comments].sort((a,b)=>{
      const aTime=Date.parse(a.time)||0;
      const bTime=Date.parse(b.time)||0;
      return profileCommentSort==='newest'?bTime-aTime:aTime-bTime;
    });
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
      const name=comment.name||'DEV-MATCH member';
      const role=comment.workspaceRole||commenterRoles.get(comment.userId);
      const profileUrl=window.devMatchBackend.publicProfileUrl(comment.userId,role);
      const avatar=`<span class="review-avatar comment-system-avatar">${escapeHtml(comment.initials||'CL')}</span>`;
      const author=escapeHtml(name);
      const linkedAvatar=profileUrl?`<a class="comment-profile-avatar-link" href="${escapeHtml(profileUrl)}" aria-label="View ${escapeHtml(name)} profile">${avatar}</a>`:avatar;
      const linkedAuthor=profileUrl?`<a class="comment-profile-name-link" href="${escapeHtml(profileUrl)}">${author}</a>`:author;
      const roleLabel=role==='dev'?'Developer':role==='client'?'Client':'';
      const roleBadge=roleLabel?`<small class="profile-comment-role comment-system-role">${roleLabel}</small>`:'';
      const parentComment=comment.parentCommentId?commentById.get(comment.parentCommentId):null;
      const parentRole=parentComment?.workspaceRole||commenterRoles.get(parentComment?.userId);
      const parentRoleBadge=parentRole==='dev'?'<small class="profile-comment-role comment-system-role">Developer</small>':parentRole==='client'?'<small class="profile-comment-role comment-system-role">Client</small>':'';
      const replyTarget=parentComment&&!isRoot?`<small class="profile-comment-reply-target comment-system-target"><span class="profile-comment-reply-arrow comment-system-target-arrow">▸</span> <span class="profile-comment-reply-name comment-system-target-name">${escapeHtml(parentComment.name||'Member')}</span> ${parentRoleBadge}</small>`:'';
      const projectLink=`<a class="profile-comment-project-link" href="devmatch-discover-project-detail.html?project=${encodeURIComponent(comment.projectId)}#commentsSection">${escapeHtml(comment.project)}</a>`;
      const time=comment.time?new Date(comment.time):null;
      const minutes=time&&!Number.isNaN(time.getTime())?Math.max(0,Math.floor((Date.now()-time.getTime())/60000)):null;
      const formattedTime=minutes===null?'':minutes<1?'Just now':minutes<60?`${minutes}m ago`:minutes<1440?`${Math.floor(minutes/60)}h ago`:minutes<10080?`${Math.floor(minutes/1440)}d ago`:time.toLocaleDateString();
      const replies=isRoot?collectDescendants(comment.id):[];
      const expanded=expandedProfileCommentReplies.has(comment.id);
      const replyToggle=replies.length
        ?(expanded
          ?''
          :`<button class="profile-comment-replies-toggle comment-system-view-replies" type="button" data-view-replies="${escapeHtml(comment.id)}" aria-expanded="false">View ${replies.length} ${replies.length===1?'reply':'replies'}</button>`)
        :'';
      const renderedReplies=isRoot&&expanded
        ?`<div class="profile-comment-replies comment-system-replies">${replies.map(reply=>renderComment(reply,false)).join('')}<button class="profile-comment-replies-toggle comment-system-view-replies hide-replies-toggle" type="button" data-view-replies="${escapeHtml(comment.id)}" aria-expanded="true">Hide replies</button></div>`
        :'';
      return `<article class="profile-comment comment-system-item">${linkedAvatar}<div class="profile-comment-copy comment-system-body"><h3 class="profile-comment-author comment-system-author">${linkedAuthor} ${roleBadge}${replyTarget}</h3><small class="comment-system-project">${projectLink}</small><p class="comment-system-text">${escapeHtml(comment.text)}</p><div class="comment-system-actions"><time class="comment-system-time" datetime="${escapeHtml(comment.time||'')}">${escapeHtml(formattedTime)}</time><span class="comment-system-action-controls">${replyToggle}</span></div></div></article>${renderedReplies}`;
    };
    commentsPanel.innerHTML=`<header class="profile-comments-heading comment-system-heading"><h2>Comments <span class="comment-system-count">${comments.length}</span></h2><label><span class="visually-hidden">Sort comments</span><select id="profileCommentSort" aria-label="Sort comments"><option value="newest"${profileCommentSort==='newest'?' selected':''}>Newest</option><option value="oldest"${profileCommentSort==='oldest'?' selected':''}>Oldest</option></select></label></header>${comments.length
      ?`<div class="profile-comment-list comment-system-list">${ordered.filter(comment=>!comment.parentCommentId||!commentIds.has(comment.parentCommentId)).map(comment=>renderComment(comment,true)).join('')}</div>`
      :'<p class="empty-state comment-system-empty">No comments yet.</p>'}`;
    commentsPanel.onclick=event=>{
      const button=event.target.closest('[data-view-replies]');
      if(!button)return;
      const commentId=button.dataset.viewReplies;
      if(expandedProfileCommentReplies.has(commentId))expandedProfileCommentReplies.delete(commentId);
      else expandedProfileCommentReplies.add(commentId);
      renderComments(profileComments);
    };
    commentsPanel.onchange=event=>{
      if(event.target.id!=='profileCommentSort')return;
      profileCommentSort=event.target.value;
      renderComments(profileComments);
    };
  }
  async function loadCommenterRoles(comments){
    try{commenterRoles=await window.devMatchBackend.loadCommentAuthorRoles(comments);}
    catch(error){console.error('Unable to load public commenter profiles from Supabase.',error);commenterRoles=new Map();}
  }
  function renderProfileReviews(reviews,summary,loadFailed=false,isOwnProfile=false){
    if(loadFailed){
      reviewsPanel.innerHTML='<p class="empty-state">Reviews could not be loaded. Check your connection and try again.</p>';
      return;
    }
    const criteria=[
      ['Quality of work',summary.criteria.qualityOfWork],
      ['Communication',summary.criteria.communication],
      ['Meeting the deadline',summary.criteria.meetingDeadline]
    ].filter(([,value])=>value!==null);
    const criteriaHtml=criteria.length
      ?`<dl class="review-criteria-summary">${criteria.map(([label,value])=>`<div><dt>${label}</dt><dd>${Number(value).toFixed(1)}</dd></div>`).join('')}</dl>`:'';
    const reviewsHtml=reviews.map(review=>{
      const details=[
        ['Quality of work',review.criteria.qualityOfWork],
        ['Communication',review.criteria.communication],
        ['Meeting the deadline',review.criteria.meetingDeadline]
      ].filter(([,value])=>value!==null);
      const actions=window.DEVMATCH_PROFILE_REVIEW_ACTIONS?.render(review,isOwnProfile);
      return `<article class="review-item"><span class="review-avatar">${escapeHtml(review.reviewerInitials||'CL')}</span><div class="review-copy"><h3>${escapeHtml(review.reviewerName)}</h3><small>${escapeHtml(review.projectTitle||'Completed project')}</small>${review.deliveryBadge?`<p class="review-delivery-badge">${escapeHtml(review.deliveryBadge)}</p>`:''}${review.text?`<p>${escapeHtml(review.text)}</p>`:''}${details.length?`<small>${details.map(([label,value])=>`${label}: ${value}`).join(' · ')}</small>`:''}${review.reply?`<p class="review-reply"><strong>Response:</strong> ${escapeHtml(review.reply)}</p>`:''}${actions||''}</div><span class="review-rating" aria-label="${review.rating.toFixed(1)} out of 5">${review.rating.toFixed(1)} / 5</span></article>`;
    }).join('');
    reviewsPanel.innerHTML=`${criteriaHtml}${reviewsHtml||'<p class="empty-state">Belum ada rating.</p>'}`;
  }
  function updateTabIndicator(button=document.querySelector('.portfolio-tabs .profile-tab.active')){
    const tabs=document.querySelector('.portfolio-tabs');
    if(!tabs||!button)return;
    const tabBounds=button.getBoundingClientRect();
    const tabsBounds=tabs.getBoundingClientRect();
    const left=tabBounds.left-tabsBounds.left-tabs.clientLeft+tabs.scrollLeft;
    tabs.style.setProperty('--profile-tab-indicator-left',`${left}px`);
    tabs.style.setProperty('--profile-tab-indicator-width',`${tabBounds.width}px`);
  }
  if(!requestedId){showError('Developer profile not found.');return;}
  status.hidden=false;
  window.DEVMATCH_SKELETON?.status(status,'Loading developer profile');
  try{
    const user=await window.devMatchBackend.ready;
    let accountProfile=null;
    let person=null;
    let profileMetricsAvailable=true;
    if(user){
      accountProfile=await window.devMatchBackend.loadProfile(user);
      accountRole=accountProfile.account_role;
      let directoryProfile=await loadDeveloperDirectoryProfile(requestedId);
      person=directoryProfile.person;
      profileMetricsAvailable=directoryProfile.metricsAvailable;
      if(!person){
        const {data:project,error:projectError}=await window.devMatchBackend.client.from('projects')
          .select('owner_id').eq('id',requestedId).eq('project_kind','portfolio').eq('status','published').maybeSingle();
        if(projectError)throw projectError;
        if(project){
          directoryProfile=await loadDeveloperDirectoryProfile(project.owner_id);
          person=directoryProfile.person;
          profileMetricsAvailable=directoryProfile.metricsAvailable;
        }
      }
    }else{
      let ownerId=requestedId;
      let {data:publicProjects,error:projectError}=await window.devMatchBackend.client.from('projects')
        .select('id,owner_id,title,project_type,category,price,cover_image,data,status,created_at,updated_at')
        .eq('owner_id',ownerId).eq('project_kind','portfolio').eq('status','published').order('updated_at',{ascending:false});
      if(projectError)throw projectError;
      if(!publicProjects.length){
        const {data:project,error}=await window.devMatchBackend.client.from('projects')
          .select('owner_id').eq('id',requestedId).eq('project_kind','portfolio').eq('status','published').maybeSingle();
        if(error)throw error;
        if(project){
          ownerId=project.owner_id;
          const result=await window.devMatchBackend.client.from('projects')
            .select('id,owner_id,title,project_type,category,price,cover_image,data,status,created_at,updated_at')
            .eq('owner_id',ownerId).eq('project_kind','portfolio').eq('status','published').order('updated_at',{ascending:false});
          if(result.error)throw result.error;
          publicProjects=result.data||[];
        }
      }
      if(publicProjects.length){
        person={id:ownerId,display_name:'Developer',username:null,profile_data:{},published_portfolio_count:publicProjects.length};
        publicProfileProjects=publicProjects;
      }
    }
    if(!person){showError('This developer profile is not available.');return;}
    let profileReviews=[];
    let profileRatingSummary={reviewCount:0,overallRating:null,criteria:{}};
    try{
      [profileReviews,profileRatingSummary]=await Promise.all([
        window.devMatchBackend.loadProfileReviews(person.id,'developer'),
        window.devMatchBackend.loadProfileRatingSummary(person.id,'developer')
      ]);
    }catch(error){
      console.error('Unable to load public developer reviews from Supabase.',error);
      reviewsLoadFailed=true;
    }
    let rows=publicProfileProjects;
    if(!rows){
      const result=await window.devMatchBackend.client.from('projects')
        .select('id,title,project_type,category,price,cover_image,data,status,created_at,updated_at')
        .eq('owner_id',person.id).eq('project_kind','portfolio').eq('status','published').order('updated_at',{ascending:false});
      if(result.error)throw result.error;
      rows=result.data||[];
    }
    publicProfileProjects=null;
    projects=(rows||[]).map(projectRecord);
    const profile=person.profile_data||{};
    const name=String(person.display_name||'DEV-MATCH member');
    const username=String(person.username||profile.username||'').replace(/^@/,'');
    profileDeveloperIdentity={name,handle:username?`@${username}`:'',initials:initials(name)};
    const overviewLocation=[profile.city,profile.country].map(value=>String(value||'').trim()).filter(Boolean).join(', ');
    const location=overviewLocation||'Location not provided';
    const specialtyValues=Array.isArray(profile.specialty)?profile.specialty:typeof profile.specialty==='string'?[profile.specialty]:[];
    const selectedSpecialties=specialtyValues.map(value=>String(value).trim()).filter(Boolean);
    const customSpecialty=typeof profile.specialtyOther==='string'?profile.specialtyOther.trim():'';
    if(customSpecialty&&!selectedSpecialties.some(value=>value.toLowerCase()==='other'))selectedSpecialties.push('Other');
    const specialties=window.devMatchProfileSpecialties
      ?window.devMatchProfileSpecialties.normalize(profile)
      :[...new Set(selectedSpecialties.map(value=>value.toLowerCase()==='other'&&customSpecialty?customSpecialty:value))];
    const skills=normalizeList(profile.skills);
    const experiences=profileExperiences(profile);
    document.title=`${name} — DEV-MATCH`;
    document.getElementById('breadcrumbName').textContent=name;
    document.getElementById('developerHandle').textContent=username?`@${username}`:'';
    document.getElementById('developerLocation').textContent=location;
    document.getElementById('developerRole').textContent=specialties.join(', ')||'Developer';
    document.getElementById('developerJoined').textContent='';
    document.getElementById('developerAbout').textContent=String(profile.bio||'No bio added yet.');
    const hourlyRate=String(profile.hourlyRate||'').trim();
    const minimumProject=String(profile.minProjectPrice||'').trim();
    document.getElementById('developerHourlyRate').textContent=hourlyRate?`${hourlyRate} / hour`:'Not provided';
    document.getElementById('developerMinimumProject').textContent=minimumProject||'Not provided';
    const workTerms=normalizeList(profile.contractTypes);
    const workTermsRoot=document.getElementById('developerWorkTerms');
    workTermsRoot.classList.toggle('empty-state',workTerms.length===0);
    workTermsRoot.classList.toggle('contract-list',workTerms.length>0);
    workTermsRoot.innerHTML=workTerms.length
      ?workTerms.map(term=>`<span>${escapeHtml(term)}</span>`).join('')
      :'No work terms added yet.';
    document.getElementById('statProjects').textContent=String(projects.length);
    const projectFavorites=profileMetricsAvailable?publicCount(person.published_portfolio_favorites_count):null;
    const profileViews=profileMetricsAvailable?publicCount(person.published_portfolio_views_count):null;
    document.getElementById('statProjectFavorites').textContent=String(projectFavorites??'Unavailable');
    document.getElementById('statViews').textContent=String(profileViews??'Unavailable');
    profileRatingCount=profileRatingSummary.reviewCount;
    profileRating=profileRatingSummary.overallRating;
    profileRatingLabel=reviewsLoadFailed?'Unavailable':profileRatingCount===0?'Belum ada rating':profileRatingCount<3?'New':`★ ${profileRating.toFixed(1)}`;
    document.getElementById('statRating').textContent=reviewsLoadFailed?'—':profileRatingCount<3?profileRatingLabel:`★ ${profileRating.toFixed(1)}`;
    window.DEVMATCH_PROFILE_OVERVIEW.render(identity,{
      role:'developer',
      name,
      username,
      avatar:profile.avatar,
      initials:initials(name),
      availability:String(profile.availability||''),
      location:overviewLocation,
      bio:String(profile.bio||'').trim()||'No bio added yet.',
      statistics:{
        views:compactOverviewCount(profileViews),
        favorites:compactOverviewCount(projectFavorites),
        rating:reviewsLoadFailed?'-':profileRatingCount<3?profileRatingLabel:profileRating.toFixed(1)
      }
    });
    document.getElementById('statReviewCount').textContent=reviewsLoadFailed
      ?'unable to load reviews'
      :profileRatingCount?`from ${profileRatingCount} reviews`:'no reviews yet';
    renderProfileReviews(profileReviews,profileRatingSummary,reviewsLoadFailed,Boolean(user&&user.id===person.id));
    window.DEVMATCH_PROFILE_REVIEW_ACTIONS?.connect(reviewsPanel);
    document.getElementById('portfolioCount').textContent=String(projects.length);
    const contactUrl=user&&accountRole==='client'?`devmatch-chat.html?contact=${encodeURIComponent(person.id)}&role=client`:'devmatch-auth.html?mode=login';
    const isOwnProfile=Boolean(user&&user.id===person.id);
    window.DEVMATCH_PROFILE_CONTACT.configureDirectMessageLink(document.getElementById('sidebarContactDeveloper'),contactUrl,isOwnProfile);
    document.getElementById('developerSpecialties').innerHTML=specialties.length?specialties.map(value=>{
      const details=window.devMatchProfileSpecialties
        ?window.devMatchProfileSpecialties.getDetails(value)
        :specialtyDetails[value]||Object.entries(specialtyDetails).find(([name])=>name.toLowerCase()===value.toLowerCase())?.[1]||specialtyDetails.Other;
      return `<div class="profile-specialty-card"><svg viewBox="0 0 24 24" aria-hidden="true">${details.icon}</svg><b>${escapeHtml(value)}</b><small>${escapeHtml(details.description)}</small></div>`;
    }).join(''):'<span>No specialization added yet.</span>';
    document.getElementById('developerSkills').innerHTML=skills.length?skills.map(value=>`<span>${escapeHtml(value)}</span>`).join(''):'<span>No skills added yet.</span>';
    renderExperience(experiences);
    renderConnectedApps(profile);
    const clientName=String(accountProfile?.display_name||accountProfile?.profile_data?.displayName||'Client').trim();
    document.getElementById('clientName').textContent=clientName;
    setAvatar('clientInitials',accountProfile?.profile_data?.avatar,initials(clientName));
    if(user&&accountRole==='client'){
      const records=await window.devMatchBackend.loadFavorites();
      favoriteDeveloper=records.some(item=>item.type==='developer'&&item.id===person.id);
    }
    renderFavoriteButton();
    const filters=['All',...new Set(projects.map(item=>item.type.trim()).filter(Boolean).sort((a,b)=>a.localeCompare(b)))];
    filtersRoot.innerHTML=filters.map(filter=>`<button type="button" class="${filter==='All'?'active':''}" data-filter="${escapeHtml(filter)}">${escapeHtml(filter)} <small>${filter==='All'?projects.length:projects.filter(item=>item.type===filter).length}</small></button>`).join('');
    filtersRoot.addEventListener('click',event=>{
      const button=event.target.closest('[data-filter]');if(!button)return;
      activeFilter=button.dataset.filter;filtersRoot.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button));renderProjects();
    });
    sortSelect.addEventListener('change',renderProjects);
    document.getElementById('profileSearch').addEventListener('input',event=>{activeQuery=event.target.value.trim().toLowerCase();renderProjects();});
    document.querySelector('.portfolio-tabs').addEventListener('click',async event=>{
      const button=event.target.closest('[data-tab]');if(!button)return;
      const showProjects=button.dataset.tab==='projects';
      const showReviews=button.dataset.tab==='reviews';
      document.querySelectorAll('[data-tab]').forEach(tab=>{const selected=tab===button;tab.classList.toggle('active',selected);tab.setAttribute('aria-selected',String(selected));});
      updateTabIndicator(button);
      filtersRoot.hidden=!showProjects;grid.hidden=!showProjects;sortSelect.closest('.sort-control').hidden=!showProjects;
      reviewsPanel.hidden=!showReviews;commentsPanel.hidden=showProjects||showReviews;
      empty.hidden=!showProjects||grid.children.length>0;
      if(button.dataset.tab==='comments'){
        window.DEVMATCH_SKELETON?.status(commentsPanel,'Loading comments');
        try{
          const groups=await Promise.all(projects.map(async item=>(await window.devMatchBackend.loadProjectComments(item.id)).comments.map(comment=>({...comment,project:item.title}))));
          const comments=groups.flat();
          await loadCommenterRoles(comments);
          renderComments(comments);
        }catch(error){console.error('Unable to load public portfolio comments from Supabase.',error);commentsPanel.textContent='Comments could not be loaded. Check your connection and try again.';}
      }
    });
    document.getElementById('favoriteDeveloper').addEventListener('click',async()=>{
      const userNow=await window.devMatchBackend.ready;if(!userNow){location.href='devmatch-auth.html?mode=login';return;}
      const saved=favoriteDeveloper;
      if(saved&&!await window.DEVMATCH_FAVORITE_FEEDBACK.confirmRemoval(
        favoriteRemoveDialog,
        favoriteRemoveMessage,
        person.display_name||'this developer'
      ))return;
      try{
        await window.devMatchBackend.setFavorite('developer',person.id,!saved);
        favoriteDeveloper=!saved;renderFavoriteButton();
        window.DEVMATCH_NAV_BADGES?.updateFavorites();
        window.DEVMATCH_FAVORITE_FEEDBACK.showToast(
          favoriteToast,
          saved?'Developer removed from your favorites':'Developer added to your favorites',
          saved?async()=>{
            try{await window.devMatchBackend.setFavorite('developer',person.id,true);}
            catch(error){
              console.error('Unable to restore developer favorite in Supabase.',error);
              window.alert('Unable to restore this favorite. Please try again.');
              return false;
            }
            favoriteDeveloper=true;renderFavoriteButton();
            window.DEVMATCH_NAV_BADGES?.updateFavorites();
            return true;
          }:null,
          saved ? null : {tab: 'developers'}
        );
      }catch(error){console.error('Unable to update developer favorite in Supabase.',error);window.alert('Unable to save this favorite. Please try again.');}
    });
    document.getElementById('copyProfileLink').addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(location.href);document.getElementById('copyProfileLink').textContent='✓';}
      catch{document.getElementById('copyProfileLink').setAttribute('aria-label','Copying is not available in this browser');}
    });
    renderProjects();
    moveProfileContent();
    desktopProfileLayout.addEventListener('change',moveProfileContent);
    window.addEventListener('resize',moveProfileContent);
    status.hidden=true;identity.hidden=false;profileLayout.hidden=false;columns.hidden=false;
    requestAnimationFrame(()=>updateTabIndicator());
    window.addEventListener('resize',()=>updateTabIndicator());
    document.querySelector('.portfolio-tabs').addEventListener('scroll',()=>updateTabIndicator(),{passive:true});
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>updateTabIndicator());
  }catch(error){
    console.error('Unable to load the developer profile from Supabase.',error);
    showError('The developer profile could not be loaded. Check your connection and try again.');
  }
})();
