// Replay only real HTTP captures supplied by the backend owner; no browser/network/corpus copy.
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { PDFDocument, decodePDFRawStream } from 'pdf-lib';
import { composeParts, fetchWorshipParts, partsHash } from '../public/calendar-ui/worship-parts.js';
import { tropariaProtocol } from '../public/calendar-ui/worship-troparia-protocol.js';
import { TROPARIA_SECTION } from '../public/calendar-ui/worship-troparia-section.js';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { repetitionEntries, compactRepetitions, repetitionNumber } from '../public/calendar-ui/worship-repeats.js';
import { captureWorshipPdf, exportWorshipPdf } from '../src/export/worship-pdf-browser';
import { create, installReaderPdfDocument } from '../tests/fixtures/reader-pdf-dom.mjs';
const path=process.argv[2];if(!path)throw new Error('Pass the real T/K HTTP manifest or installed capture directory');
const type6Mode=process.argv.includes('--type6'), v4Mode=process.argv.includes('--v4');
const captures=new Map(), info=await stat(path), directory=info.isDirectory(), overlay=process.argv.includes('--overlay'), dormitionMode=process.argv.includes('--dormition'), installed=(directory||v4Mode)&&!overlay;
const sha=value=>createHash('sha256').update(value).digest('hex');
let cases;
if(directory){
  const files=(await readdir(path)).filter(file=>file.endsWith('.json')&&!/-request|-http|manifest|ANNOTATION/.test(file));
  cases=files.map(file=>({case:file.replace('.json',''),body:join(path,file),request:join(path,file.replace('.json','-request.json')),http:join(path,file.replace('.json','-http.json'))}));
}else if(v4Mode){
  const manifest=JSON.parse(await readFile(path)),root=dirname(path);
  assert.equal(manifest.kind,'joined-current-bounded-MDA-actual-HTTP-fixtures');assert.equal(manifest.tripleCount,18);
  assert.equal(manifest.boundedMdaObject,'de8a0000867964fc7a89eb3162c5d4ea9bef2ccebedf38ee7dc124f23281ac8d');
  assert.equal(manifest.directory,'installed-api-mda-bounded');assert.equal(manifest.triples.length,18);
  const receipt=JSON.parse(await readFile(join(root,manifest.captureReceipt)));
  assert.equal(receipt.kind,'three-targeted-current-v4-branches-actual-App-HTTP-capture');
  assert.equal(receipt.result,'PASS');assert.equal(receipt.rawResponseJsonPatched,false);assert.equal(receipt.productionServerAccessed,false);
  assert.equal(receipt.boundedMdaObject,manifest.boundedMdaObject);assert.equal(receipt.shared29ManifestUnchanged,true);
  cases=manifest.triples.map(row=>{
    for(const field of ['body','request','http'])assert.match(row[field],/^[a-z0-9-]+\.json$/);
    return{case:row.case,body:join(root,manifest.directory,row.body),request:join(root,manifest.directory,row.request),http:join(root,manifest.directory,row.http),sha256:row.responseSha256};
  });
  for(const row of cases){const data=JSON.parse(await readFile(row.body)).data;assert.equal(data.templateVersion,manifest.templateVersion);}
  for(const item of receipt.cases){const row=cases.find(row=>row.case===item.case);assert.ok(row);assert.equal(row.sha256,item.responseSha256);}
  console.info('Current de8a manifest + targeted branch receipt verified; no old957 captures included.');
}else{
  const bytes=await readFile(path),manifest=JSON.parse(bytes);cases=manifest.cases;
  console.info('Actual manifest SHA256: '+sha(bytes));
}
for(const row of cases){
  const body=await readFile(row.body),http=JSON.parse(await readFile(row.http)),request=JSON.parse(await readFile(row.request));
  if(row.sha256)assert.equal(sha(body),row.sha256);
  assert.equal(http.responseSha256,sha(body));
  if(type6Mode&&http.status===409){
    assert.match(request.path,/\/services\/liturgy$/);
    const value=JSON.parse(body);assert.equal(value.data?.blocks,undefined);assert.notEqual(value.data?.status,'complete');
    assert.ok(value.data?.unresolvedParts?.length);assert.ok(value.error);
  }else assert.equal(http.status,200);
  assert.ok(http.cacheControl.includes('private')&&http.cacheControl.includes('no-store'));
  if(directory||v4Mode){assert.equal(http.productionInstalled,!overlay);assert.equal(http.productionServerAccessed,false);}
  captures.set(row.case,{response:JSON.parse(body),http,request});
}
console.info(`${captures.size} actual HTTP responses + request/HTTP sidecars: SHA256/private/no-store PASS; installed App=${installed}`);
if(type6Mode){
  const annotation=JSON.parse(await readFile(join(path,'DORMITION_REQUEST_PATH_ANNOTATION.json')));
  assert.equal(annotation.kind,'request-path-annotation-from-actual-test-contract-not-new-HTTP-capture');
  assert.equal(annotation.entries.length,5);
  for(const entry of annotation.entries){
    assert.match(entry.file,/^dormition-(?:template|\d{4}-\d{2}-\d{2})-request\.json$/);
    assert.equal(entry.capturedPathWasAbsent,true);assert.equal(entry.onlyAddedField,'path');
    assert.equal(sha(await readFile(join(path,entry.file))),entry.annotatedSha256);
    const name=entry.file.replace('-request.json',''),capture=captures.get(name);assert.ok(capture);
    assert.equal(capture.request.path,entry.path);
    assert.equal(sha(await readFile(join(path,name+'.json'))),entry.bodySha256Unchanged);
    assert.equal(sha(await readFile(join(path,name+'-http.json'))),entry.httpSidecarSha256Unchanged);
  }
  console.info('Five Dormition request.path fields: annotated test contract, NOT captured paths; receipt/body/HTTP SHA checks PASS.');
}
const parentAt=process.argv.indexOf('--parent');
if(parentAt>=0){
  const parent=process.argv[parentAt+1];assert.ok(parent);
  for(const[name,capture]of captures){
    const prior=JSON.parse(await readFile(join(parent,name+'.json'))).data,current=capture.response.data;
    if(current.status==='fixed-template'){
      for(const key of ['nodes','sourceVersions','parallelGroups','baseTemplateVersion','tropariaBaseTemplateVersion'])assert.deepEqual(current[key],prior[key]);
    }else{
      assert.deepEqual(current.missing,prior.missing);assert.deepEqual(current.sourceVersions,prior.sourceVersions);
      assert.equal(current.operations.length,prior.operations.length);
      current.operations.forEach((operation,index)=>{const before={...prior.operations[index]},after={...operation};if(operation.sectionId===TROPARIA_SECTION){delete before.sectionTemplateVersion;delete after.sectionTemplateVersion;}assert.deepEqual(after,before);});
      for(const[id,receipt]of Object.entries(current.verifiedSections)){if(id===TROPARIA_SECTION){assert.deepEqual(receipt.selection,prior.verifiedSections[id].selection);assert.equal(receipt.sourceReviewVersion,prior.verifiedSections[id].sourceReviewVersion);}else assert.deepEqual(receipt,prior.verifiedSections[id]);}
    }
  }
  console.info('PASS real v1/v2 parent parity: source nodes/groups/words/styles/order/repeats/sources/legacy unchanged; only declared protocol versions differ.');
}

