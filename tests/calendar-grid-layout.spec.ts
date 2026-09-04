import { describe, expect, it } from "vitest";
import {
  buildCalendarGridLayout,
  calendarCellTypography,
  calendarFoodMarkerGeometry,
  layoutCalendarCellTextAutoFit,
} from "../src/layout/calendar-grid-layout";
import type { OrthodoxCalendarYear } from "../src/calendar";
import type { CalendarGridElement } from "../src/document/types";

const element: CalendarGridElement = {
  id: "grid",
  type: "calendar-grid",
  layerId: "layer",
  x: 10,
  y: 100,
  width: 277,
  height: 180,
  rotation: 0,
  zIndex: 0,
  locked: false,
  visible: true,
  overflow: "none",
  month: 5,
  columns: 7,
  weekRows: 6,
  showOverflowWarnings: true,
  showWeekdayHeader: true,
  weekdayLabelMode: "full",
  showOldStyleDate: false,
  maxVisibleEvents: 3,
  showFoodIcons: true,
  showFeastColors: true,
};

const days = Array.from({ length: 31 }, (_, index) => ({
  date: { year: 2027, month: 5, day: index + 1 },
  isoDate: `2027-05-${String(index + 1).padStart(2, "0")}`,
  oldStyleDate: { year: 2027, month: 4, day: index + 1 },
  weekday: (index + 6) % 7,
  events: [],
}));

const calendar: OrthodoxCalendarYear = {
  year: 2027,
  pascha: { year: 2027, month: 5, day: 2 },
  days,
  daysByIsoDate: Object.fromEntries(days.map((day) => [day.isoDate, day])),
  diagnostics: [],
};

describe("calendar grid layout", () => {
  it("maps a Monday-first month into physical millimetre cells", () => {
    const layout = buildCalendarGridLayout(element, calendar);

    expect(layout.cells).toHaveLength(42);
    expect(layout.cells.find((cell) => cell.day?.date.day === 1)?.column).toBe(5);
    expect(layout.cells.find((cell) => cell.day?.date.day === 2)?.column).toBe(6);
    expect(layout.cells[0]?.x).toBe(10);
    expect(layout.columnWidth).toBeCloseTo(277 / 7);
    expect(layout.hasRowOverflow).toBe(false);
  });

  it("reduces the event type size before accepting text overflow", () => {
    const day = {
      ...days[0]!,
      events: [{
        id: "long-memory",
        sourceId: "source",
        sourceIndex: 0,
        title: "Очень длинная память святого, которая не помещается крупным кеглем",
        typeCode: 3,
        occurrenceDate: { year: 2027, month: 5, day: 1 },
        spanStart: { year: 2027, month: 5, day: 1 },
        spanFinish: { year: 2027, month: 5, day: 1 },
        dayIndexInSpan: 0,
        ruleKind: "fixed-julian" as const,
        priority: 1,
      }],
    };
    const cell = {
      key: "0-0",
      column: 0,
      row: 0,
      x: 0,
      y: 0,
      width: 36,
      height: 16,
      day,
    };
    const fitted = layoutCalendarCellTextAutoFit(
      {
        ...element,
        eventFontSizePt: 8,
        minimumEventFontSizePt: 4,
        autoFitText: true,
      },
      cell,
      (text, fontSizeMm) => text.length * fontSizeMm * 0.52,
    );

    expect(fitted.usedFontSizePt).toBeLessThan(8);
    expect(fitted.truncatedEventCount).toBe(0);
  });

  it("omits an overflowing lesser fallback without printing a web-style more label", () => {
    const day = {
      ...days[0]!,
      events: [{
        id: "minor-memory",
        sourceId: "source",
        sourceIndex: 0,
        title: "Очень длинная малая память, которая не должна попадать в печать при нехватке места",
        typeCode: 18,
        occurrenceDate: { year: 2027, month: 5, day: 1 },
        spanStart: { year: 2027, month: 5, day: 1 },
        spanFinish: { year: 2027, month: 5, day: 1 },
        dayIndexInSpan: 0,
        ruleKind: "fixed-julian" as const,
        priority: 1,
      }],
    };
    const fitted = layoutCalendarCellTextAutoFit(
      { ...element, eventFontSizePt: 8, minimumEventFontSizePt: 6, autoFitText: true },
      { key: "0-0", column: 0, row: 0, x: 0, y: 0, width: 18, height: 8, day },
      (text, fontSizeMm) => text.length * fontSizeMm * 0.52,
    );

    expect(fitted.lines).toEqual([]);
    expect(fitted.truncatedEventCount).toBe(0);
  });

  it("reserves a readable left rail for the number and a large food marker", () => {
    const typography = calendarCellTypography(element);
    const cell = buildCalendarGridLayout(element, calendar).cells.find((item) => item.day);
    if (!cell) throw new Error("Expected a calendar day cell");
    const marker = calendarFoodMarkerGeometry(element, cell);

    expect(typography.contentLeftMm).toBeGreaterThan(14);
    expect(typography.eventMarkerSizeMm).toBeGreaterThanOrEqual(4);
    expect(typography.eventMarkerWidthMm).toBe(0);
    expect(calendarCellTypography({ ...element, showTypikonIcons: true }).eventMarkerWidthMm).toBeGreaterThan(4);
    expect(typography.dayNumberFontSizeMm).toBeGreaterThan(9);
    expect(typography.eventFontSizeMm).toBeCloseTo(9 * (25.4 / 72));
    expect(marker.sizeMm).toBeGreaterThanOrEqual(9);
    expect(marker.sizeMm).toBeLessThanOrEqual(typography.dayNumberFontSizeMm);
    expect(marker.xOffsetMm).toBe(typography.paddingMm);
    expect(marker.yOffsetMm + marker.sizeMm).toBeLessThan(cell.height);
  });
});
