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
  const protectedPage = /^devmatch-(dashboard|client-dashboard|profile|complete|verify-phone|my-profile|my-projects|settings|favorites|chat|notifications|developer-notifications)\.html$/.test(page);
  const roleSpecificPages = {
    'devmatch-client-dashboard.html': 'client',
    'devmatch-notifications.html': 'client',
    'devmatch-discover-projects.html': 'client',
    'devmatch-discover-project-detail.html': 'client',
    'devmatch-find-developers.html': 'client',
    'devmatch-dashboard.html': 'dev',
    'devmatch-developer-notifications.html': 'dev',
    'devmatch-my-projects.html': 'dev',
    'devmatch-find-projects.html': 'dev',
    'devmatch-find-project-detail.html': 'dev',
    'devmatch-find-clients.html': 'dev'
  };
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
    sessionStorage.setItem('devmatch-active-role', row.account_role);
    return changed;
  }
  const workspaceKey = user => 'devmatch-workspace-' + user.id;
  async function loadProfile(user) {
    const {data, error} = await client.from('profiles').select('*').eq('id', user.id).single();
    if (error) throw error;
    const role = sessionStorage.getItem(workspaceKey(user));
    if (!['client', 'dev'].includes(role) || role === data.account_role) return data;
    const workspace = await client.from('account_workspaces').select('*')
      .eq('user_id', user.id).eq('role', role).maybeSingle();
    if (workspace.error) throw workspace.error;
    if (!workspace.data) { sessionStorage.removeItem(workspaceKey(user)); return data; }
    const {display_name, profile_data, onboarding_complete} = workspace.data;
    return {...data, account_role: role, display_name, profile_data, onboarding_complete};
  }
  async function hasWorkspace(role) {
    await currentAccount();
    const {data, error} = await client.rpc('has_account_workspace', {p_role: role});
    if (error) throw error;
    return data === true;
  }
  async function switchWorkspace(role, create = false) {
    const user = await currentAccount();
    const {data, error} = await client.rpc('switch_account_workspace', {p_role: role, p_create: create});
    if (error) throw error;
    // Selection is per user and per tab, never written to the shared profile.
    sessionStorage.setItem(workspaceKey(user), data.account_role);
    sessionStorage.removeItem('devmatch-profile-draft');
    activeAccountRole = data.account_role;
    cache(data, user);
    return data;
  }
  async function updateWorkspaceProfile(changes) {
    const user = await currentAccount();
    const current = await loadProfile(user);
    const primary = await client.from('profiles').select('account_role').eq('id', user.id).single();
    if (primary.error) throw primary.error;
    const payload = {};
    for (const field of ['display_name', 'profile_data', 'onboarding_complete']) {
      if (Object.hasOwn(changes, field)) payload[field] = changes[field];
    }
    const query = current.account_role === primary.data.account_role
      ? client.from('profiles').update(payload).eq('id', user.id)
      : client.from('account_workspaces').update(payload).eq('user_id', user.id).eq('role', current.account_role);
    const {data, error} = await query.select().single();
    if (error) throw error;
    const updated = {...current, ...payload};
    cache(updated, user);
    return updated;
  }
  async function loadPrivateProfileFields() {
    const user = await currentAccount();
    const data = await loadProfile(user);
    return Object.fromEntries(privateProfileFields
      .filter(field => Object.hasOwn(data.profile_data || {}, field))
      .map(field => [field, data.profile_data[field]]));
  }
  function destination(row,user) {
    if(!user?.email_confirmed_at)return 'devmatch-verify-email.html';
    if (!row.onboarding_complete && /^\+[1-9]\d{7,14}$/.test(row.phone || '')
      && !(row.phone_verified_at && row.verified_phone === row.phone)) {
      return 'devmatch-verify-phone.html';
    }
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
    if (!protectedPage && (!user || !Object.hasOwn(roleSpecificPages, page))) return user;
    const row = await loadProfile(user);
    activeAccountRole = row.account_role;
    if (protectedPage && !user.email_confirmed_at) {
      location.replace('devmatch-verify-email.html');
      return null;
    }
    if (roleSpecificPages[page] && row.account_role !== roleSpecificPages[page]) {
      location.replace(destination(row, user));
      return null;
    }
    if (!protectedPage) return user;
    if(['devmatch-settings.html','devmatch-my-profile.html','devmatch-favorites.html','devmatch-chat.html'].includes(page)){
      const query=new URLSearchParams(location.search);
      if(query.get('role')!==row.account_role){query.set('role',row.account_role);location.replace(page+'?'+query+location.hash);return null;}
    }
    const changed = cache(row, user);
    if (page === 'devmatch-profile.html' && new URLSearchParams(location.search).get('role') !== row.account_role) {
      const url = new URL(location.href);
      url.searchParams.set('role', row.account_role);
      location.replace(url.href);
      return null;
    }
    if (changed) { location.reload(); return null; }
    document.getElementById('auth-pending')?.remove();
    return user;
  })().catch(error => {
    if (protectedPage || Object.hasOwn(roleSpecificPages, page)) {
      console.error('Unable to verify the account role for this page.', error);
      location.replace('devmatch-auth.html?mode=login&error=connection');
    }
    return null;
  });
  let onlinePresenceChannel = null;
  let onlinePresenceUserId = null;
  let onlinePresenceGeneration = 0;
  function stopOnlinePresence() {
    onlinePresenceGeneration += 1;
    const channel = onlinePresenceChannel;
    onlinePresenceChannel = null;
    onlinePresenceUserId = null;
    if (channel) {
      void client.removeChannel(channel).then(result => {
        if (result !== 'ok') console.error('Unable to stop online presence.', result);
      }).catch(error => {
        console.error('Unable to stop online presence.', error);
      });
    }
  }
  function syncOnlinePresence(session) {
    const user = session?.user;
    if (!user?.id || !user.email_confirmed_at || !session.access_token) {
      stopOnlinePresence();
      return;
    }
    if (onlinePresenceUserId === user.id && onlinePresenceChannel) {
      void client.realtime.setAuth(session.access_token).catch(error => {
        console.error('Unable to refresh the online presence session token.', error);
      });
      return;
    }

    const generation = ++onlinePresenceGeneration;
    void client.realtime.setAuth(session.access_token).then(() => {
      if (generation !== onlinePresenceGeneration) return;
      stopOnlinePresence();
      const channel = client.channel(`devmatch-user-presence:${user.id}`, {
        config: {private: true, presence: {key: user.id}}
      });
      onlinePresenceChannel = channel;
      onlinePresenceUserId = user.id;
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          void channel.track({userId: user.id}).then(result => {
            if (result !== 'ok') console.error('Unable to publish online presence.', result);
          }).catch(error => {
            console.error('Unable to publish online presence.', error);
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Unable to subscribe to online presence.', status);
        }
      });
    }).catch(error => {
      console.error('Unable to authenticate online presence.', error);
    });
  }
  if (!window.__devmatchOnlinePresenceInitialized) {
    window.__devmatchOnlinePresenceInitialized = true;
    client.auth.onAuthStateChange((_event, session) => {
      syncOnlinePresence(session);
    });
    void ready.then(async user => {
      if (!user?.email_confirmed_at) return;
      const {data, error} = await client.auth.getSession();
      if (error) throw error;
      if (data.session?.user.id === user.id) syncOnlinePresence(data.session);
    }).catch(error => {
      console.error('Unable to initialize online presence.', error);
    });
    window.addEventListener('pagehide', () => {
      stopOnlinePresence();
    });
    window.addEventListener('pageshow', event => {
      if (!event.persisted) return;
      void client.auth.getSession().then(({data, error}) => {
        if (error) throw error;
        syncOnlinePresence(data.session);
      }).catch(error => {
        console.error('Unable to restore online presence.', error);
      });
    });
  }
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
    if(error||!initial||!user){
      clearCache();
      throw new Error('Your login session has expired. Log in again.');
    }
    if(initial.id!==user.id){
      clearCache();
      throw new Error('Your login session changed. Reload the page and log in again.');
    }
    return user;
  }

  async function getWorkspaceRole() {
    const user = await currentAccount();
    if (!activeAccountRole) activeAccountRole = (await loadProfile(user)).account_role;
    return activeAccountRole;
  }

  async function loadFavorites() {
    const user = await currentAccount();
    const role = await getWorkspaceRole();
    const {data, error} = await client.from('favorites').select('item_type,item_id')
      .eq('user_id',user.id).eq('workspace_role',role);
    if (error) throw error;
    // Anonymous device caches cannot establish ownership or workspace membership.
    return (data || []).map(({item_type,item_id}) => ({type:item_type,id:item_id}));
  }

  async function setFavorite(type,id,saved) {
    if (!['project','developer','client'].includes(type) || typeof id !== 'string' || !id) {
      throw new TypeError('A supported favorite type and item ID are required.');
    }
    const user=await currentAccount(); const role=await getWorkspaceRole();
    const query=client.from('favorites');
    const result=saved ? await query.upsert({user_id:user.id,workspace_role:role,item_type:type,item_id:id},
      {onConflict:'user_id,workspace_role,item_type,item_id',ignoreDuplicates:true})
      : await query.delete().eq('user_id',user.id).eq('workspace_role',role).eq('item_type',type).eq('item_id',id);
    if(result.error)throw result.error;
  }

  async function clearFavorites(type) {
    if (!['project','developer','client'].includes(type)) throw new TypeError('A supported favorite type is required.');
    const user=await currentAccount(); const role=await getWorkspaceRole();
    const {error}=await client.from('favorites').delete().eq('user_id',user.id).eq('workspace_role',role).eq('item_type',type);
    if(error)throw error;
  }

  async function loadNotificationReads() {
    const user=await currentAccount(); const role=await getWorkspaceRole();
    const {data,error}=await client.from('notification_reads').select('notification_id')
      .eq('user_id',user.id).eq('workspace_role',role);
    if(error)throw error;
    return (data||[]).map(row=>row.notification_id);
  }

  async function loadUnreadNotificationCount() {
    const user=await currentAccount(); const role=await getWorkspaceRole();
    const [readIds,{data,error}]=await Promise.all([loadNotificationReads(),
      client.from('notifications').select('id').eq('recipient_id',user.id).eq('recipient_role',role)]);
    if(error)throw error;
    const readSet=new Set(readIds);
    return (data||[]).filter(n=>!readSet.has(n.id)).length;
  }

  async function markNotificationsRead(notificationIds) {
    const ids=[...new Set(notificationIds.filter(id=>typeof id==='string'&&id.length>0))];
    if(!ids.length)return;
    const user=await currentAccount(); const role=await getWorkspaceRole();
    const {error}=await client.from('notification_reads').upsert(
      ids.map(notification_id=>({user_id:user.id,workspace_role:role,notification_id,read_at:new Date().toISOString()})),
      {onConflict:'user_id,workspace_role,notification_id'});
    if(error)throw error;
  }

  async function loadNotificationPreferences() {
    const user=await currentAccount(); const row=await loadProfile(user);
    return row.profile_data?.notificationPreferences || {};
  }

  async function saveNotificationPreferences(preferences) {
    const role=await getWorkspaceRole();
    const {data,error}=await client.rpc('save_notification_preferences',{p_preferences:preferences,p_role:role});
    if(error)throw error;
    const user=await currentAccount(); cache(await loadProfile(user),user);
    return data;
  }

  function projectRowToRecord(row) {
    const data = {...(row.data || {})};
    delete data.views;
    delete data.favorites;
    delete data.comments;
    return {
      ...data,
      id: row.id,
      status: row.status,
      created: row.created_at ? new Date(row.created_at).getTime() : Number(data.created) || 0,
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
      .select('id,legacy_id,title,project_type,category,cover_image,status,data,created_at,updated_at')
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
          const recordData = {...record};
          delete recordData.coverImage;
          delete recordData.views;
          delete recordData.favorites;
          delete recordData.comments;
          return {
            owner_id: user.id,
            project_kind: kind,
            legacy_id: record.id,
            title: String(record.title || ''),
            project_type: String(record.projectType || record.type || ''),
            category: String(record.category || ''),
            price: String(record.price || record.budgetLabel || record.budget || ''),
            price_type: String(record.priceType || ''),
            cover_image: String(record.coverImage || ''),
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
          .select('id,legacy_id,title,project_type,category,cover_image,status,data,created_at,updated_at')
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

  async function loadOwnedProjectMetrics() {
    await currentAccount();
    const {data, error} = await client.rpc('get_owned_project_metrics');
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Supabase returned invalid project metrics.');
    return data.map(row => {
      const metric = {
        id: row.project_id,
        views: Number(row.views),
        favorites: Number(row.favorites),
        comments: Number(row.comments)
      };
      if (typeof metric.id !== 'string' || !metric.id
        || ![metric.views, metric.favorites, metric.comments].every(value => Number.isSafeInteger(value) && value >= 0)) {
        throw new Error('Supabase returned invalid project metrics.');
      }
      return metric;
    });
  }

  async function saveOwnedProject(kind, record) {
    if (!['portfolio', 'request'].includes(kind) || !record || typeof record !== 'object') {
      throw new TypeError('A supported project kind and project record are required.');
    }
    const user = await currentAccount();
    const recordData = {...record};
    delete recordData.coverImage;
    delete recordData.views;
    delete recordData.favorites;
    delete recordData.comments;
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
    let columns = ['id', 'project_id', 'parent_comment_id', 'user_id', 'workspace_role', 'text', 'author_name', 'author_initials', 'created_at'];
    const loadComments = () => client.from('comments')
      .select(columns.join(','))
      .eq('project_id', projectId)
      .order('created_at', {ascending: true});
    let result = await loadComments();
    let repliesSupported = true;
    let workspaceRolesSupported = true;
    for (let attempt = 0; result.error && attempt < 2; attempt++) {
      const error = result.error;
      const message = error.message || '';
      if (error.code !== '42703' && error.code !== 'PGRST204'
        && !/parent_comment_id.*(does not exist|not found|schema cache)/i.test(message)
        && !/workspace_role.*(does not exist|not found|schema cache)/i.test(message)) break;
      const identifiesMissingColumn = /parent_comment_id|workspace_role/i.test(message);
      const parentColumnMissing = /parent_comment_id/i.test(message) || !identifiesMissingColumn;
      const workspaceRoleColumnMissing = /workspace_role/i.test(message) || !identifiesMissingColumn;
      if (parentColumnMissing && repliesSupported) {
        repliesSupported = false;
        columns = columns.filter(column => column !== 'parent_comment_id');
      }
      if (workspaceRoleColumnMissing && workspaceRolesSupported) {
        workspaceRolesSupported = false;
        columns = columns.filter(column => column !== 'workspace_role');
      }
      if (!parentColumnMissing && !workspaceRoleColumnMissing) {
        repliesSupported = false;
        workspaceRolesSupported = false;
        columns = columns.filter(column => column !== 'parent_comment_id' && column !== 'workspace_role');
      }
      result = await loadComments();
    }
    if (result.error) throw result.error;
    return {
      repliesSupported,
      comments: (result.data || []).map(comment => ({
        id: comment.id,
        projectId: comment.project_id,
        parentCommentId: comment.parent_comment_id || null,
        userId: comment.user_id,
        workspaceRole: comment.workspace_role || null,
        text: comment.text,
        name: comment.author_name,
        initials: comment.author_initials,
        time: comment.created_at
      }))
    };
  }

  async function loadCommentAuthorRoles(comments) {
    const authors = (Array.isArray(comments) ? comments : [])
      .map(comment => ({
        userId: comment?.userId || comment?.user_id,
        name: comment?.name || comment?.author_name
      }))
      .filter(comment => typeof comment.userId === 'string' && comment.userId);
    const userIds = [...new Set(authors.map(comment => comment.userId))];
    if (!userIds.length) return new Map();

    const {data, error} = await client.from('directory_people')
      .select('id,display_name,account_role')
      .in('id', userIds);
    if (error) throw error;

    const profilesByUser = new Map();
    (data || []).forEach(profile => {
      if (!profilesByUser.has(profile.id)) profilesByUser.set(profile.id, []);
      profilesByUser.get(profile.id).push(profile);
    });

    const roles = new Map();
    authors.forEach(author => {
      const profiles = profilesByUser.get(author.userId) || [];
      const profile = profiles.find(item => item.display_name === author.name) || profiles[0];
      if (profile && (profile.account_role === 'dev' || profile.account_role === 'client')) {
        roles.set(author.userId, profile.account_role);
      }
    });
    return roles;
  }

  function publicProfileUrl(userId, role) {
    if (typeof userId !== 'string' || !userId) return null;
    if (role === 'dev') return `devmatch-developer-profile.html?developer=${encodeURIComponent(userId)}`;
    if (role === 'client') return `devmatch-client-profile.html?client=${encodeURIComponent(userId)}`;
    return null;
  }

  async function recordProjectView(projectId) {
    if (typeof projectId !== 'string' || !projectId) {
      throw new TypeError('A project ID is required.');
    }
    await currentAccount();
    const {data, error} = await client.rpc('record_project_view', {p_project_id: projectId});
    if (error) throw error;
    return data;
  }

  async function addProjectComment(projectId, text) {
    if (typeof projectId !== 'string' || !projectId
      || typeof text !== 'string' || !text.trim() || text.trim().length > 5000) {
      throw new TypeError('A project ID and comment between 1 and 5000 characters are required.');
    }
    const user = await currentAccount();
    const {data, error} = await client.from('comments')
      .insert({project_id: projectId, user_id: user.id, workspace_role: await getWorkspaceRole(), text: text.trim()})
      .select('id,project_id,user_id,workspace_role,text,author_name,author_initials,created_at')
      .single();
    if (error) throw error;
    return {
      id: data.id,
      projectId: data.project_id,
      userId: data.user_id,
      workspaceRole: data.workspace_role || null,
      text: data.text,
      name: data.author_name,
      initials: data.author_initials,
      time: data.created_at
    };
  }

  async function addProjectCommentReply(projectId, parentCommentId, text) {
    if (typeof projectId !== 'string' || !projectId
      || typeof parentCommentId !== 'string' || !parentCommentId
      || typeof text !== 'string' || !text.trim() || text.trim().length > 5000) {
      throw new TypeError('A project ID, comment ID, and reply between 1 and 5000 characters are required.');
    }
    const user = await currentAccount();
    const {data, error} = await client.from('comments')
      .insert({project_id: projectId, parent_comment_id: parentCommentId, user_id: user.id, workspace_role: await getWorkspaceRole(), text: text.trim()})
      .select('id,project_id,parent_comment_id,user_id,workspace_role,text,author_name,author_initials,created_at')
      .single();
    if (error) throw error;
    return {
      id: data.id,
      projectId: data.project_id,
      parentCommentId: data.parent_comment_id,
      userId: data.user_id,
      workspaceRole: data.workspace_role || null,
      text: data.text,
      name: data.author_name,
      initials: data.author_initials,
      time: data.created_at
    };
  }

  function projectReviewRecord(row) {
    const rating = Number(row?.rating);
    if (!row || typeof row.id !== 'string' || !row.id
      || !Number.isInteger(rating) || rating < 1 || rating > 5
      || typeof row.reviewer_name !== 'string'
      || typeof row.reviewer_initials !== 'string'
      || typeof row.project_title !== 'string'
      || typeof row.text !== 'string') {
      throw new Error('Supabase returned an invalid project review.');
    }
    return {
      id: row.id,
      reviewerName: row.reviewer_name,
      reviewerInitials: row.reviewer_initials,
      projectTitle: row.project_title,
      rating,
      text: row.text,
      createdAt: row.created_at
    };
  }

  async function loadProfileReviews(profileId) {
    if (typeof profileId !== 'string' || !profileId) {
      throw new TypeError('A profile ID is required.');
    }
    const {data, error} = await client.rpc('get_profile_reviews', {p_profile_id: profileId});
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Supabase returned an invalid project review list.');
    return data.map(projectReviewRecord);
  }

  async function loadProjectEngagement(conversationId) {
    if (typeof conversationId !== 'string' || !conversationId) {
      throw new TypeError('A conversation ID is required.');
    }
    await currentAccount();
    const {data, error} = await client.from('project_engagements')
      .select('id,conversation_id,project_id,client_id,developer_id,client_completed_at,developer_completed_at')
      .eq('conversation_id', conversationId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function confirmProjectCompletion(conversationId) {
    if (typeof conversationId !== 'string' || !conversationId) {
      throw new TypeError('A conversation ID is required.');
    }
    await currentAccount();
    const {data: engagementId, error: startError} = await client.rpc(
      'start_project_engagement',
      {p_conversation_id: conversationId}
    );
    if (startError) throw startError;
    if (typeof engagementId !== 'string' || !engagementId) {
      throw new Error('Supabase returned an invalid project engagement.');
    }
    const {data, error} = await client.rpc(
      'confirm_project_engagement',
      {p_engagement_id: engagementId}
    );
    if (error) throw error;
    if (!data || data.id !== engagementId) {
      throw new Error('Supabase returned an invalid project completion confirmation.');
    }
    return data;
  }

  async function loadMyProjectReview(engagementId) {
    if (typeof engagementId !== 'string' || !engagementId) {
      throw new TypeError('An engagement ID is required.');
    }
    await currentAccount();
    const {data, error} = await client.rpc('get_my_project_review', {p_engagement_id: engagementId});
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Supabase returned an invalid project review.');
    return data.length ? projectReviewRecord(data[0]) : null;
  }

  async function submitProjectReview(engagementId, rating, text = '') {
    if (typeof engagementId !== 'string' || !engagementId
      || !Number.isInteger(rating) || rating < 1 || rating > 5
      || typeof text !== 'string' || text.length > 2000) {
      throw new TypeError('An engagement ID, a rating from 1 to 5, and a comment up to 2000 characters are required.');
    }
    await currentAccount();
    const {data, error} = await client.rpc('submit_project_review', {
      p_engagement_id: engagementId,
      p_rating: rating,
      p_text: text.trim()
    });
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 1) {
      throw new Error('Supabase returned an invalid submitted project review.');
    }
    return projectReviewRecord(data[0]);
  }

  function safeFileName(value) {
    const name = String(value || 'upload')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(-100);
    return name || 'upload';
  }

  function validateUpload(file, allowedTypes, maximumBytes) {
    if (!(file instanceof Blob) || !allowedTypes.includes(file.type)) {
      throw new TypeError('Choose a supported file type.');
    }
    if (file.size <= 0 || file.size > maximumBytes) {
      throw new RangeError('The selected file is empty or exceeds the upload size limit.');
    }
  }

  async function uploadProfileAvatar(file) {
    validateUpload(file, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], 10 * 1024 * 1024);
    const user = await currentAccount();
    const path = `${user.id}/avatars/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const {error} = await client.storage.from('project-media').upload(path, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;
    const {data} = client.storage.from('project-media').getPublicUrl(path);
    return {path, url: data.publicUrl};
  }

  async function removeProfileAvatar(url) {
    if (typeof url !== 'string') return;
    const prefix = 'https://yxwktllqbmhustmhdaqi.supabase.co/storage/v1/object/public/project-media/';
    if (!url.startsWith(prefix)) return;
    const user = await currentAccount();
    const path = url.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
    if (path.split('/')[0] !== user.id) {
      throw new Error('You can only remove your own profile photo.');
    }
    await removeUploadedFiles('project-media', [path]);
  }

  async function uploadPortfolioMedia(projectId, file) {
    if (typeof projectId !== 'string' || !projectId) {
      throw new TypeError('A saved project ID is required before uploading project media.');
    }
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const videoTypes = ['video/mp4', 'video/webm'];
    const allowedTypes = file?.type?.startsWith('video/') ? videoTypes : imageTypes;
    validateUpload(file, allowedTypes, file?.type?.startsWith('video/')
      ? 50 * 1024 * 1024
      : 10 * 1024 * 1024);
    const user = await currentAccount();
    const path = `${user.id}/${projectId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const {error} = await client.storage.from('project-media').upload(path, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;
    const {data} = client.storage.from('project-media').getPublicUrl(path);
    return {path, url: data.publicUrl};
  }

  async function removePortfolioMedia(urls) {
    if (!Array.isArray(urls) || urls.some(url => typeof url !== 'string')) {
      throw new TypeError('Project media URLs must be provided as a list.');
    }
    const user = await currentAccount();
    const prefix = 'https://yxwktllqbmhustmhdaqi.supabase.co/storage/v1/object/public/project-media/';
    const paths = urls.filter(url => url.startsWith(prefix)).map(url =>
      url.slice(prefix.length).split('/').map(decodeURIComponent).join('/')
    );
    if (paths.some(path => path.split('/')[0] !== user.id)) {
      throw new Error('You can only remove your own project media.');
    }
    await removeUploadedFiles('project-media', paths);
  }

  async function uploadPrivateFile(kind, entityId, file) {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp'
    ];
    const maximumBytes = kind === 'experience'
      ? 5 * 1024 * 1024
      : 10 * 1024 * 1024;
    validateUpload(file, allowedTypes, maximumBytes);
    const user = await currentAccount();
    let path;
    if (kind === 'experience') {
      path = `experience/${user.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    } else if (kind === 'request' && typeof entityId === 'string' && entityId) {
      path = `request/${user.id}/${entityId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    } else {
      throw new TypeError('A supported private upload type is required.');
    }
    const {error} = await client.storage.from('private-uploads').upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;
    return {path, name: file.name, size: file.size, type: file.type};
  }

  async function createPrivateFileUrl(path, downloadName) {
    if (typeof path !== 'string'
      || !/^(experience|request)\/[A-Za-z0-9-]+(?:\/[A-Za-z0-9-]+)*\/[^/]+$/.test(path)) {
      throw new TypeError('A valid private upload path is required.');
    }
    const user = await currentAccount();
    if (!user) throw new Error('Authentication is required to access this file.');
    const options = downloadName ? {download: safeFileName(downloadName)} : {download: true};
    const {data, error} = await client.storage.from('private-uploads')
      .createSignedUrl(path, 300, options);
    if (error) throw error;
    return data.signedUrl;
  }

  async function removeUploadedFiles(bucket, paths) {
    if (!['project-media', 'private-uploads'].includes(bucket)
      || !Array.isArray(paths)
      || paths.some(path => typeof path !== 'string' || path.startsWith('/') || path.includes('..'))) {
      throw new TypeError('A supported bucket and valid file paths are required.');
    }
    if (!paths.length) return;
    await currentAccount();
    const {error} = await client.storage.from(bucket).remove(paths);
    if (error) throw error;
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
    const currentProfile = await loadProfile(user);
    privateProfileFields.forEach(field => {
      if (Object.hasOwn(currentProfile.profile_data || {}, field)) {
        details[field] = currentProfile.profile_data[field];
      }
    });
    if (includePrivateFields) Object.assign(details, suppliedPrivateFields);
    if (Object.hasOwn(currentProfile.profile_data, 'notificationPreferences')) {
      details.notificationPreferences = currentProfile.profile_data.notificationPreferences;
    }
    const data=await updateWorkspaceProfile({display_name:String(details.displayName||''),profile_data:details});
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
    getWorkspaceRole,
    hasWorkspace,
    switchWorkspace,
    updateWorkspaceProfile,
    loadPrivateProfileFields,
    destination,
    saveProfile,
    changePassword,
    uploadProfileAvatar,
    removeProfileAvatar,
    uploadPortfolioMedia,
    removePortfolioMedia,
    uploadPrivateFile,
    createPrivateFileUrl,
    removeUploadedFiles,
    loadFavorites,
    setFavorite,
    clearFavorites,
    loadNotificationReads,
    loadUnreadNotificationCount,
    markNotificationsRead,
    loadNotificationPreferences,
    saveNotificationPreferences,
    loadOwnedProjects,
    loadOwnedProjectMetrics,
    saveOwnedProject,
    deleteOwnedProject,
    loadProjectComments,
    loadCommentAuthorRoles,
    publicProfileUrl,
    recordProjectView,
    addProjectComment,
    addProjectCommentReply,
    loadProfileReviews,
    loadProjectEngagement,
    confirmProjectCompletion,
    loadMyProjectReview,
    submitProjectReview
  };
})();
