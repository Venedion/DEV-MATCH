const test = require('node:test');
const assert = require('node:assert/strict');
const {buildClientDashboard} = require('../supabase/functions/client-home/logic.mjs');

const userId = 'client-id';
const developerId = 'developer-id';
const old = '2026-11-18T10:00:00.000Z';
const recent = '2026-11-20T10:00:00.000Z';

function dashboard(overrides = {}) {
  return buildClientDashboard({
    userId,
    requests: [
      {id: 'request-open', owner_id: userId, project_kind: 'request', title: 'Clinic booking app', status: 'open'},
      {id: 'request-closed', owner_id: userId, project_kind: 'request', title: 'Closed request', status: 'closed'}
    ],
    conversations: [],
    engagements: [],
    profileComplete: false,
    hasExploredProjects: false,
    projects: [
      {id: 'request-open', owner_id: userId, project_kind: 'request', title: 'Clinic booking app'},
      {id: 'developer-project', owner_id: developerId, project_kind: 'portfolio', title: 'Inventory dashboard'},
      {id: 'second-developer-project', owner_id: developerId, project_kind: 'portfolio', title: 'Scheduling app'}
    ],
    developers: [{id: developerId, name: 'Vendee'}],
    ...overrides
  });
}

test('client home counts open requests and only unread developer inquiries on client requests', () => {
  const result = dashboard({
    conversations: [
      {
        id: 'unread-request',
        participant_a_id: userId,
        participant_b_id: developerId,
        participant_a_role: 'client',
        participant_b_role: 'dev',
        project_id: 'request-open',
        messages: [{sender_id: developerId, created_at: recent, read_at: null}]
      },
      {
        id: 'read-request',
        participant_a_id: userId,
        participant_b_id: developerId,
        participant_a_role: 'client',
        participant_b_role: 'dev',
        project_id: 'request-open',
        messages: [{sender_id: developerId, created_at: old, read_at: recent}]
      },
      {
        id: 'unread-portfolio',
        participant_a_id: userId,
        participant_b_id: developerId,
        participant_a_role: 'client',
        participant_b_role: 'dev',
        project_id: 'developer-project',
        messages: [{sender_id: developerId, created_at: recent, read_at: null}]
      }
    ]
  });

  assert.deepEqual(result.metrics, {
    openRequests: 1,
    newInquiries: 1,
    awaitingDeveloperReply: 0
  });
  assert.equal(result.attention[0].type, 'inquiry');
  assert.equal(result.attention[0].developer, 'Vendee');
  assert.equal(result.attention[0].context, 'Clinic booking app');
});

test('client home reports client messages awaiting a developer reply and pending ratings', () => {
  const result = dashboard({
    conversations: [{
      id: 'waiting-reply',
      participant_a_id: userId,
      participant_b_id: developerId,
      participant_a_role: 'client',
      participant_b_role: 'dev',
      project_id: 'developer-project',
      messages: [{sender_id: userId, created_at: old, read_at: null}]
    }],
    engagements: [
      {
        id: 'unrated',
        conversation_id: 'completed-chat',
        project_id: 'developer-project',
        developer_id: developerId,
        client_completed_at: old,
        developer_completed_at: recent,
        project_reviews: []
      },
      {
        id: 'already-rated',
        conversation_id: 'rated-chat',
        project_id: 'developer-project',
        developer_id: developerId,
        client_completed_at: old,
        developer_completed_at: recent,
        project_reviews: [{reviewer_id: userId}]
      },
      {
        id: 'not-complete',
        conversation_id: 'incomplete-chat',
        project_id: 'developer-project',
        developer_id: developerId,
        client_completed_at: old,
        developer_completed_at: null,
        project_reviews: []
      }
    ]
  });

  assert.equal(result.metrics.awaitingDeveloperReply, 1);
  assert.deepEqual(result.attention.map(item => item.type), ['rate', 'awaiting-reply']);
  assert.equal(result.attention[0].conversationId, 'completed-chat');
});

test('client home sorts attention by recency and returns at most five actions', () => {
  const conversations = Array.from({length: 6}, (_, index) => ({
    id: `conversation-${index}`,
    participant_a_id: userId,
    participant_b_id: developerId,
    participant_a_role: 'client',
    participant_b_role: 'dev',
    project_id: 'request-open',
    messages: [{sender_id: developerId, created_at: `2026-11-${String(15 + index).padStart(2, '0')}T10:00:00.000Z`, read_at: null}]
  }));
  const result = dashboard({conversations});

  assert.equal(result.attention.length, 5);
  assert.equal(result.attention[0].conversationId, 'conversation-5');
  assert.equal(result.attention[4].conversationId, 'conversation-1');
});

