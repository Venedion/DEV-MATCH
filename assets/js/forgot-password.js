(() => {
  const form=document.getElementById('forgotForm');
  const input=document.getElementById('forgotEmail');
  const button=document.getElementById('forgotSubmit');
  const status=document.getElementById('forgotStatus');
  let busy=false,nextSend=0,limited=false;
  function tick(){
    const seconds=Math.max(0,Math.ceil((nextSend-Date.now())/1000));
    button.disabled=busy||seconds>0;
    button.textContent=busy?'Sending…':seconds?`Try again in ${seconds}s`:limited?'Try again':'Send reset link';
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||Date.now()<nextSend)return;
    const email=input.value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      status.textContent='Enter a valid email address.';input.focus();return;
    }
    busy=true;status.textContent='Sending your request…';tick();
    try{
      const {error}=await window.devMatchBackend.client.auth.resetPasswordForEmail(email,{
        redirectTo:location.origin+'/devmatch-reset-password.html'
      });
      if(error)throw error;
      limited=false;
      nextSend=Date.now()+60000;
      status.textContent='If an account exists for this email, a reset link will be sent. Check your inbox and spam folder. Open the newest link to continue.';
    }catch(error){
      nextSend=Date.now()+60000;
      const emailLimit=error.code==='over_email_send_rate_limit'||/email.*rate limit/i.test(error.message||'');
      limited=error.status===429||emailLimit;
      status.textContent=emailLimit
        ? 'Email delivery limit reached. No new reset email was sent. Please try again later; this limit may last longer than the resend countdown.'
        : error.status===429?'Too many reset requests. No new reset email was sent. Please try again later.':'Unable to request a reset link. Please try again later.';
    }finally{busy=false;tick();}
  });
  setInterval(tick,1000);
})();
