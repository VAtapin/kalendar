import { validateSourceUserLiteral } from './worship-user-literal.js';
import { partsHash } from './worship-hash.js';
import { normalizeLocalClergyContext } from './worship-local-context.js';

const SECTION = 'additional-clergy-user-values', POLICY = 'explicit-user-additional-clergy-communion-names-v1';
function targets(state) {
  return state.rite === 'basil-great' ? {
    'shared-communion:476:0': ['deacon', 'dative'], 'shared-communion:489:1': ['celebrant', 'dative'],
    'shared-communion:495:1': ['celebrant', 'nominative'], 'shared-communion:503:1': ['deacon', 'nominative'],
  } : { 'deacon-communion-name': ['deacon', 'nominative'], 'priest-communion-name': ['celebrant', 'nominative'] };
}
async function same(a, b) { return await partsHash(a) === await partsHash(b); }

export async function applyAdditionalLocalValues(assignments, template, state, rawInput) {
  const input = normalizeLocalClergyContext(state, rawInput), hash = await partsHash(input);
  const section = assignments.userSections?.[SECTION], values = assignments.localValues;
  if (!section || Object.keys(assignments.userSections).length !== 1 || section.policyId !== POLICY || section.inputHash !== hash
    || section.origin !== 'user-provided' || section.literalConfirmed !== true || section.private !== true
    || section.sourceAttestation !== false || section.currentAuthorityAttestation !== false
    || values?.userValuePolicy !== POLICY || values.sourceReviewHash !== template.sourceReviewVersion
    || values.inputHash !== hash || values.origin !== 'user-provided' || values.private !== true
    || values.morphologyInferred !== false || values.sourceAttestation !== false || values.currentAuthorityAttestation !== false
    || values.actualCurrentPeopleAsserted !== false || values.wholeLiturgyAccepted !== false || values.wholeDatedServiceAccepted !== false
    || values.dateAppointmentApproved !== false || values.runtimeAdmissionGranted !== false || values.publicAdmissionGranted !== false
    || !Array.isArray(section.operationIndexes) || !await same(section.operationIndexes, assignments.operations.map((_, index) => index))) throw new Error('Invalid private user section');
  const allowed = targets(state), filled = new Map();
  for (const op of assignments.operations) {
    const target = allowed[op.slotId], node = template.nodes.find(item => item.nodeId === op.nodeId);
    const binding = values.userValueContracts?.[op.slotId], contract = template.requiredContracts[op.slotId];
    if (!target || !node || node.kind !== 'slot' || node.slotId !== op.slotId || filled.has(op.nodeId)
      || op.type !== 'fill' || op.sectionId !== SECTION || op.userInputHash !== hash || op.sourceContractHash !== await partsHash(contract)
      || binding?.nodeId !== node.nodeId || binding.contractHash !== op.sourceContractHash || binding.sourceNodeHash !== await partsHash(node)
      || binding.person !== target[0] || binding.grammaticalCase !== target[1] || !Array.isArray(op.blocks) || op.blocks.length !== 1
      || op.blocks[0].role !== contract.role || !Array.isArray(op.blockSources) || op.blockSources.length !== 1) throw new Error('Invalid local fill target');
    const supplied = input.people[target[0]]?.forms[target[1]], origin = op.blockSources[0];
    const source = template.sourceVersions.find(item => item.work + ':' + item.edition === binding.sourceKey);
    if (!supplied || !source || origin.origin !== 'user-provided' || origin.inputHash !== hash || origin.language !== 'cu'
      || origin.orthography !== 'traditional' || origin.sourceAttestation !== false || origin.currentAuthorityAttestation !== false
      || ['work', 'edition', 'hash'].some(key => key in origin)) throw new Error('Invalid local input identity');
    await validateSourceUserLiteral(op.blocks[0], supplied, 'people.' + target[0] + '.forms.' + target[1], hash, source, contract, binding,
      state.rite === 'basil-great' ? 'literal-only' : 'framed-marker', ['И҆́мⷬ҇къ', 'и҆́мⷬ҇къ']);
    filled.set(op.nodeId, op);
  }
  const expectedSlots = Object.entries(allowed).filter(([, [person, grammaticalCase]]) => input.people[person]?.forms[grammaticalCase]).map(([slot]) => slot);
  if (!expectedSlots.length || !await same([...filled.values()].map(op => op.slotId), expectedSlots)
    || !await same(assignments.missing, template.requiredAssignments.filter(slot => !expectedSlots.includes(slot)))) throw new Error('Wrong remaining local requirements');
  const entries = template.nodes.map(node => node.kind === 'fixed' ? { ...node, language: 'cu' }
    : filled.has(node.nodeId) ? { ...node, kind: 'fixed', blocks: filled.get(node.nodeId).blocks, language: 'cu', userProvided: true }
      : { ...node, missing: true, contract: template.requiredContracts[node.slotId] });
  if (await partsHash(entries.flatMap(entry => entry.blocks || [])) !== assignments.composedBlocksHash) throw new Error('Local composition digest mismatch');
  return { entries, localValuesApplied: true, localTempleId: input.templeProfileId, localFilledCount: filled.size };
}
