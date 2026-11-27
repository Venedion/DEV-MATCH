const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const marketplaceCss=fs.readFileSync(path.join(__dirname,'../assets/css/marketplace.css'),'utf8');
const findClientsCss=fs.readFileSync(path.join(__dirname,'../assets/css/find-clients.css'),'utf8');
const mobileNavigationCss=fs.readFileSync(path.join(__dirname,'../assets/css/mobile-navigation.css'),'utf8');
const marketplaceJs=fs.readFileSync(path.join(__dirname,'../assets/js/marketplace.js'),'utf8');
const findClientsJs=fs.readFileSync(path.join(__dirname,'../assets/js/find-clients.js'),'utf8');
const navBehaviorJs=fs.readFileSync(path.join(__dirname,'../assets/js/nav-behavior.js'),'utf8');

test('mobile project categories and sort/filter actions stay sticky together',()=>{
  assert.match(marketplaceJs,/actions\.append\(categories\);\s*stickyActions\.append\(sortControl, toggle, panel\)/);
  assert.match(marketplaceCss,/\.find-projects-page \.marketplace-main\[data-marketplace="requests"\] #resultsSummary\{\s*width:100%;\s*text-align:left;/);
  const actionStyles=marketplaceCss.match(/\.find-projects-page \.marketplace-main\[data-marketplace="requests"\] \.mobile-market-actions\{\s*display:block;[^}]*\}/);
  const stickyStyles=marketplaceCss.match(/\.mobile-market-sticky-actions\{\s*--mobile-actions-edge-gap:14px;[^}]*\}/);
  assert.ok(actionStyles,'mobile project categories should have a sticky wrapper');
  assert.match(actionStyles[0],/position:sticky/);
  assert.match(actionStyles[0],/top:42px/);
  assert.match(actionStyles[0],/z-index:31/);
  assert.match(actionStyles[0],/pointer-events:none/);
  assert.match(actionStyles[0],/transition:top 240ms cubic-bezier\(\.22,\.61,\.36,1\)/);
  assert.match(marketplaceCss,/\.find-projects-page \.marketplace-main\[data-marketplace="requests"\] \.mobile-market-actions \.market-categories\{[^}]*pointer-events:auto;/);
  assert.match(stickyStyles?.[0]||'',/position:sticky/);
  assert.match(stickyStyles?.[0]||'',/width:42px/);
  assert.match(stickyStyles?.[0]||'',/margin-top:-92px;/);
  assert.match(marketplaceCss,/mobile-market-sticky-actions::before\{[^}]*border-radius:10px 0 0 10px;/);
  assert.doesNotMatch(marketplaceCss,/mobile-actions-background-bleed|mobile-market-actions::after/);
});

