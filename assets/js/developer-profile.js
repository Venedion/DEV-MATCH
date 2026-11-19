(async function(){
  'use strict';
  const requestedId=new URLSearchParams(location.search).get('developer');
  const status=document.getElementById('profileStatus');
  const identity=document.querySelector('.profile-identity-card');
  const columns=document.querySelector('.profile-columns');
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const initials=name=>(String(name||'').match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'DM';
  const specialtyDetails={
    'Full-stack':{description:'Front + back end',icon:'<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>'},
    Frontend:{description:'Web interfaces',icon:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>'},
    Backend:{description:'APIs & databases',icon:'<path d="M6 3v6m0 4v8M12 3v3m0 4v11M18 3v9m0 4v5M3 9h6m0 1h6m0 2h6m-6 4h6"/>'},
    'UI/UX':{description:'Design & research',icon:'<path d="m15 5 4 4M4 20l4-.8L19.2 8a2.8 2.8 0 0 0-4-4L4 15.2 4 20z"/>'},
    Mobile:{description:'Android & iOS',icon:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/>'},
    'Game Dev':{description:'Unity, Roblox...',icon:'<path d="m7 7 10 0a4 4 0 0 1 3.8 5.2l-1.2 4a2 2 0 0 1-3.3.9L14 15H10l-2.3 2.1a2 2 0 0 1-3.3-.9l-1.2-4A4 4 0 0 1 7 7z"/><path d="M7 10v4m-2-2h4m7-1h.01M17 13h.01"/>'},
    Other:{description:'Custom specialization',icon:'<path d="M12 5v14m-7-7h14"/>'}
  };
  let projects=[],favoriteDeveloper=false,accountRole=null,publicProfileProjects=null;
  let activeFilter='All',activeQuery='';
  const filters=['All','Website','Web App','Android / iOS','Desktop App'];
  const filtersRoot=document.getElementById('portfolioFilters');
  const grid=document.getElementById('portfolioGrid');
  const empty=document.getElementById('portfolioEmpty');
  const reviewsPanel=document.getElementById('publicReviewsPanel');
  const commentsPanel=document.getElementById('commentsPanel');
  const sortSelect=document.getElementById('sortProjects');
  function showError(message){
    status.hidden=false;status.textContent=message;
    identity.hidden=true;columns.hidden=true;
  }
  function projectRecord(row){
    const data=row.data&&typeof row.data==='object'?row.data:{};
    return {...data,id:row.id,title:String(row.title||data.title||''),type:String(row.project_type||data.projectType||data.type||''),
      category:String(row.category||data.category||''),description:String(data.description||data.overview||''),
      price:String(row.price||data.price||''),views:'—',favorites:'—',created:row.created_at||row.updated_at};
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
    filtered.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='newest'
      ?new Date(b.created)-new Date(a.created):a.title.localeCompare(b.title));
    grid.innerHTML=filtered.map(item=>`<article class="showcase-project">
      <div class="project-art art-dashboard"><div class="project-browser" aria-hidden="true"><div class="browser-bar"><i></i><i></i><i></i></div><div class="browser-content"><span class="art-accent"></span></div></div></div>
      <div class="project-copy"><span class="project-category">${escapeHtml(item.category)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><footer class="project-footer"><strong>${escapeHtml(item.price||'Price not specified')}</strong><span class="project-metric">Views ${escapeHtml(item.views)}</span></footer>
      <a href="devmatch-discover-project-detail.html?project=${encodeURIComponent(item.id)}">View project</a></div></article>`).join('');
    empty.hidden=filtered.length>0;
  }
  function renderComments(comments){
    commentsPanel.innerHTML=comments.length?comments.map(comment=>`<article class="review-item"><span class="review-avatar">${escapeHtml(comment.initials||'CL')}</span><div class="review-copy"><h3>${escapeHtml(comment.name||'DEV-MATCH member')}</h3><small>on ${escapeHtml(comment.project)}</small><p>${escapeHtml(comment.text)}</p></div></article>`).join(''):'<p class="empty-state">No comments yet.</p>';
  }
  function renderProfileReviews(reviews,loadFailed=false){
    if(loadFailed){
      reviewsPanel.innerHTML='<p class="empty-state">Reviews could not be loaded. Check your connection and try again.</p>';
      return;
    }
    reviewsPanel.innerHTML=reviews.length?reviews.map(review=>`<article class="review-item"><span class="review-avatar">${escapeHtml(review.reviewerInitials||'CL')}</span><div class="review-copy"><h3>${escapeHtml(review.reviewerName)}</h3><small>${escapeHtml(review.projectTitle||'Completed project')}</small><p>${escapeHtml(review.text)}</p></div><span class="review-rating" aria-label="${review.rating} out of 5 stars">${'★'.repeat(review.rating)}</span></article>`).join(''):'<p class="empty-state">No reviews yet.</p>';
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
  status.hidden=false;status.textContent='Loading developer profile…';
  try{
    const user=await window.devMatchBackend.ready;
    let person=null;
    if(user){
      const account = await window.devMatchBackend.loadProfile(user);
      accountRole=account.account_role;
      let personQuery=await window.devMatchBackend.client.from('directory_people')
        .select('id,display_name,username,account_role,profile_data,published_portfolio_count')
        .eq('id',requestedId).eq('account_role','dev').maybeSingle();
      if(personQuery.error)throw personQuery.error;
      person=personQuery.data;
      if(!person){
        const {data:project,error:projectError}=await window.devMatchBackend.client.from('projects')
          .select('owner_id').eq('id',requestedId).eq('project_kind','portfolio').eq('status','published').maybeSingle();
        if(projectError)throw projectError;
        if(project){
          personQuery=await window.devMatchBackend.client.from('directory_people')
            .select('id,display_name,username,account_role,profile_data,published_portfolio_count')
            .eq('id',project.owner_id).eq('account_role','dev').maybeSingle();
          if(personQuery.error)throw personQuery.error;
          person=personQuery.data;
        }
      }
    }else{
      let ownerId=requestedId;
      let {data:publicProjects,error:projectError}=await window.devMatchBackend.client.from('projects')
        .select('id,owner_id,title,project_type,category,price,data,status,created_at,updated_at')
        .eq('owner_id',ownerId).eq('project_kind','portfolio').eq('status','published').order('updated_at',{ascending:false});
      if(projectError)throw projectError;
      if(!publicProjects.length){
        const {data:project,error}=await window.devMatchBackend.client.from('projects')
          .select('owner_id').eq('id',requestedId).eq('project_kind','portfolio').eq('status','published').maybeSingle();
        if(error)throw error;
        if(project){
          ownerId=project.owner_id;
          const result=await window.devMatchBackend.client.from('projects')
            .select('id,owner_id,title,project_type,category,price,data,status,created_at,updated_at')
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
    let reviewsLoadFailed=false;
    try{
      profileReviews=await window.devMatchBackend.loadProfileReviews(person.id);
    }catch(error){
      console.error('Unable to load public developer reviews from Supabase.',error);
      reviewsLoadFailed=true;
    }
    let rows=publicProfileProjects;
    if(!rows){
      const result=await window.devMatchBackend.client.from('projects')
        .select('id,title,project_type,category,price,data,status,created_at,updated_at')
        .eq('owner_id',person.id).eq('project_kind','portfolio').eq('status','published').order('updated_at',{ascending:false});
      if(result.error)throw result.error;
      rows=result.data||[];
    }
    publicProfileProjects=null;
    projects=(rows||[]).map(projectRecord);
    const profile=person.profile_data||{};
    const name=String(person.display_name||'DEV-MATCH member');
    const location=String(profile.city||'Location not provided');
    const specialtyValues=Array.isArray(profile.specialty)?profile.specialty:typeof profile.specialty==='string'?[profile.specialty]:[];
    const selectedSpecialties=specialtyValues.map(value=>String(value).trim()).filter(Boolean);
    const customSpecialty=typeof profile.specialtyOther==='string'?profile.specialtyOther.trim():'';
    if(customSpecialty&&!selectedSpecialties.some(value=>value.toLowerCase()==='other'))selectedSpecialties.push('Other');
    const specialties=[...new Set(selectedSpecialties.map(value=>value.toLowerCase()==='other'&&customSpecialty?customSpecialty:value))];
    const skills=Array.isArray(profile.skills)?profile.skills.map(String):[];
    document.title=`${name} — DEV-MATCH`;
    document.getElementById('breadcrumbName').textContent=name;
    document.getElementById('developerName').textContent=name;
    document.getElementById('developerInitials').textContent=initials(name);
    document.getElementById('developerHandle').textContent=person.username?`@${String(person.username).replace(/^@/,'')}`:'';
    document.getElementById('developerLocation').textContent=location;
    document.getElementById('developerRole').textContent=specialties.join(' & ')||'Developer';
    document.querySelector('.availability-badge span').textContent=String(profile.availability||'Availability not provided');
    document.getElementById('developerJoined').textContent='';
    document.getElementById('developerAbout').textContent=String(profile.bio||'No biography provided.');
    document.getElementById('developerAboutCard').textContent=String(profile.bio||'No biography provided.');
    document.getElementById('developerExperience').textContent='Not provided';
    document.getElementById('developerLocationCard').textContent=location;
    document.getElementById('statProjects').textContent=String(projects.length);
    document.getElementById('statProjectFavorites').textContent='—';
    document.getElementById('statViews').textContent='—';
    const averageRating=profileReviews.length
      ?profileReviews.reduce((sum,review)=>sum+review.rating,0)/profileReviews.length
      :null;
    document.getElementById('statRating').textContent=averageRating===null?'—':`★ ${averageRating.toFixed(1)}`;
    document.getElementById('statReviewCount').textContent=reviewsLoadFailed
      ?'unable to load reviews'
      :profileReviews.length?`from ${profileReviews.length} reviews`:'no reviews yet';
    renderProfileReviews(profileReviews,reviewsLoadFailed);
    document.getElementById('portfolioCount').textContent=String(projects.length);
    document.getElementById('contactDeveloper').href=user&&accountRole==='client'?`devmatch-chat.html?contact=${encodeURIComponent(person.id)}&role=client`:'devmatch-auth.html?mode=login';
    document.getElementById('sidebarContactDeveloper').href=document.getElementById('contactDeveloper').href;
    document.getElementById('developerSpecialties').innerHTML=selectedSpecialties.length?selectedSpecialties.map(value=>{
      if(value.toLowerCase()==='other'){
        return `<div class="profile-specialty-card"><svg viewBox="0 0 24 24" aria-hidden="true">${specialtyDetails.Other.icon}</svg><b>Other</b><small>${escapeHtml(customSpecialty)}</small></div>`;
      }
      const details=specialtyDetails[value]||Object.entries(specialtyDetails)
        .find(([name])=>name.toLowerCase()===value.toLowerCase())?.[1]||specialtyDetails.Other;
      return `<div class="profile-specialty-card"><svg viewBox="0 0 24 24" aria-hidden="true">${details.icon}</svg><b>${escapeHtml(value)}</b><small>${escapeHtml(details.description)}</small></div>`;
    }).join(''):'<span>No specialization added yet.</span>';
    document.getElementById('developerSkills').innerHTML=skills.length?skills.map(value=>`<span>${escapeHtml(value)}</span>`).join(''):'<span>No skills added yet.</span>';
    document.getElementById('developerExperienceList').innerHTML='<li class="empty-state">No public experience added.</li>';
    document.getElementById('developerLinks').innerHTML='<p class="empty-state">No public links added.</p>';
    document.getElementById('clientName').textContent='Client';
    document.getElementById('clientInitials').textContent='CL';
    if(user&&accountRole==='client'){
      const records=await window.devMatchBackend.loadFavorites();
      favoriteDeveloper=records.some(item=>item.type==='developer'&&item.id===person.id);
    }
    renderFavoriteButton();
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
      filtersRoot.hidden=!showProjects;grid.hidden=!showProjects;sortSelect.parentElement.hidden=!showProjects;
      reviewsPanel.hidden=!showReviews;commentsPanel.hidden=showProjects||showReviews;
      empty.hidden=!showProjects||projects.length>0;
      if(button.dataset.tab==='comments'){
        commentsPanel.innerHTML='<p class="empty-state">Loading comments…</p>';
        try{
          const groups=await Promise.all(projects.map(async item=>(await window.devMatchBackend.loadProjectComments(item.id)).comments.map(comment=>({...comment,project:item.title}))));
          renderComments(groups.flat());
        }catch(error){console.error('Unable to load public portfolio comments from Supabase.',error);commentsPanel.textContent='Comments could not be loaded. Check your connection and try again.';}
      }
    });
    document.getElementById('favoriteDeveloper').addEventListener('click',async()=>{
      const userNow=await window.devMatchBackend.ready;if(!userNow){location.href='devmatch-auth.html?mode=login';return;}
      try{
        await window.devMatchBackend.setFavorite('developer',person.id,!favoriteDeveloper);
        favoriteDeveloper=!favoriteDeveloper;renderFavoriteButton();
      }catch(error){console.error('Unable to update developer favorite in Supabase.',error);window.alert('Unable to save this favorite. Please try again.');}
    });
    document.getElementById('copyProfileLink').addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(location.href);document.getElementById('copyProfileLink').textContent='✓';}
      catch{document.getElementById('copyProfileLink').setAttribute('aria-label','Copying is not available in this browser');}
    });
    renderProjects();
    status.hidden=true;identity.hidden=false;columns.hidden=false;
    requestAnimationFrame(()=>updateTabIndicator());
    window.addEventListener('resize',()=>updateTabIndicator());
    document.querySelector('.portfolio-tabs').addEventListener('scroll',()=>updateTabIndicator(),{passive:true});
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>updateTabIndicator());
  }catch(error){
    console.error('Unable to load the developer profile from Supabase.',error);
    showError('The developer profile could not be loaded. Check your connection and try again.');
  }
})();
