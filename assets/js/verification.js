(() => {
  const $=id=>document.getElementById(id);
  const backend=window.devMatchBackend;
  let user=null,row=null,service=null,sending=false,verifying=false,nextEmail=0,nextSms=0,sentPhone='';
  const normalize=value=>{
    let phone=String(value).replace(/[\s()-]/g,'');
    if(phone.startsWith('0'))phone='+62'+phone.slice(1);
    else if(phone.startsWith('62'))phone='+'+phone;
    if(!/^\+[1-9]\d{8,14}$/.test(phone))throw new Error('Masukkan nomor lengkap dengan kode negara, misalnya +6281234567890.');
    return phone;
  };
  function badge(id,verified){$(id).textContent=verified?'Terverifikasi':'Belum terverifikasi';$(id).classList.toggle('verified',verified);}
  function update(){
    badge('emailState',Boolean(user?.email_confirmed_at));
    const verified=Boolean(row?.account_verified);
    badge('phoneState',Boolean(row?.phone_verified_at&&row?.verified_phone===row?.phone));
    $('emailDescription').textContent=user?.email_confirmed_at?'Alamat email akun sudah dikonfirmasi.':'Buka tautan verifikasi yang dikirim ke emailmu, lalu login untuk melanjutkan. Periksa juga folder spam.';
    $('emailVerificationForm').hidden=Boolean(user?.email_confirmed_at);
    $('phoneVerificationForm').hidden=!user?.email_confirmed_at||verified;
    $('verificationContinue').hidden=!verified;
    if(verified){
      $('phoneDescription').textContent='Nomor telepon akun sudah dikonfirmasi melalui Supabase.';
      $('smsCodeForm').hidden=true;
      $('verificationContinue').href=backend.destination(row);
    }
  }
  function tick(){
    const seconds=Math.max(0,Math.ceil((nextSms-Date.now())/1000));
    $('sendSms').disabled=!service||sending||seconds>0;
    $('sendSms').textContent=seconds?`Kirim ulang (${seconds} detik)`:'Kirim kode SMS';
    const emailSeconds=Math.max(0,Math.ceil((nextEmail-Date.now())/1000));
    $('resendEmail').disabled=emailSeconds>0;
    $('resendEmail').textContent=emailSeconds?`Kirim ulang (${emailSeconds} detik)`:'Kirim ulang tautan verifikasi';
  }
  $('verificationEmail').value=sessionStorage.getItem('devmatch-verification-email')||'';
  $('emailVerificationForm').addEventListener('submit',async event=>{
    event.preventDefault();if(Date.now()<nextEmail)return;
    nextEmail=Date.now()+60000;tick();
    try{
      const {error}=await backend.client.auth.resend({type:'signup',email:$('verificationEmail').value.trim()});
      if(error)throw error;
      $('emailStatus').textContent='Jika akun ini menunggu verifikasi, tautan akan dikirim ke email tersebut.';
    }catch(error){$('emailStatus').textContent=error.message||'Tautan belum dapat dikirim. Coba lagi nanti.';}
  });
  $('verificationPhone').addEventListener('input',()=>{
    if(sentPhone){$('smsCodeForm').hidden=true;sentPhone='';$('phoneStatus').textContent='Kirim kode baru ke nomor yang akan diverifikasi.';}
  });
  $('phoneVerificationForm').addEventListener('submit',async event=>{
    event.preventDefault();if(!service||sending||Date.now()<nextSms)return;
    sending=true;tick();
    try{
      const phone=normalize($('verificationPhone').value);
      const {error}=await backend.client.from('profiles').update({phone}).eq('id',user.id);
      if(error)throw error;
      await service.requestPhone(phone);
      row=await backend.loadProfile(user);update();
      if(row.account_verified)return;
      sentPhone=phone;nextSms=Date.now()+60000;$('smsCodeForm').hidden=false;
      $('smsCode').value='';$('smsCode').focus();$('phoneStatus').textContent='Kode SMS sudah diminta. Masukkan kode yang kamu terima.';
    }catch(error){$('phoneStatus').textContent=error.message||'SMS belum dapat dikirim. Silakan coba lagi.';}
    finally{sending=false;tick();}
  });
  $('smsCodeForm').addEventListener('submit',async event=>{
    event.preventDefault();if(!service||verifying||!sentPhone)return;
    verifying=true;$('verifySms').disabled=true;
    try{
      await service.verifyPhone(sentPhone,$('smsCode').value);
      row=await backend.loadProfile(user);update();
      if(!row.account_verified)throw new Error('Status verifikasi belum lengkap. Muat ulang untuk memeriksa kembali.');
      backend.cache(row,user);$('phoneStatus').textContent='Email dan nomor telepon berhasil diverifikasi.';
    }catch(error){$('phoneStatus').textContent=error.message||'Kode salah atau kedaluwarsa. Coba lagi.';}
    finally{verifying=false;$('verifySms').disabled=false;}
  });
  (async()=>{
    try{
      user=await backend.ready;
      if(user){row=await backend.loadProfile(user);$('verificationPhone').value=row.phone||'';}
      update();
      if(!user?.email_confirmed_at||row?.account_verified)return;
      const settings=await backend.authCapabilities();
      if(settings.external?.phone!==true){$('phoneDescription').textContent='Verifikasi SMS belum tersedia. Nomormu tetap berstatus belum terverifikasi. Silakan coba lagi nanti.';return;}
      service=window.createDevMatchOtpService(backend.client,{phoneEnabled:true});
      $('phoneDescription').textContent='Kirim kode SMS untuk membuktikan akses ke nomor teleponmu.';tick();
    }catch(error){$('phoneStatus').textContent=error.message||'Status verifikasi belum dapat diperiksa. Muat ulang untuk mencoba lagi.';}
  })();
  setInterval(tick,1000);
})();
