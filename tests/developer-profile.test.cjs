const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../assets/js/developer-profile.js'),'utf8');

test('Client-facing developer profiles fall back to the existing directory schema',()=>{
  assert.match(source,/const metricColumns='id,display_name,username,account_role,profile_data,published_portfolio_count,published_portfolio_views_count,published_portfolio_favorites_count'/);
  assert.match(source,/const legacyColumns='id,display_name,username,account_role,profile_data,published_portfolio_count'/);
  assert.match(source,/\['42703','PGRST204'\]/);
  assert.doesNotMatch(source,/loadPublicPortfolioProjectMetrics/);
});
