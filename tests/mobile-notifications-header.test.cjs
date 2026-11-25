const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const notificationsCss=fs.readFileSync(path.join(root,'assets/css/notifications.css'),'utf8');
const notificationsJs=fs.readFileSync(path.join(root,'assets/js/notifications.js'),'utf8');

test('mobile notifications keeps both topbars while hiding their contents',()=>{
  const developerHtml=fs.readFileSync(path.join(root,'devmatch-developer-notifications.html'),'utf8');
  const clientHtml=fs.readFileSync(path.join(root,'devmatch-notifications.html'),'utf8');

  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?body\.developer-notifications > \.topbar > :not\(\.notification-mobile-filter-toggle\):not\(\.notification-mobile-settings\):not\(\.notification-mobile-filter-menu\),\s*body\.client-notifications > \.client-topbar > :not\(\.notification-mobile-filter-toggle\):not\(\.notification-mobile-settings\):not\(\.notification-mobile-filter-menu\) \{\s*display: none !important;/);
  assert.match(notificationsJs,/desktopMarkAllLayout = window\.matchMedia\('\(orientation: landscape\)'\)/);
  assert.match(notificationsJs,/mobileListLayout = window\.matchMedia\('\(orientation: portrait\)'\)/);
  assert.match(developerHtml,/<body class="developer-notifications page-scroll-shell"/);
  assert.match(clientHtml,/<body class="client-notifications page-scroll-shell"/);
});

