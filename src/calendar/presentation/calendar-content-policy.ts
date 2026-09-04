import type { ResolvedCalendarEvent } from "../types";
import type {
  CalendarGridElement,
  CommemorationRankFilter,
  CommemorationRankFilterId,
} from "../../document/types";
import { LITURGICAL_STYLE } from "../engine/liturgical-cycle";

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

function isGeneratedLiturgicalEvent(event: ResolvedCalendarEvent): boolean {
  return Object.values(LITURGICAL_STYLE).includes(
    event.styleToken as (typeof LITURGICAL_STYLE)[keyof typeof LITURGICAL_STYLE],
  );
}

function isLegacyLiturgicalCycleLabel(event: ResolvedCalendarEvent): boolean {
  return /^(?:седмица|неделя\b)/iu.test(event.title.trim());
}

function isAfterfeastOrLeaveTaking(event: ResolvedCalendarEvent): boolean {
  return event.styleToken === LITURGICAL_STYLE.afterfeast ||
    event.styleToken === LITURGICAL_STYLE.leaveTaking ||
    /^(?:попразднство|отдание праздника|предпразднство)/iu.test(event.title.trim());
}

function isPascha(event: ResolvedCalendarEvent): boolean {
  return event.typeCode === 0 || /(?:светлое христово воскресение|\bпасха\b)/iu.test(event.title);
}

function isTwelveGreatFeast(event: ResolvedCalendarEvent): boolean {
  return event.typeCode === 1;
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
 * Records that must survive print fitting. Minor commemorations are the only
 * records the renderer may silently omit when the cell is short.
 */
export function isRequiredCalendarEvent(event: ResolvedCalendarEvent): boolean {
  return !isMinorCommemorationEvent(event);
}

function eventPrintRank(event: ResolvedCalendarEvent): number {
  if (isPascha(event)) return 0;
  if (isTwelveGreatFeast(event)) return 1;
  if (isGeneratedLiturgicalEvent(event) || isAfterfeastOrLeaveTaking(event)) return 2;
  if (event.typeCode < 0) return 3;
  if (event.typeCode === 2) return 4;
  if (event.typeCode >= 3 && event.typeCode <= 5) return 5;
  if (event.typeCode === 9) return 6;
  return 10;
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
  if (isGeneratedLiturgicalEvent(event) || isAfterfeastOrLeaveTaking(event)) return true;
  if (event.typeCode < 0) return true;
  if (isLegacyLiturgicalCycleLabel(event)) return false;
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
  const paschaEvents = events.filter(isPascha);
  if (paschaEvents.length > 0) {
    return paschaEvents
      .sort((left, right) => right.priority - left.priority || left.sourceIndex - right.sourceIndex)
      .slice(0, 1);
  }

  const hasTwelveGreatFeast = events.some(isTwelveGreatFeast);
  const precedenceFiltered = hasTwelveGreatFeast
    ? events.filter((event) =>
        isTwelveGreatFeast(event) || isGeneratedLiturgicalEvent(event) || isAfterfeastOrLeaveTaking(event),
      )
    : [...events];
  const hasPrimaryCommemoration = precedenceFiltered.some((event) =>
    ((event.typeCode >= 0 && event.typeCode <= 5) || event.typeCode === 9) &&
    !isLegacyLiturgicalCycleLabel(event),
  ) || precedenceFiltered.some(isGeneratedLiturgicalEvent) || precedenceFiltered.some(isAfterfeastOrLeaveTaking);
  const minorLimit = Math.max(0, element.minorCommemorationFallback ?? 2);
  const selectedMinorIds = new Set(
    hasPrimaryCommemoration
      ? []
      : precedenceFiltered
          .filter((event) => isMinorCommemorationEvent(event) && !isLegacyLiturgicalCycleLabel(event))
          .slice(0, minorLimit)
          .map((event) => event.id),
  );

  const sorted = precedenceFiltered
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => isCalendarCellEvent(element, event) || selectedMinorIds.has(event.id))
    .sort((left, right) =>
      eventPrintRank(left.event) - eventPrintRank(right.event) ||
      right.event.priority - left.event.priority ||
      left.index - right.index,
    )
    .map(({ event }) => event);

  const titles = new Set<string>();
  return sorted.filter((event) => {
    const key = event.title.toLocaleLowerCase("ru").replace(/[ё]/gu, "е").replace(/[^а-яa-z0-9]+/giu, " ").trim();
    if (titles.has(key)) return false;
    titles.add(key);
    return true;
  });
}
