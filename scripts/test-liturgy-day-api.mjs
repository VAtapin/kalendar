// Real kernel response replay. No browser, network, saved names or source corpus copy.
import assert from 'node:assert/strict';
import { PDFDocument, decodePDFRawStream } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fetchWorshipParts, partsHash } from '../public/calendar-ui/worship-parts.js';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { normalizeLocalClergyContext } from '../public/calendar-ui/worship-local-context.js';
import { compactRepetitions, repetitionEntries, repetitionNumber } from '../public/calendar-ui/worship-repeats.js';
import { captureWorshipPdf, exportWorshipPdf } from '../src/export/worship-pdf-browser';
import { create, installReaderPdfDocument } from '../tests/fixtures/reader-pdf-dom.mjs';
const path=process.argv[2]; if(!path) throw new Error('Pass actual kernel manifest.json');
const manifestBytes=await readFile(path), manifest=JSON.parse(manifestBytes.toString('utf8'));
assert.equal(manifest.kind,'actual-kernel-four-liturgy-day-parts-fixtures');
assert.equal(manifest.wholeLiturgyAccepted,false); assert.equal(manifest.dateAppointmentApproved,false);
const payloads=new Map();
for(const info of manifest.files){
  assert.match(info.file,/^[a-z0-9-]+\.json$/);const bytes=await readFile(resolve(dirname(path),info.file));
  assert.equal(bytes.length,info.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),info.sha256);
  payloads.set(info.file,JSON.parse(bytes.toString('utf8')));
}
console.info('Manifest SHA256: '+createHash('sha256').update(manifestBytes).digest('hex'));
installReaderPdfDocument();
const fontBytes={civil:await readFile('public/fonts/DejaVuSerif.ttf'),cu:await readFile('public/fonts/Ponomar-Regular.ttf'),fallback:await readFile('public/fonts/DejaVuSans.ttf')};
const responseFiles=[...payloads.keys()].filter(name=>/^(?:chrys-\d{4}-\d{2}-\d{2}|basil-selected-(?:get|post))\.json$/.test(name));
for(const file of responseFiles){
  const name=file.replace('.json',''), assignments=payloads.get(file).data, request=payloads.get(name+'-request.json'), http=payloads.get(name+'-http.json');
  assert.equal(http.status,200); assert.ok(http.cacheControl.includes('private')&&http.cacheControl.includes('no-store'));
  const post=request.method==='POST', basil=name.startsWith('basil'), template=payloads.get((basil?'basil':'chrys')+'-template.json');
  const input=request.body||request.query;
  const state={office:'liturgy',date:input.date,temple:input.temple,textLanguage:'cu',textSize:22,sequence:'default',rite:basil?'basil-great':'john-chrysostom'};
  const result=await fetchWorshipParts('https://isolated-api.example',state,()=>{},async(url,options)=>{
    if(url.pathname.includes('/templates/'))return{status:200,json:async()=>template};
    if(post){assert.equal(options.method,'POST');assert.equal(url.search,'');const body=JSON.parse(options.body);assert.equal(body.templateVersion,template.data.templateVersion);assert.equal(await partsHash(body.localContext),await partsHash(normalizeLocalClergyContext(state,input.localContext)));}
    else {assert.equal(url.searchParams.get('date'),state.date);assert.equal(url.searchParams.get('temple'),state.temple);}
    return{status:http.status,json:async()=>payloads.get(file)};
  },undefined,post?{localContext:input.localContext}:{});
  assert.equal(result.assignmentsStatus,'partial');assert.equal(result.complete,false);
  const fills=new Map(assignments.operations.map(op=>[op.nodeId,op]));
  const raw=template.data.nodes.flatMap(node=>fills.get(node.nodeId)?.blocks||node.blocks||[]);
  assert.deepEqual(result.entries.flatMap(entry=>entry.blocks||[]),raw);
  const missing=template.data.nodes.filter(node=>node.kind==='slot'&&!fills.has(node.nodeId));
  assert.equal(result.entries.filter(e=>e.missing).length,missing.length);
  const expected=repetitionEntries(result.entries).filter(entry=>!entry.missing).flatMap(entry=>compactRepetitions(entry.blocks).map(({block,count})=>
    (Number.isInteger(block.tone)&&block.tone>=1&&block.tone<=8?'Глас '+block.tone:'')+block.segments.map(s=>s.text).join('')+(count>1?' '+repetitionNumber(count,entry.language):'')));
  let snapshot; const reader=renderWorshipReader({state,create,formatDate:date=>date,onChange(){},onCalendar(){},onRetry(){},pdfLoad:async()=>({captureWorshipPdf,downloadWorshipPdf:async value=>{snapshot=value;}})});
  reader.render(result);
  await reader.page.querySelectorAll('button').find(button=>button.textContent==='Скачать PDF').events.click();
  assert.ok(snapshot);assert.equal(snapshot.kind,'dated-service');assert.equal(snapshot.complete,false);assert.ok(snapshot.warnings.length);
  const body=snapshot.blocks.filter(block=>block.kind!=='warning'&&block.runs.map(r=>r.text).join('')!=='Приложение после службы');
  assert.deepEqual(body.map(block=>block.runs.map(run=>run.text).join('')),expected);
  assert.equal(snapshot.blocks.filter(block=>block.kind==='warning').length,missing.length);
  if(basil){assert.equal(result.dayValuesApplied,true);assert.equal(result.localValuesApplied===true,post);assert.equal(snapshot.blocks.filter(b=>b.origin==='user-provided').length,post?4:0);}
  const pdf=await exportWorshipPdf(snapshot,{fontBytes});
  const normalize=text=>text.replace(/\s/g,'');
  const sourceText=snapshot.blocks.map(block=>block.runs.map(run=>run.text).join('')).join('');
  const parsed=await PDFDocument.load(pdf.bytes), logical=[];
  for(const page of parsed.getPages())for(const ref of page.node.Contents().asArray()){
    const stream=Buffer.from(decodePDFRawStream(parsed.context.lookup(ref)).decode()).toString('latin1');
    for(const match of stream.matchAll(/\/ActualText\s*<([a-f0-9]+)>\s*\/KalendarBody\s+true/gi)) logical.push(Buffer.from(match[1],'hex').swap16().toString('utf16le').replace(/^\ufeff/,''));
  }
  assert.ok(logical.length); const digest=text=>createHash('sha256').update(normalize(text)).digest('hex');
  assert.equal(digest(logical.join('')),digest(sourceText)); assert.ok(pdf.bytes.length>1000);
  reader.dispose();console.info(`${name}: ${raw.length} source blocks, ${missing.length} remaining; exact reader/PDF body parity PASS (${pdf.pageCount} A4 pages)`);
}
assert.equal(responseFiles.length,9);
