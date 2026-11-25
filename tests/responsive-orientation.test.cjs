const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const cssRoot=path.join(root,'assets','css');
const jsRoot=path.join(root,'assets','js');

test('responsive CSS breakpoints are scoped to portrait or landscape orientation',()=>{
  const files=fs.readdirSync(cssRoot).filter(file=>file.endsWith('.css'));
  files.push(path.join('..','assets','js','backend.js'));

  for(const file of files){
    const css=fs.readFileSync(file.startsWith('..')
      ? path.join(__dirname,file)
      : path.join(cssRoot,file),'utf8');
    const queries=[...css.matchAll(/@media\s*([^{]+)\{/gi)];

    for(const [,query] of queries){
      if(/\b(?:min|max)-width\s*:/i.test(query)){
        assert.match(query,/orientation\s*:/i,`${file} has a width-only media query: ${query}`);
      }
    }
  }
});

test('interactive mobile behavior follows viewport orientation, not a width cutoff',()=>{
  const files=[
    ...fs.readdirSync(jsRoot)
      .filter(file=>file.endsWith('.js'))
      .map(file=>path.join(jsRoot,file)),
    ...fs.readdirSync(root)
      .filter(file=>file.endsWith('.html'))
      .map(file=>path.join(root,file)),
  ];

  for(const file of files){
    const source=fs.readFileSync(file,'utf8');
    const queries=[...source.matchAll(/matchMedia\s*\(\s*(['"])(.*?)\1/gs)];

    for(const [, ,query] of queries){
      assert.doesNotMatch(query,/(?:min|max)-width\s*:/i,`${path.basename(file)} has a width-based layout query`);
    }
  }
});

test('mobile navigation and tablet portrait content use mobile layout constraints',()=>{
  const navigation=fs.readFileSync(path.join(cssRoot,'mobile-navigation.css'),'utf8');
  const marketplace=fs.readFileSync(path.join(cssRoot,'marketplace.css'),'utf8');

  assert.match(navigation,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.mobile-bottom-nav\s*\{/);
  assert.match(navigation,/@media\s*\(orientation:\s*portrait\)\s*and\s*\(min-width:\s*700px\)[\s\S]*?max-width:\s*760px\s*!important/);
  assert.match(marketplace,/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\.marketplace-main \.project-grid:not\(\.is-list\)\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
