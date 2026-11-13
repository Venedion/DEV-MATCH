(async function(){
  'use strict';
  const requestedId=new URLSearchParams(location.search).get('client');
  const profileCard=document.getElementById('clientProfile');
  const requestsSection=document.getElementById('clientRequestsSection');
  const unavailable=document.getElementById('profileUnavailable');
  const status=document.getElementById('profileStatus');
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const initials=name=>(String(name||'').match(/\b\p{L}/gu)||[]).slice(0,2).join('').toUpperCase()||'CL';
  function showUnavailable(message){
    status.hidden=true;
    unavailable.hidden=false;
    unavailable.querySelector('p').textContent=message;
  }
  if(!requestedId){showUnavailable('This client profile could not be found.');return;}
  status.hidden=false;
  status.textContent='Loading client profile…';
  try{
    const user=await window.devMatchBackend.ready;
    let client;
    if(user){
      const {data:account,error:accountError}=await window.devMatchBackend.client.from('profiles')
        .select('account_role').eq('id',user.id).single();
      if(accountError)throw accountError;
      if(account.account_role!=='dev'){showUnavailable('Client profiles are available in developer mode.');return;}
      const {data,error}=await window.devMatchBackend.client.from('directory_people')
        .select('id,display_name,account_role,profile_data,open_request_count')
        .eq('id',requestedId).eq('account_role','client').maybeSingle();
      if(error)throw error;
      client=data;
    }else{
      client={id:requestedId,display_name:'Client',profile_data:{}};
    }
    if(!client){showUnavailable('This client profile could not be found.');return;}
    const {data:requests,error:requestError}=await window.devMatchBackend.client.from('projects')
      .select('id,title,project_type,category,price,data').eq('owner_id',client.id)
      .eq('project_kind','request').eq('status','open').order('updated_at',{ascending:false});
    if(requestError)throw requestError;
    if(!user&&!requests.length){showUnavailable('This client has no public open project requests.');return;}
    const profile=client.profile_data||{};
    const name=String(client.display_name||'DEV-MATCH member');
    const location=String(profile.city||'Location not provided');
    const business=String(profile.companyName||name);
    document.title=`${name} — Client Profile | DEV-MATCH`;
    document.getElementById('clientBreadcrumb').textContent=name;
    document.getElementById('clientAvatar').textContent=initials(name);
    document.getElementById('clientName').textContent=name;
    document.getElementById('clientBusiness').textContent=business;
    document.getElementById('clientLocation').textContent=location;
    document.getElementById('clientBusinessType').textContent=String(profile.industry||'Not provided');
    document.getElementById('clientActivity').textContent='DEV-MATCH member';
    document.getElementById('clientRequestCount').textContent=String(requests.length);
    document.getElementById('contactClient').href=user
      ?`devmatch-chat.html?contact=${encodeURIComponent(client.id)}&client=${encodeURIComponent(client.id)}`
      :'devmatch-auth.html?mode=login';
    document.getElementById('requestCount').textContent=`${requests.length} ${requests.length===1?'request':'requests'}`;
    document.getElementById('clientRequests').innerHTML=requests.length?requests.map(row=>{
      const data=row.data&&typeof row.data==='object'?row.data:{};
      const tags=[row.category,row.project_type,...(Array.isArray(data.stack)?data.stack:[])].filter(Boolean);
      return `<article class="request-card"><div class="request-card-heading"><h3>${escapeHtml(row.title)}</h3><span class="request-budget">${escapeHtml(row.price||data.budgetLabel||data.budget||'Budget not specified')}</span></div><p class="request-description">${escapeHtml(data.description||data.overview||'')}</p><div class="request-tags">${tags.map(tag=>`<span>${escapeHtml(tag)}</span>`).join('')}</div></article>`;
    }).join(''):'<p class="request-description">This client has no open project requests right now.</p>';
    status.hidden=true;
    profileCard.hidden=false;
    requestsSection.hidden=false;
  }catch(error){
    console.error('Unable to load the client profile from Supabase.',error);
    showUnavailable('The client profile could not be loaded. Check your connection and try again.');
  }
})();
