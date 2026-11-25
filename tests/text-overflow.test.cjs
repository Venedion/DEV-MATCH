const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const readCss=file=>fs.readFileSync(path.join(root,'assets/css',file),'utf8');

test('bounded project cards clamp titles and wrap long description tokens',()=>{
  const marketplace=readCss('marketplace.css');
  const clientDashboard=readCss('client-dashboard.css');

  assert.match(marketplace,/\.project-title\{[^}]*overflow-wrap:anywhere/);
  assert.match(marketplace,/\.catalog-card \.project-title\{[^}]*-webkit-line-clamp:2/);
  assert.match(marketplace,/\.project-description\{[^}]*overflow-wrap:anywhere[^}]*-webkit-line-clamp:2/);
  assert.match(clientDashboard,/\.project-body h3\{[^}]*-webkit-line-clamp:2/);
  assert.match(clientDashboard,/\.project-body>p\{[^}]*overflow-wrap:anywhere[^}]*-webkit-line-clamp:2/);
});

test('single-line labels and notification snippets use ellipsis while longer copy wraps',()=>{
  const dashboard=readCss('dashboard.css');
  const notifications=readCss('notifications.css');
  const chat=readCss('chat.css');
  const profile=readCss('find-developers.css');

  assert.match(dashboard,/\.comment-profile-name-link\{[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/);
  assert.match(dashboard,/\.interaction-list p\{[^}]*overflow-wrap:anywhere/);
  assert.match(notifications,/\.notification-copy\{[^}]*overflow-wrap:anywhere/);
  assert.match(notifications,/\.notification-copy>span\{overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
  assert.match(chat,/\.chat-conv-title-wrap h1 \{[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/);
  assert.match(profile,/\.dev-name-title \{[^}]*text-overflow: ellipsis/);
  assert.match(profile,/\.dev-bio \{[^}]*overflow-wrap:anywhere/);
});
