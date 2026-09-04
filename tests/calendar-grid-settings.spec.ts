import { describe, expect, it } from "vitest";
import type { CalendarGridElement } from "../src/document/types";
import { copyCalendarGridPresentation } from "../src/templates/calendar-grid-settings";

function grid(id: string, month: number): CalendarGridElement {
  return {
    id,
    layerId: `layer-${id}`,
    type: "calendar-grid",
    x: 10,
    y: 100,
    width: 277,
    height: 200,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    overflow: "none",
    month,
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
}

describe("calendar grid presentation", () => {
  it("copies typography without replacing month or geometry", () => {
    const source = grid("source", 1);
    source.gridStyle = "editorial";
    source.eventFontSizePt = 7.5;
    source.foodMarkerSizeMm = 11;
    source.foodMarkerXOffsetMm = 3.2;
    source.eventTextYOffsetMm = -1;
    source.eventLineSpacingPt = 0.75;
    source.eventGapPt = 1.25;
    source.showTypikonIcons = true;
    source.customWeekdayLabels = ["1", "2", "3", "4", "5", "6", "7"];
    const target = grid("target", 9);
    target.x = 30;
    target.eventFontSizePt = 5;

    copyCalendarGridPresentation(source, target);

    expect(target.month).toBe(9);
    expect(target.x).toBe(30);
    expect(target.eventFontSizePt).toBe(7.5);
    expect(target.foodMarkerSizeMm).toBe(11);
    expect(target.foodMarkerXOffsetMm).toBe(3.2);
    expect(target.eventTextYOffsetMm).toBe(-1);
    expect(target.eventLineSpacingPt).toBe(0.75);
    expect(target.eventGapPt).toBe(1.25);
    expect(target.gridStyle).toBe("editorial");
    expect(target.showTypikonIcons).toBe(true);
    expect(target.customWeekdayLabels).not.toBe(source.customWeekdayLabels);
  });
});
