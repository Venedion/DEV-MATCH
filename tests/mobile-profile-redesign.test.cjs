const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const profileCss=fs.readFileSync(path.join(__dirname,'..','assets/css/my-profile.css'),'utf8');
const profileHtml=fs.readFileSync(path.join(__dirname,'..','devmatch-my-profile.html'),'utf8');
const profileJs=fs.readFileSync(path.join(__dirname,'..','assets/js/my-profile.js'),'utf8');

test('mobile profile uses the unboxed portrait layout and keeps desktop identity markup',()=>{
  assert.match(profileCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.profile-identity-card\{[\s\S]*?background:transparent[\s\S]*?\.profile-cover\{display:none\}[\s\S]*?\.identity-body\{[\s\S]*?grid-template-columns:clamp\(72px,23vw,112px\) minmax\(0,1fr\)/);
  assert.match(profileCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.mobile-profile-details\{[\s\S]*?display:grid/);
  assert.match(profileHtml,/<span class="availability-badge" id="availabilityBadge"/);
  assert.match(profileHtml,/<span class="mobile-identity-handle" id="mobileIdentityHandle"/);
  assert.match(profileHtml,/<div class="mobile-profile-stats" role="group" aria-label="Profile statistics">/);
});

test('mobile profile information cards use a single content-sized column',()=>{
  assert.match(profileCss,/@media\s*\(orientation:\s*portrait\)\s*\{\s*\.profile-details\{\s*grid-template-columns:minmax\(0,1fr\);\s*align-items:start;\s*align-content:start;\s*gap:clamp\(12px,2\.4vw,16px\);\s*\}\s*\.profile-details>\.profile-card\{\s*height:auto;\s*min-height:0;\s*\}\s*\.profile-details>\.contact-card\{grid-column:auto\}/);
});

test('mobile account quick contact keeps only Direct Message without affecting public previews',()=>{
  assert.match(profileCss,/@media\s*\(orientation:portrait\)\s*,\s*\(aspect-ratio:1\s*\/\s*1\)\s*\{\s*\.my-profile-page:not\(\.profile-preview-mode\)\s+\.contact-card\s+\.contact-whatsapp,\s*\.my-profile-page:not\(\.profile-preview-mode\)\s+\.contact-card\s+\.contact-instagram\{display:none\}/);
  assert.match(profileHtml,/id="directMessageLink"/);
});

test('mobile client account profile places Quick Contact before Company Details',()=>{
  assert.match(profileCss,/@media\s*\(orientation:portrait\)\s*,\s*\(aspect-ratio:1\s*\/\s*1\)\s*\{[\s\S]*?\.my-profile-page\.client-profile-view\s+#clientQuickContactMobile\{order:-1\}/);
});

test('mobile client Quick Contact has no card styling or heading',()=>{
  assert.match(profileCss,/@media\s*\(orientation:portrait\)\s*,\s*\(aspect-ratio:1\s*\/\s*1\)\s*\{[\s\S]*?\.my-profile-page\.client-profile-view\s+#clientQuickContactMobile\s+\.contact-card\{\s*padding:0;\s*border:0;\s*background:none;\s*box-shadow:none;\s*\}[\s\S]*?\.my-profile-page\.client-profile-view\s+#clientQuickContactMobile\s+\.contact-card\s+\.card-heading\{display:none\}/);
});

test('mobile profile stats retain zero and unavailable-rating defaults from existing data',()=>{
  assert.match(profileHtml,/id="mobileStatViews">0<\/strong>/);
  assert.match(profileHtml,/id="mobileStatFavorites">0<\/strong>/);
  assert.match(profileHtml,/id="mobileStatRating">-<\/strong>/);
  assert.match(profileJs,/setText\('mobileStatFavorites',document\.getElementById\('statSaves'\)\.textContent\.trim\(\)\|\|'0'\)/);
  assert.match(profileJs,/setText\('mobileStatViews',document\.getElementById\('statViews'\)\.textContent\.trim\(\)\|\|'0'\)/);
  assert.match(profileJs,/setText\('mobileStatRating','-'\)/);
});

test('mobile profile actions use the public profile URL and existing profile details route',()=>{
  assert.match(profileHtml,/id="shareProfileMobile"/);
  assert.match(profileHtml,/id="copyProfileLink"/);
  assert.match(profileHtml,/id="shareProfileWhatsapp"/);
  assert.match(profileJs,/backend\.publicProfileUrl\(user\.id,role\)/);
  assert.match(profileJs,/navigator\.share\(/);
  assert.match(profileJs,/https:\/\/wa\.me\/\?text=/);
  assert.match(profileJs,/devmatch-settings\.html\?role=\$\{role\}&edit=profile-details#profile-details/);
});
