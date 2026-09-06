import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildOrthodoxCalendarYear, parseMemoryDaysXml } from "../src/calendar";
import type { OrthodoxCalendarDay, ResolvedCalendarEvent } from "../src/calendar";
import {
  dayNumberTypikonStyle,
  eventTypikonStyle,
  typikonMarkForEvent,
  primaryTypikonEvent,
} from "../src/calendar/presentation/typikon-style";

function event(typeCode: number, styleToken?: string): ResolvedCalendarEvent {
  return {
    id: String(typeCode), sourceId: "source", sourceIndex: 0, title: "Праздник",
    typeCode, occurrenceDate: { year: 2027, month: 9, day: 11 },
    spanStart: { year: 2027, month: 9, day: 11 }, spanFinish: { year: 2027, month: 9, day: 11 },
    dayIndexInSpan: 0, ruleKind: "fixed-julian", priority: 1, styleToken,
  };
}

function day(weekday: number, events: ResolvedCalendarEvent[]): OrthodoxCalendarDay {
  return {
    date: { year: 2027, month: 9, day: 11 }, isoDate: "2027-09-11",
    oldStyleDate: { year: 2027, month: 8, day: 29 }, weekday, events,
  };
}

describe("typikon presentation", () => {
  it("uses red text for every event whose typikon sign is red", () => {
    expect(eventTypikonStyle(event(2)).rank).toBe("great-feast");
    expect(eventTypikonStyle(event(3))).toMatchObject({ rank: "medium-feast", color: "#a12b2b", fontWeight: 700 });
    expect(eventTypikonStyle(event(4)).color).toBe("#a12b2b");
    expect(eventTypikonStyle(event(5)).color).toBe("#a12b2b");
    expect(eventTypikonStyle(event(6))).toMatchObject({ rank: "ordinary", fontWeight: 400 });
  });

  it("maps XML ranks to printable typikon marks", () => {
    expect(typikonMarkForEvent(event(0))).toBe("great");
    expect(typikonMarkForEvent(event(2))).toBe("great");
    expect(typikonMarkForEvent(event(3))).toBe("vigil");
    expect(typikonMarkForEvent(event(4))).toBe("polyeleos");
    expect(typikonMarkForEvent(event(5))).toBe("doxology");
    expect(typikonMarkForEvent(event(6))).toBe("six_stichera");
    for (const code of [7, 8, 9, 10, 16, 17, 18, 19, 20, 100, 201, -100, 999, 6.5, NaN]) {
      expect(typikonMarkForEvent(event(code))).toBeUndefined();
    }
    expect(typikonMarkForEvent(event(-100, "monastery-feast"))).toBeUndefined();
  });

  it("selects only an explicit rank regardless of event order", () => {
    expect(primaryTypikonEvent([])).toBeUndefined();
    expect(primaryTypikonEvent([event(7), event(18), event(100)])).toBeUndefined();
    expect(primaryTypikonEvent([event(100), event(6), event(4), event(7)])?.typeCode).toBe(4);
    expect(primaryTypikonEvent([event(4), event(7), event(6), event(100)])?.typeCode).toBe(4);
  });

  it("does not manufacture signs for ordinary February 2027 memories", () => {
    const calendar = buildOrthodoxCalendarYear(2027, parseMemoryDaysXml(
      readFileSync(new URL("../public/data/MemoryDays.xml", import.meta.url), "utf8"),
    ));
    for (const isoDate of ["2027-02-03", "2027-02-04"]) {
      const current = calendar.days.find((item) => item.isoDate === isoDate)!;
      expect(current).toBeDefined();
      expect(primaryTypikonEvent(current.events), isoDate).toBeUndefined();
    }
    const presentation = calendar.days.find((item) => item.isoDate === "2027-02-15")!;
    expect(typikonMarkForEvent(primaryTypikonEvent(presentation.events)!)).toBe("great");
    // The afterfeast itself is unmarked, but this day also has a ranked memory.
    const afterfeast = calendar.days.find((item) => item.isoDate === "2027-02-16")!;
    expect(typikonMarkForEvent(primaryTypikonEvent(afterfeast.events)!)).toBe("six_stichera");
    const sixStichera = calendar.days.flatMap((item) => item.events).filter((item) => item.typeCode === 6);
    expect(sixStichera.length).toBeGreaterThan(0);
    expect(sixStichera.every((item) => typikonMarkForEvent(item) === "six_stichera")).toBe(true);
  });

  it("marks every Sunday red and honours monastery styling", () => {
    expect(dayNumberTypikonStyle(day(0, [])).rank).toBe("sunday");
    expect(eventTypikonStyle(event(18), day(0, [event(18)])).color).toBe("#a12b2b");
    expect(dayNumberTypikonStyle(day(2, [event(18, "monastery-feast")])).rank).toBe("monastery-feast");
  });
});
