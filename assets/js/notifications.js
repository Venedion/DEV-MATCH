const workspace=document.body.dataset.workspace||'client';
const profile=JSON.parse(localStorage.getItem(`devmatch-profile-${workspace}`)||'{}');
const clientName=typeof profile.displayName==='string'&&profile.displayName.trim()
  ? profile.displayName.trim()
  : (workspace==='dev'?'Rizky Aditya':'Client');
const clientNameParts=clientName.trim().split(/\s+/).filter(Boolean);
document.getElementById('topUserName').textContent=clientName;
document.getElementById('userAvatar').textContent=clientNameParts.slice(0,2).map(part=>part[0]).join('').toUpperCase()||(workspace==='dev'?'RA':'CL');

const readStorageKey=`devmatch-${workspace}-notifications-read`;
const preferencesStorageKey=`devmatch-${workspace}-notification-preferences`;
const notificationRows=[...document.querySelectorAll('[data-notification]')];
const readNotifications=new Set(JSON.parse(localStorage.getItem(readStorageKey)||'[]'));
const preferenceInputs=[...document.querySelectorAll('[data-preference]')];
const savedPreferences=JSON.parse(localStorage.getItem(preferencesStorageKey)||'{}');
let activeFilter='all';
let activeQuery='';

notificationRows.forEach(row=>{
  if(readNotifications.has(row.dataset.notification))row.classList.remove('is-unread');
});
preferenceInputs.forEach(input=>{
  if(Object.hasOwn(savedPreferences,input.dataset.preference)){
    input.checked=Boolean(savedPreferences[input.dataset.preference]);
  }
});

function updateNotifications(){
  const unreadCount=notificationRows.filter(row=>row.classList.contains('is-unread')).length;
  document.querySelectorAll('[data-count="all"]').forEach(count=>count.textContent=String(notificationRows.length));
  document.querySelectorAll('[data-count="unread"]').forEach(count=>count.textContent=String(unreadCount));
  const sidebarCount=document.getElementById('sidebarUnreadCount');
  sidebarCount.textContent=String(unreadCount);
  sidebarCount.hidden=unreadCount===0;
  document.querySelector('.notification-icon').classList.toggle('is-clear',unreadCount===0);

  let visibleCount=0;
  notificationRows.forEach(row=>{
    const filterMatches=activeFilter==='all'
      ||activeFilter==='unread'&&row.classList.contains('is-unread')
      ||row.dataset.kind===activeFilter;
    const queryMatches=!activeQuery||row.textContent.toLowerCase().includes(activeQuery);
    row.hidden=!(filterMatches&&queryMatches);
    if(!row.hidden)visibleCount++;
  });
  document.querySelectorAll('[data-group]').forEach(group=>{
    group.hidden=!group.querySelector('.notification-row:not([hidden])');
  });
  document.getElementById('notificationEmpty').hidden=visibleCount>0;
}

function saveReadNotifications(){
  localStorage.setItem(readStorageKey,JSON.stringify([...readNotifications]));
}

function markRead(notificationId){
  const row=notificationRows.find(item=>item.dataset.notification===notificationId);
  if(!row)return;
  row.classList.remove('is-unread');
  readNotifications.add(notificationId);
  saveReadNotifications();
  updateNotifications();
}

document.querySelectorAll('.notification-filter').forEach(button=>{
  button.addEventListener('click',()=>{
    activeFilter=button.dataset.filter;
    document.querySelectorAll('.notification-filter').forEach(filterButton=>{
      const selected=filterButton===button;
      filterButton.classList.toggle('active',selected);
      filterButton.setAttribute('aria-pressed',String(selected));
    });
    updateNotifications();
  });
});

document.getElementById('markAllRead').addEventListener('click',()=>{
  notificationRows.forEach(row=>{
    row.classList.remove('is-unread');
    readNotifications.add(row.dataset.notification);
  });
  saveReadNotifications();
  updateNotifications();
});

document.querySelectorAll('[data-mark-read]').forEach(link=>{
  link.addEventListener('click',()=>{
    const notificationId=link.dataset.notificationLink||link.closest('[data-notification]')?.dataset.notification;
    if(notificationId)markRead(notificationId);
  });
});

preferenceInputs.forEach(input=>{
  input.addEventListener('change',()=>{
    const preferences=Object.fromEntries(preferenceInputs.map(preference=>[preference.dataset.preference,preference.checked]));
    localStorage.setItem(preferencesStorageKey,JSON.stringify(preferences));
  });
});

const search=document.getElementById('searchInput');
search.addEventListener('input',()=>{
  activeQuery=search.value.trim().toLowerCase();
  updateNotifications();
});
document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();
    search.focus();
  }
});

updateNotifications();
