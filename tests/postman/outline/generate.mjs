// Standalone default suite. Does not import or execute the backend regression collection.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const collection = {info: {name: 'ABSlider - AI outline (3 scenarios)',
  description: 'Default small suite: valid outline, empty prompt rejection, unauthenticated rejection. One disposable user, one successful-provider attempt, no retries. Setup/readback/cleanup requests are supporting evidence, not extra feature scenarios. Never run against production. Use the Python runner for journaled cleanup.',
  schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'}, item: []};
const flow = {name: 'AI outline - three scenarios', item: []};
collection.item.push(flow);
const coverage = [];
let serial = 900;
const get = key => `pm.environment.get(${JSON.stringify(key)})`;
const set = (key, value) => `pm.environment.set(${JSON.stringify(key)}, ${value});`;
const test = (name, code) => `pm.test(${JSON.stringify(name)}, () => { ${code} });`;
const eq = (name, a, b) => test(name, `pm.expect(${a}).to.eql(${b});`);
const group = name => {const folder = {name, item: []}; flow.item.push(folder); return folder;};
collection.event = [{listen:'prerequest',script:{type:'text/javascript',exec:[
  "if (pm.environment.get('baseUrl') !== 'https://dev-slides-api.sbltcup.dev/api/v1' || pm.environment.get('runMode') !== 'outline' || pm.environment.get('allowMutations') !== 'true') { pm.execution.skipRequest(); pm.execution.setNextRequest(null); throw new Error('Select outline mode on hosted development and explicitly enable fixture writes and one Gemini attempt'); }"
]}}];
function request(parent, name, method, route, {status=200, role='user', body, tests='', before='', critical=false, scenario=null, purpose=parent.name}={}) {
  const id = `API-${++serial}`;
  const itemId = crypto.createHash('md5').update('outline:' + id + name).digest('hex');
  const item = {name:`${id} ${name}`, id:itemId, request:{method, url:'{{baseUrl}}'+route,
    header: body === undefined ? [] : [{key:'Content-Type',value:'application/json'}],
    auth: role === null ? {type:'noauth'} : {type:'bearer',bearer:[{key:'token',value:role==='admin'?'{{adminToken}}':'{{userAToken}}',type:'string'}]}},
    event:[{listen:'prerequest',script:{type:'text/javascript',exec:[before]}},
      {listen:'test',script:{type:'text/javascript',exec:[
        eq('Exact HTTP status','pm.response.code',String(status)),
        'let j; try { j = pm.response.json(); } catch (_) { j = {}; } const d = j.data;',
        eq('Success envelope','j.success',String(status<400)),
        ...(status>=400?[test('Explanatory error',"pm.expect(j.message).to.be.a('string').and.not.empty;")]:[]),
        `if (pm.response.code === ${status}) { ${tests} }`,
        ...(critical?[`if (pm.response.code !== ${status} || j.success !== true) pm.execution.setNextRequest(null);`]:[])
      ]}}]};
  if(body !== undefined) item.request.body={mode:'raw',raw:JSON.stringify(body,null,2),options:{raw:{language:'json'}}};
  parent.item.push(item); coverage.push({id,itemId,name,method,route,status,purpose,scenario});
}
const setup=group('Setup - one disposable QA user');
request(setup,'Verify development release','GET','/version',{role:null,critical:true,before:`
if (pm.environment.get('managedRun') !== 'true') {
  if (pm.environment.get('runId') && pm.environment.get('runComplete') !== 'true') { pm.execution.skipRequest(); pm.execution.setNextRequest(null); throw new Error('Recover the unfinished fixture run first'); }
  pm.environment.set('runId', pm.variables.replaceIn('{{$guid}}').replace(/-/g,''));
}
pm.environment.set('runComplete','false');
pm.environment.set('fixturePassword','Qa9!'+pm.variables.replaceIn('{{$guid}}'));
pm.environment.set('userAEmail','qa-'+pm.environment.get('runId')+'-a@example.com');
for (const key of ['userAId','userAToken','userARefresh','aiLectureId','expectedBalance','generatedOutline']) pm.environment.unset(key);
`,tests:eq('Develop environment','d.release.environment',"'develop'")+"if(d.release.environment!=='develop'){pm.execution.setNextRequest(null);throw new Error('Development release required');}"});
request(setup,'Login QA Admin for fixture setup','POST','/auth/login',{role:null,critical:true,
  body:{email:'{{adminEmail}}',password:'{{adminPassword}}'},tests:eq('Admin role','d.user.role',"'admin'")+
  "if(d.user.role!=='admin'){pm.execution.setNextRequest(null);throw new Error('QA Admin required');}"+set('adminToken','d.accessToken')+set('adminRefresh','d.refreshToken')});
request(setup,'Read outline price - no configuration write','GET','/admin/credit-config',{role:'admin',critical:true,
  tests:test('Positive integer outline price',"pm.expect(Number.isSafeInteger(d.pricePerOutline) && d.pricePerOutline>0).to.eql(true);")+
  "if(!Number.isSafeInteger(d.pricePerOutline)||d.pricePerOutline<=0){pm.execution.setNextRequest(null);throw new Error('Invalid outline price');}"+
  set('outlinePrice','d.pricePerOutline')+set('fixtureBalance','d.pricePerOutline + 10')});
