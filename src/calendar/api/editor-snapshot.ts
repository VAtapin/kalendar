import {dayOfWeek, enumerateDates, gregorianToJulian, toIsoDate} from '../date/calendar-date';
import type {CalendarDate, OrthodoxCalendarYear, ResolvedCalendarEvent} from '../types';
import type {CalendarLanguage} from '../../document/types';
import {FOOD_RULES, type FastingDayResolution, type FastingProfileId} from '../fasting/fasting-catalog';

export interface EditorSnapshotEvent extends Omit<ResolvedCalendarEvent,
  'occurrenceDate' | 'spanStart' | 'spanFinish' | 'apiLocalization' | 'styleToken'> {
  occurrenceDate: string;
  spanStart: string;
  spanFinish: string;
  styleToken?: string | null;
  apiLocalization: {language: CalendarLanguage; status: string; title: string;
    shortTitle?: string | null; veryShortTitle?: string | null; description?: string | null};
}
export interface EditorCalendarSnapshot {
  schemaVersion: 1;
  engineVersion: string;
  runtimeVersion: string;
  datasetVersion: string;
  contentHash: string;
  request: {year: number; lang: CalendarLanguage; selectedProfile: FastingProfileId};
  calendar: {year: number; pascha: string; days: {
    date: string; oldStyleDate: string; weekday: number; events: EditorSnapshotEvent[];
  }[]};
  fastingByDate: Record<string, {
    typikonStrict: Omit<FastingDayResolution, 'date' | 'profileId' | 'sourceUrls' | 'period'> & {period?: FastingDayResolution['period'] | null};
    parish: Omit<FastingDayResolution, 'date' | 'profileId' | 'sourceUrls' | 'period'> & {period?: FastingDayResolution['period'] | null};
  }>;
  fastingProfiles: Record<'typikonStrict' | 'parish', {rulesVersion: string; sourceUrls: string[]}>;
  diagnostics: OrthodoxCalendarYear['diagnostics'];
  statistics: {recordCount: number};
}
export interface SavedEditorCalendarSnapshot {
  fetchedAt: string;
  snapshot: EditorCalendarSnapshot;
}

export function snapshotDate(value: string, julian = false): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Календарный снимок содержит неверную дату');
  const date = {year: Number(match[1]), month: Number(match[2]), day: Number(match[3])};
  const check = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const julianMonthDays = [31, date.year % 4 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const valid = julian ? date.month >= 1 && date.month <= 12 && date.day >= 1 && date.day <= julianMonthDays[date.month - 1]!
    : check.getUTCFullYear() === date.year && check.getUTCMonth() + 1 === date.month && check.getUTCDate() === date.day;
  if (!valid) {
    throw new Error('Календарный снимок содержит неверную дату');
  }
  return date;
}

/** Validate persisted data before display; cryptographic verification is separate. */
export function assertEditorSnapshot(value: unknown): asserts value is EditorCalendarSnapshot {
  const item = value as EditorCalendarSnapshot | undefined;
  if (!item || item.schemaVersion !== 1 || !/^sha256:[a-f0-9]{64}$/.test(item.contentHash || '')
    || !/^sha256:[a-f0-9]{64}$/.test(item.datasetVersion || '') || !/^sha256:[a-f0-9]{64}$/.test(item.runtimeVersion || '')
    || typeof item.engineVersion !== 'string' || !item.request || !Number.isInteger(item.request.year)
    || item.request.year < 1900 || item.request.year > 2200 || !['ru', 'cu', 'de', 'uk', 'pl'].includes(item.request.lang)
    || !['typikon-strict', 'parish'].includes(item.request.selectedProfile)
    || item.calendar?.year !== item.request.year || !Array.isArray(item.calendar?.days)
    || !Array.isArray(item.diagnostics) || !Number.isInteger(item.statistics?.recordCount)
    || !item.fastingByDate || !item.fastingProfiles) throw new Error('Неподдерживаемый календарный снимок');
  snapshotDate(item.calendar.pascha);
  const year = item.request.year;
  const dates = enumerateDates({year, month: 1, day: 1}, {year, month: 12, day: 31});
  if (item.calendar.days.length !== dates.length) throw new Error('Календарный снимок содержит неполный год');
  for (const [index, expected] of dates.entries()) {
    const day = item.calendar.days[index];
    if (!day || day.date !== toIsoDate(expected) || day.oldStyleDate !== toIsoDate(gregorianToJulian(expected))
      || day.weekday !== dayOfWeek(expected) || !Array.isArray(day.events)) throw new Error('Календарный снимок содержит неверный день');
    const ids = new Set<string>();
    for (const event of day.events) {
      if (typeof event.id !== 'string' || ids.has(event.id)
        || typeof event.title !== 'string' || typeof event.sourceId !== 'string' || !Number.isInteger(event.sourceIndex)
        || !Number.isFinite(event.priority) || !Number.isInteger(event.typeCode) || typeof event.ruleKind !== 'string'
        || event.occurrenceDate !== day.date || !Number.isInteger(event.dayIndexInSpan)
        || event.apiLocalization?.language !== item.request.lang || typeof event.apiLocalization.title !== 'string') throw new Error('Календарный снимок содержит неверное событие');
      ids.add(event.id); snapshotDate(event.spanStart); snapshotDate(event.spanFinish);
      for (const key of ['shortTitle', 'veryShortTitle', 'description'] as const) {
        if (event.apiLocalization[key] != null && typeof event.apiLocalization[key] !== 'string') throw new Error('Календарный снимок содержит неверное название');
      }
      if (event.styleToken != null && typeof event.styleToken !== 'string') throw new Error('Календарный снимок содержит неверное название');
    }
    for (const key of ['typikonStrict', 'parish'] as const) {
      const rule = item.fastingByDate[day.date]?.[key];
      if (!rule || !Object.hasOwn(FOOD_RULES, rule.foodRule?.id || '') || typeof rule.memorial !== 'boolean'
        || typeof rule.reason !== 'string' || typeof rule.foodRule.label !== 'string' || typeof rule.foodRule.color !== 'string'
        || !Array.isArray(item.fastingProfiles[key]?.sourceUrls) || typeof item.fastingProfiles[key].rulesVersion !== 'string') {
        throw new Error('В календарном снимке отсутствуют правила поста');
      }
    }
  }
}

