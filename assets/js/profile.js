const params=new URLSearchParams(window.location.search);
const role=params.get('role')==='client'?'client':'dev';
const isDeveloper=role==='dev';
const draftKey='devmatch-profile-draft';
const draft=JSON.parse(sessionStorage.getItem(draftKey)||'{}');
const profile={
  displayName:'',
  country:'Indonesia',
  city:'',
  gender:'',
  birthday:'',
  specialty:['Full-stack'],
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
let nextExperienceId=0;
const experienceFiles=new Map();
const fields=document.getElementById('stepFields');
const form=document.getElementById('profileForm');
const error=document.getElementById('formError');
const steps=[...document.querySelectorAll('[data-step-item]')];
const content=[
  {
    title:isDeveloper?'Let’s set up your developer profile':'Let’s set up your client profile',
    intro:isDeveloper?'Clients see this information on your profile and project cards.':'Developers see this information when you share a project request.',
    fields:()=>`
      <div class="field"><label class="field-label" for="displayName">Display name</label><input class="control" id="displayName" name="displayName" autocomplete="name" maxlength="60" required placeholder="Your name" value="${escapeHtml(profile.displayName)}"></div>
      <div class="field two-fields">
        <div><label class="field-label" for="country">Country</label><select class="control" id="country" name="country"><option>Indonesia</option><option>Malaysia</option><option>Singapore</option><option>Other</option></select></div>
        <div><label class="field-label" for="city">City / Region</label><input class="control" id="city" name="city" maxlength="80" placeholder="Medan, Sumatera Utara" value="${escapeHtml(profile.city)}"></div>
      </div>
      <div class="field"><span class="field-label">Gender</span><div class="gender-options">${['Male','Female','Prefer not to say'].map(value=>`<button class="choice" type="button" data-gender="${value}" aria-pressed="${profile.gender===value}">${value}</button>`).join('')}</div></div>
      <div class="field"><label class="field-label" for="birthdayTrigger">Birthday</label><div class="birthday-picker" id="birthdayPicker"><input id="birthday" name="birthday" type="hidden" value="${escapeHtml(profile.birthday)}"><button class="control birthday-trigger" id="birthdayTrigger" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="birthdayCalendar"><span id="birthdayValue">${formatBirthday(profile.birthday)||'Select your birthday'}</span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg></button><div class="birthday-calendar" id="birthdayCalendar" role="dialog" aria-label="Choose your birthday" hidden><header class="calendar-heading"><button class="calendar-month" type="button" data-calendar-month aria-live="polite"></button><div class="calendar-navigation"><button type="button" data-calendar-nav="-1" aria-label="Previous month">‹</button><button type="button" data-calendar-nav="1" aria-label="Next month">›</button></div></header><div class="calendar-weekdays" aria-hidden="true"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div><div class="calendar-days" id="birthdayDays" role="group" aria-label="Dates"></div><footer class="calendar-footer"><button type="button" data-calendar-clear>Clear</button><button type="button" data-calendar-today>Today</button></footer></div></div><p class="field-hint">Only your age range is shown publicly.</p></div>`
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
        <p class="upload-note">Demo: selected files are not uploaded. Re-select them after leaving or reloading this page.</p>
      </div>`:`
      <div class="field"><label class="field-label" for="project">Project details</label><textarea class="control" id="project" maxlength="700" placeholder="Describe the features, audience, and goals for your project">${escapeHtml(profile.project)}</textarea></div>
      <div class="field"><label class="field-label" for="skills">Preferred skills or technology (optional)</label><input class="control" id="skills" maxlength="160" placeholder="e.g. Website, React, online payments" value="${escapeHtml(profile.skills)}"></div>`
  },
  {
    title:'Add contact & links',
    intro:'Add optional ways for people to contact you or view your work.',
    fields:()=>`
      <div class="field"><label class="field-label" for="whatsapp">WhatsApp number <span class="optional-hint">Optional</span></label><input class="control" id="whatsapp" inputmode="tel" autocomplete="tel" placeholder="+62 812 3456 7890" value="${escapeHtml(profile.whatsapp)}"><p class="field-hint">Leave blank if you prefer not to share your number.</p></div>
      <div class="field"><label class="field-label" for="website">Website or portfolio (optional)</label><input class="control" id="website" type="url" placeholder="https://example.com" value="${escapeHtml(profile.website)}"></div>
      <div class="field"><label class="field-label" for="instagram">Instagram (optional)</label><input class="control" id="instagram" type="url" placeholder="https://instagram.com/username" value="${escapeHtml(profile.instagram)}"></div>`
  }
];

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
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
let calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
function renderBirthdayCalendar(){
  const calendar=document.getElementById('birthdayCalendar');
  const days=document.getElementById('birthdayDays');
  if(!calendar||!days)return;
  const year=calendarMonth.getFullYear();
  const month=calendarMonth.getMonth();
  const selectedValue=document.getElementById('birthday').value;
  const selectedDate=parseDateValue(selectedValue);
  const today=new Date();
  const firstWeekday=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const daysInPreviousMonth=new Date(year,month,0).getDate();
  document.querySelector('[data-calendar-month]').textContent=calendarMonth.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const buttons=[];
  for(let index=0;index<42;index++){
    const dayOffset=index-firstWeekday+1;
    let day=dayOffset;
    let dayMonth=month;
    let dayYear=year;
    let outside='';
    if(dayOffset<1){
      day=daysInPreviousMonth+dayOffset;
      dayMonth=month-1;
      outside=' outside';
    }else if(dayOffset>daysInMonth){
      day=dayOffset-daysInMonth;
      dayMonth=month+1;
      outside=' outside';
    }
    const date=new Date(dayYear,dayMonth,day);
    const value=birthdayDateValue(date);
    const isFuture=date>new Date(today.getFullYear(),today.getMonth(),today.getDate());
    const selected=selectedValue===value;
    const isToday=value===birthdayDateValue(today);
    const classes=`calendar-day${outside}${selected?' selected':''}${isToday?' today':''}`;
    buttons.push(`<button class="${classes}" type="button" data-calendar-date="${value}" aria-label="${date.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}"${selected?' aria-pressed="true"':''}${isFuture?' disabled':''}>${day}</button>`);
  }
  days.innerHTML=buttons.join('');
  const nextMonth=new Date(year,month+1,1);
  document.querySelector('[data-calendar-nav="1"]').disabled=nextMonth>new Date(today.getFullYear(),today.getMonth(),1);
}
function setBirthday(value){
  const input=document.getElementById('birthday');
  const display=document.getElementById('birthdayValue');
  if(!input||!display)return;
  input.value=value;
  profile.birthday=value;
  display.textContent=formatBirthday(value)||'Select your birthday';
  sessionStorage.setItem(draftKey,JSON.stringify({...draft,...profile,role}));
  renderBirthdayCalendar();
}
function setBirthdayCalendarOpen(open){
  const calendar=document.getElementById('birthdayCalendar');
  const trigger=document.getElementById('birthdayTrigger');
  if(!calendar||!trigger)return;
  calendar.hidden=!open;
  trigger.setAttribute('aria-expanded',String(open));
  if(open){
    const selected=parseDateValue(document.getElementById('birthday').value);
    const initial=selected||new Date();
    calendarMonth=new Date(initial.getFullYear(),initial.getMonth(),1);
    renderBirthdayCalendar();
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
  const previewLabels=isDeveloper?[...profile.specialty.slice(0,2),...(profile.specialty.length>2?['+'+(profile.specialty.length-2)]:[]),profile.availability]:[profile.industry,'Client'];
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
  const current=content[step];
  document.getElementById('formTitle').textContent=current.title;
  document.getElementById('formIntro').textContent=current.intro;
  document.getElementById('stepPill').textContent='Step '+(step+1);
  document.getElementById('progressLabel').textContent='Step '+(step+1)+' of 4';
  document.getElementById('progressBar').style.width=((step+1)*25)+'%';
  document.getElementById('continueLabel').textContent=step===3?'Finish profile':'Continue';
  document.getElementById('skipButton').textContent=step===3?'Finish later':'Skip for now';
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
  updatePreview();
}

function saveCurrentFields(){
  const read=(id)=>document.getElementById(id)?.value.trim()||'';
  if(step===0){
    profile.displayName=read('displayName');
    profile.country=read('country')||'Indonesia';
    profile.city=read('city');
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
    profile.whatsapp=read('whatsapp');
    profile.website=read('website');
    profile.instagram=read('instagram');
  }
  sessionStorage.setItem(draftKey,JSON.stringify({...draft,...profile,role}));
  updatePreview();
}

function finish(){
  const age=profile.birthday?Math.max(0,Math.floor((Date.now()-new Date(profile.birthday).getTime())/(365.2425*24*60*60*1000))):null;
  const saved={...profile,role,ageRange:age===null?'':age<18?'Under 18':age<25?'18–24':age<35?'25–34':age<45?'35–44':'45+'};
  delete saved.birthday;
  localStorage.setItem('devmatch-profile-'+role,JSON.stringify(saved));
  sessionStorage.removeItem(draftKey);
  window.location.href='devmatch-complete.html?role='+role;
}

document.getElementById('stepFields').addEventListener('input',event=>{
  const target=event.target;
  const entryElement=target.closest('[data-experience-id]');
  if(entryElement&&target.dataset.experienceField){
    const entry=profile.experiences.find(item=>item.id===entryElement.dataset.experienceId);
    if(entry)entry[target.dataset.experienceField]=target.value;
    return;
  }
  if(target.id&&Object.prototype.hasOwnProperty.call(profile,target.id))profile[target.id]=target.value;
  if(target.id==='displayName'||target.id==='city'||target.id==='country')updatePreview();
});
document.getElementById('stepFields').addEventListener('change',event=>{
  const target=event.target;
  const entryElement=target.closest('[data-experience-id]');
  if(entryElement&&target.matches('[data-experience-file]')){
    const entry=profile.experiences.find(item=>item.id===entryElement.dataset.experienceId);
    if(entry){
      const files=[...target.files];
      experienceFiles.set(entry.id,files);
      entry.files=files.map(file=>file.name);
      entryElement.querySelector('[data-file-name]').textContent=entry.files.join(', ')||'PDF, DOC, DOCX, JPG, or PNG';
      sessionStorage.setItem(draftKey,JSON.stringify({...draft,...profile,role}));
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
document.getElementById('stepFields').addEventListener('click',event=>{
  const gender=event.target.closest('[data-gender]');
  const availability=event.target.closest('[data-availability]');
  const specialty=event.target.closest('[data-specialty]');
  const addExperience=event.target.closest('[data-add-experience]');
  const removeExperience=event.target.closest('[data-remove-experience]');
  const birthdayTrigger=event.target.closest('#birthdayTrigger');
  const calendarNavigation=event.target.closest('[data-calendar-nav]');
  const calendarDate=event.target.closest('[data-calendar-date]');
  const clearBirthday=event.target.closest('[data-calendar-clear]');
  const chooseToday=event.target.closest('[data-calendar-today]');
  if(birthdayTrigger){
    setBirthdayCalendarOpen(document.getElementById('birthdayCalendar').hidden);
    return;
  }
  if(calendarNavigation){
    calendarMonth.setMonth(calendarMonth.getMonth()+Number(calendarNavigation.dataset.calendarNav));
    renderBirthdayCalendar();
    return;
  }
  if(calendarDate&&!calendarDate.disabled){
    setBirthday(calendarDate.dataset.calendarDate);
    setBirthdayCalendarOpen(false);
    document.getElementById('birthdayTrigger').focus();
    return;
  }
  if(clearBirthday){
    setBirthday('');
    setBirthdayCalendarOpen(false);
    document.getElementById('birthdayTrigger').focus();
    return;
  }
  if(chooseToday){
    setBirthday(birthdayDateValue(new Date()));
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
  }
  if(specialty){
    const value=specialty.dataset.specialty;
    profile.specialty=profile.specialty.includes(value)
      ?profile.specialty.filter(item=>item!==value)
      :[...profile.specialty,value];
    specialty.setAttribute('aria-pressed',String(profile.specialty.includes(value)));
    updatePreview();
  }
  if(availability){
    profile.availability=availability.dataset.availability;
    document.querySelectorAll('[data-availability]').forEach(button=>button.setAttribute('aria-pressed',String(button===availability)));
    updatePreview();
  }
});
document.addEventListener('click',event=>{
  const picker=document.getElementById('birthdayPicker');
  if(picker&&!picker.contains(event.target))setBirthdayCalendarOpen(false);
});
document.addEventListener('keydown',event=>{
  const calendar=document.getElementById('birthdayCalendar');
  if(!calendar||calendar.hidden)return;
  if(event.key==='Escape'){
    setBirthdayCalendarOpen(false);
    document.getElementById('birthdayTrigger').focus();
    return;
  }
  const dayButton=event.target.closest?.('[data-calendar-date]');
  if(!dayButton)return;
  const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
  if(!offset)return;
  event.preventDefault();
  const date=parseDateValue(dayButton.dataset.calendarDate);
  date.setDate(date.getDate()+offset);
  const targetMonth=new Date(date.getFullYear(),date.getMonth(),1);
  if(targetMonth.getTime()!==calendarMonth.getTime()){
    calendarMonth=targetMonth;
    renderBirthdayCalendar();
  }
  document.querySelector(`[data-calendar-date="${birthdayDateValue(date)}"]:not(:disabled)`)?.focus();
});
form.addEventListener('submit',event=>{
  event.preventDefault();
  saveCurrentFields();
  if(step===0&&!profile.displayName){
    error.textContent='Please enter your display name to continue.';
    document.getElementById('displayName').focus();
    return;
  }
  if(step<content.length-1){
    step++;
    render();
  }else finish();
});
document.getElementById('skipButton').addEventListener('click',()=>{
  saveCurrentFields();
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
  nextExperienceId=profile.experiences.reduce((max,entry)=>Math.max(max,Number(entry.id)||0),0);
}
render();
