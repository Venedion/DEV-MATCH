const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

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

test('Chat composer sends a proposal and renders role-specific proposal cards',()=>{
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const styles=fs.readFileSync('assets/css/chat.css','utf8');
  const api=fs.readFileSync('supabase/functions/chat-api/index.ts','utf8');
  const migration=fs.readFileSync('supabase/migrations/202611240001_project_proposals.sql','utf8');
  const proposalMigration=fs.readFileSync('supabase/migrations/202611260004_client_project_proposals.sql','utf8');
  const paymentMigration=fs.readFileSync('supabase/migrations/202611260001_proposal_agreement_payments.sql','utf8');
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
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
  assert.match(chat,/workspaceRole === 'dev' \|\| workspaceRole === 'client'/);
  assert.match(chat,/proposal\.creator_id \|\| proposal\.developer_id/);
  assert.match(chat,/const requestProject = project\?\.project_kind === 'request' \? project : null/);
  assert.match(chat,/const contextId = `\$\{conversation\.id \|\| 'draft'\}:\$\{project\?\.id \|\| 'none'\}:/);
  assert.match(chat,/requestData: projectKind === 'request'[\s\S]*?project\.data/);
  assert.match(chat,/requestData\.features[\s\S]*?slice\(0, 20\)/);
  assert.match(chat,/function updateProposalCalculations\(\)[\s\S]*?proposalDownPayment/);
  assert.match(chat,/function renderProposalScopeItems\(\)[\s\S]*?input\.maxLength = 300/);
  assert.match(chat,/proposalFormEl\?\.addEventListener\('submit', event => void submitProjectProposal\(event\)\)/);
  assert.match(chat,/invokeChat\('create-project-proposal'[\s\S]*?terms:[\s\S]*?attachments/);
  assert.match(chat,/function renderProjectProposalCard\(proposal, preview = null\)/);
  assert.match(chat,/chat-proposal-status is-\$\{tone\}/);
  assert.match(styles,/\.chat-proposal-status\.is-pending\s*\{[\s\S]*?background:\s*#fff3d8;[\s\S]*?color:\s*#8b5c00;/);
  assert.match(chat,/const awaitingDp = isAccepted && project === 'NOT_STARTED' && escrow === 'AWAITING_DP'/);
  assert.match(chat,/chat-proposal-step-track/);
  assert.match(chat,/Waiting for developer's progress/);
  assert.match(chat,/<footer class="\$\{hasPrimaryAction \? 'has-primary' : ''\}\$\{actions\.length === 2 \? ' is-two-actions' : ''\}"/);
  assert.match(chat,/data-proposal-accept/);
  assert.match(chat,/data-proposal-ask-changes/);
  assert.match(chat,/data-proposal-withdraw/);
  assert.match(chat,/function askForProposalChanges\(proposalId\)[\s\S]*?I'd like to discuss some changes/);
  assert.match(chat,/function openProposalDetails\(proposal, \{showDialog = true\} = \{\}\)/);
  assert.match(chat,/data-proposal-payments/);
  assert.match(chat,/button\('Project payments',/);
  assert.match(chat,/Retry remaining payment/);
  assert.match(chat,/devmatch:agreement-payment-status[\s\S]*?redrawProposalCard\(proposal\)/);
  assert.match(chat,/data-proposal-payment-action="\$\{value\}"/);
  assert.match(api,/select: 'id,agreement_id,midtrans_order_id,status,expires_at,created_at'[\s\S]*?kind: 'eq\.dp'[\s\S]*?order: 'created_at\.desc'/);
  assert.match(api,/dp_payment_status: dpPayment\?\.status \?\? payments\.findLast/);
  assert.match(chat,/proposalPaymentsButton && scope\.contains\(proposalPaymentsButton\)\)[\s\S]*?event\.preventDefault\(\);\s*event\.stopPropagation\(\);/);
  assert.match(chat,/openAgreement\(\{/);
  assert.match(chat,/dataset\.proposalPaymentAction \|\| null/);
  assert.match(payment,/function openAgreement\(agreement, \{action = null, operation = 'snapshot'\} = \{\}\)/);
  assert.match(payment,/if \(initialAction && dialog\.open\)/);
  const paymentScript=fs.readFileSync('assets/js/chat-payment.js','utf8');
  assert.match(paymentScript,/function isAgreementContext\(\)[\s\S]*?JSON\.parse\(roomKey\)\?\.agreementId/);
  assert.match(paymentScript,/function closeOtherDialogs\(\)[\s\S]*?document\.querySelectorAll\('dialog\[open\]'\)[\s\S]*?openDialog\.close\(\)/);
  assert.match(paymentScript,/room && \(room\.timelineVersion === 2 \|\| room\.proposal\?\.agreementId \|\| isAgreementContext\(\)\)/);
  assert.match(paymentScript,/agreementCreatedAt: proposal\.createdAt \|\| null/);
  assert.match(chat,/chat-proposal-details-status/);
  assert.match(chat,/Compared with your request/);
  assert.match(chat,/data-proposal-details-action/);
  assert.match(chat,/totalPrice < 40000 \|\| totalPrice > 1000000000/);
  assert.doesNotMatch(chat,/DP payment will be available later/);
  assert.match(html,/id="proposeProjectDialog"[\s\S]*?id="proposeProjectName"[\s\S]*?id="proposeProjectDescription"[\s\S]*?id="proposeProjectPrice"[\s\S]*?data-proposal-dp="25"[\s\S]*?id="proposeProjectDeadline"[\s\S]*?id="proposeProjectScopeList"[\s\S]*?id="proposeProjectRevisionCount"[\s\S]*?id="proposeProjectAttachments"/);
  assert.match(html,/Rp40,000–Rp1,000,000,000/);
  assert.match(html,/id="proposeProjectScopeList"[\s\S]*?id="addProposalScopePoint"/);
  assert.match(html,/id="proposeProjectAttachments"[^>]*multiple/);
  assert.match(html,/id="projectProposalDetailsDialog"/);
  assert.match(html,/id="projectProposalDetailsStatus"/);
  assert.match(html,/id="projectProposalDetailsAccept"[^>]*hidden/);
  assert.match(html,/id="projectProposalDetailsAskChanges"[^>]*hidden/);
  assert.match(html,/class="chat-proposal-submit">Send proposal/);
  assert.match(styles,/\.chat-proposal-dialog\[open\]\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;[\s\S]*?margin:\s*auto;/);
  assert.match(styles,/\.chat-proposal-dialog::backdrop/);
  assert.match(styles,/\.chat-proposal-scope-list/);
  assert.match(styles,/\.chat-project-proposal-card/);
  assert.match(styles,/footer\.is-two-actions button,[\s\S]*?footer\.is-two-actions a\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1;/);
  assert.match(styles,/\.chat-proposal-details-dialog/);
  assert.match(styles,/\.chat-proposal-details-status\.is-accepted/);
  assert.match(styles,/\.chat-proposal-details-actions/);
  assert.match(api,/body\.action === 'create-project-proposal'/);
  assert.match(api,/if \(!\['dev', 'client'\]\.includes\(workspaceRole\)\)/);
  assert.match(api,/const creatorRole = proposal\.creator_id === proposal\.developer_id \? 'dev' : 'client'/);
  assert.match(api,/creator_id: row\.creator_id \|\| row\.developer_id/);
  assert.match(api,/body\.action === 'accept-project-proposal' \|\| body\.action === 'withdraw-project-proposal'/);
  assert.match(api,/body\.action === 'download-project-proposal-attachment'/);
  assert.match(api,/encryptBinary\([\s\S]*?proposalId/);
  assert.match(api,/function attachProposalDetails\(/);
  assert.match(api,/payment_agreement_rooms/);
  assert.match(api,/escrow_status: paymentRoom\?\.escrow \|\| 'AWAITING_DP'/);
  assert.match(api,/project_status: paymentRoom\?\.project \|\| 'NOT_STARTED'/);
  assert.match(api,/paymentRoom\?\.progressReview\?\.status \|\| null/);
  assert.match(api,/final_proof_url: paymentRoom\?\.delivery\?\.links\?\.\[0\]/);
  assert.match(api,/handover_status: paymentRoom\?\.handover\?\.status/);
  assert.match(api,/totalPrice < 40000 \|\| totalPrice > 1000000000/);
  assert.match(migration,/create table public\.project_proposals/);
  assert.match(migration,/create table public\.project_agreements/);
  assert.match(migration,/create function public\.accept_project_proposal/);
  assert.match(migration,/Only the proposal recipient can accept it/);
  assert.match(proposalMigration,/Only a participant in a Client-Developer conversation can create a proposal/);
  assert.match(proposalMigration,/creator_id = developer_id/);
  assert.match(proposalMigration,/sender_id, ciphertext, nonce, key_version, proposal_id[\s\S]*?p_actor_id/);
  assert.match(migration,/grant execute on function public\.accept_project_proposal[\s\S]*?to service_role/);
  assert.match(paymentMigration,/create table public\.payment_agreement_rooms/);
  assert.match(paymentMigration,/create function public\.payment_agreement_context/);
  assert.match(paymentMigration,/create function public\.payment_agreement_save/);
  assert.match(payment,/openAgreement/);
  assert.match(payment,/paymentAgreement/);
  assert.doesNotMatch(payment,/function proposalForm\(\)/);
  assert.match(styles,/\.chat-composer-menu\s*\{/);
  assert.match(styles,/\.chat-composer-btn\s*\{[\s\S]*?width:\s*48px;[\s\S]*?height:\s*48px/);
  assert.match(html,/application\/zip,application\/x-zip-compressed/);
  assert.match(chat,/application\/zip[\s\S]*application\/x-zip-compressed/);
  assert.match(api,/application\/zip[\s\S]*application\/x-zip-compressed/);
});

test('Proposal creators can withdraw pending proposals from both the card and details popup',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  const cors=fs.readFileSync('supabase/functions/_shared/registration.mjs','utf8');
  assert.match(chat,/if \(isCreator\) \{\s*actions\.push\(wait[\s\S]*?button\('Withdraw proposal', ` data-proposal-withdraw=/);
  assert.match(chat,/setAction\('projectProposalDetailsWithdraw', 'withdraw', isPending && isCreator\)/);
  assert.match(chat,/action === 'withdraw'[\s\S]*?showProposalWithdrawConfirmation\(proposalId\)/);
  assert.doesNotMatch(chat,/window\.confirm\(/);
  assert.match(chat,/showProposalWithdrawConfirmation\(proposal\.id\)/);
  assert.match(chat,/changeProjectProposal\('withdraw-project-proposal', proposalId, confirmButton\)[\s\S]*?if \(updated\) \{[\s\S]*?proposalDetailsDialog\.close\(\)/);
  assert.match(chat,/proposalStatus === 'withdrawn'[\s\S]*?can no longer accept it/);
  assert.match(html,/id="projectProposalDetailsWithdraw"[^>]*hidden>Withdraw proposal/);
  assert.match(html,/id="projectProposalWithdrawConfirmation"[^>]*hidden/);
  assert.match(html,/role="alertdialog"[^>]*aria-labelledby="projectProposalWithdrawTitle"/);
  assert.match(html,/data-proposal-withdraw-confirm/);
  assert.match(html,/data-proposal-withdraw-cancel/);
  assert.match(cors,/allowedOrigins\.push\([^;]*'http:\/\/127\.0\.0\.1:8080'/);
});

test('Accepting a proposal from either view requires reviewing and confirming its terms',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  const styles=fs.readFileSync('assets/css/chat.css','utf8');
  const cardActionStart=chat.indexOf("const acceptProposalButton = event.target.closest('[data-proposal-accept]')");
  const cardActionEnd=chat.indexOf("const withdrawProposalButton =",cardActionStart);
  const cardAction=chat.slice(cardActionStart,cardActionEnd);
  assert.match(cardAction,/openProposalDetails\(proposal\)[\s\S]*?showProposalAcceptConfirmation\(proposal\.id\)/);
  assert.doesNotMatch(cardAction,/changeProjectProposal\('accept-project-proposal'/);
  assert.match(chat,/action === 'accept'[\s\S]*?showProposalAcceptConfirmation\(proposalId\)/);
  assert.match(chat,/function showProposalAcceptConfirmation\(proposalId\)[\s\S]*?projectProposalAcceptPrice[\s\S]*?projectProposalAcceptDpAmount[\s\S]*?projectProposalAcceptDeadline[\s\S]*?currentProfile\?\.account_role === 'client' \? 'You' : 'The Client'/);
  assert.match(chat,/data-proposal-accept-confirm[\s\S]*?changeProjectProposal\('accept-project-proposal', proposalId, confirmButton\)/);
  assert.match(html,/<dialog id="projectProposalAcceptConfirmation"[^>]*class="chat-proposal-accept-dialog"[\s\S]*?Accept this proposal\?[\s\S]*?Please check the details before you accept\.[\s\S]*?id="projectProposalAcceptPrice"[\s\S]*?id="projectProposalAcceptDpLabel"[\s\S]*?id="projectProposalAcceptDeadline"[\s\S]*?What happens next[\s\S]*?data-proposal-accept-cancel[\s\S]*?Yes, accept proposal/);
  assert.match(html,/role="alertdialog" aria-modal="true"/);
  assert.match(styles,/\.chat-proposal-accept-dialog\[open\]\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0/);
  assert.match(styles,/\.chat-proposal-accept-actions button\.is-primary/);
});

test('Proposal card preview renders all 36 role variants with inert actions',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const stagesStart=chat.indexOf('  const PROPOSAL_CARD_STAGES = [');
  const stagesEnd=chat.indexOf('  ];',stagesStart) + 4;
  const rendererStart=chat.indexOf('  function renderProjectProposalCard(',stagesEnd);
  const rendererEnd=chat.indexOf('  function isLocalProposalCardPreview(',rendererStart);
  assert.ok(stagesStart >= 0 && stagesEnd > stagesStart && rendererStart > stagesEnd && rendererEnd > rendererStart);

  const stageSource=chat.slice(stagesStart,stagesEnd);
  const rendererSource=chat.slice(rendererStart,rendererEnd);
  const profile={account_role:'dev'};
  const view=vm.runInNewContext(`${stageSource}\n${rendererSource}\n({
    stages: PROPOSAL_CARD_STAGES,
    render: renderProjectProposalCard,
    renderGallery: renderProposalCardStagePreview
  })`,{
    escapeHtml:value=>String(value??'').replace(/[&<>"']/g,character=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[character])),
    UUID_PATTERN:/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    currentUser:{id:'preview-developer'},
    currentProfile:profile,
    getActiveConversation:()=>({name:'Preview contact'}),
    formatProposalAmount:value=>`Rp ${Math.round(Number(value)||0).toLocaleString('id-ID')}`,
    formatProposalDeadline:()=> 'Dec 10, 2026'
  });
  const expectedActions={
    pending:{client:['Accept proposal','Ask for changes'],developer:['Withdraw proposal']},
    withdrawn:{client:[],developer:[]},
    'awaiting-dp':{client:['Pay DP · Rp 1.750.000'],developer:[]},
    'dp-failed':{client:['Retry DP · Rp 1.750.000'],developer:[]},
    'dp-paid':{client:[],developer:['Upload progress']},
    'progress-submitted':{client:['Review progress'],developer:[]},
    'update-requested':{client:[],developer:['Upload progress']},
    'progress-approved':{client:[],developer:['Submit final video']},
    'final-video-shared':{
      client:['Request revision (2 left)','Accept &amp; pay remaining'],
      developer:[]
    },
    'revision-requested':{client:[],developer:['Submit revised video']},
    'revised-video':{client:['Request revision (1 left)','Accept &amp; pay remaining'],developer:[]},
    'no-revisions':{client:['No revisions left','Accept &amp; pay remaining'],developer:[]},
    'remaining-failed':{client:['Retry remaining payment · Rp 5.250.000'],developer:[]},
    'remaining-paid':{client:[],developer:['Hand over system']},
    'system-handed-over':{
      client:['Accept result','Report a problem'],
      developer:[]
    },
    completed:{client:['Rate'],developer:['Rate']},
    'problem-reported':{client:[],developer:[]},
    rated:{client:[],developer:[]}
  };
  const proposal={
    id:'preview-proposal',
    developer_id:'preview-developer',
    status:'accepted',
    terms:{
      projectName:'Website redesign',
      totalPrice:7000000,
      dpPercent:25,
      dpAmount:1750000,
      deadline:'2026-12-10',
      revisionCount:2,
      scope:['Responsive website and handover']
    },
    agreement:{id:'preview-agreement'}
  };

  assert.equal(Array.from(view.stages).length,18);
  for(const stage of Array.from(view.stages)){
    for(const role of ['client','developer']){
      const html=view.render(proposal,{stageId:stage.id,role});
      const actions=Array.from(html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g),match=>
        match[1].replace(/<[^>]*>/g,'').trim());
      assert.deepEqual(actions,expectedActions[stage.id][role],`${role} ${stage.id} actions`);
      assert.match(html,new RegExp(`data-card-stage="${stage.id}"`));
      assert.match(html,new RegExp(`data-card-role="${role}"`));
      assert.doesNotMatch(html,/data-proposal-/);
      if(stage.id==='system-handed-over' && role==='client'){
        assert.match(html,/is-two-actions/);
      }
    }
  }
  assert.equal((view.renderGallery().match(/<article class="chat-project-proposal-card"/g)||[]).length,36);
  const liveProposal = {
    ...proposal,
    agreement: {
      id:'live-agreement',
      escrow_status:'DP_HELD',
      project_status:'IN_PROGRESS',
      dp_payment_status:'paid',
      progress_review_status:null
    }
  };
  assert.match(view.render(liveProposal),/data-proposal-progress="preview-proposal"/);
  liveProposal.agreement.progress_review_status='PENDING';
  const submittedCard=view.render(liveProposal);
  assert.doesNotMatch(submittedCard,/data-proposal-progress=/);
  assert.match(submittedCard,/Progress submitted/);

  profile.account_role='client';
  const awaitingDp=view.render({...proposal,agreement:{
    id:'live-agreement',escrow_status:'AWAITING_DP',project_status:'NOT_STARTED'
  }});
  assert.match(awaitingDp,/Pay DP/);
  assert.match(awaitingDp,/Pay DP · Rp 1\.750\.000/);
  assert.match(awaitingDp,/data-proposal-payment-action="DP"/);

  const pendingDp=view.render({...proposal,agreement:{
    id:'live-agreement',escrow_status:'AWAITING_DP',project_status:'NOT_STARTED',
    dp_payment_id:'123e4567-e89b-42d3-a456-426614174000',
    dp_order_id:'devmatch-dp-123e4567-e89b-42d3-a456-426614174000',
    dp_payment_status:'pending',dp_expires_at:'2026-11-27T12:00:00.000Z'
  }});
  assert.match(pendingDp,/data-dp-countdown/);
  assert.match(pendingDp,/data-dp-expires-at="2026-11-27T12:00:00\.000Z"/);
  assert.match(pendingDp,/Pay DP · Rp 1\.750\.000/);

  const failedDp=view.render({...proposal,agreement:{
    id:'live-agreement',escrow_status:'AWAITING_DP',project_status:'NOT_STARTED',
    dp_payment_status:'failed'
  }});
  assert.match(failedDp,/Retry DP/);
  assert.match(failedDp,/last payment failed or expired/);
  assert.doesNotMatch(failedDp,/data-dp-countdown/);

  const expiredDp=view.render({...proposal,agreement:{
    id:'live-agreement',escrow_status:'AWAITING_DP',project_status:'CANCELLED',
    cancellation_reason:'DP_EXPIRED',dp_payment_status:'expired'
  }});
  assert.match(expiredDp,/Agreement cancelled/);
  assert.match(expiredDp,/payment expired and this agreement was cancelled/);
  assert.doesNotMatch(expiredDp,/data-proposal-payment-action="DP"/);

  profile.account_role='dev';
  const developerAwaitingDp=view.render({...proposal,agreement:{
    id:'live-agreement',escrow_status:'AWAITING_DP',project_status:'NOT_STARTED',
    dp_payment_status:'pending'
  }});
  assert.match(developerAwaitingDp,/Waiting for .* to pay the DP/);

  const approved=view.render({...proposal,agreement:{
    id:'live-agreement',escrow_status:'DP_RELEASED',project_status:'IN_PROGRESS',
    progress_review_status:'APPROVED',progress_approved:true
  }});
  assert.match(approved,/Submit final video/);
  assert.match(approved,/data-proposal-payment-action="deliver"/);

  profile.account_role='client';
  const finalProof=view.render({...proposal,agreement:{
    id:'live-agreement',escrow_status:'DP_RELEASED',project_status:'AWAITING_REMAINING_PAYMENT',
    final_proof_shared:true,final_proof_url:'https://example.test/final.mp4'
  }});
  assert.match(finalProof,/Accept &amp; pay remaining/);
  assert.match(finalProof,/data-proposal-revision=/);
  assert.match(finalProof,/data-proposal-payment-action="REMAINING"/);
  assert.match(finalProof,/data-proposal-final-video="preview-proposal"[^>]*>Watch video/);
  assert.doesNotMatch(finalProof,/href="https:\/\/example\.test\/final\.mp4"/);

  profile.account_role='dev';
  const handover=view.render({...proposal,agreement:{
    id:'live-agreement',escrow_status:'REMAINING_HELD',project_status:'AWAITING_HANDOVER'
  }});
  assert.match(handover,/Hand over system/);
  assert.match(handover,/data-proposal-payment-action="handover"/);

  profile.account_role='client';
  const acceptance=view.render({...proposal,agreement:{
    id:'live-agreement',escrow_status:'REMAINING_HELD',
    project_status:'AWAITING_RESULT_ACCEPTANCE',handover_status:'AWAITING_CLIENT'
  }});
  assert.match(acceptance,/Accept result/);
  assert.match(acceptance,/data-proposal-payment-action="review-handover"/);
  assert.match(acceptance,/Report a problem/);

  const completed=view.render({...proposal,agreement:{
    id:'live-agreement',project_status:'COMPLETED',client_rated:false
  }});
  assert.match(completed,/>Rate</);
  assert.match(completed,/Project payments<\/button>/);

  const disputed=view.render({...proposal,agreement:{
    id:'live-agreement',project_status:'DISPUTED',dispute_status:'NEEDS_REVIEW'
  }});
  assert.match(disputed,/Dispute under review/);
});

test('Developer progress card opens the existing upload form and server gates future uploads',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
  const api=fs.readFileSync('supabase/functions/chat-api/index.ts','utf8');
  const service=fs.readFileSync('supabase/functions/payment-api/service.mjs','utf8');
  const state=fs.readFileSync('supabase/functions/payment-api/state.mjs','utf8');

  assert.match(chat,/data-proposal-progress="\$\{cardId\}"/);
  assert.match(chat,/proposalProjectButton && scope\.contains\(proposalProjectButton\)[\s\S]*?openProposalProgress\(getActiveProposal/);
  assert.match(payment,/Coming soon\. Upload progress will be available here\./);
  assert.match(state,/room\.project === 'IN_PROGRESS' && room\.escrow === 'DP_HELD' &&\s*state\.payments\?\.some\(payment => payment\.kind === 'DP' && payment\.status === 'PAID'\)/);
  assert.match(api,/progress_review_status: paymentRoom\?\.progressReview\?\.status \|\| null/);
  assert.match(service,/applyAction\(state, role, body, user\)/);
});

test('Client Review progress opens the illustrated review popup with both review actions',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
  const state=fs.readFileSync('supabase/functions/payment-api/state.mjs','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  const styles=fs.readFileSync('assets/css/chat-payment.css','utf8');

  assert.match(chat,/data-proposal-review-progress="\$\{cardId\}"/);
  assert.match(chat,/openProgressReview\(\{[\s\S]*?\}, proposal\)/);
  assert.match(payment,/function renderProgressReview\(state\)[\s\S]*?Scope completed \(\$\{shown\.size\} of \$\{scope\.length\}\)[\s\S]*?Approving releases the DP/);
  assert.match(payment,/data-review-action="request-update"[\s\S]*?data-review-action="approve-progress"/);
  assert.match(payment,/submitProgressReviewAction\('request-progress-update', \{reason\}\)/);
  assert.match(payment,/submitProgressReviewAction\('approve-progress'\)/);
  assert.match(state,/case 'request-progress-update'[\s\S]*?status: 'UPDATE_REQUESTED'[\s\S]*?room\.timeline\.progressSubmittedAt = null/);
  assert.match(html,/<dialog id="progressReviewDialog"[\s\S]*?Review needed[\s\S]*?progressReviewContent[\s\S]*?progressReviewFooter/);
  assert.match(styles,/\.progress-review-dialog\[open\]/);
  assert.match(styles,/\.progress-review-notice/);
});

test('Client Review handover opens the submitted delivery and acceptance actions in a modal',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  const styles=fs.readFileSync('assets/css/chat-payment.css','utf8');

  assert.match(chat,/action\('Accept result', 'review-handover'\)/);
  assert.match(payment,/button\('review-handover', 'Review handover', true\)/);
  assert.match(payment,/function renderHandoverReview\(state\)[\s\S]*?Delivered[\s\S]*?Scope points \(\$\{deliveredCount\} of \$\{scope\.length\} delivered\)[\s\S]*?Accepting releases/);
  assert.match(payment,/data-handover-review-action="report-problem"[\s\S]*?data-handover-review-action="accept-result"/);
  assert.match(payment,/initialAction === 'review-handover'[\s\S]*?openHandoverReview\(\)/);
  assert.match(html,/<dialog id="handoverReviewDialog"[\s\S]*?Review handover[\s\S]*?handoverReviewContent[\s\S]*?handoverReviewFooter/);
  assert.match(styles,/\.handover-review-dialog \.progress-review-title-row > span/);
  assert.match(styles,/\.handover-review-row/);
});

test('handover review modal renders signed deliveries, notes, scope, and release amount',()=>{
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
  const start=payment.indexOf('  function renderHandoverReview(state) {');
  const end=payment.indexOf('\n  function openHandoverReview()',start);
  assert.notEqual(start,-1);
  assert.notEqual(end,-1);
  const from={textContent:''};
  const content={innerHTML:''};
  const footer={innerHTML:''};
  const state={
    room:{
      developerName:'Treng',
      proposal:{
        total:5000000,dp:1625000,remaining:3375000,
        scopeItems:['Home page','Responsive layout','Source code']
      },
      handover:{
        at:'2026-12-03T09:30:00.000Z',
        deadlineAt:'2026-12-10T00:00:00.000Z',
        notes:'Everything is ready <to review>.',
        files:[{name:'company-profile-source.zip',size:18*1024*1024,url:'https://storage.example/file?token=abc'}],
        links:{website:'https://chetiya-company.example',repository:'https://github.com/example/project'},
        scope:['Home page','Responsive layout','Source code']
      }
    }
  };
  vm.runInNewContext(`${payment.slice(start,end)}\nrenderHandoverReview(state);`,{
    state,URL,safe:value=>String(value).replace(/[&<>"']/g,char=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[char])),
    handoverReviewFrom:from,handoverReviewContent:content,handoverReviewFooter:footer,
    progressReviewDate:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}),
    progressReviewClock:new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}),
    rupiah:{format:value=>`Rp ${Number(value).toLocaleString('id-ID')}`}
  });

  assert.match(from.textContent,/From Treng · handed over/);
  assert.match(content.innerHTML,/company-profile-source\.zip/);
  assert.match(content.innerHTML,/chetiya-company\.example/);
  assert.match(content.innerHTML,/github\.com\/example\/project/);
  assert.match(content.innerHTML,/Everything is ready &lt;to review&gt;\./);
  assert.match(content.innerHTML,/Scope points \(3 of 3 delivered\)/);
  assert.match(content.innerHTML,/Rp 3\.375\.000/);
  assert.match(footer.innerHTML,/Report a problem[\s\S]*Accept result/);
});

