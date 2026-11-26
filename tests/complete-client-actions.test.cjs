const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/js/complete.js'),'utf8');

function renderCompletion(role){
  const primaryLabel={textContent:'Add your first project'};
  const elements={
    title:{textContent:'Your profile is ready!'},
    description:{textContent:'Your profile details are saved. Add your first project so clients can discover your work and contact you.'},
    primaryAction:{href:'devmatch-dashboard.html?create=1',querySelector:()=>primaryLabel},
    dashboardAction:{href:'devmatch-dashboard.html',innerHTML:'Go to dashboard'}
  };
  const document={
    getElementById:id=>elements[id],
    querySelector:()=>primaryLabel
  };
  vm.runInNewContext(source,{window:{location:{search:`?role=${role}`}},document,URLSearchParams});
  return {elements,primaryLabel};
}

test('client completion links to posting a request and offers Explore with its icon',()=>{
  const {elements,primaryLabel}=renderCompletion('client');
  assert.equal(primaryLabel.textContent,'Post a request');
  assert.equal(elements.primaryAction.href,'devmatch-client-dashboard.html#request-new');
  assert.equal(elements.dashboardAction.href,'devmatch-discover-projects.html');
  assert.match(elements.dashboardAction.innerHTML,/<svg viewBox="0 0 24 24" aria-hidden="true">/);
  assert.match(elements.dashboardAction.innerHTML,/<span>Explore<\/span>/);
});

test('developer completion actions remain unchanged',()=>{
  const {elements,primaryLabel}=renderCompletion('dev');
  assert.equal(primaryLabel.textContent,'Add your first project');
  assert.equal(elements.primaryAction.href,'devmatch-dashboard.html?create=1');
  assert.equal(elements.dashboardAction.href,'devmatch-dashboard.html');
  assert.equal(elements.dashboardAction.innerHTML,'Go to dashboard');
});
