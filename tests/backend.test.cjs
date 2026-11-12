const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/js/backend.js'),'utf8');
async function setup({verified=true,page='devmatch-settings.html',role='dev',userRole='dev',changeAccount=false,legacySensitiveCache=false}={}){
  let gets=0;const redirects=[],updates=[],passwords=[];
  const user={id:'fixture',email:'owner@example.invalid',email_confirmed_at:verified?'2026-11-08':null};
  const row={id:user.id,account_role:userRole,account_verified:false,onboarding_complete:true,profile_data:{displayName:'Owner'},display_name:'Owner',username:'owner',phone:'+6281234567890'};
  const cachedProfile={...row.profile_data,username:row.username,displayName:row.display_name,phone:row.phone,email:user.email,role:userRole,googleConnected:false};
  if(legacySensitiveCache)Object.assign(cachedProfile,{accountNumber:'1234567890',npwp:'09.254.891.2-121.000'});
  const values={['devmatch-profile-'+userRole]:JSON.stringify(cachedProfile)};
  const storage=new Proxy({getItem:key=>values[key]??null,setItem:(key,value)=>values[key]=value,removeItem:key=>delete values[key]},{
    ownKeys:target=>[...Reflect.ownKeys(target),...Object.keys(values)],
    getOwnPropertyDescriptor:(target,key)=>Object.hasOwn(values,key)?{enumerable:true,configurable:true,value:values[key]}:Object.getOwnPropertyDescriptor(target,key)
  });
  const sessionValues=legacySensitiveCache?{'devmatch-profile-draft':JSON.stringify({displayName:'Owner',accountNumber:'1234567890',npwp:'09.254.891.2-121.000'})}:{};
  const query={select:()=>query,eq:()=>query,single:async()=>({data:row,error:null}),update:payload=>{updates.push(payload);Object.assign(row,payload);return query;}};
  const auth={getUser:async()=>({data:{user:changeAccount&&++gets>1?{...user,id:'other'}:user},error:null}),
    signInWithPassword:async args=>args.password==='Current!Password1'?{data:{user},error:null}:{data:{user:null},error:Object.assign(new Error('Wrong password'),{code:'invalid_credentials'})},
    updateUser:async args=>{passwords.push(args);return {data:{user},error:null};}};
  const context={URLSearchParams,window:{supabase:{createClient:()=>({auth,from:()=>query})}},location:{pathname:'/'+page,search:'?role='+role,hash:'',replace:url=>redirects.push(url),assign:url=>redirects.push(url),reload:()=>redirects.push('reload')},
    localStorage:storage,sessionStorage:{getItem:key=>sessionValues[key]??null,removeItem:key=>delete sessionValues[key],setItem:(key,value)=>sessionValues[key]=value},document:{createElement:()=>({}),head:{append(){}},getElementById:()=>({remove(){}}),addEventListener(){}},fetch:async()=>({ok:true,json:async()=>({})})};
  vm.runInNewContext(source,context);const backend=context.window.devMatchBackend;await backend.ready;
  return {backend,redirects,updates,passwords,values,sessionValues,row,user};
}
test('Unconfirmed email accounts are routed to email verification',async()=>{
  const {redirects}=await setup({verified:false});assert.deepEqual(redirects,['devmatch-verify-email.html']);
});
test('Recovery page remains accessible before email verification',async()=>{
  const {redirects,backend}=await setup({verified:false,page:'devmatch-reset-password.html'});assert.equal((await backend.ready).id,'fixture');assert.deepEqual(redirects,[]);
});
test('Confirmed email can use settings while the contact phone remains unverified',async()=>{
  const {redirects,backend}=await setup();assert.equal((await backend.ready).id,'fixture');assert.deepEqual(redirects,[]);
});
test('Settings role follows the authenticated account',async()=>{
  const {redirects}=await setup({role:'client'});assert.deepEqual(redirects,['devmatch-settings.html?role=dev']);
});
test('Profile saves exclude account identifiers and preserve approved profile data',async()=>{
  const {backend,updates}=await setup();await backend.saveProfile({displayName:'New name',city:'Medan',email:'fake@example.invalid',phone:'+1234567890',username:'fake',role:'client'});
  assert.equal(updates.length,1);assert.equal(updates[0].display_name,'New name');assert.equal(updates[0].profile_data.city,'Medan');
  for(const field of ['email','phone','username','role'])assert.equal(Object.hasOwn(updates[0].profile_data,field),false);
});
test('Private payout and tax values are excluded from browser profile caches',async()=>{
  const {backend,values,row,user}=await setup();
  row.profile_data={displayName:'Owner',bankName:'BCA',accountNumber:'1234567890',accountHolder:'Owner',npwp:'09.254.891.2-121.000'};
  backend.cache(row,user);
  const cached=JSON.parse(values['devmatch-profile-dev']);
  for(const field of ['bankName','accountNumber','accountHolder','npwp'])assert.equal(Object.hasOwn(cached,field),false);
  assert.equal(cached.displayName,'Owner');
});
test('Previously cached payout and tax values are scrubbed from local and session storage',async()=>{
  const {values,sessionValues}=await setup({legacySensitiveCache:true});
  for(const cache of [values['devmatch-profile-dev'],sessionValues['devmatch-profile-draft']]){
    const profile=JSON.parse(cache);
    for(const field of ['accountNumber','npwp'])assert.equal(Object.hasOwn(profile,field),false);
  }
});
test('Ordinary profile saves preserve payout details unless explicitly updated',async()=>{
  const {backend,updates,row}=await setup();
  row.profile_data={displayName:'Owner',accountNumber:'1234567890',npwp:'09.254.891.2-121.000'};
  await backend.saveProfile({displayName:'Updated',accountNumber:'changed',npwp:'changed'});
  assert.equal(updates[0].profile_data.accountNumber,'1234567890');
  assert.equal(updates[0].profile_data.npwp,'09.254.891.2-121.000');
  await backend.saveProfile({displayName:'Updated',accountNumber:'0987654321',npwp:'new'}, {includePrivateFields:true});
  assert.equal(updates[1].profile_data.accountNumber,'0987654321');
  assert.equal(updates[1].profile_data.npwp,'new');
});
test('Incorrect current password cannot update the password',async()=>{
  const {backend,passwords}=await setup();await assert.rejects(backend.changePassword('wrong','Next!Password1'),/Wrong password/);assert.equal(passwords.length,0);
});
test('Correct current password is verified before changing the password',async()=>{
  const {backend,passwords}=await setup();await backend.changePassword('Current!Password1','Next!Password1');assert.equal(passwords[0].password,'Next!Password1');
});
test('An account switch cannot save a previous account profile',async()=>{
  const {backend,updates}=await setup({changeAccount:true});await assert.rejects(backend.saveProfile({displayName:'Previous account'}),/session changed/);assert.equal(updates.length,0);
});
