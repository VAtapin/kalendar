import{partsHash,textHash}from'./worship-hash.js';
import{validWorshipDate,worshipRequestSignal}from'./worship-context.js';
import{validateSourceUserLiteral}from'./worship-user-literal.js';
import{buildPreparedPresanctifiedPost,normalizePreparedLiturgyContext}from'./worship-presanctified-prepared-context.js';
import localPins from'./worship-prepared-local-pins.js';
import dayPins from'./worship-presanctified-day-pins.js';
const PROOF='706b213e987ca065ff8eda2f911f4ad89f5f1500b4f5e2df652827ff94cbeab3';
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)&&v!=='0'.repeat(64);
const same=async(a,b)=>await partsHash(a)===await partsHash(b);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&Object.keys(o).every(k=>keys.includes(k));
const at=(o,path)=>path.split('.').reduce((v,k)=>v?.[k],o);
function sourcePattern(operation){
 const pattern=structuredClone(operation);
 for(const b of pattern.blocks||[]){const p=b.provenance;
  for(const origin of p?.segmentOrigins||[])if(origin.origin==='user-provided'){
   b.segments[origin.segmentIndex]={field:origin.field};delete origin.inputHash;
  }
  if(p?.segmentOrigins?.some(o=>o.origin==='user-provided'))delete p.inputHash;
 }
 return pattern;
}
const templeProfiles={
 'george-victorious':{id:'george-victorious',kind:'saint',dedicationIds:['memory-day-0023'],patronalFeastIds:['memory-day-0023']},
 nicholas:{id:'nicholas',kind:'saint',dedicationIds:['memory-day-0033'],patronalFeastIds:['memory-day-0033']},
 transfiguration:{id:'transfiguration',kind:'lord',dedicationIds:['memory-day-0008'],patronalFeastIds:['memory-day-0008']},
 dormition:{id:'dormition',kind:'theotokos',dedicationIds:['memory-day-0009'],patronalFeastIds:['memory-day-0009']},
};
export function validatePreparedPresanctifiedProposal(body,request){
 const p=body?.preparedSourceProposal,c=p?.resolvedSourceContext;
 if(!exact(body,['error','issues','preparedSourceProposal'])||body.error!=='liturgy_parts_unavailable'
   ||JSON.stringify(body.issues)!==JSON.stringify([{code:'liturgy-template-presanctified-source-body-version-mismatch'}])
   ||!exact(p,['publicTemplateVersion','sourceBodyVersion','resolvedSourceContext'])||p.publicTemplateVersion!==request.templateVersion||!digest(p.sourceBodyVersion)
   ||!exact(c,['physicalDate','vespersMenaionOldStyleDate','positiveOwnershipProofHash'])||c.physicalDate!==request.date
   ||!validWorshipDate(c.vespersMenaionOldStyleDate)||c.positiveOwnershipProofHash!==PROOF)throw Error('Invalid prepared source version proposal');
 return structuredClone(p);
}
export async function preparedPresanctifiedVersion(request,data,context){
 const choices=request.preparedSourceChoices,selection=Object.fromEntries(Object.entries(choices).filter(([k])=>!['localForms','dismissalSaints','confirmedLiteralForms'].includes(k)));
 if(choices.dismissalSaints)selection.dismissalSaintIds=Object.fromEntries(Object.entries(choices.dismissalSaints).map(([k,v])=>[k,v.map(s=>s.identityId)]));
 const temple=templeProfiles[request.temple];if(!temple)throw Error('Unknown prepared temple identity');
 if(choices.dismissalSaints&&(!await same(selection.dismissalSaintIds.temple,temple.dedicationIds)||!await same(selection.dismissalSaintIds.day,data.appointment.selectedServiceIds)))throw Error('Changed prepared saint ownership');
 return partsHash({policy:'presanctified-prepared-source-body-v1',publicTemplateVersion:request.templateVersion,date:request.date,
   scope:'presanctified-'+request.midLentBranch,temple,selectedSourceDayIds:data.appointment.selectedServiceIds,
   sourceVersions:data.sourceTemplate.sourceVersions,resolvedSourceContext:context,typedSourceChoices:selection});
}
async function preparedLocalBlock(block,data,inputHash){
 const p=block.provenance,r=localPins.recipes[p?.recipeId];
 if(!r||p.sourceProofHash!==localPins.hash||p.private!==true||p.actualCurrentPeopleAsserted!==false||p.currentAuthorityAttestation!==false
   ||block.role!==r.role||block.kind!=='text'||block.slot!==p.recipeId||block.repeatIndex!==1||block.repeatCount!==1
   ||block.occurrenceId!=='additional-prepared-private-local-context:'+p.recipeId+':0:0:0'
   ||!Array.isArray(p.segmentOrigins)||p.segmentOrigins.length!==block.segments.length)throw Error('Invalid prepared local source recipe');
 let index=0;
 for(const piece of r.pieces){
  if(piece.input){const origin=p.segmentOrigins[index],segment=block.segments[index],literal=at(data,piece.input);
   if(typeof literal!=='string'||!await same(segment,{text:literal,style:'text'})||origin.segmentIndex!==index||origin.origin!=='user-provided'
     ||origin.field!==piece.input||origin.inputHash!==inputHash||origin.literalConfirmed!==true||origin.morphologyInferred!==false
     ||origin.sourceAttestation!==false||origin.currentAuthorityAttestation!==false)throw Error('Changed prepared local literal');index++;
  }else{
   const segments=block.segments.slice(index,index+piece.segmentsCount);
   if(await partsHash(segments)!==piece.segmentsHash)throw Error('Changed prepared local source words/style');
   for(let n=0;n<piece.segmentsCount;n++){const o=p.segmentOrigins[index+n];
    if(o.segmentIndex!==index+n||o.origin!=='source'||o.sourceKey!==piece.sourceKey||o.sourceBlock!==piece.block||o.rangeSegmentIndex!==n
      ||!await same(o.sourceIdentity,localPins.sourceVersions[piece.sourceKey])||!await same(o.sourceRange,piece.range))throw Error('Changed prepared local source range');
   }index+=piece.segmentsCount;
  }
 }
 if(index!==block.segments.length)throw Error('Unexpected prepared local words');
}
export async function composePreparedPresanctified(publicTemplate,body,state,request,proposal){
 const a=body?.data,t=a?.sourceTemplate,normalized=normalizePreparedLiturgyContext(request.localContext,state.temple),localHash=await partsHash(normalized);
 const context=proposal?.resolvedSourceContext||{physicalDate:request.date,vespersMenaionOldStyleDate:a?.appointment?.vespersMenaionDate,positiveOwnershipProofHash:PROOF};
 if(a?.schemaVersion!==1||a.artifactType!=='prepared-source-bound-service-book'||a.language!=='cu'||a.rite!=='presanctified'||a.status!=='complete'
   ||a.private!==true||a.printedBookTextComplete!==true||a.wholePreparedPrintedServiceAccepted!==true
   ||['wholeLiturgyAccepted','wholeDatedServiceAccepted','dateAppointmentApproved','actualPerformedSequenceConfirmed','actualLocalScheduleConfirmed','actualCurrentPeopleAsserted'].some(k=>a[k]!==false)
   ||a.localInputHash!==localHash||a.publicTemplateVersion!==publicTemplate.templateVersion||a.sourceBodyVersion!==request.sourceBodyVersion
   ||a.templateId!==publicTemplate.templateId||a.ruleVersion!==publicTemplate.ruleVersion
   ||a.templateVersion!==a.sourceBodyVersion||t?.templateVersion!==a.sourceBodyVersion||t.schemaVersion!==publicTemplate.schemaVersion
   ||!exact(t,['schemaVersion','templateId','templateVersion','ruleVersion','sourceVersions','nodes'])||a.appointment?.date!==state.date
   ||a.appointment.vespersMenaionDate!==context.vespersMenaionOldStyleDate||!digest(a.appointment.calendarHash)
   ||!Array.isArray(a.appointment.selectedServiceIds)||!Array.isArray(a.operations)||!Array.isArray(a.missing)||a.missing.length!==0
   ||!await same(t.nodes,publicTemplate.nodes)||t.templateId!==publicTemplate.templateId||t.ruleVersion!==publicTemplate.ruleVersion
   ||a.templateSourcesHash!==await partsHash(t.sourceVersions)||await preparedPresanctifiedVersion(request,a,context)!==a.sourceBodyVersion
   ||state.date!==dayPins.date||state.temple!==dayPins.temple||a.appointment.vespersMenaionDate!==dayPins.vespersMenaionDate
   ||!await same(a.appointment.selectedServiceIds,dayPins.selectedServiceIds)||a.templateSourcesHash!==dayPins.sourceVersionsHash
   ||await partsHash(a.printedPerformancePolicy)!==dayPins.printedPerformancePolicyHash)throw Error('Invalid complete prepared Presanctified contract');
 const localData={...normalized,localForms:request.preparedSourceChoices.localForms||[],anaphoraSaint:request.preparedSourceChoices.anaphoraSaint||[]};
 const preparedHash=await partsHash([localData,request.preparedSourceChoices]),choicesHash=await partsHash(request.preparedSourceChoices);
 const nodes=new Map(t.nodes.map(n=>[n.nodeId,n])),operations=new Map(),userIndexes=[];
 for(const[index,op]of a.operations.entries()){
  const node=nodes.get(op.nodeId);
  if(!node||node.kind!=='slot'||op.slotId!==node.slotId||operations.has(op.nodeId)||!['fill','remove'].includes(op.type)
    ||!['additional-clergy-user-values','additional-prepared-private-local-context','presanctified-prepared-source-day'].includes(op.sectionId))throw Error('Unknown prepared source operation');
  operations.set(op.nodeId,op);
  if(op.sectionId==='additional-clergy-user-values'){
   userIndexes.push(index);const role={'deacon-communion-name':'deacon','priest-communion-name':'celebrant'}[op.slotId],contract=publicTemplate.requiredContracts[op.slotId];
   const block=op.blocks?.[0],frame=block?.provenance?.sourceFrame,source=t.sourceVersions.find(s=>s.work===frame?.work&&s.edition===frame.edition);
   if(!role||op.type!=='fill'||op.blocks.length!==1||op.userInputHash!==localHash||op.sourceContractHash!==await partsHash(contract)||!source)throw Error('Unbound prepared communion name');
   if(!await same(op.blockSources,[{origin:'user-provided',inputHash:localHash,language:'cu',orthography:'traditional',sourceAttestation:false,currentAuthorityAttestation:false}]))throw Error('Changed prepared user source lane');
   await validateSourceUserLiteral(block,normalized.people[role]?.forms.nominative,'people.'+role+'.forms.nominative',localHash,source,contract,
     {grammaticalCase:'nominative',markerRange:frame.markerRange},'framed-marker',['И҆́мⷬ҇къ','и҆́мⷬ҇къ']);
  }
  if(op.sectionId==='additional-prepared-private-local-context'){
   if(op.preparedInputHash!==preparedHash||op.sourceProofHash!==localPins.hash||op.actualRitualExecutionWitnessed!==false
     ||op.sourceContractHash!==await partsHash(publicTemplate.requiredContracts[op.slotId]))throw Error('Stale prepared local choices');
   const recipes={
    'hierarchy-great-litany':'hierarchy-great-litany:'+normalized.people.diocesan?.rank,
    'hierarchy-augmented-litany':'hierarchy-augmented-litany:'+normalized.people.diocesan?.rank,
    'locality-great-litany':'locality-great-litany:'+request.preparedSourceChoices.locality,
    'departed-temple-or-monastery':'departed-temple-or-monastery:'+request.preparedSourceChoices.building,
    'living-temple-or-monastery':'living-temple-or-monastery:'+request.preparedSourceChoices.building,
   };
   if(Object.hasOwn(recipes,op.slotId)){
    if(op.type!=='fill'||op.blocks?.length!==1||op.blocks[0].provenance?.recipeId!==recipes[op.slotId])throw Error('Changed prepared local slot recipe');
   }else if(op.slotId==='presanctified-communion-action-witness'){
    if(op.type!=='remove'||op.blocks!==undefined||op.reason!=='prepared-source-order-only;actual-conduct-remains-unattested')throw Error('Unwitnessed communion action');
   }else if(op.slotId!=='presanctified-actual-vesting-invocations'||op.type!=='fill')throw Error('Unknown prepared local slot');
   if(op.slotId==='presanctified-actual-vesting-invocations'&&op.type==='fill'){
    const canonical=publicTemplate.conditionalTemplates['vesting-invocations:source-defined'].template.nodes.flatMap(n=>n.blocks||[]);
    const garments=request.preparedSourceChoices.preparedGarments;
    if(canonical.length!==1||!Array.isArray(garments)||op.blocks?.length!==garments.length)throw Error('Unbound explicit prepared garments');
    for(const[i,b]of op.blocks.entries()){
     const{preparedGarmentId,actualGarmentWitnessed,...native}=b;
     if(preparedGarmentId!==garments[i]||actualGarmentWitnessed!==false||b.occurrenceId!==canonical[0].occurrenceId+':prepared-garment:'+i+':0:0'
       ||!await same({...native,occurrenceId:canonical[0].occurrenceId},canonical[0]))throw Error('Changed prepared garment invocation');
    }
   }else for(const b of op.blocks||[])await preparedLocalBlock(b,localData,preparedHash);
  }
  if(op.sectionId==='presanctified-prepared-source-day'
    &&await partsHash(sourcePattern(op))!==dayPins.operations[op.slotId])throw Error('Changed admitted prepared source-day operation');
  for(const b of op.blocks||[]){
   for(const origin of b.provenance?.segmentOrigins||[])if(origin.origin==='user-provided'&&origin.field?.startsWith('dismissalSaints.')){
    const literal=at(request.preparedSourceChoices,origin.field),identity=at(request.preparedSourceChoices,origin.field.replace(/\.genitive$/,'.identityId'));
    if(origin.inputHash!==choicesHash||origin.identityId!==identity||origin.literalConfirmed!==true||origin.morphologyInferred!==false
      ||origin.sourceAttestation!==false||origin.currentAuthorityAttestation!==false||b.segments[origin.segmentIndex]?.text!==literal)throw Error('Changed prepared dismissal literal/identity');
   }
  }
 }
 const receipt=a.userSections?.['additional-clergy-user-values'];
 if(!exact(a.userSections,['additional-clergy-user-values'])||!receipt||receipt.policyId!=='explicit-user-additional-clergy-communion-names-v1'||receipt.origin!=='user-provided'
   ||receipt.inputHash!==localHash||receipt.private!==true||receipt.literalConfirmed!==true||receipt.sourceAttestation!==false
   ||receipt.currentAuthorityAttestation!==false||!await same(receipt.operationIndexes,userIndexes))throw Error('Changed prepared communion receipt');
 const entries=[];
 for(const n of t.nodes){const op=operations.get(n.nodeId);if(op?.type==='remove')continue;const blocks=op?.blocks||n.blocks;
  if(!Array.isArray(blocks)||!blocks.length)throw Error('Unfilled prepared source slot');entries.push({...n,kind:'fixed',blocks,language:'cu',...(op?.type==='fill'&&n.kind==='slot'?{variableSlotId:n.slotId}:{})});
 }
 const blocks=entries.flatMap(e=>e.blocks);
 if(await partsHash(blocks)!==a.composedBlocksHash||!await same(blocks,a.blocks))throw Error('Changed prepared printed body');
 return{status:'parts',assignmentsStatus:'complete',complete:true,additionalFixed:false,preparedPrintedBook:true,entries,template:t,sourceVersions:t.sourceVersions,
   localValuesApplied:true,localTempleId:state.temple,localContextAvailable:true,preparedContract:a};
}
export async function fetchPreparedPresanctified(base,state,publicTemplate,input,choices,fetcher=fetch,signal,isCurrent=()=>true){
 const initial=buildPreparedPresanctifiedPost(state,publicTemplate.templateVersion,input,choices),requestSignal=worshipRequestSignal(signal);
 const url=new URL('/api/v1/liturgical/assignments/liturgy',base);
 const current=()=>{requestSignal.throwIfAborted();if(!isCurrent())throw new DOMException('Stale preparation','AbortError');};
 const post=async body=>{current();const response=await fetcher(url,{method:'POST',credentials:'omit',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body),signal:requestSignal});
  current();const cache=(response.headers?.get('cache-control')||'').toLowerCase().split(',').map(value=>value.trim());if(!cache.includes('private')||!cache.includes('no-store')||cache.includes('public'))throw Error('Invalid private preparation cache policy');
  return{status:response.status,body:await response.json()};};
 const first=await post(initial);
 if(first.status!==409)throw Error('Prepared discovery requires an explicit source version proposal');
 const proposal=validatePreparedPresanctifiedProposal(first.body,initial),retry={...initial,sourceBodyVersion:proposal.sourceBodyVersion};
 const next=await post(retry);if(next.status!==200)throw Error('Prepared source version retry failed');current();
 const result=await composePreparedPresanctified(publicTemplate,next.body,state,retry,proposal);current();
 return{...result,preparedSourceProposal:proposal};
}
