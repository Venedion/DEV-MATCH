const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const landing=fs.readFileSync(path.join(__dirname,'../devmatch-role.html'),'utf8');
const styles=fs.readFileSync(path.join(__dirname,'../assets/css/role.css'),'utf8');

test('Role selection uses a glossy monochrome background and liquid-glass center card',()=>{
  assert.match(landing,/assets\/css\/role\.css\?v=20261127-liquid-glass-role-v4/);
  assert.match(styles,/body::before\{[^}]*background:linear-gradient\(135deg,#050505 0%,#111 35%,#252525 70%,#080808 100%\)/);
  assert.doesNotMatch(styles,/body::before\{[^}]*radial-gradient|body::before\{[^}]*linear-gradient\((?:90|180)deg/);
  assert.match(styles,/\.card\{[^}]*backdrop-filter:blur\(32px\) saturate\(170%\)/);
  assert.match(styles,/\.card::before\{[^}]*linear-gradient/);
  assert.match(styles,/\.role\.selected\{[^}]*background:rgba\(255,255,255,\.075\)/);
});
