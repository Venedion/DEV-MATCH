(() => {
  const form=document.getElementById('forgotForm');
  const input=document.getElementById('forgotEmail');
  const button=document.getElementById('forgotSubmit');
  const status=document.getElementById('forgotStatus');
  const codeForm=document.getElementById('recoveryCodeForm');
  const codeInput=document.getElementById('recoveryCode');
  const codeButton=document.getElementById('recoveryCodeSubmit');
  const auth=window.devMatchBackend.client.auth;
  let recoveryEmail='';
  let busy=false,nextSend=0,limited=false;
  function tick(){
    const seconds=Math.max(0,Math.ceil((nextSend-Date.now())/1000));
    button.disabled=busy||seconds>0;
    button.textContent=busy?'Sending…':seconds?`Try again in ${seconds}s`:limited?'Try again':'Send reset email';
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||Date.now()<nextSend)return;
    const email=input.value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      status.textContent='Enter a valid email address.';input.focus();return;
    }
    busy=true;status.textContent='Sending your request…';tick();
    try{
      const {error}=await auth.resetPasswordForEmail(email,{
        redirectTo:new URL('devmatch-reset-password.html',location.href).href
      });
      if(error)throw error;
      limited=false;
      nextSend=Date.now()+60000;
      recoveryEmail=email;
      if(codeInput)codeInput.value='';
      if(codeForm)codeForm.hidden=false;
      status.textContent='If an account exists, check your inbox and spam folder for the newest reset email. Enter its code here or open its reset link.';
    }catch(error){
      nextSend=Date.now()+60000;
      const emailLimit=error.code==='over_email_send_rate_limit'||/email.*rate limit/i.test(error.message||'');
      limited=error.status===429||emailLimit;
      status.textContent=emailLimit
        ? 'Email delivery limit reached. No new reset email was sent. Please try again later; this limit may last longer than the resend countdown.'
        : error.status===429?'Too many reset requests. No new reset email was sent. Please try again later.':'Unable to request a reset email. Please try again later.';
    }finally{busy=false;tick();}
  });
  codeForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy||codeButton.disabled||!recoveryEmail)return;
    if(input.value.trim()!==recoveryEmail){
      status.textContent='Request a reset email for the address currently entered.';
      return;
    }
    const token=codeInput.value.trim();
    if(!/^\d{6,10}$/.test(token))return;
    busy=true;
    codeButton.disabled=true;
    tick();
    try{
      const {data,error}=await auth.verifyOtp({email:recoveryEmail,token,type:'recovery'});
      if(error||!data?.session||!data?.user)throw new Error('Invalid recovery code');
      sessionStorage.removeItem('devmatch-recovery-error');
      sessionStorage.setItem('devmatch-recovery','1');
      location.assign('devmatch-reset-password.html');
    }catch{
      status.textContent='The code could not be verified. Check the newest reset email or request another.';
    }finally{busy=false;codeButton.disabled=false;tick();}
  });
  setInterval(tick,1000);
})();
