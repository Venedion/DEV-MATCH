import {getCorsHeaders, jsonResponse} from '../_shared/registration.mjs';
import {
  decryptBinary,
  decryptMessage,
  encryptBinary,
  encryptMessage,
  sanitizeMessageText
} from '../_shared/chat-crypto.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 5000;
const INITIAL_MESSAGE_ROWS = 75;
const MAX_MESSAGE_ROWS = 200;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const MAX_PROPOSAL_ATTACHMENTS = 5;
const MAX_PROPOSAL_ATTACHMENT_TOTAL_BYTES = 2 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed'
]);
const ALLOWED_PROPOSAL_ATTACHMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

class ChatApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

function decodeKey(value) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new TypeError('Invalid chat encryption key encoding.');
  }
  const key = Uint8Array.from(atob(value), character => character.charCodeAt(0));
  if (key.length !== 32) throw new TypeError('Chat encryption keys must be 32 bytes.');
  return key;
}

function loadKeyring() {
  const rawKeys = Deno.env.get('CHAT_ENCRYPTION_KEYS');
  const activeVersion = Number(Deno.env.get('CHAT_ACTIVE_ENCRYPTION_KEY_VERSION'));
  if (!rawKeys || !Number.isSafeInteger(activeVersion) || activeVersion < 1 || activeVersion > 32767) {
    throw new TypeError('Chat encryption secrets are not configured.');
  }

  const parsed = JSON.parse(rawKeys);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Chat encryption keyring must be a JSON object.');
  }

  const keys = new Map();
  for (const [version, encodedKey] of Object.entries(parsed)) {
    if (!/^[1-9]\d{0,4}$/.test(version) || Number(version) > 32767) {
      throw new TypeError('Chat encryption key versions must be positive small integers.');
    }
    keys.set(Number(version), decodeKey(encodedKey));
  }
  if (!keys.has(activeVersion)) throw new TypeError('The active chat encryption key is missing.');
  return {keys, activeVersion};
}

function supabaseHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function resourceUrl(supabaseUrl, path, query) {
  const params = new URLSearchParams(query);
  return `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${path}?${params}`;
}

