import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";
import { buildOrthodoxCalendarYear } from "../src/calendar/engine/build-calendar-year";
import { resolveMemoryDayRecord } from "../src/calendar/engine/resolve-record";
import {
  indexWeekdayGospelDates, isOrdinaryGospelRecord, lukanCycleStart,
  resolveCalendarRecord, weekdayGospelSourceOffset,
} from "../src/calendar/engine/weekday-gospel-cycle";
import { addDays, compareDates, dayOfWeek, julianToGregorian, toIsoDate } from "../src/calendar/date/calendar-date";
import { calculateOrthodoxPascha } from "../src/calendar/pascha/orthodox-pascha";

const dataset = parseMemoryDaysXml(readFileSync("public/data/MemoryDays.xml", "utf8"));

describe("ordinary weekday Gospel lectionary (not a complete service typikon)", () => {
  // Annual grid: https://rop.ru/d/3000/d/calendar_2026_0.doc
  // First two civil dates lie in Julian 2025; independent day references:
  // https://azbyka.ru/days/2026-01-05 and /2026-01-12
  const fixtures = [
    ["2026-01-05", "Мк.10:46-52"], ["2026-01-12", "Мк.12:13-17"],
    ["2026-01-20", "Мк.11:11-23"], ["2026-01-21", "Мк.11:23-26"],
    ["2026-01-22", "Мк.11:27-33"], ["2026-01-23", "Мк.12:1-12"],
    ["2026-01-26", "Мк.12:13-17"], ["2026-01-27", "Мк.12:18-27"],
    ["2026-02-13", "Мк.15:22,25,33-41"], ["2026-07-03", "Мф.13:3-9"],
    ["2026-09-28", "Мф.23:13-22"], ["2026-10-05", "Лк.3:19-22"],
    ["2026-11-02", "Лк.9:18-22"], ["2026-12-14", "Лк.19:37-44"],
    ["2027-01-04", "Мк.9:42-10:1"], ["2027-01-11", "Мк.10:46-52"],
  ];
  const calendars = new Map([2026, 2027].map(year => [year, buildOrthodoxCalendarYear(year, dataset)]));
  it.each(fixtures)("%s contains the independently checked weekday Gospel %s exactly once", (isoDate, title) => {
    const day = calendars.get(Number(isoDate!.slice(0, 4)))!.daysByIsoDate[isoDate!]!;
    expect(day.events.filter(e => e.typeCode === 207).map(e => e.title)).toEqual([title]);
  });

  it("does not shift the Apostol, feast/hour readings, Psalter or weekend candidates", () => {
    const dates = indexWeekdayGospelDates(2026);
    for (const record of dataset.records) {
      const original = resolveMemoryDayRecord(record, 2026);
      const actual = resolveCalendarRecord(record, 2026, dates);
      if (!isOrdinaryGospelRecord(record)) {
        expect(actual).toEqual(original);
      } else {
        expect(actual.filter(s => [0, 6].includes(dayOfWeek(s.start))))
          .toEqual(original.filter(s => [0, 6].includes(dayOfWeek(s.start))));
      }
    }
  });

  it("starts after the following Sunday even when Exaltation is itself Sunday", () => {
    expect(toIsoDate(lukanCycleStart(2026))).toBe("2026-10-05");
    expect(toIsoDate(lukanCycleStart(2027))).toBe("2027-10-04");
    expect(toIsoDate(lukanCycleStart(2024))).toBe("2024-09-30");
  });

  it("covers the 532-year Paschal circle without missing, double or weekend weekday slots", () => {
    const offsets = new Map<number, number>();
    for (const record of dataset.records.filter(isOrdinaryGospelRecord)) {
      offsets.set(record.startDate, (offsets.get(record.startDate) ?? 0) + 1);
    }
    const autumnShifts = new Set<number>();
    for (let year = 1941; year <= 2472; year++) {
      const pascha = calculateOrthodoxPascha(year);
      const luke = lukanCycleStart(year);
      const exaltation = julianToGregorian({ year, month: 9, day: 14 });
      expect(dayOfWeek(luke)).toBe(1);
      expect(compareDates(luke, exaltation)).toBeGreaterThanOrEqual(2);
      expect(compareDates(luke, exaltation)).toBeLessThanOrEqual(8);
      autumnShifts.add(compareDates(luke, addDays(pascha, 169)) / 7);
      const publican = addDays(calculateOrthodoxPascha(year + 1), -70);
      for (let date = addDays(pascha, 50); compareDates(date, publican) < 0; date = addDays(date, 1)) {
        const offset = weekdayGospelSourceOffset(date);
        if ([0, 6].includes(dayOfWeek(date))) expect(offset).toBeUndefined();
        else {
          expect(offsets.get(offset!), `${toIsoDate(date)} / ${offset}`).toBe(1);
          expect(((offset! % 7) + 7) % 7).toBe(dayOfWeek(date));
        }
      }
      expect(weekdayGospelSourceOffset(luke)).toBe(169);
      expect(weekdayGospelSourceOffset(addDays(publican, 1))).toBe(-69);
    }
    expect([...autumnShifts].sort((a, b) => a - b)).toEqual([-3, -2, -1, 0, 1, 2]);
  });

  it("does not resurrect a weekday liturgy during Lent from the previous year's column", () => {
    for (const isoDate of ["2026-02-18", "2026-02-20", "2026-02-24", "2026-03-02"]) {
      const day = calendars.get(2026)!.daysByIsoDate[isoDate]!;
      expect(day.events.filter(e => e.typeCode === 207)).toEqual([]);
    }
    expect(calendars.get(2026)!.daysByIsoDate["2026-02-02"]!.events
      .filter(e => e.typeCode === 207).map(e => e.title)).toEqual(["Мк.13:9-13"]);
  });
});
