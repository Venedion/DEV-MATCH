const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const notificationsCss=fs.readFileSync(path.join(root,'assets/css/notifications.css'),'utf8');
const notificationsJs=fs.readFileSync(path.join(root,'assets/js/notifications.js'),'utf8');
const navigationJs=fs.readFileSync(path.join(root,'assets/js/nav-behavior.js'),'utf8');

test('mobile notification list limits the overall feed while preserving new and today priorities',()=>{
  assert.match(notificationsJs,/const MOBILE_NOTIFICATION_LIMIT = 10/);
  assert.match(notificationsJs,/matchingRows\.slice\(0, MOBILE_NOTIFICATION_LIMIT\)/);
  assert.match(notificationsJs,/newlyReceivedNotificationIds = new Set\(unreadIds\)/);
  assert.match(notificationsJs,/row\.classList\.contains\('is-unread'\)[\s\S]*newlyReceivedNotificationIds\.has\(row\.dataset\.notification\)[\s\S]*dataset\.groupKey === 'today'/);
  assert.match(notificationsJs,/!defaultVisibleRows\.has\(row\) && !isPriorityNotification\(row\)/);
  assert.match(notificationsJs,/function orderNotificationsNewestFirst\(notifications\)/);
});

test('mobile list expansion shows View All, View More, and View Less without adding desktop UI',()=>{
  assert.match(notificationsJs,/newCount > MOBILE_NOTIFICATION_LIMIT[\s\S]*todayCount > MOBILE_NOTIFICATION_LIMIT/);
  assert.match(notificationsJs,/mobileListExpanded\s*\?\s*'View Less'/);
  assert.match(notificationsJs,/listToggle\.addEventListener\('click'/);
  assert.match(notificationsJs,/itemsContainer\.animate\([\s\S]*duration: 220/);
  assert.match(navigationJs,/table: 'notifications'[\s\S]*if \(window\.matchMedia\('\(max-width: 600px\)'\)\.matches\) \{\s*window\.dispatchEvent\(new CustomEvent\('devmatch:notification-received'/);
  assert.match(notificationsJs,/window\.addEventListener\('devmatch:notification-received', event => \{\s*if \(!mobileListLayout\.matches/);
  assert.match(notificationsJs,/newlyReceivedNotificationIds\.add\(notification\.id\)/);
  assert.match(notificationsCss,/\.notification-list-toggle\{display:none\}/);
  assert.match(notificationsCss,/@media \(max-width: 600px\) \{[\s\S]*?\.notification-list-toggle:not\(\[hidden\]\)\{[^}]*display:flex/);
  assert.match(notificationsCss,/@media \(max-width: 600px\) \{[\s\S]*?\.notification-row\.is-mobile-collapsed\{[^}]*max-height:0/);
});
