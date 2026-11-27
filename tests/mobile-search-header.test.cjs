const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=(relativePath)=>fs.readFileSync(path.join(__dirname,'..',relativePath),'utf8');

test('Mobile expanded search aligns its frame with the search icon across header types',()=>{
  const css=read('assets/css/mobile-navigation.css');
  const js=read('assets/js/nav-behavior.js');

  assert.match(css,/header\.topbar > \.search\.mobile-header-search,[\s\S]*?left:\s*38px;/);
  assert.match(css,/body\.has-mobile-bottom-navigation > header\.topbar > \.search\.mobile-header-search,[\s\S]*?body\.has-mobile-bottom-navigation > header\.client-topbar > \.client-search\.mobile-header-search,[\s\S]*?body\.has-mobile-bottom-navigation > header\.profile-topbar > \.top-search\.mobile-header-search\s*\{\s*left:\s*0;/);
  assert.match(js,/header\.classList\.toggle\('mobile-header-search-open', isOpen\)/);
});
