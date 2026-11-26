const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=(relativePath)=>fs.readFileSync(path.join(__dirname,'..',relativePath),'utf8');

test('Client Projects mobile layout reuses marketplace category and filter controls',()=>{
  const html=read('devmatch-discover-projects.html');
  const css=read('assets/css/marketplace.css');
  const js=read('assets/js/marketplace.js');

  assert.match(html,/class="mobile-market-actions"/);
  assert.match(html,/class="mobile-market-sticky-actions"/);
  assert.match(html,/id="mobileFiltersToggle"/);
  assert.match(html,/id="mobileFiltersPanel"/);
  assert.match(html,/Discover projects/);
  assert.match(html,/Ready-to-Build Projects/);
  assert.match(js,/actions\.append\(categories\);\s*stickyActions\.append\(sortControl, toggle, panel\)/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.mobile-market-actions \.market-categories/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.project-grid\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
});

test('Client Developers mobile layout moves the existing sort and filter controls into a dock',()=>{
  const html=read('devmatch-find-developers.html');
  const css=read('assets/css/find-developers.css');
  const js=read('assets/js/find-developers.js');

  assert.match(html,/class="mobile-devs-actions"/);
  assert.match(html,/id="mobileDevsSortMenu"/);
  assert.match(html,/id="mobileDevsFilterPanel"/);
  assert.match(html,/data-sort="name"/);
  assert.match(html,/data-sort="projects"/);
  assert.match(js,/filterFields\.append\(filterPills\)/);
  assert.match(js,/sortMenu\.append\(sortOptions\)/);
  assert.match(js,/window\.matchMedia\('\(orientation: portrait\)'\)/);
  assert.match(css,/\.mobile-devs-actions\s*\{\s*box-sizing: border-box;[\s\S]*?position: sticky/);
  assert.match(css,/\.devs-grid\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
});
