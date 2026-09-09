import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GERMAN_COMMEMORATIONS } from '../src/calendar/localization/german-commemorations';
import slavonicEditorialTitles from '../src/calendar/localization/slavonic-editorial-titles.json';
import { localizeCalendarEventTitleWithStatus } from '../src/calendar/localization/calendar-language';
import { installSlavonicCorpus } from '../src/calendar/localization/slavonic-corpus';
import { parseMemoryDaysXml } from '../src/calendar/xml/parse-memory-days';
const records = parseMemoryDaysXml(readFileSync('public/data/MemoryDays.xml','utf8')).records;
const titles = new Set(records.map(r => r.title));
const additions = JSON.parse(readFileSync('public/data/church-slavonic/editorial-additions.json','utf8')).entries as {ru:string;cu:string;note:string;sourceId:string}[];
describe('editorial German and Church Slavonic additions', () => {
  it('covers every full German commemoration title in the current XML', () => {
    const commemorations = records.filter(r => ![10, 20, 100].includes(r.typeCode) && r.typeCode < 200);
    expect(new Set(commemorations.map(r => r.title)).size).toBe(2532);
    for (const record of commemorations) {
      const translated = localizeCalendarEventTitleWithStatus(record.title, 'de');
      expect(translated.status, `XML ${record.sourceIndex}: ${record.title}`).not.toBe('source-fallback');
      expect(translated.title, record.title).not.toMatch(/\p{Script=Cyrillic}/u);
    }
  });
  it('uses original CU translations only for exact full XML keys and preserves numbers', () => {
    installSlavonicCorpus(JSON.parse(readFileSync('public/data/church-slavonic/catalogue.json','utf8')));
    for(const [ru,cu] of Object.entries(slavonicEditorialTitles)) {
      expect(titles.has(ru),ru).toBe(true);
      expect(cu.match(/\d+/g)??[],ru).toEqual(ru.match(/\d+/g)??[]);
      expect(cu,ru).toMatch(/\p{M}/u);
      expect(cu,ru).not.toMatch(/(?:^|\s|[.,;:()])\p{M}/u);
      expect(cu.replace(/\b[IVXLCDM]+\b/g,''),ru).not.toMatch(/\p{Script=Latin}/u);
      for(const word of cu.match(/[\p{L}\p{M}]+/gu)??[]) {
        expect((word.match(/[\u0300\u0301\u0311]/g)??[]).length,`${ru}: ${word}`).toBeLessThanOrEqual(1);
      }
      expect(cu.match(/\b[IVXLCDM]+\b/g)??[],ru).toEqual(ru.match(/\b[IVXLCDM]+\b/g)??[]);
      // Original editorial titles are a separate layer, not a claim of source quotation.
      expect(localizeCalendarEventTitleWithStatus(ru,'cu'),ru).toEqual({title:cu,status:'exact'});
    }
  });
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
