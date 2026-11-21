const params=new URLSearchParams(window.location.search);
const role=params.get('role')==='client'?'client':'dev';
const isDeveloper=role==='dev';
const draftKey='devmatch-profile-draft';
const storedDraft=JSON.parse(sessionStorage.getItem(draftKey)||'{}');
const cachedWorkspace=JSON.parse(localStorage.getItem('devmatch-profile-'+role)||'{}');
const draft={...cachedWorkspace,...(storedDraft.role===role?storedDraft:{})};
const profile={
  username:'',
  displayName:'',
  country:'Indonesia',
  city:'',
  gender:'',
  birthday:'',
  specialty:['Full-stack'],
  specialtyOther:'',
  availability:'Open for hiring',
  experience:'3 years',
  experiences:[],
  skills:'',
  bio:'',
  industry:'',
  project:'',
  whatsapp:'',
  website:'',
  instagram:''
};
let step=0;
let basicInfoValidationAttempted=false;
let nextExperienceId=0;
let locationRegionsByCountry={Indonesia:[],Malaysia:[],Singapore:[]};
let locationOptionsError='';
let activeLocationGroup=null;
let suppressLocationFocusOpen=false;
const experienceFiles=new Map();
const locationPickerCountries=new Set(['Indonesia','Malaysia','Singapore']);
const fields=document.getElementById('stepFields');
const form=document.getElementById('profileForm');
const error=document.getElementById('formError');
const steps=[...document.querySelectorAll('[data-step-item]')];
const content=[
  {
    title:isDeveloper?'Let’s set up your developer profile':'Let’s set up your client profile',
    intro:isDeveloper?'Clients see this information on your profile and project cards.':'Developers see this information when you share a project request.',
    fields:()=>`
      <div class="field"><label class="field-label" for="displayName">Display name <span class="required-mark" aria-hidden="true">*</span></label><input class="control" id="displayName" name="displayName" autocomplete="name" maxlength="60" aria-describedby="displayNameError" required placeholder="Your name" value="${escapeHtml(profile.displayName)}"><p class="field-error" id="displayNameError" hidden>Please enter your display name.</p></div>
      <div class="field two-fields country-location-fields">
        <div><label class="field-label" for="country">Country <span class="required-mark" aria-hidden="true">*</span></label><select class="control" id="country" name="country" aria-describedby="countryError" required><option>Indonesia</option><option>Malaysia</option><option>Singapore</option></select><p class="field-error" id="countryError" hidden>Please select a country.</p></div>
        ${renderLocationField()}
      </div>
      <div class="field"><span class="field-label">Gender <span class="required-mark" aria-hidden="true">*</span></span><div class="gender-options" role="group" aria-label="Gender" aria-describedby="genderError">${['Male','Female','Prefer not to say'].map(value=>`<button class="choice" type="button" data-gender="${value}" aria-pressed="${profile.gender===value}">${value}</button>`).join('')}</div><p class="field-error" id="genderError" hidden>Please select your gender.</p></div>
      <div class="field"><label class="field-label" for="birthdayTrigger">Birthday <span class="required-mark" aria-hidden="true">*</span></label><div class="birthday-picker" id="birthdayPicker"><input id="birthday" name="birthday" type="hidden" value="${escapeHtml(profile.birthday)}"><button class="control birthday-trigger" id="birthdayTrigger" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="birthdayCalendar" aria-describedby="birthdayError"><span id="birthdayValue">${formatBirthday(profile.birthday)||'Select your birthday'}</span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg></button><div class="birthday-calendar" id="birthdayCalendar" role="dialog" aria-label="Choose your birthday" hidden><div class="calendar-wheels" id="birthdayWheels"><div class="calendar-wheel" role="listbox" aria-label="Birth day" data-calendar-wheel="day" tabindex="0"></div><div class="calendar-wheel" role="listbox" aria-label="Birth month" data-calendar-wheel="month" tabindex="0"></div><div class="calendar-wheel" role="listbox" aria-label="Birth year" data-calendar-wheel="year" tabindex="0"></div><div class="calendar-wheel-selection" aria-hidden="true"></div></div><footer class="calendar-footer"><button type="button" data-calendar-clear>Clear</button><button type="button" data-calendar-save>Save</button></footer></div></div><p class="field-error" id="birthdayError" hidden>Please select your birthday.</p><p class="field-hint">Only your age range is shown publicly.</p></div>`
  },
  {
    title:isDeveloper?'What do you specialize in?':'What kind of work do you need?',
    intro:isDeveloper?'Help clients quickly understand your services and availability.':'Tell developers a little about the project you want to build.',
    fields:()=>isDeveloper?`
      <div class="field">
        <span class="field-label">Specialization <span class="optional-hint">Select all that apply</span></span>
        <div class="specialty-grid" role="group" aria-label="Choose one or more specializations">
          <button class="specialty-card" type="button" data-specialty="Full-stack" aria-pressed="${profile.specialty.includes('Full-stack')}"><svg viewBox="0 0 24 24"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/></svg><b>Full-stack</b><small>Front + back end</small></button>
          <button class="specialty-card" type="button" data-specialty="Frontend" aria-pressed="${profile.specialty.includes('Frontend')}"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg><b>Frontend</b><small>Web interfaces</small></button>
          <button class="specialty-card" type="button" data-specialty="Backend" aria-pressed="${profile.specialty.includes('Backend')}"><svg viewBox="0 0 24 24"><path d="M6 3v6m0 4v8M12 3v3m0 4v11M18 3v9m0 4v5M3 9h6m0 1h6m0 2h6m-6 4h6"/></svg><b>Backend</b><small>APIs &amp; databases</small></button>
          <button class="specialty-card" type="button" data-specialty="UI/UX" aria-pressed="${profile.specialty.includes('UI/UX')}"><svg viewBox="0 0 24 24"><path d="m15 5 4 4M4 20l4-.8L19.2 8a2.8 2.8 0 0 0-4-4L4 15.2 4 20z"/></svg><b>UI/UX</b><small>Design &amp; research</small></button>
          <button class="specialty-card" type="button" data-specialty="Mobile" aria-pressed="${profile.specialty.includes('Mobile')}"><svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/></svg><b>Mobile</b><small>Android &amp; iOS</small></button>
          <button class="specialty-card" type="button" data-specialty="Game Dev" aria-pressed="${profile.specialty.includes('Game Dev')}"><svg viewBox="0 0 24 24"><path d="m7 7 10 0a4 4 0 0 1 3.8 5.2l-1.2 4a2 2 0 0 1-3.3.9L14 15H10l-2.3 2.1a2 2 0 0 1-3.3-.9l-1.2-4A4 4 0 0 1 7 7z"/><path d="M7 10v4m-2-2h4m7-1h.01M17 13h.01"/></svg><b>Game Dev</b><small>Unity, Roblox...</small></button>
          <button class="specialty-card" type="button" data-specialty="Other" aria-pressed="${profile.specialty.includes('Other')}"><svg viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg><b>Other</b><small>Tell us more</small></button>
        </div>
        <div class="field specialty-other-field"${profile.specialty.includes('Other')?'':' hidden'}>
          <label class="field-label" for="specialtyOther">What is your specialization?</label>
          <input class="control" id="specialtyOther" aria-describedby="specialtyOtherError" maxlength="60" placeholder="Enter your specialization" value="${escapeHtml(profile.specialtyOther)}">
          <p class="specialty-other-error" id="specialtyOtherError" role="alert" hidden>Please enter your other specialization.</p>
        </div>
      </div>
      <div class="field">
        <span class="field-label">Current status</span>
        <div class="status-grid" role="group" aria-label="Choose your availability">
          <button class="status-card ready" type="button" data-availability="Open for hiring" aria-pressed="${profile.availability==='Open for hiring'}"><span class="status-radio"></span><span class="status-name">Ready for work</span><span class="status-badge ready-badge">● Open for hiring</span></button>
          <button class="status-card" type="button" data-availability="Freelance" aria-pressed="${profile.availability==='Freelance'}"><span class="status-radio"></span><span class="status-name">Select projects</span><span class="status-badge freelance-badge">● Freelance</span></button>
          <button class="status-card" type="button" data-availability="Busy" aria-pressed="${profile.availability==='Busy'}"><span class="status-radio"></span><span class="status-name">Limited time</span><span class="status-badge busy-badge">● Busy</span></button>
          <button class="status-card" type="button" data-availability="Not available" aria-pressed="${profile.availability==='Not available'}"><span class="status-radio"></span><span class="status-name">Not taking work</span><span class="status-badge unavailable-badge">● Not available</span></button>
        </div>
      </div>
      <div class="field"><label class="field-label" for="experience">Experience</label><select class="control" id="experience"><option value="">Choose experience</option>${['1 year','2 years','3 years','4 years','5 years','6 years','7+ years'].map(value=>`<option${profile.experience===value?' selected':''}>${value}</option>`).join('')}</select></div>`:`
      <div class="field"><label class="field-label" for="industry">Business or industry</label><input class="control" id="industry" maxlength="80" placeholder="e.g. Food &amp; beverage" value="${escapeHtml(profile.industry)}"></div>
      <div class="field"><label class="field-label" for="project">What are you looking to build?</label><textarea class="control" id="project" maxlength="500" placeholder="A short description of your idea">${escapeHtml(profile.project)}</textarea></div>`
  },
  {
    title:isDeveloper?'Showcase your skills & bio':'Tell developers about your project',
    intro:isDeveloper?'Add a few skills and a short introduction to your work.':'Add a short project brief to help developers understand your needs.',
    fields:()=>isDeveloper?`
      <div class="field"><label class="field-label" for="skills">Skills</label><input class="control" id="skills" maxlength="160" placeholder="React, Figma, Node.js" value="${escapeHtml(profile.skills)}"></div>
      <div class="field"><label class="field-label" for="bio">Bio</label><textarea class="control" id="bio" maxlength="500" placeholder="What do you build, and what kind of projects do you enjoy?">${escapeHtml(profile.bio)}</textarea><p class="field-hint">A short introduction to your work and experience.</p></div>
      <div class="field experience-section">
        <div class="section-heading"><span class="field-label">Experience <span class="optional-hint">Optional</span></span><button class="add-experience" type="button" data-add-experience>+ Add experience</button></div>
        <p class="experience-hint">Add a role, then attach a supporting file or a link.</p>
        <div class="experience-list">${renderExperienceEntries()}</div>
        <p class="upload-note">Supporting files are stored privately and are only available to you.</p>
      </div>`:`
      <div class="field"><label class="field-label" for="project">Project details</label><textarea class="control" id="project" maxlength="700" placeholder="Describe the features, audience, and goals for your project">${escapeHtml(profile.project)}</textarea></div>
      <div class="field"><label class="field-label" for="skills">Preferred skills or technology (optional)</label><input class="control" id="skills" maxlength="160" placeholder="e.g. Website, React, online payments" value="${escapeHtml(profile.skills)}"></div>`
  },
  {
    title:'Add contact & links',
    intro:'Add optional ways for people to contact you or view your work.',
    fields:()=>`
      <div class="field"><label class="field-label" for="whatsapp">WhatsApp number <span class="optional-hint">Optional</span></label><input class="control" id="whatsapp" type="tel" inputmode="numeric" autocomplete="tel" pattern="[0-9]*" maxlength="20" placeholder="6281234567890" value="${escapeHtml(profile.whatsapp)}"><p class="field-hint">Enter digits only. Leave blank if you prefer not to share your number.</p></div>
      <div class="field"><label class="field-label" for="website">Website or portfolio (optional)</label><input class="control" id="website" type="url" placeholder="https://example.com" value="${escapeHtml(profile.website)}"></div>
      <div class="field"><label class="field-label" for="instagram">Instagram (optional)</label><input class="control" id="instagram" type="url" placeholder="https://instagram.com/username" value="${escapeHtml(profile.instagram)}"></div>`
  }
];

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function renderLocationField(){
  const labels=getLocationLabels(profile.country);
  const fieldLabel=`<label class="field-label" for="city">${labels.parent}, ${labels.child} <span class="required-mark" aria-hidden="true">*</span></label>`;
  if(!locationPickerCountries.has(profile.country)){
    return `<div class="location-field" id="locationField">${fieldLabel}<input class="control" id="city" name="city" maxlength="80" aria-describedby="cityError" required placeholder="City, Region" value="${escapeHtml(profile.city)}"><p class="field-error" id="cityError" hidden>Please enter your city or region.</p></div>`;
  }
  const hint=locationOptionsError||`Search and select a ${labels.parent.toLocaleLowerCase()}, then a ${labels.child.toLocaleLowerCase()}.`;
  const errorMessage=`Please select a ${labels.parent.toLocaleLowerCase()} and ${labels.child.toLocaleLowerCase()}.`;
  const placeholder=`Search a ${labels.parent.toLocaleLowerCase()} or ${labels.child.toLocaleLowerCase()}`;
  return `<div class="location-field" id="locationField">${fieldLabel}<div class="location-picker" id="locationPicker"><input class="control" id="city" name="city" maxlength="80" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="locationOptions" aria-describedby="cityError locationHint" required placeholder="${placeholder}" value="${escapeHtml(profile.city)}"><button class="location-toggle" type="button" aria-label="Open location options" aria-expanded="false" aria-controls="locationOptions"><svg class="location-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></button><div class="location-options" id="locationOptions" role="listbox" aria-label="${labels.parent} and ${labels.child} options" hidden></div></div><p class="field-error" id="cityError" hidden>${errorMessage}</p><p class="field-hint" id="locationHint">${escapeHtml(hint)}</p></div>`;
}

