const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Messages retain plain text bubbles without rendering project context cards',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  const styles=fs.readFileSync('assets/css/chat.css','utf8');
  assert.match(chat,/const bubble = message\.text[\s\S]*?class="chat-msg-bubble"/);
  assert.doesNotMatch(chat,/renderMessageProjectCard|data-chat-project-detail/);
  assert.doesNotMatch(html,/chatDraftProjectCard|project-detail-popup\.js/);
  assert.doesNotMatch(styles,/chat-message-project-card|chat-draft-project-card/);
});

test('Message API responses no longer attach per-message project card details',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const api=fs.readFileSync('supabase/functions/chat-api/index.ts','utf8');
  assert.doesNotMatch(chat,/message\.project_context/);
  assert.doesNotMatch(api,/attachMessageProjectContexts|project_context: isAvailable/);
});

test('Client mode keeps the shared project banner and engagement panel markup',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  const initialize=chat.slice(chat.indexOf('async function initialize('),chat.indexOf('\n  initialize().catch'));
  assert.match(html,/id="activeProjectBanner"/);
  assert.match(html,/id="projectEngagementPanel"/);
  const refresh=chat.slice(chat.indexOf('async function refreshProjectEngagement('),chat.indexOf('\n  function scrollThreadToBottom'));
  assert.doesNotMatch(initialize,/activeProjectBanner\?\.remove|projectEngagementPanel\?\.remove/);
  assert.doesNotMatch(refresh,/account_role === 'client'\) return/);
});

test('Sending preserves Home project metadata and keeps failed messages retryable',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const send=chat.slice(chat.indexOf('async function sendMessage('),chat.indexOf('\n  function formatFileSize'));
  const catchBlock=send.slice(send.indexOf('} catch (error) {'));
  assert.match(send,/const messageProjectId = conversation\.messageProjectId[\s\S]*?conversation\.projectId : null/);
  assert.match(send,/invokeChat\('start-project', \{projectId: conversation\.projectId\}\)/);
  assert.match(send,/invokeChat\('send-message', \{[\s\S]*?\.\.\.\(messageProjectId \? \{projectId: messageProjectId\} : \{\}\)/);
  assert.ok(send.indexOf('pendingConversationDraft = null') < send.indexOf('} catch (error) {'));
  assert.ok(send.indexOf('conversation.messageProjectId = null') < send.indexOf('} catch (error) {'));
  assert.match(catchBlock,/You can try again/);
  assert.doesNotMatch(catchBlock,/pendingConversationDraft = null|projectId = null|messageProjectId = null/);
});

test('The existing message composer controls remain without a project context card',()=>{
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  assert.match(html,/<form class="chat-composer-form" id="chatComposerForm">[\s\S]*?id="chatAttachBtn"[\s\S]*?id="chatMessageInput"[\s\S]*?<button class="chat-send-btn" type="submit" aria-label="Send message">/);
  assert.doesNotMatch(html,/chatDraftProjectCard|chatDraftProjectNote/);
});
