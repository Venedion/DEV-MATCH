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
const MAX_MESSAGE_ROWS = 200;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
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
    select: 'id,participant_a_id,participant_b_id,project_id,updated_at,last_message_at',
    id: `eq.${conversationId}`,
    limit: '1'
  });
  return rows[0] || null;
}

function userIsParticipant(conversation, userId) {
  return !!conversation && (
    conversation.participant_a_id === userId || conversation.participant_b_id === userId
  );
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
    text: sanitizeMessageText(text),
    attachments,
    created_at: row.created_at
  };
}

async function getAccount(supabaseUrl, serviceRoleKey, userId) {
  const profiles = await requestRows(supabaseUrl, serviceRoleKey, 'profiles', {
    select: 'id,account_role,onboarding_complete',
    id: `eq.${userId}`,
    limit: '1'
  });
  return profiles[0] || null;
}

async function getPublicAccount(supabaseUrl, serviceRoleKey, userId) {
  const accounts = await requestRows(supabaseUrl, serviceRoleKey, 'directory_people', {
    select: 'id,account_role',
    id: `eq.${userId}`,
    limit: '1'
  });
  return accounts[0] || null;
}

async function findConversation(supabaseUrl, serviceRoleKey, userId, participantId, projectId) {
  const participantFilter = `in.(${userId},${participantId})`;
  const query = {
    select: 'id,participant_a_id,participant_b_id,project_id,updated_at,last_message_at',
    participant_a_id: participantFilter,
    participant_b_id: participantFilter,
    limit: '1'
  };
  query.project_id = projectId === null ? 'is.null' : `eq.${projectId}`;
  const rows = await requestRows(supabaseUrl, serviceRoleKey, 'conversations', query);
  return rows[0] || null;
}

async function startConversation(supabaseUrl, serviceRoleKey, userId, participantId, projectId) {
  const existing = await findConversation(
    supabaseUrl, serviceRoleKey, userId, participantId, projectId
  );
  if (existing) return existing;

  const [participantA, participantB] = [userId, participantId].sort();
  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/conversations?select=id,participant_a_id,participant_b_id,project_id,updated_at,last_message_at`,
      {
        method: 'POST',
        headers: supabaseHeaders(serviceRoleKey, {Prefer: 'return=representation'}),
        body: JSON.stringify([{
          participant_a_id: participantA,
          participant_b_id: participantB,
          project_id: projectId
        }])
      }
    );
    if (response.status === 409) {
      const raced = await findConversation(
        supabaseUrl, serviceRoleKey, userId, participantId, projectId
      );
      if (raced) return raced;
    }
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

async function handleAction(body, user, keyring, supabaseUrl, serviceRoleKey) {
  if (body.action === 'list-conversations') {
    const conversations = await requestRows(supabaseUrl, serviceRoleKey, 'conversations', {
      select: 'id,participant_a_id,participant_b_id,project_id,updated_at,last_message_at,messages(id,conversation_id,sender_id,ciphertext,nonce,key_version,created_at)',
      or: `(participant_a_id.eq.${user.id},participant_b_id.eq.${user.id})`,
      'messages.order': 'created_at.desc',
      'messages.limit': '1',
      order: 'last_message_at.desc.nullslast,updated_at.desc',
      limit: '100'
    });

    return Promise.all(conversations.map(async conversation => {
      const {messages, ...details} = conversation;
      const last = Array.isArray(messages) ? messages[0] : null;
      return {
        ...details,
        last_message: last ? await decryptRow(last, keyring) : null
      };
    }));
  }

  if (body.action === 'start-project') {
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
    if (!project || project.owner_id === user.id) {
      throw new ChatApiError('This project is not available for a new conversation.', 404);
    }
    const [sender, owner] = await Promise.all([
      getAccount(supabaseUrl, serviceRoleKey, user.id),
      getPublicAccount(supabaseUrl, serviceRoleKey, project.owner_id)
    ]);
    const expectedSenderRole = project.project_kind === 'portfolio' ? 'client' : 'dev';
    const expectedOwnerRole = project.project_kind === 'portfolio' ? 'dev' : 'client';
    if (!sender?.onboarding_complete || sender.account_role !== expectedSenderRole
      || owner?.account_role !== expectedOwnerRole) {
      throw new ChatApiError('Your account cannot start a conversation about this project.', 403);
    }
    return startConversation(supabaseUrl, serviceRoleKey, user.id, project.owner_id, project.id);
  }

  if (body.action === 'start-user') {
    const participantId = body.participantId;
    if (typeof participantId !== 'string' || !UUID_PATTERN.test(participantId)
      || participantId === user.id) {
      throw new ChatApiError('A valid contact is required.', 400);
    }
    const [sender, recipient] = await Promise.all([
      getAccount(supabaseUrl, serviceRoleKey, user.id),
      getPublicAccount(supabaseUrl, serviceRoleKey, participantId)
    ]);
    if (!sender?.onboarding_complete || !recipient) {
      throw new ChatApiError('This contact is not available for chat.', 404);
    }
    if (sender.account_role === recipient.account_role
      || !['client', 'dev'].includes(sender.account_role)
      || !['client', 'dev'].includes(recipient.account_role)) {
      throw new ChatApiError('Chat is only available between clients and developers.', 403);
    }
    return startConversation(supabaseUrl, serviceRoleKey, user.id, participantId, null);
  }

  if (body.action === 'list-messages'
    || body.action === 'send-message'
    || body.action === 'download-attachment') {
    const conversation = await getConversation(
      supabaseUrl, serviceRoleKey, body.conversationId
    );
    if (!userIsParticipant(conversation, user.id)) {
      throw new ChatApiError('Conversation not found.', 404);
    }

    if (body.action === 'list-messages') {
      const rows = await requestRows(supabaseUrl, serviceRoleKey, 'messages', {
        select: 'id,conversation_id,sender_id,ciphertext,nonce,key_version,created_at',
        conversation_id: `eq.${conversation.id}`,
        order: 'created_at.desc',
        limit: String(MAX_MESSAGE_ROWS)
      });
      return Promise.all(rows.reverse().map(row => decryptRow(row, keyring)));
    }

    if (body.action === 'download-attachment') {
      if (!UUID_PATTERN.test(body.messageId || '') || !UUID_PATTERN.test(body.attachmentId || '')) {
        throw new ChatApiError('A valid chat attachment is required.', 400);
      }
      const rows = await requestRows(supabaseUrl, serviceRoleKey, 'messages', {
        select: 'id,conversation_id,sender_id,ciphertext,nonce,key_version,created_at',
        id: `eq.${body.messageId}`,
        conversation_id: `eq.${conversation.id}`,
        limit: '1'
      });
      const row = rows[0];
      if (!row) throw new ChatApiError('Attachment not found.', 404);
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
        || item.path !== `chat-attachments/${conversation.id}/${row.sender_id}/${item.id}.bin`
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
        conversationId: `${conversation.id}:attachment:${item.id}`,
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
        {select: 'id,conversation_id,sender_id,ciphertext,nonce,key_version,created_at'},
        {
          method: 'POST',
          headers: {Prefer: 'return=representation'},
          body: JSON.stringify([{
            conversation_id: conversation.id,
            sender_id: user.id,
            ciphertext: encrypted.ciphertext,
            nonce: encrypted.nonce,
            key_version: keyring.activeVersion
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
    return decryptRow(rows[0], keyring);
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
      body, user, keyring, supabaseUrl, serviceRoleKey
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
