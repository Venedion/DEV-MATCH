const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const settingsHtml=fs.readFileSync(path.join(root,'devmatch-settings.html'),'utf8');
const settingsJs=fs.readFileSync(path.join(root,'assets/js/settings.js'),'utf8');
const settingsCss=fs.readFileSync(path.join(root,'assets/css/settings.css'),'utf8');

test('save buttons start disabled and use a lighter disabled style',()=>{
  const submitButtons=[...settingsHtml.matchAll(/<button(?=[^>]*type="submit")[^>]*>/g)].map(match=>match[0]);
  assert.ok(submitButtons.length > 0);
  assert.ok(submitButtons.every(button=>/\sdisabled(?:\s|>)/.test(button)));
  for(const id of ['saveProfileSpecialties','saveProfileSkills','saveClientBusinessDetails']){
    assert.match(settingsHtml,new RegExp(`<button[^>]*id="${id}"[^>]*disabled`));
  }
  assert.match(settingsCss,/\.settings-btn\.primary:disabled\s*\{[^}]*background:\s*#d8d9de/);
  assert.match(settingsCss,/\.settings-btn:disabled\s*\{[^}]*cursor:\s*not-allowed/);
});

test('form save buttons track changes, prevent unchanged submits, and reset after saving',()=>{
  assert.match(settingsJs,/button\.disabled = savedValue === null \|\| snapshot\(\) === savedValue/);
  assert.match(settingsJs,/target\.addEventListener\('input', update\);\s*target\.addEventListener\('change', update\)/);
  assert.match(settingsJs,/event\.preventDefault\(\);\s*event\.stopImmediatePropagation\(\)/);
  assert.match(settingsJs,/saveButtonTrackers\.forEach\(tracker => tracker\.markSaved\(\)\)/);
  assert.match(settingsJs,/accountSaveTracker\.markSaved\(\)/);
  assert.match(settingsJs,/roleSaveTracker\.markSaved\(\)/);
  assert.match(settingsJs,/notificationSaveTracker\.markSaved\(\)/);
  assert.match(settingsJs,/preferencesSaveTracker\.markSaved\(\)/);
  assert.match(settingsJs,/passwordSaveTracker\.markSaved\(\)/);
});

test('custom profile and experience save buttons enable only for changed drafts',()=>{
  assert.match(settingsJs,/companyName: document\.getElementById\('settingsCompanyName'\)\.value,[\s\S]*?industry: document\.getElementById\('settingsIndustry'\)\.value/);
  assert.match(settingsJs,/profileSpecialtySaveTracker = createSaveButtonTracker/);
  assert.match(settingsJs,/profileSkillsSaveTracker = createSaveButtonTracker/);
  assert.match(settingsJs,/experienceSaveSnapshot\(entry\) === entry\.saveBaseline \? ' disabled' : ''/);
  assert.match(settingsJs,/appEditSaveTracker\.markSaved\(\)/);
});

test('settings hydrate from the active database workspace and do not fall back to stale browser profiles',()=>{
  assert.match(settingsJs,/const row = await window\.devMatchBackend\.loadProfile\(user\)/);
  assert.match(settingsJs,/if \(row\.account_role !== role\)/);
  assert.match(settingsJs,/privateProfileFieldsLoaded = true;\s*openProfileDetailsTarget\(\)/);
  assert.doesNotMatch(settingsJs,/localStorage\.(?:getItem|setItem)\(/);
  const initializationCatch=settingsJs.slice(
    settingsJs.indexOf("console.error('Unable to load saved profile settings.'"),
    settingsJs.indexOf('} finally {',settingsJs.indexOf("console.error('Unable to load saved profile settings.'"))
  );
  assert.doesNotMatch(initializationCatch,/populateForm\(\)/);
  assert.match(settingsJs,/if \(privateProfileFieldsLoaded\) \{\s*settingsContent\?\.removeAttribute\('inert'\)/);
});

test('leaving a settings category restores saved fields and resets save trackers',()=>{
  assert.match(settingsJs,/if \(activeTab && tabId !== activeTab && privateProfileFieldsLoaded\) \{\s*if \(activeTab === 'profile-details'\) closeExperienceEditors\(\);\s*populateForm\(\);/);
  assert.match(settingsJs,/\[accountForm, profileDetailsForm, roleForm, notifForm, privacyForm, preferencesForm, passwordForm\][\s\S]*?\.forEach\(form => form\.reset\(\)\)/);
  assert.match(settingsJs,/setSkillsEditing\(false\);[\s\S]*?setSpecialtiesEditing\(false\)/);
  assert.match(settingsJs,/saveButtonTrackers\.forEach\(tracker => tracker\.markSaved\(\)\)/);
});
