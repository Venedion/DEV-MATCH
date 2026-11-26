const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const fs=require('node:fs');

const uuid='123e4567-e89b-42d3-a456-426614174000';
const orderId=`devmatch-dp-${uuid}`;
const payment={
  id:uuid,
  agreement_id:'123e4567-e89b-42d3-a456-426614174001',
  payer_id:'123e4567-e89b-42d3-a456-426614174002',
  payee_id:'123e4567-e89b-42d3-a456-426614174003',
  kind:'dp',
  amount:25000,
  status:'pending',
  expires_at:'2026-11-28T11:00:00.000Z',
  snap_token:'existing-snap-token',
  midtrans_order_id:orderId
};

test('Midtrans signature verification validates the signed fields',async()=>{
  const {verifyMidtransSignature}=await import('../supabase/functions/_shared/midtrans-payment.mjs');
  const serverKey='SB-Mid-server-test-only';
  const body={
    order_id:orderId,
    status_code:'200',
    gross_amount:'25000.00'
  };
  body.signature_key=createHash('sha512')
    .update(body.order_id+body.status_code+body.gross_amount+serverKey)
    .digest('hex');
  assert.equal(verifyMidtransSignature(body,serverKey),true);
  assert.equal(verifyMidtransSignature({...body,gross_amount:'25001.00'},serverKey),false);
  assert.equal(verifyMidtransSignature(body,''),false);
});

test('Shared status mapping only marks accepted captures and settlements paid',async()=>{
  const {mapMidtransStatus}=await import('../supabase/functions/_shared/midtrans-payment.mjs');
  assert.equal(mapMidtransStatus({transaction_status:'settlement'}),'paid');
  assert.equal(mapMidtransStatus({transaction_status:'capture',fraud_status:'accept'}),'paid');
  assert.equal(mapMidtransStatus({transaction_status:'capture',fraud_status:'challenge'}),'pending');
  assert.equal(mapMidtransStatus({transaction_status:'expire'}),'expired');
  assert.equal(mapMidtransStatus({transaction_status:'cancel'}),'cancelled');
  assert.equal(mapMidtransStatus({transaction_status:'deny'}),'failed');
});

test('Sandbox Snap gateway creates a 48-hour transaction without exposing its key in the URL',async()=>{
  const {midtransGateway}=await import('../supabase/functions/_shared/midtrans-payment.mjs');
  let captured;
  const gateway=midtransGateway({
    environment:'sandbox',
    serverKey:'SB-Mid-server-test-only',
    returnOrigin:'https://staging.devmatch.example',
    request:async(url,options)=>{
      captured={url:String(url),options};
      return {ok:true,json:async()=>({token:'sandbox-snap-token'})};
    }
  });
  assert.equal(await gateway.createDp({
    orderId,
    amount:25000,
    paymentId:uuid,
    agreementId:payment.agreement_id,
    conversationId:'123e4567-e89b-42d3-a456-426614174005'
  }),'sandbox-snap-token');
  assert.equal(captured.url,'https://app.sandbox.midtrans.com/snap/v1/transactions');
  assert.equal(captured.options.body,JSON.stringify({
    transaction_details:{order_id:orderId,gross_amount:25000},
    credit_card:{secure:true},
    expiry:{unit:'hour',duration:48},
    callbacks:{finish:
      'https://staging.devmatch.example/devmatch-chat.html?conversation=123e4567-e89b-42d3-a456-426614174005&role=client&payment=return&paymentAgreement=123e4567-e89b-42d3-a456-426614174001&paymentId=123e4567-e89b-42d3-a456-426614174000&paymentOrderId=devmatch-dp-123e4567-e89b-42d3-a456-426614174000'}
  }));
  assert.doesNotMatch(captured.url,/serverKey|test-only/i);
});

test('Snap return URL requires a configured HTTPS application origin',async()=>{
  const {midtransGateway}=await import('../supabase/functions/_shared/midtrans-payment.mjs');
  const gateway=midtransGateway({environment:'sandbox',serverKey:'SB-Mid-server-test-only'});
  assert.equal(gateway.configured,true);
  assert.equal(gateway.checkoutConfigured,false);
  await assert.rejects(gateway.createDp({
    orderId,paymentId:uuid,agreementId:payment.agreement_id,
    conversationId:'123e4567-e89b-42d3-a456-426614174005',amount:25000
  }),{status:503});
  const invalid=midtransGateway({
    environment:'sandbox',serverKey:'SB-Mid-server-test-only',
    returnOrigin:'http://staging.devmatch.example'
  });
  assert.equal(invalid.checkoutConfigured,false);
});