export function canonicalSnapshot(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  if (Array.isArray(value)) return '[' + value.map(canonicalSnapshot).join(',') + ']';
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).map(key => ({key, bytes: new TextEncoder().encode(key)}));
  keys.sort((a, b) => {
    for (let index = 0; index < Math.min(a.bytes.length, b.bytes.length); index++) {
      if (a.bytes[index] !== b.bytes[index]) return a.bytes[index]! - b.bytes[index]!;
    }
    return a.bytes.length - b.bytes.length;
  });
  return '{' + keys.map(({key}) => canonicalSnapshot(key) + ':' + canonicalSnapshot(object[key])).join(',') + '}';
}

export async function verifyEditorSnapshot(snapshot: EditorCalendarSnapshot): Promise<void> {
  assertEditorSnapshot(snapshot);
  const {contentHash, ...payload} = snapshot;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalSnapshot(payload)));
  const actual = 'sha256:' + Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== contentHash) throw new Error('Календарный снимок повреждён: контрольная сумма не совпадает');
}

export function snapshotMatches(saved: SavedEditorCalendarSnapshot | undefined, year: number, language: CalendarLanguage): boolean {
  return saved?.snapshot.request.year === year && saved.snapshot.request.lang === language;
}

/** Only adapts server data to the existing layout model; computes no feast/fast. */
export function snapshotCalendar(snapshot: EditorCalendarSnapshot): OrthodoxCalendarYear {
  const days = snapshot.calendar.days.map(day => {
    const date = snapshotDate(day.date);
    const fasting = (key: 'typikonStrict' | 'parish', profileId: FastingProfileId): FastingDayResolution => {
      const {period, ...rule} = snapshot.fastingByDate[day.date]![key];
      return {...rule, ...(period ? {period} : {}), date, profileId, sourceUrls: snapshot.fastingProfiles[key].sourceUrls};
    };
    return {date, isoDate: day.date, oldStyleDate: snapshotDate(day.oldStyleDate, true), weekday: day.weekday,
      events: day.events.map(event => ({...event, styleToken: event.styleToken ?? undefined,
        occurrenceDate: snapshotDate(event.occurrenceDate), spanStart: snapshotDate(event.spanStart), spanFinish: snapshotDate(event.spanFinish),
        apiLocalization: {language: snapshot.request.lang, title: event.apiLocalization.title,
          shortTitle: event.apiLocalization.shortTitle ?? undefined, veryShortTitle: event.apiLocalization.veryShortTitle ?? undefined,
          description: event.apiLocalization.description ?? undefined}})),
      fastingByProfile: {'typikon-strict': fasting('typikonStrict', 'typikon-strict'), parish: fasting('parish', 'parish')},
    };
  });
  return {year: snapshot.calendar.year, pascha: snapshotDate(snapshot.calendar.pascha), days,
    daysByIsoDate: Object.fromEntries(days.map(day => [day.isoDate, day])), diagnostics: snapshot.diagnostics};
}
