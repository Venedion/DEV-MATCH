(async()=>{
  try{
    const backend=window.devMatchBackend;
    const user=await backend.ready;
    // backend.ready has already scheduled the recovery redirect. Do not override it.
    if(sessionStorage.getItem('devmatch-recovery')==='1')return;
    if(sessionStorage.getItem('devmatch-recovery-error')){
      location.replace('devmatch-reset-password.html');return;
    }
    if(!user){location.replace('devmatch-landing.html');return;}
    const row=await backend.loadProfile(user);
    backend.cache(row,user);
    location.replace(backend.destination(row));
  }catch{location.replace('devmatch-auth.html?mode=login&error=connection');}
})();