const templates=[...captures.values()].filter(capture=>capture.response.data?.status==='fixed-template'&&capture.response.data?.sections?.[TROPARIA_SECTION]);
assert.equal(templates.length,type6Mode||v4Mode?2:1);for(const value of templates)assert.deepEqual(value.response,templates[0].response);
const template=templates[0].response;
const fonts={civil:await readFile('public/fonts/DejaVuSerif.ttf'),cu:await readFile('public/fonts/Ponomar-Regular.ttf'),fallback:await readFile('public/fonts/DejaVuSans.ttf')};
installReaderPdfDocument();let selected=0,dormitionSelected=0,legacy=0,held=0,negative=0,actualSixSelected=0,dormitionSix=0;
for(const[name,capture]of captures){
  if(capture.response.data?.status==='fixed-template'||capture.http.status===409)continue;
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
    selected++;const isDormition=assignments.verifiedSections[TROPARIA_SECTION].selection.templeProfile.kind==='theotokos',parts=isDormition?9:10;
    if(isDormition)dormitionSelected++;assert.equal(operation.blocks.length,parts);assert.equal(result.entries.filter(entry=>entry.nodeId===operation.nodeId).length,parts);
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
    if(assignments.verifiedSections[TROPARIA_SECTION].selection.actualPrincipalTypeCode===6&&!isDormition){
      actualSixSelected++;
      const rec=a=>a.verifiedSections[TROPARIA_SECTION];
      Object.assign(mutations,{
        'type6 source version':(_,a)=>{rec(a).sourceReviewVersion='0'.repeat(64);},
        'type6 actual rank':(_,a)=>{rec(a).selection.actualPrincipalTypeCode=7;},
        'type6 remapping':(_,a)=>{rec(a).selection.type6RemappedTo7=true;},
        'type6 missing remapping flag':(_,a)=>{delete rec(a).selection.type6RemappedTo7;},
        'type6 nested rank':(_,a)=>{rec(a).selection.reviewedOrderCapability.actualPrincipalTypeCode=7;},
        'type6 nested remapping':(_,a)=>{rec(a).selection.reviewedOrderCapability.type6RemappedTo7=true;},
        'type6 capability hash':(_,a)=>{rec(a).selection.reviewedOrderCapability.objectHash='0'.repeat(64);},
        'type6 capability missing':(_,a)=>{delete rec(a).selection.reviewedOrderCapability;},
        'type6 witness':(_,a)=>{rec(a).selection.sourceRuleWitnessHash='0'.repeat(64);},
        'type6 review':(_,a)=>{rec(a).selection.sourceRuleReviewHash='0'.repeat(64);},
        'type6 source order':(_,a)=>{rec(a).selection.sourceOrderCapabilityHash='0'.repeat(64);},
        'type6 unknown resolver':(_,a)=>{rec(a).selection.orderResolver='unknown';},
        'type6 missing template capability':(t)=>{delete t.sections[TROPARIA_SECTION].sixSticheraOrderCapability;},
        'type6 unknown template capability':(t)=>{t.sections[TROPARIA_SECTION].sixSticheraOrderCapability='0'.repeat(64);},
      });
    }
    if(isDormition){
      const receipt=a=>a.verifiedSections[TROPARIA_SECTION], op=a=>a.operations.find(op=>op.sectionId===TROPARIA_SECTION);
      Object.assign(mutations,{
        'saint protocol for Dormition':(t,a)=>{t.sections[TROPARIA_SECTION].ruleVersion=receipt(a).ruleVersion='ordinary-single-saint-temple-after-entrance-v1';},
        'missing independent admission':(_,a)=>{delete receipt(a).selection.templeAdmission;},
        'unreviewed capability':(_,a)=>{receipt(a).selection.templeAdmission.sourceCapabilityReviewed=false;},
        'old saint admission':(_,a)=>{receipt(a).selection.oldSaintOnlyAdmissionUsed=true;},
        'temple kind cast':async(t,a)=>{const r=receipt(a);r.selection.templeProfile.kind=r.context.templeProfile.kind='saint';r.sourceReviewVersion=r.selection.sourceReviewHash='034879275ba8b1f85fae85d3281bc033c4295d1f998e2bb5a8eeba58268849d8';r.selection.sourceProofHash=r.selection.hoursSourceCatalogueHash='b'.repeat(64);delete r.selection.templeAdmission;assert.equal(await tropariaProtocol(t.sections[TROPARIA_SECTION],r,state),0);},
        'custom dedication':(_,a)=>{receipt(a).selection.templeProfile.id='custom';},
        'native role proof':(_,a)=>{receipt(a).selection.templeAdmission.nativeRoleProofHash='0'.repeat(64);},
        'order proof':(_,a)=>{receipt(a).selection.templeAdmission.orderProofHash='0'.repeat(64);},
        'wrong native role block':(_,a)=>{receipt(a).selection.references['temple-kontakion'].block=17;},
        'generic Theotokos K':(_,a)=>{receipt(a).selection.order[8]='theotokos-kontakion';op(a).blocks[8].slot='theotokos-kontakion';},
        'resealed K before Now':async(_,a)=>{const r=receipt(a),b=op(a).blocks;[r.selection.order[7],r.selection.order[8]]=[r.selection.order[8],r.selection.order[7]];[b[7],b[8]]=[b[8],b[7]];r.composedBlocksHash=await partsHash(b);},
        'tenth part':(_,a)=>{op(a).blocks.push(structuredClone(op(a).blocks[8]));},
        'litya repetitions':(_,a)=>{op(a).blocks[0].repeatCount=3;},
        'resealed unknown capability':async(t,a)=>{const section=t.sections[TROPARIA_SECTION];section.templeSourceCapabilities['memory-day-0009'].nativeRoleObjectHash='0'.repeat(64);section.templateVersion=await partsHash({baseSourceReview:'034879275ba8b1f85fae85d3281bc033c4295d1f998e2bb5a8eeba58268849d8',templeSourceCapabilities:section.templeSourceCapabilities});receipt(a).templateVersion=op(a).sectionTemplateVersion=section.templateVersion;t.templateVersion=a.templateVersion=await partsHash({dayTemplateVersion:t.tropariaBaseTemplateVersion,tropariaSectionVersion:section.templateVersion});},
        'unknown protocol':(t,a)=>{t.sections[TROPARIA_SECTION].ruleVersion=receipt(a).ruleVersion='ordinary-sourced-temple-after-entrance-v999';},
      });
      if(assignments.verifiedSections[TROPARIA_SECTION].selection.actualPrincipalTypeCode===6){
        dormitionSix++;
        Object.assign(mutations,{
          'Dorm6 join':(_,a)=>{receipt(a).selection.joinedSourceCapability='0'.repeat(64);},
          'Dorm6 missing join':(_,a)=>{delete receipt(a).selection.joinedSourceCapability;},
          'Dorm6 source version':(_,a)=>{receipt(a).sourceReviewVersion='5980fa93158d9824db71b9223594bbe07094d1dcd243e28dc1b0ce13302ee7bf';},
          'Dorm6 actual rank':(_,a)=>{receipt(a).selection.actualPrincipalTypeCode=7;},
          'Dorm6 remapping':(_,a)=>{receipt(a).selection.type6RemappedTo7=true;},
          'Dorm6 nested rank':(_,a)=>{receipt(a).selection.reviewedOrderCapability.actualPrincipalTypeCode=7;},
          'Dorm6 nested remapping':(_,a)=>{receipt(a).selection.reviewedOrderCapability.type6RemappedTo7=true;},
          'Dorm6 authority':(_,a)=>{receipt(a).selection.reviewedOrderCapability.objectHash='0'.repeat(64);},
          'Dorm6 missing template join':(t)=>{delete t.sections[TROPARIA_SECTION].dormitionSixSticheraJoin;},
          'Dorm6 obsolete resealed957':async(t,a)=>{const s=t.sections[TROPARIA_SECTION];s.templateVersion=await partsHash({dormitionSixSticheraJoin:s.dormitionSixSticheraJoin,dormitionSixSticheraSupplement:'95710388b3759ec67ea9eae45993f2ed8071eabe60d742643f09faa528d4604f',baseSourceReview:'034879275ba8b1f85fae85d3281bc033c4295d1f998e2bb5a8eeba58268849d8',templeSourceCapabilities:s.templeSourceCapabilities,sixSticheraOrderCapability:s.sixSticheraOrderCapability});receipt(a).templateVersion=op(a).sectionTemplateVersion=s.templateVersion;t.templateVersion=a.templateVersion=await partsHash({dayTemplateVersion:t.tropariaBaseTemplateVersion,tropariaSectionVersion:s.templateVersion});},
        });
      }
    }
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
assert.ok(selected>=4);if(v4Mode){assert.equal(selected,16);assert.equal(dormitionSelected,13);assert.equal(dormitionSix,8);assert.equal(actualSixSelected,2);}else if(type6Mode){assert.ok(selected>=20);assert.equal(actualSixSelected,16);assert.equal(dormitionSelected,4);}else if(dormitionMode)assert.ok(dormitionSelected>=4);else{assert.equal(legacy,1);assert.equal(held,1);}assert.equal(negative,selected*15+dormitionSelected*15+actualSixSelected*14+dormitionSix*10);
console.info(`PASS ${selected} selected (${dormitionSelected} Dormition) + ${legacy} legacy + ${held} held, and ${negative} real-response negative mutations. No production acceptance inferred.`);
