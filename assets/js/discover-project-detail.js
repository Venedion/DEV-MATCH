(function(){
  'use strict';

  const projectId=new URLSearchParams(location.search).get('project');
  const projects=Array.isArray(window.DEVMATCH_SAMPLE_PROJECTS)?window.DEVMATCH_SAMPLE_PROJECTS:[];
  const project=projects.find(item=>item.id===projectId);
  const layout=document.getElementById('projectDetailLayout');
  const notFound=document.getElementById('projectNotFound');
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const favoritesKey='devmatch-client-project-favorites';
  const commentsKey=`devmatch-project-comments-${projectId}`;
  let comments=[];

  function readJson(key,fallback){
    try{
      const value=localStorage.getItem(key);
      return value?JSON.parse(value):fallback;
    }catch(error){
      console.warn(`Unable to read ${key} from browser storage.`,error);
      return fallback;
    }
  }

  function readFavorites(){
    const saved=readJson(favoritesKey,readJson('devmatch-client-favorites',[]));
    return Array.isArray(saved)?saved.filter(id=>typeof id==='string'):[];
  }

  function setFavorite(isFavorite){
    const favorites=readFavorites();
    const updated=isFavorite
      ?favorites.filter(id=>id!==project.id)
      :[...favorites,project.id];
    try{
      localStorage.setItem(favoritesKey,JSON.stringify(updated));
    }catch(error){
      console.error('Unable to update saved projects.',error);
      return;
    }
    updateFavoriteButtons(!isFavorite);
    const count=document.getElementById('favoriteCount');
    count.textContent=String(updated.length);
  }

  function updateFavoriteButtons(isFavorite){
    const saveButton=document.getElementById('detailFavoriteAction');
    saveButton.setAttribute('aria-pressed',String(isFavorite));
    saveButton.querySelector('span').textContent=isFavorite?'Added to Favorites':'Add to Favorites';
  }

  function renderComments(){
    const order=document.getElementById('commentSort').value;
    const ordered=order==='newest'?[...comments].reverse():comments;
    document.getElementById('detailCommentCount').textContent=String(comments.length);
    document.getElementById('commentsHeadingCount').textContent=String(comments.length);
    document.getElementById('projectCommentsStat').textContent=`${comments.length} comments`;
    document.getElementById('commentsEmpty').hidden=comments.length>0;
    document.getElementById('commentList').innerHTML=ordered.map(comment=>`
      <article class="discover-comment">
        <span class="discover-detail-avatar">${escapeHtml(comment.initials||'CL')}</span>
        <div><strong>${escapeHtml(comment.name||'Client')}</strong><time>${escapeHtml(comment.time||'')}</time><p>${escapeHtml(comment.text||'')}</p></div>
      </article>`).join('');
  }

  function initializeDetailLayout(){
    const preview=document.getElementById('projectPreview');
    preview.classList.add(project.art||'food-art');
    document.getElementById('previewCategory').textContent=project.category;
    document.getElementById('previewHeading').textContent=project.title;
    document.getElementById('previewDescription').textContent=project.description;
    document.getElementById('thumbnailTitle').textContent=project.title;
    document.querySelectorAll('[data-project-tab]').forEach(button=>{
      button.addEventListener('click',()=>{
        const selected=button.dataset.projectTab;
        const targets={overview:'detailOverviewSection',details:'detailFactsSection',comments:'commentsSection'};
        document.querySelectorAll('[data-project-tab]').forEach(tab=>{
          const active=tab===button;
          tab.classList.toggle('is-active',active);
          tab.setAttribute('aria-selected',String(active));
        });
        document.getElementById(targets[selected]).scrollIntoView({behavior:'smooth',block:'start'});
      });
    });
    document.getElementById('detailTypeFull').textContent=project.type;
    document.getElementById('detailCategory').textContent=project.category;
    document.getElementById('detailCreatedFull').textContent=project.created;
    document.getElementById('detailMetaType').textContent=project.type;
    document.getElementById('detailMetaCategory').textContent=project.category;
    document.getElementById('detailMetaCreated').textContent=project.created;
  }

  if(!project){
    notFound.hidden=false;
    layout.hidden=true;
    return;
  }

  document.title=`${project.title} — Discover Projects | DEV-MATCH`;
  document.getElementById('detailBreadcrumbTitle').textContent=project.title;
  document.getElementById('detailBreadcrumbCategory').textContent=project.category;
  document.getElementById('detailTitle').textContent=project.title;
  document.getElementById('detailPrice').textContent=project.price;
  document.getElementById('detailOverview').textContent=project.overview;
  document.getElementById('detailStack').textContent=String(project.stack).split(/\s+(?:and|,)\s+/).filter(Boolean).join(', ');
  document.getElementById('detailDeveloperViews').textContent=project.developerViews;
  document.getElementById('detailDeveloperFavorites').textContent=project.developerFavorites;
  document.getElementById('detailDeveloperProjects').textContent=project.developerProjects;
  document.getElementById('asideDeveloperAvatar').textContent=project.initials;
  document.getElementById('asideDeveloperName').textContent=project.developer;
  document.getElementById('asideDeveloperHandle').textContent=project.handle;
  document.getElementById('detailDeveloperBio').textContent=project.developerBio;
  document.getElementById('asideDeveloperLocation').textContent=project.location;
  document.getElementById('asideDeveloperSpecialty').textContent=project.specialty;
  document.getElementById('contactDeveloper').href=`devmatch-chat.html?role=client&project=${encodeURIComponent(project.id)}`;
  document.getElementById('developerProfileLink').href=`devmatch-developer-profile.html?developer=${encodeURIComponent(project.id)}`;
  document.getElementById('clientCommentAvatar').textContent=(()=>{
    const name=readJson('devmatch-profile-client',{}).displayName||'Client';
    return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CL';
  })();
  const liveLink=document.getElementById('detailLiveLink');
  if(project.link){
    liveLink.href=`https://${project.link}`;
    liveLink.textContent=project.link;
    liveLink.hidden=false;
    const liveDemo=document.getElementById('detailLiveDemo');
    liveDemo.href=`https://${project.link}`;
    liveDemo.hidden=false;
  }

  comments=readJson(commentsKey,[]);
  if(!Array.isArray(comments))comments=[];
  initializeDetailLayout();
  updateFavoriteButtons(readFavorites().includes(project.id));
  document.getElementById('favoriteCount').textContent=String(readFavorites().length);
  renderComments();
  layout.hidden=false;

  document.getElementById('detailFavoriteAction').addEventListener('click',()=>{
    setFavorite(readFavorites().includes(project.id));
  });
  document.getElementById('commentSort').addEventListener('change',renderComments);
  document.getElementById('commentForm').addEventListener('submit',event=>{
    event.preventDefault();
    const input=document.getElementById('commentInput');
    const text=input.value.trim();
    if(!text){
      input.setCustomValidity('Please enter a comment before posting.');
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    const profile=readJson('devmatch-profile-client',{});
    const name=profile.displayName||'Client';
    const initials=name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CL';
    comments.push({name,initials,text,time:'just now'});
    try{
      localStorage.setItem(commentsKey,JSON.stringify(comments));
    }catch(error){
      comments.pop();
      console.error('Unable to save the project comment.',error);
      return;
    }
    input.value='';
    renderComments();
  });
  document.getElementById('commentInput').addEventListener('input',event=>event.target.setCustomValidity(''));
})();
