let recoveryUser=null;
window.devMatchBackend.ready.then(user=>{
  const error=sessionStorage.getItem('devmatch-recovery-error');
  sessionStorage.removeItem('devmatch-recovery-error');
  if(error||!user||sessionStorage.getItem('devmatch-recovery')!=='1'){
    sessionStorage.removeItem('devmatch-recovery');
    document.getElementById('requestResetLink').hidden=false;
    document.getElementById('resetStatus').textContent=error||'Open the reset link from your email first. If it has expired, request a new link.';return;
  }
  recoveryUser=user;
  document.getElementById('resetForm').hidden=false;
  document.getElementById('resetStatus').textContent='Choose a new password for your account.';
});
document.getElementById('resetForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const status=document.getElementById('resetStatus');
  const button=document.getElementById('resetSubmit');
  const password=document.getElementById('newPassword').value;
  if(password!==document.getElementById('confirmPassword').value){status.textContent='Passwords do not match.';return;}
  if(password.length<8||!/[A-Z]/.test(password)||! /[^A-Za-z0-9]/.test(password)){
    status.textContent='Use at least 8 characters, one uppercase letter, and one special character.';return;
  }
  button.disabled=true;
  button.textContent='Saving…';
  try{
    const backend=window.devMatchBackend;
    const {data:{user},error:userError}=await backend.client.auth.getUser();
    if(userError||!user||!recoveryUser||user.id!==recoveryUser.id||sessionStorage.getItem('devmatch-recovery')!=='1')throw new Error('Open the password reset link from your email first.');
    const {error}=await backend.client.auth.updateUser({password});
    if(error)throw error;
    sessionStorage.removeItem('devmatch-recovery');
    await backend.client.auth.signOut();backend.clearCache();
    location.assign('devmatch-auth.html?mode=login&reset=success');
  }catch(error){status.textContent=error.message||'Unable to reset password. Please try again.';}
  finally{button.disabled=false;button.textContent='Save new password';}
});
