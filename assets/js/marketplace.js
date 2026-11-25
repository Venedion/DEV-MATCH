(function () {
  'use strict';

  const main = document.querySelector('[data-marketplace]');
  const isRequestsPage = main.dataset.marketplace === 'requests';
  let projects = [];
  let requests = [];
  let catalogError = null;
  let catalogErrorMessage = 'Projects could not be loaded. Check your connection and try again.';
  let catalogLoaded = false;
  const favoritesKey = isRequestsPage ? 'devmatch-developer-project-favorites' : 'devmatch-client-project-favorites';
  if (localStorage.getItem(favoritesKey) === null) {
    const legacy = localStorage.getItem('devmatch-client-favorites');
    if (legacy !== null) localStorage.setItem(favoritesKey, legacy);
  }
  const searchInput = document.getElementById('marketSearch');
  const searchForm = document.getElementById('marketSearchForm');
  const topSearchInput = document.getElementById('topSearchInput');
  const grid = document.getElementById('projectGrid');
  const emptyState = document.getElementById('emptyState');
  const dialog = document.getElementById('projectDialog');
  const requestDetailDialog = document.getElementById('requestDetailDialog');
  const requestDetailFrame = document.getElementById('requestDetailFrame');
  const favoriteToast = document.getElementById('favoriteActionToast');
  const favoriteRemoveDialog = document.getElementById('favoriteRemoveDialog');
  const favoriteRemoveMessage = document.getElementById('favoriteRemoveMessage');
  const summary = document.getElementById('resultsSummary');
  const categoryButtons = [...document.querySelectorAll('[data-category]')];
  const loadMoreButton = document.getElementById('loadMore');
  const remainingCount = document.getElementById('remainingCount');
  const catalogStatus = document.getElementById('catalogStatus');
  const projectTabCount = document.getElementById('projectTabCount');
  const developerTabCount = document.getElementById('developerTabCount');
  const projectRequestsTabCount = document.getElementById('projectRequestsTabCount');
  const clientsTabCount = document.getElementById('clientsTabCount');
  const moneyInput=window.devMatchMoneyInput;
  const requestDetailParam = isRequestsPage
    ? new URLSearchParams(location.search).get('requestDetail')
    : null;
  function safeProjectCover(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value);
      return url.origin === 'https://yxwktllqbmhustmhdaqi.supabase.co'
        && url.pathname.startsWith('/storage/v1/object/public/project-media/')
        ? value : '';
    } catch {
      return '';
    }
  }
  let favoriteIds = readFavorites();
  const favoriteStateReady = window.devMatchBackend.ready.then(user => user
    ? window.devMatchBackend.loadFavorites()
    : null
  ).then(records => {
    if (!records) return false;
    favoriteIds = records.filter(item => item.type === 'project').map(item => item.id);
    localStorage.setItem(favoritesKey, JSON.stringify(favoriteIds));
    render();
    return true;
  }).catch(error => {
    console.error('Unable to load project favorites from Supabase.', error);
    window.alert('Unable to load favorites. Check your connection and try again.');
    return null;
  });
  let activeCategory = 'all';
  let appliedTypeFilter = 'all';
  let appliedStackFilter = 'all';
  let query = '';
  let view = 'grid';
  let visibleCount = 3;
  const scrollStateKey = `devmatch-marketplace-scroll:${location.pathname}`;
  const navigationEntry = performance.getEntriesByType('navigation')[0];
  let savedScrollState = null;
  if (navigationEntry?.type === 'reload') {
    try {
      const saved = JSON.parse(sessionStorage.getItem(scrollStateKey) || 'null');
      if (saved && Number.isFinite(saved.scrollTop) && Number.isFinite(saved.visibleCount)) {
        savedScrollState = saved;
      }
    } catch (error) {
      console.warn('Unable to restore marketplace scroll position.', error);
    }
  }
  let scrollRestorePending = savedScrollState !== null;
  let scrollSaveTimer = null;
  const budgetValues = { mode: 'all', lower: '', from: '', to: '' };
  let mobileBudgetDraft = null;
  let committedBudgetValues = { ...budgetValues };
  let rollbackIncompleteBudget = () => {};
  let resetMobileBudgetEditor = () => {};
  let suppressedProjectCardClick = null;
  function isMobileFilterPanelOpen() {
    const panel = document.getElementById('mobileFiltersPanel');
    return window.matchMedia('(max-width: 860px)').matches && Boolean(panel && !panel.hidden);
  }

  function createCheckmarkIcon() {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm5 12 4 4L19 6');
    icon.append(path);
    return icon;
  }

  const dropdownConfigs = [
    { selectId: 'typeFilter', triggerId: 'typeFilterTrigger', menuId: 'typeFilterMenu', width: 180 },
    { selectId: 'budgetFilter', triggerId: 'budgetFilterTrigger', menuId: 'budgetFilterMenu', width: 180, align: 'left', custom: true },
    { selectId: 'stackFilter', triggerId: 'stackFilterTrigger', menuId: 'stackFilterMenu', width: 180 },
    { selectId: 'sortFilter', triggerId: 'sortFilterTrigger', menuId: 'sortFilterMenu', width: 205, align: 'right' }
  ];
  const budgetModeLabels = {
    all: 'All budgets',
    'lower-than': 'Lower than...',
    'higher-than': 'Higher than...',
    range: 'Price Range'
  };
  const requestSpecializationOptions = ['Frontend', 'Backend', 'UI/UX', 'Full-stack', 'Mobile', 'Game Development'];

  function closeDropdown(menu, trigger){
    if(menu.id==='budgetFilterMenu'&&menu.matches(':popover-open'))rollbackIncompleteBudget();
    if(menu.matches(':popover-open'))menu.hidePopover();
    trigger.setAttribute('aria-expanded','false');
  }

  function isBudgetValuesValid(values){
    if(values.mode==='all')return true;
    if(values.mode==='lower-than'||values.mode==='higher-than'){
      return values.lower!==''&&Number.isFinite(Number(values.lower))&&Number(values.lower)>=0;
    }
    if(values.mode==='range'){
      const from=Number(values.from);
      const to=Number(values.to);
      return values.from!==''&&values.to!==''&&Number.isFinite(from)&&Number.isFinite(to)&&from>=0&&to>=from;
    }
    return false;
  }

  function syncDropdownLabels(){
    dropdownConfigs.forEach(({selectId,triggerId,menuId})=>{
      const select=document.getElementById(selectId);
      const trigger=document.getElementById(triggerId);
      const menu=document.getElementById(menuId);
      if(!select||!trigger||!menu)return;
      document.querySelectorAll(`.mobile-filter-options[data-select-id="${selectId}"] button`).forEach(option=>{
        option.setAttribute('aria-pressed',String(option.dataset.value===select.value));
      });
      if(selectId==='budgetFilter'){
        const values=mobileBudgetDraft||budgetValues;
        const amount=Number(values.lower);
        const from=Number(values.from);
        const to=Number(values.to);
        let label='All budgets';
        if(values.mode==='lower-than')label=values.lower?`Lower than Rp ${amount.toLocaleString('id-ID')}`:'Lower than...';
        if(values.mode==='higher-than')label=values.lower?`Higher than Rp ${amount.toLocaleString('id-ID')}`:'Higher than...';
        if(values.mode==='range'){
          const fromText=values.from?from.toLocaleString('id-ID'):'From...';
          const toText=values.to?to.toLocaleString('id-ID'):'To...';
          label=`Rp ${fromText} – ${toText}`;
        }
        trigger.querySelector('span').textContent=label;
        const showAppliedValue=window.matchMedia('(max-width: 860px)').matches
          &&Boolean(menu.closest('.mobile-budget-filter'))
          &&!menu.classList.contains('mobile-budget-editing');
        const selectedOptionLabel=values.mode==='range'?`Price Range · ${label}`:label;
        menu.querySelectorAll('[data-budget-mode]').forEach(option=>{
          const selected=option.dataset.budgetMode===values.mode;
          option.setAttribute('aria-pressed',String(selected));
          option.textContent=showAppliedValue&&selected
            ?selectedOptionLabel
            :budgetModeLabels[option.dataset.budgetMode];
        });
        return;
      }
      const selectedOption=select.selectedOptions[0];
      trigger.querySelector('span').textContent=selectedOption.textContent;
      menu.querySelectorAll('[data-value]').forEach(option=>{
        option.setAttribute('aria-checked',String(option.dataset.value===select.value));
      });
    });
  }

  function getRequestSpecialties(item){
    const values=Array.isArray(item.specialties)
      ?item.specialties
      :typeof item.specialty==='string'?[item.specialty]:[];
    return values.map(value=>String(value).trim()).filter(Boolean);
  }

  function requestMatchesSpecialization(item,selectedValue){
    const specialties=getRequestSpecialties(item);
    if(selectedValue.startsWith('other:')){
      return specialties.some(value=>value.toLowerCase()==='other')
        &&String(item.specialtyOther||'').trim().toLowerCase()===selectedValue.slice(6);
    }
    return specialties.some(value=>value.toLowerCase()===selectedValue.toLowerCase());
  }

  function updateRequiredSpecializationOptions(records){
    if(!isRequestsPage)return false;
    const select=document.getElementById('stackFilter');
    const menu=document.getElementById('stackFilterMenu');
    if(!select||!menu)return false;

    const baseOptions=requestSpecializationOptions.map(value=>({value,label:value}));
    const knownValues=new Set(baseOptions.map(option=>option.value.toLowerCase()));
    const additionalOptions=new Map();
    const customOptions=new Map();
    records.forEach(request=>{
      const specialties=getRequestSpecialties(request);
      specialties.forEach(specialty=>{
        if(specialty.toLowerCase()==='other'||knownValues.has(specialty.toLowerCase()))return;
        const key=specialty.toLowerCase();
        if(!additionalOptions.has(key))additionalOptions.set(key,{value:specialty,label:specialty});
      });
      if(specialties.some(value=>value.toLowerCase()==='other')){
        const custom=String(request.specialtyOther||'').trim();
        if(custom){
          const key=custom.toLowerCase();
          if(!customOptions.has(key)){
            customOptions.set(key,{value:`other:${key}`,label:`Other · ${custom}`});
          }
        }
      }
    });
    const options=[
      {value:'all',label:'All Expertise'},
      ...baseOptions,
      ...[...additionalOptions.values()].sort((first,second)=>first.label.localeCompare(second.label)),
      ...[...customOptions.values()].sort((first,second)=>first.label.localeCompare(second.label))
    ];
    const previousValue=select.value||'all';
    const selectedValue=options.some(option=>option.value===previousValue)?previousValue:'all';
    select.replaceChildren(...options.map(option=>{
      const element=document.createElement('option');
      element.value=option.value;
      element.textContent=option.label;
      return element;
    }));
    select.value=selectedValue;
    let selectionWasRemoved=selectedValue!==previousValue;
    if(!options.some(option=>option.value===appliedStackFilter)){
      appliedStackFilter='all';
      selectionWasRemoved=true;
    }
    menu.replaceChildren(...options.map(option=>{
      const item=document.createElement('button');
      item.type='button';
      item.setAttribute('role','menuitemradio');
      item.dataset.value=option.value;
      const label=document.createElement('span');
      label.textContent=option.label;
      item.append(label,createCheckmarkIcon());
      item.addEventListener('click',()=>{
        select.value=option.value;
        syncDropdownLabels();
        select.dispatchEvent(new Event('change',{bubbles:true}));
        closeDropdown(menu,document.getElementById('stackFilterTrigger'));
        document.getElementById('stackFilterTrigger').focus();
      });
      return item;
    }));
    const mobileOptions=document.querySelector('.mobile-filter-options[data-select-id="stackFilter"]');
    if(mobileOptions){
      mobileOptions.setAttribute('aria-label','EXPERTISE options');
      mobileOptions.replaceChildren(...options.map(option=>{
        const item=document.createElement('button');
        item.type='button';
        item.dataset.value=option.value;
        item.setAttribute('aria-pressed',String(option.value===select.value));
        const label=document.createElement('span');
        label.textContent=option.label;
        item.append(label,createCheckmarkIcon());
        item.addEventListener('click',()=>{
          select.value=option.value;
          syncDropdownLabels();
          select.dispatchEvent(new Event('change',{bubbles:true}));
        });
        return item;
      }));
    }
    syncDropdownLabels();
    return selectionWasRemoved;
  }

  function initializeDropdowns(){
    if(!document.getElementById('typeFilterTrigger'))return;
    dropdownConfigs.forEach(config=>{
      const select=document.getElementById(config.selectId);
      const trigger=document.getElementById(config.triggerId);
      const menu=document.getElementById(config.menuId);
      if(!config.custom)[...select.options].forEach(option=>{
        const item=document.createElement('button');
        item.type='button';
        item.setAttribute('role','menuitemradio');
        item.dataset.value=option.value;
        const label=document.createElement('span');
        label.textContent=option.textContent;
        item.append(label,createCheckmarkIcon());
        item.addEventListener('click',()=>{
          select.value=option.value;
          syncDropdownLabels();
          select.dispatchEvent(new Event('change',{bubbles:true}));
          closeDropdown(menu,trigger);
          trigger.focus();
        });
        menu.append(item);
      });
      trigger.addEventListener('click',event=>{
        if(config.custom&&trigger.closest('.mobile-budget-filter')
          &&window.matchMedia('(max-width: 860px)').matches){
          event.preventDefault();
          if(menu.matches(':popover-open'))menu.hidePopover();
          trigger.setAttribute('aria-expanded','false');
          ['left','top','width','min-width'].forEach(property=>menu.style.removeProperty(property));
          return;
        }
        if(menu.matches(':popover-open')){
          closeDropdown(menu,trigger);
          return;
        }
        dropdownConfigs.forEach(other=>{
          if(other===config)return;
          closeDropdown(document.getElementById(other.menuId),document.getElementById(other.triggerId));
        });
        menu.showPopover();
        const triggerBounds=trigger.getBoundingClientRect();
        const menuBounds=menu.getBoundingClientRect();
        const mobileSort=config.selectId==='sortFilter'&&window.matchMedia('(max-width: 860px)').matches;
        const preferredWidth=config.custom
          ?budgetValues.mode==='all'?165:430
          :mobileSort?Math.min(280,window.innerWidth-20):config.width;
        const menuWidth=mobileSort
          ?preferredWidth
          :Math.min(config.custom?preferredWidth:Math.max(triggerBounds.width,preferredWidth),window.innerWidth-20);
        const left=config.align==='right'
          ?Math.max(10,Math.min(triggerBounds.right-menuWidth,window.innerWidth-menuWidth-10))
          :Math.max(10,Math.min(triggerBounds.left,window.innerWidth-menuWidth-10));
        const spaceBelow=window.innerHeight-triggerBounds.bottom-8;
        const top=spaceBelow>=menuBounds.height||spaceBelow>=triggerBounds.top
          ?triggerBounds.bottom+6
          :Math.max(10,triggerBounds.top-menuBounds.height-6);
        menu.style.left=`${left}px`;
        menu.style.top=`${top}px`;
        menu.style.width=`${menuWidth}px`;
        menu.style.minWidth=config.custom?'0px':`${menuWidth}px`;
        trigger.setAttribute('aria-expanded','true');
        if(config.custom){
          const activeMode=menu.querySelector(`[data-budget-mode="${budgetValues.mode}"]`);
          activeMode?.focus({preventScroll:true});
        }else menu.querySelector(`[data-value="${select.value}"]`)?.focus({preventScroll:true});
      });
      menu.addEventListener('toggle',()=>{
        trigger.setAttribute('aria-expanded',String(menu.matches(':popover-open')));
      });
      if(!config.custom)menu.addEventListener('keydown',event=>{
        if(event.key==='Escape'){
          closeDropdown(menu,trigger);
          trigger.focus();
        }
      });
      window.addEventListener('resize',()=>closeDropdown(menu,trigger));
      window.addEventListener('scroll',event=>{
        if(!menu.contains(event.target))closeDropdown(menu,trigger);
      },{capture:true,passive:true});
    });
    const budgetMenu=document.getElementById('budgetFilterMenu');
    const budgetTrigger=document.getElementById('budgetFilterTrigger');
    const budgetSingleLabel=document.getElementById('budgetSingleValueLabel');
    const budgetSingleInput=document.getElementById('budgetSingleValue');
    const budgetRangeValues=document.getElementById('budgetRangeValues');
    const budgetFromInput=document.getElementById('budgetFromValue');
    const budgetToInput=document.getElementById('budgetToValue');
    const budgetMenuValues=document.getElementById('budgetMenuValues');
    const budgetRangeError=document.getElementById('budgetRangeError');
    const budgetRangeHint=document.getElementById('budgetRangeHint');
    const budgetSingleHeading=document.getElementById('budgetSingleValueHeading');
    const budgetLabel=budgetTrigger.closest('label');
    const mobileBudgetBreakpoint=window.matchMedia('(max-width: 860px)');
    const isMobileBudgetPanel=()=>mobileBudgetBreakpoint.matches
      &&Boolean(document.querySelector('.mobile-filter-selects')?.contains(budgetLabel));
    const budgetModeHeading=document.createElement('span');
    budgetModeHeading.className='budget-mode-heading';
    budgetModeHeading.hidden=true;
    budgetLabel.querySelector('.filter-label').append(budgetModeHeading);
    const budgetSaveError=document.createElement('p');
    budgetSaveError.className='budget-range-error';
    budgetSaveError.setAttribute('role','alert');
    budgetSaveError.hidden=true;
    const budgetSaveButton=document.createElement('button');
    budgetSaveButton.className='budget-save-filter';
    budgetSaveButton.type='button';
    const desktopSaveLabel=document.createElement('span');
    desktopSaveLabel.className='budget-save-filter-desktop';
    desktopSaveLabel.textContent='Save Filter';
    const mobileApplyLabel=document.createElement('span');
    mobileApplyLabel.className='budget-save-filter-mobile';
    mobileApplyLabel.textContent='Apply';
    budgetSaveButton.append(desktopSaveLabel,mobileApplyLabel);
    const budgetBackButton=document.createElement('button');
    budgetBackButton.className='budget-back-button';
    budgetBackButton.type='button';
    budgetBackButton.setAttribute('aria-label','Back to budget options');
    const backIcon=document.createElementNS('http://www.w3.org/2000/svg','svg');
    backIcon.setAttribute('viewBox','0 0 24 24');
    backIcon.setAttribute('aria-hidden','true');
    const backPath=document.createElementNS('http://www.w3.org/2000/svg','path');
    backPath.setAttribute('d','M19 12H5m7 7-7-7 7-7');
    backIcon.append(backPath);
    budgetBackButton.append(backIcon,document.createTextNode('Back'));
    const budgetActions=document.createElement('div');
    budgetActions.className='budget-entry-actions';
    budgetActions.append(budgetBackButton,budgetSaveButton);
    budgetMenuValues.append(budgetSaveError,budgetActions);
    budgetSingleInput.value=moneyInput.format(budgetValues.lower);
    budgetFromInput.value=moneyInput.format(budgetValues.from);
    budgetToInput.value=moneyInput.format(budgetValues.to);

    function positionBudgetMenu(){
      const triggerBounds=budgetTrigger.getBoundingClientRect();
      const preferredWidth=budgetValues.mode==='all'?165:430;
      const menuWidth=Math.min(preferredWidth,window.innerWidth-20);
      budgetMenu.style.width=`${menuWidth}px`;
      budgetMenu.style.minWidth='0px';
      const left=Math.max(10,Math.min(triggerBounds.left,window.innerWidth-menuWidth-10));
      const menuHeight=budgetMenu.getBoundingClientRect().height;
      const spaceBelow=window.innerHeight-triggerBounds.bottom-8;
      const top=spaceBelow>=menuHeight||spaceBelow>=triggerBounds.top
        ?triggerBounds.bottom+6
        :Math.max(10,triggerBounds.top-menuHeight-6);
      budgetMenu.style.left=`${left}px`;
      budgetMenu.style.top=`${top}px`;
    }

    function updateBudgetFields(){
      const values=mobileBudgetDraft||budgetValues;
      const needsValues=values.mode!=='all';
      const isRange=values.mode==='range';
      budgetMenuValues.hidden=!needsValues;
      budgetSingleLabel.hidden=isRange;
      budgetRangeValues.hidden=!isRange;
      const isMobileEditing=isMobileBudgetPanel()&&budgetMenu.classList.contains('mobile-budget-editing');
      budgetSingleHeading.textContent=isMobileBudgetPanel()
        ?values.mode==='lower-than'?'Lower than'
          :values.mode==='higher-than'?'Higher than':'Amount'
        :'Amount';
      budgetSingleHeading.classList.toggle('visually-hidden',isMobileEditing&&!isRange);
      budgetModeHeading.textContent=values.mode==='lower-than'
        ?'Lower than'
        :values.mode==='higher-than'
          ?'Higher than'
          :isRange?'Price Range':'';
      budgetModeHeading.hidden=!(isMobileEditing&&needsValues);
      budgetRangeHint.textContent=isRange
        ?'Enter both amounts to filter projects.'
        :'Enter an amount to filter projects.';
      const hasRangeError=isRange&&values.from&&values.to&&Number(values.from)>Number(values.to);
      budgetRangeError.hidden=!hasRangeError;
      budgetSaveError.hidden=true;
      budgetRangeHint.hidden=isMobileBudgetPanel()&&Boolean(hasRangeError);
      budgetMenu.classList.toggle('has-values',needsValues);
      if(budgetMenu.matches(':popover-open'))positionBudgetMenu();
      syncDropdownLabels();
    }

    rollbackIncompleteBudget=()=>{
      if(isBudgetValuesValid(budgetValues)){
        committedBudgetValues={...budgetValues};
        return;
      }
      const changed=Object.keys(committedBudgetValues).some(key=>budgetValues[key]!==committedBudgetValues[key]);
      Object.assign(budgetValues,committedBudgetValues);
      document.getElementById('budgetFilter').value=budgetValues.mode;
      budgetSingleInput.value=moneyInput.format(budgetValues.lower);
      budgetFromInput.value=moneyInput.format(budgetValues.from);
      budgetToInput.value=moneyInput.format(budgetValues.to);
      updateBudgetFields();
      if(changed)document.getElementById('budgetFilter').dispatchEvent(new Event('change',{bubbles:true}));
    };

    function closeMobileBudgetEditor(){
      if(!budgetMenu.classList.contains('mobile-budget-editing')&&!mobileBudgetDraft)return;
      mobileBudgetDraft=null;
      document.getElementById('budgetFilter').value=budgetValues.mode;
      budgetSingleInput.value=moneyInput.format(budgetValues.lower);
      budgetFromInput.value=moneyInput.format(budgetValues.from);
      budgetToInput.value=moneyInput.format(budgetValues.to);
      budgetMenu.classList.remove('mobile-budget-editing');
      budgetSaveError.hidden=true;
      updateBudgetFields();
    }
    resetMobileBudgetEditor=closeMobileBudgetEditor;

    budgetMenu.querySelectorAll('[data-budget-mode]').forEach(option=>{
      option.addEventListener('click',()=>{
        const nextMode=option.dataset.budgetMode;
        if(isMobileBudgetPanel()){
          if(nextMode==='all'){
            mobileBudgetDraft={mode:'all',lower:'',from:'',to:''};
            budgetSingleInput.value='';
            budgetFromInput.value='';
            budgetToInput.value='';
            budgetMenu.classList.remove('mobile-budget-editing');
            document.getElementById('budgetFilter').value='all';
            updateBudgetFields();
            option.focus({preventScroll:true});
            return;
          }
          mobileBudgetDraft={...(mobileBudgetDraft||budgetValues),mode:nextMode};
          document.getElementById('budgetFilter').value=nextMode;
          budgetSingleInput.value=moneyInput.format(mobileBudgetDraft.lower);
          budgetFromInput.value=moneyInput.format(mobileBudgetDraft.from);
          budgetToInput.value=moneyInput.format(mobileBudgetDraft.to);
          budgetMenu.classList.add('mobile-budget-editing');
          updateBudgetFields();
          (mobileBudgetDraft.mode==='range'?budgetFromInput:budgetSingleInput).focus({preventScroll:true});
          return;
        }
        budgetValues.mode=nextMode;
        document.getElementById('budgetFilter').value=budgetValues.mode;
        if(budgetValues.mode==='all'){
          budgetValues.lower='';
          budgetValues.from='';
          budgetValues.to='';
          budgetSingleInput.value='';
          budgetFromInput.value='';
          budgetToInput.value='';
        }
        updateBudgetFields();
        if(isBudgetValuesValid(budgetValues))committedBudgetValues={...budgetValues};
        document.getElementById('budgetFilter').dispatchEvent(new Event('change',{bubbles:true}));
        if(budgetValues.mode==='all'){
          closeDropdown(budgetMenu,budgetTrigger);
          budgetTrigger.focus();
        }else{
          (budgetValues.mode==='range'?budgetFromInput:budgetSingleInput).focus({preventScroll:true});
        }
      });
    });
    const updateBudgetValue=()=>{
      if(isMobileBudgetPanel()&&mobileBudgetDraft){
        mobileBudgetDraft.lower=moneyInput.digits(budgetSingleInput.value);
        mobileBudgetDraft.from=moneyInput.digits(budgetFromInput.value);
        mobileBudgetDraft.to=moneyInput.digits(budgetToInput.value);
        updateBudgetFields();
        return;
      }
      budgetValues.lower=moneyInput.digits(budgetSingleInput.value);
      budgetValues.from=moneyInput.digits(budgetFromInput.value);
      budgetValues.to=moneyInput.digits(budgetToInput.value);
      updateBudgetFields();
      if(isBudgetValuesValid(budgetValues))committedBudgetValues={...budgetValues};
      document.getElementById('budgetFilter').dispatchEvent(new Event('change',{bubbles:true}));
    };
    [budgetSingleInput,budgetFromInput,budgetToInput].forEach(input=>input.addEventListener('input',updateBudgetValue));
    const saveBudgetFilter=()=>{
      updateBudgetValue();
      const isMobileEditing=isMobileBudgetPanel()&&mobileBudgetDraft!==null;
      const values=isMobileEditing?mobileBudgetDraft:budgetValues;
      if(!isBudgetValuesValid(values)){
        budgetSaveError.textContent=values.mode==='range'
          ?values.from&&values.to
            ?'From must be less than or equal to To.'
            :'Enter both amounts to save this filter.'
          :'Enter a valid amount to save this filter.';
        budgetSaveError.hidden=false;
        if(isMobileBudgetPanel()){
          budgetRangeHint.hidden=true;
          if(values.mode==='range'&&values.from&&values.to&&Number(values.from)>Number(values.to)){
            budgetRangeError.hidden=true;
          }
        }
        let focusTarget=budgetSingleInput;
        if(values.mode==='range'){
          focusTarget=!values.from||Number(values.from)<0
            ?budgetFromInput
            :!values.to||Number(values.to)<0||Number(values.from)>Number(values.to)
              ?budgetToInput
              :budgetFromInput;
        }
        focusTarget.focus({preventScroll:true});
        return;
      }
      if(isMobileEditing){
        Object.assign(budgetValues,mobileBudgetDraft);
        document.getElementById('budgetFilter').value=budgetValues.mode;
        committedBudgetValues={...budgetValues};
        document.getElementById('budgetFilter').dispatchEvent(new Event('change',{bubbles:true}));
        mobileBudgetDraft=null;
        budgetMenu.classList.remove('mobile-budget-editing');
        updateBudgetFields();
        budgetMenu.querySelector(`[data-budget-mode="${budgetValues.mode}"]`)?.focus({preventScroll:true});
        return;
      }
      committedBudgetValues={...budgetValues};
      closeDropdown(budgetMenu,budgetTrigger);
      budgetTrigger.focus();
    };
    budgetSaveButton.addEventListener('click',saveBudgetFilter);
    budgetBackButton.addEventListener('click',()=>{
      closeMobileBudgetEditor();
      budgetMenu.querySelector(`[data-budget-mode="${budgetValues.mode}"]`)?.focus({preventScroll:true});
    });
    [budgetSingleInput,budgetFromInput,budgetToInput].forEach(input=>input.addEventListener('keydown',event=>{
      if(event.key==='Enter'){
        event.preventDefault();
        if(!isMobileBudgetPanel())budgetSaveButton.click();
      }
    }));
    budgetMenu.addEventListener('keydown',event=>{
      if(event.key==='Escape'){
        if(isMobileBudgetPanel()&&budgetMenu.classList.contains('mobile-budget-editing')){
          event.stopPropagation();
          budgetBackButton.click();
          return;
        }
        if(isMobileBudgetPanel())return;
        closeDropdown(budgetMenu,budgetTrigger);
        budgetTrigger.focus();
      }
    });
    updateBudgetFields();
    document.addEventListener('pointerdown',event=>{
      dropdownConfigs.forEach(({triggerId,menuId})=>{
        const trigger=document.getElementById(triggerId);
        const menu=document.getElementById(menuId);
        if(menu.matches(':popover-open')&&!menu.contains(event.target)&&!trigger.contains(event.target)){
          closeDropdown(menu,trigger);
        }
      });
    });
    syncDropdownLabels();
  }

  function resetFilterOptions() {
    resetMobileBudgetEditor();
    ['typeFilter', 'budgetFilter', 'stackFilter'].forEach(id => {
      document.getElementById(id).value = 'all';
    });
    Object.assign(budgetValues, { mode: 'all', lower: '', from: '', to: '' });
    committedBudgetValues = { ...budgetValues };
    ['budgetSingleValue', 'budgetFromValue', 'budgetToValue'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('budgetMenuValues').hidden = true;
    document.getElementById('budgetSingleValueLabel').hidden = false;
    document.getElementById('budgetRangeValues').hidden = true;
    document.getElementById('budgetRangeError').hidden = true;
    document.getElementById('budgetRangeHint').hidden = false;
    const budgetMenu = document.getElementById('budgetFilterMenu');
    budgetMenu.classList.remove('has-values', 'mobile-budget-editing');
    appliedTypeFilter = 'all';
    appliedStackFilter = 'all';
    budgetMenu.querySelectorAll('.budget-range-error').forEach(error => {
      error.hidden = true;
    });
    syncDropdownLabels();
  }

  function initializeMobileFilters() {
    const toggle = document.getElementById('mobileFiltersToggle');
    const panel = document.getElementById('mobileFiltersPanel');
    const actions = document.querySelector('.mobile-market-actions');
    const stickyActions = document.querySelector('.mobile-market-sticky-actions');
    const categories = document.querySelector('.market-categories');
    const sortControl = document.querySelector('.sort-control');
    const typeSelect = document.getElementById('typeFilter');
    const stackSelect = document.getElementById('stackFilter');
    const budgetSelect = document.getElementById('budgetFilter');
    const resetButton = document.getElementById('mobileFilterReset');
    const applyButton = document.getElementById('mobileFilterApply');
    const budgetSaveButton = document.querySelector('.budget-save-filter');
    const typeLabel = typeSelect?.closest('label');
    const stackLabel = stackSelect?.closest('label');
    const budgetLabel = budgetSelect?.closest('label');
    const selectContainer = panel?.querySelector('.mobile-filter-selects');
    if (!toggle || !panel || !actions || !stickyActions || !categories || !sortControl || !typeSelect || !stackSelect || !budgetSelect || !resetButton || !applyButton || !budgetSaveButton || !typeLabel || !stackLabel || !budgetLabel || !selectContainer) return;

    const categoriesPlaceholder = document.createComment('project categories placement');
    const typePlaceholder = document.createComment('project type filter placement');
    const stackPlaceholder = document.createComment('tech stack filter placement');
    const budgetPlaceholder = document.createComment('budget filter placement');
    const togglePlaceholder = document.createComment('project filter button placement');
    const sortPlaceholder = document.createComment('project sort button placement');
    const panelPlaceholder = document.createComment('project filter panel placement');
    categories.before(categoriesPlaceholder);
    typeLabel.before(typePlaceholder);
    stackLabel.before(stackPlaceholder);
    budgetLabel.before(budgetPlaceholder);
    toggle.before(togglePlaceholder);
    sortControl.before(sortPlaceholder);
    panel.before(panelPlaceholder);
    budgetLabel.classList.add('mobile-budget-filter');

    [[typeLabel, typeSelect], [stackLabel, stackSelect]].forEach(([label, select]) => {
      const options = document.createElement('div');
      options.className = 'mobile-filter-options';
      options.dataset.selectId = select.id;
      options.setAttribute('role', 'group');
      options.setAttribute('aria-label', `${label.querySelector('.filter-label').textContent} options`);
      [...select.options].forEach(option => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.value = option.value;
        button.setAttribute('aria-pressed', String(option.value === select.value));
        const label = document.createElement('span');
        label.textContent = option.textContent;
        button.append(label, createCheckmarkIcon());
        button.addEventListener('click', () => {
          select.value = option.value;
          syncDropdownLabels();
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        options.append(button);
      });
      label.append(options);
    });

    const mobileFilterBreakpoint = window.matchMedia('(max-width: 860px)');

    function setPanelOpen(isOpen) {
      panel.hidden = !isOpen;
      toggle.setAttribute('aria-expanded', String(isOpen));
      stickyActions.classList.toggle('mobile-filter-open', isOpen);
    }

    function discardMobileFilterDraft() {
      typeSelect.value = appliedTypeFilter;
      stackSelect.value = appliedStackFilter;
      resetMobileBudgetEditor();
      syncDropdownLabels();
    }

    function closePanelWithoutApplying() {
      discardMobileFilterDraft();
      setPanelOpen(false);
    }

    resetButton.addEventListener('click', () => {
      resetFilterOptions();
      visibleCount = 3;
      render();
      setPanelOpen(false);
      toggle.focus();
    });
    applyButton.addEventListener('click', () => {
      if (mobileBudgetDraft) {
        budgetSaveButton.click();
        if (mobileBudgetDraft) return;
      }
      appliedTypeFilter = typeSelect.value;
      appliedStackFilter = stackSelect.value;
      visibleCount = 3;
      render();
      setPanelOpen(false);
      toggle.focus();
    });

    function syncMobileFilterLayout() {
      if (mobileFilterBreakpoint.matches) {
        actions.append(categories);
        stickyActions.append(sortControl, toggle, panel);
        selectContainer.append(typeLabel, stackLabel, budgetLabel);
        const budgetMenu=document.getElementById('budgetFilterMenu');
        budgetMenu.setAttribute('role', 'group');
        ['left','top','width','min-width'].forEach(property=>budgetMenu.style.removeProperty(property));
      } else {
        typeSelect.value = appliedTypeFilter;
        stackSelect.value = appliedStackFilter;
        categoriesPlaceholder.parentNode?.insertBefore(categories, categoriesPlaceholder.nextSibling);
        typePlaceholder.parentNode?.insertBefore(typeLabel, typePlaceholder.nextSibling);
        stackPlaceholder.parentNode?.insertBefore(stackLabel, stackPlaceholder.nextSibling);
        budgetPlaceholder.parentNode?.insertBefore(budgetLabel, budgetPlaceholder.nextSibling);
        document.getElementById('budgetFilterMenu').setAttribute('role', 'dialog');
        sortPlaceholder.parentNode?.insertBefore(sortControl, sortPlaceholder.nextSibling);
        togglePlaceholder.parentNode?.insertBefore(toggle, togglePlaceholder.nextSibling);
        resetMobileBudgetEditor();
        syncDropdownLabels();
        setPanelOpen(false);
        panelPlaceholder.parentNode?.insertBefore(panel, panelPlaceholder.nextSibling);
      }
    }

    toggle.addEventListener('click', () => {
      if (panel.hidden) {
        setPanelOpen(true);
        return;
      }
      closePanelWithoutApplying();
    });
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closePanelWithoutApplying();
        toggle.focus();
      }
    });
    document.addEventListener('pointerdown', event => {
      if (!panel.hidden && !panel.contains(event.target) && !toggle.contains(event.target)) {
        closePanelWithoutApplying();
      }
    });
    document.addEventListener('pointerdown', event => {
      const target = event.target instanceof Element ? event.target : null;
      const card = target?.closest('[data-card-detail]');
      const openPopover = dropdownConfigs.some(({ menuId }) =>
        document.getElementById(menuId)?.matches(':popover-open')
      );
      suppressedProjectCardClick = card && (!panel.hidden || openPopover) ? card : null;
    }, true);
    mobileFilterBreakpoint.addEventListener('change', syncMobileFilterLayout);
    syncMobileFilterLayout();
    syncDropdownLabels();
  }

  function readFavorites() {
    try {
      const saved = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
      return Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : [];
    } catch (error) {
      console.warn('Could not read DEV-MATCH favorites from localStorage.', error);
      return [];
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(favoritesKey, JSON.stringify(favoriteIds));
    } catch (error) {
      console.warn('Could not save DEV-MATCH favorites to localStorage.', error);
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  function formatPostedAt(value) {
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return 'Recently posted';
    const elapsed = Math.max(0, Date.now() - timestamp);
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Intl.DateTimeFormat(undefined, {month:'short',day:'numeric',year:'numeric'}).format(timestamp);
  }

  async function loadPublicRequestCardMetrics(projectIds) {
    const metrics = new Map();
    for (let offset = 0; offset < projectIds.length; offset += 100) {
      const batch = projectIds.slice(offset, offset + 100);
      const {data, error} = await window.devMatchBackend.client.rpc(
        'get_public_request_card_metrics',
        {p_project_ids:batch}
      );
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Supabase returned invalid public request card metrics.');
      data.forEach(row => {
        const favoriteCount=Number(row.favorite_count);
        const commentCount=Number(row.comment_count);
        if (!batch.includes(row.project_id)
          || ![favoriteCount,commentCount].every(value=>Number.isSafeInteger(value)&&value>=0)) {
          throw new Error('Supabase returned invalid public request card metrics.');
        }
        metrics.set(row.project_id,{favorites:favoriteCount,comments:commentCount});
      });
    }
    if (metrics.size !== projectIds.length) {
      throw new Error('Supabase returned incomplete public request card metrics.');
    }
    return metrics;
  }

  function parseBudgetAmount(value) {
    const digits=String(value??'').replace(/\D/g,'');
    if(!digits)return null;
    const amount=Number(digits);
    return Number.isFinite(amount)?amount:null;
  }

  function projectBudgetRange(project) {
    const from=parseBudgetAmount(project[isRequestsPage?'budgetFrom':'priceMin']);
    const to=parseBudgetAmount(project[isRequestsPage?'budgetTo':'priceMax']);
    if(from!==null&&to!==null&&from<=to)return {min:from,max:to};

    const prices=String(project.price||project.budgetLabel||project.budget||'').match(/\d[\d.,]*/g)||[];
    const amounts=prices.map(parseBudgetAmount).filter(amount=>amount!==null);
    if(!amounts.length)return null;
    return {min:amounts[0],max:amounts.length>1?amounts[amounts.length-1]:amounts[0]};
  }

  function priceValue(project) {
    return projectBudgetRange(project)?.min??0;
  }

  function categoryMatch(item) {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'Android / iOS') return item.type === 'Android / iOS';
    return item.category === activeCategory;
  }

  function getItems() {
    const source = isRequestsPage ? requests : projects;
    const type = appliedTypeFilter;
    const stack = appliedStackFilter.toLowerCase();
    const filtered = source.filter(item => {
      const budgetRange=projectBudgetRange(item);
      const lower = Number(committedBudgetValues.mode === 'range' ? committedBudgetValues.from : committedBudgetValues.lower);
      const upper = Number(committedBudgetValues.to);
      const hasLower = committedBudgetValues.mode === 'range' ? committedBudgetValues.from !== '' : committedBudgetValues.lower !== '';
      const hasUpper = committedBudgetValues.mode === 'range' && committedBudgetValues.to !== '';
      const invalidRange = committedBudgetValues.mode === 'range' && hasLower && hasUpper && lower > upper;
      const budgetMatch = !invalidRange && (
        committedBudgetValues.mode === 'all'
        || committedBudgetValues.mode === 'lower-than' && hasLower && budgetRange && budgetRange.min < lower
        || committedBudgetValues.mode === 'higher-than' && hasLower && budgetRange && budgetRange.max > lower
        || committedBudgetValues.mode === 'range' && hasLower && hasUpper && budgetRange && budgetRange.max >= lower && budgetRange.min <= upper
      );
      const stacks = isRequestsPage ? item.stack : String(item.stack).split(/\s+(?:and|,)\s+/);
      const stackMatch = stack === 'all' || (isRequestsPage
        ?requestMatchesSpecialization(item,appliedStackFilter)
        :stacks.some(value => value.toLowerCase().includes(stack)));
      const text = isRequestsPage
        ? [item.title, item.description, item.category, item.type, item.client, item.location, ...item.stack, 'developer'].join(' ')
        : [item.title, item.description, item.category, item.type, item.developer, item.location, item.stack, 'developer'].join(' ');
      const searchTerms = query.replace(/\btoko\b/g, 'online').split(/\s+/).filter(Boolean);
      return categoryMatch(item) && (type === 'all' || item.type === type) && budgetMatch && stackMatch
        && (!query || searchTerms.every(term => text.toLowerCase().includes(term)));
    });

    const sort = document.getElementById('sortFilter').value;
    if (sort === 'price-low') filtered.sort((a, b) => priceValue(a) - priceValue(b));
    if (sort === 'price-high') filtered.sort((a, b) => priceValue(b) - priceValue(a));
    if (sort === 'popular') filtered.sort((a, b) => (b.popularity || Number(b.developerFavorites) || 0) - (a.popularity || Number(a.developerFavorites) || 0));
    if (sort === 'newest') filtered.sort((a, b) => isRequestsPage ? requests.indexOf(a) - requests.indexOf(b) : projects.indexOf(a) - projects.indexOf(b));
    return filtered;
  }

  function artwork(item, includeFavorite = true) {
    const art = isRequestsPage
      ? 'dashboard-art'
      : item.art || 'food-art';
    const coverImage = safeProjectCover(item.coverImage);
    if (!isRequestsPage && coverImage) {
      const favorite = favoriteIds.includes(item.id);
      const favoriteButton = includeFavorite ? `<button class="favorite-button" type="button" data-favorite="${escapeHtml(item.id)}" aria-pressed="${favorite}" aria-label="${favorite ? 'Remove from' : 'Save to'} Favorites"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>` : '';
      const artLabel = item.type;
      return `<div class="project-art ${escapeHtml(art)}"><span class="art-label">${escapeHtml(artLabel)}</span>${favoriteButton}<img class="marketplace-project-cover" src="${escapeHtml(coverImage)}" alt="${escapeHtml(item.title)}" loading="lazy"></div>`;
    }
    let markup = '<span class="art-title"></span><span class="art-copy"></span><div class="art-graphic"></div>';
    if (art === 'dashboard-art') markup = '<div class="mini-bars"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
    if (art === 'analytics-art') markup = '<div class="analytics-stats"><i></i><i></i><i></i></div><div class="analytics-graph"></div>';
    const favorite = favoriteIds.includes(item.id);
    const favoriteButton = isRequestsPage || !includeFavorite ? '' : `<button class="favorite-button" type="button" data-favorite="${escapeHtml(item.id)}" aria-pressed="${favorite}" aria-label="${favorite ? 'Remove from' : 'Save to'} Favorites"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>`;
    const artLabel = isRequestsPage ? `${item.category} · ${item.type}` : item.type;
    return `<div class="project-art ${escapeHtml(art)}"><span class="art-label">${escapeHtml(artLabel)}</span>${favoriteButton}<div class="art-window"><div class="art-header"><i></i><i></i><i></i></div><div class="art-layout"><div class="art-sidebar"></div><div class="art-content">${markup}</div></div></div></div>`;
  }

  function renderProject(item) {
    const stack = String(item.stack).split(/\s+(?:and|,)\s+/).filter(Boolean).slice(0, 3);
    const catalogContent = `<div class="project-meta"><b class="catalog-category">${escapeHtml(item.category)}</b><span>${escapeHtml(item.age)}</span></div>
      <button class="project-title" type="button" data-detail="${escapeHtml(item.id)}">${escapeHtml(item.title)}</button>
      <p class="project-description">${escapeHtml(item.description)}</p>
      <strong class="catalog-price">${escapeHtml(item.price)}</strong>
      <div class="project-by catalog-project-by">
        <span class="developer-avatar">${escapeHtml(item.initials)}</span>
        <span class="developer-info"><b>${escapeHtml(item.developer)}</b><small>${escapeHtml(item.handle || '')}</small></span>
        <span class="rating" aria-label="Rating 4.9 out of 5"><span>★</span> 4.9</span>
      </div>`;
    const requestFavorite=favoriteIds.includes(item.id);
    const requestSpecialties=Array.isArray(item.specialties)
      ?item.specialties
      :String(item.specialty||'').split(/[,\n]/).filter(Boolean);
    const requiredTags=[...new Set(requestSpecialties.map(value=>String(value).trim()).filter(Boolean))]
      .map(value=>value==='Other'&&item.specialtyOther?`Other · ${item.specialtyOther}`:value);
    const requestMetrics=`<div class="request-card-metrics"><span aria-label="${item.favoriteCount} favorites"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>${item.favoriteCount}</span><span aria-label="${item.commentCount} comments"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg>${item.commentCount}</span></div>`;
    const requestContent = `<header class="request-card-header">
        <div class="request-card-author"><span class="request-card-avatar" aria-hidden="true">${escapeHtml(item.initials)}</span><span class="request-card-author-copy"><b>${escapeHtml(item.client)}</b><small>Posted ${escapeHtml(formatPostedAt(item.createdAt))} · ${escapeHtml(item.location)}</small></span></div>
        <div class="request-card-header-actions"><span class="request-card-category">${escapeHtml(item.category)}</span><button class="request-card-favorite" type="button" data-favorite="${escapeHtml(item.id)}" aria-pressed="${requestFavorite}" aria-label="${requestFavorite?'Remove from':'Save to'} Favorites"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button></div>
      </header>
      <button class="project-title" type="button" data-detail="${escapeHtml(item.id)}">${escapeHtml(item.title)}</button>
      <p class="project-description">${escapeHtml(item.description)}</p>
      <div class="request-budget-box"><small>BUDGET</small><strong>${escapeHtml(item.budgetLabel)}</strong></div>
      <div class="request-required"><strong>Required</strong><div class="request-card-tags">${requiredTags.length?requiredTags.map(value=>`<span>${escapeHtml(value)}</span>`).join(''):'<span>Not specified</span>'}</div></div>
      <footer class="request-card-footer">${requestMetrics}</footer>`;
    if(isRequestsPage){
      return `<article class="project-card request-project-card" data-card-detail="${escapeHtml(item.id)}" tabindex="0" aria-label="Open details for ${escapeHtml(item.title)}"><div class="project-body request-card-body">${requestContent}</div></article>`;
    }
    return `<article class="project-card${isRequestsPage ? '' : ' catalog-card'}" data-card-detail="${escapeHtml(item.id)}" tabindex="0" aria-label="Open details for ${escapeHtml(item.title)}">
      ${artwork(item)}
      <div class="project-body">
        ${catalogContent}
      </div>
    </article>`;
  }

  function updateCategoryCounts() {
    const source = isRequestsPage ? requests : projects;
    const categoryCounts = new Map([['all',source.length]]);
    source.forEach(item => {
      const categories = new Set([item.category]);
      if (item.type === 'Android / iOS') categories.add('Android / iOS');
      categories.forEach(category => {
        if (!category || category === 'all') return;
        categoryCounts.set(category,(categoryCounts.get(category)||0)+1);
      });
    });
    document.querySelectorAll('[data-category-count]').forEach(label => {
      if (catalogError) {
        label.textContent = '—';
        return;
      }
      if (!catalogLoaded && !catalogError) {
        window.DEVMATCH_SKELETON?.text(label,'Loading category count','56px');
        return;
      }
      const category = label.dataset.categoryCount;
      const count = categoryCounts.get(category)||0;
      const countLabel = count === 1 ? 'project' : 'projects';
      label.textContent = `${count} ${countLabel}`;
    });
    categoryButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === activeCategory)));
  }

  function updateFavoriteCount() {
    if (window.DEVMATCH_NAV_BADGES) {
      window.DEVMATCH_NAV_BADGES.updateFavorites();
    } else {
      document.getElementById('favoriteCount').textContent = String(favoriteIds.length);
    }
  }

  async function loadDeveloperTabCount() {
    if (!developerTabCount) return;
    window.DEVMATCH_SKELETON?.text(developerTabCount,'Loading developer count','24px');
    try {
      const user = await window.devMatchBackend.ready;
      if (!user) return;
      const account = await window.devMatchBackend.loadProfile(user);
      if (account.account_role !== 'client') return;
      const {count, error} = await window.devMatchBackend.client.from('directory_people')
        .select('id', {count:'exact',head:true})
        .eq('account_role','dev');
      if (error) throw error;
      developerTabCount.textContent = count === null ? '0' : String(count);
    } catch (error) {
      console.error('Unable to load developer tab count from Supabase.', error);
      developerTabCount.textContent = '0';
    }
  }

  async function loadClientDirectoryTabCount() {
    if (!clientsTabCount) return;
    window.DEVMATCH_SKELETON?.text(clientsTabCount,'Loading client count','24px');
    try {
      const user = await window.devMatchBackend.ready;
      if (!user) throw new Error('Sign in with a developer account to browse the client directory.');
      const account = await window.devMatchBackend.loadProfile(user);
      if (account.account_role !== 'dev') throw new Error('The client directory is available in developer mode.');
      const {count, error} = await window.devMatchBackend.client.from('directory_people')
        .select('id', {count:'exact',head:true})
        .eq('account_role', 'client');
      if (error) throw error;
      if (count === null) throw new Error('The client directory count was not returned by Supabase.');
      clientsTabCount.textContent = String(count);
    } catch (error) {
      console.error('Unable to load the client directory tab count from Supabase.', error);
      clientsTabCount.textContent = '—';
    }
  }

  function render() {
    const source = isRequestsPage ? requests : projects;
    const filtered = getItems();
    const shown = filtered.slice(0, visibleCount);
    grid.classList.toggle('is-list', view === 'list');
    if (!catalogLoaded && !catalogError) window.DEVMATCH_SKELETON?.cards(grid,6,isRequestsPage?'request':'marketplace-project');
    else grid.innerHTML = shown.map(renderProject).join('');
    emptyState.hidden = !catalogLoaded || Boolean(catalogError) || filtered.length !== 0;
    const noPosts = catalogLoaded && !catalogError && source.length === 0;
    emptyState.querySelector('h3').textContent = noPosts
      ? 'No projects have been posted yet'
      : 'No projects match your filters';
    emptyState.querySelector('p').textContent = noPosts
      ? 'There are no project listings available right now. Please check back soon.'
      : isRequestsPage
        ? 'Try changing your search terms or resetting the filters to see more opportunities.'
        : 'Try changing your search or resetting the filters to see more options.';
    emptyState.querySelector('.empty-search-icon').hidden = noPosts;
    emptyState.querySelector('[data-reset]').hidden = noPosts;
    catalogStatus.hidden = catalogLoaded && !catalogError;
    if(!catalogLoaded&&!catalogError)window.DEVMATCH_SKELETON?.status(catalogStatus,'Loading projects');
    if(catalogError)catalogStatus.textContent = catalogErrorMessage;
    if (catalogError) {
      summary.textContent = '— projects';
      if (isRequestsPage && projectRequestsTabCount) projectRequestsTabCount.textContent = '—';
      if (!isRequestsPage && projectTabCount) projectTabCount.textContent = '—';
    } else if (catalogLoaded) {
      summary.textContent = `Showing ${filtered.length} ${filtered.length === 1 ? 'project' : 'projects'}`;
    } else {
      window.DEVMATCH_SKELETON?.text(summary,'Loading result count','96px');
    }
    updateFavoriteCount();
    const remaining = Math.max(0, filtered.length - shown.length);
    remainingCount.textContent = catalogLoaded && remaining
      ? isRequestsPage
        ? `Showing ${shown.length} of ${filtered.length} projects`
        : `Showing ${shown.length} of ${filtered.length} projects`
      : '';
    loadMoreButton.hidden = !catalogLoaded || remaining === 0;
    updateCategoryCounts();
  }

  function selectedItem(id) {
    const source = isRequestsPage ? requests : projects;
    return source.find(item => item.id === id);
  }

  function updateRequestDetailUrl(id) {
    const url = new URL(location.href);
    url.searchParams.set('requestDetail', id);
    history.replaceState(history.state, '', url);
  }

  function clearRequestDetailUrl() {
    const url = new URL(location.href);
    if (!url.searchParams.has('requestDetail')) return;
    url.searchParams.delete('requestDetail');
    history.replaceState(history.state, '', url);
  }

  function persistMarketplaceScroll() {
    try {
      sessionStorage.setItem(scrollStateKey, JSON.stringify({
        scrollTop: main.scrollTop,
        visibleCount
      }));
    } catch (error) {
      console.warn('Unable to save marketplace scroll position.', error);
    }
  }

  function restoreMarketplaceScroll() {
    if (!scrollRestorePending) return;
    const source = isRequestsPage ? requests : projects;
    visibleCount = Math.max(3, Math.min(savedScrollState.visibleCount, Math.max(3, source.length)));
    render();
    requestAnimationFrame(() => {
      main.scrollTop = savedScrollState.scrollTop;
      scrollRestorePending = false;
    });
  }

  function restoreRequestDetail() {
    if (!requestDetailParam || catalogError) return;
    if (!selectedItem(requestDetailParam)) {
      console.error(`DEV-MATCH project request details not found for "${requestDetailParam}".`);
      return;
    }
    showDetails(requestDetailParam);
  }

  function showDetails(id) {
    const item = selectedItem(id);
    if (!item) {
      console.error(`DEV-MATCH project details not found for "${id}".`);
      return;
    }
    if (isRequestsPage) {
      if (requestDetailDialog && requestDetailFrame) {
        updateRequestDetailUrl(item.id);
        requestDetailFrame.title = `Project request: ${item.title}`;
        requestDetailFrame.src = `devmatch-find-project-detail.html?request=${encodeURIComponent(item.id)}&modal=1&v=20261126-request-popup`;
        if (!requestDetailDialog.open) requestDetailDialog.showModal();
      } else {
        window.location.href = `devmatch-find-project-detail.html?request=${encodeURIComponent(item.id)}`;
      }
    } else if (typeof window.openProjectDetails === 'function') {
      window.openProjectDetails(item.id);
    } else {
      window.location.href = `devmatch-discover-project-detail.html?project=${encodeURIComponent(item.id)}`;
    }
  }

  initializeDropdowns();
  initializeMobileFilters();
  main.addEventListener('scroll', () => {
    if (scrollRestorePending) return;
    window.clearTimeout(scrollSaveTimer);
    scrollSaveTimer = window.setTimeout(persistMarketplaceScroll, 120);
  }, {passive: true});
  window.addEventListener('pagehide', () => {
    window.clearTimeout(scrollSaveTimer);
    if (!scrollRestorePending) persistMarketplaceScroll();
  });
  if (searchForm && searchInput) {
    searchForm.addEventListener('submit', event => {
      event.preventDefault();
      query = searchInput.value.trim().toLowerCase();
      searchInput.value = query ? searchInput.value : '';
      visibleCount = 3;
      render();
    });
  }
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      query = searchInput.value.trim().toLowerCase();
      visibleCount = 3;
      render();
    });
  }
  if (topSearchInput) topSearchInput.addEventListener('input', () => {
    if (searchInput) searchInput.value = topSearchInput.value;
    query = topSearchInput.value.trim().toLowerCase();
    visibleCount = 3;
    render();
  });
  document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => {
    if (searchInput) searchInput.value = button.dataset.query;
    if (topSearchInput) topSearchInput.value = button.dataset.query;
    query = button.dataset.query.toLowerCase();
    visibleCount = 3;
    render();
    (searchInput || topSearchInput)?.focus();
  }));
  categoryButtons.forEach(button => button.addEventListener('click', () => {
    activeCategory = button.dataset.category;
    categoryButtons.forEach(category => {
      const active = category === button;
      category.classList.toggle('is-active', active);
      category.setAttribute('aria-pressed', String(active));
    });
    visibleCount = 3;
    render();
  }));
  ['typeFilter', 'budgetFilter', 'stackFilter', 'sortFilter'].forEach(id => document.getElementById(id).addEventListener('change', () => {
    if(isMobileFilterPanelOpen()&&(id==='typeFilter'||id==='budgetFilter'||id==='stackFilter'))return;
    if(id==='typeFilter')appliedTypeFilter=document.getElementById(id).value;
    if(id==='stackFilter')appliedStackFilter=document.getElementById(id).value;
    visibleCount = 3;
    render();
  }));
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    view = button.dataset.view;
    document.querySelectorAll('[data-view]').forEach(option => {
      const selected = option === button;
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
    render();
  }));
  document.querySelector('[data-reset]').addEventListener('click', () => {
    query = '';
    activeCategory = 'all';
    if (searchInput) searchInput.value = '';
    if (topSearchInput) topSearchInput.value = '';
    resetFilterOptions();
    document.getElementById('sortFilter').value = 'popular';
    syncDropdownLabels();
    categoryButtons.forEach(button => {
      const active = button.dataset.category === 'all';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    visibleCount = 3;
    render();
  });
  grid.addEventListener('click', async event => {
    const clickedCard = event.target instanceof Element
      ? event.target.closest('[data-card-detail]')
      : null;
    if (clickedCard && clickedCard === suppressedProjectCardClick) {
      suppressedProjectCardClick = null;
      event.preventDefault();
      return;
    }
    suppressedProjectCardClick = null;
    const favoriteButton = event.target.closest('[data-favorite]');
    if (favoriteButton) {
      const authenticated = await favoriteStateReady;
      if (authenticated === null) return;
      const id = favoriteButton.dataset.favorite;
      const saved = favoriteIds.includes(id);
      if (saved) {
        const project = selectedItem(id);
        if (!project || !await window.DEVMATCH_FAVORITE_FEEDBACK.confirmRemoval(
          favoriteRemoveDialog,
          favoriteRemoveMessage,
          project.title
        )) return;
      }
      if (authenticated) {
        try {
          await window.devMatchBackend.setFavorite('project', id, !saved);
        } catch (error) {
          console.error('Unable to update project favorite in Supabase.', error);
          window.alert('Unable to save this favorite. Please try again.');
          return;
        }
      }
      favoriteIds = saved ? favoriteIds.filter(value => value !== id) : [...favoriteIds, id];
      saveFavorites();
      render();
      window.DEVMATCH_NAV_BADGES?.updateFavorites();
      window.DEVMATCH_FAVORITE_FEEDBACK.showToast(
        favoriteToast,
        saved ? 'Project removed from your favorites' : 'Project added to your favorites',
        saved ? async () => {
          try {
            if (authenticated) await window.devMatchBackend.setFavorite('project', id, true);
          } catch (error) {
            console.error('Unable to restore project favorite in Supabase.', error);
            window.alert('Unable to restore this favorite. Please try again.');
            return false;
          }
          if (!favoriteIds.includes(id)) favoriteIds = [...favoriteIds, id];
          saveFavorites();
          render();
          window.DEVMATCH_NAV_BADGES?.updateFavorites();
          return true;
        } : null,
        saved ? null : {tab: 'projects'}
      );
      return;
    }
    const detailButton = event.target.closest('[data-detail]');
    if (detailButton) showDetails(detailButton.dataset.detail);
    else if (!event.target.closest('a, button, input, select, textarea, summary')) {
      const card = event.target.closest('[data-card-detail]');
      if (card) showDetails(card.dataset.cardDetail);
    }
  });
  grid.addEventListener('keydown', event => {
    if (event.target.matches('[data-card-detail]') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      showDetails(event.target.dataset.cardDetail);
    } else if (event.key === 'Enter' && event.target.matches('[data-detail]')) {
      showDetails(event.target.dataset.detail);
    }
  });
  loadMoreButton.addEventListener('click', () => {
    visibleCount += 6;
    render();
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-close-dialog]')) dialog.close();
    if (event.target === dialog) dialog.close();
  });
  if (requestDetailDialog && requestDetailFrame) {
    document.getElementById('closeRequestDetail').addEventListener('click', () => requestDetailDialog.close());
    requestDetailDialog.addEventListener('click', event => {
      if (event.target === requestDetailDialog) requestDetailDialog.close();
    });
    requestDetailDialog.addEventListener('close', () => {
      clearRequestDetailUrl();
      requestDetailFrame.src = 'about:blank';
    });
  }
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      (searchInput || topSearchInput)?.focus();
    }
  });

  async function loadCatalog() {
    catalogErrorMessage = 'Projects could not be loaded. Check your connection and try again.';
    grid.setAttribute('aria-busy', 'true');
    catalogStatus.hidden = false;
    window.DEVMATCH_SKELETON?.cards(grid,6,isRequestsPage?'request':'marketplace-project');
    window.DEVMATCH_SKELETON?.status(catalogStatus,'Loading projects');
    window.DEVMATCH_SKELETON?.text(summary,'Loading result count','96px');
    if (isRequestsPage) window.DEVMATCH_SKELETON?.text(projectRequestsTabCount,'Loading project count','24px');
    else window.DEVMATCH_SKELETON?.text(projectTabCount,'Loading project count','24px');
    try {
      const user = await window.devMatchBackend.ready;
      const kind = isRequestsPage ? 'request' : 'portfolio';
      let query = window.devMatchBackend.client.from('projects')
        .select('id,owner_id,title,project_type,category,price,price_type,cover_image,status,data,created_at,updated_at', {count:'exact'})
        .eq('project_kind', kind)
        .eq('status', isRequestsPage ? 'open' : 'published')
        .order('updated_at', {ascending:false});
      const {data: rows, count: projectCount, error} = await query;
      if (error) throw error;
      if (isRequestsPage && projectRequestsTabCount) {
        if (projectCount === null) {
          console.error('Unable to load the project request tab count from Supabase.');
          projectRequestsTabCount.textContent = '—';
        } else {
          projectRequestsTabCount.textContent = String(projectCount);
        }
      }

      let peopleById = new Map();
      if (user && rows?.length) {
        const account = await window.devMatchBackend.loadProfile(user);
        const expectedRole=isRequestsPage?'dev':'client';
        if(account.account_role!==expectedRole)throw new Error(`This project catalog is available in ${expectedRole} mode.`);
        const ownerIds=[...new Set(rows.map(row=>row.owner_id).filter(Boolean))];
        if(ownerIds.length){
          const {data: people, error: peopleError} = await window.devMatchBackend.client
            .from('directory_people')
            .select('id,display_name,username,account_role,profile_data,published_portfolio_count,open_request_count')
            .eq('account_role',isRequestsPage?'client':'dev')
            .in('id',ownerIds);
          if (peopleError) throw peopleError;
          peopleById = new Map((people || []).map(person => [person.id, person]));
        }
      }
      let metricsByProjectId=new Map();
      if(isRequestsPage&&rows?.length&&user){
        try{metricsByProjectId=await loadPublicRequestCardMetrics(rows.map(row=>row.id));}
        catch(error){
          catalogErrorMessage='Project requests could not be loaded because their favorite and comment counts are unavailable. Apply the public request card metrics migration in Supabase.';
          throw error;
        }
      }
      const records = (rows || []).map(row => {
        const data = row.data && typeof row.data === 'object' ? row.data : {};
        const person = peopleById.get(row.owner_id);
        const profile = person?.profile_data || {};
        const name = person?.display_name || '';
        const location = String(profile.city || '');
        const category = String(row.category || data.category || '');
        const type = String(row.project_type || data.projectType || data.type || '');
        const description = String(data.description || data.overview || '');
        const budget = String(row.price || data.price || data.budgetLabel || data.budget || '');
        const tags = Array.isArray(data.stack) ? data.stack : String(data.stack || '').split(/\s+(?:and|,)\s+/).filter(Boolean);
        const firstMedia = Array.isArray(data.media) ? data.media.find(value => typeof value === 'string') : '';
        const coverImage = safeProjectCover(row.cover_image || data.coverImage || firstMedia);
        return {
          ...data, id:row.id, title:String(row.title || data.title || ''), type, category,
          description, stack:tags, coverImage,
          price:budget, budgetLabel:budget, budget:Number(String(data.budget || budget).replace(/[^\d]/g,'')) || 0,
          developer:name || 'DEV-MATCH member', client:name || 'DEV-MATCH member',
          handle:person?.username ? `@${String(person.username).replace(/^@/, '')}` : '',
          initials:(name.match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase() || 'DM',
          location:location || 'Location not provided',
          age:new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(row.created_at || row.updated_at)),
          createdAt:row.created_at||row.updated_at,
          days:new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(row.created_at || row.updated_at)),
          created:new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(row.created_at || row.updated_at)),
          favoriteCount:metricsByProjectId.get(row.id)?.favorites??null,
          commentCount:metricsByProjectId.get(row.id)?.comments??null,
          status:row.status, ownerId:row.owner_id, popularity:0,
          overview:String(data.overview || description), features:Array.isArray(data.features)?data.features:[],
          art:'dashboard-art'
        };
      });
      if (isRequestsPage) requests = records;
      else projects = records;
      if (isRequestsPage) updateRequiredSpecializationOptions(records);
      if (!isRequestsPage && projectTabCount) {
        projectTabCount.textContent = projectCount === null ? '0' : String(projectCount);
      }
      catalogError = null;
      catalogLoaded = true;
      render();
      restoreMarketplaceScroll();
      restoreRequestDetail();
      catalogStatus.hidden = true;
    } catch (error) {
      console.error('Unable to load public projects from Supabase.', error);
      if (isRequestsPage && projectRequestsTabCount) projectRequestsTabCount.textContent = '—';
      catalogError = error;
      catalogLoaded = true;
      projects = [];
      requests = [];
      if (isRequestsPage) updateRequiredSpecializationOptions([]);
      render();
      restoreMarketplaceScroll();
    } finally {
      grid.removeAttribute('aria-busy');
    }
  }
  async function refreshRequiredSpecializationOptions(){
    if(!isRequestsPage||!catalogLoaded)return;
    try{
      const {data,error}=await window.devMatchBackend.client.from('projects')
        .select('data')
        .eq('project_kind','request')
        .eq('status','open');
      if(error)throw error;
      const records=(data||[]).map(row=>row.data&&typeof row.data==='object'?row.data:{});
      if(updateRequiredSpecializationOptions(records))render();
    }catch(error){
      console.error('Unable to refresh required specialization options from Supabase.',error);
    }
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')void refreshRequiredSpecializationOptions();
  });
  loadDeveloperTabCount();
  loadClientDirectoryTabCount();
  loadCatalog();
})();
