import {fetchPreparedPresanctified} from './worship-presanctified-prepared.js';
import { buildArtemyPost, isArtemyContext } from './worship-artemy-request.js';
import { composeArtemy } from './worship-artemy-composer.js';
import {requestedOfficeMode,validateServiceMode,officeModeUnavailable} from './worship-office-mode.js';
import {PAIR_SECTION,MODE_PAIR_SECTION} from './worship-antiphon-pair.js';
import { fetchMidnightParts } from './worship-midnight.js';
import { fetchTypikaParts } from './worship-typika.js';
import { validateTropariaWrapper } from './worship-troparia-section.js';
import { sourceComponentReceipt } from './worship-section-receipt.js';
import { partsHash } from './worship-hash.js';
import { isAdditionalLiturgy, fetchAdditionalLiturgy } from './worship-additional-liturgy.js';
import { datedWorshipParams, hourContext, matchesWorshipContext, worshipRequestSignal } from './worship-context.js';
// Connect the published source-bound templates and explicit daily operations.
// Calendar rules and the choice of prayers remain entirely in Bible Desktop.
export function sourceLanguage(item) {
  if (item?.language === 'cu' && ['civil', 'civil-accented'].includes(item.orthography)) return 'cu-civil';
  return ['cu', 'cu-civil', 'ru'].includes(item?.language) ? item.language : null;
}

export { partsHash } from './worship-hash.js';

function validBlocks(blocks) {
  return Array.isArray(blocks) && blocks.length > 0 && blocks.every(block => Array.isArray(block?.segments)
    && block.segments.length > 0 && block.segments.every(segment => typeof segment?.text === 'string'));
}

export function validateTemplate(template, office) {
  const outline = template?.artifactType === 'source-bound-template' && template.status === 'source-outline'
    && template.cleanTemplate === false && template.compositionReady === false
    && ['first-hour', 'third-hour', 'sixth-hour', 'ninth-hour', 'liturgy', 'matins', 'vespers'].includes(office)
    && (template.templateId?.startsWith(office + ':')
      || (office === 'liturgy' && template.templateId?.startsWith('liturgy-john-chrysostom:')));
  const fixed = (template?.artifactType === 'fixed-template' && template.status === 'fixed-complete' && template.profile?.office === office)
    || (office === 'liturgy' && template?.artifactType === 'source-bound-template' && template.status === 'fixed-template'
      && template.cleanTemplate === true && template.compositionReady === true && template.wholeLiturgyAccepted === false
      && template.profile?.id === 'ordinary-one-priest-one-deacon' && template.profile?.rite === 'john-chrysostom');
  if (template?.schemaVersion !== 1 || (!outline && !fixed) || template.dateDependent !== false
    || (template.appointedForDate !== false && !(fixed && template.cleanTemplate === true
      && template.compositionReady === true && template.appointedForDate === undefined))
    || !/^[a-f0-9]{64}$/.test(template.templateVersion || '')
    || typeof template.templateId !== 'string' || typeof template.ruleVersion !== 'string'
    || !Array.isArray(template.sourceVersions) || !template.sourceVersions.length
    || !Array.isArray(template.nodes) || !template.nodes.length) throw new Error('Invalid worship template');
  const ids = new Set();
  for (const node of template.nodes) {
    if (!node || typeof node.nodeId !== 'string' || ids.has(node.nodeId)) throw new Error('Ambiguous template node');
    ids.add(node.nodeId);
    if (node.kind === 'slot') {
      if (typeof node.slotId !== 'string') throw new Error('Invalid template slot');
    } else if (!['fixed', 'source-block'].includes(node.kind) || !validBlocks(node.blocks)
      || !sourceLanguage(node.language ? node : template)) throw new Error('Invalid template body');
  }
  return template;
}

function baseEntries(template) {
  return template.nodes.map(node => node.kind === 'slot' ? { ...node, missing: true } : {
    ...node, language: sourceLanguage(node.language ? node : template), blocks: node.blocks,
  });
}

