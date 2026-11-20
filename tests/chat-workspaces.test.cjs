const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('supabase/functions/chat-api/index.ts','utf8').replace(/import[\s\S]*?from '[^']+';/g,'');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const C='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function setup({existingProjectConversation=null,includeChildThread=false,includeDeletedPortfolioMessage=false,includePortfolioMessage=false,requestStatus='open',currentUserId=A,portfolioOwnerId=B}={}){
  const calls=[];
  const conversation={id:C,participant_a_id:A,participant_b_id:B,participant_a_role:'client',participant_b_role:'dev',project_id:null,pair_key:`${A}:${B}`,merged_into:null,messages:[]};
  const childId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const childMessage={id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',conversation_id:childId,sender_id:B,ciphertext:'old child message',nonce:'1234567890123456',key_version:1,created_at:'2026-01-02T03:04:05.000Z',read_at:null,project_id:'request-project',project_reference_id:'request-project',project_kind:'request'};
  const deletedPortfolioMessage={id:'ffffffff-ffff-4fff-8fff-ffffffffffff',conversation_id:C,sender_id:A,ciphertext:'old portfolio reference',nonce:'1234567890123456',key_version:1,created_at:'2026-01-02T03:06:05.000Z',read_at:null,project_id:null,project_reference_id:'deleted-portfolio',project_kind:'portfolio'};
  const portfolioMessage={id:'99999999-9999-4999-8999-999999999999',conversation_id:C,sender_id:A,ciphertext:'portfolio reference',nonce:'1234567890123456',key_version:1,created_at:'2026-01-02T03:07:05.000Z',read_at:null,project_id:'portfolio-project',project_reference_id:'portfolio-project',project_kind:'portfolio'};
  const childConversation={id:childId,participant_a_id:A,participant_b_id:B,participant_a_role:'dev',participant_b_role:'client',project_id:null,pair_key:`${A}:${B}`,merged_into:C,context_message:[{project_id:'request-project',project_kind:'request',created_at:childMessage.created_at}],messages:[childMessage]};
  const decryptContexts=[];
  const context={URL,URLSearchParams,Response,console,Deno:{serve(){}},decryptMessage:async(row,cryptoContext)=>{decryptContexts.push(cryptoContext);return row.ciphertext;},encryptMessage:async()=>({ciphertext:'new encrypted message',nonce:'1234567890123456'}),sanitizeMessageText:text=>text,fetch:async(url,options={})=>{
    const u=new URL(url);calls.push({u,options});let rows=[];
    if(u.pathname.endsWith('/projects')&&(u.searchParams.get('id')==='eq.portfolio-project'||u.searchParams.get('id')?.includes('portfolio-project'))){
      rows=[{id:'portfolio-project',owner_id:portfolioOwnerId,project_kind:'portfolio',status:'published',title:'Developer portfolio',category:'Web application',price:'Rp 1.500.000',cover_image:'https://yxwktllqbmhustmhdaqi.supabase.co/storage/v1/object/public/project-media/example.png'}];
    }
    if(u.pathname.endsWith('/projects')&&u.searchParams.get('id')==='eq.portfolio-project-2'){
      rows=[{id:'portfolio-project-2',owner_id:B,project_kind:'portfolio',status:'published',title:'Second portfolio',category:'Mobile app',price:'Rp 2.000.000'}];
    }
    if(u.pathname.endsWith('/projects')&&(u.searchParams.get('id')==='eq.request-project'||u.searchParams.get('id')?.includes('request-project'))){
      rows=[{id:'request-project',owner_id:B,project_kind:'request',status:requestStatus,title:'Private request title',price:'Private request budget'}];
    }
    if(u.pathname.endsWith('/projects')&&u.searchParams.get('id')==='eq.closed-request'){
      rows=[{id:'closed-request',owner_id:B,project_kind:'request',status:'closed'}];
    }
    if(u.pathname.endsWith('/projects')&&u.searchParams.get('id')==='eq.self-request'){
      rows=[{id:'self-request',owner_id:A,project_kind:'request',status:'open'}];
    }
    if(u.pathname.endsWith('/profiles'))rows=u.searchParams.get('id')==='eq.'+B
      ? [{id:B,username:'developer_handle',display_name:'Developer profile name',account_role:'client'}]
      : u.searchParams.get('id')?.startsWith('in.')
        ? [{id:B,username:'real_username',display_name:'Primary client name',account_role:'client'}]
        : [{id:A,account_role:'client',onboarding_complete:true}];
    if(u.pathname.endsWith('/account_workspaces'))rows=u.searchParams.get('user_id')==='eq.'+B
      ? [{user_id:B,role:'dev',display_name:'Developer workspace name'}]
      : u.searchParams.get('user_id')?.startsWith('in.')
        ? [{user_id:B,role:'dev',display_name:'Developer profile'}]
        : [{user_id:A,role:'dev',onboarding_complete:true}];
    if(u.pathname.endsWith('/directory_people'))rows=[{id:B,account_role:u.searchParams.get('account_role')?.replace(/^eq\./,'')||'dev'}];
    if(u.pathname.endsWith('/rpc/get_or_create_conversation')){
      const args=JSON.parse(options.body);
      rows=[{...conversation,project_id:args.p_project_id}];
    }
    if(u.pathname.endsWith('/conversations')){
      if(u.searchParams.has('id'))rows=includeChildThread&&u.searchParams.get('id')===`eq.${childId}`
        ? [childConversation]
        : [conversation];
      else if(u.searchParams.has('pair_key'))rows=existingProjectConversation?[existingProjectConversation]:[];
      else if(u.searchParams.has('merged_into')){
        const filter=u.searchParams.get('merged_into');
        if(filter==='is.null')rows=[conversation];
        else rows=includeChildThread&&(filter===`eq.${C}`||filter===`in.(${C})`)?[childConversation]:[];
      }
      else if(u.searchParams.has('or'))rows=[conversation];
    }
    if(u.pathname.endsWith('/messages')){
      if(options.method==='PATCH')rows=[];
      else if(options.method==='POST')rows=[{...JSON.parse(options.body)[0],id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',created_at:'2026-01-03T03:04:05.000Z',read_at:null}];
      else rows=includeDeletedPortfolioMessage
        ?[deletedPortfolioMessage]
        :includePortfolioMessage
          ?[portfolioMessage]
          :includeChildThread
            ?[childMessage]
            :[];
    }
    return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
  }};
  vm.runInNewContext(source,context);
  return {calls,context,decryptContexts,run:body=>context.handleAction(body,{id:currentUserId},{keys:new Map([[1,new Uint8Array(32)]]),activeVersion:1},'https://test.invalid','test-key','Bearer test-token')};
}
test('Inbox query includes the same user pair in either workspace and hides empty threads',async()=>{
  const x=setup();const rows=await x.run({action:'list-conversations',workspaceRole:'dev'});
  const q=x.calls.find(c=>c.u.pathname.endsWith('/conversations')).u.searchParams.get('or');
  assert.equal(q,`(participant_a_id.eq.${A},participant_b_id.eq.${A})`);
  assert.equal(x.calls.find(c=>c.u.pathname.endsWith('/conversations')).u.searchParams.get('merged_into'),'is.null');
  assert.equal(rows.length,0);
});
test('A participant can read the pair thread after switching workspaces',async()=>{
  const x=setup();
  const rows=await x.run({action:'list-messages',workspaceRole:'dev',conversationId:C});
  assert.equal(rows.length,0);
  assert(x.calls.some(c=>c.u.pathname.endsWith('/messages')&&c.options.method==='PATCH'));
});
test('Virtual threads return child messages using their original conversation encryption context',async()=>{
  const x=setup({includeChildThread:true});
  const rows=await x.run({action:'list-conversations',workspaceRole:'dev'});
  assert.equal(rows.length,1);
  assert.deepEqual(Array.from(rows[0].source_conversations,source=>source.id),[C,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);
  assert.equal(rows[0].last_message.text,'old child message');
  assert.equal(rows[0].project_context.project_kind,'request');
  assert.equal(rows[0].project_context.available,true);
  assert.equal(x.decryptContexts[0].conversationId,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  const messages=await x.run({action:'list-messages',workspaceRole:'dev',conversationId:C});
  assert.equal(messages.length,1);
  assert.equal(messages[0].conversation_id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  assert.equal(x.decryptContexts.at(-1).conversationId,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
});
test('A legacy notification link to a merged child resolves to the parent thread',async()=>{
  const x=setup({includeChildThread:true});
  const messages=await x.run({
    action:'list-messages',
    workspaceRole:'client',
    conversationId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  });
  assert.equal(messages.length,1);
  assert.equal(messages[0].conversation_id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  assert.equal(x.decryptContexts.at(-1).conversationId,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
});
test('A deleted project keeps its per-message reference and returns an unavailable card context',async()=>{
  const x=setup({includeDeletedPortfolioMessage:true});
  const messages=await x.run({action:'list-messages',workspaceRole:'client',conversationId:C});
  assert.equal(messages[0].project_id,'deleted-portfolio');
  assert.deepEqual({...messages[0].project_context},{
    id:'deleted-portfolio',
    project_kind:'portfolio',
    status:'unavailable',
    developer_name:'Developer workspace name',
    available:false
  });
  assert.equal(Object.hasOwn(messages[0].project_context,'title'),false);
});
test('A published portfolio message returns the minimal card fields and developer name',async()=>{
  const x=setup({includePortfolioMessage:true});
  const messages=await x.run({action:'list-messages',workspaceRole:'client',conversationId:C});
  assert.deepEqual({...messages[0].project_context},{
    id:'portfolio-project',
    project_kind:'portfolio',
    status:'published',
    title:'Developer portfolio',
    category:'Web application',
    price:'Rp 1.500.000',
    cover_image:'https://yxwktllqbmhustmhdaqi.supabase.co/storage/v1/object/public/project-media/example.png',
    developer_name:'Developer workspace name',
    available:true
  });
});
test('Both participants can see a published project card as available',async()=>{
  const x=setup({includePortfolioMessage:true,currentUserId:B});
  const messages=await x.run({action:'list-messages',workspaceRole:'dev',conversationId:C});
  assert.equal(messages[0].project_context.available,true);
  assert.equal(messages[0].project_context.title,'Developer portfolio');
});
test('A participant cannot expose their own portfolio as another sender context',async()=>{
  const x=setup({includePortfolioMessage:true,portfolioOwnerId:A});
  const messages=await x.run({action:'list-messages',workspaceRole:'client',conversationId:C});
  assert.equal(messages[0].project_context.available,false);
});
test('Closed request context exposes only the Request unavailable marker metadata',async()=>{
  const x=setup({includeChildThread:true,requestStatus:'closed'});
  const rows=await x.run({action:'list-conversations',workspaceRole:'dev'});
  assert.equal(rows[0].project_context.project_kind,'request');
  assert.equal(rows[0].project_context.available,false);
  assert.equal(Object.hasOwn(rows[0].project_context,'title'),false);
  assert.equal(Object.hasOwn(rows[0].project_context,'price'),false);
});
test('Conversation access still rejects a nonparticipant',()=>{
  const x=setup();
  assert.equal(x.context.userIsParticipant({participant_a_id:A,participant_b_id:B},A,'dev'),true);
  assert.equal(x.context.userIsParticipant({participant_a_id:A,participant_b_id:B},'33333333-3333-4333-8333-333333333333'),false);
});
test('Finding a direct conversation does not create a conversation',async()=>{
  const x=setup();
  const result=await x.run({action:'find-user',workspaceRole:'client',participantId:B});
  assert.equal(result,null);
  assert(!x.calls.some(c=>c.u.pathname.endsWith('/rpc/get_or_create_conversation')));
});
test('Finding an existing direct conversation returns the canonical row without creating',async()=>{
  const existing={id:C,participant_a_id:A,participant_b_id:B,participant_a_role:'client',participant_b_role:'dev',project_id:null,pair_key:`${A}:${B}`,merged_into:null};
  const x=setup({existingProjectConversation:existing});
  const result=await x.run({action:'find-user',workspaceRole:'client',participantId:B});
  assert.equal(result.id,C);
  assert.equal(result.source_conversations[0].id,C);
  assert(!x.calls.some(c=>c.u.pathname.endsWith('/rpc/get_or_create_conversation')));
});
test('A new direct conversation persists both workspace roles',async()=>{
  const x=setup();await x.run({action:'start-user',workspaceRole:'dev',participantId:B});
  const posted=x.calls.find(c=>c.u.pathname.endsWith('/rpc/get_or_create_conversation'));
  const args=JSON.parse(posted.options.body);
  assert.equal(posted.options.headers.Authorization,'Bearer test-token');
  assert.equal(args.p_user_role,'dev');assert.equal(args.p_peer_role,'client');
  assert.equal(args.p_peer_id,B);assert.equal(args.p_project_id,null);
  const lookup=x.calls.find(c=>c.u.pathname.endsWith('/conversations')&&!c.options.method);
  assert.equal(lookup.u.searchParams.get('pair_key'),`eq.${A}:${B}`);
  assert.equal(lookup.u.searchParams.get('merged_into'),'is.null');
});
test('Finding a project conversation does not create a conversation',async()=>{
  const x=setup();
  const result=await x.run({action:'find-project',workspaceRole:'client',projectId:'portfolio-project'});
  assert.equal(result,null);
  assert(!x.calls.some(c=>c.u.pathname.endsWith('/rpc/get_or_create_conversation')));
});
test('Finding an existing project conversation returns it without creating another',async()=>{
  const existing={id:C,participant_a_id:A,participant_b_id:B,participant_a_role:'client',participant_b_role:'dev',project_id:'portfolio-project'};
  const x=setup({existingProjectConversation:existing});
  const result=await x.run({action:'find-project',workspaceRole:'client',projectId:'portfolio-project'});
  assert.equal(result.id,C);
  assert.equal(result.project_id,'portfolio-project');
  assert(!x.calls.some(c=>c.u.pathname.endsWith('/rpc/get_or_create_conversation')));
});
test('Contacting a second project by the same developer finds the same pair conversation',async()=>{
  const existing={id:C,participant_a_id:A,participant_b_id:B,participant_a_role:'client',participant_b_role:'dev',project_id:'portfolio-project'};
  const x=setup({existingProjectConversation:existing});
  const result=await x.run({action:'find-project',workspaceRole:'client',projectId:'portfolio-project-2'});
  assert.equal(result.id,C);
  assert(!x.calls.some(c=>c.u.pathname.endsWith('/rpc/get_or_create_conversation')));
});
test('Starting a project conversation persists the project id and workspace roles',async()=>{
  const x=setup();
  await x.run({action:'start-project',workspaceRole:'client',projectId:'portfolio-project'});
  const posted=x.calls.find(c=>c.u.pathname.endsWith('/rpc/get_or_create_conversation'));
  const args=JSON.parse(posted.options.body);
  assert.equal(args.p_project_id,'portfolio-project');
  assert.equal(args.p_user_role,'client');
  assert.equal(args.p_peer_role,'dev');
});
test('Starting a request conversation requires a developer contacting the client owner',async()=>{
  const x=setup();
  await x.run({action:'start-project',workspaceRole:'dev',projectId:'request-project'});
  const posted=x.calls.find(c=>c.u.pathname.endsWith('/rpc/get_or_create_conversation'));
  const args=JSON.parse(posted.options.body);
  assert.equal(args.p_project_id,'request-project');
  assert.equal(args.p_user_role,'dev');
  assert.equal(args.p_peer_role,'client');
});
test('Messages started from a portfolio retain server-validated context on the encrypted message row',async()=>{
  const x=setup();
  await x.run({action:'send-message',workspaceRole:'client',conversationId:C,text:'First note',projectId:'portfolio-project'});
  const posted=x.calls.find(c=>c.u.pathname.endsWith('/messages')&&c.options.method==='POST');
  const row=JSON.parse(posted.options.body)[0];
  assert.equal(row.conversation_id,C);
  assert.equal(row.project_id,'portfolio-project');
  assert.equal(row.project_reference_id,'portfolio-project');
  assert.equal(row.project_kind,'portfolio');
});
test('Two messages in one conversation retain their own project references',async()=>{
  const x=setup();
  await x.run({action:'send-message',workspaceRole:'client',conversationId:C,text:'First project',projectId:'portfolio-project'});
  await x.run({action:'send-message',workspaceRole:'client',conversationId:C,text:'Second project',projectId:'portfolio-project-2'});
  const posted=x.calls.filter(c=>c.u.pathname.endsWith('/messages')&&c.options.method==='POST');
  const rows=posted.map(call=>JSON.parse(call.options.body)[0]);
  assert.deepEqual(rows.map(row=>row.project_id),['portfolio-project','portfolio-project-2']);
  assert.deepEqual(rows.map(row=>row.project_reference_id),['portfolio-project','portfolio-project-2']);
});
test('Developer messages store server-validated request context for the client owner',async()=>{
  const x=setup();
  await x.run({action:'send-message',workspaceRole:'dev',conversationId:C,text:'I can help',projectId:'request-project',projectKind:'portfolio'});
  const posted=x.calls.find(c=>c.u.pathname.endsWith('/messages')&&c.options.method==='POST');
  const row=JSON.parse(posted.options.body)[0];
  assert.equal(row.project_id,'request-project');
  assert.equal(row.project_kind,'request');
});
test('A sender cannot attach a request owned by themselves to a peer conversation',async()=>{
  const x=setup();
  await assert.rejects(
    x.run({action:'send-message',workspaceRole:'dev',conversationId:C,text:'I can help',projectId:'self-request'}),
    /project context is not available/
  );
  assert(!x.calls.some(c=>c.u.pathname.endsWith('/messages')&&c.options.method==='POST'));
});
test('Request message context rejects a closed request',async()=>{
  const x=setup();
  await assert.rejects(
    x.run({action:'send-message',workspaceRole:'dev',conversationId:C,text:'I can help',projectId:'closed-request'}),
    /project context is not available/
  );
  assert(!x.calls.some(c=>c.u.pathname.endsWith('/messages')&&c.options.method==='POST'));
});
test('Invalid roles are rejected instead of falling back to another inbox',async()=>{
  const x=setup();await assert.rejects(x.run({action:'list-conversations',workspaceRole:'admin'}),e=>e.status===400);
  assert.equal(x.calls.length,0);
});
