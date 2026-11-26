const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const profileHtml=fs.readFileSync(path.join(root,'devmatch-my-profile.html'),'utf8');
const profileJs=fs.readFileSync(path.join(root,'assets/js/my-profile.js'),'utf8');
const profileCss=fs.readFileSync(path.join(root,'assets/css/my-profile.css'),'utf8');

test('client profile shows a safe Instagram username link only when available',()=>{
  assert.match(profileHtml,/id="instagramLink"[^>]*aria-label="Open Instagram profile"[^>]*hidden/);
  assert.match(profileHtml,/profile-contact\.js[\s\S]*?my-profile\.js/);
  assert.match(profileJs,/profileContact\.instagramUrl\(profile\.instagram\|\|''\)/);
  assert.match(profileJs,/instagramLink\.hidden=isDeveloper\|\|!instagramUrl/);
  assert.match(profileCss,/\.contact-instagram\[hidden\]\{display:none\}/);
});
