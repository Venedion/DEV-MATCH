const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Messages render available project context inside the bubble and open its details modal',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  const styles=fs.readFileSync('assets/css/chat.css','utf8');
  assert.match(chat,/const projectCard = renderMessageProjectCard\(message\)/);
  assert.match(chat,/chat-msg-bubble has-project-context">\$\{projectCard\}/);
  assert.match(chat,/data-chat-project-detail="\$\{escapeHtml\(projectId\)\}"/);
  assert.match(chat,/window\.openProjectDetails\(projectId\)/);
  assert.match(html,/assets\/js\/project-detail\.js/);
  assert.match(html,/assets\/css\/project-detail\.css/);
  assert.match(html,/assets\/js\/project-detail-popup\.js/);
  assert.match(styles,/\.chat-msg-row\.sent \.chat-message-project-card/);
  assert.match(styles,/\.chat-message-project-card\s*\{[^}]*width: min\(280px, 100%\)/);
  assert.match(styles,/-webkit-line-clamp: 2/);
});

test('Unavailable project references remain non-clickable and omit their image',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const unavailableCard=chat.match(/if \(project\?\.available !== true\) \{([\s\S]*?)\n    \}/)?.[1] || '';
  assert.match(unavailableCard,/chat-message-project-card is-unavailable/);
  assert.match(unavailableCard,/Project unavailable/);
  assert.doesNotMatch(unavailableCard,/data-chat-project-detail|<img/);
});

test('Messages without project references retain their existing text bubble',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  assert.match(chat,/if \(!message\.project_id\) return ''/);
  assert.match(chat,/const textBubble = message\.text[\s\S]*?class="chat-msg-bubble"/);
  assert.match(chat,/const bubble = projectCard[\s\S]*?: textBubble/);
});

test('Sending attaches draft context, clears it only on success, and keeps it retryable on error',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const send=chat.slice(chat.indexOf('async function sendMessage('),chat.indexOf('\n  function formatFileSize'));
  const catchBlock=send.slice(send.indexOf('} catch (error) {'));
  const contextRemoval=chat.slice(chat.indexOf("draftProjectRemoveEl?.addEventListener('click'"),chat.indexOf("attachButtonEl?.addEventListener('click'"));
  assert.match(send,/const messageProjectId = conversation\.messageProjectId[\s\S]*?conversation\.projectId : null/);
  assert.match(send,/invokeChat\('start-project', \{projectId: conversation\.projectId\}\)/);
  assert.match(send,/invokeChat\('send-message', \{[\s\S]*?\.\.\.\(messageProjectId \? \{projectId: messageProjectId\} : \{\}\)/);
  assert.ok(send.indexOf('pendingConversationDraft = null') < send.indexOf('} catch (error) {'));
  assert.ok(send.indexOf('conversation.messageProjectId = null') < send.indexOf('} catch (error) {'));
  assert.match(catchBlock,/You can try again/);
  assert.doesNotMatch(catchBlock,/pendingConversationDraft = null|projectId = null|messageProjectId = null/);
  assert.match(contextRemoval,/conversation\.messageProjectId = null/);
  assert.match(contextRemoval,/conversation\.projectId = null/);
});

test('The existing message composer controls remain present around the optional context card',()=>{
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  assert.match(html,/<form class="chat-composer-form" id="chatComposerForm">[\s\S]*?id="chatAttachBtn"[\s\S]*?id="chatMessageInput"[\s\S]*?<button class="chat-send-btn" type="submit" aria-label="Send message">/);
  assert.match(html,/id="chatDraftProjectCard"[^>]*hidden/);
});
