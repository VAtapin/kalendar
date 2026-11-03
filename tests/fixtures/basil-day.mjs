import { localLiturgy } from './local-liturgy.mjs';
import { partsHash } from '../../public/calendar-ui/worship-hash.js';
export async function basilDayFixture({ local = false, selected = true } = {}) {
  const f=await localLiturgy(), {template:t,assignments:a}=f;
  const slot='day.basil-trisagion-ordinary-selection', id='ordinary-basil-day-choir-trisagion';
  const contract={category:'source-bound-day-choice',sourceBoundActualInputRequired:true,slotId:slot,allowedBranch:'ordinary-standard-trisagion',textMayBeInvented:false};
  const node={kind:'slot',nodeId:'day-gate',slotId:slot,required:true,contract}; t.nodes.splice(1,0,node);
  t.requiredContracts[slot]=contract;t.requiredAssignments=t.nodes.filter(n=>n.kind==='slot').map(n=>n.slotId);
  t.baseTemplateVersion=t.templateVersion;t.templateVersion='d'.repeat(64);t.basilDayReviewVersion='e'.repeat(64);
  t.dayComponent={sectionId:id,typedAction:'materialize-reviewed-conditional-at-parent-day-choice',sourceReviewHash:t.sourceReviewVersion,sourceProofHash:'1'.repeat(64),wholeLiturgyAccepted:false,dateAppointmentApproved:false};
  const blocks=Array.from({length:3},(_,i)=>({kind:'text',role:'choir',occurrenceId:'branch:'+i,repeatIndex:i+1,repeatCount:3,segments:[{text:'Го́споди, поми́луй.'}]}));
  const child={parentSlotId:'choir-trisagion-or-replacement',choiceId:'ordinary-standard-trisagion',conditionalOnly:true,fixedUnconditionalOccurrenceAllowed:false,actualChoice:null,actualRepeatCount:null,conditionalRequiredSlotIds:[],
    inputContracts:{[slot]:contract},template:{templateVersion:'2'.repeat(64),sourceVersions:t.sourceVersions,nodes:[{kind:'fixed',nodeId:'branch',blocks}]},
    assignments:{templateVersion:'2'.repeat(64),operations:[],missing:[],templateSourcesHash:await partsHash(t.sourceVersions),composedBlocksHash:await partsHash(blocks)}};
  const conditionalId='choir-trisagion-or-replacement:ordinary-standard-trisagion';t.conditionalTemplates[conditionalId]=child;
  if(!local){a.operations=[];delete a.userSections;delete a.localValues;}
  Object.assign(a,{templateVersion:t.templateVersion,baseTemplateVersion:t.baseTemplateVersion,basilDayReviewVersion:t.basilDayReviewVersion,requiredContracts:structuredClone(t.requiredContracts)});
  const receipt={sectionId:id,typedAction:t.dayComponent.typedAction,status:selected?'selected':'held',actualChoice:selected?child.choiceId:null,operationIndexes:[],wholeLiturgyAccepted:false,wholeDatedServiceAccepted:false,dateAppointmentApproved:false};
  if(selected){receipt.operationIndexes=[a.operations.length];a.operations.push({type:'fill',nodeId:node.nodeId,slotId:slot,sectionId:id,blocks:structuredClone(blocks)});
    Object.assign(receipt,{resolvedRite:'basil-great',resolvedForm:'standalone',issues:[],calendarHash:'3'.repeat(64),sourceReviewHash:t.sourceReviewVersion,sourceProofHash:t.dayComponent.sourceProofHash,
      baseTemplateVersion:t.baseTemplateVersion,outerTemplateVersion:t.templateVersion,sourceProfileHash:'4'.repeat(64),conditionalObjectHash:await partsHash(child),conditionalId,
      conditionalTemplateVersion:child.template.templateVersion,gateNodeHash:await partsHash(node),inputContractHash:await partsHash(contract),requiredContractHash:await partsHash(t.requiredContracts[slot]),
      branchBlocksHash:await partsHash(blocks),sourceFrame:{existingMainNodesUnchanged:true,existingFixedClergyLaneUnchanged:true,branchBlocksAlreadyRepeated:true,preserveBranchOccurrenceIds:true,preserveBranchRolesStylesVoicesAndSourcePieces:true,otherDayLocalActionContractsKept:true,parallelGroup:'trisagion',kinonikonWitnessFillAllowed:false,renderSelectedBranchOnceAtGate:true,multiplyBranchBlocksAgain:false,conditionalPrototypeRemainsImmutable:true,exactSimultaneousTimingInferred:false}});}
  a.verifiedSections={[id]:receipt};const fills=new Map(a.operations.map(op=>[op.nodeId,op]));
  a.missing=t.nodes.filter(n=>n.kind==='slot'&&!fills.has(n.nodeId)).map(n=>n.slotId);
  a.composedBlocksHash=await partsHash(t.nodes.flatMap(n=>fills.get(n.nodeId)?.blocks||n.blocks||[]));
  return {...f,receipt,child,slot,conditionalId};
}
