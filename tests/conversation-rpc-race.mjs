const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'TEST_ACCESS_TOKEN',
  'TEST_PEER_ID'
];

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const supabaseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
const anonKey = process.env.SUPABASE_ANON_KEY;
const accessToken = process.env.TEST_ACCESS_TOKEN;
const peerId = process.env.TEST_PEER_ID;
const userRole = process.env.TEST_USER_ROLE || 'client';
const peerRole = process.env.TEST_PEER_ROLE || 'dev';

async function request(path, init = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init.headers
    }
  });
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}) at ${path}`);
  }
  return response.json();
}

const user = await request('/auth/v1/user');
const [userA, userB] = [user.id, peerId].sort();
const pairKey = `${userA}:${userB}`;
const pairFilter = new URLSearchParams({
  select: 'id',
  pair_key: `eq.${pairKey}`,
  merged_into: 'is.null'
});
const existing = await request(`/rest/v1/conversations?${pairFilter}`);
if (existing.length) {
  throw new Error('Use an unused synthetic user pair so concurrent creation is exercised.');
}

async function getOrCreate() {
  const rows = await request('/rest/v1/rpc/get_or_create_conversation', {
    method: 'POST',
    body: JSON.stringify({
      p_peer_id: peerId,
      p_user_role: userRole,
      p_peer_role: peerRole,
      p_project_id: null
    })
  });
  if (!Array.isArray(rows) || rows.length !== 1 || !rows[0].id) {
    throw new Error('get_or_create_conversation returned an invalid result.');
  }
  return rows[0].id;
}

const concurrentIds = await Promise.all([getOrCreate(), getOrCreate()]);
const sequentialIds = [await getOrCreate(), await getOrCreate()];
const active = await request(`/rest/v1/conversations?${pairFilter}`);
const result = {
  concurrent_calls_returned_same_id: concurrentIds[0] === concurrentIds[1],
  sequential_calls_returned_same_id: sequentialIds[0] === sequentialIds[1],
  all_calls_returned_same_id: new Set([...concurrentIds, ...sequentialIds]).size === 1,
  active_conversation_count: active.length
};

if (!result.concurrent_calls_returned_same_id
  || !result.sequential_calls_returned_same_id
  || !result.all_calls_returned_same_id
  || result.active_conversation_count !== 1) {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}