test('mobile notification feed removes its card surface and keeps row and group dividers',()=>{
  assert.match(notificationsCss,/\.notification-list,\.notification-card\{border:1px solid var\(--cd-line\);border-radius:15px;background:#fff\}/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-list\{padding:0;border:0;border-radius:0;background:transparent\}/);
  assert.match(notificationsCss,/\.notification-row\{min-height:72px;[^}]*border-bottom:1px solid #eeeeef\}/);
  assert.match(notificationsCss,/\.notification-row\.is-unread\{border-radius:9px;background:rgba\(0,0,0,\.04\)\}/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-group\+\.notification-group\{margin-top:15px;padding-top:12px;border-top:1px solid #e8e8eb\}/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-row\.is-unread\{border-radius:0\}/);
});

test('mobile notification text truncates beside actions without shrinking buttons',()=>{
  assert.match(notificationsJs,/content\.className = 'notification-content'/);
  assert.match(notificationsJs,/content\.append\(copy, time\)/);
  assert.match(notificationsJs,/article\.append\(dot, avatar, content, action\)/);
  assert.match(notificationsCss,/\.notification-content\{display:contents\}/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-row\{display:flex;gap:6px;padding:10px 0\}/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-content\{display:flex;flex:1 1 0;flex-direction:column;gap:4px;min-width:0\}/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-copy>span\{overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-action\{position:absolute;inset:0;z-index:1;[^}]*color:transparent;font-size:0/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-row:active\{background:rgba\(0,0,0,\.08\)\}/);
  const mobileContentRule=notificationsCss.match(/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-content\{([^}]*)\}/);
  assert.ok(mobileContentRule);
  assert.doesNotMatch(mobileContentRule[1],/(?:^|;)\s*width\s*:/);
});

test('mobile mark all read has no background or border',()=>{
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.mark-all-read\{border:0;border-radius:0;background:transparent\}/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.mark-all-read:hover\{border-color:transparent;background:transparent\}/);
});

test('notification description is hidden only on mobile',()=>{
  assert.match(notificationsCss,/\.notifications-heading p\{margin-top:5px;color:var\(--cd-muted\);font-size:14px\}/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notifications-heading p\{display:none\}/);
});

test('notification all-filter label changes only on mobile',()=>{
  const developerHtml=fs.readFileSync(path.join(root,'devmatch-developer-notifications.html'),'utf8');
  const clientHtml=fs.readFileSync(path.join(root,'devmatch-notifications.html'),'utf8');

  for(const html of [developerHtml,clientHtml]){
    assert.match(html,/data-filter="all"[^>]*>[\s\S]*?<span class="notification-filter-label-desktop">All<\/span><span class="notification-filter-label-mobile">All Activity<\/span>/);
  }
  assert.match(notificationsCss,/\.notification-filter-label-mobile\{display:none\}/);
  assert.match(notificationsCss,/\.notification-filter-label-desktop\{display:none\}\s*\.notification-filter-label-mobile\{display:inline\}/);
});

test('mobile notifications moves All Activity into a functional filter dropdown',()=>{
  const developerHtml=fs.readFileSync(path.join(root,'devmatch-developer-notifications.html'),'utf8');
  const clientHtml=fs.readFileSync(path.join(root,'devmatch-notifications.html'),'utf8');
  const mobileNavigationCss=fs.readFileSync(path.join(root,'assets/css/mobile-navigation.css'),'utf8');

  for(const html of [developerHtml,clientHtml]){
    assert.match(html,/<header class="(?:topbar|client-topbar)">[\s\S]*?class="notification-mobile-filter-toggle"[\s\S]*?<\/header>\s*<div class="notification-mobile-filter-menu"/);
    assert.match(html,/class="notification-mobile-filter-toggle" id="notificationFilterToggle"/);
    assert.match(html,/<button class="notification-mobile-settings" id="notificationSettingsToggle" type="button" aria-expanded="false" aria-controls="notification-settings" aria-label="Notification settings">[\s\S]*?<img src="assets\/images\/notification-settings-gear\.png" alt="">/);
    assert.match(html,/<section class="notification-card preferences-card" id="notification-settings"/);
    assert.match(html,/class="notification-mobile-filter-menu" id="notificationFilterMenu"/);
    for(const filter of ['all','unread','comments','messages','favorites','ratings']){
      assert.match(html,new RegExp(`data-notification-filter-option="${filter}"`));
    }
  }
  assert.match(mobileNavigationCss,/header\.topbar,[\s\S]*?header\.client-topbar,[\s\S]*?z-index:\s*40;/);
  assert.match(notificationsCss,/\.notification-mobile-filter-toggle,\.notification-mobile-settings\{display:none\}/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-mobile-filter-menu:not\(\[hidden\]\)\{[^}]*position:fixed;inset:56px 0 0;z-index:4;[^}]*overflow:visible/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-mobile-filter-panel\{[^}]*transform:translateY\(-100%\);[^}]*box-shadow:/);
  assert.match(notificationsCss,/font-size:15px;font-weight:800;letter-spacing:\.035em/);
  assert.match(notificationsCss,/\.notification-mobile-filter-toggle\{[^}]*top:50%;left:50%;[^}]*transform:translate\(-50%,-50%\)/);
  assert.match(notificationsCss,/\.notification-mobile-settings\{[^}]*position:absolute;top:50%;right:12px;[^}]*width:38px;height:38px/);
  assert.match(notificationsCss,/\.notification-mobile-settings img\{width:34px;height:34px;object-fit:contain;transform:rotate\(0deg\);transition:transform \.34s cubic-bezier\(\.4,0,\.2,1\)\}/);
  assert.match(notificationsCss,/\.notification-mobile-settings\[aria-expanded="true"\] img\{transform:rotate\(60deg\)\}/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?#notification-settings\{[^}]*position:fixed;inset:56px 0 auto;z-index:4;[^}]*transform:translateY\(-100%\);visibility:hidden/);
  assert.match(notificationsCss,/#notification-settings\.is-mobile-settings-open\{[^}]*transform:translateY\(0\);visibility:visible;pointer-events:auto/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-mobile-filter-menu button\{min-height:38px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var\(--cd-ink\);font:inherit;font-size:13px;text-align:left;cursor:pointer\}/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-mobile-filter-panel\{[^}]*transition:transform \.34s cubic-bezier\(\.4,0,\.2,1\)/);
  assert.match(notificationsCss,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.notification-mobile-filter-menu\.is-open \.notification-mobile-filter-panel\{[^}]*transform:translateY\(0\);pointer-events:auto/);
  assert.doesNotMatch(notificationsCss,/notification-mobile-filter-panel[^{]*\{[^}]*scaleY|notification-mobile-filter-menu\.is-open[^{]*\{[^}]*scaleY/);
  assert.doesNotMatch(notificationsCss,/notification-mobile-filter-panel[^{]*\{[^}]*transition:[^}]*visibility|notification-mobile-filter-panel[^{]*\{[^}]*transition:[^}]*opacity/);
  assert.match(notificationsCss,/\.notification-mobile-filter-toggle svg\{[^}]*transition:transform \.18s ease\}/);
  assert.match(notificationsCss,/\.notification-mobile-filter-toggle\[aria-expanded="true"\] svg\{transform:rotate\(180deg\)\}/);
  assert.match(notificationsCss,/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.notification-mobile-filter-toggle svg,\s*\.notification-mobile-settings img \{\s*transition: none;/);
  assert.match(notificationsCss,/\.notification-controls\{display:none\}/);
  assert.match(notificationsJs,/document\.querySelector\(`\.notification-filter\[data-filter="\$\{option\.dataset\.notificationFilterOption\}"\]`\)\?\.click\(\)/);
  assert.match(notificationsJs,/mobileFilterMenu\.classList\.add\('is-open'\)/);
  assert.match(notificationsJs,/function setMobileSettingsMenuOpen\(open, restoreFocus = false\)/);
  assert.match(notificationsJs,/mobileSettingsCard\.classList\.toggle\('is-mobile-settings-open', shouldOpen\)/);
  assert.match(notificationsJs,/mobileSettingsToggle\?\.addEventListener\('click'/);
  assert.match(notificationsJs,/mobileFilterClosePending = true/);
  assert.match(notificationsJs,/mobileFilterPanel\?\.addEventListener\('transitionend'/);
  assert.match(notificationsJs,/event\.target !== mobileFilterPanel \|\| event\.propertyName !== 'transform'/);
  assert.match(notificationsJs,/!mobileFilterMenu\?\.contains\(event\.target\)[\s\S]*?!mobileFilterToggle\?\.contains\(event\.target\)/);
  assert.match(notificationsJs,/syncMobileFilterSelection\(activeFilter\)/);
});
