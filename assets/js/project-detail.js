(function(){
  'use strict';
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const dialog=document.getElementById('projectDetailDialog');
  const content=document.getElementById('projectContent');
  const commentsRoot=document.getElementById('commentList');
  let activeProject=null,comments=[],commentOrder='Newest',commenterRoles=new Map();
  let replyTo=null;
  const initials=name=>(String(name||'').match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'DM';
  function chatUrl(id){return `devmatch-chat.html?role=client&project=${encodeURIComponent(id)}`;}
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
    document.getElementById('commentCount').textContent=String(comments.length);
    const ordered=commentOrder==='Newest'?comments:[...comments].reverse();
    commentsRoot.innerHTML=ordered.map(comment=>{
      const name=escapeHtml(comment.name||'DEV-MATCH member');
      const avatar=profileAnchor(comment,`<span class="comment-avatar">${escapeHtml(comment.initials||'CL')}</span>`,'comment-profile-avatar-link');
      const author=profileAnchor(comment,name,'comment-profile-name-link');
      return `<article class="comment-item">${avatar}<div><p class="comment-author">${author} ${comment.parentCommentId ? '<small>Reply</small>' : '<small>Client</small>'}</p><p class="comment-text">${escapeHtml(comment.text)}</p><button type="button" class="reply-link" data-reply="${escapeHtml(comment.id)}">Reply</button></div></article>`;
    }).join('');
  }
  commentsRoot.addEventListener('click',event=>{const b=event.target.closest('[data-reply]');if(!b)return;replyTo=b.dataset.reply;const input=document.getElementById('commentInput');input.placeholder='Reply to '+(comments.find(c=>c.id===replyTo)?.name||'comment')+' (clear to cancel)';input.focus();});
  function showError(message){
    const error=document.getElementById('detailError');error.textContent=message;error.hidden=false;content.hidden=true;
    if(!dialog.open)dialog.showModal();
  }
  window.openProjectDetails=async function(projectId){
    replyTo=null;
    const errorElement=document.getElementById('detailError');
    errorElement.hidden=true;content.hidden=true;
    document.getElementById('projectTitle').textContent='Loading project…';
    if(!dialog.open)dialog.showModal();
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
        link:String(data.link||data.url||''),created:row.created_at||row.updated_at,ownerId:row.owner_id};
      let developerName='DEV-MATCH member',developerLocation='Location not provided',specialty='Developer',developerBio='No biography provided.';
      const user=await window.devMatchBackend.ready;
      if(user){
        const account = await window.devMatchBackend.loadProfile(user);
        if(account.account_role==='client'){
          const {data:person,error:personError}=await window.devMatchBackend.client.from('directory_people')
            .select('display_name,username,profile_data').eq('id',row.owner_id).eq('account_role','dev').maybeSingle();
          if(personError)throw personError;
          if(person){
            const profile=person.profile_data||{};
            developerName=String(person.display_name||developerName);
            developerLocation=String(profile.city||developerLocation);
            specialty=String(profile.specialtyOther||profile.specialty||specialty);
            developerBio=String(profile.bio||developerBio);
          }
        }
      }
      const created=new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(activeProject.created));
      document.title=`${activeProject.title} — DEV-MATCH`;
      document.getElementById('projectCategory').textContent=activeProject.category;
      document.getElementById('projectTitle').textContent=activeProject.title;
      document.getElementById('projectSummary').textContent=activeProject.description;
      document.getElementById('projectPrice').textContent=activeProject.price||'Price not specified';
      document.getElementById('projectOverview').textContent=activeProject.overview;
      document.getElementById('projectStack').textContent=activeProject.stack?`Built with ${activeProject.stack}.`:'Technology stack not provided.';
      document.getElementById('projectType').textContent=activeProject.type;
      document.getElementById('projectFactCategory').textContent=activeProject.category;
      document.getElementById('projectCreated').textContent=created;
      document.getElementById('projectLink').textContent=activeProject.link;
      const cover=document.getElementById('projectCover');
      cover.className=`project-cover ${['food-art','dashboard-art','analytics-art','store-art','inventory-art'].includes(data.art)?data.art:'dashboard-art'}`;
      document.getElementById('developerInitials').textContent=initials(developerName);
      document.getElementById('developerName').textContent=developerName;
      document.getElementById('developerHandle').textContent='';
      document.getElementById('developerLocation').textContent=developerLocation;
      document.getElementById('developerSpecialty').textContent=specialty;
      document.getElementById('developerBio').textContent=developerBio;
      document.getElementById('developerProjects').textContent='—';
      document.getElementById('developerViews').textContent='—';
      document.getElementById('developerFavorites').textContent='—';
      document.getElementById('viewDeveloperProfile').href=`devmatch-developer-profile.html?developer=${encodeURIComponent(row.owner_id)}`;
      document.getElementById('chatDeveloperLink').href=user?chatUrl(row.id):'devmatch-auth.html?mode=login';
      const clientName='Client';
      document.getElementById('clientInitials').textContent=initials(clientName);
      try{comments=(await window.devMatchBackend.loadProjectComments(row.id)).comments;}
      catch(commentError){console.error('Unable to load public project comments from Supabase.',commentError);comments=[];errorElement.textContent='Project loaded, but comments could not be loaded.';errorElement.hidden=false;}
      await loadCommenterRoles();
      commentOrder=document.querySelector('.sort-comments select').value;
      renderComments();content.hidden=false;
    }catch(error){
      console.error('Unable to load public project details from Supabase.',error);
      showError('Project details could not be loaded. Check your connection and try again.');
    }
  };
  document.getElementById('closeProjectDetail').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  document.querySelector('.sort-comments select').addEventListener('change',event=>{commentOrder=event.target.value;renderComments();});
  document.getElementById('commentForm').addEventListener('submit',async event=>{
    event.preventDefault();const input=document.getElementById('commentInput');const text=input.value.trim();
    if(!text){input.setCustomValidity('Please enter a comment before posting.');input.reportValidity();return;}
    input.setCustomValidity('');
    try{
      comments.push(await (replyTo
        ? window.devMatchBackend.addProjectCommentReply(activeProject.id,replyTo,text)
        : window.devMatchBackend.addProjectComment(activeProject.id,text)));
      await loadCommenterRoles();
      replyTo=null;
      input.value='';
      input.placeholder='Write a comment…';
      renderComments();
    }
    catch(error){console.error('Unable to save the project comment to Supabase.',error);window.alert('Unable to post your comment. Please log in and try again.');}
  });
  document.getElementById('commentInput').addEventListener('input',event=>event.target.setCustomValidity(''));
})();
