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
    expect(rule({ year: 2027, month: 3, day: 15 }).foodRule.id).toBe("total-abstinence");
    expect(rule({ year: 2027, month: 3, day: 17 }).foodRule.id).toBe("boiled-no-oil");
    expect(rule({ year: 2027, month: 3, day: 18 }).foodRule.id).toBe("dry-eating");
    expect(rule({ year: 2027, month: 3, day: 22 }).foodRule.id).toBe("dry-eating");
    expect(rule({ year: 2027, month: 3, day: 20 }).foodRule.id).toBe("oil");
    expect(rule({ year: 2027, month: 4, day: 24 }).foodRule.id).toBe("caviar");
    expect(rule({ year: 2027, month: 4, day: 25 }).foodRule.id).toBe("fish");
    expect(rule({ year: 2027, month: 4, day: 30 }).foodRule.id).toBe("total-abstinence");
  });

  it("calculates the Apostles and Dormition fasts instead of relying on XML labels", () => {
    expect(rule({ year: 2027, month: 6, day: 28 }).foodRule.id).toBe("dry-eating");
    expect(rule({ year: 2027, month: 6, day: 29 }).foodRule.id).toBe("oil");
    expect(rule({ year: 2027, month: 6, day: 30 }).foodRule.id).toBe("dry-eating");
    expect(rule({ year: 2027, month: 8, day: 16 }).foodRule.id).toBe("dry-eating");
    expect(rule({ year: 2027, month: 8, day: 17 }).foodRule.id).toBe("boiled-no-oil");
    expect(rule({ year: 2027, month: 8, day: 19 }).foodRule.id).toBe("fish");
  });

  it("keeps caviar and complete abstinence separate from fish and dry eating", () => {
    for (const profile of ["typikon-strict", "parish"] as const) {
      expect(calculateFastingDay(calendarDay({ year: 2026, month: 4, day: 4 }), profile).foodRule.id).toBe("caviar");
    }
    expect(rule({ year: 2026, month: 2, day: 24 }).foodRule.id).toBe("total-abstinence");
    expect(calculateFastingDay(calendarDay({ year: 2026, month: 2, day: 24 }), "parish").foodRule.id).toBe("dry-eating");
  });

  it("uses the separately sourced Lent and Holy Week meal exceptions", () => {
    expect(rule({ year: 2026, month: 3, day: 9 }).foodRule.id).toBe("oil");
    expect(rule({ year: 2026, month: 3, day: 25 }).foodRule.id).toBe("oil");
    expect(rule({ year: 2026, month: 3, day: 26 }).foodRule.id).toBe("oil");
    for (const profile of ["typikon-strict", "parish"] as const) {
      // In 2026 the forefeast is Holy Monday, beyond ch. 32's permission.
      expect(calculateFastingDay(calendarDay({ year: 2026, month: 4, day: 6 }), profile).foodRule.id).toBe("dry-eating");
      expect(calculateFastingDay(calendarDay({ year: 2026, month: 4, day: 9 }), profile).foodRule.id).toBe("oil");
    }
    // In 2027 the forefeast falls before Lazarus Saturday.
    expect(rule({ year: 2027, month: 4, day: 6 }).foodRule.id).toBe("oil");
  });

  it("uses the three successive Nativity-fast phases", () => {
    expect(rule({ year: 2027, month: 11, day: 29 }).foodRule.id).toBe("dry-eating");
    expect(rule({ year: 2027, month: 12, day: 1 }).foodRule.id).toBe("dry-eating");
    expect(rule({ year: 2027, month: 12, day: 20 }).foodRule.id).toBe("dry-eating");
    expect(rule({ year: 2027, month: 12, day: 22 }).foodRule.id).toBe("dry-eating");
    expect(rule({ year: 2027, month: 12, day: 25 }).foodRule.id).toBe("fish");
    expect(rule({ year: 2027, month: 1, day: 4 }).foodRule.id).toBe("dry-eating");
    expect(rule({ year: 2027, month: 1, day: 6 }).foodRule.id).toBe("oil");
  });

  it("handles fast-free weeks, one-day fasts and seasonal Wednesday/Friday rules", () => {
    expect(rule({ year: 2027, month: 1, day: 13 }).foodRule.id).toBe("no-fast");
    expect(rule({ year: 2027, month: 1, day: 18 }).foodRule.id).toBe("oil");
    expect(rule({ year: 2027, month: 1, day: 20 }).foodRule.id).toBe("dry-eating");
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
    )]).toEqual(["no-fast", "dry-eating"]);
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
    expect(parish.foodRule.id).toBe("oil");
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

  it.each([
    { year: 2027, month: 3, day: 22 },
    { year: 2027, month: 8, day: 16 },
    { year: 2027, month: 1, day: 4 },
  ])("separates the published strict/parish Monday measures for $year-$month-$day", (date) => {
    expect(calculateFastingDay(calendarDay(date), "typikon-strict").foodRule.id).toBe("dry-eating");
    expect(calculateFastingDay(calendarDay(date), "parish").foodRule.id).toBe("boiled-no-oil");
    // Dormition has its own rule; a rank must not override it by analogy with Lent.
    expect(rule(date, [{ title: "Полиелейная память", typeCode: 4 }]).foodRule.id)
      .toBe(date.month === 8 ? "dry-eating" : "boiled-no-oil");
  });

  it.each([
    { year: 2027, month: 7, day: 7 },
    { year: 2026, month: 12, day: 4 },
    { year: 2025, month: 12, day: 19 },
  ])("does not make an explicit fish allowance stricter in parish mode on $year-$month-$day", (date) => {
    expect(calculateFastingDay(calendarDay(date), "typikon-strict").foodRule.id).toBe("fish");
    expect(calculateFastingDay(calendarDay(date), "parish").foodRule.id).toBe("fish");
  });

  it("applies Annunciation exceptions before the ordinary Holy Week rule", () => {
    // Published 2026-04-07 (Holy Tuesday): oil, not the normal Tuesday rule.
    expect(rule({ year: 2026, month: 4, day: 7 }).foodRule.id).toBe("oil");
    // Friday in ordinary Lent still permits fish.
    expect(rule({ year: 2023, month: 4, day: 7 }).foodRule.id).toBe("fish");
    // The same feast on Holy Friday is not a complete food abstinence day.
    expect(rule({ year: 2034, month: 4, day: 7 }).foodRule.id).toBe("boiled-no-oil");
    // Annunciation on Lazarus Saturday still has the feast's fish allowance.
    expect(rule({ year: 2001, month: 4, day: 7 }).foodRule.id).toBe("fish");
  });

  it.each([
    { year: 2027, month: 5, day: 1 },
    { year: 2026, month: 4, day: 11 },
    // Annunciation on Holy Saturday does not allow fish or oil.
    { year: 2018, month: 4, day: 7 },
  ])("does not apply the ordinary strict Saturday oil rule on Holy Saturday $year-$month-$day", (date) => {
    const strict = calculateFastingDay(calendarDay(date), "typikon-strict");
    expect(strict.foodRule.id).toBe("dry-eating");
    expect(strict.reason).toContain("разрешается вино");
    // Holy Saturday is not an ordinary Saturday in either profile.
    expect(calculateFastingDay(calendarDay(date), "parish").foodRule.id).toBe("dry-eating");
  });

  it("keeps other Saturday allowances and Pascha unchanged", () => {
    expect(rule({ year: 2027, month: 4, day: 17 }).foodRule.id).toBe("oil");
    expect(rule({ year: 2027, month: 4, day: 24 }).foodRule.id).toBe("caviar");
    expect(rule({ year: 2027, month: 5, day: 2 }).foodRule.id).toBe("no-fast");
  });

  it.each([
    { year: 2026, month: 6, day: 14 },
    { year: 2026, month: 12, day: 6 },
  ])("distinguishes ordinary, doxology and vigil rules throughout a small-fast week beginning $month/$day", (sunday) => {
    // Sunday through Saturday; independent transcription of ch. 33's Tue/Thu,
    // Wed/Fri and vigil distinctions, including its explicit Monday rule.
    const ordinary = ["fish", "dry-eating", "oil", "dry-eating", "oil", "dry-eating", "fish"];
    const doxology = ["fish", "fish", "fish", "oil", "fish", "oil", "fish"];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = addDays(sunday, weekday);
      expect(rule(date).foodRule.id).toBe(ordinary[weekday]);
      for (const typeCode of [6, 7]) {
        expect(rule(date, [{ title: "Малая память", typeCode }]).foodRule.id).toBe(ordinary[weekday]);
      }
      for (const typeCode of [4, 5]) {
        expect(rule(date, [{ title: "Празднуемый святой", typeCode }]).foodRule.id).toBe(doxology[weekday]);
      }
      for (const typeCode of [1, 2, 3]) {
        expect(rule(date, [{ title: "Бденный праздник", typeCode }]).foodRule.id).toBe("fish");
      }
    }
  });

  it("does not extend small-fast feast allowances into Lent, Dormition or the Nativity forefeast", () => {
    for (const date of [
      { year: 2027, month: 3, day: 24 },
      { year: 2027, month: 8, day: 18 },
      { year: 2027, month: 1, day: 3 },
    ]) {
      for (const typeCode of [3, 5]) {
        expect(rule(date, [{ title: "Празднуемый святой", typeCode }]).foodRule.id).not.toBe("fish");
      }
    }
  });

  it("distinguishes the two explicit Pentecost fish Wednesdays from the broader parish variant", () => {
    // 2027: Pascha May 2, Mid-Pentecost May 26, leave-taking June 9.
    for (const date of [
      { year: 2027, month: 5, day: 26 }, { year: 2027, month: 6, day: 9 },
    ]) {
      expect(rule(date).foodRule.id).toBe("fish");
    }
    for (const date of [
      { year: 2027, month: 5, day: 12 }, { year: 2027, month: 5, day: 14 },
      { year: 2027, month: 6, day: 16 }, { year: 2027, month: 6, day: 18 },
    ]) {
      expect(rule(date).foodRule.id).toBe("oil");
      expect(calculateFastingDay(calendarDay(date), "parish").foodRule.id).toBe("fish");
    }
    // A fixed fish feast still takes precedence (St John the Theologian).
    expect(rule({ year: 2027, month: 5, day: 21 }).foodRule.id).toBe("fish");
  });
});
