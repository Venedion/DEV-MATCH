(function(global){
  'use strict';

  const details={
    'Full-stack':{description:'Front + back end',icon:'<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>'},
    Frontend:{description:'Web interfaces',icon:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>'},
    Backend:{description:'APIs & databases',icon:'<path d="M6 3v6m0 4v8M12 3v3m0 4v11M18 3v9m0 4v5M3 9h6m0 1h6m0 2h6m-6 4h6"/>'},
    'UI/UX':{description:'Design & research',icon:'<path d="m15 5 4 4M4 20l4-.8L19.2 8a2.8 2.8 0 0 0-4-4L4 15.2 4 20z"/>'},
    Mobile:{description:'Android & iOS',icon:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/>'},
    'Game Dev':{description:'Unity, Roblox...',icon:'<path d="m7 7 10 0a4 4 0 0 1 3.8 5.2l-1.2 4a2 2 0 0 1-3.3.9L14 15H10l-2.3 2.1a2 2 0 0 1-3.3-.9l-1.2-4A4 4 0 0 1 7 7z"/><path d="M7 10v4m-2-2h4m7-1h.01M17 13h.01"/>'},
    Other:{description:'Tell us more',icon:'<path d="M12 5v14m-7-7h14"/>'}
  };

  function normalize(profile){
    const values=Array.isArray(profile&&profile.specialty)
      ?profile.specialty
      :typeof(profile&&profile.specialty)==='string'?[profile.specialty]:[];
    const other=typeof(profile.specialtyOther)==='string'?profile.specialtyOther.trim():'';
    const normalized=values.map(value=>String(value).trim()).filter(Boolean)
      .map(value=>value.toLowerCase()==='other'&&other?other:value);
    return normalized.filter((value,index)=>normalized.findIndex(item=>item.toLowerCase()===value.toLowerCase())===index);
  }

  function getDetails(value){
    const key=Object.keys(details).find(item=>item.toLowerCase()===String(value).trim().toLowerCase());
    return key?details[key]:details.Other;
  }

  global.devMatchProfileSpecialties={normalize,getDetails};
})(window);
