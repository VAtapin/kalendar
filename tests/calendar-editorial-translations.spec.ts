import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GERMAN_COMMEMORATIONS } from '../src/calendar/localization/german-commemorations';
import { localizeCalendarEventTitleWithStatus } from '../src/calendar/localization/calendar-language';
import { installSlavonicCorpus } from '../src/calendar/localization/slavonic-corpus';
import { parseMemoryDaysXml } from '../src/calendar/xml/parse-memory-days';
const records = parseMemoryDaysXml(readFileSync('public/data/MemoryDays.xml','utf8')).records;
const titles = new Set(records.map(r => r.title));
const additions = JSON.parse(readFileSync('public/data/church-slavonic/editorial-additions.json','utf8')).entries as {ru:string;cu:string;note:string;sourceId:string}[];
describe('editorial German and Church Slavonic additions', () => {
  it('translates real full XML titles, preserving every Arabic historical number', () => {
    for (const [ru,de] of Object.entries(GERMAN_COMMEMORATIONS)) {
      expect(titles.has(ru), ru).toBe(true);
      expect(de.match(/\d+/g) ?? [],ru).toEqual(ru.match(/\d+/g) ?? []);
      expect(de,ru).not.toMatch(/\p{Script=Cyrillic}/u);
      expect(localizeCalendarEventTitleWithStatus(ru,'de')).toEqual({title:de,status:'exact'});
    }
  });
  it('publishes annotated Slavonic additions with diacritics and no orphan combining marks', () => {
    installSlavonicCorpus(JSON.parse(readFileSync('public/data/church-slavonic/catalogue.json','utf8')));
    for (const entry of additions) {
      expect(titles.has(entry.ru)).toBe(true);
      expect(entry.note.length).toBeGreaterThan(20);
      expect(entry.cu).toMatch(/\p{M}/u);
      expect(entry.cu).not.toMatch(/(?:^|\s|[.,;:()])\p{M}/u);
      expect(entry.cu.match(/\d+/g) ?? []).toEqual(entry.ru.match(/\d+/g) ?? []);
      expect(localizeCalendarEventTitleWithStatus(entry.ru,'cu')).toEqual({title:entry.cu,status:'exact'});
    }
  });
  it('does not translate a different historical year by removing it from a key', () => {
    expect(localizeCalendarEventTitleWithStatus('Прп. Антония Великого (9999)','de').status).toBe('source-fallback');
  });
});
