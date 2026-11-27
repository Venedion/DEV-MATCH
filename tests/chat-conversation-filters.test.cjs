const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=(relativePath)=>fs.readFileSync(path.join(__dirname,'..',relativePath),'utf8');

test('Messages keeps only All and Unread conversation filters',()=>{
  const html=read('devmatch-chat.html');
  const chatJs=read('assets/js/chat.js');
  const filters=[...html.matchAll(/class="chat-filter-btn[^"]*"[^>]*data-filter="([^"]+)"/g)].map(([,filter])=>filter);

  assert.deepEqual(filters,['all','unread']);
  assert.match(chatJs,/if \(currentFilter === 'unread'\) filtered = filtered\.filter\(conversation => conversation\.unreadCount > 0\)/);
  assert.doesNotMatch(chatJs,/currentFilter === '(?:clients|devs)'/);
});
