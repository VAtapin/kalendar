import { partsHash } from './worship-hash.js';
const SAINT_RULE = 'ordinary-single-saint-temple-after-entrance-v1';
const GENERIC_RULE = 'ordinary-sourced-temple-after-entrance-v2';
const GENERIC_V3 = 'ordinary-sourced-temple-after-entrance-v3';
const GENERIC_V4 = 'ordinary-sourced-temple-after-entrance-v4';
const JOIN = '1b34682cdbddd698e884cb09ffd0734948839706982bf87c963fc3d4c8c61e52';
const SUPPLEMENT = 'de8a0000867964fc7a89eb3162c5d4ea9bef2ccebedf38ee7dc124f23281ac8d';
const SIX = 'bacdf1dce0fb095e93067efbdd90ddf34fc380d816698c435c1fdc6e6a4ac318';
const SIX_PROOFS = { witness: 'ca7a36fdf2f611a0515ea2427015f62449456b57d161ec3b968b2788aade5c29',
  review: '833b8216bd9e1d920d07c8f41466b6ef9c9efa6f36becba484856c9cf8be2251',
  capability: '4dbd2f1baad8a6f8f63e68def0862051d5244ffc45a4a0b9a607ffee7c2aa2af' };
const SIX_ORDER = ['temple-troparion','day-troparion',null,'temple-kontakion','day-kontakion','glory','departed-kontakion','now','theotokos-kontakion'];
const BASE_SOURCE = '034879275ba8b1f85fae85d3281bc033c4295d1f998e2bb5a8eeba58268849d8';
const MEMORY = 'memory-day-0009', CAPABILITY = '5980fa93158d9824db71b9223594bbe07094d1dcd243e28dc1b0ce13302ee7bf';
const NATIVE_OBJECT = 'b366bae63bc1ceeb1c920c092fc28a23f20af022631d0063ffffc87b108cfe7a';
const ORDER_OBJECT = '3865147ce966345bc4384262e190edfb4259e243cc64b1937524d1129fc63283';
const NATIVE_PROOF = '44a6046113385a6ad0a740d91c8ec096a61601fda0a3eee19cccbb82cf11bb28';
const ORDER_PROOF = '60b0969d17122868567a043c25495b86d4bda420a4a9be5d0188148e8c792d4c';
const BINDING = { troparion: 'general-native-troparion-7cdce7a9f2d1b867cdb3a637', kontakion: 'general-native-kontakion-71763ef096c8c3285d85a1e7' };
const SOURCE = { work: 'whole-cu-minea-08-15', edition: 'library-1c0877cb0199fd72f4b4d0de',
  hash: 'ed97bed88c87753f19b6f8b384d844df67da4cc5e3b17c8eeffd1b92a197b878', sourceHash: 'b8bc055985cbc740d1668a287cf30b1a7d4a361842bd8460e26dc85e897dcebb' };
const RECIPES = {
  troparion: [17,194,1,'d63f0257694ff68064510b051f56671b9e417da1ad6115e90fb68797bc7b4522','d46b303ad1496af2a9c31c9339a5e52d8865a852c3a197277944117fa4b39600'],
  kontakion: [120,219,2,'a3f185d21dbba16cd85a84a44c9f120a839ccada1b2d72ba30a338e70149090a','9ae7e72535f9a436d1df260c7dae1a1f3f29843f062a241ab454a347907f5053'],
};
const digest = value => /^[a-f0-9]{64}$/.test(value || '');
const same = async(a,b) => await partsHash(a) === await partsHash(b);
const canonical = (profile,id,kind,memory) => profile?.id === id && profile.kind === kind
  && profile.dedicationIds?.length === 1 && profile.dedicationIds[0] === memory
  && profile.patronalFeastIds?.length === 1 && profile.patronalFeastIds[0] === memory;