test('client home lists the five newest posted requests and counts developer inquiries', () => {
  const requests = Array.from({length: 6}, (_, index) => ({
    id: `request-${index}`,
    owner_id: userId,
    project_kind: 'request',
    title: `Request ${index}`,
    status: index === 1 ? 'closed' : 'open',
    price: '',
    data: {budgetFrom: '1500000', budgetTo: '3000000'},
    created_at: `2026-11-${String(15 + index).padStart(2, '0')}T10:00:00.000Z`
  }));
  requests.push({
    id: 'request-draft',
    owner_id: userId,
    project_kind: 'request',
    title: 'Draft request',
    status: 'draft',
    created_at: recent
  });
  const result = dashboard({
    requests,
    projects: [
      ...requests,
      {id: 'developer-project', owner_id: developerId, project_kind: 'portfolio', title: 'Inventory dashboard'}
    ],
    conversations: [
      {
        id: 'developer-inquiry',
        participant_a_id: developerId,
        participant_b_id: userId,
        participant_a_role: 'dev',
        participant_b_role: 'client',
        project_id: 'request-5',
        first_message: [{sender_id: developerId}],
        messages: [{sender_id: userId, created_at: recent, read_at: null}]
      },
      {
        id: 'client-started-request-chat',
        participant_a_id: userId,
        participant_b_id: developerId,
        participant_a_role: 'client',
        participant_b_role: 'dev',
        project_id: 'request-5',
        first_message: [{sender_id: userId}],
        messages: [{sender_id: developerId, created_at: recent, read_at: null}]
      }
    ]
  });

  assert.equal(result.postedRequests.length, 5);
  assert.deepEqual(result.postedRequests.map(request => request.id), [
    'request-5', 'request-4', 'request-3', 'request-2', 'request-1'
  ]);
  assert.equal(result.postedRequests[0].inquiries, 1);
  assert.equal(result.postedRequests[0].budgetFrom, '1500000');
  assert.ok(result.postedRequests.every(request => request.status === 'open' || request.status === 'closed'));
});

test('client home lists client-started developer-project conversations by latest message', () => {
  const conversations = Array.from({length: 6}, (_, index) => ({
    id: `sent-${index}`,
    participant_a_id: userId,
    participant_b_id: developerId,
    participant_a_role: 'client',
    participant_b_role: 'dev',
    project_id: 'developer-project',
    messages: [
      {sender_id: userId, created_at: '2026-11-14T10:00:00.000Z'},
      {
        sender_id: index % 2 ? developerId : userId,
        created_at: `2026-11-${String(15 + index).padStart(2, '0')}T10:00:00.000Z`
      }
    ]
  }));
  conversations.push({
    id: 'developer-started',
    participant_a_id: developerId,
    participant_b_id: userId,
    participant_a_role: 'dev',
    participant_b_role: 'client',
    project_id: 'developer-project',
    messages: [{sender_id: developerId, created_at: recent}]
  });
  const result = dashboard({conversations});

  assert.equal(result.sentConversations.length, 5);
  assert.deepEqual(result.sentConversations.map(item => item.conversationId), [
    'sent-5', 'sent-4', 'sent-3', 'sent-2', 'sent-1'
  ]);
  assert.equal(result.sentConversations[0].status, 'replied');
  assert.equal(result.sentConversations[1].status, 'awaiting-reply');
  assert.equal(result.sentConversations[0].projectId, 'developer-project');
  assert.equal(result.sentConversations[0].project, 'Inventory dashboard');
  assert.equal(result.sentConversations[0].developer, 'Vendee');
});

test('client home excludes conversations from the signed-in user developer workspace',()=>{
  const result=dashboard({
    conversations:[{
      id:'developer-mode-thread',
      participant_a_id:userId,
      participant_b_id:developerId,
      participant_a_role:'dev',
      participant_b_role:'client',
      project_id:'developer-project',
      messages:[{sender_id:userId,project_id:'developer-project',created_at:recent}]
    }]
  });

  assert.equal(result.metrics.awaitingDeveloperReply,0);
  assert.deepEqual(result.sentConversations,[]);
  assert.deepEqual(result.attention,[]);
});

