import { describe, expect, it } from 'vitest';
import { templateFor, assignmentsFor, hash } from './fixtures/worship-parts.mjs';
import { composeParts, fetchWorshipParts, validateTemplate } from '../public/calendar-ui/worship-parts.js';

const state = { office: 'sixth-hour', date: '2026-10-12', sequence: 'after-third-hour', temple: 'george-victorious', afterHourHymn: 'vzbrannoi', location: 'nave', textLanguage: 'cu-civil' };
const clone = value => structuredClone(value);
describe('source-bound worship parts', () => {
  function fixedLiturgy() {
    const template = templateFor('liturgy');
    Object.assign(template, { status: 'fixed-template', cleanTemplate: true, compositionReady: true, wholeLiturgyAccepted: false,
      profile: { id: 'ordinary-one-priest-one-deacon', rite: 'john-chrysostom' } });
    template.nodes.filter(node => node.kind !== 'slot').forEach(node => { node.kind = 'fixed'; });
    const selected = { ...state, office: 'liturgy', sequence: 'default' }, assignments = assignmentsFor(template, selected, false);
    const source = { work: 'entrance-hymn', edition: 'cu', language: 'cu', hash: 'b'.repeat(64) };
    const blocks = [{ kind: 'text', segments: [{ text: 'Назначенный тропарь после входа' }], provenance: { work: source.work, edition: source.edition, bodyHash: source.hash } }];
    const section = { schemaVersion: 1, templateId: 'entrance', templateVersion: 'c'.repeat(64), ruleVersion: 'entrance-v1', sourceVersions: [source], nodes: [template.nodes.find(node => node.nodeId === 'last')] };
    template.sections = { entrance: section };
    assignments.sourceVersions = [source];
    assignments.operations = [{ type: 'fill', nodeId: 'last', slotId: 'troparion-of-day:last', sectionId: 'entrance', sectionTemplateVersion: section.templateVersion, blocks }];
    assignments.verifiedSections = { entrance: { schemaVersion: 1, templateId: section.templateId, templateVersion: section.templateVersion,
      ruleVersion: section.ruleVersion, status: 'complete', profileStatus: 'confirmed-for-fragment', acceptance: { status: 'approved' },
      operationIndexes: [0], templateSourcesHash: hash(section.sourceVersions), composedBlocksHash: hash(blocks) } };
    return { template, assignments, selected };
  }
  it('fills a verified Liturgy section while preserving its fixed body and marking the whole service partial', async () => {
    const { template, assignments, selected } = fixedLiturgy();
    expect(validateTemplate(template, 'liturgy')).toBe(template);
    const result = await composeParts(template, assignments, selected);
    expect(result.complete).toBe(false); expect(result.outline).toBe(false);
    expect(result.entries.find(node => node.nodeId === 'last').blocks).toEqual(assignments.operations[0].blocks);
    expect(result.entries[0].blocks).toEqual(template.nodes[0].blocks);
  });
  it.each(['version','sources','digest','acceptance','indexes','missing-section'])('rejects an inconsistent Liturgy section %s', async problem => {
    const { template, assignments, selected } = fixedLiturgy(), section = assignments.verifiedSections.entrance;
    if (problem === 'version') section.templateVersion = 'd'.repeat(64);
    if (problem === 'sources') section.templateSourcesHash = 'd'.repeat(64);
    if (problem === 'digest') section.composedBlocksHash = 'd'.repeat(64);
    if (problem === 'acceptance') section.acceptance.status = 'pending';
    if (problem === 'indexes') section.operationIndexes = [0,0];
    if (problem === 'missing-section') delete assignments.operations[0].sectionId;
    await expect(composeParts(template, assignments, selected)).rejects.toThrow();
  });
  it('accepts the published clean fixed CU profile without a dated appointment flag', () => {
    const template = templateFor('third-hour');
    delete template.appointedForDate; template.cleanTemplate = template.compositionReady = true;
    expect(validateTemplate(template, 'third-hour')).toBe(template);
    template.appointedForDate = true;
    expect(() => validateTemplate(template, 'third-hour')).toThrow();
  });
  it('composes native CU operations with implicit metadata, pinned fill sources and slot removals', async () => {
    const template = templateFor(state.office), assignments = assignmentsFor(template, state);
    const source = { work: 'native-hymn', edition: 'native-cu', language: 'cu', hash: 'b'.repeat(64) };
    assignments.sourceVersions = [source];
    delete assignments.operations[0].reason;
    for (const op of assignments.operations.filter(op => op.type === 'fill')) {
      delete op.blockSources;
      op.blocks.forEach(block => { block.provenance = { work: source.work, edition: source.edition, bodyHash: source.hash }; });
    }
    const bound = template.nodes[0].blocks.map(block => ({ ...block, occurrenceId: 'native-bound' }));
    assignments.operations.push({ type: 'replace', nodeId: 'opening', blockMetadata: bound.map(({ kind, segments, ...meta }) => meta), fieldOrder: bound.map(Object.keys) });
    assignments.composedBlocksHash = hash([...bound, ...assignments.operations[1].blocks, ...assignments.operations[2].blocks, ...template.nodes.at(-1).blocks]);
    const result = await composeParts(template, assignments, state);
    expect(result.complete).toBe(true); expect(result.entries.find(entry => entry.nodeId === 'last').language).toBe('cu');
    assignments.operations[1].blocks[0].provenance.bodyHash = 'c'.repeat(64);
    await expect(composeParts(template, assignments, state)).rejects.toThrow('Unidentified operation text');
  });
  it.each(['first-hour','third-hour','sixth-hour','ninth-hour'])('requests the published ordinary CU profile for %s with matching sequence context', async office => {
    const selected = { ...state, office, textLanguage: 'cu', sequence: office === 'first-hour' ? 'after-matins' : office === 'ninth-hour' ? 'before-vespers' : office === 'third-hour' ? 'standalone' : state.sequence };
    const template = templateFor(office), urls = [];
    template.language = 'cu'; template.orthography = 'traditional';
    template.nodes.filter(node => node.kind !== 'slot').forEach(node => { node.language = 'cu'; });
    await fetchWorshipParts('https://bible.example', selected, () => {}, async url => {
      urls.push(url); const assignments = assignmentsFor(template, selected, false); assignments.context.language = 'cu';
      return { status: 200, json: async () => ({ data: url.pathname.includes('/templates/') ? template : assignments }) };
    });
    expect(urls.every(url => url.searchParams.get('profile') === 'ordinary-clergy')).toBe(true);
    if (['first-hour','ninth-hour'].includes(office)) expect(urls[0].searchParams.get('sequence')).toBe(selected.sequence);
    else expect(urls[0].searchParams.has('sequence')).toBe(false);
    if (office === 'first-hour') expect(urls[0].searchParams.get('afterHourHymn')).toBe(selected.afterHourHymn);
    if (office === 'ninth-hour') expect(urls[0].searchParams.get('location')).toBe(selected.location);
  });
  it.each(['first-hour', 'third-hour', 'sixth-hour', 'ninth-hour', 'matins', 'vespers'])('accepts the published source outline for %s without choosing branches', async office => {
    const template = templateFor('liturgy');
    template.templateId = office + ':clergy-source-outline:cu'; template.profile = {};
    template.language = 'cu'; template.orthography = 'traditional';
    template.nodes.filter(node => node.kind !== 'slot').forEach(node => { node.language = 'cu'; node.orthography = 'traditional'; });
    const selected = { ...state, office, textLanguage: 'cu', sequence: 'standalone' };
    const result = await fetchWorshipParts('https://bible.example', selected, () => {}, async url => {
      const assignments = assignmentsFor(template, selected, false); assignments.context.language = 'cu';
      return { status: 200, json: async () => ({ data: url.pathname.includes('/templates/') ? template : assignments }) };
    });
    expect(result.outline).toBe(true); expect(result.assignmentsStatus).toBe('partial');
    expect(result.entries.filter(node => !node.missing).flatMap(node => node.blocks)).toEqual(template.nodes.filter(node => node.kind !== 'slot').flatMap(node => node.blocks));
  });
  it('rejects a source outline belonging to a different service', () => {
    expect(() => validateTemplate(templateFor('liturgy'), 'vespers')).toThrow();
  });
  it('preserves the existing John Chrysostom Liturgy template identity', () => {
    const template = templateFor('liturgy'); template.templateId = 'liturgy-john-chrysostom:clergy-source-outline:cu';
    expect(validateTemplate(template, 'liturgy')).toBe(template);
  });
  it.each(['first-hour', 'matins', 'vespers'])('accepts the normalized temple profile ID for %s but rejects a different dedication', async office => {
    const selected = { ...state, office, sequence: office === 'first-hour' ? 'after-matins' : 'standalone' }, template = templateFor(office);
    const assignments = assignmentsFor(template, selected, false);
    delete assignments.context.temple; assignments.context.templeProfile = { id: selected.temple };
    expect((await composeParts(template, assignments, selected)).assignmentsStatus).toBe('partial');
    assignments.context.templeProfile.id = 'nicholas';
    await expect(composeParts(template, assignments, selected)).rejects.toThrow();
  });
  it.each(['matins', 'vespers'])('sends the selected temple for %s and retains its CU source on a mismatched response', async office => {
    const selected = { ...state, office, textLanguage: 'cu', sequence: 'vigil', temple: 'nicholas' };
    const template = templateFor('liturgy');
    template.templateId = office + ':clergy-source-outline:cu'; template.profile = {};
    template.language = 'cu'; template.orthography = 'traditional';
    template.nodes.filter(node => node.kind !== 'slot').forEach(node => { node.language = 'cu'; });
    let wrongTemple = false;
    const fetcher = async url => {
      const assignments = assignmentsFor(template, selected, false); assignments.context.language = 'cu';
      if (url.pathname.includes('/assignments/')) {
        expect(url.searchParams.get('temple')).toBe('nicholas');
        expect(url.searchParams.get('sequence')).toBe('vigil');
        assignments.context.temple = wrongTemple ? 'dormition' : 'nicholas';
      }
      return { status: 200, json: async () => ({ data: url.pathname.includes('/templates/') ? template : assignments }) };
    };
    expect((await fetchWorshipParts('https://bible.example', selected, () => {}, fetcher)).assignmentsStatus).toBe('partial');
    wrongTemple = true;
    const result = await fetchWorshipParts('https://bible.example', selected, () => {}, fetcher);
    expect(result.assignmentsStatus).toBe('error');
    expect(result.entries.filter(node => !node.missing).flatMap(node => node.blocks)).toEqual(template.nodes.filter(node => node.kind !== 'slot').flatMap(node => node.blocks));
  });
  it.each(['sixth-hour', 'liturgy'])('prioritizes actual traditional text for %s automatically', async office => {
    const selected = { ...state, office, sequence: office === 'liturgy' ? 'default' : state.sequence, textLanguage: 'auto' };
    const template = templateFor(office);
    template.language = 'cu'; template.orthography = 'traditional';
    template.nodes.filter(node => node.kind !== 'slot').forEach(node => { node.language = 'cu'; node.orthography = 'traditional'; });
    const urls = [];
    const result = await fetchWorshipParts('https://bible.example', selected, () => {}, async url => {
      urls.push(url); const assignments = assignmentsFor(template, selected, false); assignments.context.language = 'cu';
      return { status: 200, json: async () => ({ data: url.pathname.includes('/templates/') ? template : assignments }) };
    });
    expect(urls.every(url => url.searchParams.get('language') === 'cu')).toBe(true);
    expect(result.entries[0].language).toBe('cu'); expect(result.fallback).toBe(false);
  });
  it('falls back only for explicit unsupported-language validation and announces it', async () => {
    const selected = { ...state, textLanguage: 'auto' }, template = templateFor(state.office), urls = [];
    const result = await fetchWorshipParts('https://bible.example', selected, () => {}, async url => {
      urls.push(url);
      if (url.searchParams.get('language') === 'cu') return { status: 422, json: async () => ({ errors: { language: ['validation.in'] } }) };
      return { status: 200, json: async () => ({ data: url.pathname.includes('/templates/') ? template : assignmentsFor(template, selected, false) }) };
    });
    expect(urls.map(url => url.searchParams.get('language'))).toEqual(['cu', 'cu-civil', 'cu-civil']);
    expect(result.fallback).toBe(true);
  });
  it('keeps an explicit unavailable language selected without substituting civil text', async () => {
    let calls = 0;
    const result = await fetchWorshipParts('https://bible.example', { ...state, textLanguage: 'cu' }, () => {}, async () => {
      calls++; return { status: 422, json: async () => ({ errors: { language: ['validation.in'] } }) };
    });
    expect(calls).toBe(1); expect(result.status).toBe('edition-unavailable');
  });
  it('rejects a civil template disguised as a response to traditional selection', async () => {
    await expect(fetchWorshipParts('https://bible.example', { ...state, textLanguage: 'cu' }, () => {}, async () => ({ status: 200, json: async () => ({ data: templateFor(state.office) }) }))).rejects.toThrow('Wrong template edition');
  });
  it.each([403, 429, 503, 422])('does not change edition on general HTTP %s errors', async status => {
    let calls = 0;
    await expect(fetchWorshipParts('https://bible.example', { ...state, textLanguage: 'auto' }, () => {}, async () => {
      calls++; return { status, json: async () => ({ errors: { date: ['validation.date'] } }) };
    })).rejects.toThrow();
    expect(calls).toBe(1);
  });
  it('keeps the entire fixed base and marks all missing slots on an unconfirmed day', async () => {
    const template = templateFor(state.office), assignments = assignmentsFor(template, state, false);
    const result = await composeParts(template, assignments, state);
    expect(result.complete).toBe(false);
    expect(result.entries.filter(entry => entry.missing).map(entry => entry.slotId)).toEqual(['troparion-of-day:leading', 'troparion-of-day:last', 'kontakion-of-day']);
    expect(result.entries.filter(entry => !entry.missing).flatMap(entry => entry.blocks)).toEqual([...template.nodes[0].blocks, ...template.nodes.at(-1).blocks]);
  });
  it('applies fill/remove and preserves source order and already expanded repetitions', async () => {
    const template = templateFor(state.office), assignments = assignmentsFor(template, state);
    const result = await composeParts(template, assignments, state);
    expect(result.complete).toBe(true);
    expect(result.entries.flatMap(entry => entry.blocks).map(block => block.segments.map(segment => segment.text).join(''))).toEqual([
      'sixth-hour', 'Священник: Благослове́н Бог наш. <script>unsafe</script>', 'Го́споди, поми́луй.', 'Го́споди, поми́луй.',
      'Тропарь 2026-10-12', 'Кондак 2026-10-12', 'Необязательное окончание',
    ]);
  });
  it('removes a fixed prayer only through the returned backend operation, including partial context', async () => {
    const selected = { ...state, office: 'ninth-hour', sequence: 'before-vespers', location: 'nave' };
    const template = templateFor(selected.office), assignments = assignmentsFor(template, selected, false);
    assignments.operations = [{ type: 'remove', nodeId: 'optional', reason: 'explicit-profile' }];
    expect((await composeParts(template, assignments, selected)).entries.some(entry => entry.nodeId === 'optional')).toBe(false);
    assignments.operations = [];
    expect((await composeParts(template, assignments, selected)).entries.some(entry => entry.nodeId === 'optional')).toBe(true);
  });
  it('applies metadata-only bindings without replacing source text and verifies the full digest', async () => {
    const template = templateFor(state.office), assignments = assignmentsFor(template, state);
    const expected = template.nodes[0].blocks.map(block => ({ ...block, role: 'reader', occurrenceId: 'bound' }));
    assignments.operations.unshift({ type: 'replace', nodeId: 'opening', metadataOnly: true,
      blockMetadata: expected.map(({ kind, segments, ...meta }) => meta), fieldOrder: expected.map(Object.keys) });
    assignments.composedBlocksHash = hash([...expected, ...assignments.operations[2].blocks, ...assignments.operations[3].blocks, ...template.nodes.at(-1).blocks]);
    const result = await composeParts(template, assignments, state);
    expect(result.entries[0].blocks).toEqual(expected);
    expect(result.entries[0].blocks[0].segments).toEqual(template.nodes[0].blocks[0].segments);
  });
  it('replaces a prayer without leaving both alternatives and uses the actual edition of an inserted text', async () => {
    const template = templateFor(state.office), assignments = assignmentsFor(template, state);
    const replacement = { kind: 'text', segments: [{ text: 'Молитва по выбранному чину', style: 'text' }] };
    assignments.operations.push({ type: 'replace', nodeId: 'optional', blocks: [replacement], blockSources: [{ language: 'cu-civil', orthography: 'civil' }] });
    assignments.operations[1].blockSources[0] = { language: 'cu', orthography: 'traditional' };
    assignments.composedBlocksHash = hash([...template.nodes[0].blocks, ...assignments.operations[1].blocks, ...assignments.operations[2].blocks, replacement]);
    const result = await composeParts(template, assignments, state);
    expect(result.entries.find(entry => entry.nodeId === 'last').language).toBe('cu');
    expect(result.entries.flatMap(entry => entry.blocks).at(-1)).toEqual(replacement);
    expect(JSON.stringify(result.entries)).not.toContain('Необязательное окончание');
  });
  it.each(['version', 'sources', 'date', 'slot', 'node', 'digest', 'binding'])('rejects inconsistent %s rather than inserting wrong-day material', async problem => {
    const template = templateFor(state.office), assignments = assignmentsFor(template, state);
    if (problem === 'version') assignments.templateVersion = 'b'.repeat(64);
    if (problem === 'sources') assignments.templateSourcesHash = 'b'.repeat(64);
    if (problem === 'date') assignments.context.date = '2026-10-11';
    if (problem === 'slot') assignments.operations[1].slotId = 'different-slot';
    if (problem === 'node') assignments.operations[1].nodeId = 'absent';
    if (problem === 'digest') assignments.composedBlocksHash = 'b'.repeat(64);
    if (problem === 'binding') assignments.operations.push({ type: 'replace', nodeId: 'opening', metadataOnly: true, blockMetadata: [], fieldOrder: [] });
    await expect(composeParts(template, assignments, state)).rejects.toThrow();
  });
  it('rejects duplicate nodes and operations', async () => {
    const template = templateFor(state.office), assignments = assignmentsFor(template, state);
    const invalid = clone(template); invalid.nodes.push(clone(invalid.nodes[0]));
    expect(() => validateTemplate(invalid, state.office)).toThrow();
    assignments.operations.push(clone(assignments.operations[0]));
    await expect(composeParts(template, assignments, state)).rejects.toThrow();
  });
  it('shows source outline as a book and never interprets anchors as insertion operations', async () => {
    const selected = { ...state, office: 'liturgy', sequence: 'default' }, template = templateFor('liturgy');
    const result = await composeParts(template, assignmentsFor(template, selected, false), selected);
    expect(result.outline).toBe(true); expect(result.complete).toBe(false);
    const assignments = assignmentsFor(template, selected, true);
    await expect(composeParts(template, assignments, selected)).rejects.toThrow();
  });
  it.each([409, 422, 429, 503])('renders the fixed base before the daily HTTP %s error and keeps it afterwards', async code => {
    const template = templateFor(state.office), seen = [], urls = [];
    const result = await fetchWorshipParts('https://bible.example', state, base => seen.push(base), async url => {
      urls.push(url);
      return url.pathname.includes('/templates/') ? { status: 200, json: async () => ({ data: template }) } : { status: code };
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].entries[0].blocks).toEqual(template.nodes[0].blocks);
    expect(result.assignmentsStatus).toBe('error');
    expect(result.entries).toEqual(seen[0].entries);
    expect(urls).toHaveLength(2);
    expect(urls[0].searchParams.has('date')).toBe(false);
    expect(urls[1].searchParams.get('templateVersion')).toBe(template.templateVersion);
  });
  it('does not display private or corrupt template bodies', async () => {
    await expect(fetchWorshipParts('https://bible.example', state, () => { throw new Error('Must not render'); }, async () => ({ status: 409 }))).rejects.toThrow();
    const template = templateFor(state.office); template.nodes[0].blocks[0].segments = null;
    expect(() => validateTemplate(template, state.office)).toThrow();
  });
});