test('Existing pending DP with a Snap token is reused instead of duplicated',async()=>{
  const {paymentsService}=await import('../supabase/functions/payments/service.mjs');
  let createCalls=0;
  const store={
    claimDp:async()=>({payment,needs_snap:false}),
    releaseCheckoutClaim:async()=>{}
  };
  const gateway={
    configured:true,
    checkoutConfigured:true,
    createDp:async()=>{createCalls+=1;return 'new-token';}
  };
  const result=await paymentsService(store,gateway).createDpTransaction(payment.payer_id,{
    agreementId:payment.agreement_id
  });
  assert.equal(result.snapToken,payment.snap_token);
  assert.equal(result.orderId,payment.midtrans_order_id);
  assert.equal(createCalls,0);
});

test('Failed checkout is retried with a new order only after Status API confirms failure',async()=>{
  const {paymentsService}=await import('../supabase/functions/payments/service.mjs');
  const previousPayment={
    ...payment,
    snap_token:'expired-snap-token',
    expires_at:'2026-11-20T11:00:00.000Z'
  };
  const nextPayment={
    ...payment,
    id:'123e4567-e89b-42d3-a456-426614174004',
    midtrans_order_id:'devmatch-dp-123e4567-e89b-42d3-a456-426614174004',
    snap_token:null
  };
  const agreement={
    id:payment.agreement_id,
    conversation_id:'123e4567-e89b-42d3-a456-426614174005',
    total_price:100000,
    dp_amount:25000,
    created_at:'2026-11-26T00:00:00.000Z',
    terms:{terms:{projectName:'Test project',scope:[],revisionCount:1,dpPercent:25}}
  };
  let claims=0;
  let appliedStatus;
  let createCalls=0;
  let createOptions;
  const store={
    claimDp:async()=>++claims===1
      ? {payment:previousPayment,expired_checkout:true}
      : {payment:nextPayment,needs_snap:true,claim_id:'claim-id'},
    agreement:async()=>agreement,
    applyMidtransStatus:async(order,amount,status)=>{appliedStatus=status;return {status,changed:true};},
    storeSnapToken:async(id,claimId,snapToken)=>({snap_token:snapToken})
  };
  const gateway={
    configured:true,
    checkoutConfigured:true,
    status:async()=>({
      order_id:previousPayment.midtrans_order_id,
      gross_amount:'25000.00',
      transaction_status:'deny'
    }),
    createDp:async options=>{createCalls+=1;createOptions=options;return 'new-snap-token';}
  };
  const result=await paymentsService(store,gateway).createDpTransaction(payment.payer_id,{
    agreementId:payment.agreement_id
  });
  assert.equal(claims,2);
  assert.equal(appliedStatus,'failed');
  assert.equal(createCalls,1);
  assert.equal(result.orderId,nextPayment.midtrans_order_id);
  assert.deepEqual(createOptions,{
    orderId:nextPayment.midtrans_order_id,
    amount:25000,
    paymentId:nextPayment.id,
    agreementId:payment.agreement_id,
    conversationId:agreement.conversation_id
  });
});

test('Midtrans expiry cancels the agreement instead of creating another checkout',async()=>{
  const {paymentsService}=await import('../supabase/functions/payments/service.mjs');
  const expiredPayment={...payment,expires_at:'2026-11-20T11:00:00.000Z'};
  let claims=0;
  let createCalls=0;
  let appliedStatus;
  const store={
    claimDp:async()=>{claims+=1;return {payment:expiredPayment,expired_checkout:true};},
    agreement:async()=>({
      id:payment.agreement_id,
      total_price:100000,
      dp_amount:25000,
      terms:{terms:{projectName:'Test project',scope:[],revisionCount:1,dpPercent:25}}
    }),
    applyMidtransStatus:async(order,amount,status)=>{appliedStatus=status;return {status,changed:true};}
  };
  const gateway={
    configured:true,
    checkoutConfigured:true,
    status:async()=>({
      order_id:expiredPayment.midtrans_order_id,
      gross_amount:'25000',
      transaction_status:'expire'
    }),
    createDp:async()=>{createCalls+=1;return 'must-not-be-created';}
  };
  await assert.rejects(
    paymentsService(store,gateway).createDpTransaction(payment.payer_id,{
      agreementId:payment.agreement_id
    }),
    {status:409}
  );
  assert.equal(claims,1);
  assert.equal(appliedStatus,'expired');
  assert.equal(createCalls,0);
});

