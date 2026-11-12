(() => {
  const $=id=>document.getElementById(id);
  const backend=window.devMatchBackend;
  const auth=backend.client.auth;
  let address='';let cooldownUntil=0;let busy=false;
  function status(text){$('otpStatus').textContent=text;}
  function tick(){
    const seconds=Math.max(0,Math.ceil((cooldownUntil-Date.now())/1000));
    $('otpResend').disabled=busy||seconds>0;
    $('otpResend').textContent=seconds?`Kirim ulang (${seconds} detik)`: 'Kirim ulang';
  }
  function lock(value){
    busy=value;
    $('otpEmail').disabled=value;
    $('otpSend').disabled=value;
    $('otpVerify').disabled=value;
    tick();
  }
  async function send(nextAddress){
    if(busy)return;
    lock(true);
    try{
      await backend.ready;
      const {error}=await auth.signInWithOtp({email:nextAddress,options:{shouldCreateUser:false}});
      if(error&&error.code!=='otp_disabled')throw error;
      address=nextAddress;
      cooldownUntil=Date.now()+60000;
      $('otpEmailForm').hidden=true;$('otpCodeForm').hidden=false;
      status('Periksa inbox dan folder spam. Akun yang belum aktif akan menerima tautan konfirmasi.');
      $('otpCode').value='';$('otpCode').focus();
    }catch(error){
      status(error.status===429?'Tunggu sebentar sebelum meminta kode lagi.':'Kode belum dapat dikirim. Coba lagi nanti.');
    }
    finally{lock(false);}
  }
  $('otpEmailForm').addEventListener('submit',event=>{
    event.preventDefault();
    return send($('otpEmail').value.trim().toLowerCase());
  });
  $('otpResend').addEventListener('click',()=>send(address));
  $('otpChange').addEventListener('click',()=>{
    if(busy)return;
    $('otpCodeForm').hidden=true;$('otpEmailForm').hidden=false;$('otpCode').value='';status('');$('otpEmail').focus();
  });
  $('otpCodeForm').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;lock(true);
    try{
      const token=$('otpCode').value.trim();
      if(!/^\d{6,10}$/.test(token)){status('Masukkan kode yang tertera di email.');return;}
      const {data,error}=await auth.verifyOtp({email:address,token,type:'email'});
      const user=data?.user;
      if(error||!data?.session||!user?.email_confirmed_at||user.email?.toLowerCase()!==address){
        status('Kode salah atau kedaluwarsa. Periksa kode terbaru atau kirim ulang.');
        return;
      }
      const row=await backend.loadProfile(user);
      backend.clearCache();backend.cache(row,user);
      sessionStorage.setItem('devmatch-profile-draft',JSON.stringify({...backend.profileDataForCache(row.profile_data),username:row.username||'',role:row.account_role}));
      location.assign(backend.destination(row,user));
    }catch{status('Login belum dapat diselesaikan. Coba lagi atau masuk dengan password.');}
    finally{lock(false);}
  });
  setInterval(tick,1000);
})();
