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
  for(const id of ['settingsGender','settingsBirthday','settingsWebsite','settingsWebsiteField','settingsWhatsappDialCode','settingsWhatsapp']){
    assert.match(settingsHtml,new RegExp(`id="${id}"`));
  }
  const accountForm=settingsHtml.match(/<form class="settings-card" id="accountForm">([\s\S]*?)<\/form>/)?.[1]||'';
  assert.doesNotMatch(accountForm,/Instagram|settingsCountry|settingsCity/);
  assert.match(settingsHtml,/<b>Instagram<\/b>[\s\S]*?data-app-detail="Instagram"/);
  assert.match(settingsHtml,/data-app-edit="Instagram"/);
  assert.match(settingsHtml,/data-app-toggle="Instagram"/);
  assert.match(settingsHtml,/<option value="62" title="Indonesia \(\+62\)">🇮🇩 \+62<\/option>/);
  assert.match(settingsHtml,/<option value="60" title="Malaysia \(\+60\)">🇲🇾 \+60<\/option>/);
  assert.match(settingsHtml,/<option value="65" title="Singapore \(\+65\)">🇸🇬 \+65<\/option>/);
  assert.match(settingsHtml,/id="settingsBirthdayTrigger"[\s\S]*?id="settingsBirthdayCalendar"[\s\S]*?data-calendar-wheel="day"[\s\S]*?data-calendar-wheel="month"[\s\S]*?data-calendar-wheel="year"[\s\S]*?data-calendar-clear[\s\S]*?data-calendar-save/);
  assert.match(settingsJs,/gender: document\.getElementById\('settingsGender'\)\.value/);
  assert.match(settingsJs,/birthday: document\.getElementById\('settingsBirthday'\)\.value/);
  assert.match(settingsJs,/function formatSettingsBirthday\(value\)/);
  assert.match(settingsJs,/function setSettingsBirthday\(value\)[\s\S]*?dispatchEvent\(new Event\('input', \{bubbles: true\}\)\)/);
  assert.match(settingsJs,/data-track-hidden/);
  assert.match(settingsJs,/settingsWebsiteField'\)\.hidden = !isDeveloper/);
  assert.match(settingsJs,/if \(isDeveloper\) updatedProfile\.website = document\.getElementById\('settingsWebsite'\)\.value\.trim\(\)/);
  assert.match(settingsCss,/\.settings-field\[hidden\]\s*\{\s*display:\s*none;/);
  assert.match(settingsJs,/Instagram: 'instagramConnected'/);
  assert.match(settingsJs,/updatedProfile\.instagramConnected = Boolean\(String\(updatedProfile\.instagram \|\| ''\)\.trim\(\)\)/);
  assert.match(settingsJs,/profileContact\.splitWhatsappNumber\(/);
  assert.match(settingsJs,/profileContact\.combineWhatsappNumber\(/);
  assert.match(settingsJs,/profileContact\.normalizeLocalNumber\(/);
  assert.match(settingsJs,/updatedProfile\.whatsappConnected = Boolean\(updatedProfile\.whatsapp\)/);
  assert.match(settingsJs,/gmailAddress\(email\)[\s\S]*?updatedProfile\.googleConnected = true;[\s\S]*?updatedProfile\.googleEmail = gmail;/);
  assert.match(settingsJs,/persistProfile\(updatedProfile, \{includePrivateFields: true\}\)/);
  assert.match(profileJs,/const saved=\{\.\.\.profile,role,whatsappConnected:Boolean\(profile\.whatsapp\),googleConnected:false,ageRange:/);
  assert.doesNotMatch(profileJs,/delete saved\.birthday/);
  assert.match(backendJs,/privateProfileFields = \[[^\]]*'birthday'/);
});

test('Connected Apps reflect setup profile contacts and Gmail addresses',()=>{
  assert.match(settingsJs,/whatsappConnected = Boolean\(whatsappNumber\) \|\| profile\.whatsappConnected === true/);
  assert.match(settingsJs,/googleConnected = Boolean\(gmail\) \|\| profile\.googleConnected === true/);
  assert.match(settingsJs,/instagramConnected = Boolean\(instagramUsername\) \|\| profile\.instagramConnected === true/);
  assert.match(settingsJs,/Google: profile => profile\.googleEmail \|\| gmailAddress\(profile\.email\)/);
  assert.match(settingsJs,/if \(!isConnected && app === 'Instagram'\)/);
  assert.match(settingsJs,/save: value => \{\s*const username = profileContact\.normalizeInstagramUsername\(value\);\s*return \{instagram: username, instagramConnected: Boolean\(username\)\};/);
});

test('GitHub Connected Apps is available only in Developer Mode',()=>{
  assert.match(settingsHtml,/<!-- GitHub -->\s*<div class="settings-app-card" id="settingsGithubAppCard">[\s\S]*?data-app-toggle="GitHub"[\s\S]*?<!-- Google -->/);
  assert.match(settingsJs,/settingsGithubAppCard'\)\.hidden = !isDeveloper/);
  assert.match(settingsJs,/GitHub: 'githubConnected'/);
  assert.match(settingsCss,/\.settings-app-card\[hidden\]\s*\{\s*display:\s*none;\s*\}/);
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
  assert.match(settingsJs,/settingsIndustry'\)\.value/);
  assert.match(settingsJs,/roleTabLabel'\)\.textContent = isDeveloper \? 'Rates & Payouts' : 'Company & Billing'/);
  assert.doesNotMatch(settingsJs,/settingsProject/);
});

test('client business and industry settings are editable from Profile Details',()=>{
  const profileDetails=settingsHtml.match(/<section class="settings-panel" id="panel-profile-details"[\s\S]*?<\/section>\s*<!-- PANEL 2:/)?.[0]||'';
  const roleSettings=settingsHtml.match(/<form class="settings-card" id="roleSpecificForm">([\s\S]*?)<\/form>/)?.[1]||'';
  assert.match(profileDetails,/id="settingsClientBusinessCard"[^>]*hidden/);
  assert.match(profileDetails,/id="settingsCompanyName"/);
  assert.match(profileDetails,/id="settingsIndustry"/);
  assert.match(profileDetails,/id="saveClientBusinessDetails"/);
  assert.doesNotMatch(roleSettings,/settingsCompanyName|settingsIndustry/);
  assert.match(roleSettings,/id="settingsNpwp"/);
  assert.match(settingsJs,/settingsClientBusinessCard'\)\.hidden = isDeveloper/);
  assert.match(settingsJs,/companyName: document\.getElementById\('settingsCompanyName'\)\.value\.trim\(\),\s*industry: document\.getElementById\('settingsIndustry'\)\.value/);
  assert.match(settingsJs,/await persistProfile\(updatedProfile\);\s*profileData = updatedProfile;\s*clientBusinessSaveTracker\.markSaved\(\);\s*showToast\('Business & industry details saved\.'\)/);
  assert.match(settingsJs,/const industries = window\.DEVMATCH_CLIENT_PROFILE_OPTIONS\.businessTypes;/);
  assert.match(settingsJs,/const customIndustryOption = industry && !industries\.includes\(industry\)/);
  assert.match(settingsJs,/industrySelect\.innerHTML = `<option value="">Choose an industry<\/option>\$\{customIndustryOption\}\$\{industries\.map/);
  assert.match(settingsJs,/industrySelect\.value = industry;\s*industrySelect\.dispatchEvent\(new Event\('change', \{bubbles: true\}\)\);/);
  assert.match(profileJs,/const industryOptions=clientProfileOptions\.businessTypes/);
  assert.match(profileJs,/profile\.industry&&!industryOptions\.includes\(profile\.industry\)\?`<option value="\$\{escapeHtml\(profile\.industry\)\}"/);
});

test('settings fetch the active persisted workspace before populating saved values',()=>{
  assert.match(settingsJs,/const user = await window\.devMatchBackend\.ready;\s*if \(!user\) return;\s*const row = await window\.devMatchBackend\.loadProfile\(user\);/);
  assert.match(settingsJs,/if \(row\.account_role !== role\)/);
  assert.match(settingsJs,/\.\.\.\(row\.profile_data \|\| \{\}\)/);
  assert.match(settingsJs,/Object\.assign\(profileData, await window\.devMatchBackend\.loadPrivateProfileFields\(\)\)/);
  assert.match(settingsJs,/catch \(error\) \{\s*console\.error\('Unable to load saved profile settings\.', error\);\s*showToast/);
  assert.match(settingsHtml,/profile-contact\.js[\s\S]*?settings\.js/);
});
