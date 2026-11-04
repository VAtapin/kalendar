// Exact two-node source component; never appoint a service or resolve a calendar.
import pins from './worship-office-mode-pins.js';
import proof from './worship-antiphon-pair-pins.js';
import {partsHash} from './worship-hash.js';
import {matchesWorshipContext} from './worship-context.js';
import {validateServiceMode} from './worship-office-mode.js';
export const PAIR_SECTION='ordinary-appointed-antiphons-1-2';
export const MODE_PAIR_SECTION='governing-mode-daily-antiphons-1-2';
const scope='two-ordinary-choir-antiphons-only';
const rules={[PAIR_SECTION]:'source-appointed-ordinary-antiphons-1-2-v2',[MODE_PAIR_SECTION]:'source-governing-mode-daily-antiphons-1-2-v1'};
const same=async(a,b)=>await partsHash(a)===await partsHash(b);
const withoutRule=b=>({...b,provenance:Object.fromEntries(Object.entries(b.provenance||{}).filter(([k])=>k!=='ruleReviewHash'))});
const acceptance={text:true,appointment:true,wholeLiturgyAccepted:false,churchExpertReview:false};

export async function validatePairTemplate(id,section,outer){
  const rule=rules[id],authority=id===PAIR_SECTION?proof.bundleHash:pins.capabilityHash;
  if(!rule||!section||section.schemaVersion!==1||section.templateId!=='liturgy:cu:'+id||section.ruleVersion!==rule
    ||section.templateVersion!==await partsHash([pins.words.hash,authority])||section.language!=='cu'||section.compositionReady!==true
    ||section.scope!==scope||['wholeLiturgyAccepted','wholeDatedServiceAccepted','dateAppointmentApproved'].some(k=>section[k]!==false)
    ||!await same(section.sourceVersions,Object.values(pins.words.sources))||!await same(section.nodes,pins.words.targets))return false;
  return !outer||section.nodes.every(target=>outer.nodes.some(node=>JSON.stringify(node)===JSON.stringify(target)));
}

async function parentSelection(s,state){
  if(!s||s.status!=='selected'||s.date!==state.date||s.weekday!==new Date(state.date+'T12:00:00Z').getUTCDay()
    ||!['typika','daily'].includes(s.variant))return null;
  const e=s.evidence;let evidence,authority=proof.parentHash,parentRuleReviewHash;
  if(s.basis==='ordinary-sunday-typikon21'&&s.weekday===0&&s.variant==='typika')evidence={sundayTypika:true};
  else if(s.basis==='appointed-vigil-polyeleos-doxology-typikon21'&&s.variant==='typika'
    &&typeof e?.calendarId==='string'&&/^memory-day-\d{4}$/.test(e.calendarId)&&[3,4,5].includes(e.actualTypeCode))
    evidence={calendarId:e.calendarId,actualTypeCode:e.actualTypeCode,actualRank:{3:'vigil',4:'polyeleos',5:'doxology'}[e.actualTypeCode]};
  else{
    const definitions={
      'positive-native-appointed-beatitudes-canon-song':{owners:proof.parentBeatitudes,variant:'typika'},
      'unchanged-bounded-reviewed-daily-owner-appointment':{owners:proof.parentDaily,variant:'daily'},
      'additional-positive-native-liturgy-kind':{owners:proof.deltaOwners,variant:'typika'},
    },definition=definitions[s.basis],owner=definition?.owners[e?.calendarId];
    if(!owner||s.variant!==definition.variant)return null;
    evidence={calendarId:e.calendarId,ownerEvidenceHash:owner.hash};
    if(s.basis==='additional-positive-native-liturgy-kind'){
      evidence.sourceKind=owner.sourceKind||'explicit-positive-native-office';authority=proof.deltaHash;parentRuleReviewHash=proof.parentHash;
    }
  }
  if(!evidence)return null;
  const expected={status:'selected',variant:s.variant,basis:s.basis,evidence,ruleReviewHash:authority,
    ...(parentRuleReviewHash?{parentRuleReviewHash}:{}),date:state.date,weekday:s.weekday,
    wholeLiturgyAccepted:false,wholeDatedServiceAccepted:false,dateAppointmentApproved:false,thirdAntiphonAccepted:false,
    missingWordsUsedAsAppointmentProof:false,issues:[]};
  return await same(s,expected)?authority:null;
}

