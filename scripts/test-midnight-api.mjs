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
const root=process.argv[2];assert.ok(root,'Pass the backend fixture root and current HTTP index path');
const indexPath=process.argv[3];assert.ok(indexPath,'Pass the current actual HTTP index');
const indexBytes=await readFile(indexPath),index=JSON.parse(indexBytes),captures=[];
for(const row of index){const bytes=await readFile(join(root,row.path)),capture=JSON.parse(bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.deepEqual(capture.request,row.request);assert.equal(capture.httpStatus,row.httpStatus);
  assert.ok(capture.headers['cache-control'].join(',').includes('private')&&capture.headers['cache-control'].join(',').includes('no-store'));
  captures.push({file:basename(row.path),...capture});
}
assert.ok(captures.length>=18);
const stateFor=input=>({...input,office:'midnight-office',textLanguage:'cu',textSize:22,midnightProfile:input.profile,midnightLocation:input.location,midnightBishopTitle:input.bishopTitle||'bishop'});
const key=input=>JSON.stringify([input.date,input.temple,input.profile,input.location,input.sequence]);
const rows=[];
for(const full of captures.filter(c=>c.request.path.includes('/services/')&&c.httpStatus===200)){
  const t=captures.find(c=>c.request.path.includes('/templates/')&&key(c.request.input)===key(full.request.input));
  const a=captures.find(c=>c.request.path.includes('/assignments/')&&c.request.method==='GET'&&c.httpStatus===200&&key(c.request.input)===key(full.request.input));
  assert.ok(t&&a);const result=await composeMidnightReader(t.body,a.body,stateFor(a.request.input),a.request.input);
  assert.deepEqual(result.entries.flatMap(e=>e.blocks),full.body.data.blocks);assert.equal(result.complete,true);
  rows.push({case:full.file,result,fullCapture:full,templateCapture:t,assignmentCapture:a,state:stateFor(a.request.input)});
  console.info(JSON.stringify({case:full.file,modularFullParity:'PASS',blocks:full.body.data.blocks.length}));
}
assert.equal(rows.length,4);
const clergyTemplate=captures.find(c=>c.request.path.includes('/templates/')&&c.request.input.profile==='clergy');
const clergyPartial=captures.find(c=>c.request.path.includes('/assignments/')&&c.request.method==='GET'&&c.request.input.profile==='clergy'&&c.httpStatus===200&&!c.request.input.localContext)
  ||captures.find(c=>c.request.path.includes('/services/')&&c.request.input.profile==='clergy'&&c.httpStatus===409);
const post=captures.find(c=>c.request.method==='POST'&&c.httpStatus===200),state=stateFor(post.request.input);
const partial=await composeMidnightClergy(clergyTemplate.body,clergyPartial.body,state,clergyPartial.request.input,{fullEvaluation:clergyPartial.request.path.includes('/services/')});
assert.equal(partial.complete,false);assert.equal(partial.entries.filter(e=>e.missing).length,3);
const filled=await composeMidnightClergy(clergyTemplate.body,post.body,state,post.request.input,{privatePost:true,printedVariantConfirmed:true});
assert.equal(filled.complete,true);assert.equal(filled.localFilledCount,3);assert.equal(filled.performance.count,null);
rows.push({case:post.file,result:filled,partial,templateCapture:clergyTemplate,assignmentCapture:post,state});
console.info(JSON.stringify({case:post.file,privateClergyComposition:'PASS',blocks:filled.entries.flatMap(e=>e.blocks).length,missing:0,dynamicFrequency:filled.performance.count}));

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
    assert.ok(reader.page.textContent.includes('Обычный самостоятельный чин без местного бдения.'));
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
    if(result.midnightClergy){const body=structuredClone(row.templateCapture.body);body.data.nodes.find(n=>n.kind==='slot').slotId='other';await assert.rejects(validateMidnightTemplate(body,state));negative++;}
    else if(row===rows[0]){const body=structuredClone(row.fullCapture.body);for(const k of ['wholeOfficeAccepted','runtimeAdmissionGranted','calendarServiceAppointed'])body.data[k]=false;assert.throws(()=>validateMidnightFull(body,state));negative++;}
    receipt.push({case:row.case,readerPrintPdf:'PASS',nativeBlocks:result.entries.flatMap(e=>e.blocks).length,renderedBlocks:snapshot.blocks.length,pages:pdf.pageCount,dynamicRubricPreserved:!!result.midnightClergy});console.info(JSON.stringify(receipt.at(-1)));
  }
  const privateGet=captures.find(c=>c.request.method==='GET'&&c.request.input.localContext),stale=captures.find(c=>c.request.input.templateVersion==='0'.repeat(64));
  assert.equal(privateGet.httpStatus,422);assert.equal(privateGet.body.data,undefined);assert.equal(stale.httpStatus,409);assert.equal(stale.body.data,undefined);
  const invalid=captures.find(c=>Object.hasOwn(c.request.input,'unexpected'));assert.equal(invalid.httpStatus,422);assert.equal(invalid.body.data,undefined);
  await writeFile('tmp/midnight-ui-replay-receipt.json',JSON.stringify({scope:'Actual supplied HTTP envelopes; provenance/install scope follows the supplied index; no server/browser/network access',indexPath,indexSha256:createHash('sha256').update(indexBytes).digest('hex'),cases:receipt,partialSource:clergyPartial.request.path,partialPdfPages,negativeMutations:negative,actualNegativeHttp:3,sourceIdsVisible:false,actualPOSTsent:false},null,2));
  console.info(JSON.stringify({readerCases:4,clergyPrivateCase:1,actualNegativeHttp:3,negativeMutations:negative,pages:receipt.reduce((n,r)=>n+r.pages,0),partialPdfPages}));
}finally{restore();}
