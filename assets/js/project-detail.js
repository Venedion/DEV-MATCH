(function(){
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const detailDialog=document.getElementById('projectDetailDialog');
const commentList=document.getElementById('commentList');
let activeProject=null;
let comments=[];
let commentOrder='Newest';

function chatUrl(projectId){
  return `devmatch-chat.html?role=client&project=${encodeURIComponent(projectId)}`;
}

function renderComments(){
  document.getElementById('commentCount').textContent=String(comments.length);
  const ordered=commentOrder==='Newest'?comments:[...comments].reverse();
  commentList.innerHTML=ordered.map(comment=>`<article class="comment-item"><span class="comment-avatar">${escapeHtml(comment.initials)}</span><div><p class="comment-author">${escapeHtml(comment.name)} <small>Client · just now</small></p><p class="comment-text">${escapeHtml(comment.text)}</p><a class="reply-link" href="${chatUrl(activeProject.id)}">Reply</a></div></article>`).join('');
}

window.openProjectDetails=function(projectId){
  const project=window.DEVMATCH_SAMPLE_PROJECTS.find(item=>item.id===projectId);
  const detailError=document.getElementById('detailError');
  if(!project){
    detailError.textContent='Project details could not be found. Please try another project.';
    detailError.hidden=false;
    projectDetailContent.hidden=true;
    detailDialog.showModal();
    return;
  }

  activeProject=project;
  detailError.hidden=true;
  projectDetailContent.hidden=false;
  document.getElementById('projectCategory').textContent=project.category;
  document.getElementById('projectTitle').textContent=project.title;
  document.getElementById('projectSummary').textContent=project.description;
  document.getElementById('projectPrice').textContent=`${project.price} · Starting price`;
  document.getElementById('projectOverview').textContent=project.overview;
  document.getElementById('projectStack').textContent=`Built with ${project.stack}, with a responsive experience across modern devices.`;
  document.getElementById('projectType').textContent=project.type;
  document.getElementById('projectFactCategory').textContent=project.category;
  document.getElementById('projectCreated').textContent=project.created;
  document.getElementById('projectLink').textContent=project.link;
  document.getElementById('projectCover').className=`project-cover ${project.art}`;
  document.getElementById('developerInitials').textContent=project.initials;
  document.getElementById('developerName').textContent=project.developer;
  document.getElementById('developerHandle').textContent=project.handle;
  document.getElementById('developerLocation').textContent=project.location;
  document.getElementById('developerSpecialty').textContent=project.specialty;
  document.getElementById('developerBio').textContent=project.developerBio;
  document.getElementById('developerProjects').textContent=project.developerProjects;
  document.getElementById('developerViews').textContent=project.developerViews;
  document.getElementById('developerFavorites').textContent=project.developerFavorites;
  document.getElementById('viewDeveloperProfile').href=`devmatch-developer-profile.html?developer=${encodeURIComponent(project.id)}`;
  document.getElementById('chatDeveloperLink').href=chatUrl(project.id);

  const clientName=JSON.parse(localStorage.getItem('devmatch-profile-client')||'{}').displayName||'Client';
  document.getElementById('clientInitials').textContent=clientName.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CL';
  const storedComments=JSON.parse(localStorage.getItem(`devmatch-project-comments-${project.id}`)||'[]');
  comments=storedComments;
  commentOrder=document.querySelector('.sort-comments select').value;
  renderComments();

  detailDialog.showModal();
};
const projectDetailContent=document.getElementById('projectContent');

document.getElementById('closeProjectDetail').addEventListener('click',()=>detailDialog.close());
detailDialog.addEventListener('click',event=>{if(event.target===detailDialog)detailDialog.close()});

document.querySelector('.sort-comments select').addEventListener('change',event=>{
  commentOrder=event.target.value;
  renderComments();
});
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
  const name=JSON.parse(localStorage.getItem('devmatch-profile-client')||'{}').displayName||'Client';
  const initials=name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CL';
  comments.unshift({name,initials,text});
  localStorage.setItem(`devmatch-project-comments-${activeProject.id}`,JSON.stringify(comments));
  input.value='';
  renderComments();
});
document.getElementById('commentInput').addEventListener('input',event=>event.target.setCustomValidity(''));
})();
