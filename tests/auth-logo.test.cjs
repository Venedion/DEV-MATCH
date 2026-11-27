const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const authHtml=fs.readFileSync(path.join(root,'devmatch-auth.html'),'utf8');
const authCss=fs.readFileSync(path.join(root,'assets/css/auth.css'),'utf8');
const authJs=fs.readFileSync(path.join(root,'assets/js/auth.js'),'utf8');

test('Login page displays the DEV-MATCH mark with contrast on the dark panel',()=>{
  assert.match(authHtml,/<a class="logo"[^>]*><img class="brand-mark" src="assets\/images\/devmatch-logo\.png"/);
  assert.match(authHtml,/auth\.css\?v=20261128-login-logo-contrast-v1/);
  assert.match(authCss,/\.side \.logo \.brand-mark\{[^}]*filter:brightness\(0\) invert\(1\)/);
  assert.match(authJs,/cli:\{[^}]*badge:'<svg class="client-mode-icon"/);
  assert.match(authCss,/\.side \.badge \.client-mode-icon\{[^}]*width:1em;height:1em/);
  assert.match(authHtml,/auth\.js\?v=20261128-client-mode-icon-v1/);
});
