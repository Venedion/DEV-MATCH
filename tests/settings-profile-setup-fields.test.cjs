const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const settingsHtml=fs.readFileSync(path.join(root,'devmatch-settings.html'),'utf8');
const settingsJs=fs.readFileSync(path.join(root,'assets/js/settings.js'),'utf8');
const settingsCss=fs.readFileSync(path.join(root,'assets/css/settings.css'),'utf8');
const profileJs=fs.readFileSync(path.join(root,'assets/js/profile.js'),'utf8');
const backendJs=fs.readFileSync(path.join(root,'assets/js/backend.js'),'utf8');

test('settings expose shared setup profile fields and keep birthday private',()=>{
  for(const id of ['settingsGender','settingsBirthday','settingsWebsite','settingsInstagram','settingsWebsiteField','settingsWhatsappDialCode','settingsWhatsapp']){
    assert.match(settingsHtml,new RegExp(`id="${id}"`));
  }
  assert.match(settingsHtml,/for="settingsInstagram">Instagram<\/label>/);
  assert.match(settingsHtml,/id="settingsInstagram"[^>]*placeholder="@username"/);
  assert.match(settingsHtml,/<option value="62" title="Indonesia \(\+62\)">🇮🇩 \+62<\/option>/);
  assert.match(settingsHtml,/<option value="60" title="Malaysia \(\+60\)">🇲🇾 \+60<\/option>/);
  assert.match(settingsHtml,/<option value="65" title="Singapore \(\+65\)">🇸🇬 \+65<\/option>/);
  assert.match(settingsJs,/profileData\.gender = document\.getElementById\('settingsGender'\)\.value/);
  assert.match(settingsJs,/profileData\.birthday = document\.getElementById\('settingsBirthday'\)\.value/);
  assert.match(settingsJs,/settingsWebsiteField'\)\.hidden = !isDeveloper/);
  assert.match(settingsJs,/if \(isDeveloper\) profileData\.website = document\.getElementById\('settingsWebsite'\)\.value\.trim\(\)/);
  assert.match(settingsCss,/\.settings-field\[hidden\]\s*\{\s*display:\s*none;/);
  assert.match(settingsJs,/profileData\.instagram = instagramUsername/);
  assert.match(settingsJs,/profileContact\.splitWhatsappNumber\(/);
  assert.match(settingsJs,/profileContact\.combineWhatsappNumber\(/);
  assert.match(settingsJs,/profileContact\.normalizeLocalNumber\(/);
  assert.match(settingsJs,/persistProfile\(profileData, \{includePrivateFields: true\}\)/);
  assert.match(profileJs,/const saved=\{\.\.\.profile,role,whatsappConnected:Boolean\(profile\.whatsapp\),googleConnected:false,ageRange:/);
  assert.doesNotMatch(profileJs,/delete saved\.birthday/);
  assert.match(backendJs,/privateProfileFields = \[[^\]]*'birthday'/);
});

test('settings show the setup fields belonging to the active developer or client mode',()=>{
  for(const id of ['settingsExperienceLevel','settingsIndustry']){
    assert.match(settingsHtml,new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(settingsHtml,/id="settingsProject"/);
  assert.match(settingsJs,/developerSpecificFields'\)\.hidden = !isDeveloper/);
  assert.match(settingsJs,/clientSpecificFields'\)\.hidden = isDeveloper/);
  assert.match(settingsJs,/settingsSkillsCard'\)\.hidden = !isDeveloper/);
  assert.match(settingsJs,/settingsExperienceLevel'\)\.value/);
  assert.match(settingsJs,/settingsIndustry'\)\.value\.trim\(\)/);
  assert.match(settingsJs,/roleTabLabel'\)\.textContent = isDeveloper \? 'Rates & Payouts' : 'Company & Billing'/);
  assert.doesNotMatch(settingsJs,/settingsProject/);
});

test('settings wait for the active workspace cache before populating saved values',()=>{
  assert.match(settingsJs,/const user = await window\.devMatchBackend\.ready;\s*if \(!user\) return;\s*profileData = getProfile\(\);/);
  assert.match(settingsJs,/Object\.assign\(profileData, await window\.devMatchBackend\.loadPrivateProfileFields\(\)\)/);
  assert.match(settingsHtml,/profile-contact\.js[\s\S]*?settings\.js/);
});
