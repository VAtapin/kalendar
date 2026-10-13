// Connect the published source-bound templates and explicit daily operations.
// Calendar rules and the choice of prayers remain entirely in Bible Desktop.
export function sourceLanguage(item) {
  if (item?.language === 'cu' && ['civil', 'civil-accented'].includes(item.orthography)) return 'cu-civil';
  return ['cu', 'cu-civil', 'ru'].includes(item?.language) ? item.language : null;
}

export async function partsHash(value) {
  const json = JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

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
  const fixed = template?.artifactType === 'fixed-template' && template.status === 'fixed-complete' && template.profile?.office === office;
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
  if (context?.date !== state.date || context.office !== state.office || context.calendarStyle !== 'julian'
    || (state.sequence !== 'default' && context.sequence !== state.sequence)
    || (['first-hour', 'ninth-hour', 'liturgy'].includes(state.office) && (context.temple ?? context.templeProfile?.id) !== state.temple)
    || !['complete', 'partial', 'not-appointed'].includes(assignments.status)
    || !Array.isArray(assignments.operations) || !Array.isArray(assignments.missing)) throw new Error('Invalid dated assignments');
  const outline = template.status === 'source-outline';
  if (outline && (assignments.status === 'complete' || assignments.operations.length)) throw new Error('Outline is not a composable rite');
  const nodes = new Map(template.nodes.map(node => [node.nodeId, node])), operations = new Map();
  for (const original of assignments.operations) {
    const operation = { ...original };
    if (operation.type === 'replace' && operation.blocks === undefined && Array.isArray(operation.blockMetadata)
      && Array.isArray(operation.fieldOrder)) operation.metadataOnly = true;
    if (operation.type === 'fill' && operation.blockSources === undefined && Array.isArray(operation.blocks)) {
      operation.blockSources = operation.blocks.map(block => {
        const provenance = block?.provenance;
        const matches = (assignments.sourceVersions || []).filter(source => source.work === provenance?.work
          && source.edition === provenance?.edition && source.hash === provenance?.bodyHash);
        return matches.length === 1 ? matches[0] : null;
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
      language: sourceLanguage(op.blockSources[index]), blocks: [block] }));
  });
  if (assignments.status === 'complete') {
    if (assignments.missing.length || entries.some(entry => entry.missing)
      || assignments.completeness?.appointment !== true || assignments.completeness?.composition !== true
      || await partsHash(entries.flatMap(entry => entry.blocks)) !== assignments.composedBlocksHash) throw new Error('Composition mismatch');
  }
  return { status: 'parts', template, entries, assignmentsStatus: assignments.status,
    complete: assignments.status === 'complete', outline, profileStatus: assignments.profileStatus };
}

export async function fetchWorshipParts(base, state, onBase = () => {}, fetcher = fetch) {
  const request = async (path, params = {}) => {
    const url = new URL('/api/v1/liturgical/' + path + '/' + state.office, base);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetcher(url, { credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
    if (response.status === 422 && path === 'templates') {
      const value = await response.json();
      // The published API validates the supported edition through errors.language.
      // Other validation errors must never trigger a language substitution.
      if (value.errors && Object.keys(value.errors).length === 1 && Array.isArray(value.errors.language)
        && value.errors.language.length && value.errors.language.every(error => error === 'validation.in')) return null;
    }
    if (response.status !== 200) throw new Error('Worship parts request failed: ' + response.status);
    return (await response.json()).data;
  };
  const requested = state.textLanguage || 'auto';
  if (!['auto', 'cu', 'cu-civil', 'ru'].includes(requested)) throw new Error('Invalid text language');
  let template, language;
  const hour = ['first-hour', 'third-hour', 'sixth-hour', 'ninth-hour'].includes(state.office);
  const hourContext = state.office === 'first-hour' ? { matinsDismissalDone: '1', afterHourHymn: state.afterHourHymn }
    : state.office === 'ninth-hour' && state.sequence === 'before-vespers' ? { nextOffice: 'vespers', location: state.location } : {};
  for (const candidate of requested === 'auto' ? ['cu', 'cu-civil', 'ru'] : [requested]) {
    const profile = candidate === 'cu' && hour ? { profile: 'ordinary-clergy',
      ...(['first-hour', 'ninth-hour'].includes(state.office) ? { sequence: state.sequence, ...hourContext } : {}) } : {};
    const value = await request('templates', { language: candidate, ...profile });
    if (value === null) continue;
    template = validateTemplate(value, state.office);
    const sources = template.nodes.filter(node => node.kind !== 'slot');
    if (sources.some(node => sourceLanguage(node.language ? node : template) !== candidate)) throw new Error('Wrong template edition');
    language = candidate; break;
  }
  if (!template) return { status: 'edition-unavailable' };
  const fallback = requested === 'auto' && language !== 'cu';
  const baseResult = { status: 'parts', template, entries: baseEntries(template), assignmentsStatus: 'loading',
    complete: false, outline: template.status === 'source-outline', fallback };
  onBase(baseResult);
  const params = { date: state.date, sequence: state.sequence, calendarStyle: 'julian', templateVersion: template.templateVersion, language };
  if (language === 'cu' && hour) params.profile = 'ordinary-clergy';
  if (['first-hour', 'ninth-hour', 'liturgy'].includes(state.office)) params.temple = state.temple;
  if (state.office === 'first-hour') Object.assign(params, { matinsDismissalDone: '1', afterHourHymn: state.afterHourHymn });
  if (state.office === 'ninth-hour' && state.sequence === 'before-vespers') Object.assign(params, { nextOffice: 'vespers', location: state.location });
  try {
    const assignments = await request('assignments', params);
    if (assignments?.context?.language !== language) throw new Error('Wrong assignment edition');
    return { ...await composeParts(template, assignments, state), fallback };
  } catch {
    return { ...baseResult, assignmentsStatus: 'error' };
  }
}
