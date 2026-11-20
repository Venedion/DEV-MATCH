const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('supabase/functions/chat-api/index.ts','utf8').replace(/import[\s\S]*?from '[^']+';/g,'');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const C='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', D='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CHILD='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PROJECT_ROOT='77777777-7777-4777-8777-777777777777';
const projectPairKey=(userRole,projectId=null)=>{
  const peerRole=userRole==='client'?'dev':'client';
  const projectKey=projectId==null?'0:':`${Array.from(projectId).length}:${projectId}`;
  return `${A}:${userRole}:${B}:${peerRole}:${projectKey}`;
};
function setup({existingProjectConversation=null,includeChildThread=false,includeDuplicateProjectRoot=false,includeDeveloperMessage=false,includeDeletedPortfolioMessage=false,includePortfolioMessage=false,requestStatus='open',currentUserId=A,portfolioOwnerId=B}={}){
  const calls=[];
  const conversation={id:C,participant_a_id:A,participant_b_id:B,participant_a_role:'client',participant_b_role:'dev',project_id:null,pair_key:`${A}:${B}`,workspace_pair_key:projectPairKey('client'),merged_into:null,created_at:'2026-01-02T03:00:00.000Z',is_primary:false,messages:[]};
  const developerConversation={id:D,participant_a_id:A,participant_b_id:B,participant_a_role:'dev',participant_b_role:'client',project_id:null,pair_key:`${A}:${B}`,workspace_pair_key:projectPairKey('dev'),merged_into:null,created_at:'2026-01-02T03:00:00.000Z',is_primary:false,messages:[]};
  const childId=CHILD;
  const childMessage={id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',conversation_id:childId,sender_id:B,ciphertext:'old child message',nonce:'1234567890123456',key_version:1,created_at:'2026-01-02T03:04:05.000Z',read_at:null,project_id:'request-project',project_reference_id:'request-project',project_kind:'request'};
  const developerMessage={id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',conversation_id:D,sender_id:B,ciphertext:'developer workspace message',nonce:'1234567890123456',key_version:1,created_at:'2026-01-02T03:05:05.000Z',read_at:null};
  if(includeDeveloperMessage)developerConversation.messages=[developerMessage];
  const deletedPortfolioMessage={id:'ffffffff-ffff-4fff-8fff-ffffffffffff',conversation_id:C,sender_id:A,ciphertext:'old portfolio reference',nonce:'1234567890123456',key_version:1,created_at:'2026-01-02T03:06:05.000Z',read_at:null,project_id:null,project_reference_id:'deleted-portfolio',project_kind:'portfolio'};
  const portfolioMessage={id:'99999999-9999-4999-8999-999999999999',conversation_id:C,sender_id:A,ciphertext:'portfolio reference',nonce:'1234567890123456',key_version:1,created_at:'2026-01-02T03:07:05.000Z',read_at:null,project_id:'portfolio-project',project_reference_id:'portfolio-project',project_kind:'portfolio'};
  const rootMessage={id:'66666666-6666-4666-8666-666666666666',conversation_id:C,sender_id:A,ciphertext:'older untagged root message',nonce:'1234567890123456',key_version:1,created_at:'2026-01-02T03:06:00.000Z',read_at:null};
  const duplicateRootMessage={id:'88888888-8888-4888-8888-888888888888',conversation_id:PROJECT_ROOT,sender_id:B,ciphertext:'newer project root message',nonce:'1234567890123456',key_version:1,created_at:'2026-01-02T03:08:00.000Z',read_at:null};
  const projectConversation={...conversation,id:PROJECT_ROOT,project_id:'portfolio-project',workspace_pair_key:projectPairKey('client','portfolio-project'),created_at:'2026-01-02T03:01:00.000Z',is_primary:false,messages:[]};
  if(includeDuplicateProjectRoot){
    conversation.created_at='2026-01-02T03:02:00.000Z';
    conversation.is_primary=true;
    conversation.messages=[rootMessage];
    projectConversation.messages=[duplicateRootMessage];
  }
  const childConversation={id:childId,participant_a_id:A,participant_b_id:B,participant_a_role:'client',participant_b_role:'dev',project_id:null,pair_key:`${A}:${B}`,workspace_pair_key:projectPairKey('client'),merged_into:C,messages:[childMessage]};
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
      rows=[{...conversation,participant_a_role:args.p_user_role,participant_b_role:args.p_peer_role,project_id:args.p_project_id}];
    }
    if(u.pathname.endsWith('/conversations')){
      if(u.searchParams.has('id'))rows=[conversation,developerConversation,...(includeChildThread?[childConversation]:[]),...(includeDuplicateProjectRoot?[projectConversation]:[])].filter(row=>
        row.id===u.searchParams.get('id').replace(/^eq\./,'')
        && (!u.searchParams.has('workspace_pair_key')||row.workspace_pair_key===u.searchParams.get('workspace_pair_key').replace(/^eq\./,'')));
      else if(u.searchParams.has('workspace_pair_key'))rows=existingProjectConversation
        && existingProjectConversation.workspace_pair_key===u.searchParams.get('workspace_pair_key').replace(/^eq\./,'')
        ?[existingProjectConversation]:[];
      else if(u.searchParams.has('merged_into')){
        const filter=u.searchParams.get('merged_into');
        if(filter==='is.null'){
          const role=u.searchParams.get('or')?.includes('participant_a_role.eq.dev')?'dev':'client';
          rows=[conversation,developerConversation,...(includeDuplicateProjectRoot?[projectConversation]:[])].filter(row=>
            (row.participant_a_id===A&&row.participant_a_role===role)
            ||(row.participant_b_id===A&&row.participant_b_role===role));
        }else rows=includeChildThread&&filter.includes(C)?[childConversation]:[];
      }
    }
    if(u.pathname.endsWith('/messages')){
      if(options.method==='PATCH')rows=[];
      else if(options.method==='POST')rows=[{...JSON.parse(options.body)[0],id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',created_at:'2026-01-03T03:04:05.000Z',read_at:null}];
      else rows=includeDuplicateProjectRoot
        ?[rootMessage,duplicateRootMessage]
        :includeDeletedPortfolioMessage
        ?[deletedPortfolioMessage]
        :includePortfolioMessage
          ?[portfolioMessage]
          :includeChildThread
            ?[childMessage]
            :includeDeveloperMessage
              ?[developerMessage]
            :[];
    }
    return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
  }};
  vm.runInNewContext(source,context);
  return {calls,context,decryptContexts,run:body=>context.handleAction(body,{id:currentUserId},{keys:new Map([[1,new Uint8Array(32)]]),activeVersion:1},'https://test.invalid','test-key','Bearer test-token')};
}
test('Inbox query filters the participant role for the selected workspace',async()=>{
  const x=setup({includeDeveloperMessage:true});const rows=await x.run({action:'list-conversations',workspaceRole:'dev'});
  const q=x.calls.find(c=>c.u.pathname.endsWith('/conversations')).u.searchParams.get('or');
  assert.equal(q,`(and(participant_a_id.eq.${A},participant_a_role.eq.dev),and(participant_b_id.eq.${A},participant_b_role.eq.dev))`);
  assert.equal(x.calls.find(c=>c.u.pathname.endsWith('/conversations')).u.searchParams.get('merged_into'),'is.null');
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,D);
  assert.equal(rows[0].contact.account_role,'client');
});
test('Messages cannot be read from a conversation belonging to another workspace',async()=>{
  const x=setup();
  await assert.rejects(
    x.run({action:'list-messages',workspaceRole:'dev',conversationId:C}),
    error=>error.status===404
  );
  assert(!x.calls.some(c=>c.u.pathname.endsWith('/messages')));
});
test('Virtual threads return child messages using their original conversation encryption context',async()=>{
  const x=setup({includeChildThread:true});
  const rows=await x.run({action:'list-conversations',workspaceRole:'client'});
  assert.equal(rows.length,1);
  assert.deepEqual(Array.from(rows[0].source_conversations,source=>source.id),[C,CHILD]);
  assert.equal(rows[0].last_message.text,'old child message');
  assert.equal(rows[0].project_context,null);
  assert.equal(Object.hasOwn(rows[0].last_message,'project_id'),false);
  assert.equal(x.decryptContexts[0].conversationId,CHILD);
  const messages=await x.run({action:'list-messages',workspaceRole:'client',conversationId:C});
  assert.equal(messages.length,1);
  assert.equal(messages[0].conversation_id,CHILD);
  assert.equal(x.decryptContexts.at(-1).conversationId,CHILD);
});
test('Duplicate project roots for one workspace pair produce one item and preserve source messages',async()=>{
  const x=setup({includeDuplicateProjectRoot:true});
  const rows=await x.run({action:'list-conversations',workspaceRole:'client'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,C);
  assert.deepEqual(Array.from(rows[0].source_conversations,source=>source.id),[C,PROJECT_ROOT]);
  assert.equal(rows[0].last_message.text,'newer project root message');
  assert.equal(rows[0].last_message_at,'2026-01-02T03:08:00.000Z');
  assert.equal(rows[0].project_id,'portfolio-project');
  assert.equal(rows[0].project_context.id,'portfolio-project');
  assert.equal(Object.hasOwn(rows[0],'created_at'),false);
  assert.equal(Object.hasOwn(rows[0],'is_primary'),false);

  const messages=await x.run({action:'list-messages',workspaceRole:'client',conversationId:C});
  assert.deepEqual(
    Array.from(messages,message=>message.text).sort(),
    ['newer project root message','older untagged root message'].sort()
  );
  const messageQuery=x.calls.filter(c=>c.u.pathname.endsWith('/messages')&&c.options.method!=='PATCH').at(-1);
  const sourceFilter=messageQuery.u.searchParams.get('conversation_id');
  assert(sourceFilter.includes(C));
  assert(sourceFilter.includes(PROJECT_ROOT));
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
test('List messages do not expose per-message project card context',async()=>{
  const x=setup({includeDeletedPortfolioMessage:true});
  const messages=await x.run({action:'list-messages',workspaceRole:'client',conversationId:C});
  assert.equal(Object.hasOwn(messages[0],'project_id'),false);
  assert.equal(Object.hasOwn(messages[0],'project_context'),false);
});
test('A request linked only at message level is not exposed as thread project context',async()=>{
  const x=setup({includeChildThread:true,requestStatus:'closed'});
  const rows=await x.run({action:'list-conversations',workspaceRole:'client'});
  assert.equal(rows[0].project_context,null);
});
test('Conversation access still rejects a nonparticipant',()=>{
  const x=setup();
  assert.equal(x.context.userIsParticipant({participant_a_id:A,participant_b_id:B,participant_a_role:'client'},A,'client'),true);
  assert.equal(x.context.userIsParticipant({participant_a_id:A,participant_b_id:B,participant_a_role:'client'},A,'dev'),false);
  assert.equal(x.context.userIsParticipant({participant_a_id:A,participant_b_id:B,participant_a_role:'client'},'33333333-3333-4333-8333-333333333333','client'),false);
});
test('Workspace pair key is independent of which participant starts the conversation',()=>{
  const x=setup();
  assert.equal(x.context.workspacePairKey(B,'dev',A,'client'),projectPairKey('client'));
});
test('Finding a direct conversation does not create a conversation',async()=>{
  const x=setup();
  const result=await x.run({action:'find-user',workspaceRole:'client',participantId:B});
  assert.equal(result,null);
  assert(!x.calls.some(c=>c.u.pathname.endsWith('/rpc/get_or_create_conversation')));
});
test('Finding an existing direct conversation returns the canonical row without creating',async()=>{
  const existing={id:C,participant_a_id:A,participant_b_id:B,participant_a_role:'client',participant_b_role:'dev',project_id:null,pair_key:`${A}:${B}`,workspace_pair_key:projectPairKey('client'),merged_into:null};
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
  assert.equal(lookup.u.searchParams.get('workspace_pair_key'),`eq.${projectPairKey('dev')}`);
  assert.equal(lookup.u.searchParams.get('merged_into'),'is.null');
});
test('Finding a project conversation does not create a conversation',async()=>{
  const x=setup();
  const result=await x.run({action:'find-project',workspaceRole:'client',projectId:'portfolio-project'});
  assert.equal(result,null);
  assert(!x.calls.some(c=>c.u.pathname.endsWith('/rpc/get_or_create_conversation')));
});
test('Finding an existing project conversation returns it without creating another',async()=>{
  const existing={id:C,participant_a_id:A,participant_b_id:B,participant_a_role:'client',participant_b_role:'dev',project_id:'portfolio-project',workspace_pair_key:projectPairKey('client','portfolio-project')};
  const x=setup({existingProjectConversation:existing});
  const result=await x.run({action:'find-project',workspaceRole:'client',projectId:'portfolio-project'});
  assert.equal(result.id,C);
  assert.equal(result.project_id,'portfolio-project');
  assert(!x.calls.some(c=>c.u.pathname.endsWith('/rpc/get_or_create_conversation')));
});
test('A project conversation is not reused for a different project',async()=>{
  const existing={id:C,participant_a_id:A,participant_b_id:B,participant_a_role:'client',participant_b_role:'dev',project_id:'portfolio-project',workspace_pair_key:projectPairKey('client','portfolio-project')};
  const x=setup({existingProjectConversation:existing});
  const result=await x.run({action:'find-project',workspaceRole:'client',projectId:'portfolio-project-2'});
  assert.equal(result,null);
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
  await x.run({action:'send-message',workspaceRole:'dev',conversationId:D,text:'I can help',projectId:'request-project',projectKind:'portfolio'});
  const posted=x.calls.find(c=>c.u.pathname.endsWith('/messages')&&c.options.method==='POST');
  const row=JSON.parse(posted.options.body)[0];
  assert.equal(row.project_id,'request-project');
  assert.equal(row.project_kind,'request');
});
test('A sender cannot attach a request owned by themselves to a peer conversation',async()=>{
  const x=setup();
  await assert.rejects(
    x.run({action:'send-message',workspaceRole:'dev',conversationId:D,text:'I can help',projectId:'self-request'}),
    /project context is not available/
  );
  assert(!x.calls.some(c=>c.u.pathname.endsWith('/messages')&&c.options.method==='POST'));
});
test('Request message context rejects a closed request',async()=>{
  const x=setup();
  await assert.rejects(
    x.run({action:'send-message',workspaceRole:'dev',conversationId:D,text:'I can help',projectId:'closed-request'}),
    /project context is not available/
  );
  assert(!x.calls.some(c=>c.u.pathname.endsWith('/messages')&&c.options.method==='POST'));
});
test('Invalid roles are rejected instead of falling back to another inbox',async()=>{
  const x=setup();await assert.rejects(x.run({action:'list-conversations',workspaceRole:'admin'}),e=>e.status===400);
  assert.equal(x.calls.length,0);
});
