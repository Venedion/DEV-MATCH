(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  if(params.get('modal')==='1'||window.self!==window.top)return;
  const main=document.querySelector('main.discover-detail-main,main.find-detail-main');
  if(!main)return;
  const isRequest=main.classList.contains('find-detail-main');
  const dialog=document.createElement('dialog');
  dialog.className='project-detail-route-dialog';
  dialog.id='projectDetailRouteDialog';
  dialog.setAttribute('aria-label',isRequest?'Project request details':'Project details');
  const bar=document.createElement('div');
  bar.className='project-detail-popup-bar';
  bar.innerHTML=`<img src="assets/images/devmatch-logo.png" alt=""><strong>DEV-MATCH</strong><span>${isRequest?'Project request':'Project details'}</span><button class="project-detail-popup-close" type="button" aria-label="Close details">×</button>`;
  const close=()=>dialog.close();
  bar.querySelector('button').addEventListener('click',close);
  dialog.addEventListener('click',event=>{if(event.target===dialog)close()});
  dialog.addEventListener('close',()=>{
    let referrer='';
    try{
      const url=new URL(document.referrer);
      if(url.origin===location.origin)referrer=url.href;
    }catch{}
    if(referrer)location.href=referrer;
    else location.href=isRequest?'devmatch-find-projects.html':'devmatch-discover-projects.html';
  },{once:true});
  main.before(dialog);
  dialog.append(bar,main);
  dialog.showModal();
})();
