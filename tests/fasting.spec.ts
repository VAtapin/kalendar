import { describe, expect, it } from "vitest";
import {
  addDays,
  dayOfWeek,
  gregorianToJulian,
  toIsoDate,
} from "../src/calendar";
import type { CalendarDate, OrthodoxCalendarDay, ResolvedCalendarEvent } from "../src/calendar";
import {
  calculateFastingDay,
  calculateFastingPeriods,
  resolveFoodRule,
  usedFoodRulesForMonths,
} from "../src/calendar/presentation/fasting";

function calendarDay(
  date: CalendarDate,
  items: Array<{ title: string; typeCode: number }> = [],
): OrthodoxCalendarDay {
  const events = items.map<ResolvedCalendarEvent>((item, index) => ({
    id: String(index),
    sourceId: "source",
    sourceIndex: index,
    title: item.title,
    typeCode: item.typeCode,
    occurrenceDate: date,
    spanStart: date,
    spanFinish: date,
    dayIndexInSpan: 0,
    ruleKind: "fixed-julian",
    priority: 1,
  }));
  return {
    date,
    isoDate: toIsoDate(date),
    oldStyleDate: gregorianToJulian(date),
    weekday: dayOfWeek(date),
    events,
  };
}

function rule(date: CalendarDate, items: Array<{ title: string; typeCode: number }> = []) {
  return calculateFastingDay(calendarDay(date, items));
}

