const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Project reply context renders in a divided message bubble with a cancellable draft preview',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  const styles=fs.readFileSync('assets/css/chat.css','utf8');
  assert.match(chat,/message\.project_context\?\.available === true/);
  assert.match(chat,/chat-project-reply-divider/);
  assert.match(chat,/chat-client-reply-avatar/);
  assert.match(chat,/project\.project_kind === 'request'/);
  assert.match(chat,/project\.clientName/);
  assert.match(chat,/message\.project_context\?\.available === true[\s\S]*?renderProjectReplyContext\(/);
  assert.doesNotMatch(chat,/chatReplyContextBar/);
  assert.match(chat,/optimisticId/);
  assert.match(chat,/activateConversationDraft\(draft\)[\s\S]*?void \(async \(\) =>/);
  assert.match(chat,/data-cancel-project-reply/);
  assert.match(chat,/function cancelProjectReply\(\)/);
  assert.match(chat,/conversation\.sourceProject = null/);
  assert.match(chat,/const projectForMessage = draftProject[\s\S]*?conversation\.project/);
  assert.match(chat,/projectForMessage\.id === messageProjectId/);
  assert.match(chat,/message\.project_context = \{/);
  assert.doesNotMatch(chat,/renderMessageProjectCard/);
  assert.doesNotMatch(html,/chatDraftProjectCard/);
  assert.doesNotMatch(html,/chatReplyContextBar/);
  assert.match(styles,/\.chat-project-reply-context/);
  assert.match(styles,/\.chat-project-reply-divider/);
  assert.doesNotMatch(styles,/chat-reply-context-bar/);
  assert.doesNotMatch(styles,/chat-message-project-card|chat-draft-project-card/);
});

test('Request message contexts open the existing request-details popup, not project contexts or drafts',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  const styles=fs.readFileSync('assets/css/chat.css','utf8');
  const popup=fs.readFileSync('assets/js/project-detail-popup.js','utf8');
  assert.match(chat,/isRequest \|\| \(isPortfolio && allowProjectDetails\)/);
  assert.match(chat,/data-chat-request-detail="\$\{escapeHtml\(project\.id\)\}"/);
  assert.match(chat,/window\.openProjectRequestDetails\([\s\S]*?requestButton\.dataset\.chatRequestTitle/);
  assert.match(chat,/renderProjectReplyContext\(pendingProject, true\)/);
  assert.match(html,/assets\/css\/project-detail-popup\.css/);
  assert.match(html,/assets\/js\/project-detail-popup\.js/);
  assert.match(popup,/window\.openProjectRequestDetails=function/);
  assert.match(styles,/\.chat-project-reply-open:focus-visible/);
});

test('Project contexts open the existing project-details popup in both workspaces',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  assert.match(chat,/isPortfolio && allowProjectDetails/);
  assert.match(chat,/data-chat-project-detail="\$\{escapeHtml\(project\.id\)\}"/);
  assert.doesNotMatch(chat,/currentProfile\.account_role !== 'dev'/);
  assert.match(chat,/ensureProjectDetailsLoaded/);
  assert.match(chat,/assets\/css\/project-detail\.css/);
  assert.match(chat,/assets\/js\/project-detail\.js/);
  assert.match(chat,/window\.openProjectDetails\([\s\S]*?projectButton\.dataset\.chatProjectDetail/);
});

test('Virtual threads reuse the existing source conversation and retain their active selection',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const loadList=chat.slice(chat.indexOf('async function loadConversationList('),chat.indexOf('\n  function renderConversationsList'));
  const mapConversation=chat.slice(chat.indexOf('function mapConversation('),chat.indexOf('\n  function updateContactPresence'));
  const openExisting=chat.slice(chat.indexOf('async function openExistingOrDraft('),chat.indexOf('\n  async function openFromQuery'));
  const send=chat.slice(chat.indexOf('async function sendMessage('),chat.indexOf('\n  function formatFileSize'));
  assert.match(loadList,/conversation\.sourceConversationIds\.includes\(activeConvId\)/);
  assert.match(mapConversation,/sourceConversationIds\.includes\(item\.id\)/);
  assert.match(openExisting,/item\.sourceConversationIds\.includes\(row\.id\)/);
  assert.match(send,/item\.sourceConversationIds\.includes\(row\.id\)/);
  assert.match(send,/optimisticMessage\.conversation_id = conversation\.id/);
  assert.match(send,/pendingConversationDraft = null[\s\S]*?activeConvId = conversation\.id/);
});

