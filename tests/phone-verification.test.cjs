const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/js/phone-verification.js'),'utf8');

async function setup({available=true,autoConfirm=false,sendError=null,verifyError=null,record=true}={}) {
  const elements=new Map(), calls=[];
  const phone='+6281234567890';
  const account={id:'owner',email_confirmed_at:'today'};
  let row={phone};
  function element(id) {
    if(!elements.has(id)) elements.set(id,{value:'',textContent:'',disabled:true,hidden:true,focus(){},addEventListener(name,handler){this[name]=handler;}});
    return elements.get(id);
  }
  const client={supabaseUrl:'https://example.invalid',supabaseKey:'test',auth:{
    getUser:async()=>({data:{user:account}}),
    updateUser:async attrs=>{calls.push(['send',attrs]);return {error:sendError};},
    verifyOtp:async params=>{
      calls.push(['verify',params]);
      if(!verifyError&&record)row={phone,verified_phone:phone,phone_verified_at:'today'};
      return {error:verifyError};
    }
  }};
  vm.runInNewContext(source,{window:{devMatchBackend:{client,ready:Promise.resolve(account),loadProfile:async()=>row}},document:{getElementById:id=>id==='continuePhoneSetup'?null:element(id)},fetch:async()=>({ok:true,json:async()=>({external:{phone:available},phone_autoconfirm:autoConfirm})}),setTimeout(){}});
  const flush=()=>new Promise(setImmediate);
  await flush();
  return {element,calls,phone,flush};
}

test('OTP SMS requires enabled phone auth with confirmation enforced',async()=>{
  for(const options of [{available:false},{autoConfirm:true}]) {
    const h=await setup(options);
    assert.equal(h.element('sendPhoneCode').disabled,true);
    h.element('sendPhoneCode').click();
    assert.equal(h.calls.length,0);
    assert.match(h.element('phoneVerificationStatus').textContent,/unavailable/);
  }
});

test('The shared phone is verified only after Auth checks the code and Supabase records it',async()=>{
  const h=await setup();
  h.element('sendPhoneCode').click();await h.flush();
  assert.equal(h.calls[0][1].phone,h.phone);
  assert.equal(h.element('phoneCodeField').hidden,false);
  h.element('phoneCode').value='123456';
  h.element('verifyPhoneCode').click();await h.flush();
  assert.equal(h.calls[1][1].type,'phone_change');
  assert.equal(h.calls[1][1].token,'123456');
  assert.equal(h.element('phoneCodeField').hidden,true);
  assert.match(h.element('phoneVerificationStatus').textContent,/verified in both modes/);
});

test('Failed delivery does not show a code field or claim SMS was requested',async()=>{
  const h=await setup({sendError:{code:'sms_send_failed'}});
  h.element('sendPhoneCode').click();await h.flush();
  assert.equal(h.element('phoneCodeField').hidden,true);
  assert.match(h.element('phoneVerificationStatus').textContent,/could not be delivered/);
});

test('An expired code or missing database confirmation never shows verified',async()=>{
  for(const options of [{verifyError:{code:'otp_expired'}},{record:false}]) {
    const h=await setup(options);
    h.element('sendPhoneCode').click();await h.flush();
    h.element('phoneCode').value='123456';
    h.element('verifyPhoneCode').click();await h.flush();
    assert.equal(h.element('phoneCodeField').hidden,false);
    assert.doesNotMatch(h.element('phoneVerificationStatus').textContent,/verified in both modes/);
  }
});