async function modeSelection(receipt,state,assignments){
  const s=receipt.selection,global=assignments.serviceMode;
  if(!s||!global||assignments.ordinaryLiturgyAvailable!==true||receipt.ordinaryLiturgyAvailable!==true)return null;
  try{
    await validateServiceMode(global,state);
    await validateServiceMode(receipt.serviceMode,state,{calendarHash:global.contextBinding.calendarHash,oldStyleDate:global.contextBinding.oldStyleDate});
    // Preserve the native component's own family-preparation witness independently of the global request receipt.
    await validateServiceMode(s.serviceMode,{...state,officeMode:'auto'},
      {calendarHash:global.contextBinding.calendarHash,oldStyleDate:global.contextBinding.oldStyleDate});
  }catch{return null;}
  const owner=pins.owners[global.governingOwnerHash];
  if(!owner||global.selectedMode!=='god-is-lord'||s.serviceMode.selectedMode!=='god-is-lord'
    ||s.serviceMode.governingOwnerHash!==global.governingOwnerHash||!await same(receipt.serviceMode,global))return null;
  const expected={status:'selected',variant:'daily',serviceMode:s.serviceMode,ordinaryLiturgyAvailable:true,date:state.date,
    calendarOwner:owner.calendarOwner,actualDateAppointmentApproved:false,actualRectorElectionProved:false,
    wholeLiturgyAccepted:false,thirdAntiphonAccepted:false,issues:[]};
  return await same(s,expected)?pins.capabilityHash:null;
}

export async function antiphonPairReceipt(id,section,receipt,state,assignments){
  if(!await validatePairTemplate(id,section)||!receipt||receipt.profileStatus!==undefined
    ||state.office!=='liturgy'||(state.rite&&state.rite!=='john-chrysostom')||!['default','standalone'].includes(state.sequence)
    ||!matchesWorshipContext(assignments?.context,state)||assignments.context.language!=='cu'||assignments.context.tradition!=='russian-julian'
    ||receipt.status!=='complete'||receipt.scope!==scope||receipt.issues?.length!==0||receipt.missing?.length!==0
    ||!await same(receipt.acceptance,acceptance)||['wholeLiturgyAccepted','wholeDatedServiceAccepted','dateAppointmentApproved'].some(k=>receipt[k]!==false))return false;
  for(const k of ['schemaVersion','templateId','templateVersion','ruleVersion'])if(section[k]!==receipt[k])return false;
  if(receipt.templateSourcesHash!==await partsHash(section.sourceVersions))return false;
  const authority=id===PAIR_SECTION?await parentSelection(receipt.selection,state):await modeSelection(receipt,state,assignments);
  if(!authority)return false;
  const variant=receipt.selection.variant,recipes=pins.words.variants[variant]?.nodes,indexes=receipt.operationIndexes;
  const ops=assignments.operations.filter(o=>o.sectionId===id);
  if(!recipes||!Array.isArray(indexes)||indexes.length!==2||new Set(indexes).size!==2||ops.length!==2
    ||indexes.some((i,n)=>!Number.isInteger(i)||i<0||assignments.operations[i]!==ops[n]))return false;
  const blocks=ops.flatMap(o=>o.blocks||[]);
  if(blocks.length!==recipes.length||receipt.composedBlocksHash!==await partsHash(blocks))return false;
  for(let n=0;n<ops.length;n++){
    const op=ops[n],target=section.nodes[n];
    if(op.type!=='fill'||op.nodeId!==target.nodeId||op.slotId!==target.slotId||op.sectionTemplateVersion!==section.templateVersion
      ||!op.blocks.length||op.blocks.some(b=>b.section!==target.slotId))return false;
  }
  for(let n=0;n<blocks.length;n++){
    const b=blocks[n],r=recipes[n];
    if(b.provenance?.ruleReviewHash!==authority||await partsHash(withoutRule(b))!==proof.wordHashes[variant][n]
      ||b.slot!==r.nodeId||b.section!==r.section||b.role!=='choir'||b.repeatIndex!==1||b.repeatCount!==1)return false;
  }
  const used=new Set(recipes.map(r=>r.sourceKey));
  const expectedSources=Object.entries(pins.words.sources).filter(([k])=>used.has(k)).map(([,v])=>v);
  return same(receipt.sourceVersions,expectedSources);
}
