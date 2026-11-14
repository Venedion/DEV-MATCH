(() => {
  const input=document.getElementById('confirmationEmail');
  const button=document.getElementById('resendConfirmation');
  const status=document.getElementById('confirmationStatus');
  let busy=false,nextSend=0;
  input.value=sessionStorage.getItem('devmatch-verification-email')||'';
  function tick(){const seconds=Math.max(0,Math.ceil((nextSend-Date.now())/1000));button.disabled=busy||seconds>0;button.textContent=busy?'Sending…':seconds?`Try again in ${seconds}s`:'Resend verification email';}
  document.getElementById('emailConfirmation').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||Date.now()<nextSend)return;
    busy=true;tick();
    try{
      const {error}=await window.devMatchBackend.client.auth.resend({type:'signup',email:input.value.trim()});
      if(error)throw error;
      status.textContent='If this account is waiting for verification, an email will be sent. Check your inbox and spam folder.';
    }catch(error){status.textContent=error.status===429?'Email delivery limit reached. No new email was sent. Try again later.':'Unable to request a verification email. Please try again later.';}
    finally{busy=false;nextSend=Date.now()+60000;tick();}
  });
  document.getElementById('verifySignupCode').addEventListener('submit',async event=>{
    event.preventDefault();
    const verify=document.getElementById('verifySignup');
    const email=input.value.trim().toLowerCase();
    const token=document.getElementById('signupCode').value.trim();
    if(!email||!/^\d{6,10}$/.test(token)){status.textContent='Enter your account email and the code from your email.';return;}
    verify.disabled=true;
    try{
      const {data,error}=await window.devMatchBackend.client.auth.verifyOtp({email,token,type:'signup'});
      if(error||!data?.user?.email_confirmed_at){status.textContent='The code is invalid or expired. Use the newest code or resend the email.';return;}
      sessionStorage.removeItem('devmatch-verification-email');
      if(data.session){
        const backend=window.devMatchBackend;
        const row=await backend.loadProfile(data.user);
        backend.clearCache();backend.cache(row,data.user);
        location.assign(backend.destination(row,data.user));
      }else location.assign('devmatch-auth.html?mode=login');
    }catch{status.textContent='Unable to verify your email. Please try again.';}
    finally{verify.disabled=false;}
  });
  setInterval(tick,1000);
})();
