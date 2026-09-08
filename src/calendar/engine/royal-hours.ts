import type { CalendarDate, MemoryDayRecord, ResolvedEventSpan } from "../types";
import { addDays, compareDates, dayOfWeek, gregorianToJulian, julianToGregorian } from "../date/calendar-date";

/** Typikon ch. 48, December 24 and January 5: when the eve is Saturday or
 * Sunday, the Royal Hours move to Friday and no liturgy is served that Friday.
 * https://azbyka.ru/bogosluzhebnye-ukazaniya?date=2026-01-16
 */
export function isTransferredRoyalHoursDate(date: CalendarDate): boolean {
  if (dayOfWeek(date) !== 5) return false;
  const old = gregorianToJulian(date);
  const eveDay = old.month === 1 ? 5 : old.month === 12 ? 24 : undefined;
  if (eveDay === undefined) return false;
  const eve = julianToGregorian({ year: old.year, month: old.month, day: eveDay });
  const daysBeforeEve = compareDates(eve, date);
  return daysBeforeEve === 1 || daysBeforeEve === 2;
}

export function moveRoyalHoursSpans(record: MemoryDayRecord, spans: ResolvedEventSpan[]): ResolvedEventSpan[] {
  // Explicit original hour channels, never every reading on the feast's eve.
  if (![211, 213, 216, 219].includes(record.typeCode)
    || record.startMonth !== record.finishMonth || record.startDate !== record.finishDate
    || !((record.startMonth === 1 && record.startDate === 5)
      || (record.startMonth === 12 && record.startDate === 24))) return spans;
  return spans.map(span => {
    const weekday = dayOfWeek(span.start);
    if (weekday !== 0 && weekday !== 6) return span;
    const date = addDays(span.start, weekday === 0 ? -2 : -1);
    return { ...span, start: date, finish: date, ruleKind: "lectionary-cycle" };
  });
}

export function isLiturgyReadingType(typeCode: number): boolean {
  return typeCode >= 200 && typeCode < 300 && [4, 7].includes(typeCode % 10);
}
