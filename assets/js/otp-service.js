/* Provider integration prepared for activation after SMTP/SMS setup.
 * This module does not replace login or enforce dashboard authorization.
 * OTP generation, expiry, attempt limits, and verification belong to Supabase.
 */
(function(root){
  function createOtpService(client,{emailEnabled=false,phoneEnabled=false,now=Date.now}={}){
    const sent=new Map();
    const pending=new Set();
    function email(value){
      const result=String(value).trim().toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))throw new Error('Masukkan email yang valid.');
      return result;
    }
    function phone(value){
      let result=String(value).replace(/[\s()-]/g,'');
      if(result.startsWith('0'))result='+62'+result.slice(1);
      else if(result.startsWith('62'))result='+'+result;
      if(!/^\+[1-9]\d{8,14}$/.test(result))throw new Error('Gunakan nomor telepon dengan kode negara, misalnya +6281234567890.');
      return result;
    }
    function token(value){
      const result=String(value).trim();
      if(!/^\d{6}$/.test(result))throw new Error('Masukkan kode OTP 6 digit.');
      return result;
    }
    function enabled(value){if(!value)throw new Error('Pengiriman OTP belum tersedia.');}
    async function currentUser(){
      const {data,error}=await client.auth.getUser();
      if(error)throw error;
      if(!data.user?.email_confirmed_at)throw new Error('Verifikasi email dan login terlebih dahulu.');
      return data.user;
    }
    async function send(key,action){
      if(pending.has(key)||now()-(sent.get(key)??-Infinity)<60000)throw new Error('Tunggu 60 detik sebelum mengirim ulang.');
      pending.add(key);
      try{
        const result=await action();
        if(result.error)throw result.error;
        sent.set(key,now());
        return result.data;
      }finally{pending.delete(key);}
    }
    return {
      async requestEmail(value){
        enabled(emailEnabled);const address=email(value);
        return send('email:'+address,()=>client.auth.signInWithOtp({email:address,options:{shouldCreateUser:false}}));
      },
      async verifyEmail(value,code){
        enabled(emailEnabled);const address=email(value);
        const {data,error}=await client.auth.verifyOtp({email:address,token:token(code),type:'email'});
        if(error)throw error;
        if(!data.session||!data.user?.email_confirmed_at||email(data.user.email)!==address)throw new Error('Verifikasi email belum berhasil.');
        return data;
      },
      async requestPhone(value){
        enabled(phoneEnabled);const number=phone(value);const user=await currentUser();
        if(user.phone_confirmed_at&&'+'+String(user.phone).replace(/^\+/,'')===number)return {alreadyVerified:true};
        // Update the logged-in account rather than creating another phone-only user.
        return send('phone:'+user.id+':'+number,()=>client.auth.updateUser({phone:number}));
      },
      async verifyPhone(value,code){
        enabled(phoneEnabled);const number=phone(value);const otp=token(code);const before=await currentUser();
        const {data,error}=await client.auth.verifyOtp({phone:number,token:otp,type:'phone_change'});
        if(error)throw error;
        const after=await currentUser();
        if(after.id!==before.id||!after.phone_confirmed_at||'+'+String(after.phone).replace(/^\+/,'')!==number)throw new Error('Verifikasi nomor telepon belum berhasil.');
        return data;
      }
    };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={createOtpService};
  else root.createDevMatchOtpService=createOtpService;
})(typeof window!=='undefined'?window:globalThis);
