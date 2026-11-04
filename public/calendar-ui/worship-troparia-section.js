import {validatePairTemplate,PAIR_SECTION,MODE_PAIR_SECTION} from './worship-antiphon-pair.js';
import { tropariaProtocol } from './worship-troparia-protocol.js';
import { partsHash, textHash } from './worship-hash.js';
import { matchesWorshipContext } from './worship-context.js';
export const TROPARIA_SECTION = 'general-ordinary-entrance-troparia-kontakia';
const TARGET = 'liturgy:cu:slot:troparia-kontakia';
const SCOPE = 'one-choir-troparia-kontakia-section-only';
const digest = value => /^[a-f0-9]{64}$/.test(value || '');
const same = async(a,b) => await partsHash(a) === await partsHash(b);
const sourceIdentity = (source, provenance) => source.work === provenance?.work && source.edition === provenance.edition && source.hash === provenance.bodyHash;
const validSource = source => source?.language === 'cu' && typeof source.work === 'string' && typeof source.edition === 'string' && digest(source.hash) && source.origin !== 'user-provided';
const legacySections = ['after-entrance-hymns','weekday-antiphons-and-entrance'];

/** Validate the extra version layer without overwriting the parent's baseTemplateVersion. */
export async function validateTropariaWrapper(template, assignments) {
  const section = template.sections?.[TROPARIA_SECTION];
  if (!section) {
    if (template.tropariaBaseTemplateVersion !== undefined || assignments.tropariaBaseTemplateVersion !== undefined) throw new Error('Unbound troparia wrapper');
    return;
  }
  const target = template.nodes.find(node => node.nodeId === TARGET), preserved = assignments.preservedLegacySections || {};
  const pair=template.sections[PAIR_SECTION],modePair=template.sections[MODE_PAIR_SECTION];
  const version={dayTemplateVersion:template.tropariaBaseTemplateVersion,tropariaSectionVersion:section.templateVersion};
  if(pair||modePair){
    if(!pair||!modePair||!await validatePairTemplate(PAIR_SECTION,pair,template)||!await validatePairTemplate(MODE_PAIR_SECTION,modePair,template))throw Error('Unbound two-antiphon wrapper');
    version.antiphons12SectionVersion=pair.templateVersion;version.governingModeSectionVersion=modePair.templateVersion;
  }
  if (template.status !== 'fixed-template' || !digest(template.tropariaBaseTemplateVersion) || !digest(template.baseTemplateVersion)
    || assignments.tropariaBaseTemplateVersion !== template.tropariaBaseTemplateVersion || assignments.baseTemplateVersion !== template.baseTemplateVersion
    || template.templateVersion !== await partsHash(version)
    || section.nodes?.length !== 1 || !target || !await same(section.nodes[0],target)
    || target.kind !== 'slot' || target.slotId !== 'troparia-kontakia' || target.role !== 'choir' || target.parallelGroup !== 'entrance-prayer'
    || assignments.status !== 'partial' || assignments.completeness?.appointment !== false || assignments.completeness.composition !== false
    || ['wholeLiturgyAccepted','wholeDatedServiceAccepted','dateAppointmentApproved'].some(key => assignments[key] !== false)
    || Object.keys(preserved).some(key => key !== TROPARIA_SECTION)) throw new Error('Invalid troparia wrapper');
  const fills = new Map();
  for (const operation of assignments.operations) {
    if (fills.has(operation.nodeId)) throw new Error('Duplicate troparia wrapper operation');
    fills.set(operation.nodeId,operation);
  }
  const expectedMissing = template.nodes.filter(node => node.kind === 'slot' && !fills.has(node.nodeId)).map(node => node.nodeId);
  if (!await same(expectedMissing,assignments.missing.map(item => item.nodeId))) throw new Error('Troparia wrapper missing mismatch');
  const operation = fills.get(TARGET), hasNewReceipt = !!assignments.verifiedSections?.[TROPARIA_SECTION];
  if (operation?.sectionId === TROPARIA_SECTION) {
    if (preserved[TROPARIA_SECTION] !== undefined || !hasNewReceipt) throw new Error('Duplicate troparia section');
  } else if (operation) {
    if (!legacySections.includes(operation.sectionId) || preserved[TROPARIA_SECTION] !== operation.sectionId || hasNewReceipt) throw new Error('Invalid legacy troparia preservation');
  } else if (preserved[TROPARIA_SECTION] !== undefined || hasNewReceipt) throw new Error('Held troparia section has a selection');
}

