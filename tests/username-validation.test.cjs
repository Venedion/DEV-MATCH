const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/js/username-validation.js'),'utf8');
const authHtml=fs.readFileSync(path.join(root,'devmatch-auth.html'),'utf8');
const settingsHtml=fs.readFileSync(path.join(root,'devmatch-settings.html'),'utf8');
const settingsJs=fs.readFileSync(path.join(root,'assets/js/settings.js'),'utf8');

function loadUsernameValidation(availability={data:true,error:null}) {
  const calls=[];
  const window={devMatchBackend:{checkUsernameAvailability:async username=>{
    calls.push(username);
    return availability;
  }}};
  vm.runInNewContext(source,{window});
  return {rules:window.DEVMATCH_USERNAME,calls};
}

test('username validation follows the specified limits, order, and exact messages',()=>{
  const {rules}=loadUsernameValidation();
  const cases=[
    ['ab',rules.messages.minimumLength],
    ['a'.repeat(21),rules.messages.maximumLength],
    ['A1',rules.messages.minimumLength],
    ['Abc',rules.messages.lowercase],
    ['ab c',rules.messages.spaces],
    ['ab@c',rules.messages.characters],
    ['.abc',rules.messages.period],
    ['abc.',rules.messages.period],
    ['a..b',rules.messages.consecutivePeriods]
  ];
  for(const [username,message] of cases){
    assert.equal(rules.validate(username).message,message);
  }
  const valid=rules.validate('valid_name.1');
  assert.equal(valid.valid,true);
  assert.equal(valid.message,'');
  assert.equal(rules.normalize('Felita13'), 'felita13');
});

test('username availability requests use lowercase values',async()=>{
  const {rules,calls}=loadUsernameValidation();
  assert.equal(await rules.isAvailable('FeLiTa13'),true);
  assert.deepEqual(calls,['felita13']);
});

test('registration and profile settings show the username policy and load shared validation',()=>{
  const policy='You can change your username once every 7 days. Use 3–20 characters, including letters, numbers, periods (.) and underscores (_).';
  assert.ok(authHtml.includes(policy));
  assert.ok(settingsHtml.includes(policy));
  assert.match(authHtml,/username-validation\.js\?v=/);
  assert.match(settingsHtml,/username-validation\.js\?v=/);
  assert.match(settingsHtml,/id="settingsUsername"[^>]*aria-describedby="settingsUsernamePolicy settingsUsernameError settingsUsernameStatus"/);
  assert.doesNotMatch(settingsHtml,/id="saveUsername"|Update username/);
  assert.match(settingsHtml,/<button class="settings-btn primary" type="submit" disabled>Save Profile Changes<\/button>/);
  assert.doesNotMatch(settingsHtml,/id="settingsUsername"[^>]*readonly/);
});

test('settings checks username availability and saves username with profile changes',()=>{
  assert.match(settingsJs,/settingsUsernameStatus\.textContent = 'Username is available\.';\s*return true;/);
  assert.match(settingsJs,/async function validateUsernameBeforeSave\(\)/);
  assert.match(settingsJs,/if \(!await validateUsernameBeforeSave\(\)\) return/);
  assert.match(settingsJs,/usernameUpdate = await window\.devMatchBackend\.changeUsername\(username\)/);
  assert.match(settingsJs,/await persistProfile\(updatedProfile, \{includePrivateFields: true\}\)/);
});
