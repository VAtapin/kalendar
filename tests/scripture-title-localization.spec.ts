import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseMemoryDaysXml } from '../src/calendar/xml/parse-memory-days';
import { localizeScriptureTitle } from '../src/calendar/localization/scripture-titles';
import { localizeCalendarEventTitleWithStatus } from '../src/calendar/localization/calendar-language';
const readings = parseMemoryDaysXml(readFileSync('public/data/MemoryDays.xml','utf8')).records.filter(r=>r.typeCode>=200);
describe('localized reading references',()=>{
  it('covers every XML fasting and marriage label in German and Slavonic',()=>{
    const rules = parseMemoryDaysXml(readFileSync('public/data/MemoryDays.xml','utf8')).records.filter(r=>[10,20,100].includes(r.typeCode));
    expect(rules).toHaveLength(45);
    for (const rule of rules) for (const language of ['de','cu'] as const) {
      const result = localizeCalendarEventTitleWithStatus(rule.title,language);
      expect(result.status,rule.title).not.toBe('source-fallback');
    }
  });
  for (const language of ['de','cu']) it(`covers all 1205 reading titles in ${language} without changing numbers or ranges`,()=>{
    expect(readings).toHaveLength(1205);
    for (const reading of readings) {
      const localized = localizeScriptureTitle(reading.title,language);
      expect(localized,reading.title).toBeDefined();
      expect(localized!.match(/\d+/g)).toEqual(reading.title.match(/\d+/g));
      expect(localized!.match(/[:;,–—-]/g)).toEqual(reading.title.match(/[:;,–—-]/g));
    }
  });
  it('rejects unknown books and untranslated trailing commentary as a whole',()=>{
    expect(localizeScriptureTitle('Неизвестная.1:2','de')).toBeUndefined();
    expect(localizeScriptureTitle('Мф.1:2; неизвестное примечание','cu')).toBeUndefined();
  });
});