function getLocationLabels(country){
  if(country==='Malaysia')return {parent:'State',parentPlural:'states',child:'City',childPlural:'cities'};
  if(country==='Singapore')return {parent:'Region',parentPlural:'regions',child:'Area',childPlural:'areas'};
  return {parent:'Province',parentPlural:'provinces',child:'City',childPlural:'cities'};
}

function isLocationPickerCountry(country){
  return locationPickerCountries.has(country);
}

function renderLocationOptions(query=''){
  const options=document.getElementById('locationOptions');
  if(!options)return;
  const locationRegions=locationRegionsByCountry[profile.country]||[];
  const labels=getLocationLabels(profile.country);
  const normalizedQuery=query.trim().toLocaleLowerCase();
  if(locationOptionsError){
    options.innerHTML=`<div class="location-options-message" role="status">${escapeHtml(locationOptionsError)}</div>`;
    return;
  }
  if(!locationRegions.length){
    options.innerHTML='<div class="location-options-message" role="status">Loading location options…</div>';
    return;
  }

  const entries=activeLocationGroup
    ?activeLocationGroup.cities.map(city=>({type:'city',code:city.code,name:city.name}))
    :locationRegions.map(group=>({
      type:'group',
      code:group.code,
      name:group.name,
      aliases:[group.localName].filter(Boolean)
    }));
  const matches=entries.filter(entry=>[entry.name,...(entry.aliases||[])]
    .some(name=>name.toLocaleLowerCase().includes(normalizedQuery)))
    .sort((first,second)=>first.name.localeCompare(second.name,'en',{sensitivity:'base'}));
  const backButton=activeLocationGroup
    ?`<button class="location-back" type="button" role="option" data-location-back>All ${labels.parentPlural}</button>`
    :'';
  const heading=activeLocationGroup
    ?`<div class="location-options-heading" role="presentation">${labels.childPlural[0].toLocaleUpperCase()+labels.childPlural.slice(1)} in ${escapeHtml(activeLocationGroup.name)}</div>`
    :'';
  const resultOptions=matches.map(entry=>`<button class="location-option" type="button" role="option" aria-selected="false" data-location-option="${entry.type}" data-location-code="${escapeHtml(entry.code)}">${escapeHtml(entry.name)}</button>`).join('');
  options.innerHTML=`${backButton}${heading}${resultOptions||'<div class="location-options-message" role="status">No matches found</div>'}`;
}

