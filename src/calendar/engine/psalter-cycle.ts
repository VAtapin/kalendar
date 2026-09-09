import type { CalendarDate, ResolvedCalendarEvent } from "../types";
import { compareDates, dayOfWeek, toIsoDate } from "../date/calendar-date";
import { calculateOrthodoxPascha } from "../pascha/orthodox-pascha";

/** The normal weekly kathisma order outside the source's explicit exceptions. */
const ORDINARY_WEEKLY_PSALTER: readonly string[] = [
  "Пс.9-16; Пс.17-23",
  "Пс.24-31; Пс.32-36; Пс.37-45",
  "Пс.46-54; Пс.55-63; Пс.64-69",
  "Пс.70-76; Пс.77-84; Пс.85-90",
  "Пс.91-100; Пс.101-104; Пс.105-108",
  "Пс.134-142; Пс.143-150; Пс.1-8",
  "Пс.109-111; Пс.118",
];

/** Explicit XML rows win; the ordinary cycle fills ordinary post-Pentecost days. */
export function addOrdinaryWeeklyPsalter(date: CalendarDate, events: ResolvedCalendarEvent[]): void {
  if (events.some((event) => event.typeCode === 302)) return;
  const daysFromPascha = compareDates(date, calculateOrthodoxPascha(date.year));
  if (daysFromPascha < 50 || daysFromPascha > 230) return;
  const title = ORDINARY_WEEKLY_PSALTER[dayOfWeek(date)];
  if (!title) return;
  const isoDate = toIsoDate(date);
  events.push({
    id: `generated:ordinary-weekly-psalter:${isoDate}`,
    sourceId: "generated:ordinary-weekly-psalter",
    sourceIndex: 9_000_302,
    title,
    typeCode: 302,
    occurrenceDate: date,
    spanStart: date,
    spanFinish: date,
    dayIndexInSpan: 0,
    ruleKind: "generated-liturgical",
    priority: 348,
  });
}
