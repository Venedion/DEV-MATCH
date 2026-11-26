const role=new URLSearchParams(window.location.search).get('role')==='client'?'client':'dev';
if(role==='client'){
  document.getElementById('title').textContent='Your profile is ready!';
  document.getElementById('description').textContent='Your profile details are saved. Explore developers and find the right person to bring your idea to life.';
  const primaryAction=document.getElementById('primaryAction');
  primaryAction.querySelector('span').textContent='Post a request';
  primaryAction.href='devmatch-client-dashboard.html#request-new';
  const dashboardAction=document.getElementById('dashboardAction');
  dashboardAction.href='devmatch-discover-projects.html';
  dashboardAction.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg><span>Explore</span>';
}
