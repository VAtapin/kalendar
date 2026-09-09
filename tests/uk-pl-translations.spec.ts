import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import uk from '../src/calendar/localization/uk-commemorations.json';
import pl from '../src/calendar/localization/pl-commemorations.json';
import { parseMemoryDaysXml } from '../src/calendar/xml/parse-memory-days';
import { localizeCalendarEventTitleWithStatus } from '../src/calendar/localization/calendar-language';

const records = parseMemoryDaysXml(readFileSync('public/data/MemoryDays.xml', 'utf8')).records;
const commemorations = records.filter(r => ![10, 20, 100].includes(r.typeCode) && r.typeCode < 200);
describe('ordinary Ukrainian and Polish calendar translations', () => {
  for (const [language, dictionary] of [['uk', uk], ['pl', pl]] as const) {
    it(`${language}: covers every XML commemoration without changing historical numbers`, () => {
      expect(Object.keys(dictionary)).toHaveLength(2532);
      const entries: Record<string, string> = dictionary;
      for (const record of commemorations) {
        const value = entries[record.title]!;
        expect(value, `XML ${record.sourceIndex}`).toBeTruthy();
        expect(value.match(/\d+/g) ?? [], record.title).toEqual(record.title.match(/\d+/g) ?? []);
        if (language === 'pl') expect(value, record.title).not.toMatch(/\p{Script=Cyrillic}/u);
        expect(localizeCalendarEventTitleWithStatus(record.title, language), record.title).toEqual({ title: value, status: 'exact' });
      }
    });
    it(`${language}: covers readings and rules as well as full commemoration titles`, () => {
      for (const record of records) {
        expect(localizeCalendarEventTitleWithStatus(record.title, language).status, `XML ${record.sourceIndex}: ${record.title}`).not.toBe('source-fallback');
      }
    });
    it(`${language}: preserves every chapter and verse number in reading references`, () => {
      for (const record of records.filter(r => r.typeCode >= 200)) {
        const translated = localizeCalendarEventTitleWithStatus(record.title, language);
        expect(translated.title.match(/\d+/g) ?? [], record.title).toEqual(record.title.match(/\d+/g) ?? []);
      }
    });
    it(`${language}: does not invent a translation for unknown custom text`, () => {
      expect(localizeCalendarEventTitleWithStatus('Мой неизвестный праздник 9999', language)).toEqual({ title: 'Мой неизвестный праздник 9999', status: 'source-fallback' });
    });
  }
});
