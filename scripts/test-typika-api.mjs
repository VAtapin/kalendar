// Original owner captures only. No network, source edits or invented positive HTTP body.
import assert from'node:assert/strict';
import{readFile,readdir,writeFile,mkdir}from'node:fs/promises';
import{join}from'node:path';
import{createHash}from'node:crypto';
import{PDFDocument,decodePDFRawStream}from'pdf-lib';
import fontkit from'@pdf-lib/fontkit';
import{composeTypika,TYPIKA_VARIANT}from'../public/calendar-ui/worship-typika.js';
import{fetchWorshipParts,partsHash}from'../public/calendar-ui/worship-parts.js';
import{renderWorshipReader}from'../public/calendar-ui/worship-reader.js';
import{compactRepetitions,repetitionEntries,repetitionNumber}from'../public/calendar-ui/worship-repeats.js';
import{captureWorshipPdf,exportWorshipPdf}from'../src/export/worship-pdf-browser.ts';
import{create,installReaderPdfDocument}from'../tests/fixtures/reader-pdf-dom.mjs';
const mainDir=process.argv[2],stageDir=process.argv[3];assert.ok(mainDir&&stageDir,'Pass installed INDEX directory and canonical196 stage directory');
const sha=b=>createHash('sha256').update(b).digest('hex'),read=async p=>JSON.parse(await readFile(p));
const indexBytes=await readFile(join(mainDir,'INDEX.json')),index=JSON.parse(indexBytes),captures=[];
assert.equal(index.execution,'normalmainApp-router-nooverrides');
for(const[id,meta]of Object.entries(index.responses)){
 const bytes=await readFile(join(mainDir,id+'.json')),request=await read(join(mainDir,id+'-request.json')),http=await read(join(mainDir,id+'-http.json'));
 assert.equal(sha(bytes),meta.bodySha256);assert.equal(meta.productionInstalled,true);assert.equal(meta.productionServerAccessed,false);
 assert.ok(meta.headers['cache-control'].join(',').includes('private')&&meta.headers['cache-control'].join(',').includes('no-store'));
 assert.equal(http.status,meta.status);assert.equal(request.path,meta.path);captures.push({id,...meta,body:JSON.parse(bytes)});
}
assert.equal(captures.length,17);
const fonts={civil:await readFile('public/fonts/DejaVuSerif.ttf'),cu:await readFile('public/fonts/Ponomar-Regular.ttf'),fallback:await readFile('public/fonts/DejaVuSans.ttf')};
const faces=Object.values(fonts).map(bytes=>fontkit.create(bytes)),graphemes=new Intl.Segmenter(undefined,{granularity:'grapheme'});
const stateFor=date=>({office:'typika',date,temple:'transfiguration',sequence:'standalone',textLanguage:'cu',textSize:22,typikaVariant:TYPIKA_VARIANT,typikaNoLiturgy:true});
const restore=installReaderPdfDocument(),rows=[],mainRows=[];let negative=0;
await mkdir('tmp/pdfs',{recursive:true});
async function readerCheck(result,state,savePdf=false){
 let snapshot,printBody;const reader=renderWorshipReader({state,create,formatDate:d=>d,onChange(){},onRetry(){},print(){printBody=reader.page.querySelector('.worship-text');},pdfLoad:async()=>({captureWorshipPdf,downloadWorshipPdf:async s=>{snapshot=s;}})});
 reader.render(result);assert.equal(reader.page.querySelectorAll('.worship-missing').length,0);
 assert.equal(reader.page.querySelector('.worship-coverage').children[0].textContent,'Полный текст выбранного варианта');
 assert.ok(!reader.page.textContent.includes('Полная служба дня'));
 await reader.page.querySelectorAll('button').find(b=>b.textContent==='Печать службы').events.click();assert.ok(printBody);
 await reader.page.querySelectorAll('button').find(b=>b.textContent==='Скачать PDF').events.click();assert.ok(snapshot);assert.equal(snapshot.complete,false);assert.deepEqual(snapshot.sources,[]);
 assert.deepEqual(snapshot.sourceMetadata.serviceContract,result.serviceContract);
 for(const flag of['calendarRiteReplaced','calendarServiceAppointed','actualLocalContextVerified','runtimeAdmissionGranted','wholeOfficeAccepted'])assert.equal(snapshot.sourceMetadata.serviceContract.assignments[flag],false);
 const expected=repetitionEntries(result.entries).flatMap(e=>compactRepetitions(e.blocks).map(({block,count})=>(Number.isInteger(block.tone)&&block.tone>=1&&block.tone<=8?'Глас '+block.tone:'')+block.segments.map(s=>s.text).join('')+(count>1?' '+repetitionNumber(count,'cu'):'')));
 assert.deepEqual(snapshot.blocks.map(b=>b.runs.map(r=>r.text).join('')),expected);
 for(const text of expected)for(const{segment}of graphemes.segment(text))assert.ok(faces.some(face=>[...segment].every(c=>/[\r\n\t]/.test(c)||face.hasGlyphForCodePoint(c.codePointAt(0)))),'Uncovered Typika PDF grapheme');
 assert.deepEqual(captureWorshipPdf(printBody,snapshot).blocks,snapshot.blocks);
 for(const s of result.sourceVersions)for(const key of['work','edition'])if(s[key]?.length>12)assert.ok(!reader.page.textContent.includes(s[key]));
 let pages=null;
 if(savePdf){
  const pdf=await exportWorshipPdf(snapshot,{fontBytes:fonts}),parsed=await PDFDocument.load(pdf.bytes),logical=[];assert.equal(parsed.getSubject(),undefined);
  for(const p of parsed.getPages())for(const ref of p.node.Contents().asArray()){
   const stream=Buffer.from(decodePDFRawStream(parsed.context.lookup(ref)).decode()).toString('latin1');for(const m of stream.matchAll(/\/ActualText\s*<([a-f0-9]+)>\s*\/KalendarBody\s+true/gi))logical.push(Buffer.from(m[1],'hex').swap16().toString('utf16le').replace(/^\ufeff/,''));
  }
  const normalize=s=>s.replace(/\s/g,'');assert.equal(normalize(logical.join('')),normalize(expected.join('')));
  await writeFile('tmp/pdfs/typika-main-'+state.date+'.pdf',pdf.bytes);pages=pdf.pageCount;
 }
 reader.dispose();return pages;
}
try{
 for(const full of captures.filter(c=>c.path.includes('/services/')&&c.status===200)){
  const date=full.input.date,t=captures.find(c=>c.input.date===date&&c.path.includes('/templates/')),a=captures.find(c=>c.input.date===date&&c.path.includes('/assignments/')&&c.method==='GET');
  const state=stateFor(date),model=await composeTypika(t.body,a.body,state,full.body);assert.equal(model.complete,false);
  const callbacks=[],wire=async(url,options)=>{const c=url.pathname.includes('/templates/')?t:a;assert.equal(url.pathname,c.path);assert.deepEqual(Object.fromEntries(url.searchParams),Object.fromEntries(Object.entries(c.input).map(([k,v])=>[k,String(v)])));
   assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');return{status:c.status,headers:new Headers({'cache-control':c.headers['cache-control'].join(',')}),json:async()=>c.body};};
  const fetched=await fetchWorshipParts('https://offline.invalid',state,v=>callbacks.push(v),wire);assert.equal(callbacks.length,0);assert.deepEqual(fetched.entries,model.entries);
  const post=captures.find(c=>c.input.date===date&&c.method==='POST'&&c.status===200);assert.deepEqual(post.body.data.operations,a.body.data.operations);
  const pages=await readerCheck(model,state,true);mainRows.push({date,pages,blocks:full.body.data.blocks.length,conditionalOnly:true});
 }
 const verification=await read(join(stageDir,'verification.json'));
 for(const file of(await readdir(join(stageDir,'http'))).filter(f=>f.endsWith('-full.json'))){
  const date=file.slice(0,10),load=s=>read(join(stageDir,'http',date+'-'+s+'.json')),t=await load('template'),a=await load('assignments'),f=await load('full'),state=stateFor(date);
  const model=await composeTypika(t,a,state,f),expected=verification.full53.find(r=>r.date===date);assert.ok(expected);assert.equal(await partsHash(f.data.blocks),expected.bodyHash);
  await readerCheck(model,state);
  for(const change of[a=>a.context.date='1900-01-01',a=>a.wholeOfficeAccepted=true,a=>a.runtimeAdmissionGranted=true,a=>a.calendarServiceAppointed=true,
    a=>a.templateVersion='0'.repeat(64),a=>a.operations[0].blocks[0].segments[0].text+=' altered',a=>a.operations[0].nodeId='unknown']){
   const altered=structuredClone(a);change(altered.data);await assert.rejects(()=>composeTypika(t,altered,state,f));negative++;
  }
  rows.push({date,blocks:f.data.blocks.length,bodyHash:expected.bodyHash,conditionalOnly:true});
 }
 assert.equal(rows.length,53);assert.equal(mainRows.length,2);
 for(const c of captures.filter(c=>c.status!==200)){assert.equal(c.body.data?.blocks,undefined);assert.equal(c.body.data?.fragments,undefined);}
 const receipt={scope:'Actual installed main17 HTTP responses and canonical196 frozen53 bodies; no server/browser/network',backendCommit:'3385e5678a09596a053226cfdba6beec4fdf3d7b',indexSha256:sha(indexBytes),mainResponses:captures.length,mainCases:mainRows,cases:rows,negativeMutations:negative};
 await writeFile('tmp/typika-ui-replay-receipt.json',JSON.stringify(receipt,null,2)+'\n');console.info({mainResponses:captures.length,mainCases:mainRows.length,readerPrintPdfSnapshots:rows.length,pdfPages:mainRows.reduce((n,r)=>n+r.pages,0),negative});
}finally{restore();}
