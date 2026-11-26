const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const profileHtml=fs.readFileSync(path.join(root,'devmatch-my-profile.html'),'utf8');
const profileJs=fs.readFileSync(path.join(root,'assets/js/my-profile.js'),'utf8');
const profileCss=fs.readFileSync(path.join(root,'assets/css/my-profile.css'),'utf8');

test('My Profile places profile sections in their desktop columns and restores mobile placement',()=>{
  assert.match(profileHtml,/class="profile-page-heading"[\s\S]*?<h1>My Profile<\/h1>/);
  assert.doesNotMatch(profileHtml,/<p class="eyebrow">Account<\/p>/);
  assert.match(profileHtml,/id="previewProfile"[\s\S]*?Preview as Public/);
  assert.match(profileHtml,/id="editProfile"[\s\S]*?Edit Profile/);
  assert.match(profileHtml,/id="clientProfileLayout"[\s\S]*?id="clientQuickContactDesktop"[\s\S]*?id="clientProfileActions"[\s\S]*?id="clientConnectedAppsDesktop"[\s\S]*?id="clientProfileSide"[\s\S]*?id="clientCompanyDetails"[\s\S]*?id="clientQuickContactMobile"[\s\S]*?id="clientShowcaseDesktop"/);
  assert.match(profileHtml,/id="developerDetailsDesktop" hidden/);
  assert.match(profileHtml,/id="connectedAppsCard"/);
  assert.match(profileJs,/classList\.toggle\('client-profile-view',!isDeveloper\)/);
  assert.match(profileJs,/classList\.toggle\('developer-profile-view',isDeveloper\)/);
  assert.match(profileJs,/setLink\('manageConnectedAppsLink',settingsUrl\.replace\('#account','#integrations'\)\)/);
  assert.match(profileJs,/matchMedia\('\(min-width:821px\) and \(orientation:landscape\)'\)/);
  assert.match(profileJs,/const quickContactTarget=document\.getElementById\(desktop\?'clientQuickContactDesktop':'clientQuickContactMobile'\)/);
  assert.match(profileJs,/clientConnectedAppsDesktop/);
  assert.match(profileJs,/clientShowcaseDesktop/);
  assert.match(profileJs,/profileColumns\.append\(profileShowcase\)/);
  assert.doesNotMatch(profileJs,/alignClientProfileShowcase/);
  assert.match(profileJs,/clientProfileActions'\)\.append\(document\.querySelector\('\.profile-actions'\)\)/);
  assert.match(profileJs,/clientCompanyDetails'\)\.append\(document\.getElementById\('roleInfoCard'\)\)/);
  assert.match(profileJs,/clientProfileDesktopLayout\.addEventListener\('change',moveProfileContent\)/);
  assert.match(profileJs,/window\.addEventListener\('resize',moveProfileContent\)/);
  assert.match(profileJs,/configureDirectMessageLink\(document\.getElementById\('directMessageLink'\),chatUrl,true\)/);
});

test('Profile hides the duplicate About card and keeps role-specific section visibility',()=>{
  assert.match(profileJs,/document\.querySelector\('\.about-card'\)\.hidden=true/);
  assert.match(profileJs,/getElementById\('skillsCard'\)\.hidden=!isDeveloper/);
  assert.match(profileJs,/getElementById\('experienceCard'\)\.hidden=!isDeveloper/);
  assert.match(profileJs,/profile\.npwp\?'On file':'-'/);
  assert.match(profileJs,/if\(isDeveloper\)identity\.availability=profile\.availability\|\|''/);
  assert.match(profileJs,/role:isDeveloper\?'developer':'client'/);
});

test('Connected Apps use the matching client-mode list and preserve developer apps',()=>{
  assert.match(profileJs,/const apps=isDeveloper\?\[[\s\S]*?name:'GitHub'[\s\S]*?name:'Google'[\s\S]*?\]:\[[\s\S]*?name:'Instagram'[\s\S]*?name:'WhatsApp Business'[\s\S]*?name:'Google Account'[\s\S]*?name:'LinkedIn'/);
  for(const name of ['Instagram','WhatsApp','GitHub','Google','LinkedIn']){
    assert.match(profileJs,new RegExp(`${name}:\\{\\s*color:'#[a-f0-9]+'[,]?\\s*svg:'<svg`,'i'));
  }
  assert.match(profileJs,/app\.icon\.svg/);
  assert.match(profileCss,/\.app-icon svg\{display:block;width:17px;height:17px\}/);
});

test('Developer profile uses the same desktop structure without replacing its own profile data',()=>{
  assert.match(profileHtml,/id="clientConnectedAppsDesktop"><\/div>\s*<div id="developerDetailsDesktop" hidden><\/div>/);
  assert.match(profileJs,/developerDetailCards\.forEach\(card=>developerDetailsDesktop\.append\(card\)\)/);
  assert.match(profileJs,/const hourlyRate=profile\.hourlyRate/);
  assert.match(profileJs,/const contracts=normalizeList\(profile\.contractTypes,\[\]\)/);
  assert.match(profileJs,/document\.querySelector\('\.about-card'\)\.hidden=true/);
  assert.match(profileCss,/body\.developer-profile-view \.contact-card \.contact-whatsapp\{display:none\}/);
  assert.match(profileCss,/body\.developer-profile-view #developerDetailsDesktop:not\(\[hidden\]\)\{order:4\}/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) \.client-profile-layout\{[\s\S]*?grid-template-columns:minmax\(240px,\.72fr\) minmax\(0,1\.55fr\)/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) #roleInfoCard\{[\s\S]*?background:transparent/);
});

test('Desktop profile layout keeps statistics and role details aligned',()=>{
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) \.profile-overview \.mobile-profile-details\{[\s\S]*?width:100%;[\s\S]*?max-width:100%;[\s\S]*?min-width:0/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) \.profile-overview \.mobile-profile-details\{[\s\S]*?margin-bottom:8px/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) \.profile-overview \.mobile-profile-bio\{[\s\S]*?width:100%;[\s\S]*?max-width:100%;[\s\S]*?overflow-wrap:anywhere/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) \.profile-overview \.mobile-profile-location\{[\s\S]*?color:var\(--profile-muted\)/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) \.client-profile-layout\{[\s\S]*?grid-template-columns:minmax\(240px,\.72fr\) minmax\(0,1\.55fr\)/);
  assert.match(profileCss,/@media\(min-width:821px\) and \(orientation:landscape\)[\s\S]*?:is\(body\.client-profile-view,body\.developer-profile-view\) \.client-profile-main\{[\s\S]*?position:sticky;[\s\S]*?top:0;[\s\S]*?align-self:start/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) \.profile-columns\{display:none\}/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) \.client-profile-side\{[\s\S]*?display:flex;[\s\S]*?flex-direction:column;[\s\S]*?gap:20px/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) \.client-profile-main \.profile-identity-card\{[\s\S]*?flex:0 0 auto/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) #clientProfileActions\{order:1\}/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) #clientQuickContactDesktop\{min-width:0;order:2\}/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) \.client-profile-main \.contact-card\{[\s\S]*?padding:0;[\s\S]*?border:0;[\s\S]*?background:transparent/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) \.client-profile-main \.contact-card \.card-heading\{display:none\}/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) \.client-profile-actions \.profile-actions\{[\s\S]*?display:grid;[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);[\s\S]*?width:100%/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) \.client-profile-actions \.button\{[\s\S]*?width:100%/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) #roleInfoCard\{[\s\S]*?border-color:#dfe1e6;[\s\S]*?background:transparent/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) #roleInfoCard \.role-info-item\{[\s\S]*?background:#fff/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) #roleInfoCard \.role-info-grid\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(profileCss,/\.profile-stats\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\);gap:10px/);
  assert.match(profileCss,/@media\(min-width:821px\) and \(orientation:landscape\)[\s\S]*?\.contact-whatsapp,[\s\S]*?\.contact-instagram\{display:none\}/);
});

test('Mobile profile keeps stacked contact cards and visible WhatsApp action',()=>{
  assert.match(profileCss,/@media\(orientation:portrait\)\{[\s\S]*?:is\(body\.client-profile-view,body\.developer-profile-view\) \.client-profile-side\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
  assert.match(profileCss,/@media\(orientation:portrait\)\{[\s\S]*?:is\(body\.client-profile-view,body\.developer-profile-view\) #clientQuickContactDesktop,[\s\S]*?#clientShowcaseDesktop\{display:none\}/);
  assert.match(profileCss,/:is\(body\.client-profile-view,body\.developer-profile-view\) #clientQuickContactMobile\{display:block\}/);
  assert.match(profileCss,/@media\(max-width:520px\) and \(orientation:portrait\)\{[\s\S]*?:is\(body\.client-profile-view,body\.developer-profile-view\) #roleInfoCard \.role-info-grid\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(profileHtml,/id="whatsappIcon" viewBox="0 0 24 24"[\s\S]*?stroke="currentColor" stroke-width="1\.8"[\s\S]*?fill="currentColor"/);
  assert.match(profileHtml,/profile-share-whatsapp-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"/);
});
test('WhatsApp contact uses a single proportionate icon',()=>{
  assert.doesNotMatch(profileHtml,/contact-whatsapp-placeholder|whatsappPlaceholder/);
  assert.match(profileHtml,/transform="translate\(3\.6 3\.6\) scale\(\.7\)"/);
  assert.match(profileCss,/\.contact-whatsapp>svg\{width:18px;height:18px;display:block;flex:0 0 auto;fill:currentColor\}/);
  assert.match(profileCss,/\.profile-share-whatsapp-icon svg\{display:block;width:100%;height:100%\}/);
});
