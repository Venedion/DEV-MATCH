const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const iconCss=fs.readFileSync(path.join(root,'assets/css/developer-mode-icon.css'),'utf8');
const authJs=fs.readFileSync(path.join(root,'assets/js/auth.js'),'utf8');
const authHtml=fs.readFileSync(path.join(root,'devmatch-auth.html'),'utf8');
const profileJs=fs.readFileSync(path.join(root,'assets/js/my-profile.js'),'utf8');
const profileHtml=fs.readFileSync(path.join(root,'devmatch-my-profile.html'),'utf8');
const conceptSvg=fs.readFileSync(path.join(root,'devmatch-profile-design-concept.svg'),'utf8');

test('developer mode markers use the supplied icon throughout the UI',()=>{
  const pages=fs.readdirSync(root).filter(file=>/^devmatch-.*\.html$/.test(file));
  for(const file of pages){
    const html=fs.readFileSync(path.join(root,file),'utf8');
    assert.doesNotMatch(html,/&lt;\/&gt;|&lt;&gt;/,`${file} still contains a code-mark icon`);
    if(html.includes('developer-mode-icon')){
      assert.match(html,/developer-mode-icon\.css\?v=20261125-developer-mode-icon-v2/,`${file} does not load the current shared icon styles`);
    }
    assert.doesNotMatch(html,/<a[^>]*class="(?:mode|client-mode)(?: [^"]*)?"[^>]*><span(?: aria-hidden="true")?><span class="developer-mode-icon"/,`${file} still wraps the switch icon in an extra inline box`);
  }
  assert.match(authJs,/class="developer-mode-icon"/);
  assert.doesNotMatch(authJs,/&lt;&gt;/);
  assert.match(authHtml,/developer-mode-icon\.css\?v=20261125-developer-mode-icon-v2/);
  assert.match(authHtml,/auth\.js\?v=20261126-username-validation-v1/);
  assert.match(profileJs,/workspaceIcon\.innerHTML='<span class="developer-mode-icon"/);
  assert.doesNotMatch(profileJs,/workspaceIcon\.textContent='<\/>'/);
  assert.match(profileHtml,/my-profile\.js\?v=20261127-mobile-profile-redesign-v1/);
  assert.match(iconCss,/mask: url\("\.\.\/images\/developer-mode-icon\.png"\)/);
  assert.match(iconCss,/background-color: #000;/);
  assert.match(iconCss,/\.workspace-icon \.developer-mode-icon \{[^}]*background-color: #fff;/);
  assert.match(iconCss,/\.cover-code \.developer-mode-icon \{[^}]*background-color: #fff;/);
  assert.match(conceptSvg,/href="assets\/images\/developer-mode-icon\.png"/);
  assert.equal(fs.existsSync(path.join(root,'assets/images/developer-mode-icon.png')),true);
});
