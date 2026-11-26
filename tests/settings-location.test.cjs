const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const settingsCss=fs.readFileSync(path.join(root,'assets/css/settings.css'),'utf8');
const settingsHtml=fs.readFileSync(path.join(root,'devmatch-settings.html'),'utf8');
const settingsJs=fs.readFileSync(path.join(root,'assets/js/settings.js'),'utf8');
const profileJs=fs.readFileSync(path.join(root,'assets/js/profile.js'),'utf8');

test('Preferences & Region contains the setup country list and grouped location picker',()=>{
  const accountForm=settingsHtml.match(/<form class="settings-card" id="accountForm">([\s\S]*?)<\/form>/)?.[1]||'';
  const preferencesForm=settingsHtml.match(/<form class="settings-card" id="preferencesForm">([\s\S]*?)<\/form>/)?.[1]||'';
  assert.doesNotMatch(accountForm,/settingsCountry|settingsCity/);
  assert.match(preferencesForm,/settingsCountry[\s\S]*settingsCity/);
  assert.match(settingsHtml,/<select class="settings-select" id="settingsCountry">[\s\S]*?<option value="Indonesia">Indonesia<\/option>[\s\S]*?<option value="Malaysia">Malaysia<\/option>[\s\S]*?<option value="Singapore">Singapore<\/option>/);
  assert.match(settingsHtml,/id="settingsCity"[^>]*role="combobox"/);
  assert.match(settingsHtml,/id="settingsLocationOptions" role="listbox"/);
  assert.match(settingsHtml,/client-profile-options\.js[\s\S]*?settings\.js/);
  assert.match(settingsJs,/window\.DEVMATCH_CLIENT_PROFILE_OPTIONS\.countries/);
  assert.match(settingsJs,/Indonesia: indonesiaData\.provinces,\s*Malaysia: internationalData\.countries\.Malaysia,\s*Singapore: internationalData\.countries\.Singapore/);
  assert.match(settingsJs,/settingsLocationGroup\.cities\.map\(city => \(\{type: 'city'/);
  assert.match(settingsJs,/if \(option\) \{\s*event\.stopPropagation\(\);\s*selectSettingsLocationOption\(option\)/);
  assert.match(settingsJs,/if \(!validateSettingsLocation\(\)\) return;[\s\S]*?await savePreferences\(preferencesForm, \{\s*country: settingsCountrySelect\.value,\s*city: settingsCityInput\.value\.trim\(\)/);
});

test('location selection keeps the setup country-specific hierarchy and saves country with city',()=>{
  assert.match(settingsJs,/if \(country === 'Malaysia'\) return \{parent: 'State', parentPlural: 'states', child: 'City', childPlural: 'cities'\}/);
  assert.match(settingsJs,/if \(country === 'Singapore'\) return \{parent: 'Region', parentPlural: 'regions', child: 'Area', childPlural: 'areas'\}/);
  assert.match(profileJs,/if\(country==='Malaysia'\)return \{parent:'State',parentPlural:'states',child:'City',childPlural:'cities'\}/);
  assert.match(profileJs,/if\(country==='Singapore'\)return \{parent:'Region',parentPlural:'regions',child:'Area',childPlural:'areas'\}/);
  assert.match(settingsJs,/await savePreferences\(preferencesForm, \{\s*country: settingsCountrySelect\.value,\s*city: settingsCityInput\.value\.trim\(\)/);
  assert.match(settingsJs,/const knownLocation = settingsLocationDataReady[\s\S]*?settingsLocationRegions\[country\][\s\S]*?group\.cities\.some\(item => `\$\{group\.name\}, \$\{item\.name\}` === city\)/);
  assert.match(settingsJs,/function settingsLocationArticle\(value\)/);
  assert.match(settingsJs,/then \$\{settingsLocationArticle\(labels\.child\)\}/);
  assert.match(profileJs,/function locationArticle\(value\)/);
  assert.match(profileJs,/then \$\{childArticle\}/);
  assert.match(settingsHtml,/settings-location-picker/);
});

test('Profile & Account keeps WhatsApp Number while regional fields live in Preferences',()=>{
  const accountForm=settingsHtml.match(/<form class="settings-card" id="accountForm">([\s\S]*?)<\/form>/)?.[1]||'';
  assert.match(accountForm,/id="settingsEmail"[\s\S]*?id="settingsWhatsapp"/);
  assert.match(settingsHtml,/id="preferencesForm"[\s\S]*?id="settingsCountry"[\s\S]*?id="settingsCity"/);
  assert.doesNotMatch(settingsHtml,/id="settingsPhone"|phoneVerificationStatus|startWhatsAppVerification|openWhatsAppVerification|checkWhatsAppVerification|phone-verification\.js/);
});

test('location textbox matches country control dimensions',()=>{
  assert.match(settingsCss,/\.settings-input, \.settings-select, \.settings-textarea \{\s*height: 40px;/);
  assert.match(settingsCss,/\.settings-location-picker \.settings-input \{\s*width: 100%;\s*font-size: 13px;\s*padding-right: 48px;/);
});
