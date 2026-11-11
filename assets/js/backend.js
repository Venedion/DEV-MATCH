/* Supabase JS 2.119.0; publishable key is safe for browser use with RLS. */
(() => {
  const recovery = location.hash.includes('type=recovery');
  if(recovery)sessionStorage.setItem('devmatch-recovery','1');
  const callbackError=new URLSearchParams(location.hash.slice(1)).get('error');
  if(callbackError){
    sessionStorage.removeItem('devmatch-recovery');
    sessionStorage.setItem('devmatch-recovery-error','This email link is invalid or expired. Request a new reset link.');
  }
  const client = window.supabase.createClient(
    'https://yxwktllqbmhustmhdaqi.supabase.co',
    'sb_publishable_9JeJarcXaZgNRiawz81gjw_PTaXtKli'
  );
  const page = location.pathname.split('/').pop();
  const protectedPage = /^devmatch-(dashboard|client-dashboard|profile|complete|my-profile|my-projects|settings|favorites|chat|notifications|developer-notifications)\.html$/.test(page);
  if (protectedPage) {
    const style = document.createElement('style');
    style.id = 'auth-pending';
    style.textContent = 'body{visibility:hidden}';
    document.head.append(style);
  }
  function clearCache() {
    for (const key of Object.keys(localStorage)) {
      if (/^devmatch[-_]/.test(key) && key !== 'devmatch-language') localStorage.removeItem(key);
    }
    sessionStorage.removeItem('devmatch-profile-draft');
  }
  function cache(row, user) {
    const profile = {...row.profile_data, username: row.username || '', displayName: row.display_name,
      phone: row.phone || '', email: user.email, role: row.account_role, googleConnected: false};
    const key = 'devmatch-profile-' + row.account_role;
    const value = JSON.stringify(profile);
    const changed = localStorage.getItem(key) !== value;
    localStorage.setItem(key, value);
    localStorage.setItem('devmatch-active-role', row.account_role);
    return changed;
  }
  async function loadProfile(user) {
    const {data, error} = await client.from('profiles').select('*').eq('id', user.id).single();
    if (error) throw error;
    return data;
  }
  function destination(row,user) {
    if(!user?.email_confirmed_at)return 'devmatch-verify-email.html';
    return row.onboarding_complete
      ? (row.account_role === 'client' ? 'devmatch-client-dashboard.html' : 'devmatch-dashboard.html')
      : 'devmatch-profile.html?role=' + row.account_role;
  }
  const ready = (async () => {
    const {data: {user}, error} = await client.auth.getUser();
    if (!user || error) {
      if(sessionStorage.getItem('devmatch-recovery')==='1' && page!=='devmatch-reset-password.html'){
        location.replace('devmatch-reset-password.html');return null;
      }
      if (protectedPage) {
        clearCache();
        location.replace('devmatch-auth.html?mode=login');
      }
      return null;
    }
    if(sessionStorage.getItem('devmatch-recovery')==='1' && page!=='devmatch-reset-password.html') {
      location.replace('devmatch-reset-password.html');return null;
    }
    if (!protectedPage) return user;
    const row = await loadProfile(user);
    if(!user.email_confirmed_at){location.replace('devmatch-verify-email.html');return null;}
    if(['devmatch-settings.html','devmatch-my-profile.html'].includes(page)){
      const query=new URLSearchParams(location.search);
      if(query.get('role')!==row.account_role){query.set('role',row.account_role);location.replace(page+'?'+query);return null;}
    }
    const changed = cache(row, user);
    if (page === 'devmatch-profile.html' && new URLSearchParams(location.search).get('role') !== row.account_role) {
      location.replace('devmatch-profile.html?role=' + row.account_role);
      return null;
    }
    if (changed) { location.reload(); return null; }
    document.getElementById('auth-pending')?.remove();
    return user;
  })().catch(() => {
    if (protectedPage) location.replace('devmatch-auth.html?mode=login&error=connection');
    return null;
  });
  document.addEventListener('click', async event => {
    if (!event.target.closest?.('.header-account-logout')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const {error} = await client.auth.signOut();
    if (error) { alert('Unable to log out. Please try again.'); return; }
    clearCache();
    location.assign('devmatch-auth.html?mode=login');
  }, true);
  async function currentAccount(){
    const initial=await ready;
    const {data:{user},error}=await client.auth.getUser();
    if(error||!initial||!user||initial.id!==user.id)throw new Error('Your session changed. Reload the page and log in again.');
    return user;
  }
  async function saveProfile(value){
    const user=await currentAccount();
    const {email,phone,username,role,...details}=value;
    const {data,error}=await client.from('profiles').update({display_name:String(details.displayName||''),profile_data:details}).eq('id',user.id).select().single();
    if(error)throw error;
    cache(data,user);return data;
  }
  async function changePassword(currentPassword,password){
    const user=await currentAccount();
    const {data,error}=await client.auth.signInWithPassword({email:user.email,password:currentPassword});
    if(error)throw error;
    if(data.user?.id!==user.id)throw new Error('Your session changed. Please log in again.');
    const changed=await client.auth.updateUser({password});
    if(changed.error)throw changed.error;
  }
  window.devMatchBackend = {client, ready, clearCache, cache, loadProfile, destination,saveProfile,changePassword};
})();
