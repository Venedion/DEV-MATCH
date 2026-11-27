const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=(relativePath)=>fs.readFileSync(path.join(__dirname,'..',relativePath),'utf8');

test('Client My Requests mobile header shows a plus action that opens the request composer',()=>{
  const html=read('devmatch-client-dashboard.html');
  const css=read('assets/css/client-dashboard.css');
  const js=read('assets/js/client-dashboard.js');

  assert.match(html,/class="client-icon-button mobile-add-request"[^>]*aria-label="Add a new project request"[^>]*data-open-request/);
  assert.match(html,/<button class="request-primary-button" type="button" data-open-request><span aria-hidden="true">＋<\/span> Post a request<\/button>/);
  assert.match(js,/document\.body\.classList\.toggle\('client-requests-view',view==='requests'\)/);
  assert.match(js,/document\.querySelectorAll\('\[data-open-request\]'\)\.forEach\(button=>button\.addEventListener\('click',\(\)=>openRequestComposer\(\)\)\)/);
  assert.match(css,/@media\(orientation: portrait\)\{[\s\S]*?body\.client-requests-view \.client-top-actions>\.mobile-add-request\{display:grid/);
  assert.match(css,/@media\(max-width:600px\) and \(orientation: portrait\)\{[\s\S]*?body\.client-requests-view \.requests-page-heading \.request-primary-button\{display:none\}/);
});

test('Client My Requests mobile statistics use two columns',()=>{
  const html=read('devmatch-client-dashboard.html');
  const css=read('assets/css/client-dashboard.css');

  assert.match(html,/<section class="requests-page" id="requests"[\s\S]*?<div class="request-stats-grid" id="requestStats">/);
  assert.match(css,/@media\(max-width:600px\) and \(orientation: portrait\)\{\s*\.requests-page > #requestStats\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
});

test('Client My Requests mobile replaces its search box with the filtered result count',()=>{
  const html=read('devmatch-client-dashboard.html');
  const css=read('assets/css/client-dashboard.css');
  const js=read('assets/js/client-dashboard.js');

  assert.match(html,/<label class="request-search">[\s\S]*?id="requestSearch"/);
  assert.match(html,/<p class="requests-showing-count" id="requestShowingCount" aria-live="polite">Showing 0 projects<\/p>/);
  assert.match(css,/@media\(max-width:600px\) and \(orientation: portrait\)\{[\s\S]*?#requests \.request-search\{display:none\}[\s\S]*?#requests \.requests-showing-count\{display:block/);
  assert.match(js,/document\.getElementById\('requestShowingCount'\)\.textContent=`Showing \$\{filtered\.length\} projects`;/);
});
