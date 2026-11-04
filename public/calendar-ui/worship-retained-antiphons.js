// Preserve an existing complete four-component parent without granting it generic approval.
import pins from'./worship-office-mode-pins.js';
import proof from'./worship-retained-antiphon-pins.js';
import{partsHash}from'./worship-hash.js';
import{validateServiceMode}from'./worship-office-mode.js';
export async function retainedAntiphonsReceipt(section,receipt,state,assignments){
  if(await partsHash(section)!==proof.sectionHash||!receipt||receipt.status!=='complete'||receipt.profileStatus!=='confirmed-for-fragment'
    ||receipt.scope!=='four-ordinary-propers-only'||receipt.missing?.length!==0
    ||['wholeLiturgyAccepted','wholeDatedServiceAccepted','dateAppointmentApproved','appointedForDate'].some(k=>receipt[k]===true)
    ||await partsHash(receipt.acceptance)!==await partsHash({text:true,appointment:true,wholeLiturgyAccepted:false,churchExpertReview:false}))return false;
  const mode=assignments.serviceMode,owner=pins.owners[mode?.governingOwnerHash];
  if(!owner||mode.selectedMode!=='god-is-lord'||assignments.ordinaryLiturgyAvailable!==true
    ||await partsHash(receipt.serviceMode)!==await partsHash(mode))return false;
  try{await validateServiceMode(mode,state);}catch{return false;}
  const selection={memory:owner.calendarOwner,weekday:new Date(state.date+'T12:00:00Z').getUTCDay(),temple:assignments.context.templeProfile};
  if(await partsHash(selection)!==await partsHash(receipt.selection)||await partsHash(selection.temple)!==pins.templeHashes[state.temple])return false;
  const ops=assignments.operations.filter(o=>o.sectionId==='ordinary-antiphons-and-entrance');
  if(ops.length!==4||!Array.isArray(receipt.operationIndexes)||receipt.operationIndexes.length!==4
    ||new Set(receipt.operationIndexes).size!==4||receipt.operationIndexes.some((i,n)=>!Number.isInteger(i)||i<0||assignments.operations[i]!==ops[n]))return false;
  const hash=await partsHash(ops.flatMap(o=>o.blocks));
  return hash===receipt.composedBlocksHash&&proof.compiledHashes.includes(hash);
}