test('Existing direct chat opens with its already-loaded messages without a second list-messages call',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const openExisting=chat.slice(chat.indexOf('async function openExistingOrDraft('),chat.indexOf('\n  async function openFromQuery'));
  const select=chat.slice(chat.indexOf('async function selectConversation('),chat.indexOf('\n  async function sendMessage'));
  assert.doesNotMatch(openExisting,/await loadConversationList\(\)/);
  assert.match(openExisting,/await selectConversation\(existing\.id, \{initialMessages: messages\}\)/);
  assert.match(select,/async function selectConversation\(id, \{focusReview = false, initialMessages = null\} = \{\}\)/);
  assert.match(select,/Array\.isArray\(initialMessages\)[\s\S]*?conversation\.messages = initialMessages/);
  assert.match(select,/if \(Array\.isArray\(initialMessages\)\)[\s\S]*?renderMessagesThread\(\)[\s\S]*?scrollThreadToBottom\(\)[\s\S]*?else/);
});

test('Project chat opening has a dedicated endpoint with legacy find-project fallback',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const api=fs.readFileSync('supabase/functions/chat-api/index.ts','utf8');
  assert.match(chat,/invokeChat\('open-project-chat', \{projectId: project\.id\}\)/);
  assert.match(chat,/invokeChat\('find-project', \{projectId: project\.id\}\)/);
  assert.match(chat,/Open-project chat endpoint unavailable; using legacy lookup/);
  assert.match(api,/body\.action === 'open-project-chat'/);
  assert.match(api,/body\.action === 'find-project' \|\| body\.action === 'open-project-chat/);
});

test('Initial message loading uses a 75-message limit, cursor pagination, and deferred read marking',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const api=fs.readFileSync('supabase/functions/chat-api/index.ts','utf8');
  assert.match(api,/const INITIAL_MESSAGE_ROWS = 75/);
  assert.match(api,/body\.action === 'mark-messages-read'/);
  assert.match(api,/created_at: `lt\.\$\{body\.before\}`/);
  assert.match(chat,/limit: 75, markRead: false/);
  assert.match(chat,/before: oldestMessage\.created_at/);
  assert.match(chat,/async function markMessagesRead/);
  assert.match(chat,/activityTimer=setInterval\(\(\)=>void syncActivity\(\),30000\)/);
});

test('Sent message status appears below the bubble with read double checks',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const css=fs.readFileSync('assets/css/chat.css','utf8');
  assert.doesNotMatch(chat,/chat-msg-read-receipt/);
  assert.doesNotMatch(css,/chat-msg-read-receipt/);
  assert.match(chat,/chat-msg-meta/);
  assert.match(chat,/Read ✓✓/);
  assert.match(chat,/Sent ✓/);
  assert.match(chat,/chat-msg-checks/);
});

test('Message API only returns available project context owned by a participant with the expected role',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const api=fs.readFileSync('supabase/functions/chat-api/index.ts','utf8');
  assert.match(chat,/message\.project_context\?\.available === true/);
  assert.match(api,/attachMessageProjectContexts/);
  assert.match(api,/expectedOwnerRole === ownerRole/);
  assert.match(api,/project\.status === 'published'/);
  assert.match(api,/project\.status === 'open'/);
  assert.match(api,/client_name: project\.project_kind === 'request'/);
});

test('Realtime message refresh retains known project context for the same message',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const loadMessages=chat.slice(chat.indexOf('async function loadMessages('),chat.indexOf('\n  let activityTimer'));
  assert.match(loadMessages,/knownProjectContexts = new Map/);
  assert.match(loadMessages,/\.filter\(message => message\.project_context\?\.available === true\)/);
  assert.match(loadMessages,/knownProjectContexts\.get\(message\.id\)/);
  assert.match(loadMessages,/conversation\.lastMessage = conversation\.messages\[conversation\.messages\.length - 1\]/);
});

