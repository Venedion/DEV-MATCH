const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const notificationsCss=fs.readFileSync(path.join(root,'assets/css/notifications.css'),'utf8');
const notificationsJs=fs.readFileSync(path.join(root,'assets/js/notifications.js'),'utf8');
const navigationJs=fs.readFileSync(path.join(root,'assets/js/nav-behavior.js'),'utf8');
const mobileNavigationCss=fs.readFileSync(path.join(root,'assets/css/mobile-navigation.css'),'utf8');

test('mobile notification list stops at a visual boundary and keeps notification rows complete',()=>{
  assert.doesNotMatch(notificationsJs,/MOBILE_NOTIFICATION_LIMIT/);
  assert.match(notificationsJs,/const MOBILE_NOTIFICATION_DISPLAY_BOUNDARY_RATIO = 0\.73/);
  assert.match(notificationsJs,/function getMobileNotificationDisplayBoundary\(\)/);
  assert.match(notificationsJs,/matchingRows\.findIndex\(row => row\.getBoundingClientRect\(\)\.bottom > displayBoundary \+ 0\.5\)/);
  assert.match(notificationsJs,/index >= firstOverflowIndex/);
  assert.match(notificationsJs,/group\.hidden = !group\.querySelector\('\.notification-row:not\(\[hidden\]\):not\(\.is-mobile-collapsed\)'\)/);
  assert.match(notificationsJs,/newlyReceivedNotificationIds = new Set\(unreadIds\)/);
  assert.match(notificationsJs,/function orderNotificationsNewestFirst\(notifications\)/);
  assert.match(notificationsJs,/notificationList\.style\.setProperty\('--notification-list-collapsed-height'/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-list\.has-mobile-overflow #notificationItems\{[^}]*height:var\(--notification-list-collapsed-height\);overflow:hidden/);
});

test('mobile list expansion shows View All and sticky View Less without adding desktop UI',()=>{
  assert.match(notificationsJs,/listToggle\.textContent = mobileListExpanded \? 'View Less' : 'View All'/);
  assert.match(notificationsJs,/listToggle\.addEventListener\('click'/);
  assert.match(notificationsJs,/mobileListExpandedScrollTop = scrollRoot \? scrollRoot\.scrollTop : window\.scrollY/);
  assert.match(notificationsJs,/if \(scrollRoot\) scrollRoot\.scrollTop = mobileListExpandedScrollTop \?\? 0/);
  assert.match(notificationsJs,/itemsContainer\.animate\([\s\S]*duration: 220/);
  assert.match(notificationsJs,/window\.addEventListener\('resize', scheduleMobileBoundaryUpdate\)/);
  assert.match(notificationsJs,/window\.addEventListener\('scroll', scheduleMobileBoundaryUpdate, \{passive: true\}\)/);
  assert.match(notificationsJs,/new ResizeObserver\(scheduleMobileBoundaryUpdate\)/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-list\.has-mobile-overflow>\.notification-list-toggle:not\(\[hidden\]\)\{[^}]*top:var\(--notification-list-collapsed-height\)/);
  assert.match(navigationJs,/table: 'notifications'[\s\S]*if \(mobileNavigationBreakpoint\.matches\) \{\s*window\.dispatchEvent\(new CustomEvent\('devmatch:notification-received'/);
  assert.match(notificationsJs,/window\.addEventListener\('devmatch:notification-received', event => \{\s*if \(!mobileListLayout\.matches/);
  assert.match(notificationsJs,/newlyReceivedNotificationIds\.add\(notification\.id\)/);
  assert.match(notificationsCss,/\.notification-list-toggle\{display:none\}/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-list-toggle:not\(\[hidden\]\)\{[^}]*display:flex/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-list-toggle:not\(\[hidden\]\)\{[^}]*width:fit-content;min-height:32px;[^}]*margin:7px auto 0/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-list-toggle:not\(\[hidden\]\)::after\{[^}]*width:4px;height:4px;[^}]*border-right:1px solid currentColor;border-bottom:1px solid currentColor/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-list-toggle:not\(\[hidden\]\)::after\{[^}]*border-bottom:[^}]*transform:translateY\(-1px\) rotate\(45deg\)/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-list-toggle\[aria-expanded="true"\]::after\{transform:translateY\(2px\) rotate\(225deg\)\}/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-row\.is-mobile-collapsed\{[^}]*max-height:0/);
});

test('expanded mobile View Less uses CSS sticky within the notification list parent',()=>{
  assert.match(notificationsJs,/const stickyListToggle = document\.createElement\('div'\)/);
  assert.match(notificationsJs,/notificationList\.append\(stickyListToggle\)/);
  assert.match(notificationsJs,/body\.classList\.add\('mobile-notification-list-expanded'\)/);
  assert.match(notificationsJs,/body\.classList\.remove\('mobile-notification-list-expanded'\)/);
  assert.match(notificationsJs,/stickyNavigation\.addEventListener\('transitionrun', handleStickyNavigationTransition\)/);
  assert.match(notificationsJs,/const maxButtonBottom = viewportBottom - safeAreaBottom - 6/);
  assert.match(notificationsJs,/const buttonBottom = Math\.min\(navigationTop - buttonBottomGap, maxButtonBottom\)/);
  assert.match(notificationsJs,/scrollRootRect\.bottom - scrollRootPaddingBottom/);
  assert.match(notificationsJs,/document\.body\.style\.setProperty\(\s*'--notification-list-sticky-bottom'/);
  assert.match(notificationsJs,/stickyNavigationTransitioning\) \{\s*stickyPositionFrame = window\.requestAnimationFrame\(update\)/);
  assert.doesNotMatch(notificationsJs,/notificationListEndSentinel|setStickyListToggleAtListEnd|new IntersectionObserver|document\.body\.append\(stickyListToggle\)/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-list-sticky\{[^}]*position:sticky;bottom:var\(--notification-list-sticky-bottom,70px\);[^}]*min-height:52px/);
  assert.doesNotMatch(notificationsCss,/\.notification-list-sticky[^}]*position:fixed|\.is-at-list-end|mobile-notification-list-at-end/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-list-sticky:before\{[^}]*backdrop-filter:blur\(14px\)[^}]*mask-image:linear-gradient/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-list-sticky:before\{position:absolute;inset:-76px 0 0/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-list-sticky \.notification-list-toggle:not\(\[hidden\]\)\{[^}]*pointer-events:auto/);
  assert.match(mobileNavigationCss,/\.mobile-bottom-nav\.is-hidden \{\s*opacity: 0;[\s\S]*?transform: translateY\(calc\(100% \+ 18px\)\);/);
  assert.doesNotMatch(notificationsJs,/mobileNavigation\.append\(stickyListToggle\)/);
  assert.doesNotMatch(notificationsCss,/\.mobile-bottom-nav > \.notification-list-sticky/);
});
