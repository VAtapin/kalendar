import { describe, expect, it } from 'vitest';
import { templateFor, assignmentsFor, hash } from './fixtures/worship-parts.mjs';
import { composeParts, fetchWorshipParts, validateTemplate } from '../public/calendar-ui/worship-parts.js';

const state = { office: 'sixth-hour', date: '2026-10-12', sequence: 'after-third-hour', temple: 'george-victorious', afterHourHymn: 'vzbrannoi', location: 'nave' };
const clone = value => structuredClone(value);
describe('source-bound worship parts', () => {
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
