const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('Project detail assignments match dynamic dialog and dashboard elements',()=>{
  const source=fs.readFileSync('assets/js/project-detail.js','utf8');
  const dashboard=fs.readFileSync('devmatch-client-dashboard.html','utf8');
  const markupIds=new Set([...`${source}\n${dashboard}`.matchAll(/id="([^"]+)"/g)].map(match=>match[1]));
  const assignedIds=[...source.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)]
    .map(match=>match[1]);
  const missing=[...new Set(assignedIds.filter(id=>!markupIds.has(id)))];
  assert.deepEqual(missing,[]);
});

test('Project detail header uses developer profile portfolio views',()=>{
  const source=fs.readFileSync('assets/js/project-detail.js','utf8');
  assert.match(source,/getElementById\('projectViews'\)\.textContent=formatMetric\(developerMetrics\.views\)/);
  assert.doesNotMatch(source,/getElementById\('projectViews'\)\.textContent=formatMetric\(projectViewCount\)/);
});

test('Project detail displays the uploaded project cover when available',()=>{
  const source=fs.readFileSync('assets/js/project-detail.js','utf8');
  const styles=fs.readFileSync('assets/css/project-detail.css','utf8');
  assert.match(source,/coverImage:safeProjectCover\(row\.cover_image\|\|data\.coverImage\)/);
  assert.match(source,/image\.src=activeProject\.coverImage/);
  assert.match(source,/cover\.classList\.add\('has-uploaded-image'\)/);
  assert.match(styles,/\.project-cover\.has-uploaded-image:before,.project-cover\.has-uploaded-image:after\{display:none\}/);
});

test('Direct portfolio detail replaces the placeholder only after the stored cover loads',()=>{
  const source=fs.readFileSync('assets/js/discover-project-detail.js','utf8');
  const functions=source.slice(source.indexOf('  function safeProjectCover('),source.indexOf('  function initializeDetailLayout('));
  const portal='https://yxwktllqbmhustmhdaqi.supabase.co';
  const cover=portal+'/storage/v1/object/public/project-media/test/cover.png';
  const project={title:'Website Rasa Kota',coverImage:''};
  let image, onLoad, label;
  const thumbnails=[], hero=[], classes=[];
  const gallery={
    classList:{add:value=>classes.push(value)},
    querySelector:()=>({append:value=>thumbnails.push(value)})
  };
  const preview={
    closest:()=>gallery,
    prepend:value=>hero.push(value),
    setAttribute:(_name,value)=>{label=value;}
  };
  const target=vm.runInNewContext(functions+';({safeProjectCover,renderProjectCover})',{
    URL,project,Image:class {
      constructor(){image=this;}
      addEventListener(event,handler){assert.equal(event,'load');onLoad=handler;}
      cloneNode(){return {src:this.src};}
    }
  });
  assert.equal(target.safeProjectCover(cover),cover);
  assert.equal(target.safeProjectCover(cover.replace(portal,'https://example.test')),'');
  assert.equal(target.safeProjectCover(portal+'/storage/v1/object/public/other/cover.png'),'');
  target.renderProjectCover(preview);
  assert.equal(image,undefined);
  project.coverImage=cover;
  target.renderProjectCover(preview);
  assert.equal(image.src,cover);
  assert.equal(hero.length,0);
  assert.equal(thumbnails.length,0);
  assert.deepEqual(classes,[]);
  onLoad();
  assert.equal(hero[0],image);
  assert.equal(hero[0].alt,project.title);
  assert.equal(thumbnails.length,1);
  assert.equal(label,'Project cover');
  assert.deepEqual(classes,['has-uploaded-cover']);
});