export async function composeParts(template, assignments, state) {
  for (const key of ['schemaVersion', 'templateId', 'templateVersion', 'ruleVersion']) {
    if (template[key] !== assignments?.[key]) throw new Error('Incompatible worship versions');
  }
  if (await partsHash(template.sourceVersions) !== assignments.templateSourcesHash) throw new Error('Incompatible worship sources');
  const context = assignments.context;
  if (!matchesWorshipContext(context, state)
    || !['complete', 'partial', 'not-appointed'].includes(assignments.status)
    || !Array.isArray(assignments.operations) || !Array.isArray(assignments.missing)) throw new Error('Invalid dated assignments');
  await validateTropariaWrapper(template, assignments);
  const modeGated=!!template.sections?.[MODE_PAIR_SECTION];
  if(modeGated){
    const requested=requestedOfficeMode(state);
    if(['actualRectorElectionProved','actualRectorBlessingClaimed','localConfirmationAssumed','actualLocalConfirmationProved','actualDateAppointmentApproved'].some(k=>Object.hasOwn(assignments,k)&&assignments[k]!==false))throw Error('Unsupported factual office-mode claim');
    if(assignments.serviceMode){
      await validateServiceMode(assignments.serviceMode,state);
      if(assignments.serviceMode.selectedMode!=='god-is-lord'||assignments.ordinaryLiturgyAvailable!==true)throw Error('Ordinary body conflicts with governing office mode');
    }else if(requested!=='auto'||Object.hasOwn(assignments,'ordinaryLiturgyAvailable'))throw Error('Missing office-mode declaration');
  }
  const outline = template.status === 'source-outline';
  if (outline && (assignments.status === 'complete' || assignments.operations.length)) throw new Error('Outline is not a composable rite');
  const nodes = new Map(template.nodes.map(node => [node.nodeId, node])), operations = new Map();
  if (template.status === 'fixed-template' && assignments.operations.some(op => !op.sectionId)) throw new Error('Unverified service section');
  for (const id of new Set(assignments.operations.map(op => op.sectionId).filter(Boolean))) {
    const section = template.sections?.[id], verified = assignments.verifiedSections?.[id];
    if (!section || !verified || verified.status !== 'complete' || (!(!(['general-ordinary-entrance-verse',PAIR_SECTION,MODE_PAIR_SECTION].includes(id)||(id==='ordinary-antiphons-and-entrance'&&modeGated)) && verified.acceptance?.status === 'approved' && verified.profileStatus === 'confirmed-for-fragment')
        && !await sourceComponentReceipt(id, section, verified, state, assignments)) || !Array.isArray(verified.operationIndexes)
      || !verified.operationIndexes.length) throw new Error('Unverified service section');
    for (const key of ['schemaVersion', 'templateId', 'templateVersion', 'ruleVersion']) {
      if (section[key] !== verified[key]) throw new Error('Incompatible section versions');
    }
    if (await partsHash(section.sourceVersions) !== verified.templateSourcesHash) throw new Error('Incompatible section sources');
    const sectionOps = verified.operationIndexes.map(index => assignments.operations[index]);
    if (new Set(verified.operationIndexes).size !== sectionOps.length || sectionOps.some(op => !op || op.sectionId !== id
      || op.type !== 'fill' || op.sectionTemplateVersion !== section.templateVersion
      || !section.nodes.some(node => node.nodeId === op.nodeId && node.slotId === op.slotId))
      || assignments.operations.filter(op => op.sectionId === id).length !== sectionOps.length
      || await partsHash(sectionOps.flatMap(op => op.blocks)) !== verified.composedBlocksHash) throw new Error('Section composition mismatch');
  }
  for (const original of assignments.operations) {
    const operation = { ...original };
    if (operation.type === 'replace' && operation.blocks === undefined && Array.isArray(operation.blockMetadata)
      && Array.isArray(operation.fieldOrder)) operation.metadataOnly = true;
    if (operation.type === 'fill' && operation.blockSources === undefined && Array.isArray(operation.blocks)) {
      operation.blockSources = operation.blocks.map(block => {
        const provenance = block?.provenance;
        const matches = (assignments.sourceVersions || []).filter(source => source.work === provenance?.work
          && source.edition === provenance?.edition && source.hash === provenance?.bodyHash);
        return matches.length && new Set(matches.map(sourceLanguage)).size === 1 ? matches[0] : null;
      });
    }
    const node = nodes.get(operation?.nodeId);
    if (!node || operations.has(node.nodeId) || (operation.slotId ?? null) !== (node.slotId ?? null)
      || !['fill', 'replace', 'remove'].includes(operation.type)) throw new Error('Invalid worship operation');
    if (operation.type === 'fill' && node.kind !== 'slot') throw new Error('Fill must target a slot');
    if (operation.type === 'replace' && node.kind !== 'fixed') throw new Error('Replace must target a fixed node');
    if (operation.type === 'remove' && typeof operation.reason !== 'string'
      && !(node.kind === 'slot' && assignments.status === 'complete')) throw new Error('Removal reason missing');
    if (operation.type !== 'remove' && operation.metadataOnly !== true) {
      if (!validBlocks(operation.blocks) || !Array.isArray(operation.blockSources)
        || operation.blockSources.length !== operation.blocks.length || operation.blockSources.some(source => !sourceLanguage(source))) {
        throw new Error('Unidentified operation text');
      }
    }
    operations.set(node.nodeId, operation);
  }
  const missing = new Map(assignments.missing.map(item => [item.nodeId, item]));
  const entries = template.nodes.flatMap(node => {
    const op = operations.get(node.nodeId);
    if (op?.type === 'remove') return [];
    if (node.kind === 'slot' && !op) return [{ ...node, missing: true, reason: missing.get(node.nodeId)?.reason }];
    const language = sourceLanguage(node.language ? node : template);
    if (!op) return [{ ...node, language }];
    if (op.metadataOnly === true) {
      if (op.type !== 'replace' || !Array.isArray(op.blockMetadata) || !Array.isArray(op.fieldOrder)
        || op.blockMetadata.length !== node.blocks.length || op.fieldOrder.length !== node.blocks.length) throw new Error('Invalid occurrence binding');
      const blocks = node.blocks.map((block, index) => {
        const fields = op.fieldOrder[index];
        if (!Array.isArray(fields) || !fields.includes('kind') || !fields.includes('segments')) throw new Error('Invalid binding fields');
        return Object.fromEntries(fields.map(key => [key, key === 'kind' ? block.kind : key === 'segments' ? block.segments : op.blockMetadata[index][key]]));
      });
      return [{ ...node, language, blocks }];
    }
    return op.blocks.map((block, index) => ({ nodeId: node.nodeId, kind: 'fixed', section: node.section,
      role: node.role, parallelGroup: node.parallelGroup, delivery: node.delivery,
      language: sourceLanguage(op.blockSources[index]), blocks: [block] }));
  });
  if (assignments.status === 'complete') {
    if (assignments.missing.length || entries.some(entry => entry.missing)
      || assignments.completeness?.appointment !== true || assignments.completeness?.composition !== true
      || await partsHash(entries.flatMap(entry => entry.blocks)) !== assignments.composedBlocksHash) throw new Error('Composition mismatch');
  }
  const sources = [...template.sourceVersions, ...[...operations.values()]
    .filter(operation => operation.type !== 'remove' && operation.metadataOnly !== true)
    .flatMap(operation => operation.blockSources || [])];
  const sourceVersions = [...new Map(sources.map(source => [JSON.stringify(source), source])).values()];
  return { status: 'parts', template, entries, sourceVersions, assignmentsStatus: assignments.status,
    complete: assignments.status === 'complete', outline, profileStatus: assignments.profileStatus,
    ...(modeGated?{officeMode:requestedOfficeMode(state),serviceMode:assignments.serviceMode,
      ordinaryLiturgyAvailable:assignments.ordinaryLiturgyAvailable,modeContract:assignments}:{} ) };
}

