(function(){
  'use strict';

  const clientId=new URLSearchParams(window.location.search).get('client');
  const clients=Array.isArray(window.DEVMATCH_SAMPLE_CLIENTS)?window.DEVMATCH_SAMPLE_CLIENTS:[];
  const client=clients.find(item=>item.id===clientId);
  const profileCard=document.getElementById('clientProfile');
  const requestsSection=document.getElementById('clientRequestsSection');
  const unavailable=document.getElementById('profileUnavailable');

  if(!client){
    unavailable.hidden=false;
    return;
  }

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const requestUrl=`devmatch-chat.html?contact=${encodeURIComponent(client.contactId)}&client=${encodeURIComponent(client.id)}`;
  document.title=`${client.name} — Client Profile | DEV-MATCH`;
  document.getElementById('clientBreadcrumb').textContent=client.name;
  document.getElementById('clientAvatar').textContent=client.initials;
  document.getElementById('clientName').textContent=client.name;
  document.getElementById('clientBusiness').textContent=client.business;
  document.getElementById('clientLocation').textContent=client.location;
  document.getElementById('clientBusinessType').textContent=client.businessType;
  document.getElementById('clientActivity').textContent=client.activeText;
  document.getElementById('clientRequestCount').textContent=String(client.openRequestsCount);
  document.getElementById('contactClient').href=requestUrl;

  const requests=Array.isArray(client.requests)?client.requests:[];
  document.getElementById('requestCount').textContent=`${requests.length} ${requests.length===1?'request':'requests'}`;
  document.getElementById('clientRequests').innerHTML=requests.length
    ?requests.map(request=>{
      const tags=[request.category,request.type,...(Array.isArray(request.tags)?request.tags:[])].filter(Boolean);
      return `<article class="request-card">
        <div class="request-card-heading"><h3>${escapeHtml(request.title)}</h3><span class="request-budget">${escapeHtml(request.budget)}</span></div>
        <p class="request-description">${escapeHtml(request.description)}</p>
        <div class="request-tags">${tags.map(tag=>`<span>${escapeHtml(tag)}</span>`).join('')}</div>
      </article>`;
    }).join('')
    :'<p class="request-description">This client has no open project requests right now.</p>';

  profileCard.hidden=false;
  requestsSection.hidden=false;
})();
