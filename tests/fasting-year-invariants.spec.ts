import { describe, expect, it } from "vitest";
import {
  calculateFastingDay,
  calculateFastingPeriods,
  dayOfWeek,
  endOfYear,
  enumerateDates,
  gregorianToJulian,
  startOfYear,
  toIsoDate,
  type CalendarDate,
  type OrthodoxCalendarDay,
} from "../src/calendar";

function emptyDay(date: CalendarDate): OrthodoxCalendarDay {
  return {
    date,
    isoDate: toIsoDate(date),
    oldStyleDate: gregorianToJulian(date),
    weekday: dayOfWeek(date),
    events: [],
  };
}

describe("fasting year invariants", () => {
  it("resolves every civil day for both profiles across the supported year range", () => {
    for (let year = 1900; year <= 2200; year += 1) {
      const dates = enumerateDates(startOfYear(year), endOfYear(year));
      expect(dates.length === 365 || dates.length === 366).toBe(true);
      expect(new Set(dates.map(toIsoDate)).size).toBe(dates.length);
      for (const date of dates) {
        const day = emptyDay(date);
        for (const profile of ["typikon-strict", "parish"] as const) {
          const resolution = calculateFastingDay(day, profile);
          expect(resolution.profileId).toBe(profile);
          expect(resolution.date).toEqual(date);
          expect(resolution.foodRule.id).toBeTruthy();
          expect(resolution.reason.length).toBeGreaterThan(3);
          expect(resolution.sourceUrls.length).toBeGreaterThan(0);
        }
      }
      for (const period of calculateFastingPeriods(year)) {
        expect(toIsoDate(period.start) <= toIsoDate(period.finish)).toBe(true);
      }
    }
  }, 30_000);
});
