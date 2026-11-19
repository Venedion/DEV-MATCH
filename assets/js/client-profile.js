(async function(){
  'use strict';

  const requestedId=new URLSearchParams(location.search).get('client');
  const status=document.getElementById('profileStatus');
  const unavailable=document.getElementById('profileUnavailable');
  const unavailableMessage=document.getElementById('profileUnavailableMessage');
  const profileState=document.getElementById('clientProfileState');
  const profileRoot=document.getElementById('clientProfile');
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const initials=name=>(String(name||'').match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'CL';
  const formatCompact=value=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value).replace('K','k');

  function showUnavailable(message){
    status.hidden=true;
    unavailableMessage.textContent=message;
    unavailable.hidden=false;
  }

  function setText(id,value){
    const element=document.getElementById(id);
    if(element)element.textContent=value;
  }

  function setAvatar(imageUrl,fallback){
    const element=document.getElementById('profileAvatar');
    let validImage=typeof imageUrl==='string'&&/^data:image\/(?:jpeg|png);base64,/.test(imageUrl);
    if(typeof imageUrl==='string'&&imageUrl.startsWith('https://')){
      try{
        const url=new URL(imageUrl);
        validImage=url.origin==='https://yxwktllqbmhustmhdaqi.supabase.co'
          &&url.pathname.startsWith('/storage/v1/object/public/project-media/');
      }catch(error){
        validImage=false;
      }
    }
    if(!validImage){
      element.textContent=fallback;
      return;
    }
    const image=document.createElement('img');
    image.src=imageUrl;
    image.alt='';
    image.setAttribute('aria-hidden','true');
    element.replaceChildren(image);
  }

  function normalizeList(value){
    const items=Array.isArray(value)?value:typeof value==='string'?value.split(/[,;\n]/):[];
    return items.map(item=>String(item).trim()).filter(Boolean);
  }

  function renderIdentity(client,profile){
    const name=String(client.display_name||'DEV-MATCH member');
    const availability=String(profile.availability||'');
    const location=[profile.city,profile.country].filter(Boolean).join(', ');
    const username=String(client.username||profile.username||'').replace(/^@/,'');
    setText('profileName',name);
    setText('clientProfileBreadcrumbName',name);
    setAvatar(profile.avatar,initials(name));
    setText('identityBio',String(profile.bio||'').trim()||'No bio added yet.');
    const badge=document.getElementById('availabilityBadge');
    badge.querySelector('span').textContent=availability;
    badge.hidden=!availability;
    badge.classList.toggle('busy',availability.toLowerCase().includes('busy'));
    badge.classList.toggle('unavailable',/not available|closed/i.test(availability));
    setText('identityHandle',username?`@${username}`:'');
    document.getElementById('identityHandle').hidden=!username;
    setText('identityLocation',location);
    document.getElementById('identityLocation').hidden=!location;
    setText('identitySpecialty',String(profile.industry||''));
    document.getElementById('identitySpecialty').hidden=!profile.industry;
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
    setText('aboutCopy',String(profile.bio||'').trim()||'No bio added yet.');
    const skills=normalizeList(profile.skills);
    document.getElementById('skillList').innerHTML=skills.length
      ?skills.map(skill=>`<span class="profile-skill-value">${escapeHtml(skill)}</span>`).join('')
      :'<span class="empty-state">No skills added yet.</span>';
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

  function renderReviews(reviews,reviewsLoadFailed){
    if(reviewsLoadFailed){
      setText('statRating','—');
      setText('statReviews','unable to load reviews');
      document.getElementById('reviewList').innerHTML='<p class="empty-state">Reviews could not be loaded. Check your connection and try again.</p>';
      return;
    }
    if(!reviews.length){
      setText('statRating','—');
      setText('statReviews','no reviews yet');
      document.getElementById('reviewList').innerHTML='<p class="empty-state">Developer reviews will appear here after a completed project.</p>';
      return;
    }
    const average=reviews.reduce((sum,review)=>sum+review.rating,0)/reviews.length;
    setText('statRating',`★ ${average.toFixed(1)}`);
    setText('statReviews',`from ${reviews.length} reviews`);
    document.getElementById('reviewList').innerHTML=reviews.slice(0,8).map(review=>{
      const stars=Math.round(review.rating);
      return `<article class="review-item"><span class="review-avatar">${escapeHtml(review.reviewerInitials||initials(review.reviewerName))}</span><div class="review-copy"><h3>${escapeHtml(review.reviewerName)}</h3><small>${escapeHtml(review.projectTitle||'Completed project')}</small><p>${escapeHtml(review.text)}</p></div><span class="review-rating" aria-label="${stars} out of 5 stars">${'★'.repeat(stars)}</span></article>`;
    }).join('');
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
    let reviews=[];
    let reviewsLoadFailed=false;
    try{
      reviews=await window.devMatchBackend.loadProfileReviews(client.id);
    }catch(error){
      console.error('Unable to load public client reviews from Supabase.',error);
      reviewsLoadFailed=true;
    }
    renderReviews(reviews,reviewsLoadFailed);
    document.getElementById('activityList').innerHTML='<p class="empty-state">New profile activity and inquiries will appear here.</p>';
    const contactUrl=user
      ?`devmatch-chat.html?contact=${encodeURIComponent(client.id)}&client=${encodeURIComponent(client.id)}`
      :'devmatch-auth.html?mode=login';
    document.getElementById('directMessageLink').href=contactUrl;
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
