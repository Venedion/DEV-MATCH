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
  const privateProfileFields = ['bankName', 'accountNumber', 'accountHolder', 'npwp'];
  let activeAccountRole = null;
  if (protectedPage) {
    const style = document.createElement('style');
    style.id = 'auth-pending';
    style.textContent = 'body{visibility:hidden}';
    document.head.append(style);
  }
  function clearCache() {
    for (const key of Object.keys(localStorage)) {
      if (/^devmatch[-_]/.test(key)
        && key !== 'devmatch-language'
        && !key.startsWith('devmatch-user-data-migration-')) localStorage.removeItem(key);
    }
    sessionStorage.removeItem('devmatch-profile-draft');
  }
  function profileDataForCache(profileData) {
    const cachedData = {...profileData};
    privateProfileFields.forEach(field => delete cachedData[field]);
    return cachedData;
  }
  function sanitizeStoredProfile(storage, key) {
    const stored = storage.getItem(key);
    if (!stored) return;
    try {
      const profile = JSON.parse(stored);
      if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
        storage.removeItem(key);
        return;
      }
      if (privateProfileFields.some(field => Object.hasOwn(profile, field))) {
        storage.setItem(key, JSON.stringify(profileDataForCache(profile)));
      }
    } catch {
      storage.removeItem(key);
    }
  }
  Object.keys(localStorage).filter(key => key.startsWith('devmatch-profile-'))
    .forEach(key => sanitizeStoredProfile(localStorage, key));
  sanitizeStoredProfile(sessionStorage, 'devmatch-profile-draft');
  function cache(row, user) {
    const profile = {...profileDataForCache(row.profile_data), username: row.username || '', displayName: row.display_name,
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
  async function loadPrivateProfileFields() {
    const user = await currentAccount();
    const {data, error} = await client.from('profiles').select('profile_data').eq('id', user.id).single();
    if (error) throw error;
    return Object.fromEntries(privateProfileFields
      .filter(field => Object.hasOwn(data.profile_data || {}, field))
      .map(field => [field, data.profile_data[field]]));
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
    activeAccountRole = row.account_role;
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

  function readLegacyIds(storageKey) {
    const stored = localStorage.getItem(storageKey);
    if (stored === null) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? [...new Set(parsed.filter(id => typeof id === 'string' && id.length > 0))] : [];
    } catch (error) {
      console.warn(`Ignoring invalid saved data in ${storageKey}.`, error);
      return [];
    }
  }

  async function loadFavorites() {
    const user = await currentAccount();
    if (!activeAccountRole) {
      const profile = await loadProfile(user);
      activeAccountRole = profile.account_role;
    }
    const {data, error} = await client.from('favorites')
      .select('item_type,item_id')
      .eq('user_id', user.id);
    if (error) throw error;

    const migrationKey = `devmatch-user-data-migration-${user.id}-favorites-v1`;
    let rows = data || [];
    if (localStorage.getItem(migrationKey) !== 'complete') {
      if (rows.length === 0) {
        const legacyFavorites = activeAccountRole === 'client'
          ? [
              ['project', 'devmatch-client-project-favorites'],
              ['developer', 'devmatch-client-dev-favorites']
            ]
          : [
              ['project', 'devmatch-developer-project-favorites'],
              ['client', 'devmatch-favorite-clients']
            ];
        const projectStorageKey = legacyFavorites.find(([type]) => type === 'project')[1];
        if (localStorage.getItem(projectStorageKey) === null) {
          legacyFavorites.push(['project', 'devmatch-client-favorites']);
        }
        const imported = legacyFavorites.flatMap(([item_type, storageKey]) =>
          readLegacyIds(storageKey).map(item_id => ({ user_id: user.id, item_type, item_id }))
        );
        if (imported.length) {
          const {error: insertError} = await client.from('favorites')
            .upsert(imported, {onConflict: 'user_id,item_type,item_id', ignoreDuplicates: true})
          if (insertError) throw insertError;
          const {data: refreshed, error: refreshError} = await client.from('favorites')
            .select('item_type,item_id')
            .eq('user_id', user.id);
          if (refreshError) throw refreshError;
          rows = refreshed || [];
        }
      }
      localStorage.setItem(migrationKey, 'complete');
    }

    return rows.map(({item_type, item_id}) => ({type: item_type, id: item_id}));
  }

  async function setFavorite(type, id, saved) {
    if (!['project', 'developer', 'client'].includes(type) || typeof id !== 'string' || !id) {
      throw new TypeError('A supported favorite type and item ID are required.');
    }
    const user = await currentAccount();
    const query = client.from('favorites');
    const result = saved
      ? await query.upsert(
          {user_id: user.id, item_type: type, item_id: id},
          {onConflict: 'user_id,item_type,item_id', ignoreDuplicates: true}
        )
      : await query.delete().eq('user_id', user.id).eq('item_type', type).eq('item_id', id);
    if (result.error) throw result.error;
  }

  async function clearFavorites(type) {
    if (!['project', 'developer', 'client'].includes(type)) {
      throw new TypeError('A supported favorite type is required.');
    }
    const user = await currentAccount();
    const {error} = await client.from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('item_type', type);
    if (error) throw error;
  }

  async function loadNotificationReads() {
    const user = await currentAccount();
    const {data, error} = await client.from('notification_reads')
      .select('notification_id')
      .eq('user_id', user.id);
    if (error) throw error;

    const migrationKey = `devmatch-user-data-migration-${user.id}-notification-reads-v1`;
    let rows = data || [];
    if (localStorage.getItem(migrationKey) !== 'complete') {
      if (rows.length === 0) {
        const storageKey = `devmatch-${activeAccountRole}-notifications-read`;
        const imported = readLegacyIds(storageKey).map(notification_id => ({
          user_id: user.id,
          notification_id
        }));
        if (imported.length) {
          const {error: insertError} = await client.from('notification_reads')
            .upsert(imported, {onConflict: 'user_id,notification_id', ignoreDuplicates: true})
          if (insertError) throw insertError;
          const {data: refreshed, error: refreshError} = await client.from('notification_reads')
            .select('notification_id')
            .eq('user_id', user.id);
          if (refreshError) throw refreshError;
          rows = refreshed || [];
        }
      }
      localStorage.setItem(migrationKey, 'complete');
    }

    return rows.map(row => row.notification_id);
  }

  async function markNotificationsRead(notificationIds) {
    const ids = [...new Set(notificationIds.filter(id => typeof id === 'string' && id.length > 0))];
    if (!ids.length) return;
    const user = await currentAccount();
    const {error} = await client.from('notification_reads').upsert(
      ids.map(notification_id => ({user_id: user.id, notification_id, read_at: new Date().toISOString()})),
      {onConflict: 'user_id,notification_id'}
    );
    if (error) throw error;
  }

  async function loadNotificationPreferences() {
    const user = await currentAccount();
    const {data, error} = await client.from('profiles')
      .select('profile_data')
      .eq('id', user.id)
      .single();
    if (error) throw error;

    const preferences = data.profile_data?.notificationPreferences;
    if (preferences && typeof preferences === 'object' && !Array.isArray(preferences)) return preferences;

    const storageKey = `devmatch-${activeAccountRole}-notification-preferences`;
    const legacy = localStorage.getItem(storageKey);
    if (legacy === null) return {};
    try {
      const parsed = JSON.parse(legacy);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const {data: updatedProfileData, error: saveError} = await client.rpc(
        'save_notification_preferences',
        {p_preferences: parsed}
      );
      if (saveError) throw saveError;
      return updatedProfileData.notificationPreferences || {};
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        console.warn(`Ignoring invalid saved notification preferences in ${storageKey}.`, parseError);
        return {};
      }
      throw parseError;
    }
  }

  async function saveNotificationPreferences(preferences) {
    const user = await currentAccount();
    const {data, error} = await client.rpc('save_notification_preferences', {p_preferences: preferences});
    if (error) throw error;
    const storageKey = `devmatch-${activeAccountRole}-notification-preferences`;
    localStorage.setItem(storageKey, JSON.stringify(preferences));
    return data;
  }

  function projectRowToRecord(row) {
    return {
      ...row.data,
      id: row.id,
      status: row.status,
      updated: new Date(row.updated_at).getTime(),
      ...(row.cover_image ? {coverImage: row.cover_image} : {})
    };
  }

  async function loadOwnedProjects(kind, legacyRecords = []) {
    if (!['portfolio', 'request'].includes(kind)) {
      throw new TypeError('A supported project kind is required.');
    }
    const user = await currentAccount();
    const {data, error} = await client.from('projects')
      .select('id,legacy_id,title,project_type,category,cover_image,status,data,updated_at')
      .eq('owner_id', user.id)
      .eq('project_kind', kind)
      .order('updated_at', {ascending: false});
    if (error) throw error;

    const migrationKey = `devmatch-user-data-migration-${user.id}-${kind}-v1`;
    let rows = data || [];
    if (rows.length === 0 && localStorage.getItem(migrationKey) !== 'complete') {
      const imported = legacyRecords
        .filter(record => record && typeof record === 'object' && typeof record.id === 'string')
        .map(record => {
          const {coverImage, ...recordData} = record;
          return {
            owner_id: user.id,
            project_kind: kind,
            legacy_id: record.id,
            title: String(record.title || ''),
            project_type: String(record.projectType || record.type || ''),
            category: String(record.category || ''),
            price: String(record.price || record.budgetLabel || record.budget || ''),
            price_type: String(record.priceType || ''),
            cover_image: String(coverImage || ''),
            status: kind === 'portfolio'
              ? (record.status === 'published' ? 'published' : 'draft')
              : (['open', 'closed'].includes(record.status) ? record.status : 'draft'),
            data: recordData
          };
        });
      if (imported.length) {
        const {error: insertError} = await client.from('projects').upsert(imported, {
          onConflict: 'owner_id,project_kind,legacy_id',
          ignoreDuplicates: true
        });
        if (insertError) throw insertError;
        const {data: refreshed, error: refreshError} = await client.from('projects')
          .select('id,legacy_id,title,project_type,category,cover_image,status,data,updated_at')
          .eq('owner_id', user.id)
          .eq('project_kind', kind)
          .order('updated_at', {ascending: false});
        if (refreshError) throw refreshError;
        rows = refreshed || [];
      }
      localStorage.setItem(migrationKey, 'complete');
    }

    return rows.map(projectRowToRecord);
  }

  async function saveOwnedProject(kind, record) {
    if (!['portfolio', 'request'].includes(kind) || !record || typeof record !== 'object') {
      throw new TypeError('A supported project kind and project record are required.');
    }
    const user = await currentAccount();
    const {coverImage, ...recordData} = record;
    const isDatabaseId = typeof record.id === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.id);
    const payload = {
      owner_id: user.id,
      project_kind: kind,
      title: String(record.title || ''),
      project_type: String(record.projectType || record.type || ''),
      category: String(record.category || ''),
      price: String(record.price || record.budgetLabel || record.budget || ''),
      price_type: String(record.priceType || ''),
      cover_image: String(record.coverImage || ''),
      status: kind === 'portfolio'
        ? (record.status === 'published' ? 'published' : 'draft')
        : (['open', 'closed'].includes(record.status) ? record.status : 'draft'),
      data: recordData,
      updated_at: new Date().toISOString()
    };
    const query = isDatabaseId
      ? client.from('projects').update(payload).eq('id', record.id).eq('owner_id', user.id)
      : client.from('projects').insert(payload);
    const {data, error} = await query.select('id').single();
    if (error) throw error;
    return data.id;
  }

  async function deleteOwnedProject(kind, id) {
    if (!['portfolio', 'request'].includes(kind) || typeof id !== 'string' || !id) {
      throw new TypeError('A supported project kind and ID are required.');
    }
    const user = await currentAccount();
    const {error} = await client.from('projects').delete()
      .eq('id', id)
      .eq('owner_id', user.id)
      .eq('project_kind', kind);
    if (error) throw error;
  }

  async function loadProjectComments(projectId) {
    if (typeof projectId !== 'string' || !projectId) {
      throw new TypeError('A project ID is required.');
    }
    const {data, error} = await client.from('comments')
      .select('id,project_id,user_id,text,author_name,author_initials,created_at')
      .eq('project_id', projectId)
      .order('created_at', {ascending: true});
    if (error) throw error;
    return (data || []).map(comment => ({
      id: comment.id,
      projectId: comment.project_id,
      userId: comment.user_id,
      text: comment.text,
      name: comment.author_name,
      initials: comment.author_initials,
      time: comment.created_at
    }));
  }

  async function addProjectComment(projectId, text) {
    if (typeof projectId !== 'string' || !projectId
      || typeof text !== 'string' || !text.trim() || text.trim().length > 5000) {
      throw new TypeError('A project ID and comment between 1 and 5000 characters are required.');
    }
    const user = await currentAccount();
    const {data, error} = await client.from('comments')
      .insert({project_id: projectId, user_id: user.id, text: text.trim()})
      .select('id,project_id,user_id,text,author_name,author_initials,created_at')
      .single();
    if (error) throw error;
    return {
      id: data.id,
      projectId: data.project_id,
      userId: data.user_id,
      text: data.text,
      name: data.author_name,
      initials: data.author_initials,
      time: data.created_at
    };
  }

  async function saveProfile(value, {includePrivateFields = false} = {}){
    const user=await currentAccount();
    const {email,phone,username,role,...details}=value;
    const suppliedPrivateFields = {};
    privateProfileFields.forEach(field => {
      if (Object.hasOwn(details, field)) {
        suppliedPrivateFields[field] = details[field];
        delete details[field];
      }
    });
    const {data: currentProfile, error: profileError} = await client.from('profiles')
      .select('profile_data')
      .eq('id', user.id)
      .single();
    if (profileError) throw profileError;
    privateProfileFields.forEach(field => {
      if (Object.hasOwn(currentProfile.profile_data || {}, field)) {
        details[field] = currentProfile.profile_data[field];
      }
    });
    if (includePrivateFields) Object.assign(details, suppliedPrivateFields);
    if (Object.hasOwn(currentProfile.profile_data, 'notificationPreferences')) {
      details.notificationPreferences = currentProfile.profile_data.notificationPreferences;
    }
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
  window.devMatchBackend = {
    client,
    ready,
    clearCache,
    profileDataForCache,
    cache,
    loadProfile,
    loadPrivateProfileFields,
    destination,
    saveProfile,
    changePassword,
    loadFavorites,
    setFavorite,
    clearFavorites,
    loadNotificationReads,
    markNotificationsRead,
    loadNotificationPreferences,
    saveNotificationPreferences,
    loadOwnedProjects,
    saveOwnedProject,
    deleteOwnedProject,
    loadProjectComments,
    addProjectComment
  };
})();
