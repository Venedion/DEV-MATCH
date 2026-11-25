const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../assets/js/sidebar-navigation.js'),'utf8');

test('mobile Explore routes clients to Discover Projects and developers to Find Projects',()=>{
  const [,clientItems,developerItems]=source.match(/const items = isClient\s*\?\s*\[([\s\S]*?)\]\s*:\s*\[([\s\S]*?)\];/)||[];
  assert.ok(clientItems,'client mobile navigation items should be configured');
  assert.ok(developerItems,'developer mobile navigation items should be configured');
  assert.match(clientItems,/\{key: 'explore', label: 'Explore', href: 'devmatch-discover-projects\.html'/);
  assert.match(developerItems,/\{key: 'explore', label: 'Explore', href: 'devmatch-find-projects\.html'/);
});

test('mobile bottom navigation initializes its active indicator at the current tab',()=>{
  assert.match(source,/setPosition\(activeItem\);\s*nav\.classList\.add\('has-active-indicator'\)/);
});

test('mobile bottom navigation animates from the previous tab after page navigation',()=>{
  const styles=fs.readFileSync(path.join(__dirname,'../assets/css/mobile-navigation.css'),'utf8');
  assert.match(source,/const mobileNavigationTransitionKey = 'devmatch-mobile-bottom-nav-transition';/);
  assert.match(source,/sessionStorage\.setItem\(\s*mobileNavigationTransitionKey,/);
  assert.match(source,/previousRole === nav\.dataset\.workspace && destinationPath === location\.pathname/);
  assert.match(source,/setPosition\(previousItem\)/);
  assert.match(styles,/transition: left 280ms cubic-bezier\(\.22, \.61, \.36, 1\)/);
});

test('mobile bottom navigation only hides in response to user scroll input',()=>{
  assert.match(source,/window\.matchMedia\('\(orientation: portrait\)'\)/);
  assert.match(source,/window\.addEventListener\('wheel'/);
  assert.match(source,/window\.addEventListener\('touchmove'/);
  assert.match(source,/window\.addEventListener\('keydown'/);
  assert.match(source,/performance\.now\(\) > scrollIntent\.expiresAt \|\| scrollIntent\.direction !== nextDirection/);
  assert.match(source,/function setMobileBottomNavigationHidden/);
});

test('desktop Messages navigation is active on chat without changing the mobile return tab',()=>{
  assert.ok(source.includes("const desktopActiveKey = location.pathname.split('/').pop() === 'devmatch-chat.html'"));
  assert.match(source,/renderGroup\(nav, groups\[group\], workspace, desktopActiveKey\)/);
  assert.match(source,/renderMobileBottomNavigation\(workspace, activeKey\)/);
});
