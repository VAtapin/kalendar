import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createOrthodoxCalendarApiFromXml, calculateFastingDay, calculateFastingPeriods} from '../src/calendar/fasting/fasting-api';
import {toIsoDate} from '../src/calendar/date/calendar-date';
import {localizeCalendarEvent} from '../src/calendar/localization/calendar-language';
import {installSlavonicCorpus} from '../src/calendar/localization/slavonic-corpus';
import {dayNumberTypikonStyle} from '../src/calendar/presentation/typikon-style';
import type {CalendarLanguage} from '../src/document/types';
import type {FastingProfileId} from '../src/calendar/fasting/fasting-api';

// Read-only audit. No adapter or alternate calendar implementation is installed.
const bibleRoot = resolve(process.env.BIBLE_DESKTOP_ROOT || '../BibleDesktop');
const runtime = resolve(bibleRoot, 'resources/calendar-engine/api/calendar-runtime.mjs');
const xml = readFileSync('public/data/MemoryDays.xml', 'utf8');
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
installSlavonicCorpus(JSON.parse(readFileSync('public/data/church-slavonic/catalogue.json', 'utf8')));
const local = createOrthodoxCalendarApiFromXml(xml);
const cases: {year: number; profile: FastingProfileId; language: CalendarLanguage}[] = [];
for (const year of [1900, 1901, 2000, 2024, 2025, 2026, 2027, 2028, 2030, 2100, 2199, 2200]) {
  for (const profile of ['typikon-strict', 'parish'] as const) cases.push({year, profile, language: 'ru'});
}
for (const language of ['cu', 'de', 'uk', 'pl'] as const) {
  for (const profile of ['typikon-strict', 'parish'] as const) cases.push({year: 2027, profile, language});
}
const report = {
  xmlIdentical: hash(xml) === hash(readFileSync(resolve(bibleRoot, 'resources/calendar-engine/data/MemoryDays.xml'))),
  cases: [] as object[], live: [] as object[], differingDays: 0,
};
function compare(value: any, year: number, profile: FastingProfileId, language: CalendarLanguage) {
  const expected = local.getYear(year);
  const differences: object[] = [];
  let differingDays = 0;
  if (value.days.length !== expected.days.length || value.pascha !== toIsoDate(expected.pascha)) differences.push({field: 'year/pascha/days'});
  if (!isDeepStrictEqual(value.fastingPeriods, calculateFastingPeriods(year))) differences.push({field: 'fastingPeriods'});
  for (let index = 0; index < expected.days.length; index++) {
    const day = expected.days[index], received = value.days[index];
    const events = day.events.map(event => {
      const localized = localizeCalendarEvent(event, language);
      return {id: event.id, sourceId: event.sourceId, sourceIndex: event.sourceIndex,
        sourceTitle: event.title, title: localized.title, shortTitle: localized.shortTitle ?? null,
        veryShortTitle: localized.veryShortTitle ?? null, description: localized.description ?? null,
        typeCode: event.typeCode, priority: event.priority, ruleKind: event.ruleKind,
        occurrenceDate: toIsoDate(event.occurrenceDate), spanStart: toIsoDate(event.spanStart),
        spanFinish: toIsoDate(event.spanFinish), dayIndexInSpan: event.dayIndexInSpan,
        styleToken: event.styleToken ?? null};
    });
    const actualEvents = (received?.events || []).map((event: any) => Object.fromEntries(
      Object.keys(events[0] || {id: 0}).map(key => [key, event[key] ?? null])));
    const fields: string[] = [];
    if (received?.date !== day.isoDate || received?.oldStyleDate !== toIsoDate(day.oldStyleDate) || received?.weekday !== day.weekday) fields.push('date');
    if (!isDeepStrictEqual(events, actualEvents)) fields.push('events');
    if (!isDeepStrictEqual(calculateFastingDay(day, profile), received?.fasting)) fields.push('fasting');
    if (!isDeepStrictEqual(dayNumberTypikonStyle(day), received?.dayStyle)) fields.push('dayStyle');
    if (fields.length) {
      differingDays++;
      if (differences.length < 6) differences.push({date: day.isoDate, fields,
        ...(fields.includes('events') ? {
          missingEventIds: events.filter(event => !actualEvents.some((actual: any) => actual.id === event.id)).map(event => event.id),
          addedEventIds: actualEvents.filter((event: any) => !events.some(expected => expected.id === event.id)).map((event: any) => event.id),
          firstDifferentEvent: events.map((event, i) => ({expected: event, actual: actualEvents[i]})).find(pair => !isDeepStrictEqual(pair.expected, pair.actual)),
        } : {})});
    }
  }
  return {year, profile, language, days: expected.days.length,
    events: expected.days.reduce((sum, day) => sum + day.events.length, 0), differingDays, differences};
}
mkdirSync('tmp', {recursive: true});
for (const item of cases) {
  const value = JSON.parse(execFileSync(process.execPath, [runtime, String(item.year), item.profile, item.language], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024}));
  const result = compare(value, item.year, item.profile, item.language);
  report.cases.push(result); report.differingDays += result.differingDays;
  console.log(`LOCAL ${item.year}/${item.profile}/${item.language}: ${result.differingDays} differing days`);
}
if (process.argv.includes('--live')) {
  const origin = process.env.BIBLE_API_ORIGIN || 'https://bible-desktop.com';
  for (const item of cases.filter(item => item.year === 2027)) {
    const url = new URL('/api/v1/calendar/year', origin);
    for (const [key, value] of Object.entries({...item, lang: item.language, view: 'full'})) {
      if (key !== 'language') url.searchParams.set(key, String(value));
    }
    const start = performance.now();
    const response = await fetch(url, {headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(120000)});
    const bytes = await response.arrayBuffer();
    if (!response.ok) throw new Error(`Live API HTTP ${response.status}`);
    const value = JSON.parse(Buffer.from(bytes).toString('utf8'));
    const result = {...compare(value, item.year, item.profile, item.language), bytes: bytes.byteLength,
      milliseconds: Math.round(performance.now() - start), ttl: response.headers.get('X-Calendar-Application-Cache-TTL'),
      cacheControl: response.headers.get('Cache-Control'), etag: response.headers.get('ETag'),
      cors: response.headers.get('Access-Control-Allow-Origin'), metadataKeys: Object.keys(value.metadata || {})};
    report.live.push(result); report.differingDays += result.differingDays;
    console.log(`LIVE ${item.year}/${item.profile}/${item.language}: ${result.differingDays} differing days, ${result.bytes} bytes, ${result.milliseconds} ms`);
    await new Promise(resolve => setTimeout(resolve, 2200));
  }
}
writeFileSync('tmp/editor-bible-api-audit.json', JSON.stringify(report, null, 2));
console.log(`Report: tmp/editor-bible-api-audit.json; ${report.differingDays} differing days`);
if (!report.xmlIdentical || report.differingDays || [...report.cases, ...report.live].some((item: any) => item.differences.length)) process.exitCode = 1;
