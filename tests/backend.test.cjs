const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/js/backend.js'),'utf8');
function createElement(){
  const attributes=new Map();
  const classes=new Set();
  return {style:{setProperty(name,value){this[name]=value;}},children:[],classList:{add(...names){names.forEach(name=>classes.add(name));},remove(...names){names.forEach(name=>classes.delete(name));},contains:name=>classes.has(name)},
    setAttribute:(name,value)=>attributes.set(name,value),hasAttribute:name=>attributes.has(name),removeAttribute:name=>attributes.delete(name),
    append(...children){this.children.push(...children);children.forEach(child=>child.parentNode=this);},
    prepend(...children){this.children.unshift(...children);children.forEach(child=>child.parentNode=this);},
    insertBefore(child,reference){const index=this.children.indexOf(reference);this.children.splice(index<0?this.children.length:index,0,child);child.parentNode=this;},
    replaceChildren(...children){this.children=children;},remove(){this.removed=true;this.isConnected=false;},
    querySelector(selector){if(selector!=='.devmatch-auth-skeleton-layout')return null;return this.layoutElement||(this.layoutElement=createElement());},
    querySelectorAll:()=>[],
    getBoundingClientRect:()=>({height:58}),cloneNode:()=>createElement(),getAttribute:name=>attributes.get(name)};
}
async function setup({verified=true,page='devmatch-settings.html',role='dev',userRole='dev',changeAccount=false,legacySensitiveCache=false,commentResults=[],directoryPeople=[],notifications=[],favorites=[],notificationReadIds=[],metrics=[],metricsError=null,rpcResponses={},projectEngagement=null,workspaceRole=null,workspaces=[],headerPosition=null,hasMobileBottomNavigation=false,deferAuth=false,querySelectorResults={}}={}){
  let gets=0,releaseAuth;const redirects=[],updates=[],passwords=[],rpcCalls=[],tableCalls=[],uploads=[];
  const user={id:'fixture',email:'owner@example.invalid',email_confirmed_at:verified?'2026-11-08':null};
  const row={id:user.id,account_role:userRole,account_verified:false,onboarding_complete:true,profile_data:{displayName:'Owner'},display_name:'Owner',username:'owner',username_changed_at:'',phone:'+6281234567890'};
  const cachedProfile={...row.profile_data,username:row.username,usernameChangedAt:row.username_changed_at||'',displayName:row.display_name,phone:row.phone,email:user.email,role:userRole,googleConnected:false};
  if(legacySensitiveCache)Object.assign(cachedProfile,{accountNumber:'1234567890',npwp:'09.254.891.2-121.000',birthday:'1990-01-02'});
  const values={['devmatch-profile-'+userRole]:JSON.stringify(cachedProfile)};
  const storage=new Proxy({getItem:key=>values[key]??null,setItem:(key,value)=>values[key]=value,removeItem:key=>delete values[key]},{
    ownKeys:target=>[...Reflect.ownKeys(target),...Object.keys(values)],
    getOwnPropertyDescriptor:(target,key)=>Object.hasOwn(values,key)?{enumerable:true,configurable:true,value:values[key]}:Object.getOwnPropertyDescriptor(target,key)
  });
  const sessionValues=legacySensitiveCache?{'devmatch-profile-draft':JSON.stringify({displayName:'Owner',accountNumber:'1234567890',npwp:'09.254.891.2-121.000',birthday:'1990-01-02'})}:{};
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
  const getUserResult=()=>({data:{user:changeAccount&&++gets>1?{...user,id:'other'}:user},error:null});
  const auth={getUser:()=>deferAuth?new Promise(resolve=>{releaseAuth=()=>resolve(getUserResult());}):Promise.resolve(getUserResult()),
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
  const elements=new Map();const documentEvents={};const pageHeader=headerPosition?createElement():null;
  if(pageHeader)pageHeader.position=headerPosition;
  const body=createElement();
  if(pageHeader)body.append(pageHeader);
  const mobileNavItems=hasMobileBottomNavigation?Array.from({length:5},(_,index)=>{
    const item=createElement();if(index===2)item.classList.add('active');return item;
  }):[];
  const mobileNav=hasMobileBottomNavigation?{
    querySelectorAll:selector=>selector==='.mobile-bottom-nav__item'?mobileNavItems:[]
  }:null;
  const documentElement=createElement();
  const document={createElement,head:{append(...nodes){nodes.forEach(node=>elements.set(node.id,node));}},
    documentElement:{...documentElement,append(...nodes){nodes.forEach(node=>{node.isConnected=true;elements.set(node.id,node);});}},
    body:headerPosition?body:null,querySelector:selector=>selector==='body > header'?pageHeader:selector==='.mobile-bottom-nav'?mobileNav:null,
    querySelectorAll:selector=>querySelectorResults[selector]||[],
    createTreeWalker:()=>({nextNode:()=>false}),getElementById:id=>elements.get(id)||null,
    addEventListener:(name,handler)=>documentEvents[name]=handler};
  const context={URLSearchParams,Blob,crypto:{randomUUID:()=>`upload-${uploads.length+1}`},window:{supabase:{createClient:()=>client},addEventListener(){}},location:{pathname:'/'+page,search:'?role='+role,hash:'',replace:url=>redirects.push(url),assign:url=>redirects.push(url),reload:()=>redirects.push('reload')},
    localStorage:storage,sessionStorage:{getItem:key=>sessionValues[key]??null,removeItem:key=>delete sessionValues[key],setItem:(key,value)=>sessionValues[key]=value},document,
    getComputedStyle:element=>({position:element.position||'static',width:'220px',height:'58px',flex:'0 0 auto'}),
    fetch:async()=>({ok:true,json:async()=>({})})};
  vm.runInNewContext(source,context);const backend=context.window.devMatchBackend;
  if(headerPosition)documentEvents.DOMContentLoaded();
  if(!deferAuth){
    await backend.ready;
    await new Promise(resolve=>setImmediate(resolve));
  }
  return {backend,skeletons:context.window.DEVMATCH_SKELETON,document,elements,redirects,updates,passwords,rpcCalls,tableCalls,values,sessionValues,row,user,commentSelects,
    authChangeHandler,removedPresenceChannels:()=>removedPresenceChannels,presenceChannels,presenceTracks,uploads,releaseAuth};
}
test('shared skeletons are accessible without a generic auth overlay',async()=>{
  const {skeletons,document,elements}=await setup();
  const target=document.createElement('div');
  skeletons.status(target,'Loading project data');
  assert.equal(target.children.length,2);
  assert.equal(target.children[0].getAttribute('aria-hidden'),'true');
  assert.equal(target.children[1].textContent,'Loading project data');
  assert.equal(elements.get('auth-pending'),undefined);
  assert.equal(elements.get('devmatch-auth-skeleton'),undefined);
  assert.match(elements.get('devmatch-skeleton-styles').textContent,/data-devmatch-auth-mask="field"/);
  assert.doesNotMatch(elements.get('devmatch-skeleton-styles').textContent,/body\{visibility:hidden\}/);
});
test('card skeletons follow directory and mobile project card layouts',async()=>{
  const {skeletons,document}=await setup();
  const clients=document.createElement('div');
  skeletons.cards(clients,1,'client');
  assert.match(clients.children[0].className,/client-card/);
  assert.equal(clients.children[0].children[0].className,'client-card-top');
  assert.equal(clients.children[0].children.some(child=>child.className==='devmatch-shimmer devmatch-skeleton-media'),false);

  const developers=document.createElement('div');
  skeletons.cards(developers,1,'developer');
  assert.match(developers.children[0].className,/dev-card/);
  assert.equal(developers.children[0].children.some(child=>child.className==='dev-stats-grid'),true);

  const projects=document.createElement('div');
  skeletons.cards(projects,1,'mobile-project');
  assert.match(projects.children[0].className,/mobile-project-card/);
  assert.equal(projects.children[0].children[0].className,'mobile-project-main');
  assert.equal(projects.children[0].children[0].children[0].children[0].className,'devmatch-shimmer project-thumb');
});
test('request card skeletons omit project artwork and retain request sections',async()=>{
  const {skeletons,document}=await setup();
  const target=document.createElement('div');
  skeletons.cards(target,1,'request');
  const card=target.children[0];
  assert.match(card.className,/request-project-card/);
  assert.equal(card.children[0].className,'project-body request-card-body');
  assert.equal(card.children[0].children[0].className,'request-card-header');
  assert.equal(card.children[0].children.some(child=>child.className==='devmatch-shimmer project-art'),false);
});
test('Explore card skeleton matches the marketplace catalog structure',async()=>{
  const {skeletons,document}=await setup();
  const target=document.createElement('div');
  skeletons.cards(target,1,'marketplace-project');
  const card=target.children[0];
  assert.match(card.className,/project-card catalog-card/);
  assert.equal(card.children[0].className,'devmatch-shimmer project-art');
  assert.deepEqual(card.children[1].children.map(child=>child.className),[
    'project-meta',
    'project-title',
    'project-description',
    'devmatch-shimmer devmatch-skeleton-line catalog-price',
    'project-by catalog-project-by'
  ]);
});
test('auth-pending keeps the real page visible and masks the user header in place',async()=>{
  const fixed=await setup({headerPosition:'fixed',deferAuth:true});
  const fixedHeader=fixed.document.body.children[0];
  assert.equal(fixedHeader.classList.contains('devmatch-auth-skeleton-header-copy'),false);
  assert.equal(fixed.document.documentElement.classList.contains('devmatch-auth-pending-root'),true);
  assert.match(fixed.elements.get('devmatch-auth-pending-mask-styles').textContent,/devmatch-auth-pending-root/);
  assert.equal(fixed.elements.get('devmatch-auth-skeleton'),undefined);
  assert.equal(fixed.document.body.classList.contains('devmatch-auth-pending-content'),true);
  assert.equal(fixed.document.body.children.length,2);
  assert.equal(fixed.document.body.children[1].id,'devmatch-auth-pending-status');
  fixed.releaseAuth();
  await fixed.backend.ready;
  assert.equal(fixed.document.body.classList.contains('devmatch-auth-pending-content'),false);
  assert.equal(fixed.document.documentElement.classList.contains('devmatch-auth-pending-root'),false);

  const staticHeader=await setup({headerPosition:'static',deferAuth:true});
  assert.equal(staticHeader.document.body.children[0].classList.contains('devmatch-auth-skeleton-header-copy'),false);
  assert.equal(staticHeader.document.body.children.length,2);
  staticHeader.releaseAuth();
  await staticHeader.backend.ready;
});
test('settings retain their shell while cached fields are masked',async()=>{
  const field=createElement();
  const {document,backend,releaseAuth}=await setup({
    page:'devmatch-settings.html',
    headerPosition:'fixed',
    deferAuth:true,
    querySelectorResults:{'#accountForm input:not([type="hidden"]):not([type="file"])':[field]}
  });
  assert.equal(document.body.classList.contains('devmatch-auth-pending-content'),true);
  assert.equal(field.getAttribute('data-devmatch-auth-mask'),'field');
  assert.equal(field.getAttribute('aria-hidden'),'true');
  releaseAuth();
  await backend.ready;
});
test('mobile navigation remains the real page navigation while auth is pending',async()=>{
  const {elements,document,backend,releaseAuth}=await setup({headerPosition:'fixed',hasMobileBottomNavigation:true,deferAuth:true});
  assert.equal(elements.get('devmatch-auth-skeleton'),undefined);
  assert.equal(document.body.classList.contains('devmatch-auth-pending-content'),true);
  assert.equal(document.querySelector('.mobile-bottom-nav').querySelectorAll('.mobile-bottom-nav__item').length,5);
  releaseAuth();
  await backend.ready;
});
test('protected pages show their own loading state as soon as the document is ready',async()=>{
  const {document,elements,backend,releaseAuth}=await setup({page:'devmatch-discover-projects.html',headerPosition:'fixed',deferAuth:true});
  assert.equal(elements.get('devmatch-auth-skeleton'),undefined);
  assert.equal(elements.get('auth-pending'),undefined);
  assert.equal(document.body.classList.contains('devmatch-auth-pending-content'),true);
  assert.equal(document.body.children.length,2);
  assert.equal(document.documentElement.classList.contains('devmatch-auth-pending-root'),true);
  releaseAuth();
  await backend.ready;
});
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
test('Chat read state uses workspace-scoped storage, migrates legacy state, and respects server receipts',async()=>{
  const {backend,values}=await setup();
  const timestamp=Date.parse('2026-11-23T10:00:00.000Z');
  backend.setChatReadAt('fixture','client','conversation-1',timestamp);
  assert.equal(values['devmatch-chat-read:fixture:client:conversation-1'],String(timestamp));
  assert.equal(backend.getChatReadAt('fixture','client','conversation-1'),timestamp);
  assert.equal(backend.getChatReadAt('fixture','dev','conversation-1'),0);

  values['devmatch-chat-read:fixture:legacy-conversation']=String(timestamp);
  assert.equal(backend.getChatReadAt('fixture','client','legacy-conversation'),timestamp);
  assert.equal(values['devmatch-chat-read:fixture:client:legacy-conversation'],String(timestamp));
  assert.equal(Object.hasOwn(values,'devmatch-chat-read:fixture:legacy-conversation'),false);
  assert.equal(backend.getChatReadAt('fixture','dev','legacy-conversation'),0);

  const conversation={id:'conversation-1',last_message:{
    sender_id:'peer',created_at:'2026-11-23T09:00:00.000Z',read_at:null
  }};
  assert.equal(backend.isChatConversationUnread(conversation,'fixture','client'),false);
  assert.equal(backend.isChatConversationUnread(conversation,'fixture','dev'),true);
  conversation.last_message.read_at='2026-11-23T09:30:00.000Z';
  assert.equal(backend.isChatConversationUnread(conversation,'fixture','dev'),false);
  conversation.last_message.sender_id='fixture';
  conversation.last_message.read_at=null;
  assert.equal(backend.isChatConversationUnread(conversation,'fixture','dev'),false);
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
test('Client profile metrics use their database RPC and validate returned counts',async()=>{
  const {backend,rpcCalls}=await setup({rpcResponses:{get_client_profile_metrics:{data:[{views:'12',favorites:3}],error:null}}});
  assert.equal(JSON.stringify(await backend.loadClientProfileMetrics('client-id')),JSON.stringify({views:12,favorites:3}));
  assert.equal(JSON.stringify(rpcCalls[0]),JSON.stringify({name:'get_client_profile_metrics',args:{p_client_id:'client-id'}}));
});
test('Client profile views are recorded through the database RPC',async()=>{
  const {backend,rpcCalls}=await setup({rpcResponses:{record_client_profile_view:{data:null,error:null}}});
  await backend.recordClientProfileView('client-id');
  assert.equal(JSON.stringify(rpcCalls[0]),JSON.stringify({name:'record_client_profile_view',args:{p_client_id:'client-id'}}));
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
test('Username availability is checked through the normalized shared RPC',async()=>{
  const {backend,rpcCalls}=await setup({rpcResponses:{is_username_available:{data:true,error:null}}});
  const result=await backend.checkUsernameAvailability('FeLiTa13');
  assert.deepEqual(result,{data:true,error:null});
  assert.equal(rpcCalls[0].name,'is_username_available');
  assert.equal(rpcCalls[0].args.p_username,'felita13');
});
test('Username changes use the server RPC and refresh the cached change timestamp',async()=>{
  const {backend,rpcCalls,values,row,user}=await setup();
  const originalRpc=backend.client.rpc;
  backend.client.rpc=async(name,args)=>{
    if(name==='change_username'){
      rpcCalls.push({name,args});
      row.username=args.p_username;
      row.username_changed_at='2026-11-26T00:00:00.000Z';
      return {data:args.p_username,error:null};
    }
    return originalRpc(name,args);
  };
  const result=await backend.changeUsername('New_Handle');
  assert.equal(result.username,'new_handle');
  assert.equal(result.usernameChangedAt,'2026-11-26T00:00:00.000Z');
  assert.equal(rpcCalls[0].name,'change_username');
  assert.equal(rpcCalls[0].args.p_username,'new_handle');
  assert.equal(JSON.parse(values['devmatch-profile-dev']).usernameChangedAt,'2026-11-26T00:00:00.000Z');
});
test('Profile saves exclude account identifiers and preserve approved profile data',async()=>{
  const {backend,updates}=await setup();await backend.saveProfile({displayName:'New name',city:'Medan',email:'fake@example.invalid',phone:'+1234567890',username:'fake',usernameChangedAt:'2026-11-26',role:'client'});
  assert.equal(updates.length,1);assert.equal(updates[0].display_name,'New name');assert.equal(updates[0].profile_data.city,'Medan');
  for(const field of ['email','phone','username','usernameChangedAt','role'])assert.equal(Object.hasOwn(updates[0].profile_data,field),false);
});
test('Private payout, tax, and birthday values are excluded from browser profile caches',async()=>{
  const {backend,values,row,user}=await setup();
  row.profile_data={displayName:'Owner',bankName:'BCA',accountNumber:'1234567890',accountHolder:'Owner',npwp:'09.254.891.2-121.000',birthday:'1990-01-02'};
  backend.cache(row,user);
  const cached=JSON.parse(values['devmatch-profile-dev']);
  for(const field of ['bankName','accountNumber','accountHolder','npwp','birthday'])assert.equal(Object.hasOwn(cached,field),false);
  assert.equal(cached.displayName,'Owner');
});
test('Private birth dates can be loaded for settings without entering browser caches',async()=>{
  const {backend,row,values}=await setup();
  row.profile_data={displayName:'Owner',birthday:'1990-01-02'};
  const privateFields=await backend.loadPrivateProfileFields();
  assert.equal(privateFields.birthday,'1990-01-02');
  assert.deepEqual(Object.keys(privateFields),['birthday']);
  assert.equal(Object.hasOwn(JSON.parse(values['devmatch-profile-dev']),'birthday'),false);
});
test('Private cached data is scrubbed while the setup draft keeps its birthday',async()=>{
  const {values,sessionValues}=await setup({legacySensitiveCache:true});
  const cachedProfile=JSON.parse(values['devmatch-profile-dev']);
  for(const field of ['bankName','accountNumber','accountHolder','npwp','birthday'])assert.equal(Object.hasOwn(cachedProfile,field),false);
  const draft=JSON.parse(sessionValues['devmatch-profile-draft']);
  for(const field of ['accountNumber','npwp'])assert.equal(Object.hasOwn(draft,field),false);
  assert.equal(draft.birthday,'1990-01-02');
});
test('Ordinary profile saves preserve private fields unless explicitly updated',async()=>{
  const {backend,updates,row}=await setup();
  row.profile_data={displayName:'Owner',accountNumber:'1234567890',npwp:'09.254.891.2-121.000',birthday:'1990-01-02'};
  await backend.saveProfile({displayName:'Updated',accountNumber:'changed',npwp:'changed',birthday:'2000-02-03'});
  assert.equal(updates[0].profile_data.accountNumber,'1234567890');
  assert.equal(updates[0].profile_data.npwp,'09.254.891.2-121.000');
  assert.equal(updates[0].profile_data.birthday,'1990-01-02');
  await backend.saveProfile({displayName:'Updated',accountNumber:'0987654321',npwp:'new',birthday:'2000-02-03'}, {includePrivateFields:true});
  assert.equal(updates[1].profile_data.accountNumber,'0987654321');
  assert.equal(updates[1].profile_data.npwp,'new');
  assert.equal(updates[1].profile_data.birthday,'2000-02-03');
});
test('Developer Rates & Payouts reload saved values and update the authenticated profile row',async()=>{
  const {backend,updates,row,user,values}=await setup();
  row.profile_data={
    displayName:'Owner',
    hourlyRate:'Rp 250.000',
    minProjectPrice:'Rp 1.500.000',
    availability:'Full-time',
    experience:'Senior',
    bankName:'Example Bank',
    accountNumber:'1234567890',
    accountHolder:'Owner'
  };
  const loaded=await backend.loadProfile(user);
  assert.equal(loaded.account_role,'dev');
  assert.equal(loaded.profile_data.hourlyRate,'Rp 250.000');
  assert.equal(loaded.profile_data.minProjectPrice,'Rp 1.500.000');
  assert.equal(loaded.profile_data.accountNumber,'1234567890');

  await backend.saveProfile({
    ...loaded.profile_data,
    hourlyRate:'Rp 300.000',
    minProjectPrice:'Rp 2.000.000',
    accountNumber:'0987654321'
  },{includePrivateFields:true});
  const reloaded=await backend.loadProfile(user);
  assert.equal(reloaded.profile_data.hourlyRate,'Rp 300.000');
  assert.equal(reloaded.profile_data.minProjectPrice,'Rp 2.000.000');
  assert.equal(reloaded.profile_data.accountNumber,'0987654321');
  assert.equal(updates[0].profile_data.hourlyRate,'Rp 300.000');
  assert.equal(updates[0].profile_data.accountNumber,'0987654321');
  const cached=JSON.parse(values['devmatch-profile-dev']);
  assert.equal(cached.hourlyRate,'Rp 300.000');
  assert.equal(Object.hasOwn(cached,'accountNumber'),false);
  assert.equal(row.id,user.id);
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
test('Project comments expose workspace roles without relying on commenter profiles',async()=>{
  const {backend}=await setup({commentResults:[{data:[{
    id:'comment-1',project_id:'project-1',parent_comment_id:'parent-1',user_id:'developer-1',
    workspace_role:'dev',text:'Developer reply',author_name:'Developer',author_initials:'D',
    created_at:'2026-11-17T00:00:00Z'
  }],error:null}]});
  const result=await backend.loadProjectComments('project-1');
  assert.equal(result.comments[0].workspaceRole,'dev');
});
test('Existing project comments remain available before the reply migration is applied',async()=>{
  const existingComment={id:'comment-1',project_id:'project-1',user_id:'developer-1',text:'Existing comment',
    author_name:'Developer',author_initials:'D',created_at:'2026-11-17T00:00:00Z'};
  const {backend,commentSelects}=await setup({commentResults:[
    {data:null,error:{code:'42703',message:'column comments.parent_comment_id does not exist'}},
    {data:null,error:{code:'42703',message:'column comments.workspace_role does not exist'}},
    {data:[existingComment],error:null}
  ]});
  const result=await backend.loadProjectComments('project-1');
  assert.equal(result.repliesSupported,false);
  assert.equal(result.comments.length,1);
  assert.equal(result.comments[0].text,'Existing comment');
  assert.equal(result.comments[0].parentCommentId,null);
  assert.equal(result.comments[0].workspaceRole,null);
  assert.doesNotMatch(commentSelects[1],/parent_comment_id/);
  assert.doesNotMatch(commentSelects[2],/workspace_role/);
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
