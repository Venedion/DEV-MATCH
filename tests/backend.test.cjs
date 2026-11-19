const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/js/backend.js'),'utf8');
async function setup({verified=true,page='devmatch-settings.html',role='dev',userRole='dev',changeAccount=false,legacySensitiveCache=false,commentResults=[],directoryPeople=[],notifications=[],favorites=[],notificationReadIds=[],metrics=[],metricsError=null,rpcResponses={},projectEngagement=null,workspaceRole=null,workspaces=[]}={}){
  let gets=0;const redirects=[],updates=[],passwords=[],rpcCalls=[],tableCalls=[],uploads=[];
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
  if(workspaceRole)sessionValues['devmatch-workspace-'+user.id]=workspaceRole;
  function workspaceQuery(){let selectedRole=null;let payload=null;const q={select:()=>q,eq:(key,value)=>{if(key==='role')selectedRole=value;return q;},update:changes=>{payload=changes;return q;},maybeSingle:async()=>{const data=workspaces.find(w=>w.user_id===user.id && w.role===selectedRole)||null;return {data,error:null};},single:async()=>{const data=workspaces.find(w=>w.user_id===user.id && w.role===selectedRole);if(!data)return {data:null,error:new Error('Missing workspace')};Object.assign(data,payload);return {data,error:null};}};return q;}
  const query={select:()=>query,eq:()=>query,single:async()=>({data:row,error:null}),update:payload=>{updates.push(payload);Object.assign(row,payload);return query;}};
  const commentSelects=[];
  const commentsQuery={select(columns){commentSelects.push(columns);return this;},eq(){return this;},order(){return this;},
    then(resolve,reject){return Promise.resolve(commentResults[commentSelects.length-1]||{data:[],error:null}).then(resolve,reject);}};
  function dataQuery(data,table){
    const filters=[];const call={table,filters};tableCalls.push(call);
    const rows=()=>data.filter(row=>filters.every(([key,value])=>!Object.hasOwn(row,key)||row[key]===value));
    const result={select:()=>result,eq:(key,value)=>{filters.push([key,value]);return result;},in:()=>result,order:()=>result,
      delete:()=>{call.deleted=true;return result;},upsert:(payload,options)=>{call.payload=payload;call.options=options;return result;},
      maybeSingle:async()=>({data:rows()[0]||null,error:null}),then:(resolve,reject)=>Promise.resolve({data:rows(),error:null}).then(resolve,reject)};return result;
  }
  const tableData={directory_people:directoryPeople,notifications,favorites,notification_reads:notificationReadIds.map(notification_id=>({notification_id})),project_engagements:projectEngagement?[projectEngagement]:[]};
  let authChangeHandler;let removedPresenceChannels=0;const presenceChannels=[],presenceTracks=[];
  const auth={getUser:async()=>({data:{user:changeAccount&&++gets>1?{...user,id:'other'}:user},error:null}),
    getSession:async()=>({data:{session:{user,access_token:'fixture-token'}},error:null}),
    onAuthStateChange:callback=>{authChangeHandler=callback;return {data:{subscription:{unsubscribe(){}}}};},
    signInWithPassword:async args=>args.password==='Current!Password1'?{data:{user},error:null}:{data:{user:null},error:Object.assign(new Error('Wrong password'),{code:'invalid_credentials'})},
    updateUser:async args=>{passwords.push(args);return {data:{user},error:null};}};
  const client={auth,from:table=>table==='account_workspaces'?workspaceQuery():table==='profiles'?query:table==='comments'?commentsQuery:dataQuery(tableData[table]||[],table),
    rpc:async(name,args)=>{rpcCalls.push({name,args});return Object.hasOwn(rpcResponses,name)?rpcResponses[name]:{data:metrics,error:metricsError};},
    realtime:{setAuth:async()=>{}},
    channel:(topic,options)=>{const channel={topic,options,subscribe:callback=>{callback('SUBSCRIBED');return channel;},track:async state=>{presenceTracks.push(state);return 'ok';}};presenceChannels.push(channel);return channel;},
    removeChannel:async()=>{removedPresenceChannels+=1;return 'ok';},
    storage:{from:bucket=>({upload:async(path,file,options)=>{uploads.push({bucket,path,file,options});return {error:null};}})}};
  const context={URLSearchParams,Blob,crypto:{randomUUID:()=>`upload-${uploads.length+1}`},window:{supabase:{createClient:()=>client},addEventListener(){}},location:{pathname:'/'+page,search:'?role='+role,hash:'',replace:url=>redirects.push(url),assign:url=>redirects.push(url),reload:()=>redirects.push('reload')},
    localStorage:storage,sessionStorage:{getItem:key=>sessionValues[key]??null,removeItem:key=>delete sessionValues[key],setItem:(key,value)=>sessionValues[key]=value},document:{createElement:()=>({}),head:{append(){}},getElementById:()=>({remove(){}}),addEventListener(){}},fetch:async()=>({ok:true,json:async()=>({})})};
  vm.runInNewContext(source,context);const backend=context.window.devMatchBackend;await backend.ready;
  await new Promise(resolve=>setImmediate(resolve));
  return {backend,redirects,updates,passwords,rpcCalls,tableCalls,values,sessionValues,row,user,commentSelects,
    authChangeHandler,removedPresenceChannels:()=>removedPresenceChannels,presenceChannels,presenceTracks,uploads};
}
test('Experience supporting files are limited to 5 MB without changing request upload limits',async()=>{
  const {backend,uploads}=await setup();
  const maximumBytes=5*1024*1024;
  const makeFile=size=>{
    const file=new Blob([new Uint8Array(size)],{type:'application/pdf'});
    Object.defineProperty(file,'name',{value:'experience.pdf'});
    return file;
  };
  const uploaded=await backend.uploadPrivateFile('experience','',makeFile(maximumBytes));
  assert.equal(uploaded.size,maximumBytes);
  assert.equal(uploads.length,1);
  await assert.rejects(backend.uploadPrivateFile('experience','',makeFile(maximumBytes+1)),/upload size limit/);
  assert.equal(uploads.length,1);
  const requestUpload=await backend.uploadPrivateFile('request','request-id',makeFile(10*1024*1024));
  assert.equal(requestUpload.size,10*1024*1024);
  assert.equal(uploads.length,2);
});
test('Unconfirmed email accounts are routed to email verification',async()=>{
  const {redirects}=await setup({verified:false});assert.deepEqual(redirects,['devmatch-verify-email.html']);
});
test('Recovery page remains accessible before email verification',async()=>{
  const {redirects,backend}=await setup({verified:false,page:'devmatch-reset-password.html'});assert.equal((await backend.ready).id,'fixture');assert.deepEqual(redirects,[]);
});
test('Confirmed email can use settings while the contact phone remains unverified',async()=>{
  const {redirects,backend}=await setup();assert.equal((await backend.ready).id,'fixture');assert.deepEqual(redirects,[]);
});
test('A verified user publishes private presence on any authenticated page',async()=>{
  const {presenceChannels,presenceTracks}=await setup({page:'devmatch-find-projects.html'});
  assert.equal(presenceChannels.length,1);
  assert.equal(presenceChannels[0].topic,'devmatch-user-presence:fixture');
  assert.equal(presenceChannels[0].options.config.private,true);
  assert.equal(presenceTracks.length,1);
  assert.equal(presenceTracks[0].userId,'fixture');
});
test('Signing out removes the active presence channel',async()=>{
  const {authChangeHandler,removedPresenceChannels}=await setup();
  authChangeHandler('SIGNED_OUT',null);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(removedPresenceChannels(),1);
});
test('Settings role follows the authenticated account',async()=>{
  const {redirects}=await setup({role:'client'});assert.deepEqual(redirects,['devmatch-settings.html?role=dev']);
});
test('A developer account cannot open client-only notifications',async()=>{
  const {backend,redirects}=await setup({page:'devmatch-notifications.html',userRole:'dev'});
  assert.equal(await backend.ready,null);
  assert.deepEqual(redirects,['devmatch-dashboard.html']);
});
test('Comment profile links resolve an author role from their matching directory profile',async()=>{
  const {backend}=await setup({directoryPeople:[
    {id:'fixture',display_name:'Owner',account_role:'dev'},
    {id:'fixture',display_name:'Client workspace',account_role:'client'}
  ]});
  const roles=await backend.loadCommentAuthorRoles([{userId:'fixture',name:'Client workspace'}]);
  assert.equal(roles.get('fixture'),'client');
  assert.equal(backend.publicProfileUrl('user id','dev'),'devmatch-developer-profile.html?developer=user%20id');
  assert.equal(backend.publicProfileUrl('user id','client'),'devmatch-client-profile.html?client=user%20id');
  assert.equal(backend.publicProfileUrl('user id','unknown'),null);
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
test('Project comment replies require a parent and nonempty text within the comment limit',async()=>{
  const {backend}=await setup();
  await assert.rejects(backend.addProjectCommentReply('project','comment','   '),/required/);
  await assert.rejects(backend.addProjectCommentReply('project','','A reply'),/required/);
  await assert.rejects(backend.addProjectCommentReply('project','comment','x'.repeat(5001)),/required/);
});
test('Existing project comments remain available before the reply migration is applied',async()=>{
  const existingComment={id:'comment-1',project_id:'project-1',user_id:'developer-1',text:'Existing comment',
    author_name:'Developer',author_initials:'D',created_at:'2026-11-17T00:00:00Z'};
  const {backend,commentSelects}=await setup({commentResults:[
    {data:null,error:{code:'42703',message:'column comments.parent_comment_id does not exist'}},
    {data:[existingComment],error:null}
  ]});
  const result=await backend.loadProjectComments('project-1');
  assert.equal(result.repliesSupported,false);
  assert.equal(result.comments.length,1);
  assert.equal(result.comments[0].text,'Existing comment');
  assert.equal(result.comments[0].parentCommentId,null);
  assert.doesNotMatch(commentSelects[1],/parent_comment_id/);
});

test('Connected developer workspace preserves the primary client profile on save',async()=>{
  const workspaces=[{user_id:'fixture',role:'dev',display_name:'Developer',profile_data:{displayName:'Developer',bio:'dev bio'},onboarding_complete:true}];
  const {backend,row,user,sessionValues,values}=await setup({userRole:'client',workspaceRole:'dev',workspaces,page:'devmatch-auth.html'});
  assert.equal((await backend.loadProfile(user)).account_role,'dev');
  await backend.updateWorkspaceProfile({display_name:'Updated developer',profile_data:{bio:'updated dev'}});
  assert.equal(row.display_name,'Owner');assert.equal(row.account_role,'client');
  assert.equal(workspaces[0].display_name,'Updated developer');
  assert.equal(sessionValues['devmatch-active-role'],'dev');
  assert.equal(values['devmatch-active-role'],undefined);
});
test('Workspace selection is tab-local and cannot grant a missing role',async()=>{
  const workspaces=[{user_id:'fixture',role:'dev',display_name:'Developer',profile_data:{},onboarding_complete:true}];
  const tabA=await setup({userRole:'client',workspaceRole:'dev',workspaces,page:'devmatch-auth.html'});
  const tabB=await setup({userRole:'client',workspaces,page:'devmatch-auth.html'});
  assert.equal((await tabA.backend.loadProfile(tabA.user)).account_role,'dev');
  assert.equal((await tabB.backend.loadProfile(tabB.user)).account_role,'client');
  const forged=await setup({userRole:'client',workspaceRole:'dev',page:'devmatch-auth.html'});
  assert.equal((await forged.backend.loadProfile(forged.user)).account_role,'client');
  assert.equal(forged.sessionValues['devmatch-workspace-fixture'],undefined);
});

const connectedWorkspace={user_id:'fixture',role:'dev',display_name:'Separate developer',profile_data:{bio:'dev only'},onboarding_complete:true};
test('Connected modes keep canonical username email phone and separate profile data',async()=>{
  const x=await setup({page:'devmatch-auth.html',userRole:'client',workspaceRole:'dev',workspaces:[{...connectedWorkspace}]});
  const p=await x.backend.loadProfile(x.user);x.backend.cache(p,x.user);
  const cached=JSON.parse(x.values['devmatch-profile-dev']);
  assert.equal(cached.username,'owner');assert.equal(cached.email,x.user.email);assert.equal(cached.phone,x.row.phone);
  assert.equal(cached.bio,'dev only');assert.equal(cached.displayName,'Separate developer');
});
test('Favorites reads and removal stay in the selected mode',async()=>{
  const x=await setup({page:'devmatch-auth.html',userRole:'client',workspaceRole:'dev',workspaces:[{...connectedWorkspace}],favorites:[
    {workspace_role:'client',item_type:'project',item_id:'client-only'},
    {workspace_role:'dev',item_type:'project',item_id:'dev-only'}]});
  assert.equal(JSON.stringify(await x.backend.loadFavorites()),JSON.stringify([{type:'project',id:'dev-only'}]));
  await x.backend.setFavorite('project','dev-only',false);await x.backend.clearFavorites('project');
  for(const call of x.tableCalls.filter(c=>c.table==='favorites'))assert(call.filters.some(([k,v])=>k==='workspace_role'&&v==='dev'));
});
test('Favorite and notification read writes include their workspace in conflict keys',async()=>{
  const x=await setup({page:'devmatch-auth.html',userRole:'client',workspaceRole:'dev',workspaces:[{...connectedWorkspace}]});
  await x.backend.setFavorite('project','same-project',true);await x.backend.markNotificationsRead(['notification']);
  for(const call of x.tableCalls.filter(c=>c.payload)){
    const row=Array.isArray(call.payload)?call.payload[0]:call.payload;
    assert.equal(row.workspace_role,'dev');assert.match(call.options.onConflict,/workspace_role/);
  }
});
test('Notification badge and settings use the active workspace',async()=>{
  const x=await setup({page:'devmatch-auth.html',userRole:'client',workspaceRole:'dev',workspaces:[{...connectedWorkspace}],notifications:[
    {id:'client-note',recipient_role:'client'},{id:'dev-note',recipient_role:'dev'}],rpcResponses:{save_notification_preferences:{data:{},error:null}}});
  assert.equal(await x.backend.loadUnreadNotificationCount(),1);
  await x.backend.saveNotificationPreferences({messages:false});
  assert.equal(x.rpcCalls.at(-1).args.p_role,'dev');
});
