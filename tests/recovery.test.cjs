const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'../assets/js',name),'utf8');
const storage=initial=>({getItem:key=>initial[key]??null,setItem:(key,value)=>initial[key]=value,removeItem:key=>delete initial[key]});
test('Root callback preserves the reset redirect instead of navigating to landing',async()=>{
  const redirects=[];
  vm.runInNewContext(source('auth-callback.js'),{
    window:{devMatchBackend:{ready:Promise.resolve(null)}},
    sessionStorage:storage({'devmatch-recovery':'1'}),location:{replace:url=>redirects.push(url)}
  });
  await new Promise(setImmediate);assert.deepEqual(redirects,[]);
});
test('Root callback routes expired links to the recovery error screen',async()=>{
  const redirects=[];
  vm.runInNewContext(source('auth-callback.js'),{
    window:{devMatchBackend:{ready:Promise.resolve(null)}},
    sessionStorage:storage({'devmatch-recovery-error':'expired'}),location:{replace:url=>redirects.push(url)}
  });
  await new Promise(setImmediate);assert.deepEqual(redirects,['devmatch-reset-password.html']);
});
test('Forgot form sends a reset request with a return URL and prevents repeated sends',async()=>{
  let submit,requests=0;
  const elements={forgotForm:{addEventListener:(_,fn)=>submit=fn},forgotEmail:{value:'test@example.invalid'},forgotSubmit:{},forgotStatus:{}};
  vm.runInNewContext(source('forgot-password.js'),{
    document:{getElementById:id=>elements[id]},setInterval:()=>{},location:{origin:'https://example.invalid'},
    window:{devMatchBackend:{client:{auth:{resetPasswordForEmail:async(email,options)=>{
      requests++;assert.equal(email,'test@example.invalid');assert.equal(options.redirectTo,'https://example.invalid/devmatch-reset-password.html');return {error:null};
    }}}}}
  });
  await submit({preventDefault(){}});await submit({preventDefault(){}});
  assert.equal(requests,1);assert.equal(elements.forgotSubmit.disabled,true);
  assert.match(elements.forgotStatus.textContent,/If an account exists/);
});
test('Network failure does not claim the reset link was sent',async()=>{
  let submit;
  const elements={forgotForm:{addEventListener:(_,fn)=>submit=fn},forgotEmail:{value:'test@example.invalid'},forgotSubmit:{},forgotStatus:{}};
  vm.runInNewContext(source('forgot-password.js'),{
    document:{getElementById:id=>elements[id]},setInterval:()=>{},location:{origin:'https://example.invalid'},
    window:{devMatchBackend:{client:{auth:{resetPasswordForEmail:async()=>{throw new Error('offline');}}}}}
  });
  await submit({preventDefault(){}});assert.match(elements.forgotStatus.textContent,/Unable to request/);
});
test('An email quota rejection clearly reports that no reset email was sent',async()=>{
  let submit;
  const elements={forgotForm:{addEventListener:(_,fn)=>submit=fn},forgotEmail:{value:'test@example.invalid'},forgotSubmit:{},forgotStatus:{}};
  vm.runInNewContext(source('forgot-password.js'),{
    document:{getElementById:id=>elements[id]},setInterval:()=>{},location:{origin:'https://example.invalid'},
    window:{devMatchBackend:{client:{auth:{resetPasswordForEmail:async()=>({error:{status:429,code:'over_email_send_rate_limit',message:'email rate limit exceeded'}})}}}}
  });
  await submit({preventDefault(){}});assert.match(elements.forgotStatus.textContent,/Email delivery limit reached/);assert.match(elements.forgotStatus.textContent,/No new reset email was sent/);assert.equal(elements.forgotSubmit.disabled,true);
});
test('A normal session cannot open the password reset form without a recovery link',async()=>{
  const elements={resetForm:{hidden:true,addEventListener(){}},resetStatus:{},requestResetLink:{hidden:true}};
  vm.runInNewContext(source('reset-password.js'),{
    document:{getElementById:id=>elements[id]},sessionStorage:storage({}),
    window:{devMatchBackend:{ready:Promise.resolve({id:'fixture'})}}
  });
  await new Promise(setImmediate);assert.equal(elements.resetForm.hidden,true);assert.match(elements.resetStatus.textContent,/reset link/);
});
test('An invalid recovery session clears stale state so a new link can be requested',async()=>{
  const state={'devmatch-recovery':'1'};
  const elements={resetForm:{hidden:true,addEventListener(){}},resetStatus:{},requestResetLink:{hidden:true}};
  vm.runInNewContext(source('reset-password.js'),{
    document:{getElementById:id=>elements[id]},sessionStorage:storage(state),
    window:{devMatchBackend:{ready:Promise.resolve(null)}}
  });
  await new Promise(setImmediate);assert.equal(state['devmatch-recovery'],undefined);assert.equal(elements.requestResetLink.hidden,false);
});
