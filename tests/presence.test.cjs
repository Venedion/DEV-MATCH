const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/js/presence.js'),'utf8');
async function setup({visible=true,user={id:'account',email_confirmed_at:'today'},search='',sessionUser=user}={}){const calls=[],listeners={};let tick,role='client';const document={visibilityState:visible?'visible':'hidden',addEventListener:(n,f)=>listeners[n]=f};vm.runInNewContext(source,{document,location:{search},URLSearchParams,window:{devMatchBackend:{ready:Promise.resolve(user),getWorkspaceRole:async()=>role,client:{auth:{getSession:async()=>({data:{session:sessionUser?{user:sessionUser,access_token:'test-token'}:null}})},rpc:async(n,p)=>{calls.push({n,p});return {error:null}}}},addEventListener:(n,f)=>listeners[n]=f},setInterval:f=>{tick=f;return 1},clearInterval:()=>{tick=null},console});const flush=()=>new Promise(setImmediate);await flush();return{calls,document,listeners,flush,tick:()=>tick?.(),role:r=>role=r};}
test('Presence on non-chat pages never marks messages read and follows the selected mode',async()=>{const h=await setup();assert.equal(h.calls.length,1);assert.equal(h.calls[0].p.p_role,'client');assert.equal(h.calls[0].p.p_conversation,null);assert.equal(h.calls[0].p.p_read_at,null);h.role('dev');h.tick();await h.flush();assert.equal(h.calls[1].p.p_role,'dev');});
test('Hidden pages and anonymous visitors do not send heartbeats',async()=>{const h=await setup({visible:false});assert.equal(h.calls.length,0);h.document.visibilityState='visible';h.listeners.visibilitychange();await h.flush();assert.equal(h.calls.length,1);const a=await setup({user:null});assert.equal(a.calls.length,0);});
test('Page lifecycle stops and restores presence without duplicate timers',async()=>{const h=await setup();h.listeners.pagehide();h.tick();await h.flush();assert.equal(h.calls.length,1);h.listeners.pageshow();await h.flush();assert.equal(h.calls.length,2);});
test('Modal request iframe does not start a duplicate presence heartbeat',async()=>{const h=await setup({search:'?request=123&modal=1'});assert.equal(h.calls.length,0);assert.equal(h.tick(),undefined);assert.equal(Object.keys(h.listeners).length,0);});
test('An expired or different browser session cannot publish presence',async()=>{
  for (const sessionUser of [null,{id:'different-account'}]) {
    const h=await setup({sessionUser});
    assert.equal(h.calls.length,0);
  }
});
