const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const context={window:{}};
vm.runInNewContext(fs.readFileSync('assets/js/profile-specialties.js','utf8'),context);
const specialties=context.window.devMatchProfileSpecialties;

test('normalizes selected specializations and replaces Other with the account custom value',()=>{
  const result=specialties.normalize({
    specialty:['Full-stack','Other','Frontend','Other',''],
    specialtyOther:'Makan'
  });
  assert.deepEqual(Array.from(result),['Full-stack','Makan','Frontend']);
  assert.equal(specialties.getDetails('Makan').description,'Tell us more');
});

test('accepts a legacy single specialization string and falls back for unknown labels',()=>{
  assert.deepEqual(Array.from(specialties.normalize({specialty:'Backend'})),['Backend']);
  assert.equal(specialties.getDetails('Custom specialty').description,'Tell us more');
});