function storageObjectUrl(supabaseUrl, path) {
  const encodedPath = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${encodedPath}`;
}

function decodeAttachmentBase64(value) {
  if (typeof value !== 'string'
    || value.length > Math.ceil(MAX_ATTACHMENT_BYTES * 4 / 3) + 4
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new ChatApiError('Choose a supported attachment up to 2 MB.', 400);
  }
  const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0));
  if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES) {
    throw new ChatApiError('Choose a supported attachment up to 2 MB.', 400);
  }
  return bytes;
}

function encodeBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function safeAttachmentName(value) {
  if (typeof value !== 'string') throw new ChatApiError('The attachment name is invalid.', 400);
  const name = value.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!name || name.length > 180) throw new ChatApiError('The attachment name is invalid.', 400);
  return name;
}

async function uploadEncryptedAttachment(supabaseUrl, serviceRoleKey, path, ciphertext) {
  const response = await fetch(storageObjectUrl(supabaseUrl, path), {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/octet-stream',
      'x-upsert': 'false'
    },
    body: ciphertext
  });
  if (!response.ok) {
    console.error(`Encrypted chat attachment upload failed (${response.status}).`);
    throw new ChatApiError('Unable to upload the attachment.', 503);
  }
}

async function deleteChatAttachment(supabaseUrl, serviceRoleKey, path) {
  const [bucket, ...pathSegments] = path.split('/');
  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({prefixes: [pathSegments.join('/')]})
    }
  );
  if (!response.ok && response.status !== 404) {
    console.error(`Chat attachment cleanup failed (${response.status}).`);
  }
}

async function downloadEncryptedAttachment(supabaseUrl, serviceRoleKey, path) {
  const response = await fetch(storageObjectUrl(supabaseUrl, path), {
    headers: {apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`}
  });
  if (!response.ok) {
    console.error(`Encrypted chat attachment download failed (${response.status}).`);
    throw new ChatApiError('Unable to download this attachment.', 503);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function requestRows(supabaseUrl, serviceRoleKey, path, query, init = {}) {
  const response = await fetch(resourceUrl(supabaseUrl, path, query), {
    ...init,
    headers: supabaseHeaders(serviceRoleKey, init.headers)
  });
  if (!response.ok) {
    console.error(`Chat database request failed (${response.status}).`);
    throw new ChatApiError('Chat service is temporarily unavailable.', 503);
  }
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new ChatApiError('Chat service returned an invalid response.');
  return rows;
}

async function requestRpc(supabaseUrl, serviceRoleKey, functionName, body) {
  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${functionName}`,
    {
      method: 'POST',
      headers: supabaseHeaders(serviceRoleKey),
      body: JSON.stringify(body)
    }
  );
  if (!response.ok) {
    console.error(`Chat database operation ${functionName} failed (${response.status}).`);
    if (response.status === 400 || response.status === 422) {
      throw new ChatApiError('The proposal details or status are no longer valid.', 400);
    }
    if (response.status === 403) {
      throw new ChatApiError('You are not allowed to perform this proposal action.', 403);
    }
    if (response.status === 404) {
      throw new ChatApiError('Proposal not found.', 404);
    }
    if (response.status === 409) {
      throw new ChatApiError('The proposal has already been updated.', 409);
    }
    throw new ChatApiError('Chat service is temporarily unavailable.', 503);
  }
  return response.json();
}

async function authenticateUser(request, supabaseUrl, serviceRoleKey) {
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    throw new ChatApiError('A valid session is required.', 401);
  }
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {apikey: serviceRoleKey, Authorization: authorization}
  });
  if (response.status === 401 || response.status === 403) {
    throw new ChatApiError('Your session is invalid or expired. Please log in again.', 401);
  }
  if (!response.ok) throw new ChatApiError('Unable to verify your session.', 503);
  const user = await response.json();
  if (!UUID_PATTERN.test(user?.id || '')) {
    throw new ChatApiError('Your session is invalid or expired. Please log in again.', 401);
  }
  return user;
}

async function getConversation(supabaseUrl, serviceRoleKey, conversationId) {
  if (typeof conversationId !== 'string' || !UUID_PATTERN.test(conversationId)) {
    throw new ChatApiError('A valid conversation is required.', 400);
  }
  const rows = await requestRows(supabaseUrl, serviceRoleKey, 'conversations', {
    select: 'id,participant_a_id,participant_b_id,participant_a_role,participant_b_role,project_id,pair_key,workspace_pair_key,merged_into,updated_at,last_message_at',
    id: `eq.${conversationId}`,
    limit: '1'
  });
  return rows[0] || null;
}

async function getThreadRoot(supabaseUrl, serviceRoleKey, conversation) {
  if (!conversation) return null;
  if (!conversation.merged_into) return conversation;
  const rows = await requestRows(supabaseUrl, serviceRoleKey, 'conversations', {
    select: 'id,participant_a_id,participant_b_id,participant_a_role,participant_b_role,project_id,pair_key,workspace_pair_key,merged_into,updated_at,last_message_at',
    id: `eq.${conversation.merged_into}`,
    workspace_pair_key: `eq.${conversation.workspace_pair_key}`,
    merged_into: 'is.null',
    limit: '1'
  });
  return rows[0] || null;
}

async function getThreadSources(supabaseUrl, serviceRoleKey, conversation) {
  const pairRoleKey = row => {
    if (!row.pair_key) return `conversation:${row.id}`;
    const participants = [
      `${row.participant_a_id}:${row.participant_a_role}`,
      `${row.participant_b_id}:${row.participant_b_role}`
    ].sort();
    return JSON.stringify([row.pair_key, participants]);
  };
  const threadKey = pairRoleKey(conversation);
  const roots = conversation.pair_key ? await requestRows(supabaseUrl, serviceRoleKey, 'conversations', {
    select: 'id,participant_a_id,participant_b_id,participant_a_role,participant_b_role,project_id,pair_key,workspace_pair_key,merged_into,created_at,is_primary',
    pair_key: `eq.${conversation.pair_key}`,
    merged_into: 'is.null',
    limit: '1000'
  }) : [];
  const threadRoots = roots.filter(root => pairRoleKey(root) === threadKey);
  if (!threadRoots.some(root => root.id === conversation.id)) threadRoots.push(conversation);
  threadRoots.sort((a, b) => {
    const primaryOrder = Number(b.is_primary === true) - Number(a.is_primary === true);
    if (primaryOrder) return primaryOrder;
    const createdAtOrder = Date.parse(a.created_at || '') - Date.parse(b.created_at || '');
    if (Number.isFinite(createdAtOrder) && createdAtOrder) return createdAtOrder;
    return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
  });
  const rootIds = threadRoots.map(root => root.id);
  const rootsById = new Map(threadRoots.map(root => [root.id, root]));
  const children = await requestRows(supabaseUrl, serviceRoleKey, 'conversations', {
    select: 'id,participant_a_id,participant_b_id,participant_a_role,participant_b_role,project_id,pair_key,workspace_pair_key,merged_into',
    merged_into: `in.(${rootIds.join(',')})`,
    ...(conversation.pair_key ? {pair_key: `eq.${conversation.pair_key}`} : {}),
    limit: '1000'
  });
  return [
    ...threadRoots,
    ...children.filter(child =>
      rootsById.has(child.merged_into) && pairRoleKey(child) === threadKey
    )
  ];
}

function workspacePairKey(userId, userRole, peerId, peerRole, projectId = null) {
  const participants = [
    {id: userId.toLowerCase(), role: userRole},
    {id: peerId.toLowerCase(), role: peerRole}
  ].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const projectKey = projectId == null
    ? '0:'
    : `${Array.from(projectId).length}:${projectId}`;
  return `${participants[0].id}:${participants[0].role}:${participants[1].id}:${participants[1].role}:${projectKey}`;
}

function userIsParticipant(conversation, userId, workspaceRole) {
  if (!conversation) return false;
  if (conversation.participant_a_id === userId) {
    return conversation.participant_a_role === workspaceRole;
  }
  if (conversation.participant_b_id === userId) {
    return conversation.participant_b_role === workspaceRole;
  }
  return false;
}

async function decryptRow(row, keyring) {
  const key = keyring.keys.get(Number(row.key_version));
  if (!key) {
    console.error(`Chat encryption key version ${row.key_version} is unavailable.`);
    throw new ChatApiError('This message cannot be decrypted right now.');
  }
  const context = {
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    keyVersion: Number(row.key_version)
  };
  const plaintext = await decryptMessage(row, context, key);
  let text = plaintext;
  let attachments = [];
  try {
    const payload = JSON.parse(plaintext);
    if (payload?.version === 1 && typeof payload.text === 'string' && Array.isArray(payload.attachments)) {
      text = payload.text;
      attachments = payload.attachments.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        size: item.size
      }));
    }
  } catch {
    // Older encrypted messages contain plain text rather than a structured payload.
  }
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    proposal_id: row.proposal_id || null,
    text: sanitizeMessageText(text),
    attachments,
    created_at: row.created_at,
    read_at: row.read_at
  };
}

async function attachMessageProjectContexts(
  messages,
  rows,
  conversation,
  supabaseUrl,
  serviceRoleKey
) {
  const projectIds = [...new Set(rows
    .map(row => row.project_id || row.project_reference_id)
    .filter(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(id)))];
  if (!projectIds.length) return messages;

  const projects = [];
  for (let offset = 0; offset < projectIds.length; offset += 100) {
    const batch = projectIds.slice(offset, offset + 100);
    projects.push(...await requestRows(supabaseUrl, serviceRoleKey, 'projects', {
      select: 'id,owner_id,project_kind,status,title,price,cover_image',
      id: `in.(${batch.join(',')})`
    }));
  }
  const projectsById = new Map(projects.map(project => [project.id, project]));
  const requestOwnerIds = [...new Set(projects
    .filter(project => project.project_kind === 'request')
    .map(project => project.owner_id)
    .filter(id => typeof id === 'string'))];
  const clientProfiles = requestOwnerIds.length
    ? await requestRows(supabaseUrl, serviceRoleKey, 'directory_people', {
        select: 'id,display_name,username',
        id: `in.(${requestOwnerIds.join(',')})`,
        account_role: 'eq.client'
      })
    : [];
  const clientProfilesById = new Map(clientProfiles.map(profile => [profile.id, profile]));
  return messages.map((message, index) => {
    const row = rows[index];
    const projectId = row.project_id || row.project_reference_id;
    const project = projectsById.get(projectId);
    const ownerRole = project?.owner_id === conversation.participant_a_id
      ? conversation.participant_a_role
      : project?.owner_id === conversation.participant_b_id
        ? conversation.participant_b_role
        : null;
    const senderRole = row.sender_id === conversation.participant_a_id
      ? conversation.participant_a_role
      : row.sender_id === conversation.participant_b_id
        ? conversation.participant_b_role
        : null;
    const expectedOwnerRole = project?.project_kind === 'portfolio'
      ? 'dev'
      : project?.project_kind === 'request'
        ? 'client'
        : null;
    const expectedSenderRole = project?.project_kind === 'portfolio'
      ? 'client'
      : project?.project_kind === 'request'
        ? 'dev'
        : null;
    const isAvailable = project?.id === projectId
      && expectedOwnerRole === ownerRole
      && expectedSenderRole === senderRole
      && project.project_kind === row.project_kind
      && (project.project_kind === 'portfolio' && project.status === 'published'
        || project.project_kind === 'request' && project.status === 'open');
    if (!isAvailable) return message;

    return {
      ...message,
      project_context: {
        id: project.id,
        project_kind: project.project_kind,
        title: project.title,
        price: project.price,
        cover_image: project.cover_image || null,
        client_name: project.project_kind === 'request'
          ? clientProfilesById.get(project.owner_id)?.display_name
            || clientProfilesById.get(project.owner_id)?.username
            || null
          : null,
        available: true
      }
    };
  });
}

function exposeProposal(row, agreement = null, paymentState = null) {
  const paymentRoom = paymentState?.room || null;
  const ratings = paymentRoom?.ratings || {};
  const payments = Array.isArray(paymentState?.payments) ? paymentState.payments : [];
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    developer_id: row.developer_id,
    client_id: row.client_id,
    terms: row.terms,
    attachments: (Array.isArray(row.attachments) ? row.attachments : []).map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      size: item.size
    })),
    status: row.status,
    creator_id: row.creator_id || row.developer_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    accepted_at: row.accepted_at,
    withdrawn_at: row.withdrawn_at,
    agreement: agreement ? {
      id: agreement.id,
      payment_status: agreement.payment_status,
      dp_payment_status: payments.findLast(payment => payment.kind === 'DP')?.status ?? null,
      remaining_payment_status: payments.findLast(payment => payment.kind === 'REMAINING')?.status ?? null,
      escrow_status: paymentRoom?.escrow || 'AWAITING_DP',
      project_status: paymentRoom?.project || 'NOT_STARTED',
      progress_review_status: paymentRoom?.progressReview?.status || null,
      progress_submitted_at: paymentRoom?.timeline?.progressSubmittedAt || null,
      progress_approved: Boolean(paymentRoom?.progressReview?.approvedAt),
      final_proof_shared: Boolean(
        paymentRoom?.timeline?.finalProofSharedAt || paymentRoom?.delivery?.at
      ),
      final_proof_url: paymentRoom?.delivery?.links?.[0] || null,
      handover_status: paymentRoom?.handover?.status || null,
      dispute_status: paymentRoom?.dispute?.status || null,
      client_rated: Boolean(ratings.client),
      developer_rated: Boolean(ratings.developer),
      created_at: agreement.created_at
    } : null
  };
}

async function getProposalDetailsByIds(supabaseUrl, serviceRoleKey, proposalIds) {
  const ids = [...new Set(proposalIds.filter(id =>
    typeof id === 'string' && UUID_PATTERN.test(id)
  ))];
  if (!ids.length) return new Map();
  const [proposals, agreements] = await Promise.all([
    requestRows(supabaseUrl, serviceRoleKey, 'project_proposals', {
      select: 'id,conversation_id,developer_id,client_id,creator_id,terms,attachments,status,created_at,updated_at,accepted_at,withdrawn_at',
      id: `in.(${ids.join(',')})`
    }),
    requestRows(supabaseUrl, serviceRoleKey, 'project_agreements', {
      select: 'id,proposal_id,payment_status,created_at',
      proposal_id: `in.(${ids.join(',')})`
    })
  ]);
  const agreementsByProposal = new Map(agreements.map(agreement => [agreement.proposal_id, agreement]));
  const agreementIds = agreements.map(agreement => agreement.id);
  const paymentRooms = agreementIds.length
    ? await requestRows(supabaseUrl, serviceRoleKey, 'payment_agreement_rooms', {
      select: 'agreement_id,state',
      agreement_id: `in.(${agreementIds.join(',')})`
    })
    : [];
  const stateByAgreement = new Map(paymentRooms.map(paymentRoom => [
    paymentRoom.agreement_id, paymentRoom.state || null
  ]));
  return new Map(proposals.map(proposal => {
    const agreement = agreementsByProposal.get(proposal.id);
    return [proposal.id, exposeProposal(proposal, agreement, stateByAgreement.get(agreement?.id))];
  }));
}

async function attachProposalDetails(messages, rows, supabaseUrl, serviceRoleKey) {
  const proposalsById = await getProposalDetailsByIds(
    supabaseUrl,
    serviceRoleKey,
    rows.map(row => row.proposal_id).filter(Boolean)
  );
  return messages.map((message, index) => {
    const proposal = proposalsById.get(rows[index]?.proposal_id);
    return proposal ? {...message, proposal} : message;
  });
}

async function getAccount(supabaseUrl, serviceRoleKey, userId, role = null) {
  const profiles = await requestRows(supabaseUrl, serviceRoleKey, 'profiles', {
    select: 'id,account_role,onboarding_complete',
    id: `eq.${userId}`,
    limit: '1'
  });
  const primary = profiles[0];
  if (!primary || !role || primary.account_role === role) return primary || null;
  const workspaces = await requestRows(supabaseUrl, serviceRoleKey, 'account_workspaces', {
    select: 'role,onboarding_complete', user_id: `eq.${userId}`, role: `eq.${role}`, limit: '1'
  });
  const workspace = workspaces[0];
  return workspace ? {...primary, account_role: workspace.role, onboarding_complete: workspace.onboarding_complete} : null;
}

async function getPublicAccount(supabaseUrl, serviceRoleKey, userId, role) {
  const accounts = await requestRows(supabaseUrl, serviceRoleKey, 'directory_people', {
    select: 'id,account_role',
    account_role: `eq.${role}`,
    id: `eq.${userId}`,
    limit: '1'
  });
  return accounts[0] || null;
}

async function findConversation(
  supabaseUrl,
  serviceRoleKey,
  userId,
  userRole,
  participantId,
  participantRole,
  projectId = null
) {
  const pairKey = workspacePairKey(userId, userRole, participantId, participantRole, projectId);
  const rows = await requestRows(supabaseUrl, serviceRoleKey, 'conversations', {
    select: 'id,participant_a_id,participant_b_id,participant_a_role,participant_b_role,project_id,pair_key,workspace_pair_key,merged_into,updated_at,last_message_at',
    workspace_pair_key: `eq.${pairKey}`,
    merged_into: 'is.null',
    order: 'is_primary.desc,created_at.asc,id.asc',
    limit: '1'
  });
  const conversation = rows[0];
  if (!conversation) return null;
  const sources = await getThreadSources(supabaseUrl, serviceRoleKey, conversation);
  return {
    ...conversation,
    source_conversations: sources.map(source => ({
      id: source.id,
      my_role: source.participant_a_id === userId
        ? source.participant_a_role
        : source.participant_b_role
    }))
  };
}

async function startConversation(
  supabaseUrl,
  serviceRoleKey,
  userId,
  participantId,
  userRole,
  participantRole,
  projectId,
  authorization,
  existingConversation
) {
  const existing = existingConversation === undefined
    ? await findConversation(
      supabaseUrl,
      serviceRoleKey,
      userId,
      userRole,
      participantId,
      participantRole,
      projectId
    )
    : existingConversation;
  if (existing) return existing;

  if (!authorization) throw new ChatApiError('A valid session is required.', 401);
  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/get_or_create_conversation`,
      {
        method: 'POST',
        headers: supabaseHeaders(serviceRoleKey, {Authorization: authorization}),
        body: JSON.stringify({
          p_peer_id: participantId,
          p_user_role: userRole,
          p_peer_role: participantRole,
          p_project_id: projectId
        })
      }
    );
    if (!response.ok) {
      console.error(`Chat conversation creation failed (${response.status}).`);
      throw new ChatApiError('Unable to start this conversation.', 503);
    }
    const rows = await response.json();
    if (Array.isArray(rows) && rows[0]) return rows[0];
    throw new ChatApiError('Chat service returned an invalid response.');
  } catch (error) {
    if (error instanceof ChatApiError) throw error;
    console.error('Chat conversation creation request failed.', error);
    throw new ChatApiError('Unable to start this conversation.', 503);
  }
}

