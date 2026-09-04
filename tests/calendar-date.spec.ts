import { describe, expect, it } from "vitest";
import {
  dayOfWeek,
  gregorianToJulian,
  julianToGregorian,
  toIsoDate,
} from "../src/calendar/date/calendar-date";
import { calculateOrthodoxPascha } from "../src/calendar/pascha/orthodox-pascha";

describe("calendar date arithmetic", () => {
  it("converts fixed old-style dates to their civil dates", () => {
    expect(toIsoDate(julianToGregorian({ year: 2026, month: 12, day: 25 }))).toBe(
      "2027-01-07",
    );
    expect(toIsoDate(julianToGregorian({ year: 2027, month: 1, day: 6 }))).toBe(
      "2027-01-19",
    );
    expect(gregorianToJulian({ year: 2027, month: 1, day: 19 })).toEqual({
      year: 2027,
      month: 1,
      day: 6,
    });
  });

  it("uses Sunday as weekday zero", () => {
    expect(dayOfWeek({ year: 2027, month: 5, day: 2 })).toBe(0);
  });
});

describe("Orthodox Pascha", () => {
  it.each([
    [2024, "2024-05-05"],
    [2025, "2025-04-20"],
    [2026, "2026-04-12"],
    [2027, "2027-05-02"],
    [2028, "2028-04-16"],
  ])("calculates %i", (year, expected) => {
    expect(toIsoDate(calculateOrthodoxPascha(year))).toBe(expected);
  });
});

