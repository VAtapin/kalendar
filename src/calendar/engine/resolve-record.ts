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