test('Expired local timestamp alone cannot finalize a pending Midtrans payment',async()=>{
  const {paymentsService}=await import('../supabase/functions/payments/service.mjs');
  const previousPayment={...payment,expires_at:'2026-11-20T11:00:00.000Z'};
  let claims=0;
  let appliedStatus;
  const store={
    claimDp:async()=>{claims+=1;return {payment:previousPayment,expired_checkout:true};},
    agreement:async()=>({
      id:payment.agreement_id,
      total_price:100000,
      dp_amount:25000,
      terms:{terms:{projectName:'Test project',scope:[],revisionCount:1,dpPercent:25}}
    }),
    applyMidtransStatus:async(order,amount,status)=>{appliedStatus=status;return {status,changed:false};}
  };
  const gateway={
    configured:true,
    checkoutConfigured:true,
    status:async()=>({
      order_id:previousPayment.midtrans_order_id,
      gross_amount:'25000',
      transaction_status:'pending'
    })
  };
  await assert.rejects(
    paymentsService(store,gateway).createDpTransaction(payment.payer_id,{
      agreementId:payment.agreement_id
    }),
    /Status transaksi sebelumnya masih menunggu konfirmasi Midtrans/
  );
  assert.equal(claims,1);
  assert.equal(appliedStatus,'pending');
});

test('Payment claim leaves expired timestamps pending until a Midtrans status is verified',()=>{
  const migration=fs.readFileSync('supabase/migrations/20261126110000_payments.sql','utf8');
  const rollback=fs.readFileSync('supabase/migrations/rollback/20261126110000_payments.down.sql','utf8');
  const claim=migration.slice(
    migration.indexOf('create or replace function public.payments_claim_dp_transaction'),
    migration.indexOf('create or replace function public.payments_store_snap_token')
  );
  assert.match(claim,/expired_checkout/);
  assert.doesNotMatch(claim,/set status\s*=\s*'expired'/);
  assert.match(migration,/v_became_expired[\s\S]*?cancellationReason[\s\S]*?DP_EXPIRED/);
  assert.match(migration,/v_became_paid and[\s\S]*?cancellationReason[\s\S]*?IN_PROGRESS/);
  assert.match(rollback,/cancellationReason[\s\S]*?DP_EXPIRED/);
});

test('Refresh status checks participant access and applies the shared verified status',async()=>{
  const {paymentsService}=await import('../supabase/functions/payments/service.mjs');
  let appliedStatus;
  let statusCalls=0;
  const agreement={
    id:payment.agreement_id,
    total_price:100000,
    dp_amount:25000,
    created_at:'2026-11-26T00:00:00.000Z',
    terms:{terms:{projectName:'Test project',scope:[],revisionCount:1,dpPercent:25}}
  };
  const store={
    paymentByOrder:async()=>payment,
    agreement:async()=>agreement,
    applyMidtransStatus:async(order,amount,status)=>{appliedStatus=status;return {status,changed:true};}
  };
  const gateway={
    configured:true,
    status:async()=>{statusCalls+=1;return {
      order_id:orderId,gross_amount:'25000.00',transaction_status:'settlement'
    };}
  };
  const service=paymentsService(store,gateway);
  await assert.rejects(
    service.refreshStatus('123e4567-e89b-42d3-a456-426614174099',{
      paymentId:payment.id,orderId
    }),
    {status:403}
  );
  assert.equal(statusCalls,0);
  const result=await service.refreshStatus(payment.payer_id,{paymentId:payment.id,orderId});
  assert.equal(result.status,'paid');
  assert.equal(appliedStatus,'paid');
  assert.equal(statusCalls,1);
});

test('Refresh status rejects malformed order IDs before querying storage',async()=>{
  const {paymentsService}=await import('../supabase/functions/payments/service.mjs');
  let lookups=0;
  const service=paymentsService({
    paymentByOrder:async()=>{lookups+=1;}
  },{configured:true});
  await assert.rejects(
    service.refreshStatus(payment.payer_id,{paymentId:payment.id,orderId:'anything'}),
    {status:400}
  );
  assert.equal(lookups,0);
});
