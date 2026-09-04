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
    expect(fitted.omittedMinorEventCount).toBe(1);
    expect(fitted.hiddenRequiredEventCount).toBe(0);
  });

  it("never drops required feasts because of the optional event limit", () => {
    const importantEvents = [2, 3, 4, 5].map((typeCode, index) => ({
      id: `important-${index}`,
      sourceId: "source",
      sourceIndex: index,
      title: `Важный праздник ${index + 1}`,
      typeCode,
      occurrenceDate: { year: 2027, month: 5, day: 1 },
      spanStart: { year: 2027, month: 5, day: 1 },
      spanFinish: { year: 2027, month: 5, day: 1 },
      dayIndexInSpan: 0,
      ruleKind: "fixed-julian" as const,
      priority: 100 - index,
    }));
    const day = { ...days[0]!, events: importantEvents };
    const fitted = layoutCalendarCellTextAutoFit(
      { ...element, maxVisibleEvents: 1, eventFontSizePt: 8, minimumEventFontSizePt: 8 },
      { key: "0-0", column: 0, row: 0, x: 0, y: 0, width: 40, height: 40, day },
      (text, fontSizeMm) => text.length * fontSizeMm * 0.35,
    );

    expect(new Set(fitted.lines.map((line) => line.event.id))).toEqual(new Set(importantEvents.map((event) => event.id)));
    expect(fitted.hiddenRequiredEventCount).toBe(0);
  });

  it("reserves a readable left rail for the number and a large food marker", () => {
    const typography = calendarCellTypography(element);
    const cell = buildCalendarGridLayout(element, calendar).cells.find((item) => item.day);
    if (!cell) throw new Error("Expected a calendar day cell");
    const marker = calendarFoodMarkerGeometry(element, cell);

    expect(typography.contentLeftMm).toBeGreaterThan(14);
    expect(typography.eventMarkerSizeMm).toBeGreaterThanOrEqual(4);
    expect(typography.eventMarkerWidthMm).toBe(0);
    expect(calendarCellTypography({ ...element, showTypikonIcons: true }).eventMarkerSizeMm).toBeGreaterThan(4);
    expect(typography.dayNumberFontSizeMm).toBeGreaterThan(9);
    expect(typography.eventFontSizeMm).toBeCloseTo(10 * (25.4 / 72));
    expect(marker.sizeMm).toBeGreaterThanOrEqual(9);
    expect(marker.sizeMm).toBeLessThanOrEqual(typography.dayNumberFontSizeMm);
    expect(marker.xOffsetMm).toBe(typography.paddingMm);
    expect(marker.yOffsetMm + marker.sizeMm).toBeLessThan(cell.height);
  });

  it("keeps date, old-style date, food marker and event geometry independent", () => {
    const configured = {
      ...element,
      dayNumberFontSizePt: 6,
      dayNumberXOffsetMm: 2,
      dayNumberYOffsetMm: 3,
      oldStyleFontSizePt: 5,
      oldStyleXOffsetMm: 4,
      oldStyleYOffsetMm: 5,
      foodMarkerSizeMm: 8,
      foodMarkerXOffsetMm: 6,
      foodMarkerYOffsetMm: 7,
      eventTextXOffsetMm: 9,
      eventTextYOffsetMm: 10,
    };
    const small = calendarCellTypography(configured);
    const large = calendarCellTypography({ ...configured, dayNumberFontSizePt: 100 });
    const cell = buildCalendarGridLayout(configured, calendar).cells.find((item) => item.day)!;
    expect(small.dayNumberFontSizeMm).toBeCloseTo(6 * (25.4 / 72));
    expect(large.dayNumberFontSizeMm).toBeCloseTo(100 * (25.4 / 72));
    expect(large.dayNumberXOffsetMm).toBe(2);
    expect(large.oldStyleYOffsetMm).toBe(5);
    expect(large.contentLeftMm).toBe(9);
    expect(calendarFoodMarkerGeometry({ ...configured, dayNumberFontSizePt: 100 }, cell)).toEqual({
      xOffsetMm: 6,
      yOffsetMm: 7,
      sizeMm: 8,
    });
  });

  it("uses separate point settings for line leading and gaps between events", () => {
    const events = ["Первое событие", "Второе событие"].map((title, index) => ({
      id: `event-${index}`,
      sourceId: "source",
      sourceIndex: index,
      title,
      typeCode: index + 2,
      occurrenceDate: { year: 2027, month: 5, day: 1 },
      spanStart: { year: 2027, month: 5, day: 1 },
      spanFinish: { year: 2027, month: 5, day: 1 },
      dayIndexInSpan: 0,
      ruleKind: "fixed-julian" as const,
      priority: 10 - index,
    }));
    const day = { ...days[0]!, events };
    const configured = {
      ...element,
      eventFontSizePt: 10,
      eventLineSpacingPt: 0.5,
      eventGapPt: 1,
      eventTextXOffsetMm: 0,
      eventTextYOffsetMm: 0,
      eventTextRightInsetMm: 0,
      eventTextBottomInsetMm: 0,
    };
    const fitted = layoutCalendarCellTextAutoFit(
      configured,
      { key: "0-0", column: 0, row: 0, x: 0, y: 0, width: 80, height: 40, day },
      (text, fontSizeMm) => text.length * fontSizeMm * 0.2,
    );
    expect(fitted.lines).toHaveLength(2);
    expect(fitted.lines[1]!.baselineY - fitted.lines[0]!.baselineY).toBeCloseTo(11.5 * (25.4 / 72));
  });
});
