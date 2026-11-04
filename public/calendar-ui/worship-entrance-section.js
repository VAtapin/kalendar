// Exact Entrance protocol extension. No resolver and no source-book words.
import pins from './worship-office-mode-pins.js';
import {partsHash} from './worship-hash.js';
import {matchesWorshipContext,validWorshipDate} from './worship-context.js';
const p=pins.entrance;
const same=async(a,b)=>await partsHash(a)===await partsHash(b);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)&&v!=='0'.repeat(64);
const oldContext={eligible:true,issues:[],appointmentApproved:false,saintAbsenceInferred:false};
const noNewFields=value=>!Object.hasOwn(value,'selectedEntranceMode')&&!Object.hasOwn(value,'sourceContextCapability')&&!Object.hasOwn(value,'contextCapability');

async function ordinaryContext(value,state,newTuple){
  if(await same(value,oldContext))return true; // Literal existing81 witness; no synthesized admission.
  if(!newTuple)return false;
  const a=value?.sourceModeAdmission;
  if(!a||!validWorshipDate(a.oldStyleDate)||!Number.isInteger(a.weekday)||a.weekday<1||a.weekday>5
    ||!Number.isInteger(a.daysFromPascha)||(a.daysFromPascha>=-70&&a.daysFromPascha<=56)
    ||!Array.isArray(a.principals)||!a.principals.length||a.principalCount!==a.principals.length)return false;
  const distance=(Date.parse(state.date+'T12:00:00Z')-Date.parse(a.oldStyleDate+'T12:00:00Z'))/86400000;
  if(!Number.isFinite(distance)||distance<0||distance>16||new Date(state.date+'T12:00:00Z').getUTCDay()!==a.weekday)return false;
  const seen=new Set();
  for(const principal of a.principals){
    const frame=p.positiveFrames[principal.calendarId];
    if(!frame||seen.has(principal.calendarId))return false;
    seen.add(principal.calendarId);
    const identities=frame.calendarIdentities.filter(i=>i.title===principal.title&&i.actualTypeCode===principal.actualTypeCode&&i.calendarMonthDay===a.oldStyleDate.slice(5));
    if(identities.length!==1||!await same(principal,{calendarId:principal.calendarId,actualTypeCode:identities[0].actualTypeCode,
      title:identities[0].title,properFrameHash:frame.properFrameHash,subjectKind:frame.subjectKind}))return false;
  }
  const expected={...oldContext,sourceModeAdmission:{capabilityHash:p.contextCapability,selectedEntranceMode:p.selectedEntranceMode,
    properFramesHash:p.properFramesHash,semanticContractHash:p.semanticContractHash,principals:a.principals,
    principalCount:a.principals.length,oldStyleDate:a.oldStyleDate,weekday:a.weekday,daysFromPascha:a.daysFromPascha,actualLocalPracticeClaimed:false}};
  return same(value,expected);
}

export async function entranceReceipt(section,receipt,state,assignments){
  const id='general-ordinary-entrance-verse',rule='general-ordinary-weekday-chrysostom-entrance-verse-v1',scope='one-ordinary-choir-component-only';
  if(!section||!receipt||receipt.acceptance!==undefined||receipt.profileStatus!==undefined
    ||state.office!=='liturgy'||!['default','standalone'].includes(state.sequence)||(state.rite&&state.rite!=='john-chrysostom')
    ||section.schemaVersion!==1||section.templateId!=='liturgy:cu:'+id||section.ruleVersion!==rule||section.language!=='cu'
    ||receipt.schemaVersion!==1||receipt.templateId!==section.templateId||receipt.templateVersion!==section.templateVersion||receipt.ruleVersion!==rule
    ||section.scope!==scope||receipt.scope!==scope||section.compositionReady!==true||receipt.status!=='complete'
    ||['wholeLiturgyAccepted','dateAppointmentApproved'].some(k=>section[k]!==false)
    ||['wholeLiturgyAccepted','wholeDatedServiceAccepted','dateAppointmentApproved'].some(k=>receipt[k]!==false)
    ||receipt.appointedForDate===true||receipt.issues?.length!==0||receipt.missing?.length!==0
    ||!matchesWorshipContext(receipt.context,state)||receipt.context.language!=='cu'||receipt.context.tradition!=='russian-julian'
    ||await partsHash(section.sourceVersions)!==p.sourceVersionsHash||await partsHash(receipt.sourceVersions)!==p.sourceVersionsHash
    ||receipt.templateSourcesHash!==p.sourceVersionsHash||await partsHash(section.nodes)!==p.targetNodesHash
    ||receipt.sourceReviewVersion!==p.nativeReview||await partsHash(receipt.sourceFrame)!==p.sourceFrameHash)return false;
  const modern=section.templateVersion===p.sectionTemplateVersion;
  if(modern){
    if(section.contextCapability!==p.contextCapability||receipt.sourceContextCapability!==p.contextCapability
      ||section.selectedEntranceMode!==p.selectedEntranceMode||receipt.selectedEntranceMode!==p.selectedEntranceMode
      ||Object.hasOwn(section,'sourceContextCapability')||Object.hasOwn(receipt,'contextCapability'))return false;
  }else if(section.templateVersion!==p.nativeReview||!noNewFields(section)||!noNewFields(receipt))return false;
  const s=receipt.selection,r=s?.resolvedRite;
  if(s?.sourceClassId!==rule||s.sourceProofHash!==p.sourceProofHash||!digest(s.calendarHash)||s.dateWhitelistUsed!==false
    ||r?.id!=='john-chrysostom'||r.form!=='standalone'||r.status!=='calculated'||r.issues?.length!==0
    ||!await ordinaryContext(s.ordinaryContext,state,modern))return false;
  const indexes=receipt.operationIndexes,ops=assignments?.operations?.filter(o=>o.sectionId===id);
  if(!Array.isArray(indexes)||indexes.length!==1||!Number.isInteger(indexes[0])||indexes[0]<0||ops?.length!==1
    ||assignments.operations[indexes[0]]!==ops[0])return false;
  const op=ops[0],target=section.nodes[0];
  return op.type==='fill'&&op.nodeId===target.nodeId&&op.slotId===target.slotId&&op.sectionTemplateVersion===section.templateVersion
    &&receipt.composedBlocksHash===p.nativeCompiledBlocksHash&&await partsHash(op.blocks)===p.nativeCompiledBlocksHash;
}
