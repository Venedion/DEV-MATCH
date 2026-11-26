const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const optionalForms=[
  'assets/js/profile.js',
  'assets/js/settings.js',
  'devmatch-client-dashboard.html',
  'devmatch-chat.html',
  'devmatch-my-projects.html',
  'devmatch-settings.html'
].map(file=>fs.readFileSync(path.join(root,file),'utf8'));
const sharedCss=fs.readFileSync(path.join(root,'assets/css/form-controls.css'),'utf8');

test('optional labels across forms use the shared smaller gray style',()=>{
  for(const form of optionalForms) assert.match(form,/class="form-optional">Optional<\/small>/);
  assert.match(sharedCss,/\.form-optional,[\s\S]*?color:\s*#858a94;[\s\S]*?font-size:\s*11px;/);
});
