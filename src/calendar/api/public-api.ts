import type { CalendarDate, ResolvedCalendarEvent } from "../types";
import {
  FASTING_PROFILES,
  type FastingDayResolution,
  type FastingProfileId,
  type OrthodoxCalendarApi,
} from "../fasting/fasting-api";
import { toIsoDate } from "../date/calendar-date";

export const ORTHODOX_CALENDAR_API_VERSION = "1.0.0" as const;

export interface CalendarApiMetadata {
  apiVersion: typeof ORTHODOX_CALENDAR_API_VERSION;
  calendarDataSource: string;
  fastingProfileId: FastingProfileId;
  fastingRulesVersion: string;
  sourceUrls: readonly string[];
}

export interface CalendarApiEvent {
  id: string;
  title: string;
  shortTitle?: string;
  veryShortTitle?: string;
  typeCode: number;
  priority: number;
  ruleKind: ResolvedCalendarEvent["ruleKind"];
  styleToken?: string;
}

export interface CalendarApiDay {
  date: string;
  oldStyleDate: string;
  weekday: number;
  events: CalendarApiEvent[];
  fasting: FastingDayResolution;
}

export interface CalendarApiYear {
  metadata: CalendarApiMetadata;
  year: number;
  pascha: string;
  fastingPeriods: ReturnType<OrthodoxCalendarApi["getFastingPeriods"]>;
  days: CalendarApiDay[];
}

function serializeEvent(event: ResolvedCalendarEvent): CalendarApiEvent {
  return {
    id: event.id,
    title: event.title,
    ...(event.shortTitle ? { shortTitle: event.shortTitle } : {}),
    ...(event.veryShortTitle ? { veryShortTitle: event.veryShortTitle } : {}),
    typeCode: event.typeCode,
    priority: event.priority,
    ruleKind: event.ruleKind,
    ...(event.styleToken ? { styleToken: event.styleToken } : {}),
  };
}

export function parseCalendarApiDate(value: string): CalendarDate | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const date = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const verified = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return verified.getUTCFullYear() === date.year &&
    verified.getUTCMonth() === date.month - 1 &&
    verified.getUTCDate() === date.day
    ? date
    : undefined;
}

/** Stable JSON-facing facade shared by the browser, CLI and optional HTTP host. */
export function createCalendarPublicApi(api: OrthodoxCalendarApi) {
  const metadata = (): CalendarApiMetadata => ({
    apiVersion: ORTHODOX_CALENDAR_API_VERSION,
    calendarDataSource: api.dataset.sourceName,
    fastingProfileId: api.profile.id,
    fastingRulesVersion: FASTING_PROFILES[api.profile.id].rulesVersion,
    sourceUrls: FASTING_PROFILES[api.profile.id].sourceUrls,
  });
  const getDay = (date: CalendarDate): CalendarApiDay | undefined => {
    const day = api.getDay(date);
    const fasting = api.getFasting(date);
    if (!day || !fasting) return undefined;
    return {
      date: day.isoDate,
      oldStyleDate: toIsoDate(day.oldStyleDate),
      weekday: day.weekday,
      events: day.events.map(serializeEvent),
      fasting,
    };
  };
  return {
    metadata,
    getDay,
    getYear(year: number): CalendarApiYear {
      const calendar = api.getYear(year);
      return {
        metadata: metadata(),
        year,
        pascha: toIsoDate(calendar.pascha),
        fastingPeriods: api.getFastingPeriods(year),
        days: calendar.days.map((day) => getDay(day.date)!),
      };
    },
    getPascha(year: number) {
      return {
        metadata: metadata(),
        year,
        pascha: toIsoDate(api.getPascha(year)),
      };
    },
  };
}

export type CalendarPublicApi = ReturnType<typeof createCalendarPublicApi>;
