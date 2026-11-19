(function(){
  'use strict';
  const backend=window.devMatchBackend;
  if(!backend)return;
  let timer=null,pending=false,stopped=false;
  async function heartbeat(){
    if(pending||stopped||document.visibilityState!=='visible')return;
    pending=true;
    try{
      const user=await backend.ready;
      if(!user?.email_confirmed_at)return;
      const role=await backend.getWorkspaceRole();
      // Presence only: opening another page must never mark any chat as read.
      const {error}=await backend.client.rpc('sync_chat_activity',{p_role:role,p_conversation:null,p_read_at:null});
      if(error)console.warn('Unable to refresh online status.',error);
    }catch(error){console.warn('Unable to refresh online status.',error);}
    finally{pending=false;}
  }
  function start(){stopped=false;if(timer===null)timer=setInterval(()=>void heartbeat(),15000);void heartbeat();}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void heartbeat();});
  window.addEventListener('pagehide',()=>{stopped=true;clearInterval(timer);timer=null;});
  window.addEventListener('pageshow',start);
  start();
})();
