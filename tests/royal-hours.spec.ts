import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { buildOrthodoxCalendarYear } from "../src/calendar/engine/build-calendar-year";
import { resolveMemoryDayRecord } from "../src/calendar/engine/resolve-record";
import { isLiturgyReadingType, isTransferredRoyalHoursDate, moveRoyalHoursSpans } from "../src/calendar/engine/royal-hours";
import { addDays, dayOfWeek, toIsoDate } from "../src/calendar/date/calendar-date";

const dataset = parseMemoryDaysXml(readFileSync("public/data/MemoryDays.xml", "utf8"));
const hourRecords = dataset.records.filter(r => [3439, 3440, 3447, 3448, 3469, 3470, 3485, 3486].includes(r.sourceIndex));

describe("Royal Hours transfer, Typikon ch. 48", () => {
  it("puts all four Theophany hours on January 16, not Sunday January 18, 2026", () => {
    const calendar = buildOrthodoxCalendarYear(2026, dataset);
    const friday = calendar.daysByIsoDate["2026-01-16"]!;
    const sunday = calendar.daysByIsoDate["2026-01-18"]!;
    expect(friday.events.filter(e => [211, 213, 216, 219].includes(e.typeCode)).map(e => e.typeCode).sort())
      .toEqual([211, 213, 216, 219]);
    expect(friday.events.filter(e => isLiturgyReadingType(e.typeCode))).toEqual([]);
    expect(sunday.events.filter(e => [211, 213, 216, 219].includes(e.typeCode))).toEqual([]);
    // The eve still has its own liturgy: moving the hours must not move that.
    expect(sunday.events.some(e => e.typeCode === 214)).toBe(true);
    expect(sunday.events.some(e => e.typeCode === 217)).toBe(true);
  });

  it("handles both eves throughout the complete Paschal circle without losing records", () => {
    expect(hourRecords).toHaveLength(8);
    const encounteredWeekdays = new Set<number>();
    for (let year = 1941; year <= 2472; year++) for (const record of hourRecords) {
      const original = resolveMemoryDayRecord(record, year);
      const moved = moveRoyalHoursSpans(record, original);
      expect(moved.length).toBe(original.length);
      original.forEach((span, index) => {
        const weekday = dayOfWeek(span.start);
        encounteredWeekdays.add(weekday);
        const expected = [0, 6].includes(weekday) ? addDays(span.start, weekday === 0 ? -2 : -1) : span.start;
        expect(toIsoDate(moved[index]!.start)).toBe(toIsoDate(expected));
        expect(moved[index]!.finish).toEqual(expected);
        expect(moved[index]!.sourceRecord.id).toBe(record.id);
        expect(isTransferredRoyalHoursDate(expected)).toBe([0, 6].includes(weekday));
      });
    }
    expect(encounteredWeekdays.size).toBe(7);
  });

  it("does not move liturgy, matins or unrelated hours with a coinciding date", () => {
    for (const record of dataset.records.filter(r => !hourRecords.includes(r))) {
      const spans = resolveMemoryDayRecord(record, 2026);
      expect(moveRoyalHoursSpans(record, spans)).toEqual(spans);
    }
    expect(isTransferredRoyalHoursDate({ year: 2026, month: 1, day: 9 })).toBe(false);
    expect(isTransferredRoyalHoursDate({ year: 2026, month: 1, day: 23 })).toBe(false);
    expect(isTransferredRoyalHoursDate({ year: 2023, month: 1, day: 6 })).toBe(false);
  });
});
