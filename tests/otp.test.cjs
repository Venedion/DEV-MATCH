const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createOtpService}=require('../assets/js/otp-service');
const user={id:'fixture',email:'test@example.invalid',email_confirmed_at:'2026-11-08'};
test('OTP remains inactive without sender configuration',async()=>{
  const service=createOtpService({auth:{}});
  await assert.rejects(service.requestEmail(user.email),/belum tersedia/);
  await assert.rejects(service.requestPhone('+6281234567890'),/belum tersedia/);
});
test('Email login never creates accounts; resend has a cooldown',async()=>{
  let calls=0;
  const service=createOtpService({auth:{signInWithOtp:async args=>{
    calls++;assert.equal(args.options.shouldCreateUser,false);return {data:{},error:null};
  }}},{emailEnabled:true,now:()=>1000});
  await service.requestEmail(user.email);
  await assert.rejects(service.requestEmail(user.email),/60 detik/);
  assert.equal(calls,1);
});
test('Invalid codes are rejected and provider errors are preserved',async()=>{
  const service=createOtpService({auth:{verifyOtp:async()=>({error:new Error('expired')})}},{emailEnabled:true});
  await assert.rejects(service.verifyEmail(user.email,'12'),/6 digit/);
  await assert.rejects(service.verifyEmail(user.email,'123456'),/expired/);
});
test('Email verification requires a real confirmed session',async()=>{
  const service=createOtpService({auth:{verifyOtp:async()=>({data:{user,session:null}})}},{emailEnabled:true});
  await assert.rejects(service.verifyEmail(user.email,'123456'),/belum berhasil/);
});
test('Phone OTP attaches to the existing account and normalizes Indonesian numbers',async()=>{
  const service=createOtpService({auth:{
    getUser:async()=>({data:{user}}),
    updateUser:async args=>{assert.equal(args.phone,'+6281234567890');return {data:{}};}
  }},{phoneEnabled:true});
  await service.requestPhone('081234567890');
});
test('Phone verification rejects an account mismatch',async()=>{
  let count=0;
  const service=createOtpService({auth:{
    getUser:async()=>({data:{user:++count===1?user:{...user,id:'other',phone:'6281234567890',phone_confirmed_at:'2026-11-08'}}}),
    verifyOtp:async args=>{assert.equal(args.type,'phone_change');return {data:{}};}
  }},{phoneEnabled:true});
  await assert.rejects(service.verifyPhone('081234567890','123456'),/belum berhasil/);
});