function validateProposalTerms(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ChatApiError('Complete the proposal details before sending.', 400);
  }
  const projectName = typeof value.projectName === 'string' ? value.projectName.trim() : '';
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  const totalPriceText = String(value.totalPrice ?? '').replace(/\D/g, '');
  const totalPrice = Number(totalPriceText);
  const dpPercent = Number(value.dpPercent);
  const deadline = typeof value.deadline === 'string' ? value.deadline : '';
  const scope = Array.isArray(value.scope)
    ? value.scope.map(item => typeof item === 'string' ? item.trim() : '')
    : [];
  const revisionCount = Number(value.revisionCount);
  const revisionNotes = typeof value.revisionNotes === 'string'
    ? value.revisionNotes.trim()
    : '';

  if (!projectName || projectName.length > 80) {
    throw new ChatApiError('Project name must contain 1 to 80 characters.', 400);
  }
  if (!description || description.length > 1000) {
    throw new ChatApiError('Description must contain 1 to 1,000 characters.', 400);
  }
  if (!Number.isSafeInteger(totalPrice) || totalPrice < 40000 || totalPrice > 1000000000) {
    throw new ChatApiError('Enter a total price between Rp40,000 and Rp1 billion.', 400);
  }
  if (![25, 50].includes(dpPercent)) {
    throw new ChatApiError('Choose a 25% or 50% down payment.', 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)
    || !Number.isFinite(Date.parse(`${deadline}T00:00:00Z`))
    || deadline < new Date().toISOString().slice(0, 10)) {
    throw new ChatApiError('Choose a valid deadline that is today or later.', 400);
  }
  if (!scope.length || scope.length > 20
    || scope.some(item => !item || item.length > 300)) {
    throw new ChatApiError('Add 1 to 20 scope points, each up to 300 characters.', 400);
  }
  if (!Number.isInteger(revisionCount) || revisionCount < 0 || revisionCount > 99) {
    throw new ChatApiError('Choose between 0 and 99 free revision rounds.', 400);
  }
  if (revisionNotes.length > 300) {
    throw new ChatApiError('Revision notes must be 300 characters or fewer.', 400);
  }

  return {
    projectName,
    description,
    totalPrice,
    dpPercent,
    deadline,
    scope,
    revisionCount,
    revisionNotes
  };
}

