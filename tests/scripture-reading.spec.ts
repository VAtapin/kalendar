import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseScriptureReading } from '../src/calendar/api/scripture-reading';
import { createCalendarPublicApi, createOrthodoxCalendarApiFromXml } from '../src/calendar';
import { parseMemoryDaysXml } from '../src/calendar/xml/parse-memory-days';

const compact = (title: string) => parseScriptureReading(title).passages.map(p =>
  `${p.book} ${p.start.chapter}:${p.start.verse}-${p.end.chapter}:${p.end.verse}`);

describe('structured scripture readings', () => {
  it.each([
    ['Гал.2:21-3:7', ['Gal 2:21-3:7']],
    ['Мф.21:1-11,15-17', ['Matt 21:1-21:11', 'Matt 21:15-21:17']],
    ['Евр.12:25-26,13:22-25', ['Heb 12:25-12:26', 'Heb 13:22-13:25']],
    ['Деян.6:8-7:5,47-60', ['Acts 6:8-7:5', 'Acts 7:47-7:60']],
    ['Гал.1:1-10,20-2:5', ['Gal 1:1-1:10', 'Gal 1:20-2:5']],
    ['1 Пет.1:1-2,10-12,2:6-10', ['1Pet 1:1-1:2', '1Pet 1:10-1:12', '1Pet 2:6-2:10']],
    ['Гал.6:14-18; Мф.27:1-56', ['Gal 6:14-6:18', 'Matt 27:1-27:56']],
    ['Пс.118', ['Ps 118:null-118:null']],
    ['Пс.1-8', ['Ps 1:null-8:null']],
    ['1\u00a0Пет.\u00a01:1—2,10–12', ['1Pet 1:1-1:2', '1Pet 1:10-1:12']],
    ['Гал.1:2,1,2; Гал.1:2', ['Gal 1:2-1:2', 'Gal 1:1-1:1', 'Gal 1:2-1:2', 'Gal 1:2-1:2']],
    ['Двенадцать Евангелий святых страстей Иисуса Христа: Ин.13:31-18:1; Ин.18:1-28', ['John 13:31-18:1', 'John 18:1-18:28']],
  ])('parses %s without changing order', (title, expected) => {
    expect(compact(title as string)).toEqual(expected);
    expect(parseScriptureReading(title as string)).toMatchObject({schemaVersion: 1, parseStatus: 'parsed', numbering: 'unknown', issues: []});
  });

  it.each(['Неизв.1:1', 'Гал.3:7-2:21', 'Гал.2:7-2', 'Гал.0:1', 'Гал.1:0', 'Гал.9007199254740992:1', 'Гал.зачало 203', '', 'Пс.8-1'])('rejects unsafe coordinates: %s', title => {
    const result = parseScriptureReading(title);
    expect(result.parseStatus).toBe('unparsed');
    expect(result.passages).toEqual([]);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('retains errors and does not infer a chapter after a broken segment', () => {
    const result = parseScriptureReading('Гал.1:1-2,ошибка,4-5,2:1; Неизв.1:1');
    expect(result.parseStatus).toBe('partial');
    expect(compact('Гал.1:1-2,ошибка,4-5,2:1; Неизв.1:1')).toEqual(['Gal 1:1-1:2', 'Gal 2:1-2:1']);
    expect(result.issues.map(i => i.sourceFragment)).toEqual(['ошибка', '4-5', ' Неизв.1:1']);
  });

  it('uses source titles in localized day and year responses', () => {
    const xml = '<MemoryDays><event><s_month>1</s_month><s_date>1</s_date><f_month>1</f_month><f_date>1</f_date><name>Гал.2:21-3:7</name><type>204</type></event><event><s_month>1</s_month><s_date>1</s_date><f_month>1</f_month><f_date>1</f_date><name>Праздник</name><type>1</type></event></MemoryDays>';
    const engine = createOrthodoxCalendarApiFromXml(xml);
    for (const language of ['ru', 'cu', 'de', 'uk', 'pl'] as const) {
      const api = createCalendarPublicApi(engine, language);
      const day = api.getDay({year: 2027, month: 1, day: 14})!;
      expect(day.events.find(e => e.typeCode === 204)?.reading).toEqual(parseScriptureReading('Гал.2:21-3:7'));
      expect(day.events.find(e => e.typeCode === 1)?.reading).toBeNull();
      expect(api.getYear(2027).days.find(d => d.date === day.date)?.events).toEqual(day.events);
    }
  });

  it('audits every source reading and reports unresolved records', () => {
    const records = parseMemoryDaysXml(readFileSync('public/data/MemoryDays.xml', 'utf8')).records.filter(r => r.typeCode >= 200);
    const rows = records.map(r => ({id: r.id, sourceIndex: r.sourceIndex, title: r.title, reading: parseScriptureReading(r.title)}));
    const counts = {parsed: 0, partial: 0, unparsed: 0};
    rows.forEach(row => counts[row.reading.parseStatus]++);
    console.info(JSON.stringify({scriptureReadingAudit: counts, unresolved: rows.filter(row => row.reading.parseStatus !== 'parsed')}));
    expect(rows.length).toBeGreaterThan(500);
    expect(counts.parsed + counts.partial + counts.unparsed).toBe(rows.length);
    for (const row of rows) {
      expect(row.reading.parseStatus === 'parsed' ? row.reading.issues.length === 0 : row.reading.issues.length > 0).toBe(true);
    }
  });
});