test('client home excludes empty, developer-only, and client-to-client conversations from sent projects', () => {
  const conversations = [
    {
      id: 'client-replied',
      participant_a_id: developerId,
      participant_b_id: userId,
      participant_a_role: 'dev',
      participant_b_role: 'client',
      project_id: 'developer-project',
      messages: [
        {sender_id: userId, created_at: old},
        {sender_id: developerId, created_at: recent}
      ]
    },
    {
      id: 'developer-only',
      participant_a_id: developerId,
      participant_b_id: userId,
      participant_a_role: 'dev',
      participant_b_role: 'client',
      project_id: 'developer-project',
      first_message: [{sender_id: developerId}],
      client_messages: [],
      messages: [{sender_id: developerId, created_at: recent}]
    },
    {
      id: 'client-peer-chat',
      participant_a_id: userId,
      participant_b_id: 'another-client-id',
      participant_a_role: 'client',
      participant_b_role: 'client',
      project_id: 'developer-project',
      client_messages: [{sender_id: userId}],
      messages: [{sender_id: userId, created_at: recent}]
    },
    {
      id: 'empty',
      participant_a_id: userId,
      participant_b_id: developerId,
      participant_a_role: 'client',
      participant_b_role: 'dev',
      project_id: 'developer-project',
      first_message: [],
      client_messages: [],
      messages: []
    }
  ];
  const result = dashboard({conversations});

  assert.deepEqual(result.sentConversations.map(item => item.conversationId), ['client-replied']);
  assert.equal(result.sentConversations[0].status, 'replied');
  assert.equal(result.metrics.awaitingDeveloperReply, 0);
});

test('client home aggregates merged source messages once per parent and deduplicates inquiry runs', () => {
  const root = {
    id: 'parent-thread',
    participant_a_id: userId,
    participant_b_id: developerId,
    participant_a_role: 'client',
    participant_b_role: 'dev',
    project_id: 'developer-project',
    merged_into: null,
    sources: [
      {
        id: 'parent-thread',
        project_id: 'developer-project',
        messages: [
          {id: 'portfolio-client', sender_id: userId, project_id: 'developer-project', created_at: old, read_at: null},
          {id: 'portfolio-reply', sender_id: developerId, project_id: 'developer-project', created_at: recent, read_at: recent}
        ]
      },
      {
        id: 'merged-source',
        project_id: 'developer-project',
        messages: [
          {id: 'request-inquiry-1', sender_id: developerId, project_id: 'request-open', created_at: '2026-11-19T10:00:00.000Z', read_at: null},
          {id: 'request-inquiry-2', sender_id: developerId, project_id: 'request-open', created_at: '2026-11-19T10:01:00.000Z', read_at: null},
          {id: 'request-client-reply', sender_id: userId, project_id: 'request-open', created_at: '2026-11-19T10:02:00.000Z', read_at: null},
          {id: 'request-inquiry-3', sender_id: developerId, project_id: 'request-open', created_at: '2026-11-19T10:03:00.000Z', read_at: null},
          {id: 'request-client-last', sender_id: userId, project_id: 'request-open', created_at: '2026-11-21T10:04:00.000Z', read_at: null},
          {id: 'second-project-contact', sender_id: userId, project_id: 'second-developer-project', created_at: '2026-11-22T10:00:00.000Z', read_at: null}
        ]
      }
    ]
  };
  const result = dashboard({
    conversations: [
      root,
      {
        id: 'merged-source',
        participant_a_id: userId,
        participant_b_id: developerId,
        participant_a_role: 'client',
        participant_b_role: 'dev',
        project_id: 'developer-project',
        merged_into: 'parent-thread',
        messages: [{id: 'request-inquiry-1', sender_id: developerId, created_at: recent, read_at: null}]
      },
      {
        id: 'empty-thread',
        participant_a_id: userId,
        participant_b_id: developerId,
        participant_a_role: 'client',
        participant_b_role: 'dev',
        project_id: 'request-open',
        merged_into: null,
        messages: []
      }
    ]
  });

  assert.equal(result.metrics.newInquiries, 2);
  assert.equal(result.metrics.awaitingDeveloperReply, 1);
  assert.equal(result.postedRequests[0].inquiries, 1);
  assert.equal(result.sentConversations.length, 2);
  assert.deepEqual(result.sentConversations.map(item => item.projectId), [
    'second-developer-project', 'developer-project'
  ]);
  assert(result.sentConversations.every(item => item.conversationId === 'parent-thread'));
  assert.equal(result.sentConversations[0].status, 'awaiting-reply');
  assert.equal(result.sentConversations[1].status, 'replied');
  assert.equal(result.attention.filter(item => item.type === 'inquiry').length, 2);
  assert(result.attention.every(item => item.conversationId !== 'merged-source'));
});

test('client home checklist uses completed profile, viewed project, and posted request state', () => {
  const result = dashboard({
    profileComplete: true,
    hasExploredProjects: true,
    requests: [
      {id: 'request-draft', owner_id: userId, project_kind: 'request', status: 'draft'}
    ]
  });

  assert.deepEqual(result.gettingStarted, {
    profileComplete: true,
    exploredProjects: true,
    postedRequest: false
  });
});