function openLocationPicker(input){
  if(!isLocationPickerCountry(profile.country))return;
  const picker=document.getElementById('locationPicker');
  const options=document.getElementById('locationOptions');
  if(!picker||picker.classList.contains('open'))return;
  activeLocationGroup=null;
  input.value='';
  const labels=getLocationLabels(profile.country);
  input.placeholder=`Search a ${labels.parent.toLocaleLowerCase()}`;
  input.setAttribute('aria-label',`Search a ${labels.parent.toLocaleLowerCase()}`);
  renderLocationOptions();
  picker.classList.add('open');
  options.hidden=false;
  input.setAttribute('aria-expanded','true');
  picker.querySelector('.location-toggle')?.setAttribute('aria-expanded','true');
  picker.querySelector('.location-toggle')?.setAttribute('aria-label',`Close ${labels.parent.toLocaleLowerCase()} and ${labels.child.toLocaleLowerCase()} options`);
}

function closeLocationPicker({restoreValue=true}={}){
  const picker=document.getElementById('locationPicker');
  const input=document.getElementById('city');
  const options=document.getElementById('locationOptions');
  if(!picker||!input||!options)return;
  picker.classList.remove('open');
  options.hidden=true;
  input.setAttribute('aria-expanded','false');
  picker.querySelector('.location-toggle')?.setAttribute('aria-expanded','false');
  picker.querySelector('.location-toggle')?.setAttribute('aria-label','Open location options');
  input.removeAttribute('aria-label');
  const labels=getLocationLabels(profile.country);
  input.placeholder=`Search a ${labels.parent.toLocaleLowerCase()} or ${labels.child.toLocaleLowerCase()}`;
  input.value=restoreValue?profile.city:'';
  activeLocationGroup=null;
}

function focusLocationInputWithoutOpening(input){
  suppressLocationFocusOpen=true;
  input.focus();
  closeLocationPicker();
  setTimeout(()=>{suppressLocationFocusOpen=false;},0);
}

function saveProfileDraft(){
  sessionStorage.setItem(draftKey,JSON.stringify({...draft,...profile,role}));
}

function canonicalLocation(value,country){
  const normalized=String(value||'').trim().toLocaleLowerCase();
  if(!normalized)return '';
  const matches=[];
  (locationRegionsByCountry[country]||[]).forEach(group=>{
    group.cities.forEach(city=>{
      const canonical=`${group.name}, ${city.name}`;
      const cityNames=country==='Indonesia'&&group.code==='31'
        ?[city.name,`Administrasi ${city.name}`]
        :[city.name];
      const locationFormats=cityNames.flatMap(name=>[
        `${group.name}, ${name}`,
        `${name}, ${group.localName||group.name}`,
        `${name}, ${group.name}`
      ]);
      if(locationFormats.some(value=>normalized===value.toLocaleLowerCase())
        ||cityNames.some(name=>normalized===name.toLocaleLowerCase())){
        matches.push(canonical);
      }
    });
  });
  return matches.length===1?matches[0]:'';
}

function selectLocationOption(option){
  const input=document.getElementById('city');
  if(!input)return;
  if(option.hasAttribute('data-location-back')){
    activeLocationGroup=null;
    input.value='';
    const labels=getLocationLabels(profile.country);
    input.placeholder=`Search a ${labels.parent.toLocaleLowerCase()}`;
    input.setAttribute('aria-label',`Search a ${labels.parent.toLocaleLowerCase()}`);
    renderLocationOptions();
    input.focus();
    return;
  }
  if(option.dataset.locationOption==='group'){
    activeLocationGroup=(locationRegionsByCountry[profile.country]||[])
      .find(group=>group.code===option.dataset.locationCode)||null;
    if(!activeLocationGroup)return;
    const labels=getLocationLabels(profile.country);
    input.value='';
    input.placeholder=`Search ${labels.childPlural} in ${activeLocationGroup.name}`;
    input.setAttribute('aria-label',`Search ${labels.childPlural} in ${activeLocationGroup.name}`);
    renderLocationOptions();
    input.focus();
    return;
  }
  if(option.dataset.locationOption==='city'&&activeLocationGroup){
    const city=activeLocationGroup.cities.find(item=>item.code===option.dataset.locationCode);
    if(!city)return;
    profile.city=`${activeLocationGroup.name}, ${city.name}`;
    saveProfileDraft();
    closeLocationPicker();
    updatePreview();
  }
}

