const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');

const DEV='11111111-1111-4111-8111-111111111111';
const CLIENT='22222222-2222-4222-8222-222222222222';
const OUTSIDER='33333333-3333-4333-8333-333333333333';
const CONVERSATION='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROPOSAL='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MESSAGE='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const WITHDRAWN_PROPOSAL='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const WITHDRAWN_MESSAGE='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const migration=fs.readFileSync(
  path.join(__dirname,'../supabase/migrations/202611240001_project_proposals.sql'),
  'utf8'
);
const paymentMigration=fs.readFileSync(
  path.join(__dirname,'../supabase/migrations/202611260001_proposal_agreement_payments.sql'),
  'utf8'
);

async function setupDatabase(){
  const db=new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    insert into auth.users(id) values ('${DEV}'), ('${CLIENT}'), ('${OUTSIDER}');

    create table public.conversations(
      id uuid primary key,
      participant_a_id uuid not null,
      participant_b_id uuid not null,
      participant_a_role text not null,
      participant_b_role text not null,
      merged_into uuid
    );
    insert into public.conversations values
      ('${CONVERSATION}', '${DEV}', '${CLIENT}', 'dev', 'client', null);

    create table public.messages(
      id uuid primary key,
      conversation_id uuid not null references public.conversations(id),
      sender_id uuid not null,
      ciphertext text not null check(char_length(ciphertext) between 22 and 40000 and ciphertext ~ '^[A-Za-z0-9_-]+$'),
      nonce text not null check(char_length(nonce)=16 and nonce ~ '^[A-Za-z0-9_-]+$'),
      key_version smallint not null check(key_version between 1 and 32767),
      created_at timestamptz not null default now()
    );
    grant all on public.messages to service_role;
  `);
  await db.exec(migration);
  await db.exec(paymentMigration);
  return db;
}

function terms(){
  const deadline=new Date(Date.now()+10*24*60*60*1000).toISOString().slice(0,10);
  return {
    projectName:'Company profile website',
    description:'Build a responsive company profile website.',
    totalPrice:4500000,
    dpPercent:25,
    deadline,
    scope:['Responsive landing page','Company profile page'],
    revisionCount:2,
    revisionNotes:''
  };
}

async function createProposal(db,id,messageId,actorId=DEV,role='dev'){
  const input=terms();
  await db.query(`
    select public.create_project_proposal(
      $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text,
      $6::jsonb, '[]'::jsonb, 'AAAAAAAAAAAAAAAAAAAAAA'::text, 'abcdefghijklmnop'::text, 1::smallint
    )
  `,[id,messageId,CONVERSATION,actorId,role,JSON.stringify(input)]);
}

test('Proposal creation is developer-only and persists the proposal card event atomically',async()=>{
  const db=await setupDatabase();
  try{
    await db.exec('set role service_role');
    await createProposal(db,PROPOSAL,MESSAGE);
    const saved=(await db.query(
      `select status,terms->>'dpAmount' as dp_amount,terms->>'remainingAmount' as remaining from public.project_proposals where id=$1`,
      [PROPOSAL]
    )).rows[0];
    assert.equal(saved.status,'pending');
    assert.equal(saved.dp_amount,'1125000');
    assert.equal(saved.remaining,'3375000');
    assert.equal((await db.query(
      'select proposal_id from public.messages where id=$1',[MESSAGE]
    )).rows[0].proposal_id,PROPOSAL);
    await assert.rejects(createProposal(
      db,WITHDRAWN_PROPOSAL,WITHDRAWN_MESSAGE,CLIENT,'client'
    ));
    assert.equal((await db.query('select count(*)::int as n from public.project_proposals')).rows[0].n,1);
  }finally{
    await db.close();
  }
});

test('Accepting a proposal atomically locks its terms in an agreement for both participants',async()=>{
  const db=await setupDatabase();
  try{
    await db.exec('set role service_role');
    await createProposal(db,PROPOSAL,MESSAGE);
    const result=(await db.query(
      'select public.accept_project_proposal($1::uuid,$2::uuid,$3::text) as result',
      [PROPOSAL,CLIENT,'client']
    )).rows[0].result;
    assert.equal(result.proposal.status,'accepted');
    assert.equal(result.agreement.payment_status,'pending');
    assert.equal(result.agreement.total_price,4500000);
    assert.equal(result.agreement.dp_amount,1125000);
    assert.deepEqual(result.agreement.terms.terms,result.proposal.terms);
    const context=(await db.query(
      'select public.payment_agreement_context($1::uuid,$2::uuid) as context',
      [CLIENT,result.agreement.id]
    )).rows[0].context;
    assert.equal(context.role,'client');
    assert.equal(context.agreement.id,result.agreement.id);
    assert.equal(context.state,null);
    const initialPaymentState={room:{escrow:'DP_HELD'},payments:[],ledger:[],events:[]};
    assert.equal((await db.query(
      'select public.payment_agreement_save($1::uuid,0,$2::jsonb,null) as saved',
      [result.agreement.id,JSON.stringify(initialPaymentState)]
    )).rows[0].saved,true);
    const savedContext=(await db.query(
      'select public.payment_agreement_context($1::uuid,$2::uuid) as context',
      [DEV,result.agreement.id]
    )).rows[0].context;
    assert.equal(savedContext.version,1);
    assert.deepEqual(savedContext.state,initialPaymentState);
    await assert.rejects(db.query(
      'select public.accept_project_proposal($1::uuid,$2::uuid,$3::text)',
      [PROPOSAL,CLIENT,'client']
    ));

    await db.exec(`reset role; set role authenticated;
      select set_config('request.jwt.claim.sub','${CLIENT}',false);`);
    assert.equal((await db.query('select count(*)::int as n from public.project_proposals')).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int as n from public.project_agreements')).rows[0].n,1);
    await db.exec(`select set_config('request.jwt.claim.sub','${OUTSIDER}',false);`);
    assert.equal((await db.query('select count(*)::int as n from public.project_proposals')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from public.project_agreements')).rows[0].n,0);
  }finally{
    await db.close();
  }
});

test('Only the proposal creator can withdraw a pending proposal',async()=>{
  const db=await setupDatabase();
  try{
    await db.exec('set role service_role');
    await createProposal(db,PROPOSAL,MESSAGE);
    await assert.rejects(db.query(
      'select public.withdraw_project_proposal($1::uuid,$2::uuid,$3::text)',
      [PROPOSAL,CLIENT,'client']
    ));
    const withdrawn=(await db.query(
      'select to_jsonb(public.withdraw_project_proposal($1::uuid,$2::uuid,$3::text)) as proposal',
      [PROPOSAL,DEV,'dev']
    )).rows[0].proposal;
    assert.equal(withdrawn.status,'withdrawn');
    assert.ok(withdrawn.withdrawn_at);
  }finally{
    await db.close();
  }
});
