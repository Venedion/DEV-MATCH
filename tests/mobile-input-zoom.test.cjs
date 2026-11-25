const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const formControlsCss=fs.readFileSync(path.join(root,'assets/css/form-controls.css'),'utf8');

test('mobile text controls keep a minimum 16px font size to prevent focus zoom',()=>{
  const mobileRule=formControlsCss.match(/@media\s*\(orientation:\s*portrait\)\s*\{([\s\S]*?)\n\}/)?.[1]||'';
  assert.ok(mobileRule.includes('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([type="hidden"]):not([type="color"])'));
  assert.match(mobileRule,/textarea,\s*select \{\s*font-size: 16px !important;\s*font-size: max\(16px, 1em\) !important;/);
});

test('scrollbars are hidden globally while scroll containers remain scrollable',()=>{
  assert.match(formControlsCss,/\*\s*\{\s*scrollbar-color:\s*transparent transparent !important;\s*scrollbar-width:\s*none !important;\s*-ms-overflow-style:\s*none !important;\s*scrollbar-gutter:\s*auto !important;/);
  assert.match(formControlsCss,/\*::-webkit-scrollbar\s*\{\s*display:\s*none !important;\s*width:\s*0 !important;\s*height:\s*0 !important;/);
  const marketplaceCss=fs.readFileSync(path.join(root,'assets/css/marketplace.css'),'utf8');
  const chatCss=fs.readFileSync(path.join(root,'assets/css/chat.css'),'utf8');
  assert.match(marketplaceCss,/\.market-categories\{[^}]*overflow-x:auto/);
  assert.match(chatCss,/\.chat-filter-tabs\s*\{[^}]*overflow-x:\s*auto/);
});

test('all application pages load the shared mobile text-control styles',()=>{
  const pages=fs.readdirSync(root).filter(file=>/^devmatch-.*\.html$/.test(file));

  assert.ok(pages.length>0,'application pages should exist');
  for(const page of pages){
    const html=fs.readFileSync(path.join(root,page),'utf8');
    assert.match(html,/assets\/css\/form-controls\.css\?v=/,`${page} should load shared form-control styles`);
  }
});
