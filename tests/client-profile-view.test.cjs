const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const profileHtml=fs.readFileSync(path.join(root,'devmatch-client-profile.html'),'utf8');
const profileJs=fs.readFileSync(path.join(root,'assets/js/client-profile.js'),'utf8');
const profileCss=fs.readFileSync(path.join(root,'assets/css/client-profile.css'),'utf8');

test('Developer view of a client uses the client profile layout and visitor actions',()=>{
  assert.match(profileHtml,/<body class="my-profile-page client-profile-public client-profile-view" data-workspace="dev">/);
  assert.match(profileHtml,/id="clientProfileLayout"[\s\S]*?class="client-profile-main"[\s\S]*?id="clientProfileActions"[\s\S]*?id="clientProfileSide"/);
  assert.match(profileHtml,/id="shareClientProfile"/);
  assert.match(profileHtml,/id="favoriteClient"/);
  assert.match(profileHtml,/id="directMessageLink"/);
  assert.doesNotMatch(profileHtml,/Preview as Public|Edit Profile|manageConnectedAppsLink/);
  assert.match(profileCss,/\.client-profile-view \.client-profile-actions \.profile-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  const identity=profileJs.match(/function renderIdentity\(client,profile\)\{([\s\S]*?)\n  \}/);
  assert.ok(identity,'client profile identity renderer should exist');
  assert.doesNotMatch(identity[1],/availability/);
});

test('Client profile direct messages stay available and favorites persist for developer accounts',()=>{
  assert.match(profileJs,/configureDirectMessageLink\([\s\S]*?contactUrl,\s*Boolean\(user&&user\.id===client\.id\)\s*\)/);
  assert.match(profileJs,/loadFavorites\(\)/);
  assert.match(profileJs,/setFavorite\('client',client\.id,nextState\)/);
  assert.match(profileJs,/saveFavoriteCache\(favoriteIds\)/);
});

test('Client profile favorites confirm removals and use the shared feedback UI',()=>{
  assert.match(profileHtml,/favorite-feedback\.css/);
  assert.match(profileHtml,/id="favoriteActionToast"/);
  assert.match(profileHtml,/id="favoriteRemoveDialog"/);
  assert.match(profileHtml,/favorite-feedback\.js[\s\S]*?client-profile\.js/);
  assert.match(profileJs,/DEVMATCH_FAVORITE_FEEDBACK\.confirmRemoval\([\s\S]*?favoriteRemoveDialog[\s\S]*?favoriteRemoveMessage/);
  assert.match(profileJs,/DEVMATCH_FAVORITE_FEEDBACK\.showToast\([\s\S]*?Client removed from your favorites[\s\S]*?Client added to your favorites/);
  assert.match(profileJs,/setFavorite\('client',client\.id,true\)/);
});

test('Connected apps only render active linked entries with a trailing arrow',()=>{
  assert.match(profileJs,/const connectedApps=apps\.filter\(app=>app\.connected\)/);
  assert.match(profileJs,/const whatsappIconSvg='<svg viewBox="0 0 24 24" fill="none"[\s\S]*?stroke="currentColor" stroke-width="1\.8"/);
  assert.match(profileJs,/iconSvg:whatsappIconSvg/);
  assert.match(profileJs,/app\.iconSvg\|\|escapeHtml/);
  for(const field of ['whatsappConnected','githubConnected','googleConnected','instagramConnected','linkedinConnected']){
    assert.ok(profileJs.includes(field),`${field} should control its connected-app entry`);
  }
  assert.match(profileJs,/connected-app-arrow/);
  assert.match(profileJs,/target="_blank" rel="noopener noreferrer"/);
  assert.match(profileHtml,/id="connectedAppsCard"[\s\S]*?id="connectedList"/);
  assert.doesNotMatch(profileHtml,/connected-app-manage|manageConnectedAppsLink/);
});
