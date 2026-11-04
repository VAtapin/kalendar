import { PDFDocument,decodePDFRawStream } from 'pdf-lib';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { midnightPresentationEntries } from '../public/calendar-ui/worship-midnight-presentation.js';
import { repetitionEntries,compactRepetitions,repetitionNumber } from '../public/calendar-ui/worship-repeats.js';
import { captureWorshipPdf,exportWorshipPdf } from '../src/export/worship-pdf-browser';
import { create,installReaderPdfDocument } from '../tests/fixtures/reader-pdf-dom.mjs';
// Actual owner typed-route envelopes. No manufactured HTTP body or source text.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import { composeMidnightReader,composeMidnightClergy,validateMidnightTemplate } from '../public/calendar-ui/worship-midnight.js';
import { validateMidnightFull } from '../public/calendar-ui/worship-midnight-context.js';
import {fetchMidnightFull} from '../public/calendar-ui/worship-midnight-context.js';
const path=process.argv[2];assert.ok(path,'Pass final owner http-exports.json');
const bytes=await readFile(path),captures=JSON.parse(bytes),indexHash=createHash('sha256').update(bytes).digest('hex');
assert.equal(indexHash,'c735b3d09c4523ddd5640a860305464cdfa9d62e346bdf8142f9aa2db72f50e2');
assert.equal(captures.length,25);const stateFor=q=>({...q,office:'midnight-office',textLanguage:'cu',textSize:22,midnightProfile:q.profile,midnightLocation:q.location,midnightBishopTitle:q.bishopTitle||'bishop'});
const key=q=>JSON.stringify([q.date,q.profile,q.location]);const rows=[];
for(const [i,c]of captures.entries()){
 const cache=c.headers['cache-control'].join(',');assert.ok(cache.includes('private')&&cache.includes('no-store'));
 if(i>=18&&c.httpStatus===200){assert.equal(validateMidnightFull(c.body,stateFor(c.request.input)).status,'ready');continue;}
 if(i>=18)continue;
 if(c.httpStatus===200&&c.request.path.includes('/services/')){
  const t=captures.find(x=>x.request.path.includes('/templates/')&&key(x.request.input)===key(c.request.input)),a=captures.find(x=>x.request.path.includes('/assignments/')&&x.request.method==='GET'&&key(x.request.input)===key(c.request.input));
  const state=stateFor(c.request.input),result=await composeMidnightReader(t.body,a.body,state,a.request.input);assert.deepEqual(result.entries.flatMap(e=>e.blocks),c.body.data.blocks);
  assert.equal((await fetchMidnightFull('https://offline.invalid',state,async()=>({status:c.httpStatus,headers:new Headers({'cache-control':c.headers['cache-control'].join(',')}),json:async()=>c.body}))).midnightHolySpirit,true);
  rows.push({case:'reader-'+i,result,state,fullCapture:c,templateCapture:t,assignmentCapture:a});
 }
 if(c.request.method==='POST'){
  const t=captures.find(x=>x.request.path.includes('/templates/')&&key(x.request.input)===key(c.request.input)),partialCapture=captures.find(x=>x.request.path.includes('/services/')&&key(x.request.input)===key(c.request.input));
  const state=stateFor(c.request.input),partial=await composeMidnightClergy(t.body,partialCapture.body,state,partialCapture.request.input,{fullEvaluation:true}),result=await composeMidnightClergy(t.body,c.body,state,c.request.input,{privatePost:true,printedVariantConfirmed:true});
  rows.push({case:'clergy-'+i,result,partial,state,templateCapture:t,assignmentCapture:c});
 }
}
assert.equal(rows.length,6);
const fonts={civil:await readFile('public/fonts/DejaVuSerif.ttf'),cu:await readFile('public/fonts/Ponomar-Regular.ttf'),fallback:await readFile('public/fonts/DejaVuSans.ttf')};
const restore=installReaderPdfDocument(),receipt=[];let negative=0,partialPdfPages=0;
try{
  for(const row of rows){const{result,state}=row;let snapshot,printed=0,printBody,postCount=0;
    const reader=renderWorshipReader({state,create,formatDate:d=>d,onChange(){},onCalendar(){},onRetry(){},onLocalSubmit(){postCount++;},
      print(){printed++;printBody=reader.page.querySelector('.worship-text');},pdfLoad:async()=>({captureWorshipPdf,downloadWorshipPdf:async s=>{snapshot=s;}})});
    if(row.partial){
      reader.render(row.partial);assert.equal(reader.page.querySelectorAll('.worship-missing').length,3);assert.equal(reader.page.querySelectorAll('.worship-local-context').length,1);assert.equal(postCount,0);
      await reader.page.querySelectorAll('button').find(b=>b.textContent==='Печать службы').events.click();
      await reader.page.querySelectorAll('button').find(b=>b.textContent==='Скачать PDF').events.click();
      assert.equal(snapshot.complete,false);assert.ok(snapshot.warnings.length);assert.equal(snapshot.blocks.filter(b=>b.kind==='warning').length,3);
      assert.deepEqual(captureWorshipPdf(printBody,snapshot).blocks,snapshot.blocks);
      partialPdfPages=(await exportWorshipPdf(snapshot,{fontBytes:fonts})).pageCount;printed=0;snapshot=undefined;
    }
    reader.render(result);assert.equal(reader.page.querySelector('.worship-coverage').children[0].textContent,'Полная Полунощница — выбранный печатный чин');
    assert.equal(reader.page.querySelectorAll('.worship-missing').length,0);assert.equal(postCount,0);
    assert.ok(reader.page.textContent.includes('Полунощница понедельника Святого Духа без местного бдения.'));
    if(result.midnightClergy){assert.ok(reader.page.textContent.includes('Имена: из вашего ввода.'));assert.ok(!reader.page.textContent.includes('Они не подтверждают назначение всей службы.'));}
    for(const s of result.sourceVersions)for(const k of ['work','edition'])assert.ok(!reader.page.textContent.includes(s[k]));
    await reader.page.querySelectorAll('button').find(b=>b.textContent==='Печать службы').events.click();assert.equal(printed,1);
    await reader.page.querySelectorAll('button').find(b=>b.textContent==='Скачать PDF').events.click();assert.ok(snapshot);assert.equal(snapshot.complete,true);assert.deepEqual(snapshot.sources,[]);
    assert.deepEqual(captureWorshipPdf(printBody,snapshot).blocks,snapshot.blocks);
    const expected=[];
    const before=JSON.stringify(result.entries);
    for(const entry of repetitionEntries(midnightPresentationEntries(result)))for(const{block,count}of compactRepetitions(entry.blocks)){
      if(result.midnightClergy&&block.occurrenceId===result.performance.startBeforeOccurrenceId)expected.push(result.performance.rubric.segments.map(s=>s.text).join(''));
      expected.push((Number.isInteger(block.tone)&&block.tone>=1&&block.tone<=8?'Глас '+block.tone:'')+block.segments.map(s=>s.text).join('')+(count>1?' '+repetitionNumber(count,'cu'):''));
    }
    assert.deepEqual(snapshot.blocks.map(b=>b.runs.map(r=>r.text).join('')),expected);
    assert.equal(JSON.stringify(result.entries),before);
    const words=entries=>entries.flatMap(e=>e.blocks).map(b=>b.segments.map(s=>s.text).join('')).join('').replace(/\s/g,'');
    assert.equal(words(midnightPresentationEntries(result)),words(result.entries));
    if(result.midnightClergy){assert.equal(result.performance.count,null);assert.equal(reader.page.querySelectorAll('[data-midnight-performance]').length,1);}
    const pdf=await exportWorshipPdf(snapshot,{fontBytes:fonts}),parsed=await PDFDocument.load(pdf.bytes),logical=[];assert.equal(parsed.getSubject(),undefined);
    if(process.argv[3]&&['reader-0','clergy-8'].includes(row.case))await writeFile(process.argv[3]+'/'+row.case+'.pdf',pdf.bytes);
    for(const p of parsed.getPages())for(const ref of p.node.Contents().asArray()){
      const stream=Buffer.from(decodePDFRawStream(parsed.context.lookup(ref)).decode()).toString('latin1');
      for(const m of stream.matchAll(/\/ActualText\s*<([a-f0-9]+)>\s*\/KalendarBody\s+true/gi))logical.push(Buffer.from(m[1],'hex').swap16().toString('utf16le').replace(/^\ufeff/,''));
    }
    const normalize=t=>t.replace(/\s/g,'');assert.equal(normalize(logical.join('')),normalize(expected.join('')));reader.dispose();
    const common={version:a=>{a.templateVersion='0'.repeat(64);},source:a=>{a.templateSourcesHash='0'.repeat(64);},date:a=>{a.date='2026-01-01';},calendar:a=>{a.calendarHash='bad';},input:a=>{a.inputHash='0'.repeat(64);},binding:a=>{a.localContextBindingHash='0'.repeat(64);},status:a=>{a.status='partial';},admission:a=>{a.runtimeAdmissionGranted=false;},appointment:a=>{a.calendarServiceAppointed=false;},scope:a=>{a.preparedServiceScope='unknown';},vigil:a=>{a.actualVigilScheduleVerified=true;},authority:a=>{a.actualLocalContextVerified=true;},composition:a=>{a.composedBlocksHash='0'.repeat(64);}};
    const clergy={literal:a=>{a.operations[0].blocks[0].segments[0].text='Ино́му';},sourceAttestation:a=>{a.operations[0].blocks[0].provenance.sourceAttested=true;},authorityAttestation:a=>{a.operations[0].blocks[0].provenance.authorityAttested=true;},target:a=>{a.operations[0].slotId='other';},omitted:a=>{a.operations.pop();},frequency:a=>{a.performance.count=3;},rubric:a=>{a.performance.rubric.segments[0].text+=' changed';},anchor:a=>{a.performance.startBeforeOccurrenceId=a.performance.stopBeforeOccurrenceId;}};
    for(const mutate of Object.values({...common,...(result.midnightClergy?clergy:{operations:a=>{a.operations=[{type:'fill'}];},missing:a=>{a.missing=[{code:'held'}];},performance:a=>{a.performance={count:3};}})})){
      const body=structuredClone(row.assignmentCapture.body);mutate(body.data);
      await assert.rejects(result.midnightClergy?composeMidnightClergy(row.templateCapture.body,body,state,row.assignmentCapture.request.input,{privatePost:true,printedVariantConfirmed:true}):composeMidnightReader(row.templateCapture.body,body,state,row.assignmentCapture.request.input));negative++;
    }
    for(const mutate of [t=>{t.sourceVersions[0].hash='0'.repeat(64);},t=>{t.nodes.find(n=>n.blocks.length).blocks[0].provenance.runtimeLiteralProof=false;},
      t=>{t.nodes.find(n=>n.blocks.length).blocks[0].provenance.canonicalWork='other';},t=>{t.nodes.find(n=>n.blocks.length).blocks[0].provenance.canonicalSelectionSteps=[];},
      t=>{t.nodes.find(n=>n.blocks.length).blocks[0].provenance.canonicalSelectionSteps[0].start=-1;},t=>{delete t.nodes.find(n=>n.blocks.length).blocks[0].provenance.canonicalSelectionSteps[0].textSha256;},
      t=>{t.nodes.find(n=>n.blocks.length).blocks[0].provenance.userSupplied=true;},t=>{[t.nodes[0],t.nodes[1]]=[t.nodes[1],t.nodes[0]];},
      t=>{t.variant='unsupported';},t=>{t.runtimeAdmissionGranted=true;},t=>{t.nodes.find(n=>n.blocks.length).blocks[0].repeatCount=null;},t=>{t.ruleVersion='0'.repeat(64);}]){
      const body=structuredClone(row.templateCapture.body);mutate(body.data);await assert.rejects(validateMidnightTemplate(body,state));negative++;
    }
    for(const change of [b=>b.segments[0].text+=' altered',b=>b.provenance.canonicalBlock=198,b=>b.provenance.canonicalSelectionSteps[0].length=173]){
      const altered=structuredClone(row.templateCapture.body),b=altered.data.nodes.flatMap(n=>n.blocks).find(b=>b.provenance?.parentSlot==='holy-spirit-kontakion');
      change(b);await assert.rejects(validateMidnightTemplate(altered,state));negative++;
    }
    if(result.midnightClergy){const body=structuredClone(row.templateCapture.body);body.data.nodes.find(n=>n.kind==='slot').slotId='other';await assert.rejects(validateMidnightTemplate(body,state));negative++;}
    else if(row===rows[0]){const body=structuredClone(row.fullCapture.body);for(const k of ['wholeOfficeAccepted','runtimeAdmissionGranted','calendarServiceAppointed'])body.data[k]=false;assert.throws(()=>validateMidnightFull(body,state));negative++;}
    receipt.push({case:row.case,readerPrintPdf:'PASS',nativeBlocks:result.entries.flatMap(e=>e.blocks).length,renderedBlocks:snapshot.blocks.length,pages:pdf.pageCount,dynamicRubricPreserved:!!result.midnightClergy});console.info(JSON.stringify(receipt.at(-1)));
  }
  await writeFile('tmp/midnight-holy-ui-receipt.json',JSON.stringify({scope:'Final owner isolated original HTTP exports; main installation pending, no server/browser/POST',sourceSha256:indexHash,cases:receipt,negativeMutations:negative,partialPdfPages,oldFullControls:6},null,2)+'\n');
console.info({cases:receipt.length,pages:receipt.reduce((n,r)=>n+r.pages,0),negative,partialPdfPages});
}finally{restore();}
