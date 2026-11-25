const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const settingsHtml=fs.readFileSync(path.join(root,'devmatch-settings.html'),'utf8');
const settingsJs=fs.readFileSync(path.join(root,'assets/js/settings.js'),'utf8');
const profileJs=fs.readFileSync(path.join(root,'assets/js/profile.js'),'utf8');
const backendJs=fs.readFileSync(path.join(root,'assets/js/backend.js'),'utf8');

test('settings expose shared setup profile fields and keep birthday private',()=>{
  for(const id of ['settingsGender','settingsBirthday','settingsWebsite','settingsInstagram']){
    assert.match(settingsHtml,new RegExp(`id="${id}"`));
  }
  assert.match(settingsJs,/profileData\.gender = document\.getElementById\('settingsGender'\)\.value/);
  assert.match(settingsJs,/profileData\.birthday = document\.getElementById\('settingsBirthday'\)\.value/);
  assert.match(settingsJs,/profileData\.website = document\.getElementById\('settingsWebsite'\)\.value\.trim\(\)/);
  assert.match(settingsJs,/profileData\.instagram = document\.getElementById\('settingsInstagram'\)\.value\.trim\(\)/);
  assert.match(settingsJs,/persistProfile\(profileData, \{includePrivateFields: true\}\)/);
  assert.match(profileJs,/const saved=\{\.\.\.profile,role,whatsappConnected:Boolean\(profile\.whatsapp\),googleConnected:false,ageRange:/);
  assert.doesNotMatch(profileJs,/delete saved\.birthday/);
  assert.match(backendJs,/privateProfileFields = \[[^\]]*'birthday'/);
});

test('settings show the setup fields belonging to the active developer or client mode',()=>{
  for(const id of ['settingsExperienceLevel','settingsProject','settingsIndustry']){
    assert.match(settingsHtml,new RegExp(`id="${id}"`));
  }
  assert.match(settingsJs,/developerSpecificFields'\)\.hidden = !isDeveloper/);
  assert.match(settingsJs,/clientSpecificFields'\)\.hidden = isDeveloper/);
  assert.match(settingsJs,/settingsExperienceLevel'\)\.value/);
  assert.match(settingsJs,/settingsProject'\)\.value\.trim\(\)/);
  assert.match(settingsJs,/settingsIndustry'\)\.value\.trim\(\)/);
  assert.match(settingsJs,/settingsSkillsHeading'\)\.textContent = isDeveloper \? 'Skills & Tech Stacks' : 'Preferred Skills & Technology'/);
});

test('settings wait for the active workspace cache before populating saved values',()=>{
  assert.match(settingsJs,/const user = await window\.devMatchBackend\.ready;\s*if \(!user\) return;\s*profileData = getProfile\(\);/);
  assert.match(settingsJs,/Object\.assign\(profileData, await window\.devMatchBackend\.loadPrivateProfileFields\(\)\)/);
});