function parseDateValue(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||'');
  return match?new Date(Number(match[1]),Number(match[2])-1,Number(match[3])):null;
}
function formatBirthday(value){
  const date=parseDateValue(value);
  return date?`${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`:'';
}
function birthdayDateValue(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
let birthdayWheelDate=new Date();
let birthdayWheelScrollTimer=null;
let birthdayPendingWheel=null;
const birthdayWheelAnimations=new WeakMap();
function renderBirthdayWheelColumn(type,values){
  const wheel=document.querySelector(`[data-calendar-wheel="${type}"]`);
  if(!wheel)return false;
  const currentValues=[...wheel.querySelectorAll('[data-calendar-wheel-option]')].map(option=>option.dataset.value);
  if(currentValues.length===values.length&&currentValues.every((value,index)=>value===String(values[index])))return false;
  const label=value=>type==='day'?String(value).padStart(2,'0'):type==='month'?new Date(2000,value,1).toLocaleDateString('en-US',{month:'long'}):String(value);
  wheel.innerHTML=values.map(value=>`<button class="calendar-wheel-option" type="button" role="option" tabindex="-1" data-calendar-wheel-option="${type}" data-value="${value}" aria-selected="false">${label(value)}</button>`).join('');
  return true;
}
function centerBirthdayWheelOption(type,value,{animate=false}={}){
  const wheel=document.querySelector(`[data-calendar-wheel="${type}"]`);
  const option=wheel?.querySelector(`[data-calendar-wheel-option="${type}"][data-value="${value}"]`);
  if(option){
    const top=option.offsetTop+option.offsetHeight/2-wheel.clientHeight/2;
    const activeFrame=birthdayWheelAnimations.get(wheel);
    if(activeFrame!==undefined)cancelAnimationFrame(activeFrame);
    birthdayWheelAnimations.delete(wheel);
    if(!animate||window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      wheel.scrollTop=top;
      return;
    }
    const start=wheel.scrollTop;
    const distance=top-start;
    if(Math.abs(distance)<1){
      wheel.scrollTop=top;
      return;
    }
    const initialStep=Math.min(Math.abs(distance)*.12,6);
    wheel.scrollTop=start+Math.sign(distance)*initialStep;
    const animationStart=wheel.scrollTop;
    const remainingDistance=top-animationStart;
    const startTime=performance.now();
    const duration=280;
    const animateFrame=now=>{
      const progress=Math.min((now-startTime)/duration,1);
      const eased=1-Math.pow(1-progress,3);
      wheel.scrollTop=animationStart+remainingDistance*eased;
      if(progress<1){
        birthdayWheelAnimations.set(wheel,requestAnimationFrame(animateFrame));
      }else{
        wheel.scrollTop=top;
        birthdayWheelAnimations.delete(wheel);
      }
    };
    birthdayWheelAnimations.set(wheel,requestAnimationFrame(animateFrame));
  }
}
function centeredBirthdayWheelOption(wheel){
  const center=wheel.getBoundingClientRect().top+wheel.clientHeight/2;
  return [...wheel.querySelectorAll('[data-calendar-wheel-option]')].reduce((closest,option)=>{
    const optionCenter=option.getBoundingClientRect().top+option.offsetHeight/2;
    return Math.abs(optionCenter-center)<Math.abs(closest.getBoundingClientRect().top+closest.offsetHeight/2-center)?option:closest;
  });
}
function flushBirthdayWheelScroll(){
  clearTimeout(birthdayWheelScrollTimer);
  birthdayWheelScrollTimer=null;
  const wheel=birthdayPendingWheel;
  birthdayPendingWheel=null;
  if(wheel&&!document.getElementById('birthdayCalendar')?.hidden){
    const nearest=centeredBirthdayWheelOption(wheel);
    if(nearest)selectBirthdayWheelOption(nearest);
  }
}
function renderBirthdayCalendar({center=false}={}){
  const calendar=document.getElementById('birthdayCalendar');
  if(!calendar)return;
  const today=new Date();
  const year=birthdayWheelDate.getFullYear();
  const month=birthdayWheelDate.getMonth();
  const day=birthdayWheelDate.getDate();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const maxDay=year===today.getFullYear()&&month===today.getMonth()?today.getDate():daysInMonth;
  const months=Array.from({length:year===today.getFullYear()?today.getMonth()+1:12},(_,index)=>index);
  const days=Array.from({length:maxDay},(_,index)=>index+1);
  const maxBirthYear=today.getFullYear()-18;
  const years=Array.from({length:maxBirthYear-1900+1},(_,index)=>maxBirthYear-index);
  const columns=[['day',days,day],['month',months,month],['year',years,year]];
  columns.forEach(([type,values,selected])=>{
    const changed=renderBirthdayWheelColumn(type,values);
    const wheel=document.querySelector(`[data-calendar-wheel="${type}"]`);
    wheel?.querySelectorAll('[data-calendar-wheel-option]').forEach(option=>{
      const isSelected=Number(option.dataset.value)===selected;
      option.setAttribute('aria-selected',String(isSelected));
      option.classList.toggle('selected',isSelected);
    });
    if(center||changed)centerBirthdayWheelOption(type,selected);
  });
}
function setBirthday(value){
  const input=document.getElementById('birthday');
  const display=document.getElementById('birthdayValue');
  if(!input||!display)return;
  input.value=value;
  profile.birthday=value;
  display.textContent=formatBirthday(value)||'Select your birthday';
  sessionStorage.setItem(draftKey,JSON.stringify({...draft,...profile,role}));
  const date=parseDateValue(value);
  if(date)birthdayWheelDate=date;
  if(!document.getElementById('birthdayCalendar')?.hidden)renderBirthdayCalendar();
  if(step===0&&basicInfoValidationAttempted)validateBasicInfo({focus:false});
}
function selectBirthdayWheelOption(option){
  const type=option.dataset.calendarWheelOption;
  const value=Number(option.dataset.value);
  let year=birthdayWheelDate.getFullYear();
  let month=birthdayWheelDate.getMonth();
  let day=birthdayWheelDate.getDate();
  if(type==='day')day=value;
  else if(type==='month')month=value;
  else if(type==='year')year=value;
  else return;
  const today=new Date();
  if(year===today.getFullYear())month=Math.min(month,today.getMonth());
  day=Math.min(day,new Date(year,month+1,0).getDate());
  if(year===today.getFullYear()&&month===today.getMonth())day=Math.min(day,today.getDate());
  const nextDate=new Date(year,month,day);
  if(nextDate.getTime()===birthdayWheelDate.getTime())return;
  birthdayWheelDate=nextDate;
  renderBirthdayCalendar();
  centerBirthdayWheelOption(type,type==='day'?day:type==='month'?month:year,{animate:true});
}
function setBirthdayCalendarOpen(open){
  const calendar=document.getElementById('birthdayCalendar');
  const trigger=document.getElementById('birthdayTrigger');
  if(!calendar||!trigger)return;
  const picker=calendar.closest('.birthday-picker');
  trigger.setAttribute('aria-expanded',String(open));
  if(!open){
    calendar.hidden=true;
    picker?.classList.remove('opens-up');
    clearTimeout(birthdayWheelScrollTimer);
    birthdayWheelScrollTimer=null;
    birthdayPendingWheel=null;
    document.querySelectorAll('[data-calendar-wheel]').forEach(wheel=>{
      const activeFrame=birthdayWheelAnimations.get(wheel);
      if(activeFrame!==undefined)cancelAnimationFrame(activeFrame);
      birthdayWheelAnimations.delete(wheel);
    });
  }
  if(open){
    const today=new Date();
    const selected=parseDateValue(document.getElementById('birthday').value);
    const maxBirthYear=today.getFullYear()-18;
    const initial=selected||new Date(maxBirthYear,today.getMonth(),today.getDate());
    const year=Math.min(initial.getFullYear(),maxBirthYear);
    const day=Math.min(initial.getDate(),new Date(year,initial.getMonth()+1,0).getDate());
    birthdayWheelDate=new Date(year,initial.getMonth(),day);
    renderBirthdayCalendar({center:true});
    calendar.hidden=false;
    calendar.style.visibility='hidden';
    const spaceBelow=window.innerHeight-trigger.getBoundingClientRect().bottom;
    const opensUp=spaceBelow<calendar.getBoundingClientRect().height+8;
    picker?.classList.toggle('opens-up',opensUp);
    calendar.style.removeProperty('visibility');
  }
}

function renderExperienceEntries(){
  return profile.experiences.map((entry,index)=>`
    <fieldset class="experience-entry" data-experience-id="${entry.id}">
      <div class="experience-entry-heading"><b>Experience ${index+1}</b><button type="button" class="remove-experience" data-remove-experience="${entry.id}" aria-label="Remove experience ${index+1}">Remove</button></div>
      <div class="two-fields">
        <div><label class="field-label" for="experience-title-${entry.id}">Job title</label><input class="control" id="experience-title-${entry.id}" data-experience-field="title" maxlength="80" placeholder="e.g. Frontend Developer" value="${escapeHtml(entry.title||'')}"></div>
        <div><label class="field-label" for="experience-company-${entry.id}">Company</label><input class="control" id="experience-company-${entry.id}" data-experience-field="company" maxlength="80" placeholder="Company name" value="${escapeHtml(entry.company||'')}"></div>
      </div>
      <div class="field"><label class="field-label" for="experience-period-${entry.id}">Period</label><input class="control" id="experience-period-${entry.id}" data-experience-field="period" maxlength="60" placeholder="e.g. 2022 – Present" value="${escapeHtml(entry.period||'')}"></div>
      <div class="field"><label class="field-label" for="experience-link-${entry.id}">Experience link (optional)</label><input class="control" id="experience-link-${entry.id}" data-experience-field="link" type="url" placeholder="https://example.com" value="${escapeHtml(entry.link||'')}"></div>
      <div class="field"><label class="field-label" for="experience-file-${entry.id}">Upload supporting files (optional)</label><input class="control file-control" id="experience-file-${entry.id}" data-experience-file type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" multiple><p class="field-hint" data-file-name>${escapeHtml((entry.files||[]).join(', ')||'PDF, DOC, DOCX, JPG, or PNG')}</p></div>
    </fieldset>`).join('');
}

function updatePreview(){
  const name=profile.displayName.trim()||'Your name';
  document.getElementById('previewName').textContent=name;
  document.getElementById('previewAvatar').textContent=name==='Your name'?'DM':name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  const username=draft.username||'username';
  const location=[profile.city,profile.country].filter(Boolean).join(', ')||'Indonesia';
  document.getElementById('previewHandle').textContent='@'+username+' · '+location;
  const tags=document.getElementById('previewTags');
  tags.innerHTML='';
  const displaySpecialties=profile.specialty.map(item=>item==='Other'?(profile.specialtyOther.trim()||'Other'):item);
  const previewLabels=isDeveloper?[...displaySpecialties.slice(0,2),...(displaySpecialties.length>2?['+'+(displaySpecialties.length-2)]:[]),profile.availability]:[profile.industry,'Client'];
  previewLabels.filter(Boolean).slice(0,2).forEach((tag,index)=>{
    const pill=document.createElement('i');
    pill.textContent=tag;
    pill.classList.add('filled');
    if(isDeveloper&&index===1)pill.dataset.status=profile.availability;
    tags.append(pill);
  });
  if(!tags.children.length)tags.innerHTML='<i></i><i></i>';
}

function render(){
  basicInfoValidationAttempted=false;
  const current=content[step];
  document.getElementById('formTitle').textContent=current.title;
  document.getElementById('formIntro').textContent=current.intro;
  document.getElementById('stepPill').textContent='Step '+(step+1);
  document.getElementById('progressLabel').textContent='Step '+(step+1)+' of 4';
  document.getElementById('progressBar').style.width=((step+1)*25)+'%';
  document.getElementById('continueLabel').textContent=step===3?'Finish profile':'Continue';
  document.getElementById('skipButton').textContent=step===3?'Finish later':'Skip for now';
  document.getElementById('skipButton').hidden=step===0;
  document.getElementById('backButton').hidden=step===0;
  document.getElementById('stepTwoLabel').textContent=isDeveloper?'Specialization':'Project needs';
  document.getElementById('stepTwoHint').textContent=isDeveloper?'Role, status, experience':'Industry and project type';
  document.getElementById('stepThreeLabel').textContent=isDeveloper?'Skills & bio':'Project details';
  document.getElementById('stepThreeHint').textContent=isDeveloper?'What you’re great at':'Share your project brief';
  fields.innerHTML=current.fields();
  steps.forEach((item,index)=>{
    item.classList.toggle('active',index===step);
    item.classList.toggle('done',index<step);
  });
  error.textContent='';
  const country=document.getElementById('country');
  if(country)country.value=profile.country;
  window.initializeCustomSelects(fields);
  document.getElementById('country-trigger')?.setAttribute('aria-describedby','countryError');
  updatePreview();
}

function saveCurrentFields(){
  const read=(id)=>document.getElementById(id)?.value.trim()||'';
  if(step===0){
    profile.displayName=read('displayName');
    profile.country=read('country')||'Indonesia';
    if(!isLocationPickerCountry(profile.country))profile.city=read('city');
    profile.birthday=read('birthday');
  }else if(step===1){
    profile.experience=read('experience');
    profile.industry=read('industry');
    profile.project=read('project');
  }else if(step===2){
    profile.skills=read('skills');
    profile.bio=read('bio');
    profile.project=read('project')||profile.project;
  }else{
    profile.whatsapp=read('whatsapp').replace(/\D/g,'');
    profile.website=read('website');
    profile.instagram=read('instagram');
  }
  sessionStorage.setItem(draftKey,JSON.stringify({...draft,...profile,role}));
  updatePreview();
}

function validateOtherSpecialty(showError){
  if(!isDeveloper||step!==1)return true;
  const input=document.getElementById('specialtyOther');
  if(!input||!profile.specialty.includes('Other'))return true;
  const errorMessage=document.getElementById('specialtyOtherError');
  const isValid=Boolean(input.value.trim());
  if(showError)input.dataset.validationAttempted='true';
  input.setAttribute('aria-invalid',String(!isValid));
  errorMessage.hidden=isValid||!showError;
  return isValid;
}
function validateBasicInfo({focus=true}={}){
  const displayName=document.getElementById('displayName');
  const country=document.getElementById('country-trigger');
  const city=document.getElementById('city');
  const genderOptions=document.querySelector('.gender-options');
  const birthdayTrigger=document.getElementById('birthdayTrigger');
  const cityValue=city?.value.trim()||'';
  const checks=[
    {valid:Boolean(profile.displayName.trim()),field:displayName,errorId:'displayNameError'},
    {valid:Boolean(profile.country.trim()),field:country,errorId:'countryError'},
    {valid:Boolean(profile.city.trim())&&cityValue===profile.city.trim(),field:city,errorId:'cityError'},
    {valid:Boolean(profile.gender),field:genderOptions,errorId:'genderError',focus:genderOptions?.querySelector('button')},
    {valid:Boolean(profile.birthday),field:birthdayTrigger,errorId:'birthdayError'}
  ];
  checks.forEach(({valid,field,errorId})=>{
    const message=document.getElementById(errorId);
    if(message)message.hidden=valid;
    if(field){
      if(valid)field.removeAttribute('aria-invalid');
      else field.setAttribute('aria-invalid','true');
    }
  });
  const invalid=checks.find(check=>!check.valid);
  error.textContent='';
  if(!invalid)return true;
  if(focus)(invalid.focus||invalid.field)?.focus();
  return false;
}
async function finish(){
  if(finish.pending)return;
  finish.pending=true;
  try{
  await Promise.all(experienceFiles.values());
  const age=profile.birthday?Math.max(0,Math.floor((Date.now()-new Date(profile.birthday).getTime())/(365.2425*24*60*60*1000))):null;
  const saved={...profile,role,whatsappConnected:Boolean(profile.whatsapp),googleConnected:false,ageRange:age===null?'':age<18?'Under 18':age<25?'18–24':age<35?'25–34':age<45?'35–44':'45+'};
  delete saved.birthday;
  const backend=window.devMatchBackend;
  const user=await backend.ready;
  if(!user)throw new Error('Please log in to save your profile.');
  const row=await backend.updateWorkspaceProfile({display_name:saved.displayName,profile_data:saved,onboarding_complete:true});
  backend.cache(row,user);
  sessionStorage.setItem('devmatch-active-role',role);
  sessionStorage.removeItem(draftKey);
  window.location.href='devmatch-complete.html?role='+role;
  }catch(cause){error.textContent=cause.message||'Unable to save your profile. Please try again.';}
  finally{finish.pending=false;}
}

document.getElementById('stepFields').addEventListener('input',event=>{
  const target=event.target;
  if(target.id==='city'&&isLocationPickerCountry(profile.country)){
    renderLocationOptions(target.value);
    if(basicInfoValidationAttempted)validateBasicInfo({focus:false});
    return;
  }
  if(target.id==='whatsapp'){
    const digits=target.value.replace(/\D/g,'');
    if(target.value!==digits){
      const position=target.selectionStart;
      const removedBeforeCursor=target.value.slice(0,position).replace(/\d/g,'').length;
      target.value=digits;
      target.setSelectionRange(Math.max(0,position-removedBeforeCursor),Math.max(0,position-removedBeforeCursor));
    }
  }
  const entryElement=target.closest('[data-experience-id]');
  if(entryElement&&target.dataset.experienceField){
    const entry=profile.experiences.find(item=>item.id===entryElement.dataset.experienceId);
    if(entry)entry[target.dataset.experienceField]=target.value;
    return;
  }
  if(target.id&&Object.prototype.hasOwnProperty.call(profile,target.id))profile[target.id]=target.value;
  if(target.id==='specialtyOther'&&target.dataset.validationAttempted)validateOtherSpecialty(true);
  if(target.id==='displayName'||target.id==='city'||target.id==='country'||target.id==='specialtyOther')updatePreview();
  if(step===0&&basicInfoValidationAttempted)validateBasicInfo({focus:false});
});
document.getElementById('stepFields').addEventListener('change',event=>{
  const target=event.target;
  if(target.id==='country'){
    profile.country=target.value;
    profile.city='';
    saveProfileDraft();
    closeLocationPicker({restoreValue:false});
    const locationField=document.getElementById('locationField');
    if(locationField)locationField.outerHTML=renderLocationField();
    updatePreview();
    if(basicInfoValidationAttempted)validateBasicInfo({focus:false});
    return;
  }
  if(target.id==='city'&&isLocationPickerCountry(profile.country))return;
  const entryElement=target.closest('[data-experience-id]');
  if(entryElement&&target.matches('[data-experience-file]')){
    const entry=profile.experiences.find(item=>item.id===entryElement.dataset.experienceId);
    if(entry){
      const files=[...target.files];
      const fileNames=entryElement.querySelector('[data-file-name]');
      if(files.length){
        fileNames.textContent='Uploading files securely…';
        const upload=Promise.all(files.map(file=>window.devMatchBackend.uploadPrivateFile('experience','',file)))
          .then(uploaded=>{
            entry.filePaths=[...(entry.filePaths||[]),...uploaded.map(item=>item.path)];
            entry.files=[...(entry.files||[]),...uploaded.map(item=>item.name)];
            fileNames.textContent=entry.files.join(', ');
            sessionStorage.setItem(draftKey,JSON.stringify({...draft,...profile,role}));
          })
          .catch(cause=>{
            fileNames.textContent=cause.message||'Unable to upload supporting files.';
            throw cause;
          })
          .finally(()=>experienceFiles.delete(entry.id));
        experienceFiles.set(entry.id,upload);
        upload.catch(()=>{});
      }
    }
    return;
  }
  if(entryElement&&target.dataset.experienceField){
    const entry=profile.experiences.find(item=>item.id===entryElement.dataset.experienceId);
    if(entry)entry[target.dataset.experienceField]=target.value;
    sessionStorage.setItem(draftKey,JSON.stringify({...draft,...profile,role}));
    return;
  }
  if(target.id&&Object.prototype.hasOwnProperty.call(profile,target.id))profile[target.id]=target.value;
  updatePreview();
});
fields.addEventListener('scroll',event=>{
  const wheel=event.target.closest?.('[data-calendar-wheel]');
  if(!wheel||document.getElementById('birthdayCalendar')?.hidden)return;
  birthdayPendingWheel=wheel;
  clearTimeout(birthdayWheelScrollTimer);
  birthdayWheelScrollTimer=setTimeout(flushBirthdayWheelScroll,100);
},true);
fields.addEventListener('wheel',event=>{
  const wheel=event.target.closest?.('[data-calendar-wheel]');
  if(!wheel||event.ctrlKey||!event.deltaY||document.getElementById('birthdayCalendar')?.hidden)return;
  event.preventDefault();
  const options=[...wheel.querySelectorAll('[data-calendar-wheel-option]')];
  const selectedIndex=options.findIndex(option=>option.getAttribute('aria-selected')==='true');
  if(selectedIndex<0)return;
  const nextIndex=Math.max(0,Math.min(options.length-1,selectedIndex+Math.sign(event.deltaY)));
  if(nextIndex!==selectedIndex)selectBirthdayWheelOption(options[nextIndex]);
},{passive:false});
document.getElementById('stepFields').addEventListener('click',event=>{
  const locationOption=event.target.closest('[data-location-option], [data-location-back]');
  if(locationOption){
    event.stopPropagation();
    selectLocationOption(locationOption);
    if(step===0&&basicInfoValidationAttempted)validateBasicInfo({focus:false});
    return;
  }
  const gender=event.target.closest('[data-gender]');
  const availability=event.target.closest('[data-availability]');
  const specialty=event.target.closest('[data-specialty]');
  const addExperience=event.target.closest('[data-add-experience]');
  const removeExperience=event.target.closest('[data-remove-experience]');
  const birthdayTrigger=event.target.closest('#birthdayTrigger');
  const birthdayWheelOption=event.target.closest('[data-calendar-wheel-option]');
  const clearBirthday=event.target.closest('[data-calendar-clear]');
  const saveBirthday=event.target.closest('[data-calendar-save]');
  if(birthdayTrigger){
    setBirthdayCalendarOpen(document.getElementById('birthdayCalendar').hidden);
    return;
  }
  if(birthdayWheelOption){
    selectBirthdayWheelOption(birthdayWheelOption);
    birthdayWheelOption.closest('[data-calendar-wheel]')?.focus();
    return;
  }
  if(clearBirthday){
    setBirthday('');
    setBirthdayCalendarOpen(false);
    document.getElementById('birthdayTrigger').focus();
    return;
  }
  if(saveBirthday){
    flushBirthdayWheelScroll();
    setBirthday(birthdayDateValue(birthdayWheelDate));
    setBirthdayCalendarOpen(false);
    document.getElementById('birthdayTrigger').focus();
    return;
  }
  if(addExperience){
    profile.experiences.push({id:String(++nextExperienceId),title:'',company:'',period:'',link:'',files:[]});
    render();
    return;
  }
  if(removeExperience){
    const id=removeExperience.dataset.removeExperience;
    profile.experiences=profile.experiences.filter(entry=>entry.id!==id);
    experienceFiles.delete(id);
    sessionStorage.setItem(draftKey,JSON.stringify({...draft,...profile,role}));
    render();
    return;
  }
  if(gender){
    profile.gender=gender.dataset.gender;
    document.querySelectorAll('[data-gender]').forEach(button=>button.setAttribute('aria-pressed',String(button===gender)));
    if(step===0&&basicInfoValidationAttempted)validateBasicInfo({focus:false});
  }
  if(specialty){
    const value=specialty.dataset.specialty;
    const wasSelected=profile.specialty.includes(value);
    profile.specialty=wasSelected
      ?profile.specialty.filter(item=>item!==value)
      :[...profile.specialty,value];
    specialty.setAttribute('aria-pressed',String(profile.specialty.includes(value)));
    if(value==='Other'){
      const otherField=document.querySelector('.specialty-other-field');
      otherField.hidden=!profile.specialty.includes('Other');
      if(wasSelected){
        profile.specialtyOther='';
        const otherInput=document.getElementById('specialtyOther');
        otherInput.removeAttribute('aria-invalid');
        delete otherInput.dataset.validationAttempted;
        document.getElementById('specialtyOtherError').hidden=true;
      }
      if(!otherField.hidden)document.getElementById('specialtyOther').focus();
    }
    sessionStorage.setItem(draftKey,JSON.stringify({...draft,...profile,role}));
    updatePreview();
  }
  if(availability){
    profile.availability=availability.dataset.availability;
    document.querySelectorAll('[data-availability]').forEach(button=>button.setAttribute('aria-pressed',String(button===availability)));
    updatePreview();
  }
});
fields.addEventListener('focusin',event=>{
  if(event.target.id==='city'&&isLocationPickerCountry(profile.country)&&!suppressLocationFocusOpen){
    openLocationPicker(event.target);
  }
});
fields.addEventListener('click',event=>{
  if(!isLocationPickerCountry(profile.country))return;
  if(event.target.closest('label[for="city"]')){
    suppressLocationFocusOpen=true;
    setTimeout(()=>{suppressLocationFocusOpen=false;},0);
    return;
  }
  const toggle=event.target.closest?.('.location-toggle');
  if(toggle){
    const input=document.getElementById('city');
    if(!input)return;
    if(document.getElementById('locationPicker')?.classList.contains('open')){
      closeLocationPicker();
    }else{
      openLocationPicker(input);
      input.focus();
    }
    return;
  }
  if(event.target.id==='city')openLocationPicker(event.target);
});
fields.addEventListener('focusout',event=>{
  if(event.target.id!=='city')return;
  const picker=document.getElementById('locationPicker');
  if(!picker||picker.contains(event.relatedTarget))return;
  setTimeout(()=>{
    if(!picker.contains(document.activeElement))closeLocationPicker();
  },0);
});
fields.addEventListener('mousedown',event=>{
  if(event.target.closest('#locationOptions button'))event.preventDefault();
});
fields.addEventListener('keydown',event=>{
  const target=event.target;
  if(!isLocationPickerCountry(profile.country))return;
  if(target.id==='city'){
    if(event.key==='Escape'){
      event.preventDefault();
      closeLocationPicker();
      target.focus();
      return;
    }
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      const options=document.getElementById('locationOptions');
      if(options?.hidden)openLocationPicker(target);
      options?.querySelector('button[role="option"]')?.focus();
      return;
    }
    if(event.key==='Enter'){
      event.preventDefault();
      const firstOption=document.querySelector('#locationOptions [data-location-option]');
      firstOption?.click();
    }
    return;
  }
  const option=target.closest('#locationOptions button[role="option"]');
  if(!option)return;
  if(event.key==='Escape'){
    event.preventDefault();
    const input=document.getElementById('city');
    if(input)focusLocationInputWithoutOpening(input);
    return;
  }
  const options=[...document.querySelectorAll('#locationOptions button[role="option"]')];
  const currentIndex=options.indexOf(option);
  let nextIndex;
  if(event.key==='ArrowDown')nextIndex=Math.min(currentIndex+1,options.length-1);
  else if(event.key==='ArrowUp')nextIndex=currentIndex>0?currentIndex-1:-1;
  else if(event.key==='Home')nextIndex=0;
  else if(event.key==='End')nextIndex=options.length-1;
  else return;
  event.preventDefault();
  if(nextIndex<0)document.getElementById('city')?.focus();
  else options[nextIndex]?.focus();
});
document.addEventListener('click',event=>{
  const picker=document.getElementById('birthdayPicker');
  if(picker&&!picker.contains(event.target))setBirthdayCalendarOpen(false);
  const locationPicker=document.getElementById('locationPicker');
  if(locationPicker&&!locationPicker.contains(event.target))closeLocationPicker();
});
document.addEventListener('keydown',event=>{
  const calendar=document.getElementById('birthdayCalendar');
  if(!calendar||calendar.hidden)return;
  if(event.key==='Escape'){
    setBirthdayCalendarOpen(false);
    document.getElementById('birthdayTrigger').focus();
    return;
  }
  const wheel=event.target.closest?.('[data-calendar-wheel]');
  if(!wheel)return;
  const wheelTypes=['day','month','year'];
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    const currentIndex=wheelTypes.indexOf(wheel.dataset.calendarWheel);
    const nextIndex=currentIndex+(event.key==='ArrowRight'?1:-1);
    if(nextIndex>=0&&nextIndex<wheelTypes.length){
      event.preventDefault();
      document.querySelector(`[data-calendar-wheel="${wheelTypes[nextIndex]}"]`)?.focus();
    }
    return;
  }
  const options=[...wheel.querySelectorAll('[data-calendar-wheel-option]')];
  if(!options.length)return;
  const selected=options.findIndex(option=>option.getAttribute('aria-selected')==='true');
  let nextIndex;
  if(event.key==='ArrowDown')nextIndex=Math.min(selected+1,options.length-1);
  else if(event.key==='ArrowUp')nextIndex=Math.max(selected-1,0);
  else if(event.key==='Home')nextIndex=0;
  else if(event.key==='End')nextIndex=options.length-1;
  else return;
  event.preventDefault();
  selectBirthdayWheelOption(options[nextIndex]);
  wheel.focus();
});
form.addEventListener('submit',event=>{
  event.preventDefault();
  saveCurrentFields();
  if(step===0){
    basicInfoValidationAttempted=true;
    if(!validateBasicInfo())return;
  }
  if(step===1&&!validateOtherSpecialty(true)){
    document.getElementById('specialtyOther').focus();
    return;
  }
  if(step<content.length-1){
    step++;
    render();
  }else finish();
});
document.getElementById('skipButton').addEventListener('click',()=>{
  saveCurrentFields();
  if(step===0){
    basicInfoValidationAttempted=true;
    if(!validateBasicInfo())return;
  }
  if(step===1&&!validateOtherSpecialty(true)){
    document.getElementById('specialtyOther').focus();
    return;
  }
  if(step<content.length-1){
    step++;
    render();
  }else finish();
});
document.getElementById('backButton').addEventListener('click',()=>{
  if(step===0)return;
  saveCurrentFields();
  step--;
  render();
});

