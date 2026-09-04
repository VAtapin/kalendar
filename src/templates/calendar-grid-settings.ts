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
  "eventFontSizePt",
  "autoFitText",
  "minimumEventFontSizePt",
  "eventLineHeight",
  "cellPaddingMm",
  "gridStyle",
  "weekdayFontFamily",
  "weekdayFontSizePt",
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
      (target as unknown as Record<string, unknown>)[key] = structuredClone(value);
    }
  }
}
