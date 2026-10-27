const roleCards=[...document.querySelectorAll('[data-role]')];
const continueLink=document.getElementById('continueLink');
const continueText=document.getElementById('continueText');
const loginLinks=document.querySelectorAll('.login');
const initialRole=new URLSearchParams(window.location.search).get('role');
let selectedRole=initialRole==='client'?'client':'dev';

function selectRole(role){
  selectedRole=role;
  roleCards.forEach(card=>{
    const selected=card.dataset.role===role;
    card.classList.toggle('selected',selected);
    card.setAttribute('aria-pressed',String(selected));
  });
  const label=role==='dev'?'Developer':'Client';
  continueText.textContent='Continue as '+label;
  continueLink.href='devmatch-auth.html?mode=register&role='+role;
  loginLinks.forEach(link=>link.href='devmatch-auth.html?mode=login&role='+role);
}

roleCards.forEach(card=>card.addEventListener('click',()=>selectRole(card.dataset.role)));
selectRole(selectedRole);
