const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/chat-api/index.ts','utf8')).replace(/import[\s\S]*?from '[^']+';/g,'');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const C='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function setup(){
  const calls=[];
  const conversation={id:C,participant_a_id:A,participant_b_id:B,participant_a_role:'client',participant_b_role:'dev',project_id:null,messages:[
    {id:A,conversation_id:C,sender_id:B,key_version:1,created_at:'2026-11-21T00:00:00Z'}
  ]};
  const context={URL,URLSearchParams,Response,console,Deno:{serve(){}},
    decryptMessage:async()=> 'Test message',sanitizeMessageText:text=>text,fetch:async(url,options={})=>{
    const u=new URL(url);calls.push({u,options});let rows=[];
    if(u.pathname.endsWith('/profiles'))rows=u.searchParams.get('id')?.startsWith('in.')
      ? [{id:B,username:'real_username',display_name:'Primary client name',account_role:'client'}]
      : [{id:A,account_role:'client',onboarding_complete:true}];
    if(u.pathname.endsWith('/account_workspaces'))rows=u.searchParams.get('user_id')?.startsWith('in.')
      ? [{user_id:B,role:'dev',display_name:'Developer profile'}]
      : [{user_id:A,role:'dev',onboarding_complete:true}];
    if(u.pathname.endsWith('/directory_people'))rows=[{id:B,account_role:'client'}];
    if(u.pathname.endsWith('/get_or_create_conversation'))rows=[{...conversation,id:C}];
    if(u.pathname.endsWith('/conversations')){
      if(u.searchParams.has('or')||u.searchParams.has('id'))rows=[conversation];
    }
    return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
  }};
  vm.runInNewContext(source,context);
  const keyring={keys:new Map([[1,new Uint8Array(32)]])};
  return {calls,context,run:body=>context.handleAction(body,{id:A},keyring,'https://test.invalid','test-key','Bearer qa-token')};
}
test('Inbox query scopes both participants by the selected workspace',async()=>{
  const x=setup();const rows=await x.run({action:'list-conversations',workspaceRole:'client'});
  const q=x.calls.find(c=>c.u.pathname.endsWith('/conversations')).u.searchParams.get('or');
  assert.equal(q,`(and(participant_a_id.eq.${A},participant_a_role.eq.client),and(participant_b_id.eq.${A},participant_b_role.eq.client))`);
  assert.equal(rows[0].contact.username,'real_username');
  assert.equal(rows[0].contact.account_role,'dev');
  assert.equal(rows[0].contact.display_name,'Developer profile');
});
for(const action of ['list-messages','send-message','download-attachment']){
  test(`${action} rejects a conversation belonging to the other workspace`,async()=>{
    const x=setup();await assert.rejects(x.run({action,workspaceRole:'dev',conversationId:C}),e=>e.status===404);
    assert(!x.calls.some(c=>c.u.pathname.endsWith('/messages')));
  });
}
test('A new direct conversation persists both workspace roles',async()=>{
  const x=setup();await x.run({action:'start-user',workspaceRole:'dev',participantId:B});
  const posted=x.calls.find(c=>c.options.method==='POST');
  assert(posted.u.pathname.endsWith('/get_or_create_conversation'));
  const row=JSON.parse(posted.options.body);
  assert.equal(row.p_user_role,'dev');assert.equal(row.p_peer_role,'client');
  const lookup=x.calls.find(c=>c.u.pathname.endsWith('/conversations')&&!c.options.method);
  assert.match(lookup.u.searchParams.get('workspace_pair_key'),/:dev/);
});
test('Invalid roles are rejected instead of falling back to another inbox',async()=>{
  const x=setup();await assert.rejects(x.run({action:'list-conversations',workspaceRole:'admin'}),e=>e.status===400);
  assert.equal(x.calls.length,0);
});
