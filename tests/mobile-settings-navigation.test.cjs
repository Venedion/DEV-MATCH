const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const settingsCss=fs.readFileSync(path.join(root,'assets/css/settings.css'),'utf8');
const settingsHtml=fs.readFileSync(path.join(root,'devmatch-settings.html'),'utf8');
const settingsJs=fs.readFileSync(path.join(root,'assets/js/settings.js'),'utf8');
const profileCss=fs.readFileSync(path.join(root,'assets/css/my-profile.css'),'utf8');
const profileNavigationJs=fs.readFileSync(path.join(root,'assets/js/nav-behavior.js'),'utf8');
const returnToSettingsMenu=settingsJs.slice(
  settingsJs.indexOf('function returnToMobileSettingsMenu()'),
  settingsJs.indexOf('\n  function createMobileSettingsDetailPage()')
);

test('mobile settings categories open a detail page with a category title and back action',()=>{
  assert.match(settingsJs,/window\.matchMedia\('\(orientation: portrait\)'\)/);
  assert.match(settingsJs,/mobileSettingsDetailPage\.setAttribute\('role', 'dialog'\)/);
  assert.match(settingsJs,/mobileSettingsDetailPage\.setAttribute\('aria-modal', 'true'\)/);
  assert.match(settingsJs,/mobileSettingsDetailPage\.setAttribute\('aria-labelledby', 'mobileSettingsDetailTitle'\)/);
  assert.match(settingsJs,/titleSource\.querySelector\('\.settings-nav-badge'\)\?\.remove\(\)/);
  assert.match(settingsJs,/mobileSettingsDetailTitle\.textContent = titleSource\.textContent\.trim\(\)/);
  assert.match(settingsJs,/if \(mobileSettingsDetailBreakpoint\.matches\) openMobileSettingsDetail\(btn\.dataset\.tab\)/);
  assert.match(settingsJs,/backButton\.addEventListener\('click', returnToMobileSettingsMenu\)/);
  assert.match(returnToSettingsMenu,/mobileSettingsDetailPage\.classList\.remove\('is-open'\)/);
  assert.match(returnToSettingsMenu,/window\.setTimeout\(returnToSettingsMenu, 240\)/);
  assert.match(returnToSettingsMenu,/window\.location\.assign\(`devmatch-my-profile\.html\?role=\$\{menuRole\}&openSettings=1&settingsReturn=1`\)/);
  assert.match(settingsJs,/window\.location\.replace\(`devmatch-my-profile\.html\?role=\$\{menuRole\}&openSettings=1`\)/);
  assert.match(settingsJs,/if \(event\.key === 'Escape'\) \{\s*event\.preventDefault\(\);\s*returnToMobileSettingsMenu\(\)/);
  assert.match(settingsJs,/mobileSettingsDetailPlaceholder\.replaceWith\(mobileSettingsDetailPanel\)/);
  assert.match(settingsJs,/if \(hash && Array\.from\(navBtns\)\.some\(button => button\.dataset\.tab === panelTab\)\) \{\s*openMobileSettingsDetail\(panelTab\)/);
  assert.match(settingsJs,/if \(mobileSettingsDetailBreakpoint\.matches && !window\.location\.hash\) \{\s*const menuRole = isDeveloper \? 'dev' : 'client';\s*window\.location\.replace/);
  assert.match(profileNavigationJs,/returnTo=profile-settings#panel-\$\{link\.dataset\.settingsCategory\}/);
  assert.match(profileNavigationJs,/function setMobileSettingsDrawerOpen\(isOpen, immediate = false\)/);
  assert.match(profileNavigationJs,/profileSearchParams\.get\('settingsReturn'\) === '1'[\s\S]*?setMobileSettingsDrawerOpen\(true, returningFromSettings\)/);
  assert.match(profileNavigationJs,/mobileSettingsDrawer\.classList\.add\('mobile-settings-no-transition'\)/);
  assert.match(profileNavigationJs,/mobileSettingsDrawer\?\.classList\.remove\('mobile-settings-no-transition'\)/);
  assert.match(profileCss,/\.mobile-settings-backdrop\.mobile-settings-no-transition,[\s\S]*?\.mobile-settings-drawer\.mobile-settings-no-transition\{transition:none\}/);
});

test('mobile settings detail page slides in from the right and respects reduced motion',()=>{
  assert.match(settingsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.mobile-settings-detail-page \{[^}]*position: fixed;[^}]*transform: translateX\(100%\)/);
  assert.match(settingsCss,/\.mobile-settings-detail-page\.is-open \{\s*transform: translateX\(0\)/);
  assert.match(settingsCss,/\.mobile-settings-detail-back \{[^}]*display: grid/);
  assert.match(settingsCss,/\.mobile-settings-detail-title \{/);
  assert.match(settingsCss,/html\.mobile-settings-route body > main\.settings-page,[\s\S]*?display: none !important/);
  assert.match(settingsCss,/@media\s*\(orientation:\s*portrait\)\s*and\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.mobile-settings-detail-page \{\s*transition: none/);
  assert.match(settingsHtml,/mobile-settings-route/);
  assert.match(settingsHtml,/settings\.css\?v=20261126-settings-client-github-v1/);
  assert.match(settingsHtml,/settings\.js\?v=20261127-mobile-settings-back-v1/);
});
