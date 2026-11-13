(()=>{
const params=new URLSearchParams(window.location.search);
if(!params.has('mode')){
  window.location.replace('devmatch-landing.html');
  return;
}
const $=id=>document.getElementById(id);
const copy={
 dev:{tag:'&lt;&gt; Developer account',badge:'&lt;&gt; Developer Mode',side:'Your portfolio,<br>now a storefront.',title:'Create your developer account',sub:'Start showcasing your projects in minutes.',
  q:'“My first project listing got 3 WhatsApp messages in the first week. Clients finally see what I can build.”',av:'RA',name:'Rizky Aditya',role:'Full-stack developer · Medan',other:'Not a developer?',sw:'Switch to client'},
 cli:{tag:'Client account',badge:'Client Mode',side:'Find the right<br>developer, priced upfront.',title:'Create your client account',sub:'Browse projects and post your request in minutes.',
  q:'“I compared three developers by price and portfolio in one evening, then sent my brief straight on WhatsApp.”',av:'AN',name:'Anindya',role:'Café owner · Medan',other:'Are you a developer?',sw:'Switch to developer'}
};
let role=params.get('role')==='client'?'cli':'dev';
let mode=params.get('mode')==='login'?'log':'reg';
let registrationChallengePromise=null;
const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
async function registrationFunctionError(error,fallback){
  const response=error?.context;
  if(response&&typeof response.clone==='function'){
    try{
      const body=await response.clone().json();
      if(typeof body.error==='string')return new Error(body.error);
    }catch{}
  }
  return new Error(error?.message||fallback);
}
function loadRegistrationChallenge(){
  if(!registrationChallengePromise){
    registrationChallengePromise=window.devMatchBackend.client.functions
      .invoke('register-challenge',{method:'GET'})
      .then(async({data:challenge,error})=>{
        if(error)throw await registrationFunctionError(error,'Unable to initialize registration protection.');
        if(typeof challenge.payload!=='string'||typeof challenge.signature!=='string'||challenge.difficulty!==14)
          throw new Error('Unable to initialize registration protection. Reload the page and try again.');
        return challenge;
      })
      .catch(error=>{registrationChallengePromise=null;throw error;});
  }
  return registrationChallengePromise;
}
function warmRegistrationChallenge(){
  if(mode==='reg')loadRegistrationChallenge().catch(()=>{});
}
async function requestRegistrationPermit(email){
  const challenge=await loadRegistrationChallenge();
  const status=$('authStatus');
  if(status)status.textContent='Checking your browser…';
  const worker=new Worker('/assets/js/registration-pow-worker.js');
  let counter;
  try{
    counter=await new Promise((resolve,reject)=>{
      worker.onmessage=event=>{
        if(Number.isSafeInteger(event.data.counter))resolve(event.data.counter);
        else if(event.data.error)reject(new Error(event.data.error));
      };
      worker.onerror=()=>reject(new Error('Unable to complete registration verification.'));
      worker.postMessage({input:`${challenge.payload}.${challenge.signature}`,difficulty:challenge.difficulty});
    });
  }finally{worker.terminate();}
  const {data:result,error}=await window.devMatchBackend.client.functions.invoke('register-permit',{
    body:{email,challenge,counter,website:$('website').value}
  });
  if(error)throw await registrationFunctionError(error,'Unable to verify registration. Please try again.');
  if(typeof result.registrationPermit!=='string')throw new Error('Unable to verify registration. Please try again.');
  return result.registrationPermit;
}
function render(){
  const c=copy[role],reg=mode==='reg';
  document.querySelectorAll('.reg').forEach(e=>e.classList.toggle('hide',!reg));
  document.querySelectorAll('.log').forEach(e=>e.classList.toggle('hide',reg));
  $('sideBadge').innerHTML=c.badge;$('sideTitle').innerHTML=reg?c.side:'Welcome back.';
  $('qText').textContent=c.q;$('qAv').textContent=c.av;$('qName').textContent=c.name;$('qRole').textContent=c.role;
  $('roleTag').innerHTML=c.tag;$('roleline').classList.toggle('hide',!reg);
  $('switchWrap').innerHTML=c.other+' <button type="button" class="link" id="sw">'+c.sw+'</button>';
  $('sw').onclick=()=>{role=role==='dev'?'cli':'dev';clearErr();render()};
  $('title').textContent=reg?c.title:'Log in to DEV-MATCH';
  $('sub').textContent=reg?c.sub:'Welcome back. Enter your details to continue.';
  $('emailLabel').textContent='Email';
  $('email').type='email';$('email').placeholder='you@example.com';
  $('pass').autocomplete=reg?'new-password':'current-password';
  $('pass').placeholder=reg?'8+ chars, 1 uppercase, 1 special character':'Your password';
  $('submit').textContent=reg?'Create account':'Log in';
  $('alt').innerHTML=reg?'Already have an account? <button class="link" type="button" id="toggle">Log in</button>':'New to DEV-MATCH? <button class="link" type="button" id="toggle">Create an account</button>';
  $('toggle').onclick=()=>{mode=reg?'log':'reg';registrationChallengePromise=null;clearErr();render();warmRegistrationChallenge()};
  document.title=(reg?'Create your account':'Log in')+' — DEV-MATCH';
  userHint();
}
function userHint(){const v=$('user').value.trim().toLowerCase().replace(/[^a-z0-9_.]/g,'');$('userHint').textContent='Visible on your public profile · dev-match.id/'+(v||'yourname')}
function setErr(k,t){$('g-'+k).classList.toggle('err',!!t);$('e-'+k).textContent=t||''}
function clearErr(){['user','email','phone','pass','terms'].forEach(k=>{if($('g-'+k))$('g-'+k).classList.remove('err');$('e-'+k).textContent=''})}
function score(p){let s=0;if(p.length>=8)s++;if(/[a-z]/.test(p)&&/[A-Z]/.test(p))s++;if(/\d/.test(p))s++;if(/[^A-Za-z0-9]/.test(p)||p.length>=14)s++;return p?Math.max(1,s):0}
$('pass').addEventListener('input',()=>{
  const s=score($('pass').value),m=$('meter');
  m.className='meter '+(s<=1?'w':s<=2?'m':'');
  [...m.children].forEach((b,i)=>b.classList.toggle('on',i<s));
  const t=['','Weak password','Fair password','Good password','Strong password'][s];
  $('strength').textContent=t;$('strength').style.color=s<=1?'var(--bad)':s<=2?'#d97706':'var(--ok)';
});
$('user').addEventListener('input',userHint);
$('phone').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').replace(/^0+/,'')});
$('eye').onclick=()=>{const s=$('pass').type==='password';$('pass').type=s?'text':'password';$('eye').setAttribute('aria-label',s?'Hide password':'Show password')};
$('form').addEventListener('submit',async e=>{
  e.preventDefault();clearErr();let bad=false;const reg=mode==='reg';
  const u=$('user').value.trim(),em=$('email').value.trim(),ph=$('phone').value,pw=$('pass').value;
  if(reg){
    if(!/^[A-Za-z0-9_.]{3,24}$/.test(u)){setErr('user','Use 3–24 letters, numbers, dots or underscores.');bad=true}
    if(!emailRe.test(em)){setErr('email','Enter a valid email address, like you@example.com.');bad=true}
    if(ph.length<9||ph.length>13){setErr('phone','Enter your number without the leading 0, like 812 3456 7890.');bad=true}
    if(pw.length<8){setErr('pass','Password needs at least 8 characters.');bad=true}
    else if(!/[A-Z]/.test(pw)){setErr('pass','Password needs at least one uppercase letter.');bad=true}
    else if(!/[^A-Za-z0-9]/.test(pw)){setErr('pass','Password needs at least one special character, such as ! or #.');bad=true}
    if(!$('terms').checked){$('e-terms').textContent='Accept the Terms of Service and Privacy Policy to continue.';bad=true}
  }else{
    if(!em){setErr('email','Enter your email or phone number.');bad=true}
    if(!pw){setErr('pass','Enter your password.');bad=true}
  }
  if(bad){const f=document.querySelector('.in.err input');if(f)f.focus();return}
  $('submit').disabled=true;
  $('submit').textContent=reg?'Creating account…':'Logging in…';
  try {
    const backend=window.devMatchBackend;
    await backend.ready;
    const activeRole=role==='dev'?'dev':'client';
    if(reg){
      const registrationPermit=await requestRegistrationPermit(em);
      const {data,error}=await backend.client.auth.signUp({
        email:em,password:pw,
        options:{data:{username:u,phone:'+62'+ph,account_role:activeRole,registration_permit:registrationPermit}}
      });
      if(error)throw error;
      $('pass').value='';
      if(!data.session){
        sessionStorage.setItem('devmatch-verification-email',em);
        location.assign('devmatch-verify-email.html');
        return;
      }
    }else{
      const {error}=await backend.client.auth.signInWithPassword({email:em,password:pw});
      if(error)throw error;
    }
    const {data:{user},error}=await backend.client.auth.getUser();
    if(error||!user)throw error||new Error('Unable to verify your session.');
    const row=await backend.loadProfile(user);
    backend.clearCache();
    backend.cache(row,user);
    sessionStorage.setItem('devmatch-profile-draft',JSON.stringify({...backend.profileDataForCache(row.profile_data),username:row.username||'',role:row.account_role}));
    location.assign(backend.destination(row,user));
  }catch(error){
    setErr('pass',error.message||'Unable to connect. Please try again.');
  }finally{
    $('submit').disabled=false;
    $('submit').textContent=reg?'Create account':'Log in';
  }
});
render();
const status=document.createElement('p');
status.id='authStatus';status.setAttribute('role','status');status.style.marginTop='16px';$('form').append(status);
if(params.get('reset')==='success')status.textContent='Password updated. Log in with your new password.';
if(params.get('error')==='connection')status.textContent='Unable to connect. Please try logging in again.';
warmRegistrationChallenge();
})();
