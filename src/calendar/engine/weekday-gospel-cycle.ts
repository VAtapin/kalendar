import type { CalendarDate, MemoryDayRecord, ResolvedEventSpan } from "../types";
import {
  addDays, compareDates, dayOfWeek, endOfYear, enumerateDates,
  julianToGregorian, startOfYear,
} from "../date/calendar-date";
import { calculateOrthodoxPascha } from "../pascha/orthodox-pascha";
import { resolveMemoryDayRecord } from "./resolve-record";

/** Monday after the Sunday STRICTLY following Julian September 14. */
export function lukanCycleStart(paschaYear: number): CalendarDate {
  const exaltation = julianToGregorian({ year: paschaYear, month: 9, day: 14 });
  return addDays(exaltation, 8 - dayOfWeek(exaltation));
}

/**
 * Source offsets in the XML's ordinary weekday Gospel column, not actual
 * offsets from Pascha after the autumn jump. Saturdays, Sundays and feast
 * readings have different rules and are deliberately not selected here.
 *
 * Typikon ch. 10; Gospel lectionary Skazanie I/II; Typikon ch. 48, January 7.
 * https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/tipikon/10
 * For the optional pre-Lukan repeat we use Matthew weeks 10/11, the practice
 * documented in the MP calendar (2026: week 11). This is not a claim that the
 * Typikon mandates that particular choice for every local church.
 */
export function weekdayGospelSourceOffset(date: CalendarDate): number | undefined {
  const weekday = dayOfWeek(date);
  if (weekday === 0 || weekday === 6) return undefined;

  const currentPascha = calculateOrthodoxPascha(date.year);
  const currentOffset = compareDates(date, currentPascha);
  // From the Publican through Pentecost the current Paschal cycle wins.
  // In particular, a late previous Pascha must not add its ordinary readings
  // to the Triodion, nor manufacture a liturgy on a Lenten weekday.
  if (currentOffset >= -70 && currentOffset <= 49) return currentOffset;

  const paschaYear = currentOffset < -70 ? date.year - 1 : date.year;
  const pascha = calculateOrthodoxPascha(paschaYear);
  const lukanStart = lukanCycleStart(paschaYear);
  const afterLukanStart = compareDates(date, lukanStart);
  const naturalOffset = compareDates(date, pascha);
  if (afterLukanStart < 0) {
    if (naturalOffset < 169) return naturalOffset;
    // An early Pascha can leave one/two weeks after Matthew/Mark finish.
    // Finish with week 11 (Monday offset 120); precede it with week 10.
    return 127 + afterLukanStart;
  }

  const lukanOffset = 169 + afterLukanStart;
  if (lukanOffset <= 278) return lukanOffset;

  // Once week 33 is finished, repeat enough of the ending weeks to finish
  // week 33 immediately before the next Publican Sunday. Do NOT combine
  // these with the XML's independently anchored negative-offset records.
  const nextPascha = calculateOrthodoxPascha(paschaYear + 1);
  return 350 + compareDates(date, nextPascha);
}

export function isOrdinaryGospelRecord(record: MemoryDayRecord): boolean {
  return record.typeCode === 207 && record.startMonth === 0 && record.finishMonth === 0
    && record.startDate === record.finishDate;
}

/** Build once per year; all returned dates are weekdays, including no-liturgy days. */
export function indexWeekdayGospelDates(year: number): Map<number, CalendarDate[]> {
  const dates = new Map<number, CalendarDate[]>();
  for (const date of enumerateDates(startOfYear(year), endOfYear(year))) {
    const offset = weekdayGospelSourceOffset(date);
    if (offset === undefined) continue;
    const entry = dates.get(offset) ?? [];
    entry.push(date);
    dates.set(offset, entry);
  }
  return dates;
}

export function resolveCalendarRecord(
  record: MemoryDayRecord,
  year: number,
  gospelDates: ReadonlyMap<number, CalendarDate[]>,
): ResolvedEventSpan[] {
  const original = resolveMemoryDayRecord(record, year);
  if (!isOrdinaryGospelRecord(record)) return original;
  return [
    ...original.filter(span => [0, 6].includes(dayOfWeek(span.start))),
    ...(gospelDates.get(record.startDate) ?? []).map(date => ({
      sourceRecord: record,
      ruleKind: "lectionary-cycle" as const,
      start: date,
      finish: date,
    })),
  ];
}