describe("fasting calculation API", () => {
  it("calculates the movable and fixed fasting periods for 2027", () => {
    const periods = calculateFastingPeriods(2027);
    expect(periods.find((period) => period.id === "great-lent")).toMatchObject({
      start: { year: 2027, month: 3, day: 15 },
      finish: { year: 2027, month: 5, day: 1 },
    });
    expect(periods.find((period) => period.id === "apostles-fast")).toMatchObject({
      start: { year: 2027, month: 6, day: 28 },
      finish: { year: 2027, month: 7, day: 11 },
    });
    expect(periods.find((period) => period.id === "dormition-fast")).toMatchObject({
      start: { year: 2027, month: 8, day: 14 },
      finish: { year: 2027, month: 8, day: 27 },
    });
  });

  it("keeps movable periods exact for earlier and later Pascha years", () => {
    const periods2024 = calculateFastingPeriods(2024);
    expect(periods2024.find((period) => period.id === "great-lent")?.start).toEqual({
      year: 2024, month: 3, day: 18,
    });
    expect(periods2024.find((period) => period.id === "apostles-fast")?.start).toEqual({
      year: 2024, month: 7, day: 1,
    });

    const periods2025 = calculateFastingPeriods(2025);
    expect(periods2025.find((period) => period.id === "great-lent")?.start).toEqual({
      year: 2025, month: 3, day: 3,
    });
    expect(periods2025.find((period) => period.id === "apostles-fast")?.start).toEqual({
      year: 2025, month: 6, day: 16,
    });
  });

  it("applies the detailed Great Lent rule and its exceptions", () => {
    expect(rule({ year: 2027, month: 3, day: 15 }).foodRule.id).toBe("strict-fast");
    expect(rule({ year: 2027, month: 3, day: 17 }).foodRule.id).toBe("dry-eating");
    expect(rule({ year: 2027, month: 3, day: 18 }).foodRule.id).toBe("boiled-no-oil");
    expect(rule({ year: 2027, month: 3, day: 22 }).foodRule.id).toBe("boiled-no-oil");
    expect(rule({ year: 2027, month: 3, day: 20 }).foodRule.id).toBe("oil");
    expect(rule({ year: 2027, month: 4, day: 24 }).foodRule.id).toBe("fast");
    expect(rule({ year: 2027, month: 4, day: 25 }).foodRule.id).toBe("fish");
    expect(rule({ year: 2027, month: 4, day: 30 }).foodRule.id).toBe("strict-fast");
  });

  it("calculates the Apostles and Dormition fasts instead of relying on XML labels", () => {
    expect(rule({ year: 2027, month: 6, day: 28 }).foodRule.id).toBe("boiled-no-oil");
    expect(rule({ year: 2027, month: 6, day: 29 }).foodRule.id).toBe("fish");
    expect(rule({ year: 2027, month: 6, day: 30 }).foodRule.id).toBe("dry-eating");
    expect(rule({ year: 2027, month: 8, day: 16 }).foodRule.id).toBe("boiled-no-oil");
    expect(rule({ year: 2027, month: 8, day: 17 }).foodRule.id).toBe("boiled-no-oil");
    expect(rule({ year: 2027, month: 8, day: 19 }).foodRule.id).toBe("fish");
  });

  it("uses the three successive Nativity-fast phases", () => {
    expect(rule({ year: 2027, month: 11, day: 29 }).foodRule.id).toBe("boiled-no-oil");
    expect(rule({ year: 2027, month: 12, day: 1 }).foodRule.id).toBe("dry-eating");
    expect(rule({ year: 2027, month: 12, day: 20 }).foodRule.id).toBe("boiled-no-oil");
    expect(rule({ year: 2027, month: 12, day: 22 }).foodRule.id).toBe("dry-eating");
    expect(rule({ year: 2027, month: 12, day: 25 }).foodRule.id).toBe("fish");
    expect(rule({ year: 2027, month: 1, day: 4 }).foodRule.id).toBe("boiled-no-oil");
    expect(rule({ year: 2027, month: 1, day: 6 }).foodRule.id).toBe("strict-fast");
  });

  it("handles fast-free weeks, one-day fasts and seasonal Wednesday/Friday rules", () => {
    expect(rule({ year: 2027, month: 1, day: 13 }).foodRule.id).toBe("no-fast");
    expect(rule({ year: 2027, month: 1, day: 18 }).foodRule.id).toBe("oil");
    expect(rule({ year: 2027, month: 1, day: 20 }).foodRule.id).toBe("fish");
    expect(rule({ year: 2027, month: 7, day: 14 }).foodRule.id).toBe("dry-eating");
    expect(rule(
      { year: 2027, month: 7, day: 14 },
      [{ title: "Полиелейная память", typeCode: 4 }],
    ).foodRule.id).toBe("oil");
  });

  it("keeps memorial status separate from the food rule", () => {
    const memorialDay = calendarDay(
      { year: 2027, month: 3, day: 20 },
      [{ title: "Родительская суббота", typeCode: 9 }],
    );
    const resolution = calculateFastingDay(memorialDay);
    expect(resolution.foodRule.id).toBe("oil");
    expect(resolution.memorial).toBe(true);
    expect(resolveFoodRule(memorialDay).id).toBe("memorial");
  });

  it("collects only signs used in the selected month", () => {
    const januaryOrdinary = calendarDay({ year: 2027, month: 1, day: 25 });
    const januaryFast = calendarDay({ year: 2027, month: 1, day: 20 });
    const februaryMemorial = calendarDay(
      { year: 2027, month: 2, day: 6 },
      [{ title: "Родительская суббота", typeCode: 9 }],
    );
    expect([...usedFoodRulesForMonths(
      [januaryOrdinary, januaryFast, februaryMemorial],
      new Set([1]),
    )]).toEqual(["no-fast", "fish"]);
  });

  it("keeps date arithmetic available to API consumers", () => {
    const greatLent = calculateFastingPeriods(2027).find((period) => period.id === "great-lent");
    expect(greatLent && addDays(greatLent.start, 48)).toEqual({ year: 2027, month: 5, day: 2 });
  });

  it("offers a named milder parish profile without changing strict defaults", () => {
    const date = { year: 2027, month: 7, day: 14 };
    expect(calculateFastingDay(calendarDay(date)).foodRule.id).toBe("dry-eating");
    const parish = calculateFastingDay(calendarDay(date), "parish");
    expect(parish.profileId).toBe("parish");
    expect(parish.foodRule.id).toBe("dry-eating");
  });

  it("implements the published parish table separately from the monastic profile", () => {
    const parishRule = (date: CalendarDate) => calculateFastingDay(calendarDay(date), "parish").foodRule.id;
    expect(parishRule({ year: 2027, month: 6, day: 28 })).toBe("fish");
    expect(parishRule({ year: 2027, month: 6, day: 30 })).toBe("oil");
    expect(parishRule({ year: 2027, month: 11, day: 29 })).toBe("fish");
    expect(parishRule({ year: 2027, month: 12, day: 1 })).toBe("oil");
    expect(parishRule({ year: 2027, month: 12, day: 20 })).toBe("oil");
    expect(parishRule({ year: 2027, month: 12, day: 22 })).toBe("boiled-no-oil");
  });
});
