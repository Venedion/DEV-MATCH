const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/js/backend.js'),'utf8');
async function setup({verified=true,page='devmatch-settings.html',role='dev',userRole='dev',changeAccount=false}={}){
  let gets=0;const redirects=[],updates=[],passwords=[];
  const user={id:'fixture',email:'owner@example.invalid'};
  const row={id:user.id,account_role:userRole,account_verified:verified,onboarding_complete:true,profile_data:{displayName:'Owner'},display_name:'Owner',username:'owner',phone:'+6281234567890'};
  const values={['devmatch-profile-'+userRole]:JSON.stringify({...row.profile_data,username:row.username,displayName:row.display_name,phone:row.phone,email:user.email,role:userRole,googleConnected:false})};
  const storage={getItem:key=>values[key]??null,setItem:(key,value)=>values[key]=value,removeItem:key=>delete values[key]};
  const query={select:()=>query,eq:()=>query,single:async()=>({data:row,error:null}),update:payload=>{updates.push(payload);Object.assign(row,payload);return query;}};
  const auth={getUser:async()=>({data:{user:changeAccount&&++gets>1?{...user,id:'other'}:user},error:null}),
    signInWithPassword:async args=>args.password==='Current!Password1'?{data:{user},error:null}:{data:{user:null},error:Object.assign(new Error('Wrong password'),{code:'invalid_credentials'})},
    updateUser:async args=>{passwords.push(args);return {data:{user},error:null};}};
  const context={URLSearchParams,window:{supabase:{createClient:()=>({auth,from:()=>query})}},location:{pathname:'/'+page,search:'?role='+role,hash:'',replace:url=>redirects.push(url),assign:url=>redirects.push(url),reload:()=>redirects.push('reload')},
    localStorage:storage,sessionStorage:{getItem:()=>null,removeItem(){},setItem(){}},document:{createElement:()=>({}),head:{append(){}},getElementById:()=>({remove(){}}),addEventListener(){}},fetch:async()=>({ok:true,json:async()=>({})})};
  vm.runInNewContext(source,context);const backend=context.window.devMatchBackend;await backend.ready;
  return {backend,redirects,updates,passwords};
}
test('Unverified accounts are routed to contact verification',async()=>{
  const {redirects}=await setup({verified:false});assert.deepEqual(redirects,['devmatch-verify.html']);
});
test('Recovery page remains accessible while phone verification is pending',async()=>{
  const {redirects,backend}=await setup({verified:false,page:'devmatch-reset-password.html'});assert.equal((await backend.ready).id,'fixture');assert.deepEqual(redirects,[]);
});
test('Settings role follows the authenticated account',async()=>{
  const {redirects}=await setup({role:'client'});assert.deepEqual(redirects,['devmatch-settings.html?role=dev']);
});
test('Profile saves exclude account identifiers and preserve approved profile data',async()=>{
  const {backend,updates}=await setup();await backend.saveProfile({displayName:'New name',city:'Medan',email:'fake@example.invalid',phone:'+1234567890',username:'fake',role:'client'});
  assert.equal(updates.length,1);assert.equal(updates[0].display_name,'New name');assert.equal(updates[0].profile_data.city,'Medan');
  for(const field of ['email','phone','username','role'])assert.equal(Object.hasOwn(updates[0].profile_data,field),false);
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
