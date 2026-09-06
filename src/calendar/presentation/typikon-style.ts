import type { OrthodoxCalendarDay, ResolvedCalendarEvent } from "../types";

export type TypikonRank =
  | "pascha"
  | "great-feast"
  | "medium-feast"
  | "monastery-feast"
  | "sunday"
  | "ordinary";

export interface TypikonTextStyle {
  rank: TypikonRank;
  color: string;
  fontWeight: number;
}

export type TypikonMarkKind = "great" | "vigil" | "polyeleos" | "doxology" | "six_stichera";

const RED = "#a12b2b";
const GOLD = "#8a641b";
const BLACK = "#17201d";

/**
 * Types 0-2 also make the day number red. Types 3-5 keep an ordinary day
 * number but use the red typikon sign and therefore red event text.
 */
export function isRedLetterEvent(event: ResolvedCalendarEvent): boolean {
  return event.typeCode >= 0 && event.typeCode <= 2;
}

export function eventTypikonStyle(
  event: ResolvedCalendarEvent,
  day?: OrthodoxCalendarDay,
): TypikonTextStyle {
  if (day?.weekday === 0) {
    return { rank: "sunday", color: RED, fontWeight: 700 };
  }
  if (event.styleToken === "monastery-feast") {
    return { rank: "monastery-feast", color: GOLD, fontWeight: 700 };
  }
  if (event.typeCode === 0) return { rank: "pascha", color: RED, fontWeight: 700 };
  if (isRedLetterEvent(event)) return { rank: "great-feast", color: RED, fontWeight: 700 };
  if (event.typeCode >= 3 && event.typeCode <= 5) {
    return { rank: "medium-feast", color: RED, fontWeight: 700 };
  }
  return { rank: "ordinary", color: BLACK, fontWeight: 400 };
}

export function typikonMarkForEvent(event: ResolvedCalendarEvent): TypikonMarkKind | undefined {
  if (!Number.isInteger(event.typeCode)) return undefined;
  if (event.typeCode >= 0 && event.typeCode <= 2) return "great";
  if (event.typeCode === 3) return "vigil";
  if (event.typeCode === 4) return "polyeleos";
  if (event.typeCode === 5) return "doxology";
  if (event.typeCode === 6) return "six_stichera";
  // Ordinary memories (7), other categories and unknown codes have no sign.
  return undefined;
}

/** Select the highest explicit rank, independently of text ordering or clipping. */
export function primaryTypikonEvent(events: readonly ResolvedCalendarEvent[]): ResolvedCalendarEvent | undefined {
  return events.reduce<ResolvedCalendarEvent | undefined>((selected, event) => {
    if (!typikonMarkForEvent(event)) return selected;
    return !selected || event.typeCode < selected.typeCode ? event : selected;
  }, undefined);
}

export function dayNumberTypikonStyle(day: OrthodoxCalendarDay): TypikonTextStyle {
  if (day.events.some((event) => event.styleToken === "monastery-feast")) {
    return { rank: "monastery-feast", color: GOLD, fontWeight: 700 };
  }
  if (day.events.some((event) => event.typeCode === 0)) {
    return { rank: "pascha", color: RED, fontWeight: 700 };
  }
  if (day.weekday === 0) return { rank: "sunday", color: RED, fontWeight: 700 };
  if (day.events.some(isRedLetterEvent)) {
    return { rank: "great-feast", color: RED, fontWeight: 700 };
  }
  return { rank: "ordinary", color: BLACK, fontWeight: 700 };
}
