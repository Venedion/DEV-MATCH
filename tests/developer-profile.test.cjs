const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../assets/js/developer-profile.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../devmatch-developer-profile.html'),'utf8');
const ownProfile=fs.readFileSync(path.join(__dirname,'../assets/js/my-profile.js'),'utf8');
const publicProfileCss=fs.readFileSync(path.join(__dirname,'../assets/css/developer-public-profile.css'),'utf8');

test('Client-facing developer profiles fall back to the existing directory schema',()=>{
  assert.match(source,/const metricColumns='id,display_name,username,account_role,profile_data,published_portfolio_count,published_portfolio_views_count,published_portfolio_favorites_count'/);
  assert.match(source,/const legacyColumns='id,display_name,username,account_role,profile_data,published_portfolio_count'/);
  assert.match(source,/\['42703','PGRST204'\]/);
  assert.doesNotMatch(source,/loadPublicPortfolioProjectMetrics/);
});

test('Client-facing developer favorites confirm removals and show shared feedback',()=>{
  assert.match(html,/favorite-feedback\.css/);
  assert.match(html,/id="favoriteActionToast"/);
  assert.match(html,/id="favoriteRemoveDialog"/);
  assert.match(source,/DEVMATCH_FAVORITE_FEEDBACK\.confirmRemoval\([\s\S]*?favoriteRemoveDialog[\s\S]*?favoriteRemoveMessage/);
  assert.match(source,/DEVMATCH_FAVORITE_FEEDBACK\.showToast\([\s\S]*?Developer removed from your favorites[\s\S]*?Developer added to your favorites/);
});

test('Developer profiles retain their availability status',()=>{
  assert.match(source,/availability:String\(profile\.availability\|\|''\)/);
  assert.match(ownProfile,/if\(isDeveloper\)identity\.availability=profile\.availability\|\|''/);
});

test('Client-facing developer profiles use visitor actions and matching profile sections',()=>{
  assert.match(html,/client-developer-profile-view/);
  assert.match(html,/class="client-profile-layout" id="clientProfileLayout"/);
  assert.match(html,/id="clientProfileActions"/);
  assert.match(html,/id="clientCompanyDetails"/);
  assert.match(html,/id="clientShowcaseDesktop"/);
  assert.match(html,/id="favoriteDeveloper"/);
  assert.doesNotMatch(html,/Preview as Public|id="contactDeveloper"/);
  assert.match(html,/<h2>Connected Apps<\/h2>/);
  assert.match(html,/id="sidebarContactDeveloper"[\s\S]*?>[\s\S]*?Direct Message/);
  assert.doesNotMatch(html,/<h2>Links<\/h2>|connected-app-manage/);
  assert.match(source,/function moveProfileContent\(\)/);
  assert.match(source,/desktopProfileLayout\.addEventListener\('change',moveProfileContent\)/);
  assert.match(publicProfileCss,/client-developer-profile-view \.client-profile-actions \.profile-actions\{display:flex/);
});

test('Visitor Connected Apps links only expose connected services with logos and arrows',()=>{
  assert.match(source,/function renderConnectedApps\(profile\)/);
  assert.match(source,/apps\.filter\(app=>app\.connected\)/);
  assert.match(source,/connected-app-arrow/);
  assert.match(source,/isConnected\('whatsappConnected'/);
  assert.match(source,/isConnected\('githubConnected'/);
  assert.match(source,/isConnected\('googleConnected'/);
  assert.match(source,/isConnected\('linkedinConnected'/);
  assert.doesNotMatch(source,/renderPublicLinks|developerLinks/);
});
