import { partsHash, textHash } from './worship-hash.js';
import { validLocalLiteral } from './worship-local-context.js';
import fixedBlockPins, { RANGE_PINS } from './worship-first-season-pins.js';
import { validWorshipDate } from './worship-context.js';

const SOURCE_HASH = '787821ab28ad6f2f4b39a52d57205bd330a12844ded7ac75eeb8d1c089f8376b';
const VARIANT = 'MP-patriarch-bishop-Russia-parish';
const REVIEW = '06d976c9f782f03accbd4e18b404dadd56d76a1200e961a1a6d1daeeb3a7e7e1';
const PACKET = '8c7cee4a4e45d1ba8c99f18ba8e91fa6c6a6ab76c05f11813704e457e44c4a79';
const fields = ['people.primate.forms.accusative', 'people.diocesan.forms.accusative'];
const fail = () => { throw Error('Invalid seasonal First Hour'); };
const same = async (a, b) => await partsHash(a) === await partsHash(b);
export function firstSeasonSelected(state) { return state.office === 'first-hour' && state.sequence === 'before-matins-dismissal'; }
export function firstSeasonParams(state) {
  if (!firstSeasonSelected(state) || !validWorshipDate(state.date) || typeof state.temple !== 'string' || !state.temple
    || state.afterHourHymn !== 'none' || !['auto', 'cu', undefined].includes(state.textLanguage)) fail();
  return { date: state.date, language: 'cu', profile: 'ordinary-clergy', temple: state.temple, calendarStyle: 'julian',
    sequence: 'after-matins', matinsDismissalDone: false, afterHourHymn: 'none' };
}
async function checkTemplate(t) {
  if (!t || t.schemaVersion !== 1 || t.artifactType !== 'hour-template' || t.templateId !== 'lenten-practical-first-with-Matins-ending-v1'
    || t.ruleVersion !== 'second-week-practical-Horologion-first-v1' || t.language !== 'cu' || t.orthography !== 'traditional'
    || t.dateDependent !== true || !/^[a-f0-9]{64}$/.test(t.templateVersion || '') || t.requiredSourceVariantId !== VARIANT
    || t.userValuePolicy !== 'explicit-user-local-values-v1' || t.userValueContractKind !== 'source-utterance-children'
    || !await same(t.requiredPrivateForms, fields) || await partsHash(t.sourceVersions) !== SOURCE_HASH
    || !await same(t.transition, { matinsDismissalDoneBeforeHour: false, finalDismissalOwner: 'after-first-hour', smallHoursDismissalIncluded: false, precedingMatinsWholeAccepted: false })
    || !await same(t.nodes, [{ nodeId: 'lenten-first:whole', slotId: 'seasonal-office', kind: 'slot', role: 'mixed', required: true, blocks: [] }])) fail();
  return t;
}
function normalized(local, temple) {
  if (local?.schemaVersion !== 1 || local.templeProfileId !== temple || local.confirmedLiteralForms !== true
    || Object.keys(local.people || {}).sort().join(',') !== 'diocesan,primate') fail();
  const people = {};
  for (const [role, rank] of [['primate', 'patriarch'], ['diocesan', 'bishop']]) {
    const person = local.people[role], text = person?.forms?.accusative;
    if (person?.rank !== rank || Object.keys(person.forms || {}).join(',') !== 'accusative' || !validLocalLiteral(text)) fail();
    people[role] = { rank, forms: { accusative: text } };
  }
  return { schemaVersion: 1, templeProfileId: temple, confirmedLiteralForms: true, people, commemorations: { living: [], departed: [] } };
}
async function verifyBlock(block, sources, local, inputHash, used) {
  if (!block || !Array.isArray(block.segments) || !block.segments.length || block.segments.some(s => typeof s.text !== 'string')) fail();
  const p = block.provenance || {}, resolve = part => sources.some(source => source.hash === (part.bodyHash || part.hash)
    && (!part.work || source.work === part.work) && (!part.edition || source.edition === part.edition)
    && (!part.sourceHash || source.sourceHash === part.sourceHash));
  if (!p.sourcePieces) {
    if (!resolve(p) || !fixedBlockPins[p.bodyHash + ':' + p.block]?.includes(await partsHash({ kind: block.kind, segments: block.segments }))) fail();
    return;
  }
  if (!Array.isArray(p.sourcePieces) || !p.sourcePieces.length) fail();
  const chars = [...block.segments.map(s => s.text).join('')]; let offset = 0;
  for (const piece of p.sourcePieces) {
    if (piece.userInput) {
      const u = piece.userInput, role = u.field === fields[0] ? 'primate' : u.field === fields[1] ? 'diocesan' : null;
      if (!role || u.origin !== 'user-provided' || u.inputHash !== inputHash || u.grammaticalCase !== 'accusative'
        || u.literalConfirmed !== true || u.morphologyInferred !== false || u.serviceSourceAttestation !== false || u.currentAuthorityAttestation !== false) fail();
      const literal = local.people[role].forms.accusative;
      if (chars.slice(offset, offset + [...literal].length).join('') !== literal) fail();
      used[role]++;
      offset += [...literal].length;
    } else {
      const range = piece.range || piece.sourceRange;
      if (!resolve(piece) || !RANGE_PINS.has(await partsHash(piece)) || !Number.isInteger(range?.length) || range.length < 1 || !/^[a-f0-9]{64}$/.test(range.textSha256 || '')) fail();
      if (await textHash(chars.slice(offset, offset + range.length).join('')) !== range.textSha256) fail();
      offset += range.length;
    }
  }
  if (offset !== chars.length) fail();
}
export async function fetchFirstSeason(base, state, fetcher, signal, localContext, isCurrent = () => true) {
  const context = firstSeasonParams(state), endpoint = path => new URL('/api/v1/liturgical/' + path + '/first-hour', base);
  const url = endpoint('templates'); for (const [key, value] of Object.entries(context)) url.searchParams.set(key, key === 'matinsDismissalDone' ? '0' : value);
  const templateResponse = await fetcher(url, { credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' }, signal });
  if (templateResponse.status !== 200) throw Error('Seasonal template unavailable');
  const template = await checkTemplate((await templateResponse.json()).data); signal.throwIfAborted();
  if (!localContext) return { status: 'first-season-context-required', firstSeasonAvailable: true };
  const local = normalized(localContext, state.temple), inputHash = await partsHash(local);
  const body = { ...context, localContext, sourceVariantId: VARIANT, templateVersion: template.templateVersion };
  const response = await fetcher(endpoint('assignments'), { method: 'POST', credentials: 'omit', cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  signal.throwIfAborted(); if (!isCurrent()) throw new DOMException('Stale preparation', 'AbortError');
  const cache = (response.headers?.get('cache-control') || '').toLowerCase().split(',').map(x => x.trim());
  if (response.status !== 200 || !cache.includes('private') || !cache.includes('no-store') || cache.includes('public')) fail();
  const result = (await response.json()).data, a = result?.acceptance, receipt = result?.localValues;
  if (!result || result.status !== 'complete' || result.schemaVersion !== 1 || result.artifactType !== 'hour-assignments'
    || ['templateId', 'templateVersion', 'ruleVersion'].some(key => result[key] !== template[key])
    || result.templateSourcesHash !== SOURCE_HASH || !await same(result.context, { ...context, seasonProfile: 'lenten-practical-v1' })
    || result.missing?.length !== 0 || result.issues?.length !== 0 || result.operations?.length !== 1
    || a?.sourceCandidateOnly !== true || a.runtimeAcceptanceGranted !== false || a.strictMonasticProfileAccepted !== false
    || a.wholeFourHourDayAccepted !== false || a.defaultExpanded !== false || a.databaseApprovedFlagRequired !== false || a.wholeMatinsAccepted !== false
    || a.packetHash !== PACKET || a.sourceRoleReviewHash !== REVIEW || receipt?.inputHash !== inputHash || receipt.usedInSpokenText !== true
    || receipt.sourceAttestation !== false || receipt.currentAuthorityAttestation !== false || receipt.sourceVariantId !== VARIANT) fail();
  const expectedContracts = fields.map(field => ({ field, case: 'accusative', morphologyInferred: false, currentAuthorityAttestation: false }));
  if (!await same(receipt.contracts, expectedContracts)) fail();
  const op = result.operations[0];
  if (op.type !== 'fill' || op.nodeId !== 'lenten-first:whole' || op.slotId !== 'seasonal-office' || !Array.isArray(op.blocks) || !op.blocks.length
    || await partsHash(op.blocks) !== result.composedBlocksHash) fail();
  const used = { primate: 0, diocesan: 0 };
  for (const block of op.blocks) await verifyBlock(block, template.sourceVersions, local, inputHash, used);
  if (used.primate !== 1 || used.diocesan !== 1) fail();
  signal.throwIfAborted(); if (!isCurrent()) throw new DOMException('Stale preparation', 'AbortError');
  return { status: 'parts', template, entries: op.blocks.map(block => ({ kind: 'fixed', language: 'cu', blocks: [block], role: block.role })),
    assignmentsStatus: 'complete', complete: false, preparedPrintedBook: true, preparedContract: result, localValuesApplied: true, sourceVersions: template.sourceVersions };
}
