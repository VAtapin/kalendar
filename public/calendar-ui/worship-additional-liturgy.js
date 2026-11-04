import { basilDaySelection, BASIL_DAY_SECTION } from './worship-basil-day.js';
import { partsHash } from './worship-hash.js';
import { validWorshipDate } from './worship-context.js';
import { normalizeLocalClergyContext } from './worship-local-context.js';
import { applyAdditionalLocalValues } from './worship-local-values.js';

export const LITURGY_RITES = {
  'john-chrysostom': 'Литургия Иоанна Златоуста',
  'basil-great': 'Литургия Василия Великого',
  presanctified: 'Литургия Преждеосвященных Даров',
};
export const MID_LENT_BRANCHES = {
  'before-mid-lent-wednesday': 'До средопостной среды',
  'from-mid-lent-wednesday': 'Начиная со средопостной среды',
};
const admissionFlags = ['appointedForDate', 'wholeLiturgyAccepted', 'wholeDatedServiceAccepted', 'dateAppointmentApproved'];
export function isAdditionalLiturgy(state) {
  return state.office === 'liturgy' && state.rite && state.rite !== 'john-chrysostom';
}
export function readLiturgySelection(params, state) {
  state.rite = Object.hasOwn(LITURGY_RITES, params.get('rite')) ? params.get('rite') : 'john-chrysostom';
  state.midLentBranch = Object.hasOwn(MID_LENT_BRANCHES, params.get('midLentBranch')) ? params.get('midLentBranch') : '';
}
function selector(state) {
  if (!['basil-great', 'presanctified'].includes(state.rite)) throw new Error('Invalid Liturgy rite');
  if (state.rite === 'presanctified' && !Object.hasOwn(MID_LENT_BRANCHES, state.midLentBranch)) throw new Error('Missing Liturgy branch');
  return { language: 'cu', mode: 'fixed', rite: state.rite,
    ...(state.rite === 'presanctified' ? { midLentBranch: state.midLentBranch } : {}) };
}
function profileId(state) {
  return state.rite === 'basil-great' ? 'basil-ordinary' : 'presanctified-' + state.midLentBranch;
}
function fixedBlocks(nodes) { return nodes.filter(node => node.kind === 'fixed').flatMap(node => node.blocks); }
function validateNodes(nodes) {
  if (!Array.isArray(nodes) || !nodes.length) throw new Error('Missing fixed Liturgy nodes');
  const ids = new Set(), slots = [];
  for (const node of nodes) {
    if (typeof node?.nodeId !== 'string' || ids.has(node.nodeId)) throw new Error('Invalid fixed Liturgy node');
    ids.add(node.nodeId);
    if (node.kind === 'slot') {
      if (node.required !== true || typeof node.slotId !== 'string' || slots.includes(node.slotId)) throw new Error('Invalid required Liturgy slot');
      slots.push(node.slotId);
    } else if (node.kind !== 'fixed' || (node.language && node.language !== 'cu') || !Array.isArray(node.blocks) || !node.blocks.length
      || node.blocks.some(block => !Array.isArray(block.segments) || !block.segments.length
        || block.segments.some(segment => typeof segment.text !== 'string'))) throw new Error('Invalid fixed Liturgy words');
  }
  return slots;
}
export async function validateAdditionalTemplate(template, state) {
  const selected = selector(state);
  if (template?.schemaVersion !== 1 || template.artifactType !== 'source-bound-template' || template.status !== 'fixed-template'
    || template.language !== 'cu' || template.orthography !== 'traditional' || template.rite !== selected.rite
    || (template.midLentBranch ?? null) !== (selected.midLentBranch ?? null) || template.profile?.id !== profileId(state)
    || template.profile.priestCount !== 1 || template.profile.deaconCount !== 1
    || template.templateId !== 'liturgy:cu:own-fixed:' + profileId(state) || !/^[a-f0-9]{64}$/.test(template.templateVersion || '')
    || template.ruleVersion !== 'own-native-cu-fixed-v1' || template.sourceScope !== 'own-fixed-template-only'
    || template.cleanTemplate !== true || template.fixedWordsComplete !== true || template.compositionReady !== false
    || template.dateDependent !== false || admissionFlags.some(key => template[key] !== false)
    || template.completeness?.fixedWords !== true || template.completeness.appointment !== false || template.completeness.composition !== false
    || !Array.isArray(template.sourceVersions) || !template.sourceVersions.length
    || template.sourceVersions.some(source => source.language !== 'cu' || typeof source.work !== 'string'
      || typeof source.edition !== 'string' || !/^[a-f0-9]{64}$/.test(source.hash || ''))) throw new Error('Invalid additional Liturgy template');
  const slots = validateNodes(template.nodes);
  if (!slots.length || await partsHash(slots) !== await partsHash(template.requiredAssignments)
    || !template.requiredContracts || typeof template.requiredContracts !== 'object'
    || slots.some(id => !template.requiredContracts[id] || typeof template.requiredContracts[id] !== 'object'
      || (template.requiredContracts[id].slotId !== undefined && template.requiredContracts[id].slotId !== id))
    || Object.keys(template.requiredContracts).length !== slots.length) throw new Error('Missing Liturgy contracts');
  const blocks = fixedBlocks(template.nodes);
  if (blocks.length !== template.fixedBlockCount || await partsHash(blocks) !== template.fixedBlocksHash) throw new Error('Fixed Liturgy digest mismatch');
  if (!template.conditionalTemplates || typeof template.conditionalTemplates !== 'object') throw new Error('Missing conditional Liturgy templates');
  for (const variant of Object.values(template.conditionalTemplates)) {
    if (variant.conditionalOnly !== true || variant.fixedUnconditionalOccurrenceAllowed !== false
      || variant.actualChoice !== null || variant.actualRepeatCount !== null || typeof variant.parentSlotId !== 'string'
      || !Array.isArray(variant.template?.nodes)) throw new Error('Unconfirmed conditional Liturgy choice');
    const conditionalSlots = validateNodes(variant.template.nodes);
    const assignments = variant.assignments;
    if (!assignments || !Array.isArray(assignments.operations) || assignments.operations.length
      || await partsHash(assignments.missing) !== await partsHash(conditionalSlots)
      || assignments.templateSourcesHash !== await partsHash(template.sourceVersions)
      || assignments.composedBlocksHash !== await partsHash(fixedBlocks(variant.template.nodes))) throw new Error('Conditional Liturgy digest mismatch');
  }
  return template;
}
export async function validateAdditionalAssignments(assignments, template, state) {
  for (const key of ['schemaVersion', 'templateId', 'templateVersion', 'ruleVersion']) {
    if (assignments?.[key] !== template[key]) throw new Error('Wrong additional Liturgy versions');
  }
  if (assignments.artifactType !== 'liturgy-assignments' || assignments.language !== 'cu' || assignments.status !== 'partial'
    || assignments.sourceScope !== 'own-fixed-template-only' || assignments.profileStatus !== 'not-confirmed-for-date'
    || assignments.rite !== state.rite || (assignments.midLentBranch ?? null) !== (state.rite === 'presanctified' ? state.midLentBranch : null)
    || assignments.requestedContext?.date !== state.date || assignments.requestedContext.rite !== state.rite
    || (assignments.requestedContext.midLentBranch ?? null) !== (state.rite === 'presanctified' ? state.midLentBranch : null)
    || admissionFlags.some(key => assignments[key] !== false) || assignments.completeness?.fixedWords !== true
    || assignments.completeness.appointment !== false || assignments.completeness.composition !== false
    || !Array.isArray(assignments.operations) || assignments.operations.length || assignments.blocks !== undefined
    || assignments.templateSourcesHash !== await partsHash(template.sourceVersions)
    || assignments.composedBlocksHash !== template.fixedBlocksHash
    || await partsHash(assignments.missing) !== await partsHash(template.requiredAssignments)
    || await partsHash(assignments.requiredContracts) !== await partsHash(template.requiredContracts)) throw new Error('Invalid additional Liturgy assignments');
}
/** Validate independent source and user lanes, then check the complete available extract. */
export async function composeAdditionalAssignments(assignments, template, state, localContext) {
  if (!Array.isArray(assignments?.operations)) throw new Error('Missing additional operations');
  await validateAdditionalAssignments({ ...assignments, operations: [], missing: template.requiredAssignments,
    composedBlocksHash: template.fixedBlocksHash }, template, state);
  const day = await basilDaySelection(assignments, template, state);
  const userSection = 'additional-clergy-user-values';
  if (assignments.operations.some(op => ![BASIL_DAY_SECTION, userSection].includes(op.sectionId))) throw new Error('Unknown additional operation');
  const userOperations = assignments.operations.filter(op => op.sectionId === userSection);
  let values = {}, entries = template.nodes.map(node => node.kind === 'slot'
    ? { ...node, missing: true, contract: template.requiredContracts[node.slotId] } : { ...node, language: 'cu' });
  if (localContext) {
    const indexes = assignments.operations.flatMap((op,index) => op.sectionId === userSection ? [index] : []);
    const receipt = assignments.userSections?.[userSection];
    if (!receipt || await partsHash(indexes) !== await partsHash(receipt.operationIndexes)) throw new Error('Wrong user operation indexes');
    const fills = new Map(userOperations.map(op => [op.nodeId,op]));
    const missing = template.requiredAssignments.filter(slot => !userOperations.some(op => op.slotId === slot));
    const blocks = template.nodes.flatMap(node => fills.get(node.nodeId)?.blocks || node.blocks || []);
    const userAssignments = { ...assignments, operations: userOperations, missing, composedBlocksHash: await partsHash(blocks),
      userSections: { ...assignments.userSections, [userSection]: { ...receipt, operationIndexes: userOperations.map((_,index) => index) } } };
    values = await applyAdditionalLocalValues(userAssignments, template, state, localContext); entries = values.entries;
  } else if (userOperations.length || assignments.userSections || assignments.localValues) throw new Error('Unrequested user values');
  if (day) entries = entries.map(node => node.nodeId === day.nodeId
    ? { ...node, kind: 'fixed', missing: false, blocks: day.blocks, language: 'cu', role: 'choir', section: BASIL_DAY_SECTION, parallelGroup: 'trisagion' } : node);
  const missing = entries.filter(node => node.missing).map(node => node.slotId);
  if (await partsHash(missing) !== await partsHash(assignments.missing)
    || await partsHash(entries.flatMap(node => node.blocks || [])) !== assignments.composedBlocksHash) throw new Error('Additional extract digest mismatch');
  return { ...values, entries, dayValuesApplied: !!day, selectedConditionalIds: day ? [day.conditionalId] : [] };
}
export async function fetchAdditionalLiturgy(state, onBase, request, signal, localContext, probeLocalContext = false, preparePrintedBook) {
  if (state.rite === 'presanctified' && !state.midLentBranch) return { status: 'context-required' };
  if (!['auto', 'cu'].includes(state.textLanguage || 'auto')) return { status: 'edition-unavailable' };
  if (!validWorshipDate(state.date)) throw new Error('Invalid worship date');
  const params = selector(state), template = await validateAdditionalTemplate(await request('templates', params), state);
  if (preparePrintedBook !== undefined) {
    if (typeof preparePrintedBook !== 'function' || state.rite !== 'presanctified') throw Error('Invalid printed source request');
    signal?.throwIfAborted(); return preparePrintedBook(template);
  }
  const base = { status: 'parts', template, additionalFixed: true, complete: false, outline: false, assignmentsStatus: 'loading',
    entries: template.nodes.map(node => node.kind === 'slot' ? { ...node, missing: true, contract: template.requiredContracts[node.slotId] }
      : { ...node, language: 'cu' }) };
  signal?.throwIfAborted(); onBase(base);
  try {
    if (localContext) {
      const normalized = normalizeLocalClergyContext(state, localContext);
      const assignments = await request('assignments', {}, { ...params, date: state.date, templateVersion: template.templateVersion,
        temple: normalized.templeProfileId, localContext: normalized });
      const values = await composeAdditionalAssignments(assignments, template, state, normalized);
      signal?.throwIfAborted();
      return { ...base, ...values, assignmentsStatus: 'partial', localContextAvailable: true };
    }
    const assignments = await request('assignments', { ...params, date: state.date, templateVersion: template.templateVersion,
      ...(template.dayComponent && state.temple ? { temple: state.temple } : {}) });
    const values = await composeAdditionalAssignments(assignments, template, state);
    signal?.throwIfAborted();
    let localContextAvailable = false;
    if (probeLocalContext) {
      try {
        localContextAvailable = await request('assignments', {}, { ...params, date: state.date, templateVersion: template.templateVersion,
          temple: state.temple, localContext: null }, true);
      } catch { signal?.throwIfAborted(); }
    }
    return { ...base, ...values, assignmentsStatus: 'partial', localContextAvailable };
  } catch {
    signal?.throwIfAborted(); return { ...base, assignmentsStatus: 'error' };
  }
}
