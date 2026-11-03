import { partsHash } from './worship-hash.js';
export const BASIL_DAY_SECTION = 'ordinary-basil-day-choir-trisagion';
const ACTION = 'materialize-reviewed-conditional-at-parent-day-choice', GATE = 'day.basil-trisagion-ordinary-selection';
const digest = value => /^[a-f0-9]{64}$/.test(value || '');
const same = async (a,b) => await partsHash(a) === await partsHash(b);
/** Materialize exactly the immutable published child, once, only on its dated receipt. */
export async function basilDaySelection(assignments, template, state) {
  const receipts = assignments.verifiedSections || {}, receipt = receipts[BASIL_DAY_SECTION];
  const operations = assignments.operations.filter(operation => operation.sectionId === BASIL_DAY_SECTION);
  if (Object.keys(receipts).some(id => id !== BASIL_DAY_SECTION)) throw new Error('Unknown additional day section');
  if (!template.dayComponent) {
    if (receipt || operations.length) throw new Error('Unbound additional day section');
    return null;
  }
  const component = template.dayComponent;
  if (state.rite !== 'basil-great' || component.sectionId !== BASIL_DAY_SECTION || component.typedAction !== ACTION
    || component.sourceReviewHash !== template.sourceReviewVersion || !digest(component.sourceProofHash)
    || component.wholeLiturgyAccepted !== false || component.dateAppointmentApproved !== false
    || !digest(template.baseTemplateVersion) || !digest(template.basilDayReviewVersion)
    || assignments.baseTemplateVersion !== template.baseTemplateVersion || assignments.basilDayReviewVersion !== template.basilDayReviewVersion
    || receipt?.sectionId !== BASIL_DAY_SECTION || receipt.typedAction !== ACTION
    || ['wholeLiturgyAccepted','wholeDatedServiceAccepted','dateAppointmentApproved'].some(key => receipt[key] !== false)
    || !Array.isArray(receipt.operationIndexes)) throw new Error('Invalid Basil day receipt');
  if (receipt.status === 'held') {
    if (operations.length || receipt.operationIndexes.length || receipt.actualChoice !== null) throw new Error('Held Basil branch has operations');
    return null;
  }
  const node = template.nodes.find(node => node.slotId === GATE), child = template.conditionalTemplates[receipt.conditionalId];
  if (receipt.conditionalId !== 'choir-trisagion-or-replacement:ordinary-standard-trisagion' || receipt.status !== 'selected' || receipt.actualChoice !== 'ordinary-standard-trisagion' || receipt.resolvedRite !== state.rite
    || receipt.resolvedForm !== 'standalone' || receipt.issues?.length !== 0 || !digest(receipt.calendarHash)
    || receipt.sourceReviewHash !== component.sourceReviewHash || receipt.sourceProofHash !== component.sourceProofHash
    || receipt.baseTemplateVersion !== template.baseTemplateVersion || receipt.outerTemplateVersion !== template.templateVersion
    || !digest(receipt.sourceProfileHash) || !digest(receipt.conditionalObjectHash)
    || !node || node.kind !== 'slot' || node.contract?.category !== 'source-bound-day-choice'
    || node.contract.sourceBoundActualInputRequired !== true || node.contract.textMayBeInvented !== false || node.contract.allowedBranch !== receipt.actualChoice || !child || child.parentSlotId !== 'choir-trisagion-or-replacement'
    || child.choiceId !== receipt.actualChoice || child.conditionalOnly !== true || child.actualChoice !== null
    || child.actualRepeatCount !== null || child.fixedUnconditionalOccurrenceAllowed !== false
    || child.template.templateVersion !== receipt.conditionalTemplateVersion || child.assignments.templateVersion !== receipt.conditionalTemplateVersion
    || child.conditionalRequiredSlotIds?.length !== 0 || child.assignments.operations.length
    || child.template.nodes.some(node => node.kind !== 'fixed')
    || !await same(child.template.sourceVersions, template.sourceVersions)
    || receipt.gateNodeHash !== await partsHash(node) || receipt.inputContractHash !== await partsHash(node.contract)
    || receipt.requiredContractHash !== await partsHash(template.requiredContracts[GATE])
    || !await same(child.inputContracts[GATE], node.contract)) throw new Error('Invalid Basil source binding');
  const blocks = child.template.nodes.flatMap(node => node.blocks);
  const expectedIndexes = assignments.operations.flatMap((op,index) => op.sectionId === BASIL_DAY_SECTION ? [index] : []);
  if (operations.length !== 1 || !await same(expectedIndexes, receipt.operationIndexes)
    || operations[0].userInputHash !== undefined || operations[0].blockSources !== undefined
    || operations[0].type !== 'fill' || operations[0].nodeId !== node.nodeId || operations[0].slotId !== GATE
    || !await same(operations[0].blocks, blocks) || receipt.branchBlocksHash !== await partsHash(blocks)
    || child.assignments.composedBlocksHash !== receipt.branchBlocksHash
    || ['existingMainNodesUnchanged','existingFixedClergyLaneUnchanged','branchBlocksAlreadyRepeated','preserveBranchOccurrenceIds','preserveBranchRolesStylesVoicesAndSourcePieces','otherDayLocalActionContractsKept'].some(key => receipt.sourceFrame?.[key] !== true)
    || receipt.sourceFrame.parallelGroup !== 'trisagion' || receipt.sourceFrame.kinonikonWitnessFillAllowed !== false
    || receipt.sourceFrame?.renderSelectedBranchOnceAtGate !== true || receipt.sourceFrame.multiplyBranchBlocksAgain !== false
    || receipt.sourceFrame.conditionalPrototypeRemainsImmutable !== true || receipt.sourceFrame.exactSimultaneousTimingInferred !== false)
    throw new Error('Invalid Basil branch body');
  const ids = blocks.map(block => block.occurrenceId), mainIds = new Set(template.nodes.flatMap(node => (node.blocks || []).map(block => block.occurrenceId)));
  if (ids.some(id => typeof id !== 'string' || mainIds.has(id)) || new Set(ids).size !== ids.length) throw new Error('Basil branch occurrence collision');
  return { nodeId: node.nodeId, blocks, conditionalId: receipt.conditionalId };
}
