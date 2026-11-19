const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/js/phone-verification.js'),'utf8');

async function setup(available) {
  const elements=new Map(), calls=[];
  let verified=false;
  function element(id) {
    if(id==='continuePhoneSetup')return null;
    if(!elements.has(id)) elements.set(id,{disabled:true,hidden:true,removeAttribute(name){delete this[name];},addEventListener(name,fn){this[name]=fn;}});
    return elements.get(id);
  }
  const code='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const backend={ready:Promise.resolve({email_confirmed_at:'today'}),loadProfile:async()=>({phone:'+6281234567890'}),client:{
    supabaseUrl:'https://example.invalid',
    rpc:async(name)=>{calls.push(name);return {data:name==='is_whatsapp_phone_verified'?verified:code};}
  }};
  vm.runInNewContext(source,{window:{devMatchBackend:backend},document:{getElementById:element},
    fetch:async()=>({ok:true,json:async()=>({available,number:'6285373117073'})})});
  await new Promise(setImmediate);
  return {element,calls,markVerified:()=>{verified=true;}};
}

test('WhatsApp verification stays unavailable until the webhook is configured',async()=>{
  const h=await setup(false);
  assert.equal(h.element('startWhatsAppVerification').disabled,true);
  await h.element('startWhatsAppVerification').click();
  assert.deepEqual(h.calls,['is_whatsapp_phone_verified']);
});

test('A prepared message opens WhatsApp, but only server confirmation verifies the account',async()=>{
  const h=await setup(true);
  await h.element('startWhatsAppVerification').click();
  assert.match(h.element('openWhatsAppVerification').href,/^https:\/\/wa.me\/6285373117073\?text=DEV-MATCH%20VERIFY%20/);
  await h.element('checkWhatsAppVerification').click();
  assert.match(h.element('phoneVerificationStatus').textContent,/No matching message/);
  h.markVerified();
  await h.element('checkWhatsAppVerification').click();
  assert.equal(h.element('openWhatsAppVerification').href,undefined);
  assert.match(h.element('phoneVerificationStatus').textContent,/verified in both modes/);
});
