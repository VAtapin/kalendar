import type {
  MemoryDaysDataset,
  OrthodoxCalendarDay,
  OrthodoxCalendarYear,
  ResolvedCalendarEvent,
} from "../types";
import {
  addDays,
  compareDates,
  dayOfWeek,
  enumerateDates,
  gregorianToJulian,
  startOfYear,
  endOfYear,
  toIsoDate,
} from "../date/calendar-date";
import { calculateOrthodoxPascha } from "../pascha/orthodox-pascha";
import { resolveMemoryDayRecord } from "./resolve-record";
import { buildGeneratedLiturgicalEvents } from "./liturgical-cycle";
import {
  createShortCalendarTitle,
  createVeryShortCalendarTitle,
} from "../presentation/title-variants";

function typePriority(typeCode: number): number {
  if (typeCode === 0) return 1000;
  if (typeCode >= 1 && typeCode <= 7) return 950 - typeCode * 25;
  if (typeCode === 9) return 760;
  if (typeCode === 8) return 740;
  if (typeCode === 10) return 700;
  if (typeCode === 100) return 690;
  return Math.max(1, 650 - typeCode);
}

function eventDedupeKey(event: ResolvedCalendarEvent): string {
  return `${event.typeCode}:${event.title.toLocaleLowerCase("ru").replace(/[\s.,;:()]+/gu, " ").trim()}`;
}

function isSupersededLiturgicalRangeRecord(title: string): boolean {
  return /^(?:попразднство|отдание праздника)/iu.test(title.trim());
}

function adjustedFixedFeastDate(title: string, date: OrthodoxCalendarDay["date"]): OrthodoxCalendarDay["date"] {
  if (!/^сретение господ/iu.test(title.trim())) return date;
  const cheesefareSunday = addDays(calculateOrthodoxPascha(date.year), -49);
  return compareDates(date, cheesefareSunday) > 0 ? cheesefareSunday : date;
}

export function buildOrthodoxCalendarYear(
  year: number,
  dataset: MemoryDaysDataset,
): OrthodoxCalendarYear {
  const days = enumerateDates(startOfYear(year), endOfYear(year)).map<OrthodoxCalendarDay>(
    (date) => ({
      date,
      isoDate: toIsoDate(date),
      oldStyleDate: gregorianToJulian(date),
      weekday: dayOfWeek(date),
      events: [],
    }),
  );
  const dayMap = new Map(days.map((day) => [day.isoDate, day]));

  for (const record of dataset.records) {
    if (isSupersededLiturgicalRangeRecord(record.title)) continue;
    for (const span of resolveMemoryDayRecord(record, year)) {
      const spanDates = enumerateDates(span.start, span.finish);
      spanDates.forEach((date, dayIndexInSpan) => {
        const occurrenceDate = adjustedFixedFeastDate(record.title, date);
        const isoDate = toIsoDate(occurrenceDate);
        const day = dayMap.get(isoDate);
        if (!day) return;

        const event: ResolvedCalendarEvent = {
          id: `${record.id}:${isoDate}`,
          sourceId: record.id,
          sourceIndex: record.sourceIndex,
          title: record.title,
          shortTitle: record.shortTitle ?? createShortCalendarTitle(record.title),
          veryShortTitle: record.veryShortTitle ?? createVeryShortCalendarTitle(record.title),
          typeCode: record.typeCode,
          ...(record.description ? { description: record.description } : {}),
          occurrenceDate,
          spanStart: occurrenceDate,
          spanFinish: occurrenceDate,
          dayIndexInSpan,
          ruleKind: span.ruleKind,
          priority: typePriority(record.typeCode),
        };
        day.events.push(event);
      });
    }
  }

  for (const event of buildGeneratedLiturgicalEvents(year)) {
    dayMap.get(toIsoDate(event.occurrenceDate))?.events.push(event);
  }

  for (const day of days) {
    const uniqueEvents = new Map<string, ResolvedCalendarEvent>();
    for (const event of day.events) {
      const key = eventDedupeKey(event);
      if (!uniqueEvents.has(key)) uniqueEvents.set(key, event);
    }
    day.events = [...uniqueEvents.values()];
    day.events.sort(
      (left, right) =>
        right.priority - left.priority ||
        left.sourceIndex - right.sourceIndex ||
        left.title.localeCompare(right.title, "ru"),
    );
  }

  return {
    year,
    pascha: calculateOrthodoxPascha(year),
    days,
    daysByIsoDate: Object.fromEntries(days.map((day) => [day.isoDate, day])),
    diagnostics: [...dataset.diagnostics],
  };
}

export function exportCalendarYearDebug(calendar: OrthodoxCalendarYear): string {
  return calendar.days
    .map((day) => {
      const events = day.events.map((event) => `[${event.typeCode}] ${event.title}`).join(" | ");
      return `${day.isoDate}\t${events}`;
    })
    .join("\n");
}
