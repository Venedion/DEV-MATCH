const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {runInNewContext}=require('node:vm');

test('The deployment config accepts both Midtrans Sandbox Client Key formats',()=>{
  const source=fs.readFileSync('scripts/build-deployment-config.cjs','utf8');
  const build=(environment,clientKey)=>{
    let output;
    runInNewContext(source,{
      __dirname:'scripts',
      process:{env:{
        DEVMATCH_MIDTRANS_ENVIRONMENT:environment,
        DEVMATCH_MIDTRANS_CLIENT_KEY:clientKey,
        DEVMATCH_SUPABASE_URL:'https://fixture.supabase.co',
        DEVMATCH_SUPABASE_ANON_KEY:'public-test-key'
      }},
      URL,
      require:module=>module==='node:fs'?{writeFileSync(_path,value){output=value;}}:require(module)
    });
    const window={};
    runInNewContext(output,{window});
    return window.DEVMATCH_PUBLIC_CONFIG;
  };
  for(const clientKey of ['SB-Mid-client-fixture','Mid-client-fixture']){
    const config=build('sandbox',clientKey);
    assert.equal(config.midtransPaymentsEnabled,true);
    assert.equal(config.midtransClientKey,clientKey);
    assert.equal(config.midtransSnapJsUrl,'https://app.sandbox.midtrans.com/snap/snap.js');
  }
  assert.throws(()=>build('sandbox','SB-Mid-server-fixture'),/supported format/);
  assert.throws(()=>build('production','SB-Mid-client-fixture'),/supported format/);
});

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
  assert.match(payment,/const dpPaid = payments\.some\(payment => payment\.kind === 'DP' && payment\.status === 'PAID'\)/);
  assert.match(payment,/const progressStatus = progressDone \|\| !dpPaid \? 'Upcoming'[\s\S]*?'Waiting for developer'/);
  assert.match(payment,/Number\(proposal\.dp\) \|\| 0, dpAction, dpPaid\)/);
  assert.match(payment,/const awaitingProgress = developer && dpPaid && room\.project === 'IN_PROGRESS' &&\s*room\.escrow === 'DP_HELD'/);
  assert.match(payment,/Coming soon\. Upload progress will be available here\./);
  assert.doesNotMatch(payment,/section\('Upload progress', form\('progress'/);
});

