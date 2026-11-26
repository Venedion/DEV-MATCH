const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const logoFiles=[
  'devmatch-settings.html',
  'devmatch-my-profile.html',
  'devmatch-chat.html',
  'devmatch-landing.html',
  'assets/js/my-profile.js',
  'assets/js/client-profile.js'
];
const bubbleOutline='M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2';
const handsetPath='M17.5 14.4c-.3-.1-1.8-.9-2.1-1';
const handsetTransform='transform="translate(3.6 3.6) scale(.7)"';

test('WhatsApp logo uses the outlined bubble and handset across profile, settings, chat, and landing',()=>{
  for(const file of logoFiles){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    assert.ok(source.includes(bubbleOutline),`${file} should use the WhatsApp bubble outline`);
    assert.ok(source.includes('stroke="currentColor" stroke-width="1.8"'),`${file} should stroke the bubble in the brand color`);
    assert.ok(source.includes(handsetPath),`${file} should include the handset mark`);
    assert.ok(source.includes(handsetTransform),`${file} should keep the handset light and proportional`);
  }
});
