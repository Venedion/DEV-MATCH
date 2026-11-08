(() => {
  const $=id=>document.getElementById(id);
  const ready=window.DEVMATCH_AUTH_CONFIG?.emailOtpReady===true;
  const backend=window.devMatchBackend;
  const service=window.createDevMatchOtpService(backend.client,{emailEnabled:ready});
  let address='';let cooldownUntil=0;let busy=false;
  function status(text){$('otpStatus').textContent=text;}
  function tick(){
    const seconds=Math.max(0,Math.ceil((cooldownUntil-Date.now())/1000));
    $('otpResend').disabled=busy||seconds>0;
    $('otpResend').textContent=seconds?`Kirim ulang (${seconds} detik)`: 'Kirim ulang';
  }
  function lock(value){busy=value;$('otpSend').disabled=value||!ready;$('otpVerify').disabled=value;tick();}
  async function send(){
    if(busy)return;
    lock(true);
    try{
      await backend.ready;
      await service.requestEmail(address);
      cooldownUntil=Date.now()+60000;
      $('otpEmailForm').hidden=true;$('otpCodeForm').hidden=false;
      status('Jika email ini sudah terdaftar, kode login akan dikirim. Periksa inbox dan folder spam.');
      $('otpCode').value='';$('otpCode').focus();
    }catch(error){status(error.message||'Kode belum dapat dikirim. Coba lagi nanti.');}
    finally{lock(false);}
  }
  $('otpEmailForm').addEventListener('submit',event=>{event.preventDefault();address=$('otpEmail').value.trim().toLowerCase();send();});
  $('otpResend').addEventListener('click',send);
  $('otpChange').addEventListener('click',()=>{
    if(busy)return;
    $('otpCodeForm').hidden=true;$('otpEmailForm').hidden=false;$('otpCode').value='';status('');$('otpEmail').focus();
  });
  $('otpCodeForm').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;lock(true);
    try{
      await service.verifyEmail(address,$('otpCode').value);
      const {data:{user},error}=await backend.client.auth.getUser();
      if(error||!user)throw error||new Error('Sesi login tidak dapat diverifikasi.');
      const row=await backend.loadProfile(user);
      backend.clearCache();backend.cache(row,user);
      sessionStorage.setItem('devmatch-profile-draft',JSON.stringify({...row.profile_data,username:row.username||'',role:row.account_role}));
      location.assign(backend.destination(row));
    }catch(error){status(error.message||'Kode salah atau kedaluwarsa. Silakan coba lagi.');}
    finally{lock(false);}
  });
  if(!ready){$('otpSend').disabled=true;status('Login dengan kode email belum tersedia. Silakan gunakan login dengan password untuk sementara.');}
  setInterval(tick,1000);
})();
