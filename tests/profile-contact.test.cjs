const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../assets/js/profile-contact.js'),'utf8');
const myProfileSource=fs.readFileSync(path.join(__dirname,'../assets/js/my-profile.js'),'utf8');
const clientProfileSource=fs.readFileSync(path.join(__dirname,'../assets/js/client-profile.js'),'utf8');
const developerProfileSource=fs.readFileSync(path.join(__dirname,'../assets/js/developer-profile.js'),'utf8');
const profileCss=fs.readFileSync(path.join(__dirname,'../assets/css/my-profile.css'),'utf8');
const context={window:{},URL};
vm.runInNewContext(source,context);
const contact=context.window.DEVMATCH_PROFILE_CONTACT;

test('WhatsApp helpers normalize dial codes and reject a leading zero',()=>{
  assert.equal(
    JSON.stringify(contact.dialCodes.map(({dialCode,flag})=>[dialCode,flag])),
    JSON.stringify([['62','🇮🇩'],['60','🇲🇾'],['65','🇸🇬']])
  );
  assert.equal(contact.combineWhatsappNumber('62','08123456789'),'628123456789');
  assert.deepEqual(
    {...contact.splitWhatsappNumber('+628123456789','', 'Indonesia')},
    {dialCode:'62',number:'8123456789'}
  );
  assert.deepEqual(
    {...contact.splitWhatsappNumber('812345678','60','Malaysia')},
    {dialCode:'60',number:'812345678'}
  );
  assert.equal(contact.dialCodeForCountry('Singapore'),'65');
});

test('Instagram helpers normalize legacy profile links and build safe username links',()=>{
  assert.equal(contact.normalizeInstagramUsername('https://www.instagram.com/hello.world/?igsh=abc'),'hello.world');
  assert.equal(contact.instagramUrl('@hello_world'),'https://www.instagram.com/hello_world/');
  assert.equal(contact.isValidInstagramUsername('hello.world'),true);
  assert.equal(contact.instagramUrl('https://evil.example/username'),'');
  assert.equal(contact.isValidInstagramUsername('hello world'),false);
});

test('Direct Message links disable only on the owner profile',()=>{
  const attributes=new Map([['href','old-url']]);
  const classes=new Set();
  const link={
    href:'old-url',
    classList:{
      toggle(name,enabled){
        if(enabled)classes.add(name);
        else classes.delete(name);
      }
    },
    setAttribute(name,value){attributes.set(name,value);},
    removeAttribute(name){
      attributes.delete(name);
      if(name==='href')this.href='';
    }
  };

  contact.configureDirectMessageLink(link,'chat-url',true);
  assert.equal(link.href,'');
  assert.equal(attributes.get('aria-disabled'),'true');
  assert.equal(attributes.get('tabindex'),'-1');
  assert.equal(attributes.get('title'),'You cannot message yourself.');
  assert.equal(classes.has('disabled'),true);

  contact.configureDirectMessageLink(link,'chat-url',false);
  assert.equal(link.href,'chat-url');
  assert.equal(attributes.has('aria-disabled'),false);
  assert.equal(attributes.has('tabindex'),false);
  assert.equal(attributes.has('title'),false);
  assert.equal(classes.has('disabled'),false);
});

test('Profile routes disable direct messaging only when the authenticated user owns the profile',()=>{
  assert.match(myProfileSource,/configureDirectMessageLink\(document\.getElementById\('directMessageLink'\),chatUrl,true\)/);
  assert.match(clientProfileSource,/Boolean\(user&&user\.id===client\.id\)/);
  assert.match(developerProfileSource,/const isOwnProfile=Boolean\(user&&user\.id===person\.id\)/);
  assert.equal((developerProfileSource.match(/configureDirectMessageLink\(/g)||[]).length,1);
  assert.match(profileCss,/\.contact-message\.disabled,[\s\S]*?pointer-events:none/);
});
