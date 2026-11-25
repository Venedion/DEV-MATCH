const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Find Clients appends requests to owner groups without copying earlier rows',()=>{
  const source=fs.readFileSync('assets/js/find-clients.js','utf8');
  assert.doesNotMatch(source,/requestsByOwner\.set\(row\.owner_id,\[\.\.\.\(/);
});

test('Find Clients loads request details only when their modal is opened',()=>{
  const source=fs.readFileSync('assets/js/find-clients.js','utf8');
  const loadClients=source.slice(source.indexOf('async function loadClients()'),source.indexOf('populateBusinessTypeOptions();'));
  const openRequests=source.slice(source.indexOf('async function openClientRequestsModal'),source.indexOf('// Event Listeners Setup'));
  assert.match(loadClients,/select\('id,display_name,username,account_role,profile_data,open_request_count'/);
  assert.match(loadClients,/select\('id',\s*\{count:'exact',head:true\}\)/);
  assert.doesNotMatch(loadClients,/select\('id,owner_id,title,project_type,category,price,data,status,created_at,updated_at'/);
  assert.match(openRequests,/\.eq\('owner_id',client\.id\)\.eq\('project_kind','request'\)\.eq\('status','open'\)/);
  assert.match(openRequests,/client\.requestsTask/);
});
