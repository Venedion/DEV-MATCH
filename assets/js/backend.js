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
  function destination(row) {
    if(!row.account_verified)return 'devmatch-verify.html';
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
    if(!row.account_verified){location.replace('devmatch-verify.html');return null;}
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
  async function authCapabilities(){
    const response=await fetch('https://yxwktllqbmhustmhdaqi.supabase.co/auth/v1/settings',{
      headers:{apikey:'sb_publishable_9JeJarcXaZgNRiawz81gjw_PTaXtKli'}
    });
    if(!response.ok)throw new Error('Tidak dapat memeriksa layanan verifikasi. Coba lagi.');
    return response.json();
  }
  window.devMatchBackend = {client, ready, clearCache, cache, loadProfile, destination, authCapabilities};
})();