export async function fetchWorshipParts(base, state, onBase = () => {}, fetcher = fetch, signal, options = {}) {
  state = { ...state };
  if(Object.hasOwn(state,'officeMode')&&state.officeMode!=='auto')requestedOfficeMode(state);
  if (state.office === 'midnight-office') return fetchMidnightParts(base, state, onBase, fetcher, signal, options);
  if (state.office === 'typika') return fetchTypikaParts(base,state,fetcher,signal);
  if (isArtemyContext(state) && !Object.hasOwn(options, 'manyYearsContext')) return { status: 'artemy-context-required' };
  const requestSignal = worshipRequestSignal(signal, Object.hasOwn(options, 'manyYearsContext') ? 120_000 : 20_000);
  let modeGated=false;
  const request = async (path, params = {}, body, validationProbe = false) => {
    requestSignal.throwIfAborted();
    const url = new URL('/api/v1/liturgical/' + path + '/' + state.office, base);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetcher(url, { credentials: 'omit', cache: 'no-store',
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
      signal: validationProbe ? AbortSignal.any([requestSignal, AbortSignal.timeout(3_000)]) : requestSignal });
    if (validationProbe) {
      if (response.status !== 422) return false;
      const cache = response.headers?.get('cache-control') || '', value = await response.json();
      return cache.includes('no-store') && cache.includes('private') && !value.data && value.errors
        && Object.keys(value.errors).length === 1 && Array.isArray(value.errors.localContext) && value.errors.localContext.length > 0;
    }
    if (response.status === 422 && path === 'templates') {
      const value = await response.json();
      // The published API validates the supported edition through errors.language.
      // Other validation errors must never trigger a language substitution.
      if (value.errors && Object.keys(value.errors).length === 1 && Array.isArray(value.errors.language)
        && value.errors.language.length && value.errors.language.every(error => error === 'validation.in')) return null;
    }
    if(response.status===409&&path==='assignments'&&modeGated)return officeModeUnavailable(await response.json(),state);
    if (response.status !== 200) throw new Error('Worship parts request failed: ' + response.status);
    return (await response.json()).data;
  };
  const requested = state.textLanguage || 'auto';
  if (!['auto', 'cu', 'cu-civil', 'ru'].includes(requested)) throw new Error('Invalid text language');
  if (isAdditionalLiturgy(state)) return fetchAdditionalLiturgy(state, onBase, request, signal, options.localContext, options.probeLocalContext,
    Object.hasOwn(options, 'preparedSourceChoices') ? template => fetchPreparedPresanctified(base,
      {...state, temple: options.localContext?.templeProfileId}, template, options.localContext, options.preparedSourceChoices, fetcher, signal, options.isCurrent) : undefined);
  let template, language;
  const hour = ['first-hour', 'third-hour', 'sixth-hour', 'ninth-hour'].includes(state.office);
  for (const candidate of requested === 'auto' ? ['cu', 'cu-civil', 'ru'] : [requested]) {
    const profile = candidate === 'cu' && hour ? { profile: 'ordinary-clergy',
      ...(['first-hour', 'ninth-hour'].includes(state.office) ? { sequence: state.sequence, ...hourContext(state) } : {}) } : {};
    const value = await request('templates', { language: candidate, ...profile,
      ...(candidate === 'cu' && state.office === 'liturgy' ? { mode: 'fixed' } : {}) });
    if (value === null) continue;
    template = validateTemplate(value, state.office);
    const sources = template.nodes.filter(node => node.kind !== 'slot');
    if (sources.some(node => sourceLanguage(node.language ? node : template) !== candidate)) throw new Error('Wrong template edition');
    language = candidate; break;
  }
  if (!template) return { status: 'edition-unavailable' };
  if (Object.hasOwn(options, 'manyYearsContext')) {
    const body = buildArtemyPost(state, template.templateVersion, options.localContext, options.manyYearsContext);
    const url = new URL('/api/v1/liturgical/assignments/liturgy', base);
    const response = await fetcher(url, { method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: requestSignal });
    requestSignal.throwIfAborted();
    if (options.isCurrent && !options.isCurrent()) throw new DOMException('Stale preparation', 'AbortError');
    const cache = (response.headers?.get('cache-control') || '').toLowerCase().split(',').map(value => value.trim());
    if (response.status !== 200 || !cache.includes('private') || !cache.includes('no-store') || cache.includes('public')) throw Error('Private preparation unavailable');
    const payload = await response.json();
    requestSignal.throwIfAborted();
    const result = await composeArtemy(template, payload.data, state, options.localContext, options.manyYearsContext);
    requestSignal.throwIfAborted();
    if (options.isCurrent && !options.isCurrent()) throw new DOMException('Stale preparation', 'AbortError');
    return result;
  }
  modeGated=!!template.sections?.[MODE_PAIR_SECTION];
  if(modeGated)requestedOfficeMode(state);
  else if(Object.hasOwn(state,'officeMode')&&state.officeMode!=='auto')throw Error('Office mode requires a mode-gated traditional Liturgy');
  const fallback = requested === 'auto' && language !== 'cu';
  const baseResult = { status: 'parts', template, entries: baseEntries(template), assignmentsStatus: 'loading',
    complete: false, outline: template.status === 'source-outline', fallback };
  requestSignal.throwIfAborted();
  if(!modeGated)onBase(baseResult); // Do not expose ordinary source words before governing-mode admission.
  const params = { ...datedWorshipParams(state, language), templateVersion: template.templateVersion };
  if (language === 'cu' && hour) params.profile = 'ordinary-clergy';
  if (language === 'cu' && state.office === 'liturgy') params.mode = 'fixed';
  if(modeGated&&requestedOfficeMode(state)!=='auto')params.officeMode=requestedOfficeMode(state);
  if(modeGated&&requestedOfficeMode(state)==='alleluia')delete params.templateVersion; // This branch prepares no ordinary text.
  try {
    const assignments = await request('assignments', params);
    if(assignments?.status==='office-mode-unavailable')return assignments;
    if (assignments?.context?.language !== language) throw new Error('Wrong assignment edition');
    return { ...await composeParts(template, assignments, state), fallback };
  } catch {
    signal?.throwIfAborted();
    return modeGated?{status:'error',entries:[],assignmentsStatus:'error',complete:false}:{ ...baseResult, assignmentsStatus: 'error' };
  }
}
