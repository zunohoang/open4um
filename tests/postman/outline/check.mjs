// Offline acceptance boundaries for the small suite; never contacts Gemini.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const collection=JSON.parse(fs.readFileSync(path.join(here,'AI-Outline.postman_collection.json'),'utf8'));
const coverage=JSON.parse(fs.readFileSync(path.join(here,'coverage.json'),'utf8'));
const environment=JSON.parse(fs.readFileSync(path.join(here,'Development.postman_environment.json'),'utf8'));
let scripts=0;const leaves=[];
function walk(item){
  for(const event of item.event||[]){new vm.Script(event.script.exec.join('\n'));scripts++;}
  if(item.item)item.item.forEach(walk);else leaves.push(item);
}
walk(collection);
assert.equal(leaves.length,15);
assert.deepEqual(leaves.map(r=>r.id),coverage.map(r=>r.itemId));
assert.equal(new Set(leaves.map(r=>r.id)).size,15);
const outline=leaves.filter(r=>r.request.url==='{{baseUrl}}/lectures/generate-outline');
assert.equal(outline.length,3);
assert.equal(coverage.filter(r=>r.route==='/lectures/generate-outline'&&r.status===200).length,1);
assert.deepEqual(coverage.filter(r=>r.route==='/lectures/generate-outline').map(r=>r.status).sort(),[200,401,422]);
assert.equal(outline.filter(r=>r.request.auth.type==='noauth').length,1);
assert.deepEqual([...new Set(coverage.map(r=>r.scenario).filter(Boolean))].sort(),['AI-OUTLINE-01','AI-OUTLINE-02','AI-OUTLINE-03']);
for(const item of leaves){
  assert(item.request.url.startsWith('{{baseUrl}}/'));
  assert(!['PUT','PATCH'].includes(item.request.method),'No global configuration mutation');
  if(item.request.method==='POST')assert(['/auth/login','/auth/logout','/admin/users','/lectures/generate-outline'].includes(item.request.url.replace('{{baseUrl}}','')));
  const tests=item.event.find(e=>e.listen==='test').script.exec.join('\n');
  assert(tests.includes('Exact HTTP status')&&tests.includes('Success envelope'));
  for(const event of item.event)assert(!/setNextRequest\([^n]|sendRequest|console\.log/.test(event.script.exec.join('\n')),'No retry loops, hidden side requests, or payload logging');
}
assert.equal(leaves.filter(r=>r.request.url==='{{baseUrl}}/admin/users'&&r.request.method==='POST').length,1);
for(const value of environment.values)if(/password|email|token/i.test(value.key))assert.equal(value.value,'');
console.log(`OK: 3 outline scenarios, ${leaves.length} supporting HTTP requests, ${scripts} scripts compiled; one provider attempt, no retry loops or configuration writes.`);
