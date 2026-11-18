const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/js/email-otp.js', 'utf8');
function setup({sendError = null, verifyResult = null} = {}) {
  const events = {}, requests = [], redirects = [];
  const elements = Object.fromEntries(['otpStatus','otpEmail','otpSend','otpVerify','otpResend','otpEmailForm','otpCodeForm','otpCode','otpChange'].map(id => [id, {
    value:'', hidden:id==='otpCodeForm', focus(){}, addEventListener(name, fn){events[id+':'+name]=fn;}
  }]));
  const backend = {ready:Promise.resolve(null),client:{auth:{
    signInWithOtp:async args=>{requests.push(args);return {error:sendError};},
    verifyOtp:async args=>{requests.push(args);return verifyResult;}
  }},loadProfile:async()=>({profile_data:{},account_role:'client'}),profileDataForCache:x=>x,clearCache(){},cache(){},destination:()=>'/client'};
  vm.runInNewContext(source,{document:{getElementById:id=>elements[id]},window:{devMatchBackend:backend},setInterval(){},sessionStorage:{setItem(){}},location:{assign:url=>redirects.push(url)}});
  const submit = id=>events[id+':submit']({preventDefault(){}});
  elements.otpEmail.value='Owner@Example.invalid';
  return {elements,requests,redirects,submit};
}
test('Email login OTP requests an existing account only and shows the code form',async()=>{
  const x=setup();await x.submit('otpEmailForm');
  assert.equal(x.requests[0].email,'owner@example.invalid');
  assert.equal(x.requests[0].options.shouldCreateUser,false);
  assert.equal(x.elements.otpCodeForm.hidden,false);
  assert.equal(x.elements.otpResend.disabled,true);
});
test('Disabled OTP does not falsely claim that an email was sent',async()=>{
  const x=setup({sendError:{code:'otp_disabled',status:400}});await x.submit('otpEmailForm');
  assert.equal(x.elements.otpCodeForm.hidden,true);
  assert.equal(x.elements.otpEmailForm.hidden,false);
  assert.match(x.elements.otpStatus.textContent,/belum dapat dikirim/);
});
test('OTP rate limits keep the email form available and explain the retry',async()=>{
  const x=setup({sendError:{status:429}});await x.submit('otpEmailForm');
  assert.equal(x.elements.otpCodeForm.hidden,true);
  assert.match(x.elements.otpStatus.textContent,/Tunggu/);
});
test('Email OTP requires a confirmed session belonging to the requested email',async()=>{
  const x=setup({verifyResult:{data:{user:{email:'different@example.invalid',email_confirmed_at:'now'},session:{}}}});
  await x.submit('otpEmailForm');x.elements.otpCode.value='123456';await x.submit('otpCodeForm');
  assert.equal(x.redirects.length,0);
  assert.match(x.elements.otpStatus.textContent,/salah atau kedaluwarsa/);
});
test('A valid email login code enters the account workspace',async()=>{
  const x=setup({verifyResult:{data:{user:{id:'test',email:'owner@example.invalid',email_confirmed_at:'now'},session:{}}}});
  await x.submit('otpEmailForm');x.elements.otpCode.value='123456';await x.submit('otpCodeForm');
  assert.equal(x.requests[1].type,'email');assert.deepEqual(x.redirects,['/client']);
});