test('progress video upload rejects unsupported file types and clears unreadable selections',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');

  assert.match(chat,/PROGRESS_VIDEO_TYPES = new Set\(\['video\/mp4', 'video\/quicktime', 'video\/webm'\]\)/);
  assert.match(chat,/PROGRESS_VIDEO_EXTENSIONS = new Set\(\['\.mp4', '\.mov', '\.webm'\]\)/);
  assert.match(chat,/This video format is not compatible\. Choose MP4, MOV, or WebM\./);
  assert.match(chat,/catch \(error\) \{\s*progressVideoInput\.value = '';\s*setProgressStatus\(\);\s*if \(progressVideoStatus\) progressVideoStatus\.textContent = error\.message;/);
  assert.match(chat,/progressVideoPreview\.onerror = \(\) => \{[\s\S]*?progressVideoInput\.value = '';\s*clearProgressVideoPreview\(\);[\s\S]*?This video is not compatible or could not be read/);
  assert.match(html,/accept="video\/mp4,video\/quicktime,video\/webm,\.mp4,\.mov,\.webm"/);
});

test('agreement rating opens the role-specific scored modal with a 500-character comment',()=>{
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  const styles=fs.readFileSync('assets/css/chat-payment.css','utf8');

  assert.match(payment,/button\('rate', 'Rate now', true\)/);
  assert.match(payment,/qualityOfWork', 'Quality of work'[\s\S]*?communication', 'Communication'[\s\S]*?meetingDeadline', 'Meeting the deadline'/);
  assert.match(payment,/clarityOfBrief', 'Clarity of the brief'[\s\S]*?responsiveness', 'Responsiveness'[\s\S]*?respectingScope', 'Respecting the agreed scope'/);
  assert.match(payment,/submitAgreementReview\(agreementId, criteria, fields\.text \|\| ''\)/);
  assert.match(payment,/loadAgreementReviewState\(agreementId\)/);
  assert.match(payment,/updateOverallRating/);
  assert.match(html,/<dialog id="agreementRatingDialog"[\s\S]*?agreementRatingForm[\s\S]*?Skip for now[\s\S]*?Submit rating/);
  assert.match(html,/<textarea name="text" rows="3" maxlength="500"><\/textarea>/);
  assert.match(html,/data-rating-overall-value/);
  assert.doesNotMatch(html,/<input[^>]+name="rating"/);
  assert.match(html,/14-day window/);
  assert.match(styles,/\.agreement-rating-dialog\[open\]/);
});
