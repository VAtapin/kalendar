import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseMemoryDaysXml } from '../src/calendar/xml/parse-memory-days';
import { localizedReadingDescription } from '../src/calendar/localization/reading-descriptions';

describe('lection occasion translations', () => {
  it('covers every description in the XML while leaving Russian source intact', () => {
    const records = parseMemoryDaysXml(readFileSync('public/data/MemoryDays.xml', 'utf8')).records;
    const described = records.filter(r => r.description);
    expect(described).toHaveLength(138);
    const labels = [...new Set(described.map(r => r.description!))];
    expect(labels).toHaveLength(41);
    for (const label of labels) {
      expect(localizedReadingDescription(label, 'ru')).toBe(label);
      const de = localizedReadingDescription(label, 'de');
      const cu = localizedReadingDescription(label, 'cu');
      expect(de, label).not.toMatch(/\p{Script=Cyrillic}/u);
      expect(cu, label).not.toBe(label);
      expect(cu, label).toMatch(/\p{M}/u);
      expect(cu, label).not.toMatch(/(?:^|\s|[.,;:()])\p{M}/u);
    }
    expect(localizedReadingDescription('Новая пользовательская подпись', 'de')).toBe('Новая пользовательская подпись');
  });
});
