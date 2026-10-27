const heart='<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
const eye='<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const wa='<svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20l1.2-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>';
const pin='<svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';
const P=[
 {t:'Website',c:'COMPANY PROFILE',ago:'1h ago',n:'Restaurant Website Development',d:'Modern responsive website for a restaurant business — menu, reservations and maps.',pl:'Starting from',p:'Rp 3.500.000',by:'Rizky Aditya',i:'RA',v:'245',f:'32',bg:'#f3e6d6'},
 {t:'Web App',c:'POS',ago:'3h ago',n:'Kasir Pintar — Café POS',d:'Cloud POS with multi-branch stock, shift reports and QRIS-ready checkout.',pl:'Fixed price',p:'Rp 6.000.000',by:'Kevin Tanoto',i:'KT',v:'1.9k',f:'128',bg:'#e4e6fb'},
 {t:'Android / iOS',c:'BOOKING',ago:'Yesterday',n:'Klinik Booking App',d:'Patient booking with doctor schedules and WhatsApp appointment reminders.',pl:'Custom quote',p:'Rp 3.000.000 — Rp 7.000.000',by:'Daniel Kurniawan',i:'DK',v:'1.3k',f:'86',bg:'#dcecfb'},
 {t:'Website',c:'E-COMMERCE',ago:'2d ago',n:'LUMA Fashion Store',d:'Headless e-commerce storefront with promo engine and courier integrations.',pl:'Negotiable',p:'Rp 8.000.000',by:'Nadia Putri',i:'NP',v:'980',f:'64',bg:'#fbe3e8'}];
const D=[
 {n:'Rizky Aditya',i:'RA',l:'Medan, Indonesia',s:['Open for hiring','s-ok'],r:'Full-stack',d:'Business websites and POS systems for Indonesian SMEs. 5 years shipping Laravel + React.',k:['React','Laravel','MySQL','Figma'],x:['18','4.2k','312']},
 {n:'Sarah Nasution',i:'SN',l:'Jakarta, Indonesia',s:['Freelance','s-free'],r:'UI/UX',d:'Product designer crafting clean interfaces and design systems for startups.',k:['Figma','Framer','Webflow','UX'],x:['24','6.8k','540']},
 {n:'Daniel Kurniawan',i:'DK',l:'Surabaya, Indonesia',s:['Busy','s-busy'],r:'Mobile',d:'Flutter specialist — booking, delivery and loyalty apps with offline-first sync.',k:['Flutter','Kotlin','Firebase','Swift'],x:['11','2.9k','204']},
 {n:'Kevin Tanoto',i:'KT',l:'Bandung, Indonesia',s:['Open for hiring','s-ok'],r:'Backend',d:'APIs, payments and scalable infra. Clean, documented, deploy-ready code.',k:['Go','Node.js','Redis','Docker'],x:['15','3.1k','188']}];
const types=['All projects','Website','Web App','Android / iOS','Desktop App'];
let cur='All projects';
function renderProjects(){
  document.getElementById('chips').innerHTML=types.map(t=>`<button class="chip" aria-pressed="${t===cur}" data-t="${t}">${t}</button>`).join('');
  const list=P.filter(p=>cur==='All projects'||p.t===cur);
  document.getElementById('projGrid').innerHTML=list.length?list.map(p=>`<article class="card"><button class="heart" aria-pressed="false" aria-label="Save project">${heart}</button><div class="thumb" style="background:${p.bg}"><span class="type">${p.t}</span><div class="mock"><i style="width:22%"></i><div style="flex:1;display:grid;gap:6px;align-content:start"><i style="height:10px;width:60%"></i><i style="height:36px"></i><i style="height:10px;width:80%"></i></div></div></div><div class="pbody"><div class="meta"><span>${p.c}</span><span>${p.ago}</span></div><h3>${p.n}</h3><p>${p.d}</p><div class="price"><small>${p.pl}</small><b>${p.p}</b></div><div class="by"><span class="av">${p.i}</span>${p.by}<div class="n"><span>${eye}${p.v}</span><span>${heart}${p.f}</span></div></div></div></article>`).join(''):'<p style="grid-column:1/-1;color:var(--muted)">No projects in this category yet. Check back soon or explore all projects.</p>';
}
document.getElementById('chips').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(b){cur=b.dataset.t;renderProjects()}});
document.getElementById('projGrid').addEventListener('click',e=>{const h=e.target.closest('.heart');if(h)h.setAttribute('aria-pressed',h.getAttribute('aria-pressed')!=='true')});
document.getElementById('devGrid').innerHTML=D.map(d=>`<article class="card dcard"><button class="heart" aria-pressed="false" aria-label="Save developer">${heart}</button><div class="dh"><span class="av">${d.i}</span><div><b>${d.n}</b><span>${pin}${d.l}</span></div></div><div class="tags"><span class="status ${d.s[1]}">● ${d.s[0]}</span><span class="t">${d.r}</span></div><p>${d.d}</p><div class="tags">${d.k.map(k=>`<span class="m">${k}</span>`).join('')}</div><div class="dstats"><div><b>${d.x[0]}</b><small>Projects</small></div><div><b>${d.x[1]}</b><small>Views</small></div><div><b>${d.x[2]}</b><small>Favorites</small></div></div><div class="acts"><a class="btn ghost sm2" href="#">View Profile</a><a class="btn sm2" href="#">${wa}Contact</a></div></article>`).join('');
document.getElementById('devGrid').addEventListener('click',e=>{const h=e.target.closest('.heart');if(h)h.setAttribute('aria-pressed',h.getAttribute('aria-pressed')!=='true')});
function setMode(m){
  const dev=m==='dev';
  document.getElementById('m-dev').setAttribute('aria-pressed',dev);document.getElementById('m-cli').setAttribute('aria-pressed',!dev);
  document.getElementById('p-dev').classList.toggle('on',dev);document.getElementById('p-cli').classList.toggle('on',!dev);
  document.getElementById('h-dev').classList.toggle('dim',!dev);document.getElementById('h-cli').classList.toggle('dim',dev);
  document.getElementById('loginLink').href='devmatch-auth.html?mode=login&role='+(dev?'dev':'client');
  document.getElementById('startLink').href='devmatch-role.html?role='+(dev?'dev':'client');
}
document.getElementById('m-dev').onclick=()=>setMode('dev');
document.getElementById('m-cli').onclick=()=>setMode('cli');
document.getElementById('p-dev').onmouseenter=()=>setMode('dev');
document.getElementById('p-cli').onmouseenter=()=>setMode('cli');
renderProjects();
