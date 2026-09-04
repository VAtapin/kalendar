import type { CalendarGridElement } from "../document/types";

const PT_TO_MM = 25.4 / 72;

/**
 * Materialises independent cell-object geometry. Once written, changing one
 * value (for example the date size) cannot silently move or resize another.
 */
export function applyDefaultCalendarCellGeometry(
  element: CalendarGridElement,
  force = false,
): void {
  const set = <K extends keyof CalendarGridElement>(key: K, value: CalendarGridElement[K]) => {
    if (force || element[key] === undefined) element[key] = value;
  };
  const padding = element.cellPaddingMm ?? 1.5;
  const daySizeMm = (element.dayNumberFontSizePt ?? 30) * PT_TO_MM;
  const eventSizeMm = (element.eventFontSizePt ?? 10) * PT_TO_MM;
  const eventSizePt = element.eventFontSizePt ?? 10;
  const cellWidth = element.width / 7;
  const numberRail = Math.min(
    Math.max(7.2, cellWidth * 0.43),
    Math.max(14.2, daySizeMm * 1.35),
  );
  const typikonSize = Math.min(4.6, Math.max(4.1, eventSizeMm * 1.5));
  const eventX = padding + numberRail;
  const foodSize = Math.min(daySizeMm * 0.92, Math.max(7, Math.min(9.5, numberRail - 0.4)));

  set("dayNumberXOffsetMm", padding);
  set("dayNumberYOffsetMm", padding);
  set("oldStyleFontFamily", "Cormorant Garamond");
  set("oldStyleFontSizePt", 4.4);
  set("oldStyleXOffsetMm", padding);
  set("oldStyleYOffsetMm", padding + daySizeMm + 1.05);
  const foodY = padding + daySizeMm + 2;
  set("foodMarkerSizeMm", foodSize);
  set("foodMarkerXOffsetMm", padding);
  set("foodMarkerYOffsetMm", foodY);
  set("eventTextXOffsetMm", eventX);
  set("eventTextYOffsetMm", padding);
  set("eventTextRightInsetMm", padding);
  set("eventTextBottomInsetMm", padding);
  set("eventLineSpacingPt", Math.max(0, eventSizePt * ((element.eventLineHeight ?? 1.08) - 1)));
  set("eventGapPt", 1);
  set("typikonMarkerSizeMm", typikonSize);
  set("typikonMarkerXOffsetMm", padding);
  set("typikonMarkerYOffsetMm", foodY + foodSize + 0.8);
}
