const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const rendererSource=fs.readFileSync(path.join(root,'assets/js/profile-overview.js'),'utf8');

class FakeElement{
  constructor(){
    this.nodeType=1;
    this.textContent='';
    this.hidden=false;
    this.dataset={};
    this.children=[];
    this.attributes={};
    this.classList={
      values:new Set(),
      toggle(name,enabled){enabled?this.values.add(name):this.values.delete(name);},
      contains(name){return this.values.has(name);}
    };
  }
  hasAttribute(name){return name==='data-profile-overview';}
  querySelector(selector){return this.selectors?.[selector]||null;}
  replaceChildren(...children){this.children=children;}
  setAttribute(name,value){this.attributes[name]=value;}
  addEventListener(){}
}

function createRenderer(){
  const rootElement=new FakeElement();
  const status=new FakeElement();
  const statusLabel=new FakeElement();
  status.selectors={span:statusLabel};
  const selectors={
    '[data-profile-overview-avatar]':new FakeElement(),
    '[data-profile-overview-name]':new FakeElement(),
    '[data-profile-overview-status]':status,
    '[data-profile-overview-username]':new FakeElement(),
    '[data-profile-overview-location]':new FakeElement(),
    '[data-profile-overview-location-value]':new FakeElement(),
    '[data-profile-overview-bio]':new FakeElement(),
    '[data-profile-overview-stat="views"] strong':new FakeElement(),
    '[data-profile-overview-stat="favorites"] strong':new FakeElement(),
    '[data-profile-overview-stat="rating"] strong':new FakeElement()
  };
  rootElement.selectors=selectors;
  const window={};
  vm.runInNewContext(rendererSource,{
    window,
    URL,
    document:{createElement:()=>new FakeElement()}
  });
  return {render:window.DEVMATCH_PROFILE_OVERVIEW.render,root:rootElement,selectors,statusLabel};
}

test('shared profile overview renders the requested owner and keeps unavailable avatar URLs local',()=>{
  const {render,root,selectors,statusLabel}=createRenderer();
  render(root,{
    role:'client',
    name:'Client profile owner',
    username:'client.owner',
    avatar:'https://images.example.test/avatar.png',
    initials:'CO',
    availability:'Open for hiring',
    location:'Jakarta, Indonesia',
    bio:'The requested client profile bio.',
    industry:'Not part of the overview.',
    statistics:{views:'1.2k',favorites:'4',rating:'4.9'}
  });

  assert.equal(root.dataset.profileRole,'client');
  assert.equal(selectors['[data-profile-overview-name]'].textContent,'Client profile owner');
  assert.equal(selectors['[data-profile-overview-avatar]'].textContent,'CO');
  assert.equal(selectors['[data-profile-overview-avatar]'].children.length,0);
  assert.equal(statusLabel.textContent,'Open for hiring');
  assert.equal(selectors['[data-profile-overview-username]'].textContent,'@client.owner');
  assert.equal(selectors['[data-profile-overview-location-value]'].textContent,'Jakarta, Indonesia');
  assert.equal(selectors['[data-profile-overview-bio]'].textContent,'The requested client profile bio.');
  assert.equal(selectors['[data-profile-overview-stat="views"] strong'].textContent,'1.2k');
  assert.equal(selectors['[data-profile-overview-stat="favorites"] strong'].textContent,'4');
  assert.equal(selectors['[data-profile-overview-stat="rating"] strong'].textContent,'4.9');
  assert.equal(root.classList.contains('has-profile-details'),true);
});

test('overview renderer rejects unsupported account roles and statistics',()=>{
  const {render,root}=createRenderer();
  assert.throws(()=>render(root,{role:'visitor'}),/role must be developer or client/);
  assert.throws(()=>render(root,{statistics:{industry:'hidden'}}),/Unsupported profile overview statistic/);
});

test('all profile pages use the shared overview renderer and landscape-only desktop styling',()=>{
  for(const file of ['assets/js/my-profile.js','assets/js/developer-profile.js','assets/js/client-profile.js']){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    assert.match(source,/DEVMATCH_PROFILE_OVERVIEW\.render/);
  }
  const css=fs.readFileSync(path.join(root,'assets/css/profile-overview.css'),'utf8');
  assert.match(css,/@media\s*\(orientation:\s*landscape\)/);
  assert.doesNotMatch(css,/@media\s*\(orientation:\s*portrait\)/);
  assert.match(css,/\.profile-overview \.identity-meta\{display:none\}/);
});

test('desktop overview removes only its outer card surface',()=>{
  const css=fs.readFileSync(path.join(root,'assets/css/profile-overview.css'),'utf8');
  const desktopRules=css.slice(css.indexOf('@media (orientation:landscape){'),css.indexOf('@media (orientation:landscape) and'));
  assert.match(desktopRules,/\.profile-overview\{[^}]*background:transparent;[^}]*border:0;[^}]*border-radius:0;[^}]*box-shadow:none;/);
  assert.doesNotMatch(desktopRules,/\.profile-card/);
  assert.match(desktopRules,/\.profile-overview \.profile-cover\{display:none\}/);
  assert.match(desktopRules,/\.profile-overview \.identity-body\{[^}]*grid-template-columns:var\(--profile-overview-avatar-size\) minmax\(0,1fr\)/);
  assert.match(desktopRules,/\.profile-overview \.identity-name-block\{[^}]*display:flex;[^}]*align-items:center/);
  assert.match(desktopRules,/\.profile-overview \.availability-badge\{font-size:10px\}/);
  assert.match(desktopRules,/\.profile-overview \.mobile-profile-stat\{[^}]*display:flex;[^}]*align-items:center/);
  assert.match(desktopRules,/\.profile-overview \.mobile-profile-location\{[^}]*display:flex;[^}]*align-items:center/);
  assert.match(desktopRules,/\.profile-overview \.mobile-profile-stat\{[^}]*font-size:clamp\(16px,1\.2vw,18px\)/);
});

test('all profile pages use the same symmetric rating star icon',()=>{
  const expectedPath='M12 2.5 14.9 8.3 21.3 9.2 16.65 13.75 17.75 20.2 12 17.15 6.25 20.2 7.35 13.75 2.7 9.2 9.1 8.3 12 2.5Z';
  for(const file of ['devmatch-my-profile.html','devmatch-developer-profile.html','devmatch-client-profile.html']){
    const html=fs.readFileSync(path.join(root,file),'utf8');
    assert.ok(html.includes(expectedPath),`${file} should use the shared rating star shape`);
  }
});
