(function(){
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const detailDialog=document.getElementById('projectDetailDialog');
const chatDialog=document.getElementById('chatDialog');
const commentList=document.getElementById('commentList');
const chatMessages=document.getElementById('chatMessages');
let activeProject=null;
let comments=[];
let messages=[];
let commentOrder='Newest';

function renderComments(){
  document.getElementById('commentCount').textContent=String(comments.length);
  const ordered=commentOrder==='Newest'?comments:[...comments].reverse();
  commentList.innerHTML=ordered.map(comment=>`<article class="comment-item"><span class="comment-avatar">${escapeHtml(comment.initials)}</span><div><p class="comment-author">${escapeHtml(comment.name)} <small>Client · just now</small></p><p class="comment-text">${escapeHtml(comment.text)}</p><button class="reply-link" type="button" data-open-chat>Reply</button></div></article>`).join('');
}

function renderMessages(){
  const client=JSON.parse(localStorage.getItem('devmatch-profile-client')||'{}').displayName||'You';
  chatMessages.innerHTML=messages.map(message=>`<div class="chat-message${message.from==='You'?' sent':''}"><p>${escapeHtml(message.text)}</p><small>${escapeHtml(message.from==='You'?client:message.time||activeProject.developer)}</small></div>`).join('');
  chatMessages.scrollTop=chatMessages.scrollHeight;
}

function openChat(){
  if(!activeProject)return;
  renderMessages();
  chatDialog.showModal();
  document.getElementById('chatInput').focus();
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
  document.getElementById('chatInitials').textContent=project.initials;
  document.getElementById('chatTitle').textContent=project.developer;

  const clientName=JSON.parse(localStorage.getItem('devmatch-profile-client')||'{}').displayName||'Client';
  document.getElementById('clientInitials').textContent=clientName.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CL';
  const storedComments=JSON.parse(localStorage.getItem(`devmatch-project-comments-${project.id}`)||'[]');
  comments=storedComments;
  commentOrder=document.querySelector('.sort-comments select').value;
  renderComments();

  const storedMessages=JSON.parse(sessionStorage.getItem(`devmatch-project-chat-${project.id}`)||'[]');
  messages=storedMessages.length?storedMessages:[{from:project.developer,text:`Hi! Thanks for your interest in ${project.title}. What would you like to know?`,time:project.developer}];
  detailDialog.showModal();
};
const projectDetailContent=document.getElementById('projectContent');

document.getElementById('closeProjectDetail').addEventListener('click',()=>detailDialog.close());
detailDialog.addEventListener('click',event=>{if(event.target===detailDialog)detailDialog.close()});
document.querySelectorAll('[data-open-chat]').forEach(button=>button.addEventListener('click',openChat));
commentList.addEventListener('click',event=>{
  if(event.target.closest('[data-open-chat]'))openChat();
});
document.getElementById('closeChat').addEventListener('click',()=>chatDialog.close());
chatDialog.addEventListener('click',event=>{if(event.target===chatDialog)chatDialog.close()});

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
document.getElementById('chatForm').addEventListener('submit',event=>{
  event.preventDefault();
  const input=document.getElementById('chatInput');
  const text=input.value.trim();
  if(!text){
    input.setCustomValidity('Please enter a message before sending.');
    input.reportValidity();
    return;
  }
  input.setCustomValidity('');
  messages.push({from:'You',text,time:new Date().toISOString()});
  sessionStorage.setItem(`devmatch-project-chat-${activeProject.id}`,JSON.stringify(messages));
  input.value='';
  renderMessages();
  input.focus();
});
document.getElementById('chatInput').addEventListener('input',event=>event.target.setCustomValidity(''));
const chatProjectId=new URLSearchParams(location.search).get('chatProject');
if(chatProjectId&&window.DEVMATCH_SAMPLE_PROJECTS.some(project=>project.id===chatProjectId)){
  window.openProjectDetails(chatProjectId);
  openChat();
  history.replaceState(null,'',location.pathname);
}
})();
