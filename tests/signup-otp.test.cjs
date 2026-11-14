const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('assets/js/email-confirmation.js','utf8');
test('signup code verifies the account and enters its profile',async()=>{
  let verifySubmit,request,redirect;
  const elements={confirmationEmail:{value:''},resendConfirmation:{},confirmationStatus:{},signupCode:{value:'123456'},verifySignup:{},emailConfirmation:{addEventListener(){}},verifySignupCode:{addEventListener:(_,fn)=>verifySubmit=fn}};
  const user={id:'test-user',email_confirmed_at:'2026-01-01'};
  const backend={client:{auth:{verifyOtp:async args=>{request=args;return {data:{user,session:{}}};}}},loadProfile:async()=>({}),clearCache(){},cache(){},destination:()=>'/profile'};
  vm.runInNewContext(code,{document:{getElementById:id=>elements[id]},window:{devMatchBackend:backend},sessionStorage:{getItem:()=> 'test@example.invalid',removeItem(){}},location:{assign:url=>redirect=url},setInterval(){}});
  await verifySubmit({preventDefault(){}});
  assert.equal(request.type,'signup');assert.equal(request.email,'test@example.invalid');assert.equal(request.token,'123456');assert.equal(redirect,'/profile');
});
