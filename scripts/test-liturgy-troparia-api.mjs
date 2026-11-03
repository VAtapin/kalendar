// Replay only real HTTP captures supplied by the backend owner; no browser/network/corpus copy.
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { PDFDocument, decodePDFRawStream } from 'pdf-lib';
import { composeParts, fetchWorshipParts, partsHash } from '../public/calendar-ui/worship-parts.js';
import { TROPARIA_SECTION } from '../public/calendar-ui/worship-troparia-section.js';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { repetitionEntries, compactRepetitions, repetitionNumber } from '../public/calendar-ui/worship-repeats.js';
import { captureWorshipPdf, exportWorshipPdf } from '../src/export/worship-pdf-browser';
import { create, installReaderPdfDocument } from '../tests/fixtures/reader-pdf-dom.mjs';
const path=process.argv[2];if(!path)throw new Error('Pass the real T/K HTTP manifest or installed capture directory');
const captures=new Map(), info=await stat(path), installed=info.isDirectory();
const sha=value=>createHash('sha256').update(value).digest('hex');
let cases;
if(installed){
  const files=(await readdir(path)).filter(file=>file.endsWith('.json')&&!/-request|-http|manifest/.test(file));
  cases=files.map(file=>({case:file.replace('.json',''),body:join(path,file),request:join(path,file.replace('.json','-request.json')),http:join(path,file.replace('.json','-http.json'))}));
}else{
  const bytes=await readFile(path),manifest=JSON.parse(bytes);cases=manifest.cases;
  console.info('Actual manifest SHA256: '+sha(bytes));
}
for(const row of cases){
  const body=await readFile(row.body),http=JSON.parse(await readFile(row.http)),request=JSON.parse(await readFile(row.request));
  if(row.sha256)assert.equal(sha(body),row.sha256);
  assert.equal(http.responseSha256,sha(body));assert.equal(http.status,200);
  assert.ok(http.cacheControl.includes('private')&&http.cacheControl.includes('no-store'));
  if(installed){assert.equal(http.productionInstalled,true);assert.equal(http.productionServerAccessed,false);}
  captures.set(row.case,{response:JSON.parse(body),http,request});
}
console.info(`${captures.size} actual HTTP responses + request/HTTP sidecars: SHA256/private/no-store PASS; installed App=${installed}`);
const template=captures.get('template').response;
const fonts={civil:await readFile('public/fonts/DejaVuSerif.ttf'),cu:await readFile('public/fonts/Ponomar-Regular.ttf'),fallback:await readFile('public/fonts/DejaVuSans.ttf')};
installReaderPdfDocument();let selected=0,legacy=0,held=0,negative=0;
for(const[name,capture]of captures){
  if(name==='template')continue;
  const assignments=capture.response.data,state={...assignments.context,rite:'john-chrysostom',sequence:'default',textLanguage:'cu',textSize:22};
  assert.equal(capture.request.method,'GET');assert.equal(capture.request.query.date,state.date);assert.equal(capture.request.query.temple,state.temple);
  if(capture.request.query.templateVersion!==undefined)assert.equal(capture.request.query.templateVersion,template.data.templateVersion);
  assert.equal(capture.request.query.language,'cu');assert.equal(capture.request.query.mode,'fixed');
  const fetcher=async(url,options)=>{
    assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');
    if(url.pathname.includes('/templates/'))return{status:200,json:async()=>template};
    assert.equal(url.searchParams.get('templateVersion'),template.data.templateVersion);assert.equal(url.searchParams.get('temple'),state.temple);
    return{status:200,json:async()=>capture.response};
  };
  const result=await fetchWorshipParts('https://isolated-api.example',state,()=>{},fetcher);
  assert.equal(result.assignmentsStatus,'partial');assert.equal(result.complete,false);
  const fills=new Map(assignments.operations.map(op=>[op.nodeId,op]));
  const raw=template.data.nodes.flatMap(node=>fills.get(node.nodeId)?.blocks||node.blocks||[]);
  assert.deepEqual(result.entries.flatMap(entry=>entry.blocks||[]),raw);
  const operation=assignments.operations.find(op=>op.sectionId===TROPARIA_SECTION);
  if(operation){
    selected++;assert.equal(operation.blocks.length,10);assert.equal(result.entries.filter(entry=>entry.nodeId===operation.nodeId).length,10);
    assert.ok(result.entries.filter(entry=>entry.nodeId===operation.nodeId).every(entry=>entry.role==='choir'&&entry.parallelGroup==='entrance-prayer'));
    const mutations={
      'stale outer':(_,a)=>{a.templateVersion=a.tropariaBaseTemplateVersion;},
      'parent version':(_,a)=>{a.tropariaBaseTemplateVersion='0'.repeat(64);},
      'old base overwrite':(_,a)=>{a.baseTemplateVersion=a.tropariaBaseTemplateVersion;},
      'target node':(_,a)=>{a.operations.find(op=>op.sectionId===TROPARIA_SECTION).nodeId='unknown';},
      'source body':(_,a)=>{a.operations.find(op=>op.sectionId===TROPARIA_SECTION).blocks[0].segments[0].text='changed';},
      'resealed range words':async(_,a)=>{const op=a.operations.find(op=>op.sectionId===TROPARIA_SECTION);op.blocks[0].segments[0].text='changed';a.verifiedSections[TROPARIA_SECTION].composedBlocksHash=await partsHash(op.blocks);},
      'ownership':(_,a)=>{a.verifiedSections[TROPARIA_SECTION].selection.references['day-troparion'].ownership.memoryId='other';},
      'user source':(_,a)=>{a.operations.find(op=>op.sectionId===TROPARIA_SECTION).blocks[0].origin='user-provided';},
      'repeat':(_,a)=>{a.operations.find(op=>op.sectionId===TROPARIA_SECTION).blocks[0].repeatCount=2;},
      'order':(_,a)=>{a.verifiedSections[TROPARIA_SECTION].selection.order.reverse();},
      'source identity':(_,a)=>{a.verifiedSections[TROPARIA_SECTION].selection.references['day-troparion'].source.hash='0'.repeat(64);},
      'public admission':(_,a)=>{a.verifiedSections[TROPARIA_SECTION].publicAdmissionGranted=true;},
      'antiphon admission':(_,a)=>{a.verifiedSections[TROPARIA_SECTION].antiphonsAccepted=true;},
      'double legacy':(_,a)=>{a.preservedLegacySections={[TROPARIA_SECTION]:'weekday-antiphons-and-entrance'};},
      'parallel group':(t)=>{t.sections[TROPARIA_SECTION].nodes[0].parallelGroup='other';},
    };
    for(const[label,mutate]of Object.entries(mutations)){const t=structuredClone(template.data),a=structuredClone(assignments);await mutate(t,a);await assert.rejects(composeParts(t,a,state),undefined,label);negative++;}
  }else if(assignments.preservedLegacySections?.[TROPARIA_SECTION])legacy++;else{held++;assert.ok(result.entries.some(entry=>entry.slotId==='troparia-kontakia'&&entry.missing));}
  let snapshot,printedBody,printCount=0;const reader=renderWorshipReader({state,create,formatDate:date=>date,onChange(){},onCalendar(){},onRetry(){},print:()=>{printedBody=reader.page.querySelector('.worship-text');printCount++;},pdfLoad:async()=>({captureWorshipPdf,downloadWorshipPdf:async value=>{snapshot=value;}})});
  reader.render(result);await reader.page.querySelectorAll('button').find(button=>button.textContent==='Скачать PDF').events.click();
  assert.ok(snapshot);assert.equal(snapshot.complete,false);assert.ok(snapshot.warnings.length);
  const bodyBeforePrint=reader.page.querySelector('.worship-text');
  await reader.page.querySelectorAll('button').find(button=>button.textContent==='Печать службы').events.click();
  assert.equal(printCount,1);assert.equal(printedBody,bodyBeforePrint);assert.deepEqual(captureWorshipPdf(bodyBeforePrint,snapshot).blocks,snapshot.blocks);
  const missing=result.entries.filter(entry=>entry.missing).length;assert.equal(snapshot.blocks.filter(block=>block.kind==='warning').length,missing);
  const expected=repetitionEntries(result.entries).filter(entry=>!entry.missing).flatMap(entry=>compactRepetitions(entry.blocks).map(({block,count})=>(Number.isInteger(block.tone)&&block.tone>=1&&block.tone<=8?'Глас '+block.tone:'')+block.segments.map(s=>s.text).join('')+(count>1?' '+repetitionNumber(count,entry.language):'')));
  assert.deepEqual(snapshot.blocks.filter(b=>b.kind!=='warning'&&b.runs.map(r=>r.text).join('')!=='Приложение после службы').map(b=>b.runs.map(r=>r.text).join('')),expected);
  const pdf=await exportWorshipPdf(snapshot,{fontBytes:fonts}),parsed=await PDFDocument.load(pdf.bytes),logical=[];
  for(const page of parsed.getPages())for(const ref of page.node.Contents().asArray()){
    const stream=Buffer.from(decodePDFRawStream(parsed.context.lookup(ref)).decode()).toString('latin1');
    for(const match of stream.matchAll(/\/ActualText\s*<([a-f0-9]+)>\s*\/KalendarBody\s+true/gi))logical.push(Buffer.from(match[1],'hex').swap16().toString('utf16le').replace(/^\ufeff/,''));
  }
  const normalize=text=>text.replace(/\s/g,'');assert.ok(logical.length);
  assert.equal(sha(normalize(logical.join(''))),sha(normalize(snapshot.blocks.map(b=>b.runs.map(r=>r.text).join('')).join(''))));
  console.info(`${name}: ${raw.length} source blocks; reader/PDF parity PASS; ${missing} missing; ${pdf.pageCount} A4 pages`);reader.dispose();
}
assert.ok(selected>=4);assert.equal(legacy,1);assert.equal(held,1);assert.equal(negative,selected*15);
console.info(`PASS ${selected} selected + legacy + held, and ${negative} real-response negative mutations. No production acceptance inferred.`);
