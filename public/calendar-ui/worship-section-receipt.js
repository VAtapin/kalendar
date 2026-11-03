import { partsHash } from './worship-hash.js';
import { matchesWorshipContext } from './worship-context.js';
const components = {
  'ordinary-choir-cherubic': ['ordinary-chrysostom-standalone-cherubic-choir-v1', 'one-ordinary-choir-component-only'],
  'general-ordinary-choir-trisagion': ['general-ordinary-chrysostom-standalone-choir-trisagion-v1', 'one-ordinary-choir-component-only'],
  'general-ordinary-entrance-verse': ['general-ordinary-weekday-chrysostom-entrance-verse-v1', 'one-ordinary-choir-component-only'],
  'ordinary-choir-trisagion': ['ordinary-native-cu-choir-trisagion-v1', 'one-choir-slot-in-existing-weekday-domain'],
  'weekday-antiphons-and-entrance': ['cu-wed-fri-saint-temple-v1', 'seven-ordinary-hymns-only;not-contiguous-whole-service'],
};
const digest = value => /^[a-f0-9]{64}$/.test(value || '');
/** Explicit source-component receipts are not whole-service approval or a generic approval bypass. */
export async function sourceComponentReceipt(id, section, receipt, state) {
  const contract = components[id];
  if (!contract || !section || !receipt || receipt.acceptance !== undefined || receipt.profileStatus !== undefined) return false;
  if (state.office !== 'liturgy' || !['default', 'standalone'].includes(state.sequence)
    || (state.rite && state.rite !== 'john-chrysostom') || section.ruleVersion !== contract[0]
    || !digest(section.templateVersion) || !Array.isArray(section.sourceVersions) || !section.sourceVersions.length
    || section.sourceVersions.some(source => source.language !== 'cu' || typeof source.work !== 'string' || typeof source.edition !== 'string' || !digest(source.hash) || source.origin === 'user-provided')
    || section.templateId !== 'liturgy:cu:' + id || section.scope !== contract[1] || receipt.scope !== contract[1]
    || section.compositionReady !== true || section.wholeLiturgyAccepted !== false || receipt.wholeLiturgyAccepted !== false
    || ['wholeDatedServiceAccepted','dateAppointmentApproved','appointedForDate'].some(key => receipt[key] === true)
    || !matchesWorshipContext(receipt.context, state) || receipt.context.language !== 'cu'
    || receipt.context.tradition !== 'russian-julian' || receipt.status !== 'complete'
    || receipt.issues?.length !== 0 || receipt.missing?.length !== 0
    || !Array.isArray(receipt.sourceVersions) || await partsHash(receipt.sourceVersions) !== await partsHash(section.sourceVersions)) return false;
  if (id.startsWith('general-') || id === 'ordinary-choir-cherubic') {
    const selection = receipt.selection, rite = selection?.resolvedRite;
    if (receipt.wholeDatedServiceAccepted !== false || receipt.dateAppointmentApproved !== false
      || section.dateAppointmentApproved !== false || receipt.sourceReviewVersion !== section.templateVersion
      || selection?.sourceClassId !== contract[0] || !digest(selection.sourceProofHash) || !digest(selection.calendarHash)
      || selection.dateWhitelistUsed !== false || rite?.id !== 'john-chrysostom' || rite.form !== 'standalone'
      || rite.status !== 'calculated' || rite.issues?.length !== 0) return false;
  } else if (id === 'ordinary-choir-trisagion') {
    if (receipt.selection?.weekdayRule !== 'ordinary-entrance-v1' || !digest(receipt.selection.sourcePacketHash)) return false;
  } else if (receipt.selection?.rule !== 'ordinary-entrance-v1' || receipt.selection.issues?.length !== 0) return false;
  return true;
}
