const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const settingsCss=fs.readFileSync(path.join(root,'assets/css/settings.css'),'utf8');
const settingsHtml=fs.readFileSync(path.join(root,'devmatch-settings.html'),'utf8');
const settingsJs=fs.readFileSync(path.join(root,'assets/js/settings.js'),'utf8');
const profileJs=fs.readFileSync(path.join(root,'assets/js/profile.js'),'utf8');

test('Profile & Account uses the setup country list and grouped location picker',()=>{
  assert.match(settingsHtml,/<select class="settings-select" id="settingsCountry">[\s\S]*?<option value="Indonesia">Indonesia<\/option>[\s\S]*?<option value="Malaysia">Malaysia<\/option>[\s\S]*?<option value="Singapore">Singapore<\/option>/);
  assert.match(settingsHtml,/id="settingsCity"[^>]*role="combobox"/);
  assert.match(settingsHtml,/id="settingsLocationOptions" role="listbox"/);
  assert.match(settingsHtml,/client-profile-options\.js[\s\S]*?settings\.js/);
  assert.match(settingsJs,/window\.DEVMATCH_CLIENT_PROFILE_OPTIONS\.countries/);
  assert.match(settingsJs,/Indonesia: indonesiaData\.provinces,\s*Malaysia: internationalData\.countries\.Malaysia,\s*Singapore: internationalData\.countries\.Singapore/);
  assert.match(settingsJs,/settingsLocationGroup\.cities\.map\(city => \(\{type: 'city'/);
  assert.match(settingsJs,/if \(option\) \{\s*event\.stopPropagation\(\);\s*selectSettingsLocationOption\(option\)/);
});

test('location selection keeps the setup country-specific hierarchy and saves country with city',()=>{
  assert.match(settingsJs,/if \(country === 'Malaysia'\) return \{parent: 'State', parentPlural: 'states', child: 'City', childPlural: 'cities'\}/);
  assert.match(settingsJs,/if \(country === 'Singapore'\) return \{parent: 'Region', parentPlural: 'regions', child: 'Area', childPlural: 'areas'\}/);
  assert.match(profileJs,/if\(country==='Malaysia'\)return \{parent:'State',parentPlural:'states',child:'City',childPlural:'cities'\}/);
  assert.match(profileJs,/if\(country==='Singapore'\)return \{parent:'Region',parentPlural:'regions',child:'Area',childPlural:'areas'\}/);
  assert.match(settingsJs,/profileData\.country = settingsCountrySelect\.value;\s*profileData\.city = settingsCityInput\.value\.trim\(\)/);
  assert.match(settingsJs,/settingsLocationDataReady\s*&&\s*country === profileData\.country\s*&&\s*city === profileData\.city/);
  assert.match(settingsJs,/function settingsLocationArticle\(value\)/);
  assert.match(settingsJs,/then \$\{settingsLocationArticle\(labels\.child\)\}/);
  assert.match(profileJs,/function locationArticle\(value\)/);
  assert.match(profileJs,/then \$\{childArticle\}/);
  assert.match(settingsHtml,/settings-location-picker/);
});

test('Profile & Account moves WhatsApp Number into the account phone slot',()=>{
  assert.match(settingsHtml,/id="settingsEmail"[\s\S]*?id="settingsWhatsapp"[\s\S]*?id="settingsCountry"/);
  assert.doesNotMatch(settingsHtml,/id="settingsPhone"|phoneVerificationStatus|startWhatsAppVerification|openWhatsAppVerification|checkWhatsAppVerification|phone-verification\.js/);
});

test('location textbox matches country control dimensions',()=>{
  assert.match(settingsCss,/\.settings-input, \.settings-select, \.settings-textarea \{\s*height: 40px;/);
  assert.match(settingsCss,/\.settings-location-picker \.settings-input \{\s*width: 100%;\s*font-size: 13px;\s*padding-right: 48px;/);
});
