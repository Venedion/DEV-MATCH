const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../assets/js/profile-contact.js'),'utf8');
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
