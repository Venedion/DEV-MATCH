const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/js/backend.js'),'utf8');
async function setup({verified=true,page='devmatch-settings.html',role='dev',userRole='dev',changeAccount=false,legacySensitiveCache=false,notifications=[],notificationReadIds=[],metrics=[],metricsError=null,rpcResponses={},projectEngagement=null}={}){
  let gets=0;const redirects=[],updates=[],passwords=[],rpcCalls=[];
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
  function dataQuery(data){const result={select:()=>result,eq:()=>result,order:()=>result,maybeSingle:async()=>({data:Array.isArray(data)?data[0]||null:data,error:null}),then:(resolve,reject)=>Promise.resolve({data,error:null}).then(resolve,reject)};return result;}
  const tableData={notifications,notification_reads:notificationReadIds.map(notification_id=>({notification_id})),project_engagements:projectEngagement?[projectEngagement]:[]};
  const auth={getUser:async()=>({data:{user:changeAccount&&++gets>1?{...user,id:'other'}:user},error:null}),
    signInWithPassword:async args=>args.password==='Current!Password1'?{data:{user},error:null}:{data:{user:null},error:Object.assign(new Error('Wrong password'),{code:'invalid_credentials'})},
    updateUser:async args=>{passwords.push(args);return {data:{user},error:null};}};
  const context={URLSearchParams,window:{supabase:{createClient:()=>({auth,from:table=>table==='profiles'?query:dataQuery(tableData[table]||[]),rpc:async(name,args)=>{rpcCalls.push({name,args});return Object.hasOwn(rpcResponses,name)?rpcResponses[name]:{data:metrics,error:metricsError};}})}},location:{pathname:'/'+page,search:'?role='+role,hash:'',replace:url=>redirects.push(url),assign:url=>redirects.push(url),reload:()=>redirects.push('reload')},
    localStorage:storage,sessionStorage:{getItem:key=>sessionValues[key]??null,removeItem:key=>delete sessionValues[key],setItem:(key,value)=>sessionValues[key]=value},document:{createElement:()=>({}),head:{append(){}},getElementById:()=>({remove(){}}),addEventListener(){}},fetch:async()=>({ok:true,json:async()=>({})})};
  vm.runInNewContext(source,context);const backend=context.window.devMatchBackend;await backend.ready;
  return {backend,redirects,updates,passwords,rpcCalls,values,sessionValues,row,user};
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
test('A developer account cannot open client-only notifications',async()=>{
  const {backend,redirects}=await setup({page:'devmatch-notifications.html',userRole:'dev'});
  assert.equal(await backend.ready,null);
  assert.deepEqual(redirects,['devmatch-dashboard.html']);
});
test('A client account cannot open the developer dashboard',async()=>{
  const {backend,redirects}=await setup({page:'devmatch-dashboard.html',userRole:'client'});
  assert.equal(await backend.ready,null);
  assert.deepEqual(redirects,['devmatch-client-dashboard.html']);
});
test('A client account cannot open My Projects',async()=>{
  const {backend,redirects}=await setup({page:'devmatch-my-projects.html',userRole:'client'});
  assert.equal(await backend.ready,null);
  assert.deepEqual(redirects,['devmatch-client-dashboard.html']);
});
test('Owned project metrics are loaded from the Supabase metrics RPC',async()=>{
  const metrics=[{project_id:'project-1',views:'3',favorites:2,comments:'1'}];
  const {backend,rpcCalls}=await setup({metrics});
  const loaded=await backend.loadOwnedProjectMetrics();
  assert.equal(JSON.stringify(loaded),JSON.stringify([{id:'project-1',views:3,favorites:2,comments:1}]));
  assert.equal(rpcCalls[0].name,'get_owned_project_metrics');
});
test('Invalid Supabase project metrics are rejected',async()=>{
  const {backend}=await setup({metrics:[{project_id:'project-1',views:-1,favorites:0,comments:0}]});
  await assert.rejects(backend.loadOwnedProjectMetrics(),/invalid project metrics/);
});
test('Profile reviews are loaded from the public review RPC',async()=>{
  const review={id:'review-id',reviewer_name:'Client',reviewer_initials:'CL',project_title:'Website',rating:5,text:'Great work',created_at:'2026-11-17T00:00:00Z'};
  const {backend,rpcCalls}=await setup({rpcResponses:{get_profile_reviews:{data:[review],error:null}}});
  const loaded=await backend.loadProfileReviews('profile-id');
  assert.equal(JSON.stringify(loaded),JSON.stringify([{id:'review-id',reviewerName:'Client',reviewerInitials:'CL',projectTitle:'Website',rating:5,text:'Great work',createdAt:'2026-11-17T00:00:00Z'}]));
  assert.equal(rpcCalls[0].name,'get_profile_reviews');
});
test('Project completion requires the linked conversation and confirms the current participant',async()=>{
  const engagement={id:'engagement-id',client_completed_at:'2026-11-17T00:00:00Z'};
  const {backend,rpcCalls}=await setup({rpcResponses:{
    start_project_engagement:{data:'engagement-id',error:null},
    confirm_project_engagement:{data:engagement,error:null}
  }});
  await backend.confirmProjectCompletion('conversation-id');
  assert.deepEqual(rpcCalls.map(call=>call.name),['start_project_engagement','confirm_project_engagement']);
});
test('Project reviews reject invalid ratings and save valid review data through Supabase',async()=>{
  const review={id:'review-id',reviewer_name:'Client',reviewer_initials:'CL',project_title:'Website',rating:4,text:'Well done',created_at:'2026-11-17T00:00:00Z'};
  const {backend,rpcCalls}=await setup({rpcResponses:{submit_project_review:{data:[review],error:null}}});
  await assert.rejects(backend.submitProjectReview('engagement-id',6,'Too high'),/rating from 1 to 5/);
  assert.equal(rpcCalls.length,0);
  const saved=await backend.submitProjectReview('engagement-id',4,'  Well done  ');
  assert.equal(saved.rating,4);
  assert.equal(rpcCalls[0].name,'submit_project_review');
  assert.equal(JSON.stringify(rpcCalls[0].args),JSON.stringify({p_engagement_id:'engagement-id',p_rating:4,p_text:'Well done'}));
});
test('Unread notification count uses only unread rows for the signed-in account',async()=>{
  const notifications=[{id:'unread-id'},{id:'read-id'}];
  const {backend}=await setup({notifications,notificationReadIds:['read-id']});
  assert.equal(await backend.loadUnreadNotificationCount(),1);
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
