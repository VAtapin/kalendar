import { describe, expect, it } from 'vitest';
import { compactRepetitions, repetitionEntries, repetitionNumber } from '../public/calendar-ui/worship-repeats.js';

const repeat = (count, group = 'hour:11:0') => Array.from({ length: count }, (_, index) => ({
  kind: 'text', role: 'reader', slot: 'lord-have-mercy', segments: [{ text: 'Гдⷭ҇и поми́лꙋй,', style: 'text' }],
  provenance: { work: 'hour', block: 21 }, occurrenceId: group + ':' + index, repeatIndex: index + 1, repeatCount: count,
}));

describe('liturgical repetition presentation', () => {
  it.each([[3,'г҃'],[12,'ві҃'],[40,'м҃'],[11,'аі҃'],[19,'ѳі҃'],[21,'ка҃'],[100,'р҃']])('writes %i in traditional Slavonic cifir', (count, expected) => {
    expect(repetitionNumber(count, 'cu')).toBe(expected);
    expect(repetitionNumber(count, 'cu-civil')).toBe(String(count));
    expect(repetitionNumber(count, 'ru')).toBe(String(count));
  });
  it.each([3,12,40])('shows %i explicit copies as one line without changing source blocks', count => {
    const blocks = repeat(count), before = structuredClone(blocks);
    expect(compactRepetitions(blocks)).toEqual([{ block: blocks[0], count }]);
    expect(blocks).toEqual(before);
  });
  it.each(['missing-copy','wrong-index','different-voice','different-text','different-source','different-group'])('preserves an inconsistent group: %s', problem => {
    const blocks = repeat(3);
    if (problem === 'missing-copy') blocks.pop();
    if (problem === 'wrong-index') blocks[1].repeatIndex = 3;
    if (problem === 'different-voice') blocks[1].role = 'choir';
    if (problem === 'different-text') blocks[1].segments[0].text = 'Другой ответ';
    if (problem === 'different-source') blocks[1].provenance.block = 22;
    if (problem === 'different-group') blocks[1].occurrenceId = 'other:1';
    expect(compactRepetitions(blocks).every(item => item.count === 1)).toBe(true);
  });
  it('keeps separate occurrences and unannotated identical responses separate', () => {
    expect(compactRepetitions([...repeat(3), ...repeat(3,'hour:29:0')]).map(item => item.count)).toEqual([3,3]);
    const blocks = [{ kind: 'text', segments: [{ text: 'Аминь.' }] }, { kind: 'text', segments: [{ text: 'Аминь.' }] }];
    expect(compactRepetitions(blocks).map(item => item.count)).toEqual([1,1]);
  });
  it('joins split fill entries only inside one language, node and voice, keeping sources untouched', () => {
    const entries = repeat(3).map(block => ({ nodeId: 'fill', kind: 'fixed', language: 'cu', role: 'choir', blocks: [block] }));
    const before = structuredClone(entries), joined = repetitionEntries(entries);
    expect(compactRepetitions(joined[0].blocks)[0].count).toBe(3);
    expect(entries).toEqual(before);
    for (const field of ['nodeId','language','role','section','parallelGroup','delivery']) {
      const changed = structuredClone(entries); changed[1][field] = 'other';
      expect(repetitionEntries(changed)).toHaveLength(3);
    }
  });
});