test('Project-linked chats hide project panels while retaining send metadata',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  assert.doesNotMatch(html,/id="viewProjectBtn"|id="activeProjectBanner"|id="projectEngagementPanel"/);
  const send=chat.slice(chat.indexOf('async function sendMessage('),chat.indexOf('\n  function formatFileSize'));
  assert.match(send,/const messageProjectId = conversation\.messageProjectId[\s\S]*?conversation\.projectId : null/);
  assert.match(send,/invokeChat\('start-project', \{projectId: conversation\.projectId\}\)/);
  assert.match(send,/invokeChat\('send-message', \{[\s\S]*?\.\.\.\(messageProjectId \? \{projectId: messageProjectId\} : \{\}\)/);
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

test('Chat composer keeps Propose project enabled and opens the proposal form without sending',()=>{
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const styles=fs.readFileSync('assets/css/chat.css','utf8');
  const api=fs.readFileSync('supabase/functions/chat-api/index.ts','utf8');
  assert.match(html,/id="chatComposerMenu"[^>]*hidden/);
  assert.match(html,/id="chatUploadFileAction"[^>]*>[\s\S]*?Upload file[\s\S]*?Images, documents, or zip files/);
  assert.match(html,/id="chatProjectTermsAction"[^>]*>[\s\S]*?Propose project[\s\S]*?Set price, scope, and delivery terms/);
  assert.match(html,/id="chatAttachBtn"[^>]*aria-expanded="false"[^>]*aria-controls="chatComposerMenu"/);
  assert.match(chat,/function setComposerMenuOpen\(open\)/);
  assert.match(chat,/uploadFileButtonEl\?\.addEventListener\('click',[\s\S]*?attachmentInputEl\?\.click\(\)/);
  assert.match(chat,/document\.addEventListener\('click',\s*event\s*=>[\s\S]*?composerMenuEl\.contains\(event\.target\)[\s\S]*?setComposerMenuOpen\(false\)/);
  assert.match(chat,/document\.addEventListener\('keydown',\s*event\s*=>[\s\S]*?event\.key !== 'Escape'[\s\S]*?setComposerMenuOpen\(false\)/);
  assert.doesNotMatch(html,/id="chatProjectTermsAction"[^>]*disabled/);
  assert.doesNotMatch(chat,/projectTermsButtonEl\.disabled\s*=/);
  assert.match(chat,/function openProposalForm\(\)[\s\S]*?if \(!proposalDialogEl \|\| !conversation\) return/);
  assert.match(chat,/const requestProject = project\?\.project_kind === 'request' \? project : null/);
  assert.match(chat,/const contextId = `\$\{conversation\.id \|\| 'draft'\}:\$\{project\?\.id \|\| 'none'\}:/);
  assert.match(chat,/requestData: projectKind === 'request'[\s\S]*?project\.data/);
  assert.match(chat,/requestData\.features[\s\S]*?slice\(0, 20\)/);
  assert.match(chat,/function updateProposalCalculations\(\)[\s\S]*?proposalDownPayment/);
  assert.match(chat,/function renderProposalScopeItems\(\)[\s\S]*?input\.maxLength = 300/);
  assert.match(chat,/proposalFormEl\?\.addEventListener\('submit', event => event\.preventDefault\(\)\)/);
  assert.match(html,/id="proposeProjectDialog"[\s\S]*?id="proposeProjectName"[\s\S]*?id="proposeProjectDescription"[\s\S]*?id="proposeProjectPrice"[\s\S]*?data-proposal-dp="25"[\s\S]*?id="proposeProjectDeadline"[\s\S]*?id="proposeProjectScopeList"[\s\S]*?id="proposeProjectRevisionCount"[\s\S]*?id="proposeProjectAttachments"/);
  assert.match(html,/id="proposeProjectScopeList"[\s\S]*?id="addProposalScopePoint"/);
  assert.match(html,/id="proposeProjectAttachments"[^>]*multiple/);
  assert.match(html,/class="chat-proposal-submit" disabled/);
  assert.match(styles,/\.chat-proposal-dialog\[open\]\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;[\s\S]*?margin:\s*auto;/);
  assert.match(styles,/\.chat-proposal-dialog::backdrop/);
  assert.match(styles,/\.chat-proposal-scope-list/);
  assert.match(styles,/\.chat-composer-menu\s*\{/);
  assert.match(styles,/\.chat-composer-btn\s*\{[\s\S]*?width:\s*48px;[\s\S]*?height:\s*48px/);
  assert.match(html,/application\/zip,application\/x-zip-compressed/);
  assert.match(chat,/application\/zip[\s\S]*application\/x-zip-compressed/);
  assert.match(api,/application\/zip[\s\S]*application\/x-zip-compressed/);
});