/** Accept only the returned order and its source identities; never derive hymns from dates. */
export async function tropariaReceipt(section, receipt, state, assignments) {
  const selection = receipt?.selection, parts = await tropariaProtocol(section,receipt,state);
  if (!parts) return false;
  const actualSix = ['ordinary-sourced-temple-after-entrance-v3','ordinary-sourced-temple-after-entrance-v4'].includes(section.ruleVersion) && selection.actualPrincipalTypeCode === 6;
  if (state.office !== 'liturgy' || (state.rite && state.rite !== 'john-chrysostom') || !['default','standalone'].includes(state.sequence)
    || section?.templateId !== 'liturgy:cu:' + TROPARIA_SECTION || section.scope !== SCOPE
    || section.language !== 'cu' || section.compositionReady !== true || !digest(section.templateVersion)
    || !Array.isArray(section.sourceVersions) || !section.sourceVersions.length || section.sourceVersions.some(source => !validSource(source))
    || receipt?.acceptance !== undefined || receipt.profileStatus !== undefined || receipt.status !== 'complete' || receipt.scope !== SCOPE
    || receipt.issues?.length !== 0 || receipt.missing?.length !== 0
    || !matchesWorshipContext(receipt.context,state) || receipt.context.language !== 'cu' || receipt.context.tradition !== 'russian-julian'
    || selection?.status !== 'selected' || selection.issues?.length !== 0
    || (selection.orderResolver !== 'App\\Services\\Liturgical\\WorshipEntranceOrder' && !(actualSix && selection.orderResolver === undefined)) || ![1,2,3,5].includes(selection.weekday)
    || selection.templeProfile?.id !== state.temple || selection.saintAbsenceInferred !== false
    || ['wholeLiturgyAccepted','wholeDatedServiceAccepted','dateAppointmentApproved'].some(key => section[key] !== false || receipt[key] !== false || selection[key] !== false)
    || ['publicAdmissionGranted','antiphonsAccepted'].some(key => receipt[key] !== false || selection[key] !== false)
    || !Array.isArray(receipt.sourceVersions) || !receipt.sourceVersions.length || receipt.sourceVersions.some(source => !validSource(source))
    || !Array.isArray(assignments?.sourceVersions) || !Array.isArray(selection.order) || selection.order.length !== parts || new Set(selection.order).size !== parts) return false;
  const operations = assignments.operations.filter(op => op.sectionId === TROPARIA_SECTION), operation = operations[0];
  if (operations.length !== 1 || operation.type !== 'fill' || operation.nodeId !== TARGET || operation.slotId !== 'troparia-kontakia'
    || operation.blocks?.length !== parts || !await same(operation.blocks.map(block => block.slot),selection.order)
    || operation.userInputHash !== undefined || operation.blockSources?.some(source => source.origin === 'user-provided')) return false;
  const ids = new Set();
  for (const block of operation.blocks) {
    const reference = selection.references?.[block.slot], provenance = block.provenance;
    if (!reference || !validSource(reference.source) || block.role !== 'choir' || block.section !== 'troparia-kontakia'
      || block.origin === 'user-provided' || provenance?.userInput !== undefined
      || block.repeatCount !== 1 || block.repeatIndex !== 1 || typeof block.occurrenceId !== 'string' || ids.has(block.occurrenceId)
      || !sourceIdentity(reference.source,provenance) || provenance.block !== reference.block || provenance.referenceId !== reference.referenceId
      || !await same(provenance.sourceRange ?? null, reference.range ?? null)
      || !await same(provenance.ownership ?? null, reference.ownership ?? null)
      || !receipt.sourceVersions.some(source => sourceIdentity(source,provenance))
      || !assignments.sourceVersions.some(source => sourceIdentity(source,provenance))) return false;
    if (reference.range) {
      if (!digest(reference.range.textSha256) || await textHash(block.segments.map(segment => segment.text).join('')) !== reference.range.textSha256) return false;
    } else {
      const ownership = reference.ownership;
      if (!['day-troparion','day-kontakion'].includes(block.slot) || ownership?.memoryId !== selection.dailyCommemoration
        || ownership.role !== (block.slot === 'day-troparion' ? 'troparion' : 'kontakion') || !digest(ownership.bindingHash) || !digest(ownership.ownershipProofHash)) return false;
    }
    ids.add(block.occurrenceId);
  }
  return true;
}
