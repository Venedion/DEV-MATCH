(function(){
  const optionText=option=>option.textContent.trim();

  function initializeCustomSelects(root=document){
    root.querySelectorAll('select:not([data-custom-select])').forEach(select=>{
      select.dataset.customSelect='true';
      const wrapper=document.createElement('div');
      wrapper.className='custom-select';
      select.parentNode.insertBefore(wrapper,select);
      wrapper.append(select);
      select.classList.add('custom-select-native');
      select.tabIndex=-1;
      select.setAttribute('aria-hidden','true');

      const trigger=document.createElement('button');
      trigger.className='custom-select-trigger';
      trigger.type='button';
      trigger.id=`${select.id||'select'}-trigger`;
      trigger.setAttribute('aria-haspopup','listbox');
      trigger.setAttribute('aria-expanded','false');
      const listbox=document.createElement('div');
      listbox.className='custom-select-options';
      listbox.id=`${select.id||'select'}-options`;
      listbox.setAttribute('role','listbox');
      listbox.hidden=true;
      trigger.setAttribute('aria-controls',listbox.id);

      const label=document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
      if(label){
        trigger.setAttribute('aria-label',label.textContent.trim());
        label.htmlFor=trigger.id;
      }else if(select.getAttribute('aria-label')){
        trigger.setAttribute('aria-label',select.getAttribute('aria-label'));
      }

      function renderOptions(){
        const selectedIndex=select.selectedIndex;
        const selectedOption=select.options[selectedIndex];
        trigger.disabled=select.disabled;
        const value=document.createElement('span');
        value.className='custom-select-value';
        value.textContent=selectedOption?optionText(selectedOption):'Choose an option';
        const icon=document.createElement('span');
        icon.className='custom-select-chevron';
        icon.setAttribute('aria-hidden','true');
        trigger.replaceChildren(value,icon);
        listbox.replaceChildren(...Array.from(select.options,(option,index)=>{
          const item=document.createElement('div');
          item.className='custom-select-option';
          item.id=`${listbox.id}-option-${index}`;
          item.setAttribute('role','option');
          item.setAttribute('aria-selected',String(index===selectedIndex));
          item.setAttribute('aria-disabled',String(option.disabled));
          item.tabIndex=-1;
          item.textContent=optionText(option);
          item.addEventListener('click',()=>{
            if(option.disabled)return;
            select.selectedIndex=index;
            select.dispatchEvent(new Event('change',{bubbles:true}));
            renderOptions();
            close();
            trigger.focus();
          });
          return item;
        }));
      }

      function close(){
        listbox.hidden=true;
        trigger.setAttribute('aria-expanded','false');
        wrapper.classList.remove('open');
      }

      function open(){
        if(select.disabled)return;
        document.querySelectorAll('.custom-select.open').forEach(other=>{
          other.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded','false');
          const otherList=other.querySelector('.custom-select-options');
          if(otherList)otherList.hidden=true;
          other.classList.remove('open');
        });
        listbox.hidden=false;
        trigger.setAttribute('aria-expanded','true');
        wrapper.classList.add('open');
        listbox.querySelector('[aria-selected="true"]:not([aria-disabled="true"])')?.focus();
      }

      trigger.addEventListener('click',()=>{
        if(listbox.hidden)open();
        else{
          close();
          trigger.focus();
        }
      });
      trigger.addEventListener('keydown',event=>{
        if(['ArrowDown','ArrowUp','Enter',' '].includes(event.key)){
          event.preventDefault();
          open();
        }
      });
      listbox.addEventListener('keydown',event=>{
        const options=Array.from(listbox.querySelectorAll('[role="option"]:not([aria-disabled="true"])'));
        const current=options.indexOf(document.activeElement);
        let nextIndex;
        if(event.key==='ArrowDown')nextIndex=(current+1)%options.length;
        else if(event.key==='ArrowUp')nextIndex=(current-1+options.length)%options.length;
        else if(event.key==='Home')nextIndex=0;
        else if(event.key==='End')nextIndex=options.length-1;
        else if(event.key==='Enter'||event.key===' '){
          event.preventDefault();
          document.activeElement?.click();
          return;
        }
        else if(event.key==='Escape'){
          event.preventDefault();
          close();
          trigger.focus();
          return;
        }else if(event.key==='Tab'){
          close();
          return;
        }else return;
        event.preventDefault();
        options[nextIndex]?.focus();
      });
      listbox.addEventListener('click',event=>{
        if(event.target.closest('[role="option"]'))event.stopPropagation();
      });
      select.addEventListener('change',renderOptions);
      wrapper.append(trigger,listbox);
      renderOptions();
    });
  }

  document.addEventListener('click',event=>{
    if(!event.target.closest('.custom-select')){
      document.querySelectorAll('.custom-select.open').forEach(wrapper=>{
        wrapper.querySelector('.custom-select-options').hidden=true;
        wrapper.querySelector('.custom-select-trigger').setAttribute('aria-expanded','false');
        wrapper.classList.remove('open');
      });
    }
  });
  window.initializeCustomSelects=initializeCustomSelects;
  document.addEventListener('DOMContentLoaded',()=>initializeCustomSelects());
})();
