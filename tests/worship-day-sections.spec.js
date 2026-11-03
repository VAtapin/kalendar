import { fetchWorshipParts } from '../public/calendar-ui/worship-parts.js';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { captureWorshipPdf } from '../src/export/worship-pdf-browser';
import { create, installReaderPdfDocument } from './fixtures/reader-pdf-dom.mjs';
import { describe, expect, it, vi } from 'vitest';
import { basilDayFixture } from './fixtures/basil-day.mjs';
import { validateAdditionalTemplate, composeAdditionalAssignments } from '../public/calendar-ui/worship-additional-liturgy.js';
import { sourceComponentReceipt } from '../public/calendar-ui/worship-section-receipt.js';
import { partsHash } from '../public/calendar-ui/worship-hash.js';

describe('source-bound Liturgy day sections',()=>{
  it('shows and prints one selected branch while PDF retains source/user/missing boundaries',async()=>{
    const restore=installReaderPdfDocument();
    try {
      const f=await basilDayFixture({local:true}), result=await composeAdditionalAssignments(f.assignments,f.template,f.state,f.input), print=vi.fn();let snapshot;
      const reader=renderWorshipReader({state:f.state,create,formatDate:date=>date,onChange(){},onCalendar(){},onRetry(){},print,
        pdfLoad:async()=>({captureWorshipPdf,downloadWorshipPdf:async value=>{snapshot=value;}})});
      reader.render({...result,status:'parts',template:f.template,additionalFixed:true,assignmentsStatus:'partial',complete:false});
      expect(reader.page.querySelector('.worship-conditional').querySelectorAll('.worship-text')).toHaveLength(1);
      const body=reader.page.querySelector('.worship-text');
      await reader.page.querySelectorAll('button').find(button=>button.textContent==='Скачать PDF').events.click();
      expect(snapshot.blocks.filter(b=>b.origin==='user-provided')).toHaveLength(4);expect(snapshot.blocks.filter(b=>b.kind==='warning')).toHaveLength(1);
      const source=snapshot.blocks.map(b=>b.runs.map(r=>r.text).join(''));
      expect(source.filter(text=>text.includes('Го́споди, поми́луй.'))).toEqual(['Го́споди, поми́луй. г҃']);
      expect(source.some(text=>text.includes('Unselected variant'))).toBe(false);expect(snapshot.complete).toBe(false);
      await reader.page.querySelectorAll('button').find(button=>button.textContent==='Печать службы').events.click();
      expect(print).toHaveBeenCalledOnce();expect(reader.page.querySelector('.worship-text')).toBe(body);reader.dispose();
    } finally { restore(); }
  });

  it.each([false,true])('materializes only the selected immutable Basil child with local=%s',async local=>{
    const f=await basilDayFixture({local}), original=JSON.stringify(f.template.conditionalTemplates);
    await validateAdditionalTemplate(f.template,f.state);
    const result=await composeAdditionalAssignments(f.assignments,f.template,f.state,local?f.input:null);
    expect(result.dayValuesApplied).toBe(true);expect(result.localValuesApplied===true).toBe(local);
    expect(result.selectedConditionalIds).toEqual([f.conditionalId]);
    expect(result.entries.find(n=>n.nodeId==='day-gate').blocks).toEqual(f.child.template.nodes[0].blocks);
    expect(result.entries.filter(n=>n.missing)).toHaveLength(local?1:5);
    expect(JSON.stringify(f.template.conditionalTemplates)).toBe(original);
    expect(result.entries.filter(n=>n.userProvided)).toHaveLength(local?4:0);
  });
  it.each([false,true])('retains a held gate without inserting its prototype with local=%s',async local=>{
    const f=await basilDayFixture({selected:false,local});const result=await composeAdditionalAssignments(f.assignments,f.template,f.state,local?f.input:null);
    expect(result.dayValuesApplied).toBe(false);expect(result.entries.find(n=>n.nodeId==='day-gate').missing).toBe(true);
  });
  it('omits absent temple context and leaves the decorated Basil response held',async()=>{
    const f=await basilDayFixture({selected:false}), state={...f.state};delete state.temple;
    const result=await fetchWorshipParts('https://bible.example',state,()=>{},async url=>{
      if(url.pathname.includes('/assignments/'))expect(url.searchParams.has('temple')).toBe(false);
      return {status:200,json:async()=>({data:url.pathname.includes('/templates/')?f.template:f.assignments})};
    });
    expect(result.assignmentsStatus).toBe('partial');expect(result.dayValuesApplied).toBe(false);expect(result.entries.find(n=>n.nodeId==='day-gate').missing).toBe(true);
  });
  it.each(['body','gate','contract','child-version','outer-version','node','indexes','repeat','choice','admission','unknown','user-in-get','missing','digest','held-fill','user-index','user-authority'])('rejects altered %s evidence',async problem=>{
    const f=await basilDayFixture({local:problem.startsWith('user-')&&problem!=='user-in-get'}), a=f.assignments, r=f.receipt, op=a.operations.at(-1);
    if(problem==='body')op.blocks[0].segments[0].text='Forged words';
    if(problem==='gate')r.gateNodeHash='0'.repeat(64);
    if(problem==='contract')r.requiredContractHash='0'.repeat(64);
    if(problem==='child-version')r.conditionalTemplateVersion='0'.repeat(64);
    if(problem==='outer-version')r.outerTemplateVersion=f.template.baseTemplateVersion;
    if(problem==='node')op.nodeId='unknown';
    if(problem==='indexes')r.operationIndexes=[99];
    if(problem==='repeat')op.blocks.push(structuredClone(op.blocks[0]));
    if(problem==='choice')r.actualChoice='replacement';
    if(problem==='admission')r.wholeLiturgyAccepted=true;
    if(problem==='unknown')a.verifiedSections.other={};
    if(problem==='user-in-get')a.userSections={fake:{}};
    if(problem==='missing')a.missing=[];
    if(problem==='digest')a.composedBlocksHash='0'.repeat(64);
    if(problem==='held-fill')r.status='held';
    if(problem==='user-index')a.userSections['additional-clergy-user-values'].operationIndexes=[4,0,1,2];
    if(problem==='user-authority')a.localValues.currentAuthorityAttestation=true;
    await expect(composeAdditionalAssignments(a,f.template,f.state,problem.startsWith('user-')&&problem!=='user-in-get'?f.input:null)).rejects.toThrow();
  });
  it('requires context-bound source receipts, never treating any complete section as approval',async()=>{
    const id='general-ordinary-choir-trisagion', state={office:'liturgy',rite:'john-chrysostom',sequence:'default',date:'2026-01-01',temple:'nicholas'};
    const section={templateId:'liturgy:cu:'+id,templateVersion:'a'.repeat(64),ruleVersion:'general-ordinary-chrysostom-standalone-choir-trisagion-v1',scope:'one-ordinary-choir-component-only',compositionReady:true,wholeLiturgyAccepted:false,dateAppointmentApproved:false,sourceVersions:[{work:'fixture-source',edition:'fixture-cu',language:'cu',hash:'b'.repeat(64)}]};
    const r={status:'complete',scope:section.scope,wholeLiturgyAccepted:false,wholeDatedServiceAccepted:false,dateAppointmentApproved:false,issues:[],missing:[],sourceVersions:section.sourceVersions,sourceReviewVersion:section.templateVersion,
      context:{...state,language:'cu',calendarStyle:'julian',tradition:'russian-julian'},selection:{sourceClassId:section.ruleVersion,sourceProofHash:'b'.repeat(64),calendarHash:'c'.repeat(64),dateWhitelistUsed:false,resolvedRite:{id:'john-chrysostom',form:'standalone',status:'calculated',issues:[]}}};
    expect(await sourceComponentReceipt(id,section,r,state)).toBe(true);
    for(const change of [{context:{...r.context,date:'2026-01-02'}},{profileStatus:'unreviewed'},{acceptance:{status:'pending'}},{sourceVersions:[{work:'forged'}]},{wholeDatedServiceAccepted:true},{selection:{...r.selection,sourceClassId:'other'}}]) expect(await sourceComponentReceipt(id,section,{...r,...change},state)).toBe(false);
    expect(await sourceComponentReceipt('unknown',section,r,state)).toBe(false);expect(await partsHash(section.sourceVersions)).toMatch(/^[a-f0-9]{64}$/);
  });
});
