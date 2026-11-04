// Validate a declared source-permitted branch; never choose prayers or assert local practice.
import pins from './worship-office-mode-pins.js';
import {partsHash} from './worship-hash.js';
import {validWorshipDate} from './worship-context.js';
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)&&v!=='0'.repeat(64);
const same=async(a,b)=>await partsHash(a)===await partsHash(b);
export const OFFICE_MODE_LABELS={auto:'По правилу подготовки','god-is-lord':'«Бог Господь»',alleluia:'«Аллилуия»'};
export function requestedOfficeMode(state){
  const mode=Object.hasOwn(state,'officeMode')?state.officeMode:'auto';
  if(!Object.hasOwn(OFFICE_MODE_LABELS,mode))throw Error('Invalid typed office mode');
  if(state.office!=='liturgy'||(state.rite&&state.rite!=='john-chrysostom')||!['auto','cu',undefined].includes(state.textLanguage)
    ||!['default','standalone'].includes(state.sequence)||!validWorshipDate(state.date)||!pins.templeHashes[state.temple])throw Error('Office mode requires the selected traditional fixed Liturgy');
  return mode;
}
export function officeModeIdentity(state){
  return JSON.stringify([state.date,state.office,state.rite||'john-chrysostom',state.temple,state.sequence,state.textLanguage||'auto',requestedOfficeMode(state)]);
}
export async function validateServiceMode(receipt,state,expectedContext={}){
  const requested=requestedOfficeMode(state),b=receipt?.contextBinding;
  if(!receipt||!['god-is-lord','alleluia'].includes(receipt.selectedMode)||receipt.ruleHash!==pins.capabilityHash||!b
    ||b.date!==state.date||!validWorshipDate(b.oldStyleDate)
    ||!digest(b.calendarHash)||b.templeContextHash!==pins.templeHashes[state.temple]
    ||(expectedContext.calendarHash!==undefined&&b.calendarHash!==expectedContext.calendarHash)
    ||(expectedContext.oldStyleDate!==undefined&&b.oldStyleDate!==expectedContext.oldStyleDate))throw Error('Invalid office-mode context/source binding');
  // This is an envelope consistency bound, not a client calendar or service resolver.
  const distance=(Date.parse(state.date+'T12:00:00Z')-Date.parse(b.oldStyleDate+'T12:00:00Z'))/86400000;
  if(!Number.isFinite(distance)||distance<0||distance>16)throw Error('Office-mode date coordinates conflict');
  const forced=receipt.selectionKind==='source-forced-variant';
  const owner=forced?pins.forced:pins.owners[receipt.governingOwnerHash];
  if(!owner||b.oldStyleDate.slice(5)!==owner.monthDay)throw Error('Unknown office-mode governing owner');
  const permitted=forced?['alleluia']:owner.modes;
  const basis=receipt.selectionBasis;
  if(forced){
    if(receipt.governingOwnerHash!==pins.forced.hash||basis!=='governing-forced-initial-fast-rule'||receipt.selectedMode!=='alleluia')throw Error('Invalid forced office-mode declaration');
  }else{
    if(receipt.selectionKind!=='software-selected-permitted-variant'||!['requested-liturgy','explicit-office-mode-request','consistent-known-office-context'].includes(basis)
      ||(requested!=='auto'&&(basis!=='explicit-office-mode-request'||receipt.selectedMode!==requested))
      ||(requested==='auto'&&basis==='explicit-office-mode-request')
      ||(basis==='requested-liturgy'&&(!owner.softwareGodLordDefault||receipt.selectedMode!=='god-is-lord')))throw Error('Unbound office-mode preparation choice');
  }
  if(!permitted.includes(receipt.selectedMode))throw Error('Unreviewed office-mode alternative');
  const expected={selectedMode:receipt.selectedMode,selectionKind:receipt.selectionKind,selectionBasis:basis,
    contextBinding:{date:state.date,oldStyleDate:b.oldStyleDate,calendarHash:b.calendarHash,templeContextHash:pins.templeHashes[state.temple],
      officeFamilyScope:basis==='consistent-known-office-context'?'consistent-service-family-preparation':'single-requested-liturgy'},
    permittedModes:permitted,assumptions:forced?[]:[{code:'permitted-office-branch-selected-for-preparation',kind:'application-policy'}],
    actualRectorElectionProved:false,actualRectorBlessingClaimed:false,localConfirmationAssumed:false,actualDateAppointmentApproved:false,
    governingOwnerHash:receipt.governingOwnerHash,ruleHash:pins.capabilityHash,
    alternatives:permitted.filter(mode=>mode!==receipt.selectedMode).map(mode=>({mode,ordinaryLiturgyAvailable:mode==='god-is-lord'}))};
  if(!await same(receipt,expected))throw Error('Changed office-mode alternatives, assumptions or factual flags');
  return receipt; // Preserve the complete original structured declaration, not a normalized permission flag.
}
export async function officeModeUnavailable(body,state){
  const d=body?.data;
  const optionalFalse=['actualRectorBlessingClaimed','localConfirmationAssumed','dateAppointmentApproved','wholeDatedServiceAccepted',
    'thirdAntiphonAccepted','publicAdmissionGranted','runtimeAdmissionGranted','actualLocalConfirmationProved'];
  const allowed=['status','operations','blocks','sections','serviceMode','ordinaryLiturgyAvailable','issues',
    'actualDateAppointmentApproved','actualRectorElectionProved','wholeLiturgyAccepted',...optionalFalse];
  if(body?.error!=='liturgy_parts_unavailable'||d?.status!=='unavailable'||d.ordinaryLiturgyAvailable!==false
    ||Object.keys(d).some(k=>!allowed.includes(k))
    ||['operations','blocks','sections'].some(k=>!Array.isArray(d[k])||d[k].length)
    ||!Array.isArray(d.issues)||!d.issues.length||d.issues.some(i=>!i||Object.keys(i).length!==1||typeof i.code!=='string'||!/^[-a-z0-9]+$/.test(i.code))
    ||['actualDateAppointmentApproved','actualRectorElectionProved','wholeLiturgyAccepted'].some(k=>d[k]!==false)
    ||optionalFalse.some(k=>Object.hasOwn(d,k)&&d[k]!==false))throw Error('Ordinary text or approval in unavailable office-mode response');
  const serviceMode=d.serviceMode===null?null:await validateServiceMode(d.serviceMode,state);
  if(serviceMode&&serviceMode.selectedMode!=='alleluia')throw Error('Unavailable response contradicts its prepared mode');
  return{status:'office-mode-unavailable',serviceMode,ordinaryLiturgyAvailable:false,modeContract:d};
}
