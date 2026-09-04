import { describe, expect, it } from "vitest";
import type { OrthodoxCalendarDay, ResolvedCalendarEvent } from "../src/calendar";
import {
  dayNumberTypikonStyle,
  eventTypikonStyle,
  typikonMarkForEvent,
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
    expect(typikonMarkForEvent(event(18))).toBe("six_stichera");
    expect(typikonMarkForEvent(event(-100, "monastery-feast"))).toBe("six_stichera");
  });

  it("marks every Sunday red and honours monastery styling", () => {
    expect(dayNumberTypikonStyle(day(0, [])).rank).toBe("sunday");
    expect(eventTypikonStyle(event(18), day(0, [event(18)])).color).toBe("#a12b2b");
    expect(dayNumberTypikonStyle(day(2, [event(18, "monastery-feast")])).rank).toBe("monastery-feast");
  });
});
