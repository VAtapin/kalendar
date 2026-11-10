import {partsHash} from './worship-hash.js';
import {normalizePreparedLiturgyContext} from './worship-presanctified-prepared-context.js';
import pins from './worship-artemy-pins.js';
const same=async(a,b)=>await partsHash(a)===await partsHash(b);
const at=(o,p)=>p.split('.').reduce((v,k)=>v?.[k],o);
const range=(s,r)=>[...s].slice(r.start,r.start+r.length).join('');
function scrub(value,localHash,manyHash){
 if(typeof value==='string')return value===localHash?'$localHash':value===manyHash?'$manyHash':value;
 if(Array.isArray(value))return value.map(x=>scrub(x,localHash,manyHash));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,scrub(v,localHash,manyHash)]));
 return value;
}
export function artemyOperationPattern(operation,localHash,manyHash){
 const op=structuredClone(operation);
 if(Array.isArray(op.blocks))op.blocks=op.blocks.map(block=>block.occurrenceId);
 return scrub(op,localHash,manyHash);
}
export function artemyBlockPattern(block,local,many,localHash,manyHash){
 const b=structuredClone(block),p=b.provenance||{};
 if(p.userInput){const u=p.userInput,literal=at(local,u.field);if(!literal||u.inputHash!==localHash||u.literalConfirmed!==true||u.morphologyInferred!==false||u.serviceSourceAttestation!==false||u.currentAuthorityAttestation!==false||b.segments.length!==1||b.segments[0].text!==literal)throw Error('Invalid local literal');b.segments[0].text='$'+u.field;}
 for(const origin of p.segmentOrigins||[])if(!p.userInput&&origin.origin==='user-provided'){
  const literal=at(local,origin.field),segment=b.segments[origin.segmentIndex];
  if(!literal||!segment||segment.text!==literal||origin.inputHash!==localHash||origin.morphologyInferred!==false||origin.sourceAttestation!==false||origin.currentAuthorityAttestation!==false)throw Error('Invalid source-child literal');
  segment.text='$'+origin.field;
 }
 if(Array.isArray(p.sourceParts)&&p.private===true&&p.targetCue){
  const users=p.sourceParts.filter(x=>x.origin==='user-provided');
  if(users.length!==3)throw Error('Invalid many-years source parts');
  for(const [i,segmentIndex]of [1,8,14].entries()){
   const u=users[i],source=i===0?local.people.primate.forms.accusative:many.diocesanTitledAccusative;
   if(u.inputHash!==manyHash||u.literalConfirmed!==true||u.morphologyInferred!==false||u.sourceAttestation!==false||u.currentAuthorityAttestation!==false||!u.literalRange||range(source,u.literalRange)!==b.segments[segmentIndex]?.text)throw Error('Invalid many-years literal');
   b.segments[segmentIndex].text='$many-'+i;u.literalRange='$literalRange';
  }
  const printed=block.segments.slice(8,15).map(s=>s.text).join('').replace(/\s*\/\s*/g,' ').replace(/\s+/g,' ').trim();
  if(printed!==many.diocesanTitledAccusative.replace(/\s+/g,' ').trim())throw Error('Changed many-years form');
 }
 return scrub(b,localHash,manyHash);
}
export async function composeArtemy(template,data,state,input,many){
 const local=normalizePreparedLiturgyContext(input,state.temple),localHash=await partsHash(local);
 const manyLocal=structuredClone(local);manyLocal.people.diocesan.forms.accusative=many.diocesanTitledAccusative;
 const manyHash=await partsHash(manyLocal),pin=pins[state.date];
 const clergy=data?.userSections?.['chrysostom-clergy-user-values'];
 const localVariants=data?.userSections?.['chrysostom-local-source-variants'];
 const manyReceipt=data?.userSections?.['source-bound-private-many-years'];
 const bridge=data?.sourceSections?.['first-native-evangelist-source-frame-bridge'];
 const saint=data?.sourceSections?.['appointed-artemy-source-name'];
 if(!pin||state.temple!=='george-victorious'||data?.schemaVersion!==1||data.artifactType!=='liturgy-assignments'
   ||data.language!=='cu'||data.orthography!=='traditional'||data.mode!=='fixed'
   ||data.templateId!==template.templateId||data.ruleVersion!==template.ruleVersion
   ||await partsHash(template)!==pin.templateHash
   ||data?.completePrintedPrepared!==true||data.status!=='complete'
   ||data.templateVersion!==template.templateVersion||data.templateVersion!==pin.templateVersion||data.context?.date!==state.date||data.context?.localInputHash!==localHash
   ||data.context?.templeProfile?.id!==state.temple||data.context?.office!=='liturgy'||data.context?.language!=='cu'
   ||manyReceipt?.manyYearsInputHash!==manyHash||manyReceipt.userInputHash!==manyHash||manyReceipt.private!==true||manyReceipt.status!=='complete-source-component'
   ||['wholeLiturgyAccepted','actualLocalConditionVerified','calendarServiceAppointed','currentAuthorityAttestation','sourceAttestationForUserNames','actualCountryConfirmed','actualLocalPerformanceConfirmed'].some(k=>manyReceipt[k]!==false)
   ||clergy?.inputHash!==localHash||clergy.origin!=='user-provided'||clergy.private!==true||clergy.literalConfirmed!==true||clergy.sourceAttestation!==false||clergy.currentAuthorityAttestation!==false
   ||localVariants?.inputHash!==localHash||localVariants.private!==true||localVariants.userNamesAreSourceAttestations!==false||localVariants.currentAuthorityAttestation!==false
   ||bridge?.originalOperationsUnchanged!==false||bridge.genericTextDeduplication!==false||bridge.extraJohnAnnouncementInvented!==false||bridge.gospelBodiesPreservedExactly!==true
   ||saint?.lexicalProofIsAppointment!==false||saint.privateUserInput!==false
   ||data.completeness?.appointment!==false||data.completeness?.composition!==true
   ||['wholeLiturgyAccepted','wholeDatedServiceAccepted','dateAppointmentApproved'].some(k=>data[k]!==false)
   ||['actualScheduleKnown','actualPerformedSequenceConfirmed','actualLocalPracticeConfirmed','currentAuthorityAttestation'].some(k=>data.printedPreparation?.[k]!==false)
   ||data.printedPreparation?.scope!=='source-selected-Artemy-George-ordinary-Chrysostom'
   ||data.printedPreparation?.sourceSelection?.status!=='selected'||data.printedPreparation.sourceSelection.date!==state.date
   ||data.printedPreparation.sourceSelection.variant!=='typika'
   ||['wholeLiturgyAccepted','wholeDatedServiceAccepted','dateAppointmentApproved','thirdAntiphonAccepted','missingWordsUsedAsAppointmentProof'].some(k=>data.printedPreparation.sourceSelection[k]!==false)
   ||!Array.isArray(data.sourceVersions)||data.sourceVersions.length!==pin.sources||await partsHash(data.sourceVersions)!==pin.sourceVersionsHash
   ||data.actualSourceUsage?.sourceCount!==pin.sources||data.actualSourceUsage.sourceVersionsHash!==pin.sourceVersionsHash||data.actualSourceUsage.capabilityCataloguesTraversed!==false
   ||await partsHash(data.sourceSections)!==pin.sourceSectionsHash
   ||data.templateSourcesHash!==await partsHash(template.sourceVersions)||!Array.isArray(data.blocks)||data.blocks.length!==pin.blocks.length
   ||!Array.isArray(data.operations)||new Set(data.operations.map(o=>o.nodeId)).size!==data.operations.length||!Array.isArray(data.missing)||data.missing.length!==0)throw Error('Invalid prepared printed Liturgy');
 if(data.operations.length!==pin.operations.length)throw Error('Changed prepared operation count');
 for(let i=0;i<data.operations.length;i++)if(await partsHash(artemyOperationPattern(data.operations[i],localHash,manyHash))!==pin.operations[i])throw Error('Changed prepared operation receipt');
 const sectionIds=['source-bound-private-many-years','chrysostom-clergy-user-values','chrysostom-local-source-variants','chrysostom-positive-censing'];
 if(Object.keys(data.userSections||{}).length!==sectionIds.length)throw Error('Unexpected prepared user sections');
 for(const id of sectionIds){const receipt=data.userSections[id],indexes=data.operations.flatMap((op,i)=>op.sectionId===id?[i]:[]);
  if(!receipt||!await same(receipt.operationIndexes,indexes))throw Error('Changed prepared user operation indexes');}
 if(clergy.blocksHash!==await partsHash(clergy.operationIndexes.flatMap(i=>data.operations[i].blocks)))throw Error('Changed private name blocks');
 for(let i=0;i<data.blocks.length;i++)if(await partsHash(artemyBlockPattern(data.blocks[i],local,many,localHash,manyHash))!==pin.blocks[i])throw Error('Changed prepared source block');
 const ops=new Map(data.operations.map(op=>[op.nodeId,op])),nodes=new Map(template.nodes.map(node=>[node.nodeId,node]));
 for(const op of data.operations){const node=nodes.get(op.nodeId);
  if(!node||!['fill','replace','remove'].includes(op.type)||(op.slotId??null)!==(node.slotId??null)
    ||(op.type==='fill'&&node.kind!=='slot')||(op.type==='replace'&&node.kind==='slot'))throw Error('Unbound prepared operation');
 }
 const entries=template.nodes.flatMap(node=>{const op=ops.get(node.nodeId);if(op?.type==='remove')return [];
  const blocks=op?.blocks||node.blocks;if(!Array.isArray(blocks)||!blocks.length)throw Error('Unfilled prepared slot');
  return [{...node,kind:'fixed',language:'cu',blocks,...(op?.type==='fill'&&node.kind==='slot'?{variableSlotId:node.slotId}:{})}];});
 const composed=entries.flatMap(entry=>entry.blocks);
 if(!await same(composed,data.blocks)||await partsHash(composed)!==data.composedBlocksHash)throw Error('Changed prepared composition');
 return {status:'parts',assignmentsStatus:'complete',complete:false,preparedPrintedBook:true,localValuesApplied:true,localTempleId:state.temple,
  template,entries,sourceVersions:data.sourceVersions,preparedContract:data};
}
