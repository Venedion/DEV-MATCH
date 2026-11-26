(function(){
  'use strict';

  const allowedStatistics=new Set(['views','favorites','rating']);

  function required(root,selector){
    const element=root.querySelector(selector);
    if(!element)throw new Error(`Profile overview is missing ${selector}.`);
    return element;
  }

  function safeAvatarUrl(value){
    if(typeof value!=='string')return '';
    if(/^data:image\/(?:jpeg|png);base64,/.test(value))return value;
    if(!value.startsWith('https://'))return '';
    try{
      const url=new URL(value);
      return url.origin==='https://yxwktllqbmhustmhdaqi.supabase.co'
        &&url.pathname.startsWith('/storage/v1/object/public/project-media/')
        ?url.href:'';
    }catch(error){
      return '';
    }
  }

  function renderAvatar(root,imageUrl,fallback){
    const avatar=required(root,'[data-profile-overview-avatar]');
    const initials=String(fallback||'');
    const source=safeAvatarUrl(imageUrl);
    avatar.textContent=initials;
    if(!source)return;
    const image=document.createElement('img');
    image.src=source;
    image.alt='';
    image.setAttribute('aria-hidden','true');
    image.addEventListener('error',()=>{avatar.textContent=initials;});
    avatar.replaceChildren(image);
  }

  function render(root,profile){
    if(!root||root.nodeType!==1||!root.hasAttribute('data-profile-overview')){
      throw new TypeError('A profile overview root element is required.');
    }
    if(!profile||typeof profile!=='object'||Array.isArray(profile)){
      throw new TypeError('Profile overview data must be an object.');
    }

    if(Object.prototype.hasOwnProperty.call(profile,'role')){
      if(!['developer','client'].includes(profile.role)){
        throw new TypeError('Profile overview role must be developer or client.');
      }
      root.dataset.profileRole=profile.role;
    }
    if(Object.prototype.hasOwnProperty.call(profile,'name')){
      required(root,'[data-profile-overview-name]').textContent=String(profile.name||'');
    }
    if(Object.prototype.hasOwnProperty.call(profile,'avatar')){
      renderAvatar(root,profile.avatar,profile.initials);
    }
    if(Object.prototype.hasOwnProperty.call(profile,'availability')){
      const badge=required(root,'[data-profile-overview-status]');
      const label=badge.querySelector('span');
      if(!label)throw new Error('Profile overview status is missing its label.');
      const availability=String(profile.availability||'').trim();
      label.textContent=availability;
      badge.hidden=!availability;
      badge.classList.toggle('busy',availability.toLowerCase().includes('busy'));
      badge.classList.toggle('unavailable',/not available|closed/i.test(availability));
    }
    if(Object.prototype.hasOwnProperty.call(profile,'username')){
      const handle=required(root,'[data-profile-overview-username]');
      const username=String(profile.username||'').trim().replace(/^@/,'');
      handle.textContent=username?`@${username}`:'';
      handle.hidden=!username;
      root.classList.toggle('has-profile-username',Boolean(username));
    }
    if(Object.prototype.hasOwnProperty.call(profile,'location')){
      const location=String(profile.location||'').trim();
      const locationElement=required(root,'[data-profile-overview-location]');
      required(root,'[data-profile-overview-location-value]').textContent=location;
      locationElement.hidden=!location;
      root.classList.toggle('has-profile-location',Boolean(location));
    }
    if(Object.prototype.hasOwnProperty.call(profile,'bio')){
      const bio=String(profile.bio||'').trim();
      required(root,'[data-profile-overview-bio]').textContent=bio;
      root.classList.toggle('has-profile-bio',Boolean(bio));
    }
    if(Object.prototype.hasOwnProperty.call(profile,'statistics')){
      const statistics=profile.statistics;
      if(!statistics||typeof statistics!=='object'||Array.isArray(statistics)){
        throw new TypeError('Profile overview statistics must be an object.');
      }
      for(const [key,value] of Object.entries(statistics)){
        if(!allowedStatistics.has(key))throw new TypeError(`Unsupported profile overview statistic: ${key}.`);
        required(root,`[data-profile-overview-stat="${key}"] strong`).textContent=String(value??'—');
      }
    }

    root.classList.toggle('has-profile-details',Boolean(
      root.classList.contains('has-profile-location')
      ||root.classList.contains('has-profile-bio')
    ));
  }

  window.DEVMATCH_PROFILE_OVERVIEW=Object.freeze({render});
})();
