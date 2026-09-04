import { describe, expect, it } from "vitest";
import type { ResolvedCalendarEvent } from "../src/calendar";
import type { CalendarGridElement } from "../src/document/types";
import {
  calendarContentCategory,
  isCalendarCellEvent,
  selectCalendarCellEvents,
} from "../src/calendar/presentation/calendar-content-policy";

function event(typeCode: number, title = "Запись", id = String(typeCode)): ResolvedCalendarEvent {
  const date = { year: 2027, month: 1, day: 1 };
  return {
    id,
    sourceId: "source",
    sourceIndex: 0,
    title,
    typeCode,
    occurrenceDate: date,
    spanStart: date,
    spanFinish: date,
    dayIndexInSpan: 0,
    ruleKind: "fixed-julian",
    priority: 1,
  };
}

const grid = {
  showFastingText: false,
  showMarriageRules: false,
  showScriptureReadings: false,
  commemorationDetail: "standard",
  minorCommemorationFallback: 2,
} as CalendarGridElement;

describe("calendar cell content policy", () => {
  it("keeps feasts and commemorations but hides service data by default", () => {
    expect(isCalendarCellEvent(grid, event(1))).toBe(true);
    expect(isCalendarCellEvent(grid, event(3))).toBe(true);
    expect(isCalendarCellEvent(grid, event(5))).toBe(true);
    expect(isCalendarCellEvent(grid, event(6))).toBe(false);
    expect(isCalendarCellEvent(grid, event(18))).toBe(false);
    expect(isCalendarCellEvent(grid, event(19))).toBe(false);
    expect(isCalendarCellEvent(grid, event(10))).toBe(false);
    expect(isCalendarCellEvent(grid, event(20))).toBe(false);
    expect(isCalendarCellEvent(grid, event(204))).toBe(false);
  });

  it("classifies and enables optional XML channels independently", () => {
    expect(calendarContentCategory(event(207))).toBe("scripture-reading");
    expect(isCalendarCellEvent({ ...grid, showScriptureReadings: true }, event(207))).toBe(true);
    expect(isCalendarCellEvent({ ...grid, showFastingText: true }, event(100))).toBe(true);
    expect(isCalendarCellEvent({ ...grid, showMarriageRules: true }, event(20))).toBe(true);
    expect(isCalendarCellEvent({ ...grid, commemorationDetail: "main" }, event(3))).toBe(false);
    expect(isCalendarCellEvent({ ...grid, commemorationDetail: "full" }, event(5))).toBe(true);
  });

  it("uses at most two lesser commemorations only when a day has no stronger record", () => {
    expect(selectCalendarCellEvents(grid, [event(3), event(18)])).toEqual([event(3)]);

    const lesser = [event(6, "Малая 1", "minor-1"), event(18, "Малая 2", "minor-2"), event(19, "Малая 3", "minor-3")];
    expect(selectCalendarCellEvents(grid, lesser).map((item) => item.id)).toEqual(["minor-1", "minor-2"]);
    expect(selectCalendarCellEvents({ ...grid, minorCommemorationFallback: 0 }, lesser)).toEqual([]);
  });

  it("does not print liturgical week labels or pad memorial days with lesser names", () => {
    const week = event(3, "Седмица 14-я по Пятидесятнице", "week");
    const minor = event(18, "Малая память", "minor");
    expect(selectCalendarCellEvents(grid, [week, minor])).toEqual([minor]);
    expect(selectCalendarCellEvents(grid, [event(9), minor]).map((item) => item.id)).toEqual(["9"]);
  });

  it("sorts mandatory feasts ahead of lesser fallback records", () => {
    const selected = selectCalendarCellEvents(grid, [
      event(18, "Малая", "minor"),
      event(4, "Средняя", "medium"),
      event(1, "Двунадесятая", "twelve"),
    ]);
    expect(selected.map((item) => item.id)).toEqual(["twelve", "medium"]);
  });
});
