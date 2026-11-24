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

  assert.match(notificationsCss,/@media \(max-width: 600px\) \{[\s\S]*?body\.developer-notifications > \.topbar > :not\(\.notification-mobile-filter-toggle\):not\(\.notification-mobile-filter-menu\),\s*body\.client-notifications > \.client-topbar > :not\(\.notification-mobile-filter-toggle\):not\(\.notification-mobile-filter-menu\) \{\s*display: none !important;/);
  assert.match(developerHtml,/<body class="developer-notifications page-scroll-shell"/);
  assert.match(clientHtml,/<body class="client-notifications page-scroll-shell"/);
});

test('mobile notification feed removes its card surface and keeps row and group dividers',()=>{
  assert.match(notificationsCss,/\.notification-list,\.notification-card\{border:1px solid var\(--cd-line\);border-radius:15px;background:#fff\}/);
  assert.match(notificationsCss,/@media \(max-width: 600px\) \{[\s\S]*?\.notification-list\{padding:0;border:0;border-radius:0;background:transparent\}/);
  assert.match(notificationsCss,/\.notification-row\{min-height:72px;[^}]*border-bottom:1px solid #eeeeef\}/);
  assert.match(notificationsCss,/@media \(max-width: 600px\) \{[\s\S]*?\.notification-group\+\.notification-group\{margin-top:15px;padding-top:12px;border-top:1px solid #e8e8eb\}/);
  assert.match(notificationsCss,/@media \(max-width: 600px\) \{[\s\S]*?\.notification-row\.is-unread\{border-radius:0;background:transparent\}/);
});

test('mobile notification text truncates beside actions without shrinking buttons',()=>{
  assert.match(notificationsJs,/content\.className = 'notification-content'/);
  assert.match(notificationsJs,/content\.append\(copy, time\)/);
  assert.match(notificationsJs,/article\.append\(dot, avatar, content, action\)/);
  assert.match(notificationsCss,/\.notification-content\{display:contents\}/);
  assert.match(notificationsCss,/@media \(max-width: 600px\) \{[\s\S]*?\.notification-row\{display:flex;gap:6px;padding:10px 0\}/);
  assert.match(notificationsCss,/@media \(max-width: 600px\) \{[\s\S]*?\.notification-content\{display:flex;flex:1 1 0;flex-direction:column;gap:4px;min-width:0\}/);
  assert.match(notificationsCss,/@media \(max-width: 600px\) \{[\s\S]*?\.notification-copy>span\{overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
  assert.match(notificationsCss,/@media \(max-width: 600px\) \{[\s\S]*?\.notification-action\{flex-shrink:0;margin-left:6px\}/);
  const mobileContentRule=notificationsCss.match(/@media \(max-width: 600px\) \{[\s\S]*?\.notification-content\{([^}]*)\}/);
  assert.ok(mobileContentRule);
  assert.doesNotMatch(mobileContentRule[1],/(?:^|;)\s*width\s*:/);
});

test('mobile mark all read has no background or border',()=>{
  assert.match(notificationsCss,/@media \(max-width: 600px\) \{[\s\S]*?\.mark-all-read\{border:0;border-radius:0;background:transparent\}/);
  assert.match(notificationsCss,/@media \(max-width: 600px\) \{[\s\S]*?\.mark-all-read:hover\{border-color:transparent;background:transparent\}/);
});

test('notification description is hidden only on mobile',()=>{
  assert.match(notificationsCss,/\.notifications-heading p\{margin-top:5px;color:var\(--cd-muted\);font-size:14px\}/);
  assert.match(notificationsCss,/@media \(max-width: 600px\) \{[\s\S]*?\.notifications-heading p\{display:none\}/);
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

  for(const html of [developerHtml,clientHtml]){
    assert.match(html,/<header class="(?:topbar|client-topbar)">[\s\S]*?class="notification-mobile-filter-toggle"[\s\S]*?class="notification-mobile-filter-menu"[\s\S]*?<\/header>/);
    assert.match(html,/class="notification-mobile-filter-toggle" id="notificationFilterToggle"/);
    assert.match(html,/class="notification-mobile-filter-menu" id="notificationFilterMenu"/);
    for(const filter of ['all','unread','comments','messages','favorites','ratings']){
      assert.match(html,new RegExp(`data-notification-filter-option="${filter}"`));
    }
  }
  assert.match(notificationsCss,/font-size:15px;font-weight:800;letter-spacing:\.035em/);
  assert.match(notificationsCss,/\.notification-mobile-filter-toggle\{[^}]*top:50%;left:50%;[^}]*transform:translate\(-50%,-50%\)/);
  assert.match(notificationsCss,/\.notification-mobile-filter-menu:not\(\[hidden\]\)\{[^}]*left:50%;[^}]*transform:translateX\(-50%\)/);
  assert.match(notificationsCss,/\.notification-mobile-filter-toggle svg\{[^}]*transition:transform \.18s ease\}/);
  assert.match(notificationsCss,/\.notification-mobile-filter-toggle\[aria-expanded="true"\] svg\{transform:rotate\(180deg\)\}/);
  assert.match(notificationsCss,/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.notification-mobile-filter-toggle svg \{\s*transition: none;/);
  assert.match(notificationsCss,/\.notification-controls\{display:none\}/);
  assert.match(notificationsJs,/document\.querySelector\(`\.notification-filter\[data-filter="\$\{option\.dataset\.notificationFilterOption\}"\]`\)\?\.click\(\)/);
  assert.match(notificationsJs,/syncMobileFilterSelection\(activeFilter\)/);
});
