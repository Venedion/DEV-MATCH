const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const context={window:{},document:{querySelectorAll:()=>[]}};
vm.runInNewContext(fs.readFileSync('assets/js/money-input.js','utf8'),context);
const moneyInput=context.window.devMatchMoneyInput;

test('formats Rupiah amounts with Indonesian thousands separators',()=>{
  assert.equal(moneyInput.format('1000000'),'1.000.000');
  assert.equal(moneyInput.format('100000'),'100.000');
  assert.equal(moneyInput.format('Rp 1.000.000'),'1.000.000');
  assert.equal(moneyInput.digits('1.000.000'),'1000000');
});

test('formats edited values while keeping the caret at the same digit',()=>{
  const listeners={};
  const input={
    value:'1234',
    selectionStart:2,
    addEventListener(type,listener){listeners[type]=listener;},
    setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
  };
  moneyInput.attach(input);
  listeners.input();
  assert.equal(input.value,'1.234');
  assert.equal(input.selectionStart,3);
});