test('developer project request categories and filters move directly under the header when the switch hides',()=>{
  assert.match(marketplaceCss,/\.find-projects-page \.marketplace-main\[data-marketplace="requests"\] \.mobile-market-actions\.switch-hidden\{\s*top:calc\(56px - var\(--page-scroll-mobile-top\)\);/);
  assert.match(marketplaceCss,/\.find-projects-page \.marketplace-main\[data-marketplace="requests"\] \.mobile-market-sticky-actions\{\s*--mobile-actions-edge-gap:14px;[\s\S]*?top:42px;[\s\S]*?z-index:32;/);
  assert.match(marketplaceCss,/\.find-projects-page \.marketplace-main\[data-marketplace="requests"\] \.mobile-market-sticky-actions\.switch-hidden\{\s*top:calc\(56px - var\(--page-scroll-mobile-top\)\);/);
  assert.match(marketplaceCss,/\.find-projects-page \.marketplace-main\[data-marketplace="requests"\] \.mobile-market-actions,\s*\.find-projects-page \.marketplace-main\[data-marketplace="requests"\] \.mobile-market-sticky-actions\{\s*transition-duration:1ms;/);
  assert.match(navBehaviorJs,/\.find-projects-page \.find-projects-switch/);
  assert.match(navBehaviorJs,/\.find-projects-page \.mobile-market-actions/);
  assert.match(navBehaviorJs,/exploreFilterActions\.forEach\(actions => actions\.classList\.toggle\('switch-hidden', isHidden\)\)/);
});

test('square viewports explicitly use the shared mobile navigation layout',()=>{
  assert.match(mobileNavigationCss,/@media\s*\(aspect-ratio:\s*1\s*\/\s*1\)\s*\{\s*:root\s*\{\s*--sidebar:\s*66px;\s*--cd-sidebar:\s*66px;\s*\}[\s\S]*?body > \.sidebar,[\s\S]*?display:\s*none !important;[\s\S]*?\.mobile-bottom-nav\s*\{\s*display:\s*flex;/);
});

test('mobile client sort and filter buttons stick inside a compact dock',()=>{
  const stickyStyles=findClientsCss.match(/\.find-clients-main \.mobile-clients-actions \{\s*box-sizing:\s*border-box;[^}]*\}/);
  assert.match(stickyStyles?.[0]||'',/position: sticky/);
  assert.match(stickyStyles?.[0]||'',/width: 42px/);
  assert.match(stickyStyles?.[0]||'',/height: 82px/);
  assert.match(stickyStyles?.[0]||'',/border-radius: 10px 0 0 10px/);
  assert.match(stickyStyles?.[0]||'',/grid-template-rows: 38px 38px;\s*gap: 2px;/);
  assert.match(stickyStyles?.[0]||'',/margin: 4px -14px 10px auto;\s*padding: 0 0 4px;/);
  assert.match(findClientsCss,/\.find-clients-main \.clients-count-header \{\s*position: relative;\s*margin: 0 0 14px;\s*padding: 12px 0;/);
  assert.match(findClientsCss,/@media\s*\(orientation:\s*portrait\)\s*\{\s*\.find-clients-main \{\s*--page-scroll-mobile-top: 60px;\s*\}\s*\.find-clients-main \.clients-count-header \{\s*margin-top: -54px;/);
  assert.doesNotMatch(findClientsCss,/mobile-actions-background-bleed|mobile-clients-actions::before|mobile-clients-actions::after/);
});

test('mobile Find Clients can sort by the highest open-request count',()=>{
  const clientsHtml=fs.readFileSync(path.join(__dirname,'../devmatch-find-clients.html'),'utf8');

  assert.match(clientsHtml,/data-sort-value="requests" aria-checked="false">Most Open Requests/);
  assert.match(findClientsJs,/if \(sortOrder === 'requests'\) \{\s*return b\.openRequestsCount - a\.openRequestsCount \|\| a\.name\.localeCompare\(b\.name\);/);
  assert.match(findClientsJs,/option\.setAttribute\('aria-checked', String\(option\.dataset\.sortValue === sortOrder\)\)/);
});

test('mobile client sort menu keeps its position through the close animation',()=>{
  const closeSortMenu=findClientsJs.match(/function closeSortMenu\(\{focusToggle = false\} = \{\}\) \{[\s\S]*?\n    \}/);
  assert.ok(closeSortMenu,'mobile sort menu should have a dedicated close handler');
  assert.match(closeSortMenu[0],/mobileClientsSortMenu\.hidePopover\(\)/);
  assert.doesNotMatch(closeSortMenu[0],/style\.removeProperty/);
});

test('developer Explore mobile headers replace notification and profile links with Favorites',()=>{
  const clientsHtml=fs.readFileSync(path.join(__dirname,'../devmatch-find-clients.html'),'utf8');
  const projectsHtml=fs.readFileSync(path.join(__dirname,'../devmatch-find-projects.html'),'utf8');

  for(const html of [clientsHtml,projectsHtml]){
    assert.match(html,/class="mobile-explore-favorites" href="devmatch-favorites\.html" aria-label="Favorites"/);
    assert.match(html,/developer-explore-page/);
  }
  assert.match(mobileNavigationCss,/body\.developer-explore-page > header\.topbar > \.top-actions > \.notification-button,\s*body\.developer-explore-page > header\.topbar > \.top-actions > \.user-menu \{\s*display: none;/);
  assert.match(mobileNavigationCss,/body\.developer-explore-page > header\.topbar > \.top-actions > \.mobile-explore-favorites \{\s*width: 32px;[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
  assert.match(mobileNavigationCss,/\.mobile-explore-favorites svg \{\s*width: 20px;\s*height: 20px;\s*stroke-width: 2\.8;/);
});

test('mobile Messages uses back and MESSAGES header instead of logo and search',()=>{
  const chatHtml=fs.readFileSync(path.join(__dirname,'../devmatch-chat.html'),'utf8');
  const chatCss=fs.readFileSync(path.join(__dirname,'../assets/css/chat.css'),'utf8');
  const navCss=fs.readFileSync(path.join(__dirname,'../assets/css/mobile-navigation.css'),'utf8');
  const navJs=fs.readFileSync(path.join(__dirname,'../assets/js/nav-behavior.js'),'utf8');
  const chatJs=fs.readFileSync(path.join(__dirname,'../assets/js/chat.js'),'utf8');
  const favoritesCss=fs.readFileSync(path.join(__dirname,'../assets/css/favorites.css'),'utf8');
  const sidebarNavJs=fs.readFileSync(path.join(__dirname,'../assets/js/sidebar-navigation.js'),'utf8');

  assert.match(chatHtml,/class="mobile-chat-back" id="mobileChatBack"/);
  assert.match(chatHtml,/class="mobile-chat-heading" style="font-size:15px">MESSAGES<\/h1>/);
  assert.match(favoritesCss,/body\.favorites-page-layout \.mobile-favorites-title \{\s*display: block;[\s\S]*?font-size: 15px;/);
  assert.match(chatHtml,/id="mobileChatTotalBadge"/);
  assert.match(chatHtml,/id="mobileMarkAllReadBtn"/);
  assert.match(chatJs,/const mobileTotalBadgeEl = document\.getElementById\('mobileChatTotalBadge'\)/);
  assert.match(chatJs,/document\.getElementById\('mobileMarkAllReadBtn'\)\?\.addEventListener/);
  assert.match(chatJs,/syncMobileChatRoomNavbar\(true\)/);
  assert.match(chatJs,/syncMobileChatRoomNavbar\(false\)/);
  assert.match(navCss,/\.mobile-bottom-nav\.chat-room-open \{\s*opacity: 0;[\s\S]*?transform: translateY\(calc\(100% \+ 18px\)\);/);
  assert.match(chatCss,/\.chat-conv-header \{\s*display: none;/);
  assert.match(navCss,/body\.chat-body > header\.topbar > \.brand,[\s\S]*?body\.chat-body > header\.topbar > \.search,[\s\S]*?body\.chat-body > header\.topbar > \.mobile-search-toggle,[\s\S]*?body\.chat-body > header\.topbar > \.top-actions \{\s*display: none !important;/);
  assert.match(navCss,/body\.chat-body > header\.topbar > \.mobile-chat-heading-wrap \{\s*grid-column: 2;/);
  assert.match(navCss,/body\.chat-body > header\.topbar > \.mobile-chat-heading \{[\s\S]*?font-size: 15px !important;/);
  assert.match(chatCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.chat-viewport \{\s*top: 56px;\s*left: 0;/);
  assert.match(navJs,/document\.body\.classList\.contains\('chat-body'\)/);
  assert.match(navJs,/role === 'client'\s*\?\s*'devmatch-discover-projects\.html'\s*:\s*'devmatch-find-projects\.html'/);
  assert.match(navJs,/const mobileChatReturnUrlStorageKey = 'devmatch-mobile-chat-return-url'/);
  assert.match(navJs,/sessionStorage\.setItem\(mobileChatReturnUrlStorageKey, window\.location\.href\)/);
  assert.match(navJs,/if \(storedReturnUrl\) \{\s*mobileChatHasStoredOrigin = true;\s*chatBackLink\.href = storedReturnUrl;/);
  assert.match(navJs,/const storedUrl = sessionStorage\.getItem\(mobileChatReturnUrlStorageKey\);[\s\S]*?if \(storedUrl\)/);
  assert.match(navJs,/previous\.origin === location\.origin && !previous\.pathname\.endsWith\('\/devmatch-chat\.html'\)/);
  assert.match(navJs,/if \(document\.body\.classList\.contains\('chat-body'\)\) \{[\s\S]*?\n  \} else \{\s*try \{\s*sessionStorage\.removeItem\(mobileChatReturnUrlStorageKey\)/);
  assert.match(navJs,/mobileChatBackLink && mobileNavigationBreakpoint\.matches && mobileChatHasStoredOrigin/);
  assert.match(navJs,/sessionStorage\.removeItem\(mobileChatReturnUrlStorageKey\)[\s\S]*?window\.history\.back\(\)/);
  assert.match(sidebarNavJs,/devmatch-mobile-chat-return-tab/);
  assert.match(sidebarNavJs,/if \(page === 'devmatch-chat\.html'\)/);
  assert.match(navJs,/chatLink && mobileNavigationBreakpoint\.matches/);
  const savedChatOrigin=navJs.indexOf('sessionStorage.setItem(mobileChatReturnUrlStorageKey, window.location.href);');
  const preventedClickGuard=navJs.indexOf('if (event.defaultPrevented) return;',savedChatOrigin);
  assert.ok(savedChatOrigin>=0&&preventedClickGuard>savedChatOrigin);
});

test('mobile room chat uses mobile composer and latest-message button',()=>{
  const chatHtml=fs.readFileSync(path.join(__dirname,'../devmatch-chat.html'),'utf8');
  const chatCss=fs.readFileSync(path.join(__dirname,'../assets/css/chat.css'),'utf8');
  const chatJs=fs.readFileSync(path.join(__dirname,'../assets/js/chat.js'),'utf8');

  assert.match(chatHtml,/placeholder="Type a message\.\."/);
  assert.match(chatHtml,/id="chatScrollBottomBtn"/);
  assert.match(chatJs,/const mobileRoom = mobileChatBreakpoint\.matches[\s\S]*?event\.key === 'Enter' && !mobileRoom/);
  assert.equal((chatJs.match(/if \(mobileChatBreakpoint\.matches\) messageInputEl\?\.blur\(\);\s*else messageInputEl\?\.focus\(\);/g)||[]).length,2);
  assert.match(chatJs,/chatScrollBottomBtn/);
  assert.match(chatJs,/addEventListener\('click'/);
  assert.match(chatJs,/distanceFromBottom < 120/);
  assert.match(chatJs,/behavior: 'smooth'/);
  assert.match(chatCss,/body\.mobile-chat-room-open \.chat-main-header::before \{[\s\S]*?background: linear-gradient\(/);
  assert.match(chatCss,/backdrop-filter: blur\(18px\) saturate\(150%\)/);
  assert.match(chatCss,/body\.mobile-chat-room-open \.chat-composer-hint \{\s*display: none;/);
  assert.match(chatCss,/\.chat-scroll-bottom \{\s*position: absolute;/);
  assert.match(chatCss,/body\.mobile-chat-room-open \.chat-back-btn \{[\s\S]*?border-radius: 50%;[\s\S]*?backdrop-filter: blur\(14px\) saturate\(160%\)/);
  assert.match(chatCss,/body\.mobile-chat-room-open \.chat-main-header::before \{[\s\S]*?inset: 0 0 -84px;[\s\S]*?rgb\(255 255 255 \/ 94%\) 0%[\s\S]*?rgb\(255 255 255 \/ 74%\) 56%[\s\S]*?rgb\(255 255 255 \/ 26%\) 90%[\s\S]*?rgb\(255 255 255 \/ 0%\) 100%[\s\S]*?-webkit-backdrop-filter: blur\(18px\) saturate\(150%\);[\s\S]*?backdrop-filter: blur\(18px\) saturate\(150%\);[\s\S]*?-webkit-mask-image: linear-gradient\([\s\S]*?rgba\(0, 0, 0, \.24\) 88%[\s\S]*?rgba\(0, 0, 0, 0\) 100%[\s\S]*?\);[\s\S]*?mask-image: linear-gradient\(/);
  assert.doesNotMatch(chatCss,/body\.mobile-chat-room-open \.chat-main-header::after/);
  assert.match(chatCss,/\.chat-scroll-bottom \{[\s\S]*?bottom: calc\(100% \+ 8px\);[\s\S]*?cubic-bezier\(\.22, \.61, \.36, 1\)/);
  assert.match(chatCss,/body\.mobile-chat-room-open \.chat-main-header \{[\s\S]*?position: absolute;[\s\S]*?top: 0;/);
  assert.match(chatCss,/body\.mobile-chat-room-open \.chat-thread-container \{[\s\S]*?height: 100%;[\s\S]*?padding-top: 70px;/);
  assert.match(chatCss,/body\.mobile-chat-room-open \.chat-main-header \{[\s\S]*?border-bottom: 0;[\s\S]*?isolation: isolate;[\s\S]*?background: transparent;/);
  assert.match(chatCss,/body\.mobile-chat-room-open \.chat-header-actions \.chat-action-btn\.icon-only \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
  assert.match(chatCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.chat-detail-pane \{\s*position: fixed;[\s\S]*?inset: 0 0 0 auto;[\s\S]*?width: min\(var\(--chat-detail-width\), 88vw\);/);
  assert.match(chatHtml,/id="chatDetailBackdrop"[^>]*hidden/);
  assert.match(chatJs,/if \(detailBackdropEl\) detailBackdropEl\.hidden = !isMobileModal/);
  assert.match(chatJs,/detailBackdropEl\?\.addEventListener\('click', \(\) => setDetailPaneOpen\(false\)\)/);
  assert.match(chatJs,/event\.key === 'Escape'[\s\S]*?mobileChatBreakpoint\.matches/);
});

test('mobile Favorites uses an Explore header, active Explore navigation, and sticky pill tabs',()=>{
  const favoritesHtml=fs.readFileSync(path.join(__dirname,'../devmatch-favorites.html'),'utf8');
  const favoritesCss=fs.readFileSync(path.join(__dirname,'../assets/css/favorites.css'),'utf8');
  const favoritesJs=fs.readFileSync(path.join(__dirname,'../assets/js/favorites.js'),'utf8');
  const sidebarNavigationJs=fs.readFileSync(path.join(__dirname,'../assets/js/sidebar-navigation.js'),'utf8');

  assert.match(favoritesHtml,/class="mobile-favorites-back" id="mobileFavoritesBack" href="devmatch-find-projects\.html"/);
  assert.match(favoritesHtml,/class="mobile-favorites-heading"[\s\S]*?<h1 class="mobile-favorites-title">FAVORITES<\/h1>[\s\S]*?id="mobileFavCount">0 saved/);
  assert.match(favoritesHtml,/class="fav-btn mobile-favorites-clear-all"[^>]*data-favorites-clear-all/);
  assert.match(favoritesHtml,/class="mobile-favorites-sticky-actions" id="mobileFavoritesStickyActions"/);
  assert.match(favoritesHtml,/id="mobileFavoritesSortToggle"[\s\S]*?aria-controls="mobileFavoritesSortPanel"/);
  assert.match(favoritesHtml,/id="mobileFavoritesFilterToggle"[\s\S]*?aria-controls="mobileFavoritesFilterPanel"/);
  assert.match(favoritesHtml,/id="mobileFavoritesSortOptions"/);
  assert.match(favoritesHtml,/id="mobileFavoritesTypeGroup" hidden[\s\S]*?id="favTypeSelect"[\s\S]*?id="mobileFavoritesTypeOptions"/);
  assert.match(favoritesHtml,/id="mobileFavoritesCategoryHeading">Categories<\/p>[\s\S]*?id="mobileFavoritesCategoryOptions"/);
  assert.match(favoritesHtml,/id="mobileFavoritesOpenRequestsGroup" hidden[\s\S]*?id="mobileFavoritesOpenRequests"/);
  assert.match(favoritesHtml,/id="mobileFavoritesLocationGroup" hidden[\s\S]*?id="mobileFavoritesCountryOptions"[\s\S]*?id="mobileFavoritesRegionOptions"/);
  assert.match(favoritesHtml,/client-profile-options\.js[\s\S]*?favorites\.js/);
  assert.match(favoritesHtml,/nav-behavior\.js\?v=/);
  assert.match(favoritesHtml,/id="favClearAllBtn" data-favorites-clear-all/);
  assert.match(favoritesCss,/@media \(max-width: 600px\) and \(orientation: portrait\),\s*\(aspect-ratio: 1 \/ 1\) \{/);
  assert.match(favoritesCss,/body\.favorites-page-layout > main\.dashboard\.favorites-page \{\s*padding: 0 13px 90px 12px !important;/);
  assert.match(favoritesCss,/body\.favorites-page-layout \.fav-grid \{\s*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(favoritesCss,/body\.favorites-page-layout \.fav-client-card \{\s*box-sizing: border-box;\s*width: 100%;\s*min-width: 0;/);
  assert.match(favoritesCss,/body\.favorites-page-layout \.fav-client-meta-box \{\s*min-width: 0;\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(favoritesHtml,/favorites\.css\?v=20261127-favorites-square-mobile-cards-v1/);
  assert.match(favoritesJs,/new URL\(document\.referrer \|\| window\.location\.href\)/);
  assert.match(favoritesJs,/querySelectorAll\('\[data-favorites-clear-all\]'\)/);
  assert.match(favoritesJs,/mobileFavCountEl\.textContent = savedCountText/);
  assert.match(favoritesJs,/function renderMobileFavoritesSortOptions\(\)/);
  assert.match(favoritesJs,/function renderMobileFavoritesFilterOptions\(\)/);
  assert.match(favoritesJs,/currentType !== 'all'/);
  assert.match(favoritesJs,/favoriteClientsWithOpenRequestsOnly/);
  assert.match(favoritesJs,/favoriteClientLocation\.country !== 'all'/);
  assert.match(favoritesJs,/getFavoriteClientRegion\(client\)/);
  assert.match(favoritesJs,/clientProfileOptions\.businessTypes\.map/);
  assert.match(favoritesJs,/country: String\(profile\.country \|\| ''\),\s*profileCity: String\(profile\.city \|\| ''\)/);
  assert.match(favoritesJs,/function renderMobileFavoriteClientLocationOptions/);
  assert.match(favoritesJs,/function loadFavoriteClientLocationOptions/);
  assert.match(favoritesJs,/filterPanel\.scrollTop = 0;/);
  assert.match(sidebarNavigationJs,/\['explore', 'findProjects', 'findClients', 'discover', 'developers', 'favorites'\]\.includes\(effectiveActiveKey\)/);
  assert.match(favoritesCss,/mobile-favorites-clear-all span \{\s*text-decoration: underline;/);
  assert.match(favoritesCss,/body\.favorites-page-layout \.mobile-favorites-title \{\s*display: block;/);
  assert.match(favoritesCss,/body\.favorites-page-layout \.fav-toolbar \{\s*position: sticky;\s*top: 42px;/);
  assert.match(favoritesCss,/body\.favorites-page-layout \.mobile-favorites-sticky-actions \{\s*position: relative;/);
  assert.match(favoritesCss,/body\.favorites-page-layout \.fav-tabs \{\s*position: sticky;\s*top: 0;\s*z-index: 20;/);
  assert.match(navBehaviorJs,/document\.querySelector\('\.favorites-page-layout \.fav-tabs'\)/);
  assert.match(navBehaviorJs,/const exploreSwitchBreakpoint = window\.matchMedia\('\(orientation: portrait\)'\)/);
  assert.match(navBehaviorJs,/setExploreSwitchHidden\(nextDirection > 0\)/);
  assert.match(navBehaviorJs,/exploreSwitch\.contains\(document\.activeElement\) &&\s*\(!isFavoritesTabSwitch \|\| document\.activeElement\.matches\(':focus-visible'\)\)/);
  assert.match(favoritesCss,/\.fav-tabs\.scroll-aware-switch \{\s*transition: transform 240ms cubic-bezier\(\.22, \.61, \.36, 1\);/);
  assert.match(favoritesCss,/\.fav-tabs\.scroll-aware-switch-hidden \{\s*transform: translateY\(calc\(-100% - 32px\)\);\s*pointer-events: none;/);
  assert.match(favoritesCss,/body\.favorites-page-layout \.fav-toolbar \{\s*position: sticky;\s*top: 42px;[\s\S]*?transition: top 240ms cubic-bezier\(\.22, \.61, \.36, 1\);/);
  assert.match(favoritesCss,/body\.favorites-page-layout \.fav-tabs\.scroll-aware-switch-hidden \+ \.fav-toolbar \{\s*top: 0;/);
  assert.match(favoritesCss,/body\.favorites-page-layout \.fav-tabs::after \{\s*z-index: 0;\s*top: 5px;\s*bottom: 5px;/);
  assert.match(favoritesCss,/body\.favorites-page-layout \.mobile-favorites-filter-options \{\s*display: grid;/);
  assert.match(favoritesCss,/body\.favorites-page-layout \.mobile-favorites-sort-options \{\s*display: grid;/);
  assert.match(favoritesCss,/\.mobile-favorites-clear-all,\s*\.mobile-favorites-sticky-actions \{\s*display: none;/);
  assert.match(favoritesCss,/transition: opacity \.18s ease, transform \.18s ease, display \.18s allow-discrete;/);
  assert.match(favoritesCss,/@starting-style \{\s*body\.favorites-page-layout \.mobile-favorites-sort-panel:not\(\[hidden\]\),\s*body\.favorites-page-layout \.mobile-favorites-filter-panel:not\(\[hidden\]\)/);
  assert.match(favoritesCss,/\.mobile-favorites-filter-group:not\(\[hidden\]\) ~ \.mobile-favorites-filter-group:not\(\[hidden\]\) \{\s*padding-top: 8px;\s*border-top: 1px solid #e5e6eb;/);
  assert.match(favoritesCss,/mobile-favorites-filter-panel > p \{\s*margin: 0;\s*padding: 0 8px 8px;\s*border-bottom: 1px solid #e5e6eb;/);
});

test('mobile client filter panel lists options inline like project requests',()=>{
  assert.match(findClientsJs,/className = 'mobile-client-filter-options'/);
  assert.match(findClientsJs,/querySelectorAll\('\.dropdown-item'\)/);
  assert.match(findClientsJs,/closest\('\.dropdown-item, \.mobile-client-filter-option'\)/);
  assert.match(findClientsCss,/\.mobile-client-filter-section \{\s*display: none;/);
  assert.match(findClientsCss,/\.find-clients-main \.mobile-clients-filter-fields \.filter-pill-btn \{\s*display: none;/);
  assert.match(findClientsCss,/\.find-clients-main \.mobile-client-filter-options \{\s*display: grid;[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(findClientsCss,/\.find-clients-main \.mobile-clients-filter-fields \.business-type-dropdown \.dropdown-menu \{\s*display: none !important;/);
});

test('client filters use profile setup options and support country-based multi-region selection',()=>{
  const profileOptions=fs.readFileSync(path.join(__dirname,'../assets/js/client-profile-options.js'),'utf8');
  const profileJs=fs.readFileSync(path.join(__dirname,'../assets/js/profile.js'),'utf8');
  const profileHtml=fs.readFileSync(path.join(__dirname,'../devmatch-profile.html'),'utf8');
  const clientsHtml=fs.readFileSync(path.join(__dirname,'../devmatch-find-clients.html'),'utf8');

  assert.match(profileOptions,/countries: Object\.freeze\(\['Indonesia', 'Malaysia', 'Singapore'\]\)/);
  assert.match(profileOptions,/businessTypes: Object\.freeze\(\[/);
  assert.match(profileJs,/const industryOptions=clientProfileOptions\.businessTypes/);
  assert.match(profileJs,/clientProfileOptions\.countries\.map/);
  assert.match(profileHtml,/client-profile-options\.js/);
  assert.match(clientsHtml,/client-profile-options\.js/);
  assert.match(findClientsJs,/selectedLocation = \{country: 'all', regions: \[\]\}/);
  assert.match(findClientsJs,/clientLocationRegions = groups/);
  assert.match(findClientsJs,/button\.addEventListener\('click', event => \{\s*event\.stopPropagation\(\);\s*selectLocationCountry\(value\);/);
  assert.match(findClientsJs,/button\.setAttribute\('aria-expanded', String\(locationFilterDraft\.country === value && value !== 'all'\)\)/);
  assert.match(findClientsJs,/event\.stopPropagation\(\);\s*toggleLocationRegion\(region\.name\);/);
  assert.match(findClientsJs,/locationRegionSection\?\.scrollIntoView\(\{block: 'nearest'\}\)/);
  assert.match(findClientsJs,/region\.name\.toLocaleLowerCase\(\)\.includes\(query\)/);
  assert.match(findClientsJs,/locationRegionSearch\?\.addEventListener\('input'/);
  assert.match(findClientsJs,/country === 'Malaysia' \? 'All states' : country === 'Singapore' \? 'All regions' : 'All provinces'/);
  assert.match(findClientsJs,/function selectAllLocationRegions\(\) \{\s*locationFilterDraft\.regions = \[\];/);
  assert.match(findClientsJs,/function createLocationOptionCheckmark\(\)[\s\S]*?path\.setAttribute\('d', 'm5 12 4 4L19 6'\)/);
  assert.match(findClientsJs,/allOption\.append\(labelElement, createLocationOptionCheckmark\(\)\)/);
  assert.match(findClientsJs,/button\.append\(labelElement, createLocationOptionCheckmark\(\)\)/);
  assert.match(findClientsJs,/selectAllLocationRegions\(\);/);
  assert.match(findClientsJs,/locationFilterDraft\.regions = \[\.\.\.selected\]/);
  assert.match(findClientsJs,/locationFilterApply\?\.addEventListener\('click'/);
  assert.match(findClientsJs,/client\.country\.toLocaleLowerCase\(\) !== selectedLocation\.country\.toLocaleLowerCase\(\)/);
  assert.match(clientsHtml,/id="locationFilterApply" type="button">Apply/);
  assert.match(clientsHtml,/id="locationRegionSearch" type="search"/);
  assert.match(findClientsCss,/\.location-region-search \{\s*box-sizing: border-box;[^}]*width: 100%;/);
  assert.match(findClientsCss,/\.find-clients-main \.mobile-clients-filter-panel \{\s*position: absolute;[^}]*max-height: min\(620px, calc\(100dvh - 270px - env\(safe-area-inset-bottom, 0px\)\)\);[^}]*overflow-y: auto;/);
  assert.match(findClientsCss,/\.find-clients-main \.mobile-clients-filter-fields \.location-filter-menu \{\s*position: static;[^}]*display: grid !important;[^}]*opacity: 1;[^}]*transform: none;/);
  assert.match(findClientsCss,/\.find-clients-main \.mobile-clients-filter-fields \.location-region-options \{\s*max-height: none;[^}]*overflow: visible;[^}]*overscroll-behavior: auto;/);
  assert.match(findClientsCss,/\.location-region-all-option \{\s*grid-column: 1 \/ -1;/);
  assert.match(findClientsCss,/\.location-country-option\[aria-pressed="true"\] svg,\s*\.location-region-option\[aria-pressed="true"\] svg \{\s*display: block;/);
  assert.match(findClientsCss,/\.location-region-all-option svg \{\s*position: absolute;\s*right: 8px;/);
  assert.match(findClientsCss,/\.find-clients-main \.mobile-clients-filter-fields \.location-filter-apply \{\s*display: none;/);
  assert.match(findClientsCss,/\.find-clients-main \.mobile-clients-filter-panel\[hidden\] \{\s*display: none;/);
  assert.match(findClientsCss,/\.find-clients-main \.mobile-clients-filter-fields \.toggle-requests-pill \{\s*order: -1;/);
  assert.match(findClientsJs,/selectedLocation = copyLocationFilter\(locationFilterDraft\)/);
});
