import type { CalendarGridElement } from "../document/types";

const PRESENTATION_KEYS = [
  "showOverflowWarnings",
  "showWeekdayHeader",
  "weekdayLabelMode",
  "customWeekdayLabels",
  "showOldStyleDate",
  "maxVisibleEvents",
  "showFoodIcons",
  "showFeastColors",
  "showTypikonIcons",
  "showFastingText",
  "showMarriageRules",
  "showScriptureReadings",
  "commemorationDetail",
  "commemorationFilter",
  "minorCommemorationFallback",
  "dayNumberFontFamily",
  "eventFontFamily",
  "dayNumberFontSizePt",
  "dayNumberXOffsetMm",
  "dayNumberYOffsetMm",
  "oldStyleFontFamily",
  "oldStyleFontSizePt",
  "oldStyleXOffsetMm",
  "oldStyleYOffsetMm",
  "foodMarkerSizeMm",
  "foodMarkerXOffsetMm",
  "foodMarkerYOffsetMm",
  "eventFontSizePt",
  "eventTextXOffsetMm",
  "eventTextYOffsetMm",
  "eventTextRightInsetMm",
  "eventTextBottomInsetMm",
  "typikonMarkerSizeMm",
  "typikonMarkerXOffsetMm",
  "typikonMarkerYOffsetMm",
  "autoFitText",
  "minimumEventFontSizePt",
  "eventLineSpacingPt",
  "eventGapPt",
  "eventLineHeight",
  "cellPaddingMm",
  "gridStyle",
  "weekdayFontFamily",
  "weekdayFontSizePt",
  "weekdayTextEffects",
  "dayNumberTextEffects",
] as const satisfies ReadonlyArray<keyof CalendarGridElement>;

/** Copies visual/calendar-cell settings while preserving each page's month and geometry. */
export function copyCalendarGridPresentation(
  source: CalendarGridElement,
  target: CalendarGridElement,
): void {
  for (const key of PRESENTATION_KEYS) {
    const value = source[key];
    if (value === undefined) {
      delete (target as unknown as Record<string, unknown>)[key];
    } else {
      // Sources selected in Vue are proxies; structuredClone rejects proxies.
      // Presentation values are JSON-safe, so materialise them before copying.
      (target as unknown as Record<string, unknown>)[key] = typeof value === "object"
        ? JSON.parse(JSON.stringify(value))
        : value;
    }
  }
}
