(() => {
  const input=document.getElementById('confirmationEmail');
  const button=document.getElementById('resendConfirmation');
  const status=document.getElementById('confirmationStatus');
  let busy=false,nextSend=0;
  input.value=sessionStorage.getItem('devmatch-verification-email')||'';
  function tick(){const seconds=Math.max(0,Math.ceil((nextSend-Date.now())/1000));button.disabled=busy||seconds>0;button.textContent=busy?'Sending…':seconds?`Try again in ${seconds}s`:'Resend verification link';}
  document.getElementById('emailConfirmation').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||Date.now()<nextSend)return;
    busy=true;tick();
    try{
      const {error}=await window.devMatchBackend.client.auth.resend({type:'signup',email:input.value.trim()});
      if(error)throw error;
      status.textContent='If this account is waiting for verification, a link will be sent. Check your inbox and spam folder.';
    }catch(error){status.textContent=error.status===429?'Email delivery limit reached. No new email was sent. Try again later.':'Unable to request a verification email. Please try again later.';}
    finally{busy=false;nextSend=Date.now()+60000;tick();}
  });
  setInterval(tick,1000);
})();
