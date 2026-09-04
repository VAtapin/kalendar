import type { ResolvedCalendarEvent } from "../types";
import type {
  CalendarGridElement,
  CommemorationRankFilter,
  CommemorationRankFilterId,
} from "../../document/types";

export type CalendarContentCategory =
  | "commemoration"
  | "fasting-rule"
  | "marriage-rule"
  | "fast-free-rule"
  | "scripture-reading";

export const COMMEMORATION_FILTER_OPTIONS: ReadonlyArray<{
  id: CommemorationRankFilterId;
  label: string;
}> = [
  { id: "pascha-and-twelve", label: "Пасха и двунадесятые праздники" },
  { id: "great", label: "Великие праздники" },
  { id: "medium", label: "Средние праздники и памяти" },
  { id: "memorial", label: "Дни особого поминовения усопших" },
] as const;

export const COMMEMORATION_FILTER_PRESETS: Readonly<Record<
  "main" | "standard" | "full",
  CommemorationRankFilter
>> = {
  main: {
    "pascha-and-twelve": true,
    great: true,
    medium: false,
    memorial: true,
  },
  standard: {
    "pascha-and-twelve": true,
    great: true,
    medium: true,
    memorial: true,
  },
  full: {
    "pascha-and-twelve": true,
    great: true,
    medium: true,
    memorial: true,
  },
};

export function commemorationFilterForElement(
  element: CalendarGridElement,
): CommemorationRankFilter {
  if (element.commemorationFilter) return { ...element.commemorationFilter };
  const detail = element.commemorationDetail;
  const preset = detail === "main" || detail === "full" ? detail : "standard";
  return { ...COMMEMORATION_FILTER_PRESETS[preset] };
}

function commemorationRank(event: ResolvedCalendarEvent): CommemorationRankFilterId | undefined {
  if (event.typeCode <= 1) return "pascha-and-twelve";
  if (event.typeCode === 2) return "great";
  if (event.typeCode >= 3 && event.typeCode <= 5) return "medium";
  if (event.typeCode === 9) return "memorial";
  return undefined;
}

function isLiturgicalCycleLabel(event: ResolvedCalendarEvent): boolean {
  return /^(?:седмица|неделя\s+\d+-?я\s+по\s+пятидесятнице)/i.test(event.title.trim());
}

export function calendarContentCategory(event: ResolvedCalendarEvent): CalendarContentCategory {
  if (event.typeCode >= 200) return "scripture-reading";
  if (event.typeCode === 20) return "marriage-rule";
  if (event.typeCode === 100) return "fast-free-rule";
  if (event.typeCode === 10) return "fasting-rule";
  return "commemoration";
}

export function isMinorCommemorationEvent(event: ResolvedCalendarEvent): boolean {
  return event.typeCode >= 6 && event.typeCode <= 19 && event.typeCode !== 9 && event.typeCode !== 10;
}

/**
 * The XML contains several data channels. A printed wall-calendar cell shows
 * feasts and commemorations by default; fasting remains available to the food
 * marker system, while readings and marriage rules can be explicitly enabled.
 */
export function isCalendarCellEvent(
  element: CalendarGridElement,
  event: ResolvedCalendarEvent,
): boolean {
  const category = calendarContentCategory(event);
  if (category === "scripture-reading") return element.showScriptureReadings === true;
  if (category === "marriage-rule") return element.showMarriageRules === true;
  if (category === "fasting-rule" || category === "fast-free-rule") {
    return element.showFastingText === true;
  }
  if (event.typeCode < 0) return true;
  if (isLiturgicalCycleLabel(event)) return false;
  const filter = commemorationFilterForElement(element);
  const rank = commemorationRank(event);
  return rank ? filter[rank] : false;
}

/**
 * Selects a day's printable records in priority order. Lesser commemorations
 * are a fallback only: they are considered when the day has no major or medium
 * feast at all, and never more than the configured small count.
 */
export function selectCalendarCellEvents(
  element: CalendarGridElement,
  events: readonly ResolvedCalendarEvent[],
): ResolvedCalendarEvent[] {
  const hasPrimaryCommemoration = events.some((event) =>
    ((event.typeCode >= 0 && event.typeCode <= 5) || event.typeCode === 9) &&
    !isLiturgicalCycleLabel(event),
  );
  const minorLimit = Math.max(0, Math.min(3, element.minorCommemorationFallback ?? 2));
  const selectedMinorIds = new Set(
    hasPrimaryCommemoration
      ? []
      : events
          .filter((event) => isMinorCommemorationEvent(event) && !isLiturgicalCycleLabel(event))
          .slice(0, minorLimit)
          .map((event) => event.id),
  );

  return events.filter((event) =>
    isCalendarCellEvent(element, event) || selectedMinorIds.has(event.id),
  );
}
