import { hash } from './worship-parts.mjs';
export function additionalLiturgy(rite = 'basil-great', branch) {
  const state = { date: '2026-11-02', office: 'liturgy', rite, midLentBranch: branch || '', textLanguage: 'cu', temple: 'nicholas', sequence: 'default', textSize: 22 };
  const id = rite === 'basil-great' ? 'basil-ordinary' : 'presanctified-' + branch;
  const blocks = [{ kind: 'text', role: 'priest', delivery: 'secret', occurrenceId: 'fixed-1', segments: [{ text: 'Fixed source words', style: 'text' }] }];
  const contracts = { day: { slotId: 'day', category: 'day-appointment-or-explicit-choice' }, local: { category: 'local-source-variant-or-name' } };
  const flags = { appointedForDate: false, wholeLiturgyAccepted: false, wholeDatedServiceAccepted: false, dateAppointmentApproved: false };
  const template = { schemaVersion: 1, artifactType: 'source-bound-template', status: 'fixed-template', language: 'cu', orthography: 'traditional',
    rite, midLentBranch: branch || null, profile: { id, priestCount: 1, deaconCount: 1 }, templateId: 'liturgy:cu:own-fixed:' + id,
    templateVersion: 'a'.repeat(64), ruleVersion: 'own-native-cu-fixed-v1', sourceScope: 'own-fixed-template-only',
    cleanTemplate: true, fixedWordsComplete: true, compositionReady: false, dateDependent: false, ...flags,
    completeness: { fixedWords: true, appointment: false, composition: false },
    sourceVersions: [{ work: 'fixture-source', edition: 'fixture-cu', language: 'cu', hash: 'b'.repeat(64) }],
    nodes: [{ nodeId: 'fixed', kind: 'fixed', blocks }, ...Object.keys(contracts).map(slotId => ({ nodeId: slotId, slotId, kind: 'slot', required: true }))],
    requiredAssignments: Object.keys(contracts), requiredContracts: contracts, fixedBlocksHash: hash(blocks), fixedBlockCount: blocks.length,
    conditionalTemplates: { choice: { conditionalOnly: true, fixedUnconditionalOccurrenceAllowed: false, actualChoice: null,
      actualRepeatCount: null, parentSlotId: 'conditional-parent', template: { nodes: [{ nodeId: 'variant', kind: 'fixed', blocks: [
        { kind: 'text', segments: [{ text: 'Unselected variant words', style: 'text' }] },
      ] }] } } } };
  const variant = template.conditionalTemplates.choice;
  variant.assignments = { operations: [], missing: [], templateSourcesHash: hash(template.sourceVersions), composedBlocksHash: hash(variant.template.nodes[0].blocks) };
  const assignments = { schemaVersion: 1, artifactType: 'liturgy-assignments', templateId: template.templateId,
    templateVersion: template.templateVersion, ruleVersion: template.ruleVersion, language: 'cu', rite, midLentBranch: branch || null,
    status: 'partial', sourceScope: template.sourceScope, profileStatus: 'not-confirmed-for-date', ...flags,
    completeness: { ...template.completeness }, requestedContext: { date: state.date, rite, midLentBranch: branch || null },
    operations: [], templateSourcesHash: hash(template.sourceVersions), composedBlocksHash: hash(blocks),
    missing: [...template.requiredAssignments], requiredContracts: structuredClone(contracts) };
  return { state, template, assignments };
}
