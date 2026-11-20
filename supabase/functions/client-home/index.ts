import {getCorsHeaders, jsonResponse} from '../_shared/registration.mjs';
import {buildClientDashboard} from './logic.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 500;

class ClientHomeError extends Error {
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function serviceHeaders(serviceRoleKey: string, authorization?: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: authorization || `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json'
  };
}

function restUrl(supabaseUrl: string, path: string, query: Record<string, string>) {
  const params = new URLSearchParams(query);
  return `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${path}?${params}`;
}

async function fetchRows(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  query: Record<string, string>
) {
  const rows: Record<string, any>[] = [];
  const requestedLimit = Number(query.limit);
  const pageSize = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, PAGE_SIZE)
    : PAGE_SIZE;
  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(restUrl(supabaseUrl, path, {
      ...query,
      limit: String(pageSize),
      offset: String(offset)
    }), {headers: serviceHeaders(serviceRoleKey)});
    if (!response.ok) {
      console.error(`Client home database request failed (${response.status}).`);
      throw new ClientHomeError('Unable to load your dashboard data.', 503);
    }
    const page = await response.json();
    if (!Array.isArray(page)) throw new ClientHomeError('Dashboard data is invalid.', 503);
    rows.push(...page);
    if (page.length < pageSize || query.limit) return rows;
  }
}

async function authenticateUser(request: Request, supabaseUrl: string, serviceRoleKey: string) {
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    throw new ClientHomeError('A valid session is required.', 401);
  }
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: serviceHeaders(serviceRoleKey, authorization)
  });
  if (response.status === 401 || response.status === 403) {
    throw new ClientHomeError('Your session is invalid or expired. Please log in again.', 401);
  }
  if (!response.ok) throw new ClientHomeError('Unable to verify your session.', 503);
  const user = await response.json();
  if (!UUID_PATTERN.test(user?.id || '')) {
    throw new ClientHomeError('Your session is invalid or expired. Please log in again.', 401);
  }
  return user;
}

async function requireClientWorkspace(userId: string, supabaseUrl: string, serviceRoleKey: string) {
  const profiles = await fetchRows(supabaseUrl, serviceRoleKey, 'profiles', {
    select: 'id,account_role,onboarding_complete',
    id: `eq.${userId}`
  });
  const profile = profiles[0];
  if (profile?.account_role === 'client') return profile.onboarding_complete === true;
  const workspaces = await fetchRows(supabaseUrl, serviceRoleKey, 'account_workspaces', {
    select: 'user_id,role,onboarding_complete',
    user_id: `eq.${userId}`,
    role: 'eq.client'
  });
  if (!workspaces.length) throw new ClientHomeError('Client workspace not found.', 403);
  return workspaces[0].onboarding_complete === true;
}

function inFilter(ids: string[]) {
  if (ids.some(id => typeof id !== 'string' || !id || id.length > 160 || /[\u0000-\u001f\u007f]/.test(id))) {
    throw new ClientHomeError('Dashboard data contains an invalid identifier.', 503);
  }
  return `in.(${ids.map(id => `"${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')})`;
}

async function loadDashboard(
  userId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  profileComplete: boolean
) {
  const requests = await fetchRows(supabaseUrl, serviceRoleKey, 'projects', {
    select: 'id,owner_id,project_kind,title,status,price,data,created_at,updated_at',
    owner_id: `eq.${userId}`,
    project_kind: 'eq.request',
    order: 'created_at.desc,id.asc'
  });
  const parents = await fetchRows(supabaseUrl, serviceRoleKey, 'conversations', {
    select: 'id,participant_a_id,participant_b_id,participant_a_role,participant_b_role,project_id,workspace_pair_key,merged_into,updated_at,last_message_at',
    or: `(and(participant_a_id.eq.${userId},participant_a_role.eq.client),and(participant_b_id.eq.${userId},participant_b_role.eq.client))`,
    merged_into: 'is.null',
    order: 'last_message_at.desc.nullslast,updated_at.desc,id.asc'
  });
  const parentIds = parents.map(conversation => conversation.id);
  const children: Record<string, any>[] = [];
  for (let offset = 0; offset < parentIds.length; offset += 100) {
    children.push(...await fetchRows(supabaseUrl, serviceRoleKey, 'conversations', {
      select: 'id,participant_a_id,participant_b_id,participant_a_role,participant_b_role,project_id,workspace_pair_key,merged_into,updated_at,last_message_at',
      merged_into: inFilter(parentIds.slice(offset, offset + 100))
    }));
  }
  const conversationsById = new Map<string, Record<string, any>>();
  [...parents, ...children].forEach(conversation => conversationsById.set(conversation.id, conversation));
  const sourceIds = [...conversationsById.keys()];
  const messagesByConversation = new Map<string, Record<string, any>[]>();
  sourceIds.forEach(id => messagesByConversation.set(id, []));
  for (let offset = 0; offset < sourceIds.length; offset += 100) {
    const messageRows = await fetchRows(supabaseUrl, serviceRoleKey, 'messages', {
      select: 'id,conversation_id,sender_id,created_at,read_at,project_id,project_kind',
      conversation_id: inFilter(sourceIds.slice(offset, offset + 100)),
      order: 'created_at.asc,id.asc'
    });
    messageRows.forEach(message => messagesByConversation.get(message.conversation_id)?.push(message));
  }
  const childrenByParent = new Map<string, Record<string, any>[]>();
  parentIds.forEach(id => childrenByParent.set(id, []));
  const parentsById = new Map(parents.map(parent => [parent.id, parent]));
  children.forEach(child => {
    if (parentsById.get(child.merged_into)?.workspace_pair_key === child.workspace_pair_key) {
      childrenByParent.get(child.merged_into)?.push(child);
    }
  });
  const conversations = parents.map(parent => ({
    ...parent,
    sources: [parent, ...(childrenByParent.get(parent.id) || [])].map(source => ({
      ...source,
      messages: messagesByConversation.get(source.id) || []
    }))
  })).filter(conversation => conversation.sources.some(source => source.messages.length > 0));
  const projectViews = await fetchRows(supabaseUrl, serviceRoleKey, 'project_views', {
    select: 'project_id,projects!inner(project_kind,status)',
    viewer_id: `eq.${userId}`,
    'projects.project_kind': 'eq.portfolio',
    'projects.status': 'eq.published',
    limit: '1'
  });
  const engagements = await fetchRows(supabaseUrl, serviceRoleKey, 'project_engagements', {
    select: 'id,conversation_id,project_id,developer_id,client_completed_at,developer_completed_at,project_reviews(reviewer_id)',
    client_id: `eq.${userId}`,
    client_completed_at: 'not.is.null',
    developer_completed_at: 'not.is.null',
    order: 'client_completed_at.desc,id.asc'
  });
  const relatedProjectIds = [...new Set([
    ...conversations.flatMap(conversation => [
      conversation.project_id,
      ...conversation.sources.flatMap(source => [
        source.project_id,
        ...source.messages.map(message => message.project_id)
      ])
    ]),
    ...engagements.map(engagement => engagement.project_id)
  ].filter((id): id is string => typeof id === 'string'))]
    .filter(id => !requests.some(request => request.id === id));
  const relatedProjects = [];
  for (let offset = 0; offset < relatedProjectIds.length; offset += 100) {
    relatedProjects.push(...await fetchRows(supabaseUrl, serviceRoleKey, 'projects', {
      select: 'id,owner_id,project_kind,title,status',
      id: inFilter(relatedProjectIds.slice(offset, offset + 100))
    }));
  }
  const projects = [...requests, ...relatedProjects];
  const developerIds = [...new Set([
    ...conversations.map(conversation => conversation.participant_a_id === userId
      ? conversation.participant_b_id
      : conversation.participant_a_id),
    ...engagements.map(engagement => engagement.developer_id)
  ].filter((id): id is string => typeof id === 'string'))];
  let developers: {id: string; name: string}[] = [];
  for (let offset = 0; offset < developerIds.length; offset += 100) {
    const batch = developerIds.slice(offset, offset + 100);
    const [profiles, workspaces] = await Promise.all([
      fetchRows(supabaseUrl, serviceRoleKey, 'profiles', {
        select: 'id,username,display_name,account_role',
        id: inFilter(batch)
      }),
      fetchRows(supabaseUrl, serviceRoleKey, 'account_workspaces', {
        select: 'user_id,role,display_name',
        user_id: inFilter(batch),
        role: 'eq.dev'
      })
    ]);
    const workspaceNames = new Map(workspaces.map(workspace => [workspace.user_id, workspace.display_name]));
    developers.push(...profiles.filter(profile =>
      profile.account_role === 'dev' || workspaceNames.has(profile.id)
    ).map(profile => ({
      id: profile.id,
      name: String(
        (profile.account_role === 'dev' ? profile.display_name : '')
        || workspaceNames.get(profile.id)
        || profile.username
        || 'Developer'
      )
    })));
  }
  return buildClientDashboard({
    userId,
    requests,
    conversations,
    engagements,
    projects,
    developers,
    profileComplete,
    hasExploredProjects: projectViews.length > 0
  });
}

Deno.serve(async request => {
  const cors = getCorsHeaders(request.headers.get('origin'));
  if (!cors) return jsonResponse({error: 'Origin not allowed.'}, 403, null);
  if (request.method === 'OPTIONS') return new Response('ok', {headers: cors});
  if (request.method !== 'POST') return jsonResponse({error: 'Method not allowed.'}, 405, cors);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({error: 'Invalid dashboard request.'}, 400, cors);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || body.action !== 'dashboard') {
    return jsonResponse({error: 'Invalid dashboard request.'}, 400, cors);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Client home API requires Supabase server credentials.');
    return jsonResponse({error: 'Dashboard service is not configured.'}, 503, cors);
  }

  try {
    const user = await authenticateUser(request, supabaseUrl, serviceRoleKey);
    const profileComplete = await requireClientWorkspace(user.id, supabaseUrl, serviceRoleKey);
    const dashboard = await loadDashboard(user.id, supabaseUrl, serviceRoleKey, profileComplete);
    return jsonResponse({data: dashboard}, 200, cors);
  } catch (error) {
    if (error instanceof ClientHomeError) {
      return jsonResponse({error: error.message}, error.status, cors);
    }
    console.error('Unable to load client home data.', error);
    return jsonResponse({error: 'Unable to load your dashboard data.'}, 503, cors);
  }
});
