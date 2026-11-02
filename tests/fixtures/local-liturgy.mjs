import { additionalLiturgy } from './additional-liturgy.mjs';
import { partsHash, textHash } from '../../public/calendar-ui/worship-hash.js';
import { normalizeLocalClergyContext } from '../../public/calendar-ui/worship-local-context.js';

export async function localLiturgy(rite = 'basil-great', branch) {
  const { state, template, assignments } = additionalLiturgy(rite, branch);
  const basil = rite === 'basil-great', policy = 'explicit-user-additional-clergy-communion-names-v1', sectionId = 'additional-clergy-user-values';
  const target = basil ? [['shared-communion:476:0', 'deacon', 'dative'], ['shared-communion:489:1', 'celebrant', 'dative'],
    ['shared-communion:495:1', 'celebrant', 'nominative'], ['shared-communion:503:1', 'deacon', 'nominative']]
    : [['deacon-communion-name', 'deacon', 'nominative'], ['priest-communion-name', 'celebrant', 'nominative']];
  const input = normalizeLocalClergyContext(state, { schemaVersion: 1, confirmedLiteralForms: true, templeProfileId: 'nicholas', people: {
    celebrant: { forms: { nominative: 'Те́стовый', ...(basil ? { dative: 'Те́стовому' } : {}) } },
    deacon: { forms: { nominative: 'Те́стъ', ...(basil ? { dative: 'Те́сту' } : {}) } },
  } });
  const hash = await partsHash(input), source = template.sourceVersions[0]; source.sourceHash = 'c'.repeat(64);
  template.sourceReviewVersion = 'f'.repeat(64); template.requiredContracts = { day: { slotId: 'day', category: 'day-appointment-or-explicit-choice' } };
  template.nodes = [template.nodes[0], { nodeId: 'day', slotId: 'day', kind: 'slot', required: true }];
  const bindings = {};
  assignments.operations = [];
  for (const [slotId, person, grammaticalCase] of target) {
    const marker = 'И҆́мⷬ҇къ', prefix = basil ? '' : 'Слова источника ', suffix = basil ? '' : ' окончание';
    const original = prefix + marker + suffix, originalBlock = { kind: 'text', segments: [{ text: original, style: 'text' }] };
    const originalHash = await partsHash(originalBlock), start = [...prefix].length;
    const range = { start: 0, length: [...original].length, sourceBlockHash: originalHash, textSha256: await textHash(original) };
    const markerRange = { start, length: [...marker].length, sourceBlockHash: originalHash, textSha256: await textHash(marker) };
    const contract = { role: 'priest', sourceBlock: 0, sourceRange: range };
    template.requiredContracts[slotId] = contract;
    const node = { nodeId: slotId, slotId, kind: 'slot', required: true }; template.nodes.push(node);
    const binding = { nodeId: slotId, contractHash: await partsHash(contract), sourceNodeHash: await partsHash(node), person, grammaticalCase,
      sourceKey: source.work + ':' + source.edition, sourceBlock: 0, markerRange }; bindings[slotId] = binding;
    const field = 'people.' + person + '.forms.' + grammaticalCase, literal = input.people[person].forms[grammaticalCase];
    const user = { origin: 'user-provided', inputHash: hash, field, grammaticalCase, literalConfirmed: true, morphologyInferred: false,
      serviceSourceAttestation: false, currentAuthorityAttestation: false };
    const pieces = basil ? [] : [{ ...range, length: [...prefix].length, textSha256: await textHash(prefix) },
      { ...range, start: start + [...marker].length, length: [...suffix].length, textSha256: await textHash(suffix) }];
    const segments = basil ? [{ text: literal, style: 'text' }] : [{ text: prefix, style: 'text' }, { text: literal, style: 'text' }, { text: suffix, style: 'text' }];
    const origins = basil ? [{ segmentIndex: 0, origin: 'user-provided', field, inputHash: hash }]
      : [{ segmentIndex: 0, origin: 'source', sourceRange: pieces[0], rangeSegmentIndex: 0 }, { segmentIndex: 1, origin: 'user-provided', field, inputHash: hash }, { segmentIndex: 2, origin: 'source', sourceRange: pieces[1], rangeSegmentIndex: 0 }];
    const block = { kind: 'text', role: 'priest', segments, provenance: { userInput: user,
      sourceFrame: { ...source, bodyHash: source.hash, block: 0, sourceRange: range, markerRange }, sourcePieces: pieces, segmentOrigins: origins } };
    assignments.operations.push({ type: 'fill', nodeId: slotId, slotId, sectionId, userInputHash: hash, sourceContractHash: binding.contractHash,
      blocks: [block], blockSources: [{ origin: 'user-provided', inputHash: hash, language: 'cu', orthography: 'traditional', sourceAttestation: false, currentAuthorityAttestation: false }] });
  }
  template.requiredAssignments = template.nodes.filter(node => node.kind === 'slot').map(node => node.slotId);
  assignments.requiredContracts = structuredClone(template.requiredContracts); assignments.missing = ['day'];
  assignments.templateSourcesHash = await partsHash(template.sourceVersions);
  for (const conditional of Object.values(template.conditionalTemplates)) conditional.assignments.templateSourcesHash = assignments.templateSourcesHash;
  assignments.composedBlocksHash = await partsHash([...template.nodes[0].blocks, ...assignments.operations.flatMap(op => op.blocks)]);
  assignments.userSections = { [sectionId]: { policyId: policy, inputHash: hash, origin: 'user-provided', operationIndexes: assignments.operations.map((_, index) => index), literalConfirmed: true, private: true, sourceAttestation: false, currentAuthorityAttestation: false } };
  assignments.localValues = { userValuePolicy: policy, sourceReviewHash: template.sourceReviewVersion, inputHash: hash, origin: 'user-provided', private: true,
    morphologyInferred: false, sourceAttestation: false, currentAuthorityAttestation: false, actualCurrentPeopleAsserted: false,
    wholeLiturgyAccepted: false, wholeDatedServiceAccepted: false, dateAppointmentApproved: false, runtimeAdmissionGranted: false, publicAdmissionGranted: false, userValueContracts: bindings };
  return { state, template, assignments, input };
}
