(function(){
  'use strict';

  const digits=value=>String(value??'').replace(/\D/g,'');
  const format=value=>digits(value).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  const attachedInputs=new WeakSet();

  function formatInput(input){
    const previous=input.value;
    const selectionStart=typeof input.selectionStart==='number'?input.selectionStart:previous.length;
    const digitsBeforeCaret=digits(previous.slice(0,selectionStart)).length;
    const formatted=format(previous);
    if(previous===formatted)return;
    input.value=formatted;
    if(typeof input.setSelectionRange==='function'){
      let cursor=0;
      if(digitsBeforeCaret){
        let digitsSeen=0;
        for(let index=0;index<formatted.length;index++){
          if(/\d/.test(formatted[index])){
            digitsSeen++;
            if(digitsSeen===digitsBeforeCaret){
              cursor=index+1;
              break;
            }
          }
        }
      }
      input.setSelectionRange(cursor,cursor);
    }
  }

  function attach(input){
    if(!input||typeof input.addEventListener!=='function'||attachedInputs.has(input))return;
    attachedInputs.add(input);
    formatInput(input);
    input.addEventListener('input',()=>formatInput(input));
  }

  window.devMatchMoneyInput=Object.freeze({digits,format,formatInput,attach});
  document.querySelectorAll('[data-money-input]').forEach(attach);
})();
