document.getElementById('resetForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const status=document.getElementById('resetStatus');
  const button=document.getElementById('resetSubmit');
  const password=document.getElementById('newPassword').value;
  if(password.length<8||!/[A-Z]/.test(password)||! /[^A-Za-z0-9]/.test(password)){
    status.textContent='Use at least 8 characters, one uppercase letter, and one special character.';return;
  }
  button.disabled=true;
  try{
    const backend=window.devMatchBackend;
    const user=await backend.ready;
    if(!user||sessionStorage.getItem('devmatch-recovery')!=='1')throw new Error('Open the password reset link from your email first.');
    const {error}=await backend.client.auth.updateUser({password});
    if(error)throw error;
    sessionStorage.removeItem('devmatch-recovery');
    await backend.client.auth.signOut();backend.clearCache();
    location.assign('devmatch-auth.html?mode=login');
  }catch(error){status.textContent=error.message||'Unable to reset password. Please try again.';}
  finally{button.disabled=false;}
});