/** Versioned source contracts; a nine-part response never broadens the old saint admission. */
export async function tropariaProtocol(section, receipt, state) {
  const selection = receipt?.selection;
  if (!selection || !section) return 0;
  if ([GENERIC_RULE, GENERIC_V3, GENERIC_V4].includes(section.ruleVersion)) {
    const inventory = section.templeSourceCapabilities, capability = inventory?.[MEMORY];
    if (!inventory || Object.keys(inventory).length !== 1 || capability?.kind !== 'theotokos'
      || capability.capabilityVersion !== CAPABILITY || capability.nativeRoleObjectHash !== NATIVE_OBJECT || capability.orderObjectHash !== ORDER_OBJECT
      || !await same(capability.binding,BINDING)
      || ([GENERIC_V3, GENERIC_V4].includes(section.ruleVersion) && section.sixSticheraOrderCapability !== SIX)
      || (section.ruleVersion === GENERIC_V4 && section.dormitionSixSticheraJoin !== JOIN)
      || section.templateVersion !== await partsHash(section.ruleVersion === GENERIC_V4
        ? { dormitionSixSticheraJoin: JOIN, dormitionSixSticheraSupplement: SUPPLEMENT, baseSourceReview: BASE_SOURCE, templeSourceCapabilities: inventory, sixSticheraOrderCapability: SIX }
        : [GENERIC_V3, GENERIC_V4].includes(section.ruleVersion)
        ? { baseSourceReview: BASE_SOURCE, templeSourceCapabilities: inventory, sixSticheraOrderCapability: SIX }
        : { baseSourceReview: BASE_SOURCE, templeSourceCapabilities: inventory })) return 0;
  } else if (section.ruleVersion !== SAINT_RULE) return 0;
  const dormSix = selection.joinedSourceCapability !== undefined || receipt.sourceReviewVersion === JOIN;
  if (dormSix) {
    const authority = selection.reviewedOrderCapability;
    const role = { 1: 'angels', 2: 'forerunner', 3: 'cross', 5: 'cross' }[selection.weekday];
    const first = selection.weekday === 1 || selection.weekday === 2 ? ['temple-troparion','weekday-' + role + '-troparion'] : ['weekday-' + role + '-troparion','temple-troparion'];
    const order = [...first,'day-troparion','weekday-' + role + '-kontakion','day-kontakion','glory','departed-kontakion','now','temple-kontakion'];
    if (section.ruleVersion !== GENERIC_V4 || state.temple !== 'dormition' || selection.joinedSourceCapability !== JOIN
      || receipt.sourceReviewVersion !== JOIN || selection.actualPrincipalTypeCode !== 6 || selection.type6RemappedTo7 !== false
      || authority?.id !== 'ordinary-theotokos-temple-black-six-stichera-join' || authority.objectHash !== JOIN
      || authority.actualPrincipalTypeCode !== 6 || authority.type6RemappedTo7 !== false
      || authority.ruleChainInterpretation !== 'explicit-source-interpretation-not-literal-numeric-referral'
      || selection.orderResolver !== 'App\\Services\\Liturgical\\WorshipEntranceOrder' || !role || !await same(selection.order,order)) return 0;
  }
  const six = !dormSix && (selection.actualPrincipalTypeCode !== undefined || selection.reviewedOrderCapability !== undefined || receipt.sourceReviewVersion === SIX);
  if (six) {
    const memory = { 'george-victorious': 'memory-day-0023', nicholas: 'memory-day-0033' }[state.temple];
    const authority = selection.reviewedOrderCapability;
    const weekdayRole = { 1: 'angels', 2: 'forerunner', 3: 'cross', 5: 'cross' }[selection.weekday];
    const expectedOrder = weekdayRole ? ['weekday-' + weekdayRole + '-troparion', ...SIX_ORDER.map(slot => slot === null ? 'weekday-' + weekdayRole + '-kontakion' : slot)] : [];
    return [GENERIC_V3, GENERIC_V4].includes(section.ruleVersion) && memory
      && canonical(selection.templeProfile,state.temple,'saint',memory) && canonical(receipt.context?.templeProfile,state.temple,'saint',memory)
      && receipt.sourceReviewVersion === SIX && selection.actualPrincipalTypeCode === 6 && selection.type6RemappedTo7 === false
      && authority?.id === 'ordinary-weekday-black-six-stichera-saint-temple-troparia-order' && authority.objectHash === SIX
      && authority.actualPrincipalTypeCode === 6 && authority.type6RemappedTo7 === false
      && authority.ruleChainInterpretation === 'explicit-source-interpretation-not-literal-numeric-referral'
      && selection.sourceRuleWitnessHash === SIX_PROOFS.witness && selection.sourceRuleReviewHash === SIX_PROOFS.review
      && selection.sourceOrderCapabilityHash === SIX_PROOFS.capability && selection.templeAdmission === undefined
      && weekdayRole && await same(selection.order,expectedOrder) ? 10 : 0;
  }
  if (selection.templeProfile?.kind === 'saint') {
    const sourceVersion = [GENERIC_RULE, GENERIC_V3, GENERIC_V4].includes(section.ruleVersion) ? BASE_SOURCE : section.templateVersion;
    const memory = { 'george-victorious': 'memory-day-0023', nicholas: 'memory-day-0033' }[state.temple];
    return memory && canonical(selection.templeProfile,state.temple,'saint',memory) && canonical(receipt.context?.templeProfile,state.temple,'saint',memory)
      && receipt.sourceReviewVersion === sourceVersion && selection.sourceReviewHash === sourceVersion
      && digest(selection.sourceProofHash) && digest(selection.hoursSourceCatalogueHash) && selection.templeAdmission === undefined ? 10 : 0;
  }
  const admission = selection.templeAdmission;
  if (![GENERIC_RULE, GENERIC_V3, GENERIC_V4].includes(section.ruleVersion) || state.temple !== 'dormition' || !canonical(selection.templeProfile,'dormition','theotokos',MEMORY) || !canonical(receipt.context?.templeProfile,'dormition','theotokos',MEMORY)
    || receipt.sourceReviewVersion !== (dormSix ? JOIN : CAPABILITY) || selection.oldSaintOnlyAdmissionUsed !== false
    || admission?.memory !== MEMORY || admission.kind !== 'theotokos' || admission.sourceCapabilityReviewed !== true
    || admission.oldSaintOnlyAdmissionUsed !== false || admission.databaseBodyOrPublicFlagTreatedAsRoleAdmission !== false
    || ['publicAdmissionGranted','dateAppointmentApproved','wholeLiturgyAccepted'].some(key => admission[key] !== false)
    || admission.nativeRoleProofHash !== NATIVE_PROOF || admission.orderProofHash !== ORDER_PROOF || !await same(admission.binding,BINDING)
    || selection.order?.length !== 9 || selection.order.at(-2) !== 'now' || selection.order.at(-1) !== 'temple-kontakion'
    || selection.order.includes('theotokos-kontakion')) return 0;
  for (const [role, recipe] of Object.entries(RECIPES)) {
    const reference = selection.references?.['temple-' + role], ownership = reference?.ownership;
    if (!reference || Object.entries(SOURCE).some(([key,value]) => reference.source?.[key] !== value)
      || reference.source.language !== 'cu' || reference.block !== recipe[0] || reference.tone !== recipe[2]
      || reference.range?.start !== 0 || reference.range.length !== recipe[1] || reference.range.sourceBlockHash !== recipe[3]
      || reference.range.textSha256 !== recipe[4] || reference.sourceBlockHash !== recipe[3] || reference.selectedBodyHash !== recipe[3]
      || reference.referenceId !== BINDING[role] || reference.hymnId !== BINDING[role]
      || ownership?.memoryId !== MEMORY || ownership.role !== role || ownership.templeKind !== 'theotokos'
      || ownership.nativeRoleProofHash !== NATIVE_PROOF || ownership.orderProofHash !== ORDER_PROOF || ownership.oldSaintOnlyAdmissionUsed !== false) return 0;
  }
  return 9;
}
