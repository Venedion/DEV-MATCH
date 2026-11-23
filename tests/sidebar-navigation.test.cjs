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
  assert.doesNotMatch(source,/devmatch-mobile-bottom-nav-transition/);
  assert.match(source,/nav\.classList\.add\('is-initializing-indicator'\);\s*setPosition\(activeItem\)/);
});
