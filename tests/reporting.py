"""Portable, offline reports. Display recorded evidence without inventing state."""
import json
from pathlib import Path
from qa_support import write_json

TEMPLATE = r'''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>ABSlider execution evidence</title>
<style>
:root{font:15px/1.5 system-ui,sans-serif;color:#172b38;background:#eef3f5}*{box-sizing:border-box}body{max-width:1600px;margin:auto;padding:24px}h1{font-size:27px;margin:0}h2{font-size:19px}header,.card,article{background:white;border:1px solid #cfdae1;border-radius:12px;padding:20px;margin-bottom:16px}header{border-top:5px solid #145b74}.muted{color:#526b78;font-size:13px}.meta{display:flex;gap:18px;flex-wrap:wrap;margin:12px 0}code,pre{font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}pre{background:#edf3f6;padding:12px;border-radius:7px;max-height:440px;overflow:auto}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px}.cards .card{padding:14px}.value{font-size:25px;font-weight:700}.badge{display:inline-block;border-radius:5px;padding:3px 9px;font-size:12px;font-weight:750;background:#e7edf1;color:#304a5d}.PASSED,.COMPLETE,.verified{background:#ddf2e6;color:#145933}.FAILED,.INCOMPLETE,.failed{background:#ffe1df;color:#8a2420}.BLOCKED,.PARTIAL,.NOT_RUN,.INTERRUPTED{background:#fff0cf;color:#765007}.controls{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0;align-items:center}input,select,button{font:inherit;border:1px solid #aabdc8;border-radius:6px;background:white;color:#193d51;padding:8px 11px}input{flex:1;min-width:230px}button{cursor:pointer}button.active{background:#145b74;color:white}a{color:#075a85}details{border-top:1px solid #e1e8ed;padding-top:10px;margin-top:12px}summary{cursor:pointer;font-weight:600}.row-head{display:flex;align-items:flex-start;gap:12px;justify-content:space-between}.name{font-weight:700;overflow-wrap:anywhere}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px}.checkpoint{padding:15px;background:#f7fafc;border:1px solid #d4e1e8;border-radius:9px;margin:12px 0}.thumb{display:block;max-width:100%;height:210px;object-fit:contain;object-position:left top;background:#e7edf2;border:1px solid #aebfca;cursor:zoom-in}.error{color:#902a26}.empty{padding:40px;text-align:center}.warning{border-left:4px solid #ba8418;padding:12px;background:#fff5de}.tagline{font-size:13px;margin-top:12px}.links{display:flex;gap:16px;flex-wrap:wrap}dialog{border:0;border-radius:8px;padding:14px;max-width:98vw;max-height:96vh}dialog::backdrop{background:#071a2be8}dialog img{max-width:94vw;max-height:82vh;object-fit:contain}dialog.original img{max-width:none;max-height:none}dialog .tools{position:sticky;top:0;background:white;display:flex;gap:12px;padding:8px;margin-bottom:8px}#case-summary{display:flex;gap:18px;flex-wrap:wrap}.method{background:#e1edfa;color:#174d80}.request-status{white-space:nowrap}@media(max-width:650px){body{padding:10px}.row-head{display:block}.thumb{height:auto;max-height:300px}}
</style>
<header><div class="row-head"><h1 id="title"></h1><span id="overall" class="badge"></span></div><div class="meta" id="meta"></div><div id="case-summary"></div><div class="links" id="links"></div><p class="tagline">Unmodified browser captures, recorded assertions and persisted readback are complementary evidence. Checksums detect later edits; they do not provide a trusted signature or timestamp.</p></header>
<div class="cards" id="metrics"></div><div id="issues"></div>
<div class="controls"><input id="search" placeholder="Search case, field, input, feedback, endpoint or assertion…" aria-label="Search evidence"><select id="status" aria-label="Filter execution status"><option value="all">All execution statuses</option><option>PASSED</option><option>FAILED</option><option>BLOCKED</option><option>NOT_RUN</option></select><select id="http" aria-label="Filter HTTP class"><option value="all">All HTTP status classes</option><option value="2">HTTP 2xx</option><option value="4">HTTP 4xx</option><option value="5">HTTP 5xx</option></select><span id="shown" class="muted"></span></div>
<main id="rows"></main><dialog id="zoom"><div class="tools"><button id="close">Close (Esc)</button><button id="size">Toggle original size</button><a id="original" target="_blank" rel="noopener">Open original PNG</a><span id="caption" class="muted"></span></div><img id="zoom-image" alt="Unmodified browser evidence"></dialog>
<script>
const run=__DATA__,prefix=__PREFIX__;
const $=id=>document.getElementById(id);
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n}
function badge(status){return el('span',status||'UNKNOWN','badge '+(status||'UNKNOWN'))}
function pre(parent,title,data){parent.append(el('div',title,'muted'),el('pre',typeof data==='string'?data:JSON.stringify(data,null,2)))}
function link(parent,text,path){const a=el('a',text);a.href=prefix+path;parent.append(a);return a}
function photo(parent,artifact,label){if(!artifact?.path)return;const a=el('button');a.style.padding='3px';a.title=label;const img=el('img',undefined,'thumb');img.src=prefix+artifact.path;img.alt=label;img.loading='lazy';a.append(img);a.onclick=()=>{ $('zoom-image').src=img.src;$('original').href=img.src;$('caption').textContent=label;$('zoom').showModal() };parent.append(a);parent.append(el('div',label,'muted'));parent.append(el('code','SHA-256 '+artifact.sha256,'muted'))}
$('title').textContent=run.kind==='selenium'?'Selenium — step evidence':'Postman — transaction evidence';$('overall').replaceWith(Object.assign(badge(run.status),{id:'overall'}));
const rows=run.tests||run.requests||[];
if(run.suite)$('meta').append(el('span','Suite: '+run.suite,'muted'));
const target=typeof run.target==='object'?Object.values(run.target).join(' · '):run.target||'Not recorded';
for(const text of ['Run '+run.runId,'Target: '+target,'Started: '+(run.started||'Not recorded'),'Finished: '+(run.finished||'Still running'),'Release: '+(run.release?.sha||'Not recorded'),'Test source: '+(run.source?.revision||'Not recorded')+(run.source?.dirty?' (working changes captured)':''),'Cleanup: '+(run.cleanup||'Not started')])$('meta').append(el('span',text,'muted'));
for(const [name,status] of Object.entries(run.cases||{})){const n=el('span',name+' ');n.append(badge(status));$('case-summary').append(n)}
link($('links'),'Summary JSON','summary.json');link($('links'),'JUnit','junit.xml');if(run.status!=='RUNNING')link($('links'),'Artifact checksums','integrity.json');
const passed=rows.filter(r=>r.status==='PASSED').length,failed=rows.filter(r=>r.status==='FAILED').length,blocked=rows.filter(r=>r.status==='BLOCKED').length,notrun=rows.filter(r=>!['PASSED','FAILED','BLOCKED'].includes(r.status)).length;
const metrics={'Planned':run.expectedRequests??run.plannedTests?.length??rows.length,'Completed checks':passed+failed,'Passed':passed,'Failed':failed,'Blocked / not run':blocked+notrun};
if(run.kind==='postman'&&run.cases)metrics['Feature scenarios']=Object.keys(run.cases).length;
if(run.kind==='selenium'){metrics['Checkpoints']=rows.reduce((n,r)=>n+(r.checkpoints?.length||0),0);metrics['PNG captures']=rows.reduce((n,r)=>n+(r.checkpoints||[]).reduce((m,c)=>m+(c.artifacts?.length||0),0),0)}else{metrics['Assertions']=rows.reduce((n,r)=>n+(r.assertions||0),0);const times=rows.map(r=>r.responseMs).filter(n=>typeof n==='number');metrics['Avg measured latency']=times.length?(times.reduce((a,b)=>a+b,0)/times.length).toFixed(1)+' ms':'Unavailable'}
for(const [name,value] of Object.entries(metrics)){const card=el('div',undefined,'card');card.append(el('div',name,'muted'),el('div',value,'value'));$('metrics').append(card)}
for(const error of [...(run.runErrors||[]),...(run.reason?[run.reason]:[])])$('issues').append(el('p',error,'warning'));
if(run.diagnostic)$('issues').append(el('p','HARNESS DIAGNOSTIC: deliberate fault injection. This is not a product-suite result or a Kiwi execution.','warning'));
if(run.status==='PARTIAL'||run.status==='RUNNING')$('issues').append(el('p','This run does not establish full case completion.','warning'));
if(run.kind==='postman')$('issues').append(el('p','HTTP status is separate from assertion outcome: an expected 401/403/422 can pass; an unexpected 200 can fail. Secret fields are redacted.','muted'));
function checkpoint(parent,c){const box=el('section',undefined,'checkpoint');box.append(el('h3',c.sequence+'. '+c.label),el('div',c.stage+' · '+c.captured,'muted'));const grid=el('div',undefined,'grid');const left=el('div');pre(left,'Expected',c.expected);pre(left,'Observed browser values / feedback',{values:c.observed,feedback:c.feedback,input:c.input,viewport:c.viewport});grid.append(left);const images=el('div');for(const a of c.artifacts||[])photo(images,a,c.label+' ('+a.role+')');grid.append(images);box.append(grid);if(c.network?.length){const d=el('details');d.append(el('summary','Browser Credit API transactions ('+c.network.length+')'));pre(d,'Observed HTTP activity',c.network);box.append(d)}if(c.readback){pre(box,'Independent persisted API readback',c.readback)}parent.append(box)}
function render(){let shown=0;$('rows').replaceChildren();for(const r of rows){const q=$('search').value.toLowerCase();if(q&&!JSON.stringify(r).toLowerCase().includes(q))continue;if($('status').value!=='all'&&r.status!==$('status').value)continue;if($('http').value!=='all'&&!String(r.httpStatus||'').startsWith($('http').value))continue;shown++;
 const article=el('article');const head=el('div',undefined,'row-head');const name=el('div',r.test||r.name||'Unknown request','name');const right=el('div');right.append(badge(r.status));head.append(name,right);article.append(head);
 if(r.purpose)article.append(el('p',r.purpose+(r.scenario?' / '+r.scenario:' / supporting request'),'muted'));
 if(r.method){const m=el('div',undefined,'meta');m.append(el('span',r.method,'badge method'),el('code',r.endpoint||'URL not recorded'),el('span','HTTP '+(r.httpStatus??'unavailable')+' / expected '+(r.expectedHttpStatus??'not recorded'),'request-status'),el('span',(r.responseMs??'Unavailable')+' ms'));article.append(m)}
 else article.append(el('p','Total phase duration: '+(r.durationMs??'Unavailable')+' ms · Evidence: '+(r.evidenceStatus||'Not captured'),'muted'));
 if(r.error)article.append(el('pre',r.error,'error'));if(r.failedAssertions?.length)article.append(el('pre',r.failedAssertions.join('\n'),'error'));
 const checkpoints=r.checkpoints||[];const primary=checkpoints.find(c=>['validation-feedback','save-feedback','failure'].includes(c.stage));if(primary){const p=el('div',undefined,'meta');photo(p,primary.artifacts?.[0],primary.label);article.append(p)}
 const details=el('details');details.append(el('summary',checkpoints.length?'Step timeline ('+checkpoints.length+' checkpoints)':'Request, response and assertion details'));
 if(checkpoints.length){for(const c of checkpoints)checkpoint(details,c)}else{pre(details,'Request (sanitized)',r.request||{method:r.method,url:r.endpoint});pre(details,'Response (sanitized)',r.response||{status:r.httpStatus});pre(details,'Assertions',r.assertionResults||[])}
 if(r.browser)pre(details,'Actual browser capabilities',r.browser);if(r.phases)pre(details,'Execution phases',r.phases);article.append(details);$('rows').append(article)}$('shown').textContent=shown+' / '+rows.length+' shown';if(!shown)$('rows').append(el('div','No matching evidence.','empty'))}
$('http').hidden=run.kind==='selenium';for(const id of ['search','status','http'])$(id).addEventListener('input',render);$('close').onclick=()=>$('zoom').close();$('size').onclick=()=>$('zoom').classList.toggle('original');$('zoom').onclick=e=>{if(e.target===$('zoom'))$('zoom').close()};render();
</script></html>'''


def render(summary, prefix=""):
    payload = json.dumps(summary, ensure_ascii=False).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    return TEMPLATE.replace("__PREFIX__", json.dumps(prefix)).replace("__DATA__", payload)


def publish(directory, summary):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    write_json(directory / "summary.json", summary)
    (directory / "report.html").write_text(render(summary), encoding="utf-8")
    latest = directory.parent / "latest_report.html"
    temporary = latest.with_suffix(".html.tmp")
    temporary.write_text(render(summary, directory.name + "/"), encoding="utf-8")
    temporary.replace(latest)
    write_json(directory.parent / "latest.json", {"runId": summary["runId"], "status": summary["status"],
                                              "report": directory.name + "/report.html", "started": summary.get("started")})
