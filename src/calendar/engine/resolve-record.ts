import type {
  CalendarDate,
  CalendarRuleKind,
  MemoryDayRecord,
  ResolvedEventSpan,
} from "../types";
import {
  addDays,
  compareDates,
  dayOfWeek,
  endOfYear,
  gregorianToJulian,
  julianToGregorian,
  startOfYear,
  toIsoDate,
} from "../date/calendar-date";
import { calculateOrthodoxPascha } from "../pascha/orthodox-pascha";

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function clipToYear(
  record: MemoryDayRecord,
  ruleKind: CalendarRuleKind,
  start: CalendarDate,
  finish: CalendarDate,
  targetYear: number,
): ResolvedEventSpan | undefined {
  if (compareDates(finish, start) < 0) return undefined;

  const clippedStart = compareDates(start, startOfYear(targetYear)) < 0 ? startOfYear(targetYear) : start;
  const clippedFinish =
    compareDates(finish, endOfYear(targetYear)) > 0 ? endOfYear(targetYear) : finish;

  if (compareDates(clippedFinish, clippedStart) < 0) return undefined;
  return { sourceRecord: record, ruleKind, start: clippedStart, finish: clippedFinish };
}

function fixedSpanForSourceYear(record: MemoryDayRecord, sourceYear: number) {
  const finishRollsToNextYear =
    record.finishMonth < record.startMonth ||
    (record.finishMonth === record.startMonth && record.finishDate < record.startDate);
  const start = julianToGregorian({
    year: sourceYear,
    month: record.startMonth,
    day: record.startDate,
  });
  const finish = julianToGregorian({
    year: sourceYear + (finishRollsToNextYear ? 1 : 0),
    month: record.finishMonth,
    day: record.finishDate,
  });
  return { start, finish };
}

function resolveSpecialDate(record: MemoryDayRecord, anchor: CalendarDate): CalendarDate | undefined {
  const weekday = dayOfWeek(anchor);

  // Explicit Typikon exceptions for Nativity/Theophany lections. These are
  // separate XML modes, never changes to the legacy same-week arithmetic.
  if (record.startMonth === -7) {
    if (record.startDate !== 0 || record.finishMonth !== 12 || record.finishDate !== 25) return undefined;
    // Holy Kinsmen: Sunday after Nativity, or Monday when Nativity is Sunday.
    return addDays(anchor, weekday === 0 ? 1 : 7 - weekday);
  }
  if (record.startMonth === -8) {
    if (record.startDate !== 6 || record.finishMonth !== 12 || record.finishDate !== 25) return undefined;
    // A Saturday Nativity leaves Circumcision on the next Saturday: lections
    // of the Saturday after Nativity are read on Friday, Julian December 31.
    return addDays(anchor, weekday === 6 ? 6 : 6 - weekday);
  }
  if (record.startMonth === -9) {
    if (record.startDate !== 6 || record.finishMonth !== 1 || record.finishDate !== 6) return undefined;
    const saturday = addDays(anchor, -(positiveModulo(weekday - 6 - 1, 7) + 1));
    const oldStyle = gregorianToJulian(saturday);
    return oldStyle.month === 1 && oldStyle.day === 1 ? addDays(saturday, -1) : saturday;
  }

  // Following weekday only when the anchor itself is a different weekday.
  // E.g. the Sunday of the Holy Kinsmen after Nativity: if Nativity is
  // Sunday, the separate conditional Monday record is used instead.
  if (record.startMonth === -6) {
    if (record.startDate < 0 || record.startDate > 6 || weekday === record.startDate) return undefined;
    return addDays(anchor, positiveModulo(record.startDate - weekday, 7));
  }

  // Explicit strictly-following weekday (0=Sunday ... 6=Saturday). Unlike
  // legacy -1/-2 same-week offsets, a coinciding anchor moves ahead seven days.
  if (record.startMonth === -5) {
    if (record.startDate < 0 || record.startDate > 6) return undefined;
    return addDays(anchor, positiveModulo(record.startDate - weekday - 1, 7) + 1);
  }

  if (record.startMonth === -1) {
    if (record.startDate === weekday) return undefined;
    return addDays(anchor, record.startDate - weekday);
  }

  if (record.startMonth === -2) {
    return addDays(anchor, record.startDate - weekday);
  }

  if (record.startMonth === -3) {
    return weekday === record.startDate ? anchor : undefined;
  }

  if (record.startMonth === -4) {
    const windowStart = addDays(anchor, -3);
    const untilSunday = positiveModulo(-dayOfWeek(windowStart), 7);
    return addDays(windowStart, untilSunday);
  }

  return undefined;
}

function uniqueSpans(spans: ResolvedEventSpan[]): ResolvedEventSpan[] {
  const seen = new Set<string>();
  return spans.filter((span) => {
    const key = `${span.sourceRecord.id}:${toIsoDate(span.start)}:${toIsoDate(span.finish)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveMemoryDayRecord(
  record: MemoryDayRecord,
  targetYear: number,
): ResolvedEventSpan[] {
  const candidateYears = [targetYear - 1, targetYear, targetYear + 1];
  const spans: ResolvedEventSpan[] = [];

  if (record.startMonth > 0 && record.finishMonth > 0) {
    for (const sourceYear of candidateYears) {
      const { start, finish } = fixedSpanForSourceYear(record, sourceYear);
      const span = clipToYear(record, "fixed-julian", start, finish, targetYear);
      if (span) spans.push(span);
    }
    return uniqueSpans(spans);
  }

  if (record.startMonth === 0 && record.finishMonth === 0) {
    for (const paschaYear of candidateYears) {
      const pascha = calculateOrthodoxPascha(paschaYear);
      const span = clipToYear(
        record,
        "pascha-relative",
        addDays(pascha, record.startDate),
        addDays(pascha, record.finishDate),
        targetYear,
      );
      if (span) spans.push(span);
    }
    return uniqueSpans(spans);
  }

  if (record.startMonth === 0 && record.finishMonth > 0) {
    for (const sourceYear of candidateYears) {
      const start = addDays(calculateOrthodoxPascha(sourceYear), record.startDate);
      const finish = julianToGregorian({
        year: sourceYear,
        month: record.finishMonth,
        day: record.finishDate,
      });
      const span = clipToYear(record, "pascha-to-fixed-julian", start, finish, targetYear);
      if (span) spans.push(span);
    }
    return uniqueSpans(spans);
  }

  if (record.startMonth < 0 && record.finishMonth > 0) {
    const ruleKind: CalendarRuleKind =
      record.startMonth === -3
        ? "weekday-conditional"
        : record.startMonth === -4
          ? "nearest-sunday"
          : "weekday-relative";

    for (const sourceYear of candidateYears) {
      const anchor = julianToGregorian({
        year: sourceYear,
        month: record.finishMonth,
        day: record.finishDate,
      });
      const resolved = resolveSpecialDate(record, anchor);
      if (!resolved) continue;
      const span = clipToYear(record, ruleKind, resolved, resolved, targetYear);
      if (span) spans.push(span);
    }
    return uniqueSpans(spans);
  }

  return [];
}