async function requireParticipantConversation(
  conversationId,
  user,
  workspaceRole,
  supabaseUrl,
  serviceRoleKey
) {
  const requested = await getConversation(supabaseUrl, serviceRoleKey, conversationId);
  const conversation = await getThreadRoot(supabaseUrl, serviceRoleKey, requested);
  if (!userIsParticipant(conversation, user.id, workspaceRole)) {
    throw new ChatApiError('Conversation not found.', 404);
  }
  const sourceConversations = await getThreadSources(
    supabaseUrl,
    serviceRoleKey,
    conversation
  );
  return {conversation, sourceConversations};
}

async function handleAction(body, user, keyring, supabaseUrl, serviceRoleKey, authorization = null) {
  if (body.workspaceRole != null && !['client', 'dev'].includes(body.workspaceRole)) {
    throw new ChatApiError('Invalid workspace.', 400);
  }
  const account = await getAccount(supabaseUrl, serviceRoleKey, user.id, body.workspaceRole);
  if (!account) throw new ChatApiError('Workspace not found.', 403);
  const workspaceRole = account.account_role;

  if (body.action === 'create-project-proposal') {
    if (!['dev', 'client'].includes(workspaceRole)) {
      throw new ChatApiError('A Client or Developer workspace is required to create a project proposal.', 403);
    }
    const {conversation} = await requireParticipantConversation(
      body.conversationId, user, workspaceRole, supabaseUrl, serviceRoleKey
    );
    const terms = validateProposalTerms(body.terms);
    const inputAttachments = body.attachments === undefined ? [] : body.attachments;
    if (!Array.isArray(inputAttachments) || inputAttachments.length > MAX_PROPOSAL_ATTACHMENTS) {
      throw new ChatApiError('Choose up to five proposal attachments.', 400);
    }

    const proposalId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    const attachments = [];
    const uploadedPaths = [];
    let totalAttachmentBytes = 0;
    try {
      for (const input of inputAttachments) {
        if (!input || typeof input !== 'object' || Array.isArray(input)
          || !ALLOWED_PROPOSAL_ATTACHMENT_TYPES.has(input.type)) {
          throw new ChatApiError('Choose supported PDF, Word, JPG, PNG, or WebP attachments.', 400);
        }
        const name = safeAttachmentName(input.name);
        const bytes = decodeAttachmentBase64(input.base64);
        totalAttachmentBytes += bytes.length;
        if (totalAttachmentBytes > MAX_PROPOSAL_ATTACHMENT_TOTAL_BYTES) {
          throw new ChatApiError('Proposal attachments must total no more than 2 MB.', 400);
        }

        const id = crypto.randomUUID();
        const keyVersion = keyring.activeVersion;
        const attachmentContext = {
          conversationId: `${proposalId}:attachment:${id}`,
          senderId: user.id,
          keyVersion
        };
        const encrypted = await encryptBinary(
          bytes,
          attachmentContext,
          keyring.keys.get(keyVersion)
        );
        const path = `chat-attachments/project-proposals/${proposalId}/${id}.bin`;
        await uploadEncryptedAttachment(supabaseUrl, serviceRoleKey, path, encrypted.ciphertext);
        uploadedPaths.push(path);
        attachments.push({
          id,
          path,
          name,
          type: input.type,
          size: bytes.length,
          nonce: encrypted.nonce,
          key_version: keyVersion
        });
      }

      const messageContext = {
        conversationId: conversation.id,
        senderId: user.id,
        keyVersion: keyring.activeVersion
      };
      const encryptedMessage = await encryptMessage(
        JSON.stringify({version: 1, text: 'Project proposal', attachments: []}),
        messageContext,
        keyring.keys.get(keyring.activeVersion)
      );
      await requestRpc(supabaseUrl, serviceRoleKey, 'create_project_proposal', {
        p_proposal_id: proposalId,
        p_message_id: messageId,
        p_conversation_id: conversation.id,
        p_actor_id: user.id,
        p_workspace_role: workspaceRole,
        p_terms: terms,
        p_attachments: attachments,
        p_ciphertext: encryptedMessage.ciphertext,
        p_nonce: encryptedMessage.nonce,
        p_key_version: keyring.activeVersion
      });

      const [messageRows] = await Promise.all([
        requestRows(supabaseUrl, serviceRoleKey, 'messages', {
          select: 'id,conversation_id,sender_id,ciphertext,nonce,key_version,created_at,read_at,proposal_id',
          id: `eq.${messageId}`,
          limit: '1'
        })
      ]);
      if (!messageRows[0]) throw new ChatApiError('Proposal message could not be loaded.', 503);
      const proposalMap = await getProposalDetailsByIds(supabaseUrl, serviceRoleKey, [proposalId]);
      const proposal = proposalMap.get(proposalId);
      if (!proposal) throw new ChatApiError('Proposal could not be loaded.', 503);
      const message = await decryptRow(messageRows[0], keyring);
      return {message: {...message, proposal}, proposal};
    } catch (error) {
      if (uploadedPaths.length) {
        await Promise.all(uploadedPaths.map(path =>
          deleteChatAttachment(supabaseUrl, serviceRoleKey, path)
        ));
      }
      throw error;
    }
  }

  if (body.action === 'accept-project-proposal' || body.action === 'withdraw-project-proposal') {
    if (!UUID_PATTERN.test(body.proposalId || '')) {
      throw new ChatApiError('This proposal action is not available in the selected workspace.', 403);
    }
    const {conversation, sourceConversations} = await requireParticipantConversation(
      body.conversationId, user, workspaceRole, supabaseUrl, serviceRoleKey
    );
    const proposals = await requestRows(supabaseUrl, serviceRoleKey, 'project_proposals', {
      select: 'id,conversation_id,developer_id,client_id,creator_id',
      id: `eq.${body.proposalId}`,
      limit: '1'
    });
    const proposal = proposals[0];
    if (!proposal || !sourceConversations.some(source => source.id === proposal.conversation_id)) {
      throw new ChatApiError('Proposal not found.', 404);
    }
    const creatorRole = proposal.creator_id === proposal.developer_id ? 'dev' : 'client';
    const recipientRole = creatorRole === 'dev' ? 'client' : 'dev';
    const isCreator = proposal.creator_id === user.id;
    if (body.action === 'accept-project-proposal'
      ? workspaceRole !== recipientRole || isCreator
      : workspaceRole !== creatorRole || !isCreator) {
      throw new ChatApiError('This proposal action is not available in the selected workspace.', 403);
    }

    if (body.action === 'accept-project-proposal') {
      const result = await requestRpc(supabaseUrl, serviceRoleKey, 'accept_project_proposal', {
        p_proposal_id: proposal.id,
        p_actor_id: user.id,
        p_workspace_role: workspaceRole
      });
      if (!result?.proposal || !result?.agreement) {
        throw new ChatApiError('Chat service returned an invalid accepted proposal.', 503);
      }
      return {
        proposal: exposeProposal(result.proposal, result.agreement),
        agreement: {
          id: result.agreement.id,
          payment_status: result.agreement.payment_status,
          created_at: result.agreement.created_at
        }
      };
    }

    const updated = await requestRpc(supabaseUrl, serviceRoleKey, 'withdraw_project_proposal', {
      p_proposal_id: proposal.id,
      p_actor_id: user.id,
      p_workspace_role: workspaceRole
    });
    if (!updated?.id) throw new ChatApiError('Chat service returned an invalid proposal.', 503);
    const [agreement] = await requestRows(supabaseUrl, serviceRoleKey, 'project_agreements', {
      select: 'id,proposal_id,payment_status,created_at',
      proposal_id: `eq.${proposal.id}`,
      limit: '1'
    });
    return {proposal: exposeProposal(updated, agreement || null)};
  }

  if (body.action === 'download-project-proposal-attachment') {
    if (!UUID_PATTERN.test(body.proposalId || '') || !UUID_PATTERN.test(body.attachmentId || '')) {
      throw new ChatApiError('A valid proposal attachment is required.', 400);
    }
    const {sourceConversations} = await requireParticipantConversation(
      body.conversationId, user, workspaceRole, supabaseUrl, serviceRoleKey
    );
    const proposals = await requestRows(supabaseUrl, serviceRoleKey, 'project_proposals', {
      select: 'id,conversation_id,developer_id,client_id,creator_id,attachments',
      id: `eq.${body.proposalId}`,
      limit: '1'
    });
    const proposal = proposals[0];
    if (!proposal
      || !sourceConversations.some(source => source.id === proposal.conversation_id)
      || ![proposal.developer_id, proposal.client_id].includes(user.id)) {
      throw new ChatApiError('Proposal attachment not found.', 404);
    }
    const item = (Array.isArray(proposal.attachments) ? proposal.attachments : [])
      .find(attachment => attachment?.id === body.attachmentId);
    if (!item
      || item.path !== `chat-attachments/project-proposals/${proposal.id}/${item.id}.bin`
      || !ALLOWED_PROPOSAL_ATTACHMENT_TYPES.has(item.type)
      || !Number.isInteger(item.size)
      || item.size < 1
      || item.size > MAX_ATTACHMENT_BYTES
      || !/^[A-Za-z0-9_-]{16}$/.test(item.nonce || '')) {
      throw new ChatApiError('Proposal attachment not found.', 404);
    }
    const attachmentKey = keyring.keys.get(Number(item.key_version));
    if (!attachmentKey) throw new ChatApiError('This attachment cannot be decrypted right now.', 503);
    const encryptedBytes = await downloadEncryptedAttachment(
      supabaseUrl, serviceRoleKey, item.path
    );
    const attachmentContext = {
      conversationId: `${proposal.id}:attachment:${item.id}`,
      senderId: proposal.creator_id || proposal.developer_id,
      keyVersion: Number(item.key_version)
    };
    const bytes = await decryptBinary(
      {ciphertext: encryptedBytes, nonce: item.nonce},
      attachmentContext,
      attachmentKey
    );
    if (bytes.length !== item.size) {
      throw new ChatApiError('The proposal attachment data is invalid.', 503);
    }
    return {name: safeAttachmentName(item.name), type: item.type, size: bytes.length, base64: encodeBase64(bytes)};
  }

  const dashboardConversationPreview = body.action === 'list-dashboard-conversations';
  if (body.action === 'list-conversations' || dashboardConversationPreview) {
    const parents = await requestRows(supabaseUrl, serviceRoleKey, 'conversations', {
      select: 'id,participant_a_id,participant_b_id,participant_a_role,participant_b_role,project_id,pair_key,workspace_pair_key,merged_into,created_at,is_primary,updated_at,last_message_at,messages(id,conversation_id,sender_id,ciphertext,nonce,key_version,created_at,read_at,proposal_id)',
      or: `(and(participant_a_id.eq.${user.id},participant_a_role.eq.${workspaceRole}),and(participant_b_id.eq.${user.id},participant_b_role.eq.${workspaceRole}))`,
      merged_into: 'is.null',
      'messages.order': 'created_at.desc',
      'messages.limit': '1',
      order: 'last_message_at.desc.nullslast,updated_at.desc',
      limit: '100'
    });
    const parentIds = parents.map(conversation => conversation.id);
    const children = parentIds.length ? await requestRows(supabaseUrl, serviceRoleKey, 'conversations', {
      select: 'id,participant_a_id,participant_b_id,participant_a_role,participant_b_role,project_id,pair_key,workspace_pair_key,merged_into,updated_at,last_message_at,messages(id,conversation_id,sender_id,ciphertext,nonce,key_version,created_at,read_at,proposal_id)',
      merged_into: `in.(${parentIds.join(',')})`,
      'messages.order': 'created_at.desc',
      'messages.limit': '1',
      limit: '1000'
    }) : [];
    const pairRoleKey = conversation => {
      if (!conversation.pair_key) return `conversation:${conversation.id}`;
      const participants = [
        `${conversation.participant_a_id}:${conversation.participant_a_role}`,
        `${conversation.participant_b_id}:${conversation.participant_b_role}`
      ].sort();
      return JSON.stringify([conversation.pair_key, participants]);
    };
    const childrenByParent = new Map(parentIds.map(id => [id, []]));
    const parentsById = new Map(parents.map(parent => [parent.id, parent]));
    children.forEach(child => {
      if (
        parentsById.has(child.merged_into)
        && pairRoleKey(parentsById.get(child.merged_into)) === pairRoleKey(child)
      ) {
        childrenByParent.get(child.merged_into)?.push(child);
      }
    });

    const rootsByPair = new Map();
    parents.forEach(parent => {
      const key = pairRoleKey(parent);
      if (!rootsByPair.has(key)) rootsByPair.set(key, []);
      rootsByPair.get(key).push(parent);
    });
    const compareRoots = (a, b) => {
      const primaryOrder = Number(b.is_primary === true) - Number(a.is_primary === true);
      if (primaryOrder) return primaryOrder;
      const createdAtOrder = Date.parse(a.created_at || '') - Date.parse(b.created_at || '');
      if (Number.isFinite(createdAtOrder) && createdAtOrder) return createdAtOrder;
      return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
    };
    const threadMessages = [...rootsByPair.values()].map(roots => {
      roots.sort(compareRoots);
      const conversation = roots[0];
      const sourceConversations = roots.flatMap(root => [
        root,
        ...(childrenByParent.get(root.id) || [])
      ]);
      const sourceMessages = sourceConversations
        .flatMap(source => Array.isArray(source.messages) ? source.messages : [])
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const last = sourceMessages[0] || null;
      const lastSource = last
        ? sourceConversations.find(source => source.id === last.conversation_id)
        : null;
      const contextRoot = lastSource?.merged_into
        ? sourceConversations.find(source => source.id === lastSource.merged_into)
        : lastSource;
      return {
        conversation,
        sourceConversations,
        last,
        contextProjectId: contextRoot?.project_id || null
      };
    }).filter(thread => thread.last);
    const selectedThreadMessages = dashboardConversationPreview
      ? threadMessages.slice().sort((first, second) => {
        const firstDate = Date.parse(first.last?.created_at || first.conversation.updated_at || '');
        const secondDate = Date.parse(second.last?.created_at || second.conversation.updated_at || '');
        return (Number.isFinite(secondDate) ? secondDate : 0) - (Number.isFinite(firstDate) ? firstDate : 0);
      }).slice(0, 5)
      : threadMessages;
    const projectIds = [...new Set(selectedThreadMessages
      .map(({contextProjectId}) => contextProjectId)
      .filter(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(id)))];
    const projects = [];
    for (let offset = 0; offset < projectIds.length; offset += 100) {
      const batch = projectIds.slice(offset, offset + 100);
      projects.push(...await requestRows(supabaseUrl, serviceRoleKey, 'projects', {
        select: 'id,owner_id,project_kind,status,title,category,price,cover_image,data',
        id: `in.(${batch.join(',')})`
      }));
    }
    const projectsById = new Map(projects.map(project => [project.id, project]));
    const ids = [...new Set(selectedThreadMessages.map(({conversation}) =>
      conversation.participant_a_id === user.id ? conversation.participant_b_id : conversation.participant_a_id
    ))];
    const [identities, workspaces] = ids.length ? await Promise.all([
      requestRows(supabaseUrl, serviceRoleKey, 'profiles', {select:'id,username,display_name,account_role', id:`in.(${ids.join(',')})`}),
      requestRows(supabaseUrl, serviceRoleKey, 'account_workspaces', {select:'user_id,role,display_name', user_id:`in.(${ids.join(',')})`})
    ]) : [[], []];
    const proposalsById = await getProposalDetailsByIds(
      supabaseUrl,
      serviceRoleKey,
      selectedThreadMessages.map(thread => thread.last?.proposal_id).filter(Boolean)
    );
    const mapped = await Promise.all(selectedThreadMessages.map(async ({conversation, sourceConversations, last, contextProjectId}) => {
      const {messages, ...details} = conversation;
      delete details.created_at;
      delete details.is_primary;
      const partnerId = conversation.participant_a_id === user.id ? conversation.participant_b_id : conversation.participant_a_id;
      const partnerRole = conversation.participant_a_id === user.id ? conversation.participant_b_role : conversation.participant_a_role;
      const identity = identities.find(p => p.id === partnerId);
      const profile = identity?.account_role === partnerRole ? identity : workspaces.find(w => w.user_id === partnerId && w.role === partnerRole);
      const contextProject = contextProjectId ? projectsById.get(contextProjectId) : null;
      const lastMessage = await decryptRow(last, keyring);
      const proposal = proposalsById.get(last.proposal_id);
      const contextKind = contextProject?.project_kind || null;
      const developerName = contextProject?.project_kind === 'portfolio'
        ? workspaces.find(workspace => workspace.user_id === partnerId && workspace.role === 'dev')?.display_name
          || identity?.display_name
          || identity?.username
          || null
        : null;
      const contextIsAvailable = contextProject?.owner_id === partnerId
        && (contextProject.project_kind === 'portfolio' && contextProject.status === 'published'
          || contextProject.project_kind === 'request' && contextProject.status === 'open');
      const projectContext = contextProjectId ? contextIsAvailable
        ? {
          id: contextProject.id,
          owner_id: contextProject.owner_id,
          project_kind: contextProject.project_kind,
          status: contextProject.status,
          title: contextProject.title,
          category: contextProject.category,
          price: contextProject.price,
          cover_image: contextProject.cover_image,
          client_name: contextProject.project_kind === 'request'
            ? identity?.display_name || identity?.username || null
            : null,
          data: contextProject.data,
          developer_name: developerName,
          available: true
        }
        : {
          id: contextProjectId,
          project_kind: contextKind,
          status: 'unavailable',
          client_name: contextKind === 'request'
            ? identity?.display_name || identity?.username || null
            : null,
          developer_name: contextKind === 'portfolio'
            ? workspaces.find(workspace => workspace.user_id === partnerId && workspace.role === 'dev')?.display_name
              || identity?.display_name
              || identity?.username
              || null
            : null,
          available: false
        }
        : null;
      return {
        ...details,
        project_id: contextProjectId,
        contact: {id:partnerId, account_role:partnerRole, username:identity?.username || '', display_name:profile?.display_name || ''},
        project_context: projectContext,
        last_message_at: last.created_at,
        source_conversations: sourceConversations.map(source => ({
          id: source.id,
          my_role: source.participant_a_id === user.id
            ? source.participant_a_role
            : source.participant_b_role
        })),
        last_message: proposal ? {...lastMessage, proposal} : lastMessage
      };
    }));
    return mapped.filter(Boolean).sort((a, b) =>
      Date.parse(b.last_message_at) - Date.parse(a.last_message_at)
    );
  }

  if (body.action === 'start-project' || body.action === 'find-project' || body.action === 'open-project-chat') {
    const projectId = body.projectId;
    if (typeof projectId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(projectId)) {
      throw new ChatApiError('A valid project is required.', 400);
    }
    let projectRows = await requestRows(supabaseUrl, serviceRoleKey, 'projects', {
      select: 'id,owner_id,project_kind,status',
      id: `eq.${projectId}`,
      status: 'in.(published,open)',
      limit: '1'
    });
    if (!projectRows.length) {
      projectRows = await requestRows(supabaseUrl, serviceRoleKey, 'projects', {
        select: 'id,owner_id,project_kind,status',
        legacy_id: `eq.${projectId}`,
        status: 'in.(published,open)',
        limit: '2'
      });
    }
    const project = projectRows.length === 1 ? projectRows[0] : null;
    const projectIsAvailable = project?.project_kind === 'portfolio'
      ? project.status === 'published'
      : project?.project_kind === 'request'
        ? project.status === 'open'
        : false;
    if (!project || !projectIsAvailable || project.owner_id === user.id) {
      throw new ChatApiError('This project is not available for a new conversation.', 404);
    }
    const expectedSenderRole = project.project_kind === 'portfolio' ? 'client' : 'dev';
    const expectedOwnerRole = project.project_kind === 'portfolio' ? 'dev' : 'client';
    if (workspaceRole !== expectedSenderRole) throw new ChatApiError('Switch to the project contact workspace first.', 403);
    const [sender, owner] = await Promise.all([
      getAccount(supabaseUrl, serviceRoleKey, user.id, expectedSenderRole),
      getPublicAccount(supabaseUrl, serviceRoleKey, project.owner_id, expectedOwnerRole)
    ]);
    if (!sender?.onboarding_complete || sender.account_role !== expectedSenderRole
      || owner?.account_role !== expectedOwnerRole) {
      throw new ChatApiError('Your account cannot start a conversation about this project.', 403);
    }
    const existing = await findConversation(
      supabaseUrl,
      serviceRoleKey,
      user.id,
      expectedSenderRole,
      project.owner_id,
      expectedOwnerRole,
      project.id
    );
    if (body.action === 'find-project' || body.action === 'open-project-chat') return existing;
    return startConversation(
      supabaseUrl,
      serviceRoleKey,
      user.id,
      project.owner_id,
      expectedSenderRole,
      expectedOwnerRole,
      project.id,
      authorization,
      existing
    );
  }

  if (body.action === 'start-user' || body.action === 'find-user') {
    const participantId = body.participantId;
    if (typeof participantId !== 'string' || !UUID_PATTERN.test(participantId)
      || participantId === user.id) {
      throw new ChatApiError('A valid contact is required.', 400);
    }
    if (!['client', 'dev'].includes(body.workspaceRole)) {
      // Older deployed clients use their primary role.
      const primary = await getAccount(supabaseUrl, serviceRoleKey, user.id);
      body.workspaceRole = primary?.account_role;
    }
    const [sender, recipient] = await Promise.all([
      getAccount(supabaseUrl, serviceRoleKey, user.id, body.workspaceRole),
      getPublicAccount(supabaseUrl, serviceRoleKey, participantId, body.workspaceRole === 'client' ? 'dev' : 'client')
    ]);
    if (!sender?.onboarding_complete || !recipient) {
      throw new ChatApiError('This contact is not available for chat.', 404);
    }
    if (sender.account_role === recipient.account_role
      || !['client', 'dev'].includes(sender.account_role)
      || !['client', 'dev'].includes(recipient.account_role)) {
      throw new ChatApiError('Chat is only available between clients and developers.', 403);
    }
    if (body.action === 'find-user') {
      return findConversation(
        supabaseUrl,
        serviceRoleKey,
        user.id,
        workspaceRole,
        participantId,
        recipient.account_role
      );
    }
    return startConversation(
      supabaseUrl,
      serviceRoleKey,
      user.id,
      participantId,
      workspaceRole,
      recipient.account_role,
      null,
      authorization
    );
  }

  if (body.action === 'list-messages'
    || body.action === 'mark-messages-read'
    || body.action === 'send-message'
    || body.action === 'download-attachment') {
    const requestedConversation = await getConversation(
      supabaseUrl, serviceRoleKey, body.conversationId
    );
    const conversation = await getThreadRoot(supabaseUrl, serviceRoleKey, requestedConversation);
    if (!userIsParticipant(conversation, user.id, workspaceRole)) {
      throw new ChatApiError('Conversation not found.', 404);
    }
    const sourceConversations = await getThreadSources(supabaseUrl, serviceRoleKey, conversation);
    const sourceIds = sourceConversations.map(source => source.id);
    const sourceFilter = `in.(${sourceIds.join(',')})`;

    if (body.action === 'mark-messages-read') {
      await requestRows(supabaseUrl, serviceRoleKey, 'messages', {
        select: 'id',
        conversation_id: sourceFilter,
        sender_id: `neq.${user.id}`,
        read_at: 'is.null'
      }, {
        method: 'PATCH',
        headers: {Prefer: 'return=representation'},
        body: JSON.stringify({read_at: new Date().toISOString()})
      });
      return {marked: true};
    }

    if (body.action === 'list-messages') {
      if (body.markRead !== false) {
        await requestRows(supabaseUrl, serviceRoleKey, 'messages', {
          select: 'id',
          conversation_id: sourceFilter,
          sender_id: `neq.${user.id}`,
          read_at: 'is.null'
        }, {
          method: 'PATCH',
          headers: {Prefer: 'return=representation'},
          body: JSON.stringify({read_at: new Date().toISOString()})
        });
      }
      const requestedLimit = Number(body.limit);
      const limit = Number.isInteger(requestedLimit)
        ? Math.max(1, Math.min(requestedLimit, MAX_MESSAGE_ROWS))
        : INITIAL_MESSAGE_ROWS;
      const rows = await requestRows(supabaseUrl, serviceRoleKey, 'messages', {
        select: 'id,conversation_id,sender_id,ciphertext,nonce,key_version,created_at,read_at,project_id,project_reference_id,project_kind,proposal_id',
        conversation_id: sourceFilter,
        ...(typeof body.before === 'string' && !Number.isNaN(Date.parse(body.before))
          ? {created_at: `lt.${body.before}`}
          : {}),
        order: 'created_at.desc',
        limit: String(limit)
      });
      const orderedRows = rows.reverse();
      const messages = await Promise.all(orderedRows.map(row => decryptRow(row, keyring)));
      const withProjectContexts = await attachMessageProjectContexts(
        messages, orderedRows, conversation, supabaseUrl, serviceRoleKey
      );
      return attachProposalDetails(
        withProjectContexts, orderedRows, supabaseUrl, serviceRoleKey
      );
    }

    if (body.action === 'download-attachment') {
      if (!UUID_PATTERN.test(body.messageId || '') || !UUID_PATTERN.test(body.attachmentId || '')) {
        throw new ChatApiError('A valid chat attachment is required.', 400);
      }
      const rows = await requestRows(supabaseUrl, serviceRoleKey, 'messages', {
        select: 'id,conversation_id,sender_id,ciphertext,nonce,key_version,created_at',
        id: `eq.${body.messageId}`,
        limit: '1'
      });
      const row = rows[0];
      if (!row || !sourceIds.includes(row.conversation_id)) {
        throw new ChatApiError('Attachment not found.', 404);
      }
      const key = keyring.keys.get(Number(row.key_version));
      if (!key) throw new ChatApiError('This attachment cannot be decrypted right now.', 503);
      const context = {
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        keyVersion: Number(row.key_version)
      };
      const plaintext = await decryptMessage(row, context, key);
      let payload;
      try {
        payload = JSON.parse(plaintext);
      } catch {
        throw new ChatApiError('Attachment not found.', 404);
      }
      const item = Array.isArray(payload?.attachments)
        ? payload.attachments.find(attachment => attachment?.id === body.attachmentId)
        : null;
      if (!item
        || !UUID_PATTERN.test(item.id || '')
        || item.path !== `chat-attachments/${row.conversation_id}/${row.sender_id}/${item.id}.bin`
        || typeof item.type !== 'string'
        || !ALLOWED_ATTACHMENT_TYPES.has(item.type)
        || typeof item.name !== 'string'
        || typeof item.nonce !== 'string'
        || !/^[A-Za-z0-9_-]{16}$/.test(item.nonce)
        || !Number.isInteger(item.key_version)
        || item.key_version < 1
        || !Number.isInteger(item.size)
        || item.size < 1
        || item.size > MAX_ATTACHMENT_BYTES) {
        throw new ChatApiError('Attachment not found.', 404);
      }
      const attachmentKey = keyring.keys.get(Number(item.key_version));
      if (!attachmentKey) {
        throw new ChatApiError('This attachment cannot be decrypted right now.', 503);
      }
      const encryptedBytes = await downloadEncryptedAttachment(
        supabaseUrl, serviceRoleKey, item.path
      );
      const attachmentContext = {
        conversationId: `${row.conversation_id}:attachment:${item.id}`,
        senderId: row.sender_id,
        keyVersion: Number(item.key_version)
      };
      const bytes = await decryptBinary(
        {ciphertext: encryptedBytes, nonce: item.nonce},
        attachmentContext,
        attachmentKey
      );
      if (bytes.length !== item.size) {
        throw new ChatApiError('The attachment data is invalid.', 503);
      }
      return {
        name: safeAttachmentName(item.name),
        type: item.type,
        size: bytes.length,
        base64: encodeBase64(bytes)
      };
    }

    if (body.text !== undefined && typeof body.text !== 'string') {
      throw new ChatApiError('Message text is invalid.', 400);
    }
    if (typeof body.text === 'string' && body.text.length > 20000) {
      throw new ChatApiError('Message is too long.', 400);
    }
    const text = sanitizeMessageText(body.text || '');
    if (text.length > MAX_MESSAGE_LENGTH) {
      throw new ChatApiError('Messages must contain at most 5,000 plain-text characters.', 400);
    }
    const hasAttachment = body.attachment !== undefined && body.attachment !== null;
    if (!text && !hasAttachment) {
      throw new ChatApiError('Write a message or attach a file.', 400);
    }
    let messageProjectId = null;
    let messageProjectKind = null;
    if (body.projectId !== undefined && body.projectId !== null) {
      if (typeof body.projectId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(body.projectId)) {
        throw new ChatApiError('The project context is invalid.', 400);
      }
      const peerId = conversation.participant_a_id === user.id
        ? conversation.participant_b_id
        : conversation.participant_a_id;
      const projects = await requestRows(supabaseUrl, serviceRoleKey, 'projects', {
        select: 'id,owner_id,project_kind,status',
        id: `eq.${body.projectId}`,
        limit: '1'
      });
      const project = projects[0];
      const isPortfolioContext = project?.project_kind === 'portfolio'
        && project.status === 'published'
        && workspaceRole === 'client';
      const isRequestContext = project?.project_kind === 'request'
        && project.status === 'open'
        && workspaceRole === 'dev';
      const ownerRole = isPortfolioContext ? 'dev' : isRequestContext ? 'client' : null;
      const owner = ownerRole
        ? await getPublicAccount(supabaseUrl, serviceRoleKey, peerId, ownerRole)
        : null;
      if (!project || project.owner_id !== peerId || !ownerRole || !owner) {
        throw new ChatApiError('The project context is not available for this conversation.', 400);
      }
      messageProjectId = project.id;
      messageProjectKind = project.project_kind;
    }
    const attachments = [];
    let uploadedPath = '';
    if (hasAttachment) {
      if (!body.attachment || typeof body.attachment !== 'object'
        || Array.isArray(body.attachment)
        || !ALLOWED_ATTACHMENT_TYPES.has(body.attachment.type)) {
        throw new ChatApiError('Choose a supported attachment up to 2 MB.', 400);
      }
      const name = safeAttachmentName(body.attachment.name);
      const bytes = decodeAttachmentBase64(body.attachment.base64);
      const id = crypto.randomUUID();
      const keyVersion = keyring.activeVersion;
      const attachmentContext = {
        conversationId: `${conversation.id}:attachment:${id}`,
        senderId: user.id,
        keyVersion
      };
      const encryptedAttachment = await encryptBinary(
        bytes,
        attachmentContext,
        keyring.keys.get(keyVersion)
      );
      const path = `chat-attachments/${conversation.id}/${user.id}/${id}.bin`;
      await uploadEncryptedAttachment(
        supabaseUrl, serviceRoleKey, path, encryptedAttachment.ciphertext
      );
      uploadedPath = path;
      attachments.push({
        id,
        path,
        name,
        type: body.attachment.type,
        size: bytes.length,
        nonce: encryptedAttachment.nonce,
        key_version: keyVersion
      });
    }

    const context = {
      conversationId: conversation.id,
      senderId: user.id,
      keyVersion: keyring.activeVersion
    };
    const plaintext = JSON.stringify({version: 1, text, attachments});
    let rows;
    try {
      const encrypted = await encryptMessage(
        plaintext,
        context,
        keyring.keys.get(keyring.activeVersion)
      );
      rows = await requestRows(
        supabaseUrl,
        serviceRoleKey,
        'messages',
        {select: 'id,conversation_id,sender_id,ciphertext,nonce,key_version,created_at,read_at,project_id,project_reference_id,project_kind'},
        {
          method: 'POST',
          headers: {Prefer: 'return=representation'},
          body: JSON.stringify([{
            conversation_id: conversation.id,
            sender_id: user.id,
            ciphertext: encrypted.ciphertext,
            nonce: encrypted.nonce,
            key_version: keyring.activeVersion,
            project_id: messageProjectId,
            project_reference_id: messageProjectId,
            project_kind: messageProjectKind
          }])
        }
      );
    } catch (error) {
      if (uploadedPath) await deleteChatAttachment(supabaseUrl, serviceRoleKey, uploadedPath);
      throw error;
    }
    if (!rows[0]) {
      if (uploadedPath) await deleteChatAttachment(supabaseUrl, serviceRoleKey, uploadedPath);
      throw new ChatApiError('Chat service returned an invalid response.');
    }
    const message = await decryptRow(rows[0], keyring);
    const [messageWithProjectContext] = await attachMessageProjectContexts(
      [message], rows, conversation, supabaseUrl, serviceRoleKey
    );
    return messageWithProjectContext;
  }

  throw new ChatApiError('Unsupported chat action.', 400);
}

