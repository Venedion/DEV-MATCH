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

test('Discover project artworks use uploaded project cover images',()=>{
  const source=fs.readFileSync('assets/js/marketplace.js','utf8');
  assert.match(source,/safeProjectCover\(item\.coverImage\)/);
  assert.match(source,/marketplace-project-cover/);
  assert.match(source,/coverImage = safeProjectCover\(row\.cover_image \|\| data\.coverImage \|\| firstMedia\)/);
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
