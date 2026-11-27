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
  assert.match(js,/const mobileDiscoverBreakpoint = window\.matchMedia\('\(max-width: 600px\) and \(orientation: portrait\)'\);/);
  assert.match(js,/const shown = filtered\.slice\(0, !isRequestsPage && mobileDiscoverBreakpoint\.matches \? filtered\.length : visibleCount\);/);
  assert.match(js,/if \(!isRequestsPage\) mobileDiscoverBreakpoint\.addEventListener\('change', render\);/);
  assert.match(css,/@media \(max-width: 600px\) and \(orientation: portrait\) \{\s*\.marketplace-main\[data-marketplace="discover"\] \.load-more-wrap\s*\{\s*display: none;/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.mobile-market-actions \.market-categories/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.project-grid\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.mobile-filter-options button\[aria-pressed="true"\] > svg\s*\{\s*display: block;/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.mobile-filter-selects \.mobile-budget-filter \.market-select\s*\{\s*display: none;/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.mobile-filter-selects \.mobile-budget-filter #budgetFilterMenu\s*\{\s*position: static;[\s\S]*?display: grid;/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.mobile-filter-selects \.mobile-budget-filter \.budget-menu\.mobile-budget-editing \.budget-menu-values\s*\{\s*display: flex;/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.results-heading h2\s*\{\s*position: absolute;[\s\S]*?clip: rect\(0, 0, 0, 0\);/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.results-heading \.market-eyebrow,[\s\S]*?\.marketplace-main\[data-marketplace="discover"\] \.results-heading > a\s*\{\s*white-space: nowrap;/);
});

test('Client Projects mobile sticky filters follow the scroll-aware tab switch',()=>{
  const css=read('assets/css/marketplace.css');
  const navJs=read('assets/js/nav-behavior.js');

  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.mobile-market-actions\s*\{[^}]*position: sticky;[^}]*top: 42px;[^}]*pointer-events: none;/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.mobile-market-actions \.market-categories\s*\{[\s\S]*?width: calc\(100% - 16px\);[\s\S]*?pointer-events: auto;/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.mobile-market-sticky-actions\s*\{[\s\S]*?top: 42px;/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.mobile-market-sticky-actions::before\s*\{[\s\S]*?left: 0;[\s\S]*?right: 0;[\s\S]*?border-radius: 10px 0 0 10px;/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.market-discovery-tabs\.scroll-aware-switch\s*\{[^}]*position: sticky;[^}]*top: 0;/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.mobile-market-actions\.switch-hidden\s*\{\s*top: calc\(56px - var\(--page-scroll-mobile-top\)\);/);
  assert.match(css,/\.marketplace-main\[data-marketplace="discover"\] \.mobile-market-sticky-actions\.switch-hidden\s*\{\s*top: calc\(56px - var\(--page-scroll-mobile-top\)\);/);
  assert.match(navJs,/\.marketplace-main\[data-marketplace="discover"\] \.market-discovery-tabs/);
  assert.match(navJs,/\.marketplace-main\[data-marketplace="discover"\] \.mobile-market-actions/);
});

test('Client mobile Explore header leaves only the Favorites icon on the right',()=>{
  const html=read('devmatch-discover-projects.html');
  const developersHtml=read('devmatch-find-developers.html');
  const css=read('assets/css/mobile-navigation.css');

  assert.match(html,/body class="marketplace-client-page client-explore-page client-shell-page page-scroll-shell"/);
  assert.match(html,/class="mobile-explore-favorites" href="devmatch-favorites\.html\?role=client" aria-label="Favorites"/);
  assert.match(developersHtml,/body class="client-shell-page client-nav-home-layout client-explore-page page-scroll-shell"/);
  assert.match(developersHtml,/class="mobile-explore-favorites" href="devmatch-favorites\.html\?role=client" aria-label="Favorites"/);
  assert.match(css,/body\.client-explore-page > header\.topbar > \.top-actions > \.notification-button,[\s\S]*?body\.client-explore-page > header\.topbar > \.top-actions > \.user-menu,[\s\S]*?display: none;/);
  assert.match(css,/body\.client-explore-page > header\.topbar > \.top-actions > \.mobile-explore-favorites[\s\S]*?display: grid;[\s\S]*?place-items: center;/);
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
  assert.match(css,/\.mobile-devs-actions\.switch-hidden\s*\{\s*top: calc\(56px - var\(--page-scroll-mobile-top\)\);/);
  assert.match(css,/\.mobile-devs-sort-menu \.sort-btn:hover,[\s\S]*?background: #f1f2f5;/);
  assert.match(css,/\.mobile-devs-sort-menu \.sort-btn\[aria-checked="true"\]::after[\s\S]*?dropdown-check\.svg/);
  assert.match(css,/\.mobile-devs-sort-menu \.sort-toggle-wrap\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(css,/\.mobile-devs-sort-menu \.sort-btn\s*\{\s*box-sizing: border-box;\s*width: 100%;/);
  assert.match(css,/\.mobile-devs-filter-fields \.filter-pill-btn\s*\{\s*display: none;/);
  assert.match(css,/\.mobile-devs-filter-fields \.filter-dropdown-container \.dropdown-menu\s*\{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css,/\.dropdown-item\.selected::after\s*\{[\s\S]*?dropdown-check\.svg/);
  assert.match(html,/class="mobile-devs-filter-heading" role="heading" aria-level="3">Specialization/);
  assert.match(html,/class="mobile-devs-filter-heading" role="heading" aria-level="3">Status/);
  assert.match(css,/\.devs-grid\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
});

test('Client Developers mobile tab switch matches the Projects switch animation',()=>{
  const css=read('assets/css/find-developers.css');
  const html=read('devmatch-find-developers.html');
  const navJs=read('assets/js/nav-behavior.js');
  const mobileProjectsAnimation=css.lastIndexOf('.devs-tabs-toggle.projects-active::before');
  const desktopDevelopersAnimation=css.indexOf('.devs-tabs-toggle.developers-active::before');

  assert.match(html,/find-developers\.css\?v=20261127-mobile-devs-dock-under-header-v1/);
  assert.match(html,/nav-behavior\.js\?v=20261127-mobile-devs-dock-under-header-v1/);
  assert.match(css,/\.devs-tabs-toggle::before\s*\{[\s\S]*?box-shadow: 0 1px 4px #00000014;/);
  assert.ok(mobileProjectsAnimation > desktopDevelopersAnimation,'the mobile Projects animation should override the shared desktop rule');
  assert.match(css.slice(mobileProjectsAnimation),/^\.devs-tabs-toggle\.projects-active::before\s*\{\s*animation: devs-tab-to-projects 0\.42s cubic-bezier\(0\.22, 1, 0\.36, 1\) 0\.08s both;/);
  assert.match(css,/\.devs-tabs-toggle\.developers-active::before\s*\{[\s\S]*?animation: devs-tab-to-developers 0\.32s cubic-bezier\(0\.22, 1, 0\.36, 1\) both;/);
  assert.match(navJs,/\.find-developers-main \.devs-tabs-toggle/);
  assert.match(navJs,/\.find-developers-main \.mobile-devs-actions/);
  assert.match(css,/\.find-developers-main \.devs-tabs-toggle\.scroll-aware-switch\s*\{[^}]*position: sticky;[^}]*top: 0;[\s\S]*?transition: transform 240ms cubic-bezier\(\.22,\.61,\.36,1\);/);
  assert.match(css,/\.find-developers-main \.devs-tabs-toggle\.scroll-aware-switch-hidden\s*\{\s*transform: translateY\(calc\(-100% - 32px\)\);\s*pointer-events: none;/);
});

test('Client Developers mobile filters apply only on confirmation and use the Projects empty state',()=>{
  const html=read('devmatch-find-developers.html');
  const css=read('assets/css/find-developers.css');
  const js=read('assets/js/find-developers.js');

  assert.match(js,/mobileDeveloperFilterDraft\[key\] = value;[\s\S]*?syncDeveloperFilterControls\(mobileDeveloperFilterDraft\);[\s\S]*?return;/);
  assert.match(js,/resetButton\.addEventListener\('click', \(\) => \{[\s\S]*?mobileDeveloperFilterDraft = \{[\s\S]*?specialization: 'all',[\s\S]*?status: 'all'[\s\S]*?syncDeveloperFilterControls\(mobileDeveloperFilterDraft\);[\s\S]*?\}\);/);
  assert.match(js,/applyButton\.addEventListener\('click', \(\) => \{[\s\S]*?selectedSpecialization = filters\.specialization;[\s\S]*?selectedStatus = filters\.status;[\s\S]*?renderDevelopers\(\);[\s\S]*?setFilterPanelOpen\(false\);/);
  assert.match(js,/if \(isOpen\) \{[\s\S]*?mobileDeveloperFilterDraft = getDeveloperFilterValues\(\);[\s\S]*?\} else \{[\s\S]*?mobileDeveloperFilterDraft = null;/);
  assert.match(html,/No developers match your filters/);
  assert.match(html,/Try changing your search or resetting the filters to see more developers\./);
  assert.match(css,/\.devs-empty-state\s*\{\s*padding: 45px 20px;[\s\S]*?background: transparent;[\s\S]*?border: 0;/);
  assert.match(css,/\.devs-empty-state \.btn-search-devs\s*\{\s*width: auto;/);
});