test('Only the embedded request detail opts into same-origin framing',()=>{
  const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
  const defaultRule=config.headers.find(rule=>rule.source==='/:path*');
  const framedRule=config.headers.find(rule=>rule.source==='/devmatch-find-project-detail.html');
  const headers=rule=>Object.fromEntries(rule.headers.map(({key,value})=>[key,value]));
  assert.equal(headers(defaultRule)['X-Frame-Options'],'DENY');
  assert.match(headers(defaultRule)['Content-Security-Policy'],/frame-ancestors 'none'/);
  assert.deepEqual(framedRule.has,[{type:'query',key:'modal',value:'1'}]);
  assert.equal(headers(framedRule)['X-Frame-Options'],'SAMEORIGIN');
  assert.equal(headers(framedRule)['Content-Security-Policy'],headers(defaultRule)['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'"));
});

test('Contact Developer carries the selected project into Messages',()=>{
  const detail=fs.readFileSync('assets/js/project-detail.js','utf8');
  const discover=fs.readFileSync('assets/js/discover-project-detail.js','utf8');
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const chatHtml=fs.readFileSync('devmatch-chat.html','utf8');
  assert.match(detail,/function chatUrl\(id\)\{return `devmatch-chat\.html\?role=client&project=\$\{encodeURIComponent\(id\)\}`;\}/);
  assert.match(detail,/getElementById\('chatDeveloperLink'\)\.href=user\?chatUrl\(row\.id\)/);
  assert.match(discover,/devmatch-chat\.html\?role=client&project=\$\{encodeURIComponent\(project\.id\)\}/);
  assert.match(chat,/params\.get\('project'\) \|\| params\.get\('request'\)/);
  assert.match(chat,/projectId: project\?\.id \|\| null/);
  assert.doesNotMatch(chatHtml,/chatDraftProjectId/);
});

test('Contact Developer keeps its project draft without rendering the removed context card',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const html=fs.readFileSync('devmatch-chat.html','utf8');
  const styles=fs.readFileSync('assets/css/chat.css','utf8');
  assert.doesNotMatch(html,/chatDraftProjectCard|chatDraftProjectImage|chatDraftProjectNote/);
  assert.doesNotMatch(chat,/renderComposerProjectCard|draftProjectRemoveEl/);
  assert.doesNotMatch(styles,/chat-draft-project-card|chat-draft-project-remove/);
  assert.match(chat,/projectId: project\?\.id \|\| null/);
});

test('Opening Contact Developer checks for an existing thread without creating one',()=>{
  const chat=fs.readFileSync('assets/js/chat.js','utf8');
  const openFromQuery=chat.slice(chat.indexOf('async function openFromQuery()'),chat.indexOf('\n  function updateShell'));
  const sendMessage=chat.slice(chat.indexOf('async function sendMessage('),chat.indexOf('\n  function formatFileSize'));
  assert.match(openFromQuery,/invokeChat\('find-project', \{projectId: project\.id\}\)/);
  assert.match(openFromQuery,/conversation\.participantId === project\.owner_id && conversation\.projectId === project\.id/);
  assert.match(openFromQuery,/activateConversationDraft\(draft\)/);
  assert.doesNotMatch(openFromQuery,/invokeChat\('start-(?:project|user)'/);
  assert.match(sendMessage,/invokeChat\('start-project', \{projectId: conversation\.projectId\}\)/);
  assert.match(chat,/function replaceDraftProject\(draft, project\)/);
  assert.match(chat,/replaceDraftProject\(pendingConversationDraft, project\)/);
});

test('Project detail comments show timestamp beside Reply',()=>{
  const source=fs.readFileSync('assets/js/project-detail.js','utf8');
  assert.match(source,/comment-actions comment-system-actions/);
  assert.match(source,/commentTime/);
  assert.match(source,/comment-system-time/);
  assert.match(source,/<button type="button" class="reply-link comment-system-reply"/);
});

test('Discover project detail popup separates the comments card from project details',()=>{
  const source=fs.readFileSync('assets/js/project-detail.js','utf8');
  const styles=fs.readFileSync('assets/css/project-detail.css','utf8');
  const discover=fs.readFileSync('devmatch-discover-projects.html','utf8');
  assert.match(source,/class="detail-main-stack">\s*<article class="detail-main-column">[\s\S]*?<\/article>\s*<section class="detail-section comments-section comment-system"/);
  assert.match(source,/<h2>Comments <span id="commentCount" class="comment-system-count">0<\/span><\/h2>/);
  assert.match(source,/id="commentsEmpty" role="status" aria-live="polite" hidden/);
  assert.match(source,/getElementById\('commentsEmpty'\)\.hidden=comments\.length>0/);
  assert.doesNotMatch(source,/id="commentCount"[^>]*>0<\/b>/);
  assert.match(styles,/\.project-detail-dialog \.detail-main-stack\{display:grid;align-content:start;gap:18px;min-width:0\}/);
  assert.match(styles,/\.project-detail-dialog \.comments-section\{margin:0;padding:24px;border:1px solid #e5e5e8;border-radius:16px;background:#fff;box-shadow:0 2px 6px #17171908\}/);
  assert.match(styles,/\.comments-section \.comment-system-heading h2>span\.comment-system-count\{color:#171719;font-size:15px\}/);
  assert.match(styles,/\.comments-section \.comment-reply-form\.comment-system-reply-form textarea\{min-height:108px/);
  assert.match(discover,/assets\/css\/project-detail\.css\?v=20261126-rebase-merge-v1/);
  assert.match(discover,/assets\/js\/project-detail\.js\?v=20261126-rebase-merge-v1/);
});

test('Every comment page loads the shared comment presentation',()=>{
  const pages=[
    'devmatch-client-dashboard.html',
    'devmatch-dashboard.html',
    'devmatch-developer-profile.html',
    'devmatch-discover-project-detail.html',
    'devmatch-discover-projects.html',
    'devmatch-favorites.html',
    'devmatch-find-project-detail.html',
    'devmatch-landing.html'
  ];
  pages.forEach(page=>{
    const source=fs.readFileSync(page,'utf8');
    assert.match(source,/assets\/css\/comment-system\.css/);
  });
});

test('Project detail comments expose View replies and collapse controls',()=>{
  const source=fs.readFileSync('assets/js/project-detail.js','utf8');
  const styles=fs.readFileSync('assets/css/project-detail.css','utf8');
  assert.match(source,/expandedReplies/);
  assert.match(source,/View \$\{replies\.length\}/);
  assert.match(source,/Hide replies/);
  assert.match(source,/data-view-replies/);
  assert.match(source,/comment-action-controls/);
  assert.match(styles,/\.project-detail-dialog \.view-replies-link\{[^}]*margin-left:0/);
  assert.match(styles,/\.project-detail-dialog \.view-replies-link:not\(.hide-replies-link\)::before/);
  assert.match(source,/comment-actions comment-system-actions\$\{replies\.length\?' has-replies':''\}/);
  const toggleIndex=source.indexOf('const replyToggle=replies.length');
  const buttonIndex=source.indexOf('const replyButton=isReplying');
  assert.ok(toggleIndex>=0&&buttonIndex>toggleIndex);
});

test('Expanded reply lists place Hide replies after all reply items',()=>{
  const popup=fs.readFileSync('assets/js/project-detail.js','utf8');
  const find=fs.readFileSync('assets/js/find-project-detail.js','utf8');
  const discover=fs.readFileSync('assets/js/discover-project-detail.js','utf8');
  const profile=fs.readFileSync('assets/js/developer-profile.js','utf8');
  const client=fs.readFileSync('assets/js/client-dashboard.js','utf8');
  assert.match(popup,/comment-replies[^`]*Hide replies/);
  assert.match(find,/find-comment-replies[^`]*Hide replies/);
  assert.match(discover,/discover-comment-replies[^`]*Hide replies/);
  assert.match(profile,/profile-comment-replies[^`]*Hide replies/);
  assert.match(client,/thread\.append\(replyList,replyToggle\)/);
});

test('View and Hide reply controls appear only on root comments',()=>{
  const popup=fs.readFileSync('assets/js/project-detail.js','utf8');
  const find=fs.readFileSync('assets/js/find-project-detail.js','utf8');
  const discover=fs.readFileSync('assets/js/discover-project-detail.js','utf8');
  const profile=fs.readFileSync('assets/js/developer-profile.js','utf8');
  const client=fs.readFileSync('assets/js/client-dashboard.js','utf8');
  assert.match(popup,/collectDescendants[\s\S]*renderComment=\(comment,isRoot=false\)/);
  assert.match(find,/collectDescendants[\s\S]*renderComment=\(comment,isRoot=false\)/);
  assert.match(discover,/collectDescendants[\s\S]*renderComment=\(comment,isRoot=false\)/);
  assert.match(profile,/collectDescendants[\s\S]*renderComment=\(comment,isRoot=false\)/);
  assert.match(client,/collectDescendants[\s\S]*appendComment=\(comment,parentContainer,isRoot=false\)/);
});

test('Reply targets render in one branch without recursively nesting descendants',()=>{
  const popup=fs.readFileSync('assets/js/project-detail.js','utf8');
  const find=fs.readFileSync('assets/js/find-project-detail.js','utf8');
  const discover=fs.readFileSync('assets/js/discover-project-detail.js','utf8');
  const profile=fs.readFileSync('assets/js/developer-profile.js','utf8');
  const client=fs.readFileSync('assets/js/client-dashboard.js','utf8');
  assert.match(popup,/comment-reply-target/);
  assert.match(find,/find-comment-reply-target/);
  assert.match(discover,/discover-comment-reply-target/);
  assert.match(profile,/profile-comment-reply-target/);
  assert.match(client,/request-detail-comment-reply-target/);
  for(const source of [popup,find,discover,profile]){
    assert.match(source,/replies\.map\(reply=>renderComment\(reply,false\)\)/);
    assert.doesNotMatch(source,/nestedReplies/);
  }
  assert.match(client,/replies\.forEach\(reply=>appendComment\(reply,replyList,false\)\)/);
  assert.doesNotMatch(client,/nestedList/);
});

test('Client request replies share one expanded thread and direct comment links open that section',()=>{
  const client=fs.readFileSync('assets/js/client-dashboard.js','utf8');
  const notifications=fs.readFileSync('assets/js/notifications.js','utf8');
  const html=fs.readFileSync('devmatch-client-dashboard.html','utf8');
  assert.match(client,/replies\.forEach\(reply=>appendComment\(reply,replyList,false\)\)/);
  assert.doesNotMatch(client,/nestedList/);
  assert.match(client,/focusComments=false/);
  assert.match(client,/getElementById\('requestDetailComments'\)\.scrollIntoView/);
  assert.match(client,/get\('section'\)==='comments'/);
  assert.match(html,/id="requestDetailComments"/);
  assert.match(notifications,/devmatch-client-dashboard\.html\?section=comments#request-detail/);
  assert.match(notifications,/devmatch-discover-project-detail\.html\?project=.*#commentsSection/);
});

test('Dashboard comment summaries include reply targets and link to project discussions',()=>{
  const dashboard=fs.readFileSync('assets/js/dashboard.js','utf8');
  assert.match(dashboard,/parent_comment_id/);
  assert.match(dashboard,/comment-reply-target/);
  assert.match(dashboard,/comment-project-link/);
  assert.match(dashboard,/devmatch-discover-project-detail\.html\?project=/);
});

test('Reply targets keep the arrow muted and add the parent role badge',()=>{
  const popup=fs.readFileSync('assets/js/project-detail.js','utf8');
  const find=fs.readFileSync('assets/js/find-project-detail.js','utf8');
  const discover=fs.readFileSync('assets/js/discover-project-detail.js','utf8');
  const profile=fs.readFileSync('assets/js/developer-profile.js','utf8');
  const client=fs.readFileSync('assets/js/client-dashboard.js','utf8');
  assert.match(popup,/comment-reply-arrow[\s\S]*comment-reply-name[\s\S]*parentRoleBadge/);
  assert.match(find,/find-comment-reply-arrow[\s\S]*find-comment-reply-name[\s\S]*parentRoleBadge/);
  assert.match(discover,/discover-comment-reply-arrow[\s\S]*discover-comment-reply-name[\s\S]*parentRoleBadge/);
  assert.match(profile,/profile-comment-reply-arrow[\s\S]*profile-comment-reply-name[\s\S]*parentRoleBadge/);
  assert.match(client,/request-detail-comment-reply-arrow[\s\S]*request-detail-comment-reply-name[\s\S]*parentRole/);
});

test('Reply target wrappers have no background while parent role badges keep it',()=>{
  const files=[
    'assets/css/project-detail.css',
    'assets/css/find-project-detail.css',
    'assets/css/discover-project-detail.css',
    'assets/css/developer-public-profile.css',
    'assets/css/client-dashboard.css'
  ];
  for(const file of files){
    const styles=fs.readFileSync(file,'utf8');
    assert.match(styles,/reply-target\{[^}]*background:none!important/);
  }
});

test('Comment and nested reply display names use the 12.5px size',()=>{
  const files=[
    'assets/css/project-detail.css',
    'assets/css/find-project-detail.css',
    'assets/css/discover-project-detail.css',
    'assets/css/developer-public-profile.css',
    'assets/css/client-dashboard.css',
    'assets/css/dashboard.css'
  ];
  for(const file of files){
    const styles=fs.readFileSync(file,'utf8');
    assert.match(styles,/12\.5px/);
  }
});

test('Comment surfaces show author roles and expose replies without labeling them as a role',()=>{
  const popup=fs.readFileSync('assets/js/project-detail.js','utf8');
  const discover=fs.readFileSync('assets/js/discover-project-detail.js','utf8');
  const request=fs.readFileSync('assets/js/find-project-detail.js','utf8');
  const client=fs.readFileSync('assets/js/client-dashboard.js','utf8');
  const profile=fs.readFileSync('assets/js/developer-profile.js','utf8');
  const dashboard=fs.readFileSync('assets/js/dashboard.js','utf8');
  const clientHtml=fs.readFileSync('devmatch-client-dashboard.html','utf8');
  for(const source of [popup,discover,request,client,profile]){
    assert.match(source,/workspaceRole\|\|commenterRoles\.get\(comment\.userId\)/);
    assert.match(source,/Developer/);
    assert.match(source,/Client/);
  }
  assert.match(request,/find-comment-role-badge/);
  assert.doesNotMatch(request,/find-comment-reply-badge/);
  assert.match(client,/requestDetailCommentSort/);
  assert.match(client,/request-detail-comment-replies-toggle/);
  assert.match(clientHtml,/id="requestDetailCommentSort"/);
  assert.match(profile,/profile-comment-replies-toggle/);
  assert.match(dashboard,/comment-role-badge/);
});

test('Comment role badges use the darker reference style',()=>{
  const files=[
    'assets/css/project-detail.css',
    'assets/css/find-project-detail.css',
    'assets/css/discover-project-detail.css',
    'assets/css/client-dashboard.css',
    'assets/css/developer-public-profile.css',
    'assets/css/dashboard.css'
  ];
  for(const file of files){
    const styles=fs.readFileSync(file,'utf8');
    assert.match(styles,/background:#e2e3e7;color:#555962/);
  }
});

test('Removing a project favorite asks for confirmation before saving',()=>{
  const source=fs.readFileSync('assets/js/project-detail.js','utf8');
  const confirmation=source.indexOf('DEVMATCH_FAVORITE_FEEDBACK.confirmRemoval');
  const save=source.indexOf("setFavorite('project',activeProject.id,!saved)");
  assert.notEqual(confirmation,-1);
  assert.ok(save>confirmation);
  assert.ok(source.indexOf("dispatchEvent(new CustomEvent('devmatch:project-favorite-change'")>save);
});

test('Project detail favorite changes update client dashboard cards',()=>{
  const detail=fs.readFileSync('assets/js/project-detail.js','utf8');
  const dashboard=fs.readFileSync('assets/js/client-dashboard.js','utf8');
  assert.match(detail,/dispatchEvent\(new CustomEvent\('devmatch:project-favorite-change'/);
  assert.match(detail,/detail:\{projectId:activeProject\.id,saved:!saved,favorites:projectFavorites\}/);
  assert.match(dashboard,/addEventListener\('devmatch:project-favorite-change'/);
  assert.match(dashboard,/Array\.isArray\(change\.favorites\)/);
  assert.match(dashboard,/localStorage\.setItem\(favoritesKey,JSON\.stringify\(favorites\)\)/);
  assert.match(dashboard,/renderProjects\(\)/);
});

test('Project request details open in a popup from marketplace and linked views',()=>{
  const listing=fs.readFileSync('devmatch-find-projects.html','utf8');
  const marketplace=fs.readFileSync('assets/js/marketplace.js','utf8');
  const popup=fs.readFileSync('assets/js/project-detail-popup.js','utf8');
  const route=fs.readFileSync('assets/js/project-detail-route-popup.js','utf8');
  assert.match(listing,/<dialog class="project-request-detail-dialog" id="requestDetailDialog"/);
  assert.match(listing,/<iframe class="project-detail-popup-frame" id="requestDetailFrame"/);
  assert.match(marketplace,/searchParams\.set\('requestDetail', id\)/);
  assert.match(marketplace,/new URLSearchParams\(location\.search\)\.get\('requestDetail'\)/);
  assert.match(marketplace,/restoreRequestDetail\(\)/);
  assert.match(popup,/window\.openProjectRequestDetails=function/);
  assert.match(popup,/devmatch-find-project-detail\.html\?request=.*&modal=1/);
  assert.match(route,/params\.get\('modal'\)==='1'/);
  assert.match(route,/dialog\.showModal\(\)/);
});

test('Marketplace restores its internal scroll position after a reload',()=>{
  const marketplace=fs.readFileSync('assets/js/marketplace.js','utf8');
  assert.match(marketplace,/navigationEntry\?\.type === 'reload'/);
  assert.match(marketplace,/sessionStorage\.setItem\(scrollStateKey/);
  assert.match(marketplace,/main\.scrollTop = savedScrollState\.scrollTop/);
  assert.match(marketplace,/savedScrollState\.visibleCount/);
});

test('All app pages allow the shared font to load after a hard refresh',()=>{
  const pages=fs.readdirSync('.')
    .filter(file=>file.endsWith('.html'))
    .map(file=>({file,source:fs.readFileSync(file,'utf8')}))
    .filter(page=>page.source.includes('fonts.googleapis.com/css2?family=Plus+Jakarta+Sans'));
  assert.ok(pages.length>0);
  pages.forEach(page=>assert.match(page.source,/fonts\.googleapis\.com\/css2\?family=Plus\+Jakarta\+Sans:[^"]*&display=swap/));
});

test('Developer request detail fields match the page and saved request data',()=>{
  const html=fs.readFileSync('devmatch-find-project-detail.html','utf8');
  const source=fs.readFileSync('assets/js/find-project-detail.js','utf8');
  const styles=fs.readFileSync('assets/css/find-project-detail.css','utf8');
  const markupIds=new Set([...html.matchAll(/id="([^"]+)"/g)].map(match=>match[1]));
  const assignedIds=[...source.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(match=>match[1]);
  const missing=[...new Set(assignedIds.filter(id=>!markupIds.has(id)))];
  assert.deepEqual(missing,[]);
  assert.match(html,/id="asideClientProjects"[\s\S]*id="asideClientViews"[\s\S]*id="asideClientFavorites"/);
  assert.match(html,/<h2>Project details<\/h2>[\s\S]*id="requestProjectType"[\s\S]*id="requestProjectCategory"[\s\S]*id="requestTargetStart"[\s\S]*id="requestReferenceLinks"[\s\S]*id="requestCreated"/);
  assert.match(html,/<span class="find-detail-negotiable" id="requestNegotiableFact" hidden>Negotiable<\/span>/);
  assert.match(source,/Array\.isArray\(data\.specialties\)/);
  assert.match(source,/data\.categoryOther/);
  assert.match(source,/data\.references/);
  assert.match(source,/data\.attachments/);
  assert.match(source,/data\.deadline/);
  assert.match(source,/data\.targetStart/);
  assert.match(source,/negotiable:data\.negotiable===true/);
  assert.match(source,/requestClientMeta'\)\.textContent=project\.location/);
  assert.match(source,/requestCreated'\)\.textContent=date/);
  assert.match(source,/requestReferencesSection'\)\.hidden=project\.attachments\.length===0/);
  assert.match(styles,/\.find-detail-facts>\.find-detail-budget-fact\{[^}]*background:#f1f1f3/);
  assert.match(styles,/\.find-project-facts>div\{[^}]*border-top:1px solid/);
});

test('Find and Discover project comments show live counts and use the same inline reply style',()=>{
  const findHtml=fs.readFileSync('devmatch-find-project-detail.html','utf8');
  const discoverHtml=fs.readFileSync('devmatch-discover-project-detail.html','utf8');
  const find=fs.readFileSync('assets/js/find-project-detail.js','utf8');
  const discover=fs.readFileSync('assets/js/discover-project-detail.js','utf8');
  const commonStyles=fs.readFileSync('assets/css/comment-system.css','utf8');
  const findStyles=fs.readFileSync('assets/css/find-project-detail.css','utf8');
  const discoverStyles=fs.readFileSync('assets/css/discover-project-detail.css','utf8');
  assert.doesNotMatch(findHtml,/id="requestCommentCount"/);
  assert.match(findHtml,/id="commentsCount" class="comment-system-count"/);
  assert.match(find,/getElementById\('commentsCount'\)\.textContent=String\(comments\.length\)/);
  assert.doesNotMatch(find,/requestCommentCount/);
  assert.match(discoverHtml,/id="commentsHeadingCount" class="comment-system-count"/);
  assert.match(commonStyles,/\.comment-system \.comment-system-heading h2>span\.comment-system-count\{display:inline/);
  assert.match(findStyles,/\.find-detail-card\.find-comments\.comment-system \.comment-system-actions\{display:grid;grid-template-columns:max-content minmax\(0,1fr\);align-items:baseline/);
  assert.match(findStyles,/\.find-detail-card\.find-comments\.comment-system \.comment-system-action-controls\{display:contents\}/);
  assert.match(findStyles,/\.find-detail-card\.find-comments\.comment-system \.comment-system-reply\{grid-column:2;justify-self:start;width:max-content;margin-top:0;text-align:left\}/);
  assert.match(findStyles,/\.find-detail-card\.find-comments\.comment-system \.comment-system-view-replies\{grid-column:2;justify-self:start;width:max-content;margin-top:0;text-align:left\}/);
  assert.match(findStyles,/\.find-detail-card\.find-comments\.comment-system \.comment-system-heading h2>span\.comment-system-count\{color:#171719;font-size:15px\}/);
  assert.match(discoverStyles,/\.discover-detail-section\.comment-system\.discover-comments\{[^}]*padding:24px;border:1px solid #e5e5e8;border-radius:16px;background:#fff/);
  assert.match(discoverStyles,/@media\(max-width:\s*600px\)\s*and\s*\(orientation:\s*portrait\)\s*\{\.discover-detail-section\.comment-system\.discover-comments\{padding:18px\}\}/);
  assert.match(discoverStyles,/\.discover-comments \.comment-system-actions\{[^}]*align-items:baseline/);
  assert.match(discoverStyles,/\.discover-comments \.comment-system-reply\{margin-top:0\}/);
  for(const source of [find,discover]){
    assert.match(source,/function refreshProjectComments\(\)/);
    assert.match(source,/\.on\('postgres_changes',\{event:'INSERT',schema:'public',table:'comments'/);
  }
  assert.match(discover,/discover-comment-reply-form comment-system-reply-form/);
});

test('requested comment sections follow the reference card and typography styles',()=>{
  const discoverStyles=fs.readFileSync('assets/css/discover-project-detail.css','utf8');
  const clientStyles=fs.readFileSync('assets/css/client-dashboard.css','utf8');
  const dashboardStyles=fs.readFileSync('assets/css/dashboard.css','utf8');
  const findStyles=fs.readFileSync('assets/css/find-project-detail.css','utf8');
  const profileStyles=fs.readFileSync('assets/css/developer-public-profile.css','utf8');
  const clientHtml=fs.readFileSync('devmatch-client-dashboard.html','utf8');
  const findHtml=fs.readFileSync('devmatch-find-project-detail.html','utf8');
  const dashboardHtml=fs.readFileSync('devmatch-dashboard.html','utf8');
  const profileHtml=fs.readFileSync('devmatch-developer-profile.html','utf8');
  const profileSource=fs.readFileSync('assets/js/developer-profile.js','utf8');
  const clientProfileSource=fs.readFileSync('assets/js/client-profile.js','utf8');
  const requestPopupSource=fs.readFileSync('assets/js/project-detail-popup.js','utf8');

  assert.match(discoverStyles,/\.discover-detail-section\.comment-system\.discover-comments \.comment-system-heading h2\{font-size:19px/);
  assert.match(discoverStyles,/@media\(max-width:\s*600px\)\s*and\s*\(orientation:\s*portrait\)\s*\{\.discover-detail-section\.comment-system\.discover-comments\{padding:18px\}\}/);
  assert.match(clientHtml,/id="requestDetailCommentCount" class="comment-system-count"/);
  assert.match(clientStyles,/#requestDetailComments\.comment-system\{padding:24px;border:1px solid #e5e5e8;border-radius:16px/);
  assert.match(clientStyles,/\.request-detail-comments\.comment-system \.comment-system-actions\{display:grid;grid-template-columns:max-content minmax\(0,1fr\);align-items:baseline/);
  assert.match(findHtml,/find-project-detail\.css\?v=20261125-responsive-orientation-v1/);
  assert.match(findStyles,/\.find-project-detail-page\.is-modal-detail \.find-detail-card\.find-comments\.comment-system\{padding:24px;border:1px solid #e5e5e8;border-radius:16px/);
  assert.match(findStyles,/@media\(max-width:\s*600px\)\s*and\s*\(orientation:\s*portrait\)\s*\{\s*\.find-project-detail-page\.is-modal-detail \.find-detail-card\.find-comments\.comment-system\{padding:18px\}/);
  assert.match(clientProfileSource,/devmatch-find-project-detail\.html\?request=/);
  assert.match(requestPopupSource,/devmatch-find-project-detail\.html\?request=.*&modal=1/);
  assert.match(dashboardHtml,/<article class="panel comments-panel comment-system" id="interactions">/);
  assert.match(dashboardStyles,/#interactions\.panel\.comment-system\{padding:24px;border-radius:16px/);
  assert.match(profileHtml,/class="comments-panel review-list comment-system" id="commentsPanel"/);
  assert.match(profileSource,/<h2>Comments <span class="comment-system-count">\$\{comments\.length\}<\/span><\/h2>/);
  assert.match(profileStyles,/#commentsPanel\.comment-system \.comment-system-actions\{display:grid;grid-template-columns:max-content minmax\(0,1fr\);align-items:baseline/);
});

test('Client-owned request detail is a popup while request composition stays separate',()=>{
  const dashboard=fs.readFileSync('devmatch-client-dashboard.html','utf8');
  const source=fs.readFileSync('assets/js/client-dashboard.js','utf8');
  assert.match(dashboard,/<dialog class="request-detail-page" id="requestDetailPage"/);
  assert.match(source,/if\(!detailDialog\.open\)detailDialog\.showModal\(\)/);
  assert.match(dashboard,/<section class="request-composer" id="requestComposer"/);
});

test('Client request detail shows live client metrics and a fully red delete action',()=>{
  const dashboard=fs.readFileSync('devmatch-client-dashboard.html','utf8');
  const source=fs.readFileSync('assets/js/client-dashboard.js','utf8');
  const styles=fs.readFileSync('assets/css/client-dashboard.css','utf8');
  assert.match(dashboard,/<strong id="requestDetailClientProjects">—<\/strong><small>PROJECTS<\/small>/);
  assert.match(dashboard,/<strong id="requestDetailClientViews">—<\/strong><small>VIEWS<\/small>/);
  assert.match(dashboard,/<strong id="requestDetailClientFavorites">—<\/strong><small>FAVORITES<\/small>/);
  assert.match(source,/function renderRequestDetailClientMetrics\(\)/);
  assert.match(source,/formatDashboardMetric\(requestDashboardMetrics\?\.projects\)/);
  assert.match(source,/formatDashboardMetric\(requestDashboardMetrics\?\.views\)/);
  assert.match(source,/formatDashboardMetric\(requestDashboardMetrics\?\.favorites\)/);
  assert.match(styles,/\.request-detail-client-stats\{[^}]*border-top:1px solid/);
  assert.match(styles,/\.request-detail-delete\{[^}]*background:#c43d43;[^}]*color:#fff/s);
});

test('Client request details use entered request data and show negotiation only when enabled',()=>{
  const dashboard=fs.readFileSync('devmatch-client-dashboard.html','utf8');
  const source=fs.readFileSync('assets/js/client-dashboard.js','utf8');
  const backend=fs.readFileSync('assets/js/backend.js','utf8');
  const styles=fs.readFileSync('assets/css/client-dashboard.css','utf8');
  assert.match(dashboard,/<h2 id="requestDetailProjectDetailsTitle">Project details<\/h2>/);
  assert.match(dashboard,/<dl class="request-detail-project-facts" id="requestDetailProjectFacts"><\/dl>/);
  assert.match(source,/function renderRequestDetailProjectFacts\(request,\{category,type\}\)/);
  assert.match(source,/\['Project type',type===.*\],\s*\['Category',category===.*\],\s*\['Target start',request\.targetStart/);
  assert.match(source,/\['Reference links',references\]/);
  assert.match(source,/negotiableBadge\.hidden=request\.negotiable!==true/);
  assert.match(backend,/created_at,updated_at/);
  assert.match(backend,/created: row\.created_at \? new Date\(row\.created_at\)\.getTime\(\)/);
  assert.match(styles,/\.request-detail-project-facts>div\{[^}]*border-top:1px solid/);
});

test('Client request card and detail typography is slightly larger on desktop and mobile',()=>{
  const styles=fs.readFileSync('assets/css/client-dashboard.css','utf8');
  assert.match(styles,/\.request-card h2\{[^}]*font-size:18px/);
  assert.match(styles,/\.request-card-facts b\{[^}]*font-size:13px/);
  assert.match(styles,/\.request-detail-description\{[^}]*font-size:14px/);
  assert.match(styles,/\.request-detail-card h1\{font-size:24px\}/);
  assert.match(styles,/\.request-card-actions button\{min-height:34px;padding:0 8px;font-size:11px\}/);
});

test('Client My Requests cards show the negotiation tag only when enabled',()=>{
  const source=fs.readFileSync('assets/js/client-dashboard.js','utf8');
  const styles=fs.readFileSync('assets/css/client-dashboard.css','utf8');
  assert.match(source,/const negotiableBadge=request\.negotiable===true\?'<span class="request-card-tag">Negotiable<\/span>':''/);
  assert.match(source,/request-card-budget-value">\$\{escapeHtml\(budget\)\}\$\{negotiableBadge\}/);
  assert.match(styles,/\.request-card-facts \.request-card-budget-value\{display:flex;align-items:center;gap:7px/);
  const badgeRowStart=source.indexOf('class="request-card-badges"');
  const budgetLineStart=source.indexOf('class="request-card-budget-value"');
  assert.ok(badgeRowStart>=0&&budgetLineStart>badgeRowStart);
  assert.doesNotMatch(source.slice(badgeRowStart,budgetLineStart),/\$\{negotiableBadge\}/);
});

test('Client My Requests cards open the full detail view directly',()=>{
  const source=fs.readFileSync('assets/js/client-dashboard.js','utf8');
  const dashboard=fs.readFileSync('devmatch-client-dashboard.html','utf8');
  const styles=fs.readFileSync('assets/css/client-dashboard.css','utf8');
  const handlerStart=source.indexOf("requestList.addEventListener('click',event=>{");
  const handlerEnd=source.indexOf("document.getElementById('requestDetailPage').addEventListener('click'",handlerStart);
  assert.notEqual(handlerStart,-1);
  assert.notEqual(handlerEnd,-1);
  const handler=source.slice(handlerStart,handlerEnd);
  const cardStart=handler.indexOf("const card=event.target.closest('[data-request-card]')");
  const editButtonStart=handler.indexOf("const button=event.target.closest('[data-edit-request]')",cardStart);
  assert.notEqual(cardStart,-1);
  assert.notEqual(editButtonStart,-1);
  const cardClick=handler.slice(cardStart,editButtonStart);
  assert.match(cardClick,/if\(request\)\{\s*showRequestDetailPage\(request\);/);
  assert.doesNotMatch(cardClick,/showRequestDetails\(request\)/);
  const cardTemplate=source.slice(source.indexOf('return `<article class="request-item request-card"'),source.indexOf('`;\n  }).join',cardStart));
  assert.notEqual(cardTemplate,'');
  assert.doesNotMatch(cardTemplate,/See Details|data-request-detail/);
  assert.match(cardTemplate,/request-card-secondary request-edit-button" data-edit-request/);
  assert.match(dashboard,/request-card-secondary request-edit-button" type="button" data-edit-detail-request/);
  assert.match(styles,/\.request-card-actions button\.request-edit-button\{width:100px;border-color:#171719;background:#171719;color:#fff\}/);
  assert.match(styles,/\.request-detail-owner button\.request-edit-button\{border-color:#171719;background:#171719;color:#fff\}/);
});

test('Landing and direct detail routes use project detail popups',()=>{
  const landing=fs.readFileSync('devmatch-landing.html','utf8');
  const landingSource=fs.readFileSync('assets/js/landing.js','utf8');
  const discover=fs.readFileSync('devmatch-discover-project-detail.html','utf8');
  const find=fs.readFileSync('devmatch-find-project-detail.html','utf8');
  assert.match(landing,/<script src="assets\/js\/project-detail\.js/);
  assert.match(landingSource,/window\.openProjectDetails\(link\.dataset\.projectDetail\)/);
  assert.match(discover,/<script src="assets\/js\/project-detail-route-popup\.js/);
  assert.match(find,/<script src="assets\/js\/project-detail-route-popup\.js/);
});

test('Full project editor preview opens as a dialog and leaves editing available behind it',()=>{
  const html=fs.readFileSync('devmatch-my-projects.html','utf8');
  const source=fs.readFileSync('assets/js/my-projects.js','utf8');
  const styles=fs.readFileSync('assets/css/my-projects.css','utf8');
  const previewFunction=source.match(/function showProjectPreview\(project\)\{([\s\S]*?)\n\}/)?.[1]||'';
  assert.match(html,/<dialog class="project-preview-mode" id="projectPreviewMode"/);
  assert.match(html,/data-close-project-preview/);
  assert.match(previewFunction,/previewDialog\.showModal\(\)/);
  assert.doesNotMatch(previewFunction,/editor\.hidden=true|projectsPage\.hidden=true/);
  assert.match(source,/function closeProjectPreview\(\)\{[\s\S]*previewDialog\.close\(\)/);
  assert.match(source,/getElementById\('projectPreviewMode'\)\.addEventListener\('click',event=>\{\s*if\(event\.target===event\.currentTarget\)closeProjectPreview\(\);\s*\}\)/);
  assert.match(styles,/\.project-preview-mode\[open\]\{/);
});
