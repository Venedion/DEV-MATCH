const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {setImmediate} = require('node:timers/promises');
const {test} = require('node:test');
const vm = require('node:vm');

const userId = '11111111-1111-4111-8111-111111111111';
const developerId = '22222222-2222-4222-8222-222222222222';
const roomId = '33333333-3333-4333-8333-333333333333';
const parentId = '44444444-4444-4444-8444-444444444444';
const projectId = '55555555-5555-4555-8555-555555555555';
const developer = {id: developerId, username: 'testdev', account_role: 'dev'};
const room = {id: roomId, participant_a_id: userId, participant_b_id: developerId,
  participant_a_role: 'client', participant_b_role: 'dev', project_id: projectId};
const project = {id: projectId, title: 'Test portfolio', project_kind: 'portfolio'};
const source = readFileSync(join(__dirname, '../assets/js/chat.js'), 'utf8');

async function openProject(listedRooms) {
  const events = [];
  const handlers = {};
  let active;
  let rewrittenUrl;
  const input = {focus() {}, addEventListener() {}, style: {}, value: ''};
  const composer = {hidden: true};
  const form = {
    addEventListener(name, handler) { handlers[name] = handler; },
    querySelector() { return null; }
  };
  const channel = {on() { return this; }, subscribe() { return this; }, presenceState() { return {}; }};
  const client = {
    auth: {getSession: async () => ({data: {session: {access_token: 'test', user: {id: userId}}}})},
    realtime: {setAuth: async () => {}},
    channel: () => channel,
    from: table => ({
      select() { return this; },
      eq() { return this; },
      in: async () => ({data: [project]}),
      maybeSingle: async () => ({data: table === 'directory_people' ? developer : null})
    }),
    functions: {invoke: async (_name, {body}) => {
      events.push(body);
      const byAction = {
        'list-conversations': () => listedRooms.slice(),
        'start-project': () => room,
        'list-messages': () => [],
        'send-message': () => ({id: 'test-message', sender_id: userId, text: body.text, attachments: []})
      };
      return {data: {data: byAction[body.action]()}};
    }}
  };
  const window = {
    location: new URL(`https://example.test/devmatch-chat.html?role=client&project=${projectId}`),
    history: {replaceState(_state, _title, url) { rewrittenUrl = url; }},
    matchMedia: () => ({matches: false, addEventListener() {}}),
    addEventListener() {},
    devMatchBackend: {client, ready: Promise.resolve({id: userId}), loadProfile: async () => ({account_role: 'client'})},
    DEVMATCH_ROOM_PAYMENT: {setRoom(room) { active = room; }}
  };
  const document = {
    getElementById: id => ({chatMessageInput: input, chatComposerForm: form})[id] || null,
    querySelector: selector => selector === '.chat-composer-wrap' ? composer : null,
    querySelectorAll: () => [],
    addEventListener() {},
    body: {classList: {toggle() {}}}
  };
  vm.runInNewContext(source, {
    window, document, URL, URLSearchParams, localStorage: {getItem: () => null, removeItem() {}, setItem() {}},
    setInterval: () => 0, console
  });
  await setImmediate();
  assert.equal(rewrittenUrl.searchParams.get('conversation'), roomId);
  assert.equal(composer.hidden, false);
  assert.equal(active.project.id, projectId);
  assert.equal(active.paymentConversationId, roomId);
  assert.equal(events.find(event => event.action === 'list-messages').conversationId, roomId);
  input.value = 'Hello developer';
  handlers.submit({preventDefault() {}});
  await setImmediate();
  assert.equal(events.find(event => event.action === 'send-message').conversationId, roomId);
  assert.equal(input.value, '');
}

test('a project chat can send the first message even when its new room is absent from the inbox', async () => {
  await openProject([]);
});

test('opening a project selects its exact room when the inbox groups it under another conversation', async () => {
  await openProject([{...room, id: parentId, project_id: null, contact: developer,
    source_conversations: [{id: roomId}]}]);
});
