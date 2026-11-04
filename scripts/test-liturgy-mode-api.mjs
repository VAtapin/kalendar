// Genuine canonical HTTP triples, replayed offline through staged transport and the existing reader.
import assert from'node:assert/strict';
import{readFile,readdir,writeFile,mkdir}from'node:fs/promises';
import{createHash}from'node:crypto';
import{composeParts,fetchWorshipParts}from'../public/calendar-ui/worship-parts.js';
import{renderWorshipReader}from'../public/calendar-ui/worship-reader.js';
import{create,installReaderPdfDocument}from'../tests/fixtures/reader-pdf-dom.mjs';
import{captureWorshipPdf}from'../src/export/worship-pdf-browser.ts';
import{compactRepetitions,repetitionEntries,repetitionNumber}from'../public/calendar-ui/worship-repeats.js';
const dir=process.argv[2];assert.ok(dir?.endsWith('/'),'Pass the original canonical capture directory with trailing slash');
const read=async f=>JSON.parse(await readFile(dir+f));
const template=await read('template.json'),templateRequest=await read('template-request.json'),templateHttp=await read('template-http.json');
const restore=installReaderPdfDocument(),rows=[];let modeNegatives=0,negativeMutations=0;
const byKey=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b)));
try{
  for(const file of(await readdir(dir)).filter(f=>f!=='template.json'&&f.endsWith('.json')&&!f.endsWith('-request.json')&&!f.endsWith('-http.json'))){
    const bytes=await readFile(dir+file),body=JSON.parse(bytes),id=file.slice(0,-5),http=await read(id+'-http.json'),request=await read(id+'-request.json');
    assert.equal(createHash('sha256').update(bytes).digest('hex'),http.responseSha256,file);
    assert.ok(http.cacheControl.includes('private')&&http.cacheControl.includes('no-store'),file);
    const state={date:request.query.date,office:'liturgy',rite:'john-chrysostom',temple:request.query.temple,sequence:request.query.sequence||'standalone',textLanguage:'cu',textSize:22,
      ...(request.query.officeMode!==undefined?{officeMode:request.query.officeMode}:{})};
    const bases=[];let calls=0;
    const fetcher=async(url,options)=>{
      calls++;assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');
      const isTemplate=url.pathname.includes('/templates/'),expected=isTemplate?templateRequest:request;
      const expectedQuery={...expected.query};if(expectedQuery.officeMode==='auto')delete expectedQuery.officeMode; // Documented omission/auto equivalence only.
      assert.equal(url.pathname,expected.path);assert.deepEqual(byKey(Object.fromEntries(url.searchParams)),byKey(expectedQuery));
      return{status:isTemplate?templateHttp.status:http.status,json:async()=>isTemplate?template:body};
    };
    const result=await fetchWorshipParts('https://bible-desktop.com',state,b=>bases.push(b),fetcher);
    assert.equal(calls,2);assert.equal(bases.length,0,'No ordinary base shown before mode decision');
    let snapshot,printed=0,changes=[];
    const reader=renderWorshipReader({state,create,formatDate:d=>d,onChange:(...args)=>changes.push(args),onRetry(){},
      print(){printed++;},pdfLoad:async()=>({captureWorshipPdf,downloadWorshipPdf:async s=>{snapshot=s;}})});
    reader.render(result);
    const print=reader.page.querySelectorAll('button').find(b=>b.textContent==='Печать службы');
    const pdf=reader.page.querySelectorAll('button').find(b=>b.textContent==='Скачать PDF');
    const choice=reader.page.querySelectorAll('select').find(n=>n.dataset.worshipControl==='officeMode');
    if(http.status===409){
      assert.equal(result.status,'office-mode-unavailable',file);assert.equal(result.ordinaryLiturgyAvailable,false);
      assert.equal(reader.page.querySelector('.worship-text'),null);assert.equal(print.disabled,true);assert.equal(pdf.disabled,true);
      assert.equal(snapshot,undefined);assert.ok(reader.page.textContent.includes('Вариант «Аллилуия»: обычная Литургия не подготовляется.'));
      assert.deepEqual(result.modeContract,body.data);
    }else{
      assert.equal(result.status,'parts',file);assert.equal(result.complete,false);assert.equal(result.assignmentsStatus,'partial');
      assert.equal(result.entries.filter(e=>e.missing).length,body.data.missing.length);
      assert.equal(result.modeContract,body.data);assert.equal(print.disabled,false);assert.equal(pdf.disabled,false);
      await print.events.click();assert.equal(printed,1);await pdf.events.click();assert.ok(snapshot,file);
      assert.equal(snapshot.complete,false);assert.deepEqual(snapshot.sources,[]);
      assert.deepEqual(snapshot.sourceMetadata.serviceMode,body.data.serviceMode);
      assert.equal(snapshot.sourceMetadata.selection.officeMode,state.officeMode||'auto');
      assert.ok(snapshot.blocks.length>0);assert.ok(snapshot.warnings.length);
      const selected=Object.keys(body.data.verifiedSections).find(id=>['ordinary-appointed-antiphons-1-2','governing-mode-daily-antiphons-1-2','general-ordinary-entrance-verse','ordinary-antiphons-and-entrance'].includes(id));
      const mutations=[
        a=>a.wholeLiturgyAccepted=true,a=>a.context.date='2026-01-01',a=>a.actualRectorElectionProved=true,
        ...(selected?[
        a=>a.verifiedSections[selected].acceptance={status:'approved'},
        a=>a.verifiedSections[selected].templateVersion='0'.repeat(64),
        a=>a.operations[a.verifiedSections[selected].operationIndexes[0]].slotId='unknown',
        a=>a.operations.push(a.operations[a.verifiedSections[selected].operationIndexes[0]]),
        async a=>{const r=a.verifiedSections[selected],op=a.operations[r.operationIndexes[0]];op.blocks[0].segments[0].text+=' altered';r.composedBlocksHash=await (await import('../public/calendar-ui/worship-hash.js')).partsHash(r.operationIndexes.flatMap(i=>a.operations[i].blocks));},
      ]:[])];
      for(const mutate of mutations){const altered=structuredClone(body.data);await mutate(altered);await assert.rejects(()=>composeParts(template.data,altered,state),file+' negative mutation');negativeMutations++;}
      const expected=[];
      for(const entry of repetitionEntries(result.entries.filter(e=>!e.missing)))for(const{block,count}of compactRepetitions(entry.blocks))
        expected.push((Number.isInteger(block.tone)&&block.tone>=1&&block.tone<=8?'Глас '+block.tone:'')+block.segments.map(s=>s.text).join('')+(count>1?' '+repetitionNumber(count,'cu'):''));
      assert.deepEqual(snapshot.blocks.filter(b=>b.kind!=='warning').map(b=>b.runs.map(r=>r.text).join('')),expected,file+' exact reader/print/PDF Unicode body');
      for(const source of result.sourceVersions)for(const field of['work','edition'])assert.ok(!reader.page.textContent.includes(source[field]),file);
    }
    if(result.serviceMode){
      assert.ok(choice);assert.deepEqual(choice.children.map(n=>n.value),['auto',...result.serviceMode.permittedModes]);
      assert.deepEqual(result.serviceMode,body.data.serviceMode);
      choice.value=result.serviceMode.alternatives[0]?.mode||'auto';choice.events.change();
      assert.equal(reader.page.querySelector('.worship-text'),null);assert.equal(print.disabled,true);assert.equal(pdf.disabled,true);
      assert.deepEqual(changes,[['officeMode',choice.value]]);modeNegatives++;
    }else assert.equal(choice,undefined);
    rows.push({file,httpStatus:http.status,status:result.status,blocks:result.entries?.flatMap(e=>e.blocks||[]).length||0,
      missing:result.entries?.filter(e=>e.missing).length||0,selectedMode:result.serviceMode?.selectedMode,readerPrintSnapshot:!!snapshot});
    reader.dispose();
  }
}finally{restore();}
assert.equal(rows.length,67);
await mkdir('tmp/liturgy-mode-ui-staging',{recursive:true});
await writeFile('tmp/liturgy-mode-ui-staging/canonical-reader-replay-receipt.json',JSON.stringify({scope:'Installed Kalendar consumer; genuine canonical normal-route triples, backend66ce0d63',cases:rows.length,modeChangeClears:modeNegatives,negativeMutations,rows},null,2)+'\n');
console.info({cases:rows.length,godLord:rows.filter(r=>r.httpStatus===200).length,alleluiaUnavailable:rows.filter(r=>r.httpStatus===409).length,modeChangeClears:modeNegatives,negativeMutations});
