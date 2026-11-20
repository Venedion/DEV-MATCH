(function(){
  'use strict';
  if(window.self!==window.top)return;

  function ensureDialog(){
    let dialog=document.getElementById('requestDetailDialog');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.className='project-request-detail-dialog';
    dialog.id='requestDetailDialog';
    dialog.setAttribute('aria-label','Project request details');
    dialog.innerHTML=`<div class="project-detail-popup-bar"><img src="assets/images/devmatch-logo.png" alt=""><span>Project request details</span><button class="project-detail-popup-close" id="closeRequestDetail" type="button" aria-label="Close project request details">×</button></div><iframe class="project-detail-popup-frame" id="requestDetailFrame" title="Project request details"></iframe>`;
    document.body.append(dialog);
    const frame=dialog.querySelector('#requestDetailFrame');
    dialog.querySelector('#closeRequestDetail').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
    dialog.addEventListener('close',()=>{frame.src='about:blank'});
    return dialog;
  }

  window.openProjectRequestDetails=function(requestId,title='Project request'){
    if(typeof requestId!=='string'||!requestId.trim()){
      console.error('Project request details could not be opened because the request ID is missing.');
      return;
    }
    const dialog=ensureDialog();
    const frame=dialog.querySelector('#requestDetailFrame');
    frame.title=`Project request: ${title}`;
    frame.src=`devmatch-find-project-detail.html?request=${encodeURIComponent(requestId)}&modal=1`;
    if(!dialog.open)dialog.showModal();
  };

  document.addEventListener('click',event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    if(document.getElementById('projectDetailRouteDialog')?.open)return;
    const link=event.target.closest('a[href]');
    if(!link)return;
    let target;
    try{target=new URL(link.href,location.href)}catch{return}
    if(target.pathname.split('/').pop()!=='devmatch-find-project-detail.html')return;
    const requestId=target.searchParams.get('request');
    if(!requestId)return;
    event.preventDefault();
    window.openProjectRequestDetails(requestId,link.textContent.trim()||'Project request');
  });
})();
