(async function(){
  'use strict';
  const projectId=new URLSearchParams(location.search).get('project');
  const layout=document.getElementById('projectDetailLayout');
  const notFound=document.getElementById('projectNotFound');
  const status=document.getElementById('projectStatus');
  const favoritesKey='devmatch-client-project-favorites';
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const initials=name=>(String(name||'').match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'DM';
  let project=null,comments=[],favorites=[],viewRecordFailed=false;
  function readJson(key,fallback){try{const value=localStorage.getItem(key);return value?JSON.parse(value):fallback;}catch{return fallback;}}
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
    document.getElementById('commentList').innerHTML=ordered.map(comment=>`<article class="discover-comment"><span class="discover-detail-avatar">${escapeHtml(comment.initials||'CL')}</span><div><strong>${escapeHtml(comment.name||'DEV-MATCH member')}</strong><time>${escapeHtml(comment.time||'')}</time><p>${escapeHtml(comment.text||'')}</p></div></article>`).join('');
  }
  function initializeDetailLayout(){
    const preview=document.getElementById('projectPreview');
    const art=['food-art','dashboard-art','analytics-art','store-art','inventory-art'].includes(project.art)?project.art:'dashboard-art';
    preview.classList.add(art);
    document.getElementById('previewCategory').textContent=project.category;
    document.getElementById('previewHeading').textContent=project.title;
    document.getElementById('previewDescription').textContent=project.description;
    document.getElementById('thumbnailTitle').textContent=project.title;
    document.querySelectorAll('[data-project-tab]').forEach(button=>button.addEventListener('click',()=>{
      const selected=button.dataset.projectTab;
      const targets={overview:'detailOverviewSection',details:'detailFactsSection',comments:'commentsSection'};
      document.querySelectorAll('[data-project-tab]').forEach(tab=>{
        const active=tab===button;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));
      });
      document.getElementById(targets[selected]).scrollIntoView({behavior:'smooth',block:'start'});
    }));
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
    try{
      await window.devMatchBackend.setFavorite('project',project.id,!saved);
      favorites=saved?favorites.filter(id=>id!==project.id):[...favorites,project.id];
      localStorage.setItem(favoritesKey,JSON.stringify(favorites));
      updateFavoriteButtons(!saved);document.getElementById('favoriteCount').textContent=String(favorites.length);
    }catch(error){console.error('Unable to update saved projects in Supabase.',error);window.alert('Unable to save this project. Please try again.');}
  }
  if(!projectId){status.hidden=true;notFound.hidden=false;layout.hidden=true;return;}
  status.hidden=false;status.textContent='Loading project details…';
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
    let accountRole=null;
    if(user){
      try{await window.devMatchBackend.recordProjectView(project.id);}
      catch(error){console.error('Unable to record the public project view in Supabase.',error);viewRecordFailed=true;}
      const {data:account,error:accountError}=await window.devMatchBackend.client.from('profiles').select('account_role').eq('id',user.id).single();
      if(accountError)throw accountError;
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
    try{comments=await window.devMatchBackend.loadProjectComments(project.id);}
    catch(error){console.error('Unable to load public project comments from Supabase.',error);commentsFailed=true;}
    initializeDetailLayout();renderComments();layout.hidden=false;
    document.getElementById('detailFavoriteAction').addEventListener('click',setFavorite);
    document.getElementById('commentSort').addEventListener('change',renderComments);
    document.getElementById('commentForm').addEventListener('submit',async event=>{
      event.preventDefault();const input=document.getElementById('commentInput');const text=input.value.trim();
      if(!text){input.setCustomValidity('Please enter a comment before posting.');input.reportValidity();return;}
      input.setCustomValidity('');
      try{comments.push(await window.devMatchBackend.addProjectComment(project.id,text));input.value='';renderComments();}
      catch(error){console.error('Unable to save the project comment to Supabase.',error);window.alert('Unable to post your comment. Please log in and try again.');}
    });
    document.getElementById('commentInput').addEventListener('input',event=>event.target.setCustomValidity(''));
    if(commentsFailed)status.textContent='Project details loaded, but comments could not be loaded.';
    else if(viewRecordFailed)status.textContent='Project details loaded, but the view could not be recorded.';
    status.hidden=!commentsFailed&&!viewRecordFailed;
  }catch(error){
    console.error('Unable to load the public project from Supabase.',error);
    status.textContent='Project details could not be loaded. Check your connection and try again.';
  }
})();
