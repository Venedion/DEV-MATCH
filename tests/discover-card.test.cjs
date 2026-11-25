const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Discover project cards show developer identity without a View details link',()=>{
  const source=fs.readFileSync('assets/js/marketplace.js','utf8');
  const renderProject=source.slice(source.indexOf('function renderProject(item)'),source.indexOf('const requestFavorite'));
  assert.match(renderProject,/developer-info/);
  assert.match(renderProject,/developer-avatar/);
  assert.match(renderProject,/rating/);
  assert.doesNotMatch(renderProject,/View details/);
});

test('Marketplace loads directory profiles only for owners in the catalog result',()=>{
  const source=fs.readFileSync('assets/js/marketplace.js','utf8');
  assert.match(source,/const ownerIds=\[\.\.\.new Set\(rows\.map\(row=>row\.owner_id\)\.filter\(Boolean\)\)\]/);
  assert.match(source,/\.eq\('account_role',isRequestsPage\?'client':'dev'\)\s*\.in\('id',ownerIds\)/);
});

test('Discover project artworks use uploaded project cover images',()=>{
  const source=fs.readFileSync('assets/js/marketplace.js','utf8');
  assert.match(source,/safeProjectCover\(item\.coverImage\)/);
  assert.match(source,/marketplace-project-cover/);
  assert.match(source,/coverImage = safeProjectCover\(row\.cover_image \|\| data\.coverImage \|\| firstMedia\)/);
});

test('Find Projects loads the favorite feedback controls used by request-card love buttons',()=>{
  const html=fs.readFileSync('devmatch-find-projects.html','utf8');
  const source=fs.readFileSync('assets/js/marketplace.js','utf8');
  assert.match(html,/assets\/css\/favorite-feedback\.css/);
  assert.match(html,/id="favoriteActionToast"/);
  assert.match(html,/id="favoriteRemoveDialog"[\s\S]*?id="favoriteRemoveMessage"/);
  assert.match(html,/favorite-feedback\.js[\s\S]*?marketplace\.js/);
  assert.match(source,/class="request-card-favorite"[^`]*data-favorite=/);
  assert.match(source,/window\.DEVMATCH_FAVORITE_FEEDBACK\.showToast/);
  assert.match(source,/window\.DEVMATCH_FAVORITE_FEEDBACK\.confirmRemoval/);
});

test('mobile favorite feedback keeps its message on one line',()=>{
  const css=fs.readFileSync('assets/css/favorite-feedback.css','utf8');
  assert.match(css,/@media \(orientation: portrait\)\s*\{\s*\.fav-toast \{[^}]*max-width: calc\(100vw - 24px\);[^}]*flex-wrap: nowrap;[^}]*white-space: nowrap;/);
  assert.match(css,/\.fav-toast-message \{\s*min-width: 0;\s*overflow: hidden;\s*text-overflow: ellipsis;/);
  assert.match(css,/\.fav-toast-undo \{\s*flex: none;\s*white-space: nowrap;/);
});

test('favorite toast links to the matching Favorites tab on mobile',()=>{
  const source=fs.readFileSync('assets/js/favorite-feedback.js','utf8');
  const favoritesJs=fs.readFileSync('assets/js/favorites.js','utf8');
  const marketplaceJs=fs.readFileSync('assets/js/marketplace.js','utf8');
  const findClientsJs=fs.readFileSync('assets/js/find-clients.js','utf8');
  assert.match(source,/matchMedia\('\(orientation: portrait\)'\)/);
  assert.match(source,/fav-toast-favorites-link/);
  assert.match(source,/devmatch-favorites\.html\?role=\$\{role\}&tab=\$\{encodeURIComponent\(favoriteLink\.tab\)\}/);
  assert.match(favoritesJs,/requestedTab === 'clients' \|\| requestedTab === 'saved-clients'/);
  assert.match(favoritesJs,/requestedTab === 'developers' \|\| requestedTab === 'saved-developers'/);
  assert.match(marketplaceJs,/saved \? null : \{tab: 'projects'\}/);
  assert.match(findClientsJs,/saved \? null : \{tab: 'clients'\}/);
});

test('Discover catalog card developer footer has fixed positioning',()=>{
  const css=fs.readFileSync('assets/css/marketplace.css','utf8');
  assert.match(css,/\.catalog-card\{display:flex;flex-direction:column\}/);
  assert.match(css,/\.catalog-card \.project-body\{[^}]*display:flex[^}]*flex:1[^}]*flex-direction:column/);
  assert.match(css,/\.catalog-project-by\{[^}]*grid-template-columns:38px minmax\(0,1fr\) auto/);
});

test('Client project cards share Discover card dimensions and footer',()=>{
  const dashboardCss=fs.readFileSync('assets/css/client-dashboard.css','utf8');
  const favoritesCss=fs.readFileSync('assets/css/favorites.css','utf8');
  const profileCss=fs.readFileSync('assets/css/developer-profile.css','utf8');
  assert.match(dashboardCss,/\.project-art\{height:166px/);
  assert.match(dashboardCss,/grid-template-columns:38px minmax\(0,1fr\) auto/);
  assert.match(favoritesCss,/\.fav-card-art\s*\{[^}]*height:\s*166px/s);
  assert.match(favoritesCss,/grid-template-columns:minmax\(0,1fr\) auto auto/);
  assert.match(profileCss,/\.portfolio-catalog-card \.project-art\{height:166px/);
  assert.match(profileCss,/grid-template-columns:38px minmax\(0,1fr\) auto/);
});