test('DP paid notifications open the participant conversation',()=>{
  const migration=fs.readFileSync('supabase/migrations/20261126110000_payments.sql','utf8');
  const notifications=fs.readFileSync('assets/js/notifications.js','utf8');
  assert.match(migration,/insert into public\.notifications[\s\S]*?select a\.client_id[\s\S]*?a\.client_id, 'client', 'payment', c\.project_id, a\.conversation_id/);
  assert.match(migration,/insert into public\.notifications[\s\S]*?select a\.developer_id[\s\S]*?a\.client_id, 'client', 'payment', c\.project_id, a\.conversation_id/);
  assert.match(notifications,/if \(notification\.conversation_id\) \{\s*const role = workspace === 'client' \? '&role=client' : '';\s*return `devmatch-chat\.html\?conversation=\$\{encodeURIComponent\(notification\.conversation_id\)\}\$\{role\}`/);
  assert.match(notifications,/detail\.filter === 'payments' \? 'Open project'/);
});

test('Paid agreement proposal cards open the project timeline for both participants',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  assert.match(chat,/const isDpPaid = !isPreview && isAccepted && dpPaymentStatus === 'paid' && escrowStatus === 'DP_HELD'/);
  assert.match(chat,/const isAgreementInProgress = isDpPaid && projectStatus === 'IN_PROGRESS'/);
  assert.match(chat,/isAgreementInProgress \? 'In progress'/);
  assert.match(chat,/data-proposal-open-project="\$\{cardId\}">Open project/);
  assert.match(chat,/data-proposal-progress="\$\{cardId\}">Upload progress/);
  assert.match(chat,/proposalProjectButton\.dataset\.proposalProgress \|\| proposalProjectButton\.dataset\.proposalOpenProject/);
  assert.match(chat,/window\.DEVMATCH_ROOM_PAYMENT\?\.openAgreement\(\{/);
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

test('Client DP checkout embeds Snap in the existing payment dialog',()=>{
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  assert.match(html,/<dialog id="roomPaymentCheckoutDialog"/);
  assert.match(html,/id="roomPaymentSnapEmbed"/);
  assert.match(html,/data-checkout-continue>Continue to payment/);
  assert.match(payment,/if \(action === 'DP' && !fields\.confirmed && isAgreementContext\(\)\)\s*\{\s*showCheckoutConfirmation\(\)/);
  assert.match(payment,/snap\.embed\(created\.snapToken, \{\s*embedId: 'roomPaymentSnapEmbed'/);
  assert.match(payment,/script\.dataset\.clientKey = clientKey/);
  assert.match(payment,/onSuccess: \(\) => \{ void refreshDpStatus/);
  assert.match(payment,/onPending: \(\) => \{ void refreshDpStatus/);
  assert.match(payment,/onError: \(\) => \{ void refreshDpStatus/);
  assert.match(payment,/onClose: \(\) => \{ void refreshDpStatus/);
  assert.match(payment,/window\.setInterval\(\(\) => \{[\s\S]*?refreshDpStatus\(dpStatusPayment\)[\s\S]*?\}, 5000\)/);
  assert.match(payment,/window\.addEventListener\('focus',[\s\S]*?refreshDpStatus\(dpStatusPayment\)/);
  assert.match(payment,/window\.dispatchEvent\(new CustomEvent\('devmatch:dp-payment-status'/);
  assert.match(payment,/refreshAgreementRoom\(roomKey\)/);
  assert.match(payment,/window\.DEVMATCH_PUBLIC_CONFIG\?\.midtransPaymentsEnabled === true/);
  assert.doesNotMatch(payment,/request\(key, 'demo-payment'/);
  assert.match(payment,/Midtrans Sandbox is for testing; no real money moves/);
  assert.match(payment,/const checkoutDuration = embeddedCheckoutAvailable \? '48 hours' : '10 minutes'/);
  assert.match(html,/id="roomPaymentDemoGuide"[\s\S]*?https:\/\/simulator\.sandbox\.midtrans\.com\/bca\/va\/index/);
  assert.match(html,/id="roomPaymentCheckoutNote"/);
  assert.match(html,/id="roomPaymentSnapStatus" role="status" aria-live="polite"/);
  assert.match(payment,/params\.searchParams\.get\('paymentId'\)[\s\S]*?params\.searchParams\.get\('paymentOrderId'\)[\s\S]*?startDpStatusPolling/);
  assert.match(payment,/openAgreement\(\{[\s\S]*?title: proposal\?\.terms\?\.projectName\s*\}\);/);
  assert.doesNotMatch(html,/roomPaymentSnapDialog|id="roomPaymentSnap"/);
});

test('Proposal card refreshes from verified payment updates and participant-scoped Realtime',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  assert.match(chat,/window\.addEventListener\('devmatch:dp-payment-status', event => \{\s*refreshVisibleProposalAgreement\(event\.detail\?\.agreementId\)/);
  assert.match(chat,/table: 'payments'[\s\S]*?refreshVisibleProposalAgreement\(payment\.agreement_id\)/);
  assert.match(chat,/async function loadMessages\(conversationId\)[\s\S]*?renderMessagesThread\(\)/);
  assert.doesNotMatch(chat,/devmatch:dp-payment-status[\s\S]*?dp_payment_status\s*=/);
});

test('Legacy project checkout continues to preserve its new-tab behavior',()=>{
  const payment=fs.readFileSync('assets/js/chat-payment.js','utf8');
  assert.match(payment,/window\.open\('about:blank', '_blank'\)[\s\S]*?await request\(key, 'checkout'/);
  assert.match(payment,/checkoutTab\.opener = null/);
  assert.match(payment,/checkoutTab\.location\.replace\(target\.href\)/);
  assert.match(payment,/link\.href = target\.href;\s*link\.target = '_blank';\s*link\.rel = 'noopener noreferrer'/);
  assert.match(payment,/if \(!checkoutOpened && checkoutTab && !checkoutTab\.closed\) checkoutTab\.close\(\)/);
  assert.doesNotMatch(payment,/(?<!checkoutTab\.)location\.(assign|replace)\(target\.href\)/);
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
