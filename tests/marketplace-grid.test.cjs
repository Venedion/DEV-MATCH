const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.join(__dirname,'..','assets/css/marketplace.css'),'utf8');

test('Find Projects uses desktop columns in landscape and a single mobile column in portrait',()=>{
  assert.match(css,/\.marketplace-main\[data-marketplace="requests"\] \.project-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\);gap:18px\}/);
  assert.match(css,/@media\(max-width:1220px\) and \(orientation: landscape\)\{\.marketplace-main\[data-marketplace="requests"\] \.project-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:12px\}\}/);
  assert.match(css,/@media\(orientation: portrait\)\{\.marketplace-main\[data-marketplace="requests"\] \.project-grid\{grid-template-columns:minmax\(0,1fr\)\}\}/);
  assert.match(css,/@media \(orientation: portrait\) \{\s*\.marketplace-main \.project-grid:not\(\.is-list\) \{\s*grid-template-columns: minmax\(0, 1fr\);/);
});
