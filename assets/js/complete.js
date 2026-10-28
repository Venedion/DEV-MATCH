const role=new URLSearchParams(window.location.search).get('role')==='client'?'client':'dev';
if(role==='client'){
  document.getElementById('title').textContent='Your profile is ready!';
  document.getElementById('description').textContent='Your profile details are saved. Explore developers and find the right person to bring your idea to life.';
  document.querySelector('#primaryAction span').textContent='Discover projects';
  document.getElementById('primaryAction').href='devmatch-discover-projects.html';
  document.getElementById('dashboardAction').href='devmatch-client-dashboard.html';
}
