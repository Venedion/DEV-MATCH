(async function(){
  'use strict';

  const requestedId=new URLSearchParams(location.search).get('client');
  const status=document.getElementById('profileStatus');
  const unavailable=document.getElementById('profileUnavailable');
  const unavailableMessage=document.getElementById('profileUnavailableMessage');
  const profileState=document.getElementById('clientProfileState');
  const profileRoot=document.getElementById('clientProfile');
  const favoriteButton=document.getElementById('favoriteClient');
  const favoriteToast=document.getElementById('favoriteActionToast');
  const favoriteRemoveDialog=document.getElementById('favoriteRemoveDialog');
  const favoriteRemoveMessage=document.getElementById('favoriteRemoveMessage');
  const favoriteStorageKey='devmatch-favorite-clients';
  window.DEVMATCH_SKELETON?.status(status,'Loading client profile');
  window.DEVMATCH_SKELETON?.cards(document.getElementById('projectGrid'),3,'showcase');
  window.DEVMATCH_SKELETON?.rows(document.getElementById('reviewList'),3);
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const initials=name=>(String(name||'').match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'CL';
  const formatCompact=value=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value).replace('K','k');
  const whatsappIconSvg='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path transform="translate(3.6 3.6) scale(.7)" d="M17.5 14.4c-.3-.1-1.8-.9-2.1-1-.3-.1-.5-.1-.7.1s-.8 1-.9 1.2c-.2.2-.4.2-.7.1s-1.3-.5-2.5-1.5c-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5s0-.4-.1-.5c-.1-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.2-1.2 2.9 1.2 3.4 1.4 3.6c.2.2 2.4 3.7 5.8 5.1 3.4 1.4 3.4.9 4 .9.6 0 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.1-.3-.2-.6-.3z" fill="currentColor"/></svg>';

  function showUnavailable(message){
    status.hidden=true;
    unavailableMessage.textContent=message;
    unavailable.hidden=false;
  }

  function setText(id,value){
    const element=document.getElementById(id);
    if(element)element.textContent=value;
  }

  function renderOverviewStatistics(statistics){
    window.DEVMATCH_PROFILE_OVERVIEW.render(profileRoot.querySelector('[data-profile-overview]'),{statistics});
  }

  async function renderClientProfileMetrics(clientId,user){
    if(!user){
      renderOverviewStatistics({views:'—',favorites:'—'});
      return;
    }
    if(user.id!==clientId){
      try{
        await window.devMatchBackend.recordClientProfileView(clientId);
      }catch(error){
        console.error('Unable to record the client profile view in Supabase.',error);
      }
    }
    try{
      const metrics=await window.devMatchBackend.loadClientProfileMetrics(clientId);
      renderOverviewStatistics({
        views:formatCompact(metrics.views),
        favorites:formatCompact(metrics.favorites)
      });
    }catch(error){
      console.error('Unable to load client profile metrics from Supabase.',error);
      renderOverviewStatistics({views:'—',favorites:'—'});
    }
  }

  function renderIdentity(client,profile){
    const name=String(client.display_name||'DEV-MATCH member');
    const location=[profile.city,profile.country].filter(Boolean).join(', ');
    const username=String(client.username||profile.username||'').replace(/^@/,'');
    setText('clientProfileBreadcrumbName',name);
    setText('identityBio',String(profile.bio||'').trim()||'No bio added yet.');
    setText('identityHandle',username?`@${username}`:'');
    document.getElementById('identityHandle').hidden=!username;
    setText('identityLocation',location);
    document.getElementById('identityLocation').hidden=!location;
    setText('identitySpecialty',String(profile.industry||''));
    document.getElementById('identitySpecialty').hidden=!profile.industry;
    window.DEVMATCH_PROFILE_OVERVIEW.render(profileRoot.querySelector('[data-profile-overview]'),{
      role:'client',
      name,
      username,
      avatar:profile.avatar,
      initials:initials(name),
      location,
      bio:String(profile.bio||'').trim()||'No bio added yet.'
    });
    document.title=`${name} — Client Profile | DEV-MATCH`;
  }

  function initializeProfileNavigation(){
    const source=new URLSearchParams(location.search).get('from');
    const backLink=document.getElementById('clientProfileBackLink');
    if(source==='find-clients'){
      backLink.href='devmatch-find-clients.html';
      backLink.textContent='Find Clients';
    }else{
      backLink.href='devmatch-find-projects.html';
      backLink.textContent='Find Projects';
    }
  }

  function renderCompanyDetails(profile,displayName){
    const location=[profile.city,profile.country].filter(Boolean).join(', ')||'Not provided';
    document.getElementById('roleInfoCard').innerHTML=`<div class="card-heading"><h2>Company Details</h2></div><div class="role-info-grid"><div class="role-info-item"><small>BUSINESS NAME</small><strong>${escapeHtml(profile.companyName||displayName||'Not provided')}</strong></div><div class="role-info-item"><small>INDUSTRY</small><strong>${escapeHtml(profile.industry||'Not provided')}</strong></div><div class="role-info-item"><small>NPWP STATUS</small><strong>Not provided</strong></div><div class="role-info-item"><small>BUSINESS LOCATION</small><strong>${escapeHtml(location)}</strong></div></div>`;
  }

  function safeExternalAppUrl(value,host,pathPrefix=''){
    const raw=String(value||'').trim();
    let candidate;
    if(/^https?:\/\//i.test(raw))candidate=raw;
    else if(/^(?:www\.)?[a-z\d.-]+\.[a-z]{2,}(?:\/|$)/i.test(raw))candidate=`https://${raw}`;
    else{
      const path=raw.replace(/^@/,'').split('/').filter(Boolean).map(encodeURIComponent).join('/');
      candidate=`https://${host}/${pathPrefix}${path}`;
    }
    try{
      const url=new URL(candidate);
      return ['https:','http:'].includes(url.protocol)?url.href:`https://${host}/${pathPrefix}`;
    }catch(error){
      return `https://${host}/${pathPrefix}`;
    }
  }

  function renderConnectedApps(profile){
    const isConnected=(field,hasDetails)=>typeof profile[field]==='boolean'?profile[field]:hasDetails;
    const whatsapp=String(profile.whatsapp||'').replace(/\D/g,'');
    const gmail=String(profile.googleEmail||profile.email||'').trim();
    const instagramUrl=window.DEVMATCH_PROFILE_CONTACT.instagramUrl(profile.instagram||'');
    const apps=[
      {name:'WhatsApp Business',iconSvg:whatsappIconSvg,connected:isConnected('whatsappConnected',Boolean(whatsapp)),href:whatsapp?`https://wa.me/${whatsapp}`:'https://web.whatsapp.com/'},
      {name:'GitHub',icon:'GH',connected:isConnected('githubConnected',Boolean(profile.github||profile.githubUrl||profile.githubUsername)),href:safeExternalAppUrl(profile.githubUrl||profile.github||profile.githubUsername,'github.com')},
      {name:'Google',icon:'G',connected:isConnected('googleConnected',Boolean(gmail)),href:gmail?`https://mail.google.com/mail/u/0/?authuser=${encodeURIComponent(gmail)}`:'https://myaccount.google.com/'},
      {name:'Instagram',icon:'In',connected:isConnected('instagramConnected',Boolean(profile.instagram)),href:instagramUrl||'https://www.instagram.com/'},
      {name:'LinkedIn',icon:'in',connected:isConnected('linkedinConnected',Boolean(profile.linkedin||profile.linkedinUrl)),href:safeExternalAppUrl(profile.linkedinUrl||profile.linkedin,'www.linkedin.com','in/')}
    ];
    const connectedApps=apps.filter(app=>app.connected);
    document.getElementById('connectedList').innerHTML=connectedApps.length
      ?connectedApps.map(app=>`<a class="connected-app connected-app-link" href="${escapeHtml(app.href)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(app.name)}"><span class="connected-app-info"><span class="app-icon" style="color:${app.iconSvg?'#25d366':'inherit'}">${app.iconSvg||escapeHtml(app.icon||'')}</span><b>${escapeHtml(app.name)}</b></span><svg class="connected-app-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></a>`).join('')
      :'<p class="empty-state">No connected apps.</p>';
  }

  function saveFavoriteCache(ids){
    try{
      localStorage.setItem(favoriteStorageKey,JSON.stringify(ids));
    }catch(error){
      console.warn('Could not update the client favorites cache.',error);
    }
  }

  function renderFavoriteButton(isFavorite,clientName){
    favoriteButton.setAttribute('aria-pressed',String(isFavorite));
    favoriteButton.setAttribute('aria-label',`${isFavorite?'Remove':'Add'} ${clientName} ${isFavorite?'from':'to'} favorites`);
    favoriteButton.title=isFavorite?'Favorited':'Favorite';
    favoriteButton.classList.toggle('is-favorite',isFavorite);
    favoriteButton.querySelector('span').textContent=isFavorite?'Favorited':'Favorite';
  }

  async function initializeFavoriteButton(user,client){
    if(!user){
      favoriteButton.disabled=true;
      favoriteButton.title='Sign in to favorite this client';
      return;
    }
    let favoriteIds;
    try{
      const favorites=await window.devMatchBackend.loadFavorites();
      favoriteIds=favorites.filter(item=>item.type==='client').map(item=>item.id);
      saveFavoriteCache(favoriteIds);
    }catch(error){
      console.error('Unable to load client favorites from Supabase.',error);
      window.alert('Unable to load favorites. Check your connection and try again.');
      favoriteButton.disabled=true;
      return;
    }
    let isFavorite=favoriteIds.includes(client.id);
    renderFavoriteButton(isFavorite,String(client.display_name||'this client'));
    favoriteButton.addEventListener('click',async()=>{
      if(favoriteButton.disabled)return;
      const saved=isFavorite;
      favoriteButton.disabled=true;
      if(saved&&!await window.DEVMATCH_FAVORITE_FEEDBACK.confirmRemoval(
        favoriteRemoveDialog,
        favoriteRemoveMessage,
        String(client.display_name||'this client')
      )){
        favoriteButton.disabled=false;
        return;
      }
      const nextState=!saved;
      try{
        await window.devMatchBackend.setFavorite('client',client.id,nextState);
      }catch(error){
        console.error('Unable to update client favorite in Supabase.',error);
        window.alert('Unable to save this favorite. Please try again.');
        favoriteButton.disabled=false;
        return;
      }
      isFavorite=nextState;
      favoriteIds=isFavorite
        ?[...new Set([...favoriteIds,client.id])]
        :favoriteIds.filter(id=>id!==client.id);
      saveFavoriteCache(favoriteIds);
      renderFavoriteButton(isFavorite,String(client.display_name||'this client'));
      favoriteButton.disabled=false;
      window.DEVMATCH_NAV_BADGES?.updateFavorites();
      window.DEVMATCH_FAVORITE_FEEDBACK.showToast(
        favoriteToast,
        saved?'Client removed from your favorites':'Client added to your favorites',
        saved?async()=>{
          try{
            await window.devMatchBackend.setFavorite('client',client.id,true);
          }catch(error){
            console.error('Unable to restore client favorite in Supabase.',error);
            window.alert('Unable to restore this favorite. Please try again.');
            return false;
          }
          isFavorite=true;
          favoriteIds=[...new Set([...favoriteIds,client.id])];
          saveFavoriteCache(favoriteIds);
          renderFavoriteButton(true,String(client.display_name||'this client'));
          window.DEVMATCH_NAV_BADGES?.updateFavorites();
          return true;
        }:null,
        saved?null:{tab:'clients'}
      );
    });
  }

  function initializeProfileLayout(){
    const desktopLayout=window.matchMedia('(min-width:821px) and (orientation:landscape)');
    const contactCard=profileRoot.querySelector('.contact-card');
    const connectedAppsCard=document.getElementById('connectedAppsCard');
    const profileShowcase=profileRoot.querySelector('.profile-showcase');
    const moveContent=()=>{
      const desktop=desktopLayout.matches;
      const contactTarget=document.getElementById(desktop?'clientQuickContactDesktop':'clientQuickContactMobile');
      const connectedAppsTarget=document.getElementById(desktop?'clientConnectedAppsDesktop':'clientConnectedAppsMobile');
      const showcaseTarget=document.getElementById(desktop?'clientShowcaseDesktop':'clientProfileColumns');
      if(contactCard.parentElement!==contactTarget)contactTarget.append(contactCard);
      if(connectedAppsCard.parentElement!==connectedAppsTarget)connectedAppsTarget.append(connectedAppsCard);
      if(profileShowcase.parentElement!==showcaseTarget)showcaseTarget.append(profileShowcase);
    };
    moveContent();
    desktopLayout.addEventListener('change',moveContent);
    window.addEventListener('resize',moveContent);
  }

  async function shareClientProfile(clientName){
    const url=new URL(location.href);
    const shareData={title:`${clientName} | DEV-MATCH`,text:`Check out ${clientName}'s profile on DEV-MATCH.`,url:url.href};
    if(typeof navigator.share==='function'){
      try{
        await navigator.share(shareData);
        return;
      }catch(error){
        if(error&&error.name==='AbortError')return;
        console.warn('Native sharing is unavailable; copying the client profile link instead.',error);
      }
    }
    if(!navigator.clipboard?.writeText){
      window.alert('Sharing is not supported in this browser.');
      return;
    }
    try{
      await navigator.clipboard.writeText(url.href);
      window.alert('Client profile link copied to clipboard.');
    }catch(error){
      console.error('Unable to copy the client profile link.',error);
      window.alert('Unable to share this profile. Please copy the page URL manually.');
    }
  }

  function renderRequests(requests){
    setText('statProjects',String(requests.length));
    const saves=requests.reduce((sum,row)=>{
      const data=row.data&&typeof row.data==='object'?row.data:{};
      return sum+(Number(data.saves??data.favorites)||0);
    },0);
    const views=requests.reduce((sum,row)=>{
      const data=row.data&&typeof row.data==='object'?row.data:{};
      return sum+(Number(data.views)||0);
    },0);
    setText('statSaves',formatCompact(saves));
    setText('statViews',formatCompact(views));
    document.getElementById('projectGrid').innerHTML=requests.length?requests.map(row=>{
      const data=row.data&&typeof row.data==='object'?row.data:{};
      const title=String(row.title||'Untitled request');
      const category=String(row.category||row.project_type||'Project request');
      const description=String(data.description||data.overview||'No description provided.');
      const price=String(row.price||data.budgetLabel||data.budget||'Budget not specified');
      const tags=[row.category,row.project_type,...(Array.isArray(data.stack)?data.stack:[])].filter(Boolean);
      return `<a class="showcase-project" href="devmatch-find-project-detail.html?request=${encodeURIComponent(row.id)}" aria-label="${escapeHtml(title)} — view details"><div class="project-art art-website" aria-hidden="true"><div class="project-browser"><div class="browser-bar"><i></i><i></i><i></i></div><div class="browser-content"><span class="art-accent"></span></div></div></div><div class="project-copy"><span class="project-category">${escapeHtml(category)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p><div class="request-tags">${tags.map(tag=>`<span>${escapeHtml(tag)}</span>`).join('')}</div><footer class="project-footer"><strong>${escapeHtml(price)}</strong></footer></div></a>`;
    }).join(''):'<p class="empty-state">You have no open requests yet. Open project requests will appear here.</p>';
  }

  function renderReviews(reviews,summary,reviewsLoadFailed,isOwnProfile=false){
    if(reviewsLoadFailed){
      setText('statRating','—');
      setText('statReviews','unable to load reviews');
      renderOverviewStatistics({rating:'-'});
      document.getElementById('reviewList').innerHTML='<p class="empty-state">Reviews could not be loaded. Check your connection and try again.</p>';
      return;
    }
    const count=summary.reviewCount;
    const ratingLabel=count===0?'Belum ada rating':count<3?'New':`★ ${summary.overallRating.toFixed(1)}`;
    setText('statRating',count<3?ratingLabel:`★ ${summary.overallRating.toFixed(1)}`);
    setText('statReviews',count?`from ${count} reviews`:'no reviews yet');
    renderOverviewStatistics({rating:count<3?ratingLabel:summary.overallRating.toFixed(1)});
    const criterionRows=[
      ['Clarity of the brief',summary.criteria.clarityOfBrief],
      ['Responsiveness',summary.criteria.responsiveness],
      ['Respecting the agreed scope',summary.criteria.respectingScope]
    ].filter(([,value])=>value!==null);
    const criteriaSummary=criterionRows.length
      ?`<dl class="review-criteria-summary">${criterionRows.map(([label,value])=>`<div><dt>${label}</dt><dd>${Number(value).toFixed(1)}</dd></div>`).join('')}</dl>`:'';
    const items=reviews.slice(0,8).map(review=>{
      const details=[
        ['Clarity of the brief',review.criteria.clarityOfBrief],
        ['Responsiveness',review.criteria.responsiveness],
        ['Respecting the agreed scope',review.criteria.respectingScope]
      ].filter(([,value])=>value!==null);
      const actions=window.DEVMATCH_PROFILE_REVIEW_ACTIONS?.render(review,isOwnProfile);
      return `<article class="review-item"><span class="review-avatar">${escapeHtml(review.reviewerInitials||initials(review.reviewerName))}</span><div class="review-copy"><h3>${escapeHtml(review.reviewerName)}</h3><small>${escapeHtml(review.projectTitle||'Completed project')}</small>${review.text?`<p>${escapeHtml(review.text)}</p>`:''}${details.length?`<small>${details.map(([label,value])=>`${label}: ${value}`).join(' · ')}</small>`:''}${review.reply?`<p class="review-reply"><strong>Response:</strong> ${escapeHtml(review.reply)}</p>`:''}${actions||''}</div><span class="review-rating">${review.rating.toFixed(1)} / 5</span></article>`;
    }).join('');
    document.getElementById('reviewList').innerHTML=`${criteriaSummary}${items||'<p class="empty-state">Belum ada rating.</p>'}`;
  }

  function activateTab(button,focus){
    const selected=button.dataset.profileTab;
    document.querySelectorAll('.profile-tab').forEach(tab=>{
      const active=tab===button;
      tab.classList.toggle('active',active);
      tab.setAttribute('aria-selected',String(active));
      tab.tabIndex=active?0:-1;
    });
    document.querySelectorAll('.tab-panel').forEach(panel=>{
      const active=panel.id===`panel${selected[0].toUpperCase()}${selected.slice(1)}`;
      panel.hidden=!active;
      panel.classList.toggle('active',active);
    });
    updateTabIndicator(button);
    if(focus)button.focus();
  }

  function updateTabIndicator(button=document.querySelector('.profile-tab.active')){
    const tabs=document.querySelector('.profile-tabs');
    if(!tabs||!button)return;
    const tabBounds=button.getBoundingClientRect();
    const tabsBounds=tabs.getBoundingClientRect();
    const left=tabBounds.left-tabsBounds.left-tabs.clientLeft+tabs.scrollLeft;
    tabs.style.setProperty('--profile-tab-indicator-left',`${left}px`);
    tabs.style.setProperty('--profile-tab-indicator-width',`${tabBounds.width}px`);
  }

  function initializeTabs(){
    const tabs=[...document.querySelectorAll('.profile-tab')];
    tabs.forEach((button,index)=>{
      button.addEventListener('click',()=>activateTab(button,false));
      button.addEventListener('keydown',event=>{
        const offset=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;
        if(!offset)return;
        event.preventDefault();
        activateTab(tabs[(index+offset+tabs.length)%tabs.length],true);
      });
    });
    requestAnimationFrame(()=>updateTabIndicator());
    window.addEventListener('resize',()=>updateTabIndicator());
    document.querySelector('.profile-tabs').addEventListener('scroll',()=>updateTabIndicator(),{passive:true});
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>updateTabIndicator());
  }

  if(!requestedId){showUnavailable('This client profile could not be found.');return;}
  status.hidden=false;
  try{
    const user=await window.devMatchBackend.ready;
    if(user){
      const account=await window.devMatchBackend.loadProfile(user);
      if(account.account_role!=='dev'){
        showUnavailable('Client profiles are available in developer mode.');
        return;
      }
    }
    const [{data:client,error:clientError},{data:requests,error:requestsError}]=await Promise.all([
      window.devMatchBackend.client.from('directory_people')
        .select('id,display_name,username,account_role,profile_data')
        .eq('id',requestedId).eq('account_role','client').maybeSingle(),
      window.devMatchBackend.client.from('projects')
        .select('id,title,project_type,category,price,data')
        .eq('owner_id',requestedId).eq('project_kind','request').eq('status','open')
        .order('updated_at',{ascending:false})
    ]);
    if(clientError)throw clientError;
    if(requestsError)throw requestsError;
    if(!client){showUnavailable('This client profile could not be found.');return;}
    const profile=client.profile_data&&typeof client.profile_data==='object'?client.profile_data:{};
    const name=String(client.display_name||'DEV-MATCH member');
    initializeProfileNavigation();
    renderIdentity(client,profile);
    renderCompanyDetails(profile,name);
    renderRequests(requests||[]);
    await renderClientProfileMetrics(client.id,user);
    let reviews=[];
    let ratingSummary={reviewCount:0,overallRating:null,criteria:{}};
    let reviewsLoadFailed=false;
    try{
      [reviews,ratingSummary]=await Promise.all([
        window.devMatchBackend.loadProfileReviews(client.id,'client'),
        window.devMatchBackend.loadProfileRatingSummary(client.id,'client')
      ]);
    }catch(error){
      console.error('Unable to load public client reviews from Supabase.',error);
      reviewsLoadFailed=true;
    }
    renderReviews(reviews,ratingSummary,reviewsLoadFailed,Boolean(user&&user.id===client.id));
    window.DEVMATCH_PROFILE_REVIEW_ACTIONS?.connect(document.getElementById('reviewList'));
    document.getElementById('activityList').innerHTML='<p class="empty-state">New profile activity and inquiries will appear here.</p>';
    renderConnectedApps(profile);
    const contactUrl=user
      ?`devmatch-chat.html?contact=${encodeURIComponent(client.id)}&client=${encodeURIComponent(client.id)}`
      :'devmatch-auth.html?mode=login';
    window.DEVMATCH_PROFILE_CONTACT.configureDirectMessageLink(
      document.getElementById('directMessageLink'),
      contactUrl,
      Boolean(user&&user.id===client.id)
    );
    document.getElementById('shareClientProfile').addEventListener('click',()=>shareClientProfile(name));
    await initializeFavoriteButton(user,client);
    initializeProfileLayout();
    document.getElementById('floatingChatLink').href=user?'devmatch-chat.html':'devmatch-auth.html?mode=login';
    status.hidden=true;
    profileState.hidden=true;
    profileRoot.hidden=false;
    initializeTabs();
  }catch(error){
    console.error('Unable to load the full client profile from Supabase.',error);
    showUnavailable('The client profile could not be loaded. Check your connection and try again.');
  }
})();
