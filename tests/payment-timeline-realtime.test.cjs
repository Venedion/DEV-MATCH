const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Agreement created is complete even when the legacy agreement has no timestamp',()=>{
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
  const step=payment.slice(
    payment.indexOf("timelineStep(1, 'Agreement created'"),
    payment.indexOf("timelineStep(2, 'DP paid'")
  );
  assert.match(payment,/completed = Boolean\(at\)\) => \{\s*const done = Boolean\(completed\)/);
  assert.match(step,/true\),\s*$/);
  assert.match(payment,/done && at \? `<time/);
});

test('Progress review remains upcoming until the down payment is recorded as paid',()=>{
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
  assert.match(payment,/const dpPaid = Boolean\(timeline\.dpPaidAt\) \|\|[\s\S]*?payments\.some\(payment => payment\.kind === 'DP' && payment\.status === 'PAID'\)/);
  assert.match(payment,/const progressStatus = progressDone \|\| !dpPaid \? 'Upcoming'[\s\S]*?'Waiting for developer'/);
  assert.match(payment,/Number\(proposal\.dp\) \|\| 0, dpAction, dpPaid\)/);
});

test('Agreement timeline header has no Open chat action and retains its close button',()=>{
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
  const header=payment.slice(
    payment.indexOf('<div class="agreement-header-actions">'),
    payment.indexOf('<div class="agreement-workspace">')
  );
  assert.doesNotMatch(header,/Open chat|data-action="back-to-chat"/);
  assert.match(header,/class="agreement-close-button" data-action="close-dialog"/);
});

test('Agreement payment dialog closes on backdrop clicks, not clicks inside it',()=>{
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
  assert.match(payment,/dialog\.addEventListener\('click', event => \{\s*if \(event\.target !== dialog\) return;\s*const rect = dialog\.getBoundingClientRect\(\);[\s\S]*?if \(outside\) dialog\.close\(\);/);
});

test('Agreement state changes broadcast privately and refresh the open timeline',()=>{
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
  const migration=fs.readFileSync('supabase/migrations/202611260003_payment_agreement_realtime.sql','utf8');
  assert.match(payment,/client\.channel\(`payment-agreement:\$\{agreementId\}`, \{config: \{private: true\}\}\)/);
  assert.match(payment,/\.on\('broadcast', \{event: 'refresh'\}, \(\) => refreshAgreementRoom\(key\)\)/);
  assert.match(payment,/flushAgreementRefresh\(key\)/);
  assert.match(payment,/periodic refresh remains active/);
  assert.match(migration,/can_receive_payment_agreement_updates/);
  assert.match(migration,/create policy "Participants can receive agreement payment updates"/);
  assert.match(migration,/realtime\.send\([\s\S]*?'payment-agreement:'/);
  assert.match(migration,/create trigger payment_agreement_rooms_broadcast_updates[\s\S]*?after insert or update/);
});

test('Client DP Demo payment uses the existing Midtrans Sandbox checkout',()=>{
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  assert.match(html,/<dialog id="roomPaymentCheckoutDialog"/);
  assert.match(html,/data-demo-payment>Demo payment/);
  assert.match(html,/data-checkout-continue>Continue to payment/);
  assert.match(payment,/if \(action === 'DP' && !fields\.confirmed && isAgreementContext\(\)\)\s*\{\s*showCheckoutConfirmation\(\)/);
  assert.match(payment,/checkoutDialog\.querySelector\('\[data-demo-payment\]'\)\.addEventListener\('click', \(\) =>\s*perform\('DP', \{confirmed: true\}\)\)/);
  assert.match(payment,/request\(key, 'checkout', \{kind: action\}\)/);
  assert.doesNotMatch(payment,/request\(key, 'demo-payment'/);
  assert.match(html,/Midtrans Sandbox is for testing; no real money moves/);
});

test('Snap embeds in the agreement and refreshes the backend status after closing',()=>{
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  assert.match(html,/<dialog id="roomPaymentSnapDialog"[\s\S]*?<div id="roomPaymentSnap"/);
  assert.match(payment,/snapDialog\.showModal\(\);\s*snap\.embed\(checkout\.token/);
  assert.match(payment,/snapDialog\.addEventListener\('close',[\s\S]*?void perform\('refresh'\)/);
  assert.match(payment,/onSuccess: close,\s*onPending: refresh,\s*onError: refresh/);
  assert.match(payment,/request\(key, checkGateway \? 'refresh' : 'snapshot'\)/);
  assert.match(payment,/expiredDp \? 'Retry DP' : 'Pay DP'/);
  assert.doesNotMatch(payment,/window\.open\('about:blank'|location\.assign\(target\.href\)/);
});

test('Agreement actions reuse the proposal details popup and print its proposal terms',()=>{
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  const css=fs.readFileSync('assets/css/chat-payment.css','utf8');
  assert.match(html,/id="projectProposalDetailsDialog"/);
  assert.match(html,/id="proposalDetailsPrintContent"/);
  assert.doesNotMatch(html,/roomAgreementDetailsDialog/);
  assert.match(payment,/data-action="view-proposal-details"/);
  assert.match(payment,/window\.DEVMATCH_PROPOSAL_DETAILS\?\.open\(agreementProposalId\)/);
  assert.match(payment,/window\.DEVMATCH_PROPOSAL_DETAILS\?\.preparePrint\(agreementProposalId\)/);
  assert.match(payment,/agreementProposalId = agreement\.proposalId \|\| null/);
  assert.match(chat,/window\.DEVMATCH_PROPOSAL_DETAILS = \{[\s\S]*?open\(proposalId\)[\s\S]*?openProposalDetails\(proposal\)[\s\S]*?preparePrint\(proposalId\)/);
  assert.match(chat,/openProposalDetails\(proposal, \{showDialog: false\}\)/);
  assert.match(chat,/header\.querySelector\('\[data-close-proposal-details\]'\)\?\.remove\(\)/);
  assert.match(payment,/if \(action === 'print-agreement'\) \{[\s\S]*?window\.print\(\)/);
  assert.match(css,/body > \* \{\s*display: none !important;\s*\}[\s\S]*?body > #proposalDetailsPrintContent \{\s*display: block !important;/);
});
