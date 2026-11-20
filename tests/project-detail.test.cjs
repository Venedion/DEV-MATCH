const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

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

test('Project detail comments show timestamp beside Reply',()=>{
  const source=fs.readFileSync('assets/js/project-detail.js','utf8');
  assert.match(source,/comment-actions/);
  assert.match(source,/commentTime/);
  assert.match(source,/<button type="button" class="reply-link"/);
});

test('Project detail comments expose View replies and collapse controls',()=>{
  const source=fs.readFileSync('assets/js/project-detail.js','utf8');
  assert.match(source,/expandedReplies/);
  assert.match(source,/View \$\{replies\.length\}/);
  assert.match(source,/Hide replies/);
  assert.match(source,/data-view-replies/);
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