Deno.serve(async request => {
  const cors = getCorsHeaders(request.headers.get('origin'));
  if (!cors) return jsonResponse({error: 'Origin not allowed.'}, 403, null);
  if (request.method === 'OPTIONS') return new Response('ok', {headers: cors});
  if (request.method !== 'POST') {
    return jsonResponse({error: 'Method not allowed.'}, 405, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({error: 'Invalid chat request.'}, 400, cors);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({error: 'Invalid chat request.'}, 400, cors);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Chat API requires Supabase server credentials.');
    return jsonResponse({error: 'Chat service is not configured.'}, 503, cors);
  }

  let user;
  try {
    user = await authenticateUser(request, supabaseUrl, serviceRoleKey);
  } catch (error) {
    if (error instanceof ChatApiError) {
      return jsonResponse({error: error.message}, error.status, cors);
    }
    console.error('Unable to verify the chat session.', error);
    return jsonResponse({error: 'Unable to verify your session.'}, 503, cors);
  }

  let keyring;
  try {
    keyring = loadKeyring();
  } catch (error) {
    console.error('Chat encryption is not configured correctly.', error);
    return jsonResponse({error: 'Chat encryption is not configured.'}, 503, cors);
  }

  try {
    const result = await handleAction(
      body, user, keyring, supabaseUrl, serviceRoleKey, request.headers.get('authorization')
    );
    return jsonResponse({data: result}, 200, cors);
  } catch (error) {
    if (error instanceof ChatApiError) {
      return jsonResponse({error: error.message}, error.status, cors);
    }
    console.error('Chat request failed.', error);
    return jsonResponse({error: 'Unable to process this chat request.'}, 500, cors);
  }
});
