// Source of the importable collection. Regenerate with: node tests/postman/generate.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const baseline = { pricePerLecture: 80, pricePerSlide: 10, pricePerAiEdit: 5, pricePerOutline: 5, signupBonus: 100 };
const invalid = [0, -1, 1.5, 'abc', '5abc', '', '   ', null, false, '5', [], {}];
const collection = {info: {name: 'ABSlider — Development API QA',
  description: 'Whole-backend functional API tests. Select one top-level folder. Core is the default; successful AI and email requests require separate opt-in modes. Use the Python runner for journaled recovery. Never import real credentials into a shared environment. TC-UC032-03 is excluded.',
  schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'}, item: []};
const inventory = [];
let serial = 0;
const env = key => `pm.environment.get(${JSON.stringify(key)})`;
const set = (key, expression) => `pm.environment.set(${JSON.stringify(key)}, ${expression});`;
const check = (name, expression) => `pm.test(${JSON.stringify(name)}, () => { ${expression} });`;
const eq = (name, a, b) => check(name, `pm.expect(${a}).to.eql(${b});`);
const pick = expression => `Object.fromEntries(${JSON.stringify(Object.keys(baseline))}.map(k => [k, ${expression}[k]]))`;
const section = (parent, name, mode) => {
  const folder = { name, item: [] };
  if (mode) folder.event = [{listen: 'prerequest', script: {type: 'text/javascript', exec: [
    `if (pm.environment.get('runMode') !== '${mode}') { pm.execution.skipRequest(); }`,
    ...(mode !== 'public' ? ["if (pm.environment.get('allowMutations') !== 'true') { pm.execution.skipRequest(); pm.execution.setNextRequest(null); throw new Error('BLOCKED: enable allowMutations for an exclusive development QA window'); }"] : [])
  ]}}];
  parent.item.push(folder); return folder;
};
function request(parent, name, method, route, options = {}) {
  const { body, status = 200, role = 'A', tests = '', before = '', critical = false, external = false } = options;
  const id = `API-${String(++serial).padStart(3, '0')}`;
  const expectedSuccess = status < 400;
  const after = [eq('Exact HTTP status', 'pm.response.code', String(status)),
    "let j; try { j = pm.response.json(); } catch (_) { j = {}; } const d = j.data;",
    eq('Success envelope', 'j.success', String(expectedSuccess)),
    ...(!expectedSuccess ? [check('Error message provided', "pm.expect(j.message).to.be.a('string').and.not.empty;")] : []),
    `if (pm.response.code === ${status}) { ${tests} }`,
    ...(critical ? [`if (pm.response.code !== ${status}) pm.execution.setNextRequest(null);`] : [])];
  const item = {name: `${id} ${name}`, id: crypto.createHash('md5').update(id + name).digest('hex'),
    request: {method, header: body === undefined ? [] : [{key: 'Content-Type', value: 'application/json'}],
      url: external ? route : '{{baseUrl}}' + route,
      auth: role === null ? {type: 'noauth'} : {type: 'bearer', bearer: [{key: 'token', value: role === 'bad' ? 'invalid-token' : `{{${role === 'admin' ? 'admin' : 'user' + role}Token}}`, type: 'string'}]}},
    event: [{listen:'prerequest', script:{type:'text/javascript',exec:[
      "const block = (message) => { pm.execution.skipRequest(); pm.execution.setNextRequest(null); throw new Error(message); };",
      before.replaceAll('throw new Error(', 'block(')
    ]}},
      {listen:'test',script:{type:'text/javascript',exec:after}}]};
  if (body !== undefined) item.request.body = {mode:'raw', raw:typeof body === 'string' ? body : JSON.stringify(body, null, 2), options:{raw:{language:'json'}}};
  parent.item.push(item);
  inventory.push({id, name, method, route, status, group:parent.name});
  return item;
}

collection.event = [{listen:'prerequest',script:{type:'text/javascript',exec:[
  "if (pm.environment.get('baseUrl') !== 'https://dev-slides-api.sbltcup.dev/api/v1') { pm.execution.skipRequest(); pm.execution.setNextRequest(null); throw new Error('Only hosted development is allowed'); }"
]}}];

const publicSmoke = section(collection, 'Public smoke', 'public');
for (const route of ['/health','/health/live','/health/ready']) request(publicSmoke, `GET ${route}`, 'GET', route,
  {role:null, tests:eq('Health state', 'd.status', JSON.stringify(route.endsWith('ready') ? 'ready':'ok'))});
request(publicSmoke,'Develop release','GET','/version',{role:null,tests:eq('Development environment','d.release.environment',"'develop'")});
for (const route of ['/auth/me','/admin/users','/admin/credit-config','/admin/ai-usage','/admin/dashboard','/lectures','/folders'])
  request(publicSmoke,`Authentication required ${route}`,'GET',route,{role:null,status:401});
request(publicSmoke,'Invalid access token','GET','/auth/me',{role:'bad',status:401});

const initialize = `
if (pm.environment.get('managedRun') !== 'true') {
  if (pm.environment.get('runId') && pm.environment.get('runComplete') !== 'true') {
    throw new Error('Previous run is unfinished. Run its Cleanup folder or recover it before starting again.');
  }
  pm.environment.set('runId', pm.variables.replaceIn('{{$guid}}').replace(/-/g, ''));
}
pm.environment.set('runComplete', 'false');
pm.environment.set('fixturePassword', 'Qa9!' + pm.variables.replaceIn('{{$guid}}'));
pm.environment.set('changedPassword', 'Qa8!' + pm.variables.replaceIn('{{$guid}}'));
for (const letter of ['A','B','C']) {
  pm.environment.set('user' + letter + 'Email', 'qa-' + pm.environment.get('runId') + '-' + letter.toLowerCase() + '@example.com');
  pm.environment.unset('user' + letter + 'Id');
}
`;
const login = (parent, letter, password = '{{fixturePassword}}', status = 200) => request(parent,`Login ${letter}`, 'POST','/auth/login', {
  role:null, status, body:{email:`{{user${letter}Email}}`,password}, critical:status===200,
  tests:status===200 ? [check('User role and token',"pm.expect(d.user.role).to.eql('user'); pm.expect(d.accessToken).to.be.a('string').and.not.empty;"),
    set(`user${letter}Token`,'d.accessToken'),set(`user${letter}Refresh`,'d.refreshToken'),set(`user${letter}Balance`,'d.user.creditBalance')].join('\n') : ''});
const adminLogin = parent => request(parent,'Login QA Admin','POST','/auth/login',{role:null,
  body:{email:'{{adminEmail}}',password:'{{adminPassword}}'},critical:true,
  tests:eq('Admin role','d.user.role',"'admin'") + "if (d.user.role !== 'admin') { pm.execution.setNextRequest(null); throw new Error('BLOCKED: QA account is not Admin'); }" + set('adminToken','d.accessToken') + set('adminId','d.user.id') + set('adminRefresh','d.refreshToken')});
function setup(parent, ai=false) {
  const folder = section(parent,'Setup');
  request(folder,'Verify develop release','GET','/version',{role:null,critical:true,before:initialize,
    tests:eq('Development only','d.release.environment',"'develop'") + "if (d.release.environment !== 'develop') { pm.execution.setNextRequest(null); throw new Error('Wrong release environment'); }" + set('releaseSha','d.release.sha')});
  request(folder,'Ready dependencies','GET','/health/ready',{role:null,critical:true,tests:eq('Ready','d.status',"'ready'")});
  adminLogin(folder);
  request(folder,'Snapshot original Credit configuration','GET','/admin/credit-config',{role:'admin',critical:true,
    tests:check('Five valid fields',`for (const k of ${JSON.stringify(Object.keys(baseline))}) { pm.expect(d[k]).to.be.a('number'); pm.expect(Number.isSafeInteger(d[k]) && d[k]>0).to.eql(true); }`)
      + `if (!${JSON.stringify(Object.keys(baseline))}.every(k => Number.isSafeInteger(d[k]) && d[k]>0)) { pm.execution.setNextRequest(null); throw new Error('Required Credit contract missing'); }`
      + set('originalConfig',`JSON.stringify(${pick('d')})`)});
  for (const letter of ['A','B','C']) {
    request(folder,`Create disposable user ${letter}`,'POST','/admin/users',{role:'admin',status:201,critical:true,
      body:{name:`QA-{{runId}}-${letter}`,email:`{{user${letter}Email}}`,password:'{{fixturePassword}}',creditBalance:letter==='C'?0:ai?1000:100},
      tests:eq('Created exact fixture','d.email',env(`user${letter}Email`)) + set(`user${letter}Id`,'d._id') + check('No password hash',"pm.expect(d).not.to.have.property('passwordHash');")});
    login(folder,letter);
  }
}
function cleanup(parent) {
  const folder = section(parent,'Cleanup');
  request(folder,'Restore original Credit configuration','PATCH','/admin/credit-config',{role:'admin',body:'{{originalConfig}}',
    before:"if (!pm.environment.get('originalConfig')) pm.execution.skipRequest();",
    tests:eq('Original values returned',pick('d'),`JSON.parse(${env('originalConfig')})`)});
  request(folder,'Verify restored Credit configuration','GET','/admin/credit-config',{role:'admin',
    before:"if (!pm.environment.get('originalConfig')) pm.execution.skipRequest();",
    tests:eq('Original values persisted',pick('d'),`JSON.parse(${env('originalConfig')})`)});
  for (const letter of ['A','B','C']) {
    request(folder,`Delete only disposable user ${letter}`,'DELETE',`/admin/users/{{user${letter}Id}}`,{role:'admin',
      before:`if (!pm.environment.get('user${letter}Id')) pm.execution.skipRequest();`,
      tests:set(`user${letter}Id`,"''")});
    request(folder,`Confirm disposable user ${letter} removed`,'GET',`/admin/users?search={{user${letter}Email}}`,{role:'admin',
      tests:check('Exact fixture absent',`pm.expect(d.items.some(u=>u.email===${env(`user${letter}Email`)})).to.eql(false);`)});
    request(folder,`Revoke disposable user ${letter} refresh token`,'POST','/auth/logout',{role:null,
      body:{refreshToken:`{{user${letter}Refresh}}`},before:`if (!pm.environment.get('user${letter}Refresh')) pm.execution.skipRequest();`});
  }
  request(folder,'Logout QA Admin','POST','/auth/logout',{role:null,body:{refreshToken:'{{adminRefresh}}'},
    tests:set('runComplete',"'true'")});
}

const core=section(collection,'Core','core'); setup(core);
const auth=section(core,'Authentication and profile');
request(auth,'Read profile','GET','/auth/me',{tests:eq('Correct user','d.id',env('userAId'))+check('Password hash absent',"pm.expect(d).not.to.have.property('passwordHash');")});
request(auth,'Refresh access token','POST','/auth/refresh',{role:null,body:{refreshToken:'{{userARefresh}}'},tests:set('userAToken','d.accessToken')});
request(auth,'Bad login credentials','POST','/auth/login',{role:null,status:401,body:{email:'{{userAEmail}}',password:'Incorrect9!'}});
request(auth,'Invalid email format','POST','/auth/login',{role:null,status:422,body:{email:'not-an-email',password:'Valid123'}});
request(auth,'Duplicate registration','POST','/auth/register',{role:null,status:409,body:{name:'QA duplicate',email:'{{userAEmail}}',password:'{{fixturePassword}}'}});
for (const route of ['/auth/send-register-otp','/auth/forgot-password']) request(auth,`Invalid email ${route}`,'POST',route,{role:null,status:422,body:{email:'invalid'}});
request(auth,'Registration validation','POST','/auth/register',{role:null,status:422,body:{name:'x',email:'invalid',password:'1'}});
request(auth,'Reset validation','POST','/auth/reset-password',{role:null,status:422,body:{email:'{{userAEmail}}',otp:'bad',password:'1'}});
request(auth,'Invalid OTP without sending email','POST','/auth/reset-password',{role:null,status:400,body:{email:'{{userAEmail}}',otp:'000000',password:'{{changedPassword}}'}});
request(auth,'Empty profile name','PATCH','/auth/profile',{status:422,body:{name:' '}});
request(auth,'Reject PDF avatar','PATCH','/auth/profile',{status:400,body:{avatar:'data:application/pdf;base64,JVBERg=='}});
request(auth,'Update name and avatar','PATCH','/auth/profile',{body:{name:'QA-{{runId}}-Updated',avatar:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='},
  tests:eq('Updated name','d.name',"'QA-' + " + env('runId') + " + '-Updated'") + check('Avatar retained',"pm.expect(d.avatar.startsWith('data:image/png;base64,')).to.eql(true);")});
request(auth,'Profile changes persist','GET','/auth/me',{tests:eq('Persisted name','d.name',"'QA-' + " + env('runId') + " + '-Updated'")});
request(auth,'Profile cooldown','PATCH','/auth/profile',{status:429,body:{name:'QA-{{runId}}-TooSoon'}});
request(auth,'Mismatched password confirmation','PATCH','/auth/change-password',{status:422,body:{oldPassword:'{{fixturePassword}}',newPassword:'{{changedPassword}}',confirmPassword:'mismatch'}});
request(auth,'Incorrect old password','PATCH','/auth/change-password',{status:400,body:{oldPassword:'wrong',newPassword:'{{changedPassword}}',confirmPassword:'{{changedPassword}}'}});
request(auth,'Change disposable user password','PATCH','/auth/change-password',{body:{oldPassword:'{{fixturePassword}}',newPassword:'{{changedPassword}}',confirmPassword:'{{changedPassword}}'}});
login(auth,'A','{{fixturePassword}}',401); login(auth,'A','{{changedPassword}}');
request(auth,'Restore disposable password','PATCH','/auth/change-password',{body:{oldPassword:'{{changedPassword}}',newPassword:'{{fixturePassword}}',confirmPassword:'{{fixturePassword}}'}});
login(auth,'A');

const permissions=section(core,'Role authorization');
for (const route of ['/admin/users','/admin/credit-config','/admin/ai-usage','/admin/dashboard']) request(permissions,`User denied ${route}`,'GET',route,{status:403});
request(permissions,'User cannot update Credit','PATCH','/admin/credit-config',{status:403,body:{pricePerSlide:7}});
request(permissions,'Anonymous cannot update Credit','PATCH','/admin/credit-config',{role:null,status:401,body:{pricePerSlide:7}});
for (const route of ['/lectures','/folders']) request(permissions,`Admin cannot act as normal user ${route}`,'GET',route,{role:'admin',status:403});

const folders=section(core,'Folders and lectures');
request(folders,'Create folder','POST','/folders',{status:201,body:{name:'QA-{{runId}}'},tests:set('folderId','d._id')});
request(folders,'Reject blank folder','POST','/folders',{status:422,body:{name:'  '}});
request(folders,'List owned folders','GET','/folders',{tests:check('Created folder present',`pm.expect(d.some(f=>f._id===${env('folderId')})).to.eql(true);`)});
request(folders,'Rename folder','PATCH','/folders/{{folderId}}',{body:{name:'QA-{{runId}}-Renamed'},tests:eq('Folder renamed','d.name',"'QA-' + " + env('runId') + " + '-Renamed'")});
request(folders,'Reject blank folder rename','PATCH','/folders/{{folderId}}',{body:{name:''},status:422});
request(folders,'Other user cannot rename folder','PATCH','/folders/{{folderId}}',{role:'B',body:{name:'stolen'},status:404});
request(folders,'Other user cannot delete folder','DELETE','/folders/{{folderId}}',{role:'B',status:404});
request(folders,'Create blank lecture without AI','POST','/lectures/blank',{status:201,body:{title:'QA-{{runId}}',folderId:'{{folderId}}'},critical:true,
  tests:set('lectureId','d._id')+set('slideId','d.slides[0].id')+eq('One initial slide','d.slides.length','1')});
request(folders,'Reject blank lecture title','POST','/lectures/blank',{status:422,body:{title:''}});
request(folders,'Read exact lecture','GET','/lectures/{{lectureId}}',{tests:eq('Correct owner','d.userId',env('userAId'))+eq('Correct folder','d.folderId',env('folderId'))});
request(folders,'Search and filter lectures','GET','/lectures?search={{runId}}&folderId={{folderId}}&page=1&limit=1&sortBy=title&sortOrder=asc',{
  tests:eq('Exactly one matching lecture','d.total','1')+eq('Matching lecture','d.items[0]._id',env('lectureId'))+eq('Page limit','d.limit','1')});
request(folders,'Empty search','GET','/lectures?search=no-match-{{runId}}',{tests:eq('No results','d.total','0')});
request(folders,'Rename lecture','PATCH','/lectures/{{lectureId}}',{body:{title:'QA-{{runId}}-Renamed'},tests:eq('Name updated','d.title',"'QA-' + " + env('runId') + " + '-Renamed'")});
request(folders,'Autosave lecture','PATCH','/lectures/{{lectureId}}/autosave',{body:{title:'QA-{{runId}}-Autosaved'},tests:check('Saved timestamp',"pm.expect(d.savedAt).to.be.a('string');")});
request(folders,'Verify autosave persisted','GET','/lectures/{{lectureId}}',{tests:eq('Autosave persisted','d.title',"'QA-' + " + env('runId') + " + '-Autosaved'")});
request(folders,'Reject empty lecture rename','PATCH','/lectures/{{lectureId}}',{status:422,body:{title:''}});
request(folders,'Missing lecture','GET','/lectures/000000000000000000000001',{status:404});
for (const [method,route,body] of [['GET','/lectures/{{lectureId}}'],['PATCH','/lectures/{{lectureId}}',{title:'stolen'}],
  ['PATCH','/lectures/{{lectureId}}/autosave',{title:'stolen'}],['GET','/lectures/{{lectureId}}/presentation'],
  ['POST','/lectures/{{lectureId}}/duplicate'],['DELETE','/lectures/{{lectureId}}'],['DELETE','/lectures/{{lectureId}}/permanent'],
  ['POST','/lectures/{{lectureId}}/restore'],['POST','/lectures/{{lectureId}}/export'],
  ['POST','/lectures/{{lectureId}}/slides',{operation:'add'}],['POST','/lectures/{{lectureId}}/ai-edit',{slideId:'{{slideId}}',instruction:'QA edit'}],
  ['POST','/lectures/{{lectureId}}/ai-chat',{message:'QA edit'}]]) request(folders,`Ownership ${method} ${route}` ,method,route,{role:'B',status:404,body});
request(folders,'Other user listing stays private','GET','/lectures?search={{runId}}',{role:'B',tests:eq('No leaked lecture','d.total','0')});
request(folders,'Other user folders stay private','GET','/folders',{role:'B',tests:eq('No leaked folder','d.length','0')});

const slides=section(core,'Slide operations and presentation');
request(slides,'Add slide','POST','/lectures/{{lectureId}}/slides',{body:{operation:'add'},tests:eq('Two slides','d.slides.length','2')+set('addedSlideId','d.slides[1].id')});
request(slides,'Update slide content','POST','/lectures/{{lectureId}}/slides',{body:{operation:'update',slideId:'{{addedSlideId}}',patch:{title:'QA updated slide'}},tests:eq('Updated slide title','d.slides[1].title',"'QA updated slide'")});
request(slides,'Duplicate slide','POST','/lectures/{{lectureId}}/slides',{body:{operation:'duplicate',slideId:'{{addedSlideId}}'},tests:eq('Three slides','d.slides.length','3')+set('clonedSlideId','d.slides[2].id')+check('Independent slide id',"pm.expect(d.slides[2].id).not.to.eql(d.slides[1].id);")});
request(slides,'Move slide to start','POST','/lectures/{{lectureId}}/slides',{body:{operation:'move',slideId:'{{clonedSlideId}}',toIndex:0},tests:eq('Order persisted in response','d.slides[0].id',env('clonedSlideId'))});
request(slides,'Delete moved slide','POST','/lectures/{{lectureId}}/slides',{body:{operation:'delete',slideId:'{{clonedSlideId}}'},tests:eq('Two remaining slides','d.slides.length','2')});
request(slides,'Invalid slide operation','POST','/lectures/{{lectureId}}/slides',{status:422,body:{operation:'move',slideId:'{{slideId}}',toIndex:-1}});
request(slides,'Read presentation','GET','/lectures/{{lectureId}}/presentation',{tests:eq('Presentation id','d.id',env('lectureId'))+eq('Presentation slide count','d.slides.length','2')});
request(slides,'Export JSON bundle','POST','/lectures/{{lectureId}}/export',{tests:eq('Export count','d.data.slideCount','2')+eq('Export identity','d.data.id',env('lectureId'))+
  check('Storage URL or documented fallback',"pm.expect(d.downloadUrl === null || d.downloadUrl.startsWith('https://dev-slides-media.sbltcup.dev/')).to.eql(true);")+set('exportDownloadUrl',"d.downloadUrl || ''")+
  `if (d.downloadUrl && d.downloadUrl.startsWith('https://dev-slides-media.sbltcup.dev/')) {
     pm.sendRequest({url:d.downloadUrl,method:'GET'}, (error,response) => {
       pm.test('Stored export is downloadable and matches the lecture', () => {
         pm.expect(error).to.equal(null); pm.expect(response.code).to.eql(200);
         const exported=response.json(); pm.expect(exported.id).to.eql(d.data.id);
         pm.expect(exported.slides).to.eql(d.data.slides);
       });
     });
   }`});
// Export URLs can contain credentials in query strings. The runner records only
// the storage object pathname, never signed query parameters.

const lifecycle=section(core,'Lecture lifecycle');
request(lifecycle,'Duplicate lecture','POST','/lectures/{{lectureId}}/duplicate',{status:201,tests:set('duplicateId','d._id')+eq('Cloned content count','d.slides.length','2')+check('Independent lecture id',`pm.expect(d._id).not.to.eql(${env('lectureId')});`)});
request(lifecycle,'Rename duplicate independently','PATCH','/lectures/{{duplicateId}}',{body:{title:'QA-{{runId}}-Copy'}});
request(lifecycle,'Original title unchanged','GET','/lectures/{{lectureId}}',{tests:eq('Independent clone','d.title',"'QA-' + " + env('runId') + " + '-Autosaved'")});
request(lifecycle,'Soft delete clone','DELETE','/lectures/{{duplicateId}}');
request(lifecycle,'Deleted clone is inaccessible','GET','/lectures/{{duplicateId}}',{status:404});
request(lifecycle,'Clone appears in trash','GET','/lectures/trash',{tests:check('Trashed clone exists',`pm.expect(d.some(l=>l._id===${env('duplicateId')})).to.eql(true);`)});
request(lifecycle,'Restore clone','POST','/lectures/{{duplicateId}}/restore',{tests:eq('Restored state','d.deletedAt','null')});
request(lifecycle,'Read restored clone','GET','/lectures/{{duplicateId}}',{tests:eq('Restore retained slides','d.slides.length','2')});
request(lifecycle,'Permanently delete fixture clone','DELETE','/lectures/{{duplicateId}}/permanent');
request(lifecycle,'Permanent deletion persists','GET','/lectures/{{duplicateId}}',{status:404});
request(lifecycle,'Delete folder','DELETE','/folders/{{folderId}}');
request(lifecycle,'Folder deletion preserves lecture','GET','/lectures/{{lectureId}}',{tests:eq('Lecture unfiled','d.folderId','null')});

const aiErrors=section(core,'AI validation without provider calls');
for (const [route,body] of [['/lectures/generate-outline',{prompt:'x'}],['/lectures',{title:'x'}],
  ['/lectures/{{lectureId}}/ai-edit',{slideId:'',instruction:''}],['/lectures/{{lectureId}}/ai-chat',{message:''}]])
  request(aiErrors,`AI validation ${route}`,'POST',route,{status:422,body});
request(aiErrors,'Create zero-credit user lecture','POST','/lectures/blank',{role:'C',status:201,body:{title:'QA-{{runId}}-Zero'},tests:set('zeroLectureId','d._id')+set('zeroSlideId','d.slides[0].id')});
for (const [route,body] of [['/lectures/generate-outline',{prompt:'A valid teaching topic'}],['/lectures',{title:'QA',outline:{title:'QA',sections:[{heading:'Intro',bullets:['One']}]}}],
  ['/lectures/{{zeroLectureId}}/ai-edit',{slideId:'{{zeroSlideId}}',instruction:'Make title clearer'}],['/lectures/{{zeroLectureId}}/ai-chat',{message:'Make title clearer'}]])
  request(aiErrors,`Insufficient Credit ${route}`,'POST',route,{role:'C',status:402,body});
request(aiErrors,'Rejected AI calls did not charge','GET','/auth/me',{role:'C',tests:eq('Zero balance unchanged','d.creditBalance','0')});
request(aiErrors,'Rejected AI calls created no usage','GET','/admin/ai-usage?userId={{userCId}}',{role:'admin',tests:eq('No usage records','d.total','0')});

const admin=section(core,'Admin users and reporting');
request(admin,'Find exact QA user','GET','/admin/users?search={{userCEmail}}&limit=1&page=1',{role:'admin',tests:eq('Exact search count','d.total','1')+eq('Exact user','d.items[0]._id',env('userCId'))});
request(admin,'Reject negative balance','PATCH','/admin/users/{{userCId}}',{role:'admin',status:422,body:{creditBalance:-1}});
request(admin,'Update fixture name and balance','PATCH','/admin/users/{{userCId}}',{role:'admin',body:{name:'QA-{{runId}}-C-Updated',creditBalance:23},tests:eq('Updated balance','d.creditBalance','23')});
request(admin,'Reject duplicate user email','PATCH','/admin/users/{{userCId}}',{role:'admin',status:409,body:{email:'{{userAEmail}}'}});
request(admin,'Protect Admin update','PATCH','/admin/users/{{adminId}}',{role:'admin',status:403,body:{creditBalance:1}});
request(admin,'Protect Admin lock','PATCH','/admin/users/{{adminId}}/lock',{role:'admin',status:403});
request(admin,'Protect Admin deletion','DELETE','/admin/users/{{adminId}}',{role:'admin',status:403});
request(admin,'Lock fixture user','PATCH','/admin/users/{{userCId}}/lock',{role:'admin',tests:eq('Locked status','d.status',"'locked'")});
login(admin,'C','{{fixturePassword}}',403);
request(admin,'Locked user cannot refresh','POST','/auth/refresh',{role:null,status:403,body:{refreshToken:'{{userCRefresh}}'}});
request(admin,'Restore fixture user','PATCH','/admin/users/{{userCId}}/restore',{role:'admin',tests:eq('Active status','d.status',"'active'")});
login(admin,'C');
request(admin,'Usage empty date range','GET','/admin/ai-usage?from=2000-01-01&to=2000-01-01',{role:'admin',tests:eq('Empty historical range','d.total','0')});
for (const route of ['/admin/ai-usage','/admin/dashboard']) {
  request(admin,`Reject reversed dates ${route}`,'GET',route+'?from=2026-10-28&to=2026-10-01',{role:'admin',status:422});
  request(admin,`Reject invalid date ${route}`,'GET',route+'?from=2026-02-30',{role:'admin',status:422});
}
request(admin,'Dashboard one-day structure and totals','GET','/admin/dashboard?from=2000-01-01&to=2000-01-01',{role:'admin',
  tests:eq('One daily bucket','d.series.length','1')+eq('No activity in empty range','d.totals',JSON.stringify({users:0,lectures:0,aiUsages:0,aiSlides:0,creditsSpent:0}))+check('All-time totals are nonnegative',"for (const v of Object.values(d.allTime)) pm.expect(v).to.be.at.least(0);")});
request(admin,'Dashboard rejects excessive range','GET','/admin/dashboard?from=2000-01-01&to=2026-01-01',{role:'admin',status:422});

const credit=section(core,'Credit configuration');
request(credit,'Establish five-field baseline','PATCH','/admin/credit-config',{role:'admin',body:baseline,tests:eq('Baseline returned',pick('d'),JSON.stringify(baseline))});
let expected = {...baseline};
for (const [key,value] of [['pricePerSlide',7],['pricePerAiEdit',3],['pricePerLecture',81],['pricePerOutline',6],['pricePerSlide',1],['signupBonus',101]]) {
  expected[key]=value;
  request(credit,`Partial update ${key}=${value}`,'PATCH','/admin/credit-config',{role:'admin',body:{[key]:value},tests:eq('Only intended field changed',pick('d'),JSON.stringify(expected))});
  request(credit,`Read back ${key}`,'GET','/admin/credit-config',{role:'admin',tests:eq('Persisted values',pick('d'),JSON.stringify(expected))});
}
request(credit,'Reset baseline before invalid cases','PATCH','/admin/credit-config',{role:'admin',body:baseline});
for (const key of Object.keys(baseline)) for (const value of invalid) {
  request(credit,`Reject ${key}=${JSON.stringify(value)}`,'PATCH','/admin/credit-config',{role:'admin',status:422,body:{[key]:value}});
  request(credit,`Verify rejection ${key}=${JSON.stringify(value)}`,'GET','/admin/credit-config',{role:'admin',tests:eq('Configuration unchanged',pick('d'),JSON.stringify(baseline))});
}
for (const body of [{},{unknownCredit:2},{pricePerSlide:6,pricePerAiEdit:0}]) {
  request(credit,'Reject empty, unknown or mixed payload','PATCH','/admin/credit-config',{role:'admin',status:422,body});
  request(credit,'No partial write after rejection','GET','/admin/credit-config',{role:'admin',tests:eq('Atomic rejection',pick('d'),JSON.stringify(baseline))});
}
request(credit,'Correct both fields','PATCH','/admin/credit-config',{role:'admin',body:{pricePerSlide:6,pricePerAiEdit:6},tests:eq('Corrected values',pick('d'),JSON.stringify({...baseline,pricePerSlide:6,pricePerAiEdit:6}))});

const logout=section(core,'Logout semantics');
request(logout,'Logout user A','POST','/auth/logout',{role:null,body:{refreshToken:'{{userARefresh}}'}});
request(logout,'Logged-out refresh token rejected','POST','/auth/refresh',{role:null,status:401,body:{refreshToken:'{{userARefresh}}'}});
cleanup(core);

const ai=section(collection,'AI integration','ai'); setup(ai,true);
const aiFlow=section(ai,'Four real AI operations');
const balanceBefore = () => request(aiFlow,'Balance immediately before AI operation','GET','/auth/me',{tests:set('balanceBefore','d.creditBalance')});
const billing = (cost,extra='') => eq('Expected price','d.creditSpent',cost)+eq('Balance delta','d.creditBalance',`${env('balanceBefore')} - d.creditSpent`)+set('expectedBalance','d.creditBalance')+set('expectedCharge','d.creditSpent')+extra;
const verifyCharge = () => {
  request(aiFlow,'Persisted balance after AI','GET','/auth/me',{tests:eq('Actual balance','d.creditBalance',`Number(${env('expectedBalance')})`)});
  request(aiFlow,'Matching usage charge','GET','/admin/ai-usage?userId={{userAId}}&limit=1',{role:'admin',tests:eq('Usage charge','d.items[0].creditSpent',`Number(${env('expectedCharge')})`)+check('Usage belongs to fixture',`pm.expect(d.items[0].userId._id).to.eql(${env('userAId')});`)});
};
const price = key => `JSON.parse(${env('originalConfig')}).${key}`;
balanceBefore();
request(aiFlow,'Generate real outline','POST','/lectures/generate-outline',{body:{prompt:'QA-{{runId}}: Tạo bài giảng giới thiệu phép cộng hai số tự nhiên với ví dụ 2 + 3 = 5.'},
  tests:billing(price('pricePerOutline'),check('Structured outline',"pm.expect(d.outline.sections).to.be.an('array').and.not.empty;")+set('outline','JSON.stringify(d.outline)')+set('aiLectureId','d.lecture._id'))}); verifyCharge();
balanceBefore();
request(aiFlow,'Generate real lecture','POST','/lectures',{status:201,body:'{"title":"QA-{{runId}}-AI","lectureId":"{{aiLectureId}}","outline":{{outline}}}',
  tests:billing(price('pricePerLecture'),check('Generated slides',"pm.expect(d.slides).to.be.an('array').and.not.empty;")+set('aiSlideId','d.slides[0].id'))}); verifyCharge();
balanceBefore();
request(aiFlow,'Edit one slide with AI','POST','/lectures/{{aiLectureId}}/ai-edit',{body:{slideId:'{{aiSlideId}}',instruction:'Thêm ghi nhớ: Cộng là gộp các số lượng.'},tests:billing(price('pricePerAiEdit'),check('Edited slide returned',"pm.expect(d.slide).to.be.an('object');"))}); verifyCharge();
balanceBefore();
request(aiFlow,'Chat to update current slide','POST','/lectures/{{aiLectureId}}/ai-chat',{body:{slideId:'{{aiSlideId}}',message:'Chỉ sửa slide hiện tại: thêm ví dụ 4 + 1 = 5. Không tạo slide mới.'},
  tests:billing(price('pricePerAiEdit'),eq('Requested edit action','d.action',"'UPDATE_CURRENT_SLIDE'")+check('Reply and history',"pm.expect(d.reply).to.be.a('string').and.not.empty; pm.expect(d.aiChatHistory).to.be.an('array').and.not.empty;"))}); verifyCharge();
cleanup(ai);

// Email flows are deliberately staged: OTPs must come from the controlled mailbox.
const mail1=section(collection,'Email 1 - Request registration OTP','email');
request(mail1,'Start controlled mailbox run','GET','/version',{role:null,before:initialize+
  "pm.environment.set('mailbox', (pm.environment.get('mailbox') || '').trim().toLowerCase()); if (!pm.environment.get('mailbox') || pm.environment.get('mailbox') === (pm.environment.get('adminEmail') || '').toLowerCase()) throw new Error('BLOCKED: use a separate controlled, unused test mailbox');",
  tests:eq('Development only','d.release.environment',"'develop'")+"if (d.release.environment !== 'develop') { pm.execution.setNextRequest(null); throw new Error('Wrong release environment'); }"});
adminLogin(mail1);
request(mail1,'Mailbox must not belong to an existing user','GET','/admin/users?search={{mailbox}}',{role:'admin',critical:true,
  tests:check('Unused mailbox',`pm.expect(d.items.some(u=>u.email===${env('mailbox')})).to.eql(false);`)+`if (d.items.some(u=>u.email===${env('mailbox')})) { pm.execution.setNextRequest(null); throw new Error('Mailbox already belongs to a user'); }`});
request(mail1,'Send registration OTP','POST','/auth/send-register-otp',{role:null,body:{email:'{{mailbox}}'}});
request(mail1,'OTP resend cooldown','POST','/auth/send-register-otp',{role:null,status:429,body:{email:'{{mailbox}}'}});
const mail2=section(collection,'Email 2 - Register with received OTP','email');
request(mail2,'Register controlled mailbox','POST','/auth/register',{role:null,status:201,
  before:"if (!/^\\d{6}$/.test(pm.environment.get('registrationOtp') || '')) throw new Error('BLOCKED: supply received registrationOtp');",
  body:{name:'QA-{{runId}}-Mail',email:'{{mailbox}}',password:'{{fixturePassword}}',otp:'{{registrationOtp}}'},
  tests:set('mailUserId','d.user.id')+set('mailToken','d.accessToken')+set('mailRefresh','d.refreshToken')});
const mail3=section(collection,'Email 3 - Request password reset','email');
request(mail3,'Send reset OTP','POST','/auth/forgot-password',{role:null,body:{email:'{{mailbox}}'},before:"if (!pm.environment.get('mailUserId')) throw new Error('Run Email 2 first');"});
request(mail3,'Reset resend cooldown','POST','/auth/forgot-password',{role:null,status:429,body:{email:'{{mailbox}}'}});
const mail4=section(collection,'Email 4 - Reset password and cleanup','email');
request(mail4,'Reset using received OTP','POST','/auth/reset-password',{role:null,
  before:"if (!/^\\d{6}$/.test(pm.environment.get('resetOtp') || '')) throw new Error('BLOCKED: supply received resetOtp');",
  body:{email:'{{mailbox}}',otp:'{{resetOtp}}',password:'{{changedPassword}}'}});
request(mail4,'Old password no longer works','POST','/auth/login',{role:null,status:401,body:{email:'{{mailbox}}',password:'{{fixturePassword}}'}});
request(mail4,'New password works','POST','/auth/login',{role:null,body:{email:'{{mailbox}}',password:'{{changedPassword}}'},tests:eq('Correct registered user','d.user.id',env('mailUserId'))});
adminLogin(mail4);
request(mail4,'Delete only registered mailbox fixture','DELETE','/admin/users/{{mailUserId}}',{role:'admin',
  before:"if (!pm.environment.get('mailUserId')) pm.execution.skipRequest();",tests:set('mailUserId',"''")});
request(mail4,'Mailbox fixture absent','GET','/admin/users?search={{mailbox}}',{role:'admin',tests:check('Mailbox removed',`pm.expect(d.items.some(u=>u.email===${env('mailbox')})).to.eql(false);`)+set('runComplete',"'true'")});

const environment = {name:'ABSlider development — template (no secrets)',values:Object.entries({
  baseUrl:'https://dev-slides-api.sbltcup.dev/api/v1', runMode:'core', allowMutations:'false',
  adminEmail:'',adminPassword:'',mailbox:'',registrationOtp:'',resetOtp:''
}).map(([key,value])=>({key,value,type:/Password|Otp/.test(key)?'secret':'default',enabled:true})),_postman_variable_scope:'environment'};
fs.mkdirSync(path.join(here,'data'),{recursive:true});
fs.writeFileSync(path.join(here,'ABSlider.postman_collection.json'),JSON.stringify(collection,null,2)+'\n');
fs.writeFileSync(path.join(here,'Development.postman_environment.json'),JSON.stringify(environment,null,2)+'\n');
fs.writeFileSync(path.join(here,'data/credit_invalid_values.json'),JSON.stringify(invalid,null,2)+'\n');
fs.writeFileSync(path.join(here,'coverage.json'),JSON.stringify(inventory,null,2)+'\n');
console.log(`Generated ${inventory.length} requests in ${collection.item.length} top-level folders.`);