if(draft.role&&draft.role!==role)sessionStorage.removeItem(draftKey);
else{
  Object.keys(profile).forEach(key=>{
    if(key==='specialty'&&Array.isArray(draft[key]))profile[key]=draft[key];
    else if(key==='experiences'&&Array.isArray(draft[key]))profile[key]=draft[key];
    else if(typeof draft[key]==='string')profile[key]=draft[key];
  });
  if(typeof draft.instagram!=='string'&&typeof draft.social==='string')profile.instagram=draft.social;
  profile.whatsapp=profile.whatsapp.replace(/\D/g,'');
  profile.experiences=profile.experiences
    .filter(entry=>entry&&typeof entry==='object'&&!Array.isArray(entry))
    .map((entry,index)=>({...entry,id:String(index+1),files:Array.isArray(entry.files)?entry.files.map(String):[]}));
  nextExperienceId=profile.experiences.length;
}
if(!locationPickerCountries.has(profile.country)){
  profile.country='Indonesia';
  profile.city='';
}
profile.username=cachedWorkspace.username||'';
const loadLocationData=path=>fetch(path).then(response=>{
  if(!response.ok)throw new Error(`Location data request failed with status ${response.status}.`);
  return response.json();
});
Promise.all([
  loadLocationData('assets/data/indonesia-regions.json?v=20261121-location-alpha-v1'),
  loadLocationData('assets/data/malaysia-singapore-regions.json?v=20261122-malaysia-singapore-v1')
])
  .then(([indonesiaData,internationalData])=>{
    const validGroups=groups=>Array.isArray(groups)&&groups.length>0&&groups.every(group=>
      typeof group.code==='string'&&typeof group.name==='string'
      &&Array.isArray(group.cities)&&group.cities.length>0
      &&group.cities.every(city=>typeof city.code==='string'&&typeof city.name==='string'));
    if(!Array.isArray(indonesiaData.provinces)||indonesiaData.provinces.length!==38
      ||!validGroups(indonesiaData.provinces)){
      throw new Error('The Indonesian province and city list is incomplete.');
    }
    if(!internationalData.countries
      ||!validGroups(internationalData.countries.Malaysia)
      ||!validGroups(internationalData.countries.Singapore)){
      throw new Error('The Malaysia and Singapore location list is incomplete.');
    }
    locationRegionsByCountry={
      Indonesia:indonesiaData.provinces,
      Malaysia:internationalData.countries.Malaysia,
      Singapore:internationalData.countries.Singapore
    };
    profile.city=canonicalLocation(profile.city,profile.country);
    render();
  })
  .catch(cause=>{
    console.error('Unable to load location options.',cause);
    locationOptionsError='Location options could not be loaded. Please refresh the page.';
    render();
  });