request(setup,'Create one disposable user','POST','/admin/users',{role:'admin',status:201,critical:true,
  body:{name:'QA-{{runId}}-A',email:'{{userAEmail}}',password:'{{fixturePassword}}'},
  before:"const body=JSON.parse(pm.request.body.raw); body.creditBalance=Number(pm.environment.get('fixtureBalance')); pm.request.body.update(JSON.stringify(body));",
  tests:eq('Exact QA email','d.email',get('userAEmail'))+eq('Fixture role','d.role',"'user'")+eq('Starting balance','d.creditBalance',`Number(${get('fixtureBalance')})`)+set('userAId','d._id')});
request(setup,'Login disposable user','POST','/auth/login',{role:null,critical:true,
  body:{email:'{{userAEmail}}',password:'{{fixturePassword}}'},tests:eq('Exact fixture user','d.user.id',get('userAId'))+
  set('userAToken','d.accessToken')+set('userARefresh','d.refreshToken')});

const unauth=group('Scenario 3 - authentication required');
request(unauth,'AI-OUTLINE-03 Reject request without authentication','POST','/lectures/generate-outline',{
  role:null,status:401,body:{prompt:'Explain addition of natural numbers with simple examples.'},scenario:'AI-OUTLINE-03'});
const invalid=group('Scenario 2 - invalid prompt');
request(invalid,'AI-OUTLINE-02 Reject empty prompt','POST','/lectures/generate-outline',{
  status:422,body:{prompt:''},scenario:'AI-OUTLINE-02'});
request(invalid,'Rejected requests did not consume credits','GET','/auth/me',{
  tests:eq('Balance unchanged','d.creditBalance',`Number(${get('fixtureBalance')})`),scenario:'AI-OUTLINE-02'});

const valid=group('Scenario 1 - real outline generation');
request(valid,'AI-OUTLINE-01 Generate a real structured outline','POST','/lectures/generate-outline',{
  body:{prompt:'QA-{{runId}}: Create an introductory lesson outline explaining addition of natural numbers with examples 2 + 3 = 5 and 4 + 1 = 5.'},
  scenario:'AI-OUTLINE-01',tests:
  // Record IDs before assertions, so cleanup can still identify failed output.
  set('aiLectureId','d.lecture && d.lecture._id')+set('generatedOutline','JSON.stringify(d.outline)')+set('expectedBalance',`Number(${get('fixtureBalance')})-Number(${get('outlinePrice')})`)+
  test('Usable structured outline',`pm.expect(d.outline.title).to.be.a('string').and.not.empty; pm.expect(d.outline.sections).to.be.an('array').and.not.empty; for(const section of d.outline.sections){pm.expect(section.heading).to.be.a('string').and.not.empty;pm.expect(section.bullets).to.be.an('array');for(const bullet of section.bullets)pm.expect(bullet).to.be.a('string');}`)+
  eq('Expected outline charge','d.creditSpent',`Number(${get('outlinePrice')})`)+eq('Balance after charge','d.creditBalance',`Number(${get('expectedBalance')})`)+
  eq('Lecture belongs to fixture','d.lecture.userId',get('userAId'))});
request(valid,'Verify charged balance independently','GET','/auth/me',{
  tests:eq('Persisted balance','d.creditBalance',`Number(${get('expectedBalance')})`),scenario:'AI-OUTLINE-01'});
request(valid,'Verify saved outline independently','GET','/lectures/{{aiLectureId}}',{
  before:"if(!/^[a-f0-9]{24}$/i.test(pm.environment.get('aiLectureId')||''))pm.execution.skipRequest();",
  tests:eq('Persisted generated outline','d.outline',`JSON.parse(${get('generatedOutline')})`)+eq('Correct owner','d.userId',get('userAId')),scenario:'AI-OUTLINE-01'});

const cleanup=group('Cleanup - remove only this run fixture');
request(cleanup,'Revoke fixture refresh session','POST','/auth/logout',{role:null,body:{refreshToken:'{{userARefresh}}'}});
request(cleanup,'Delete disposable user and owned lecture','DELETE','/admin/users/{{userAId}}',{role:'admin',
  before:"if(!/^[a-f0-9]{24}$/i.test(pm.environment.get('userAId')||'')){pm.execution.skipRequest();throw new Error('No verified fixture ID');}"});
request(cleanup,'Verify fixture removed','GET','/admin/users?search={{userAEmail}}',{role:'admin',
  tests:test('Exact fixture absent',`pm.expect(d.items.some(u=>u.email===${get('userAEmail')})).to.eql(false);`)});
request(cleanup,'Logout QA Admin','POST','/auth/logout',{role:null,body:{refreshToken:'{{adminRefresh}}'},tests:set('runComplete',"'true'")});

const environment={name:'ABSlider AI outline - local template',values:Object.entries({baseUrl:'https://dev-slides-api.sbltcup.dev/api/v1',runMode:'outline',allowMutations:'false',adminEmail:'',adminPassword:''}).map(([key,value])=>({key,value,type:key==='adminPassword'?'secret':'default',enabled:true})),_postman_variable_scope:'environment'};
for(const [name,data] of Object.entries({'AI-Outline.postman_collection.json':collection,'Development.postman_environment.json':environment,'coverage.json':coverage}))
  fs.writeFileSync(path.join(here,name),JSON.stringify(data,null,2)+'\n');
console.log(`Generated ${coverage.length} HTTP requests supporting exactly three outline scenarios. One Gemini attempt; no global Credit writes.`);
