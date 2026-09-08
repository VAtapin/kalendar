import type { CalendarDate, ResolvedCalendarEvent } from "../types";
import {
  FASTING_PROFILES,
  type FastingDayResolution,
  type FastingProfileId,
  type OrthodoxCalendarApi,
} from "../fasting/fasting-api";
import { toIsoDate } from "../date/calendar-date";
import { compareDates } from '../date/calendar-date';
import type { CalendarLanguage } from '../../document/types';
import { calendarWeekdayLabels, calendarFoodRuleLabel, localizeCalendarEventTitleWithStatus } from '../localization/calendar-language';
import { calendarContentCategory } from '../presentation/calendar-content-policy';
import { typikonMarkForEvent, dayNumberTypikonStyle } from '../presentation/typikon-style';
import { TYPIKON_MARKERS } from '../presentation/typikon-markers';
import { FASTING_COLORS } from '../presentation/fasting-colors';
import { FOOD_MARKER_PACKS } from '../presentation/marker-packs';
import { parseScriptureReading, type ScriptureReading } from './scripture-reading';

export const ORTHODOX_CALENDAR_API_VERSION = "1.0.0" as const;

export interface CalendarApiMetadata {
  apiVersion: typeof ORTHODOX_CALENDAR_API_VERSION;
  calendarDataSource: string;
  fastingProfileId: FastingProfileId;
  fastingRulesVersion: string;
  sourceUrls: readonly string[];
  language: CalendarLanguage;
  datasetStatistics: OrthodoxCalendarApi['dataset']['statistics'];
  datasetDiagnostics: OrthodoxCalendarApi['dataset']['diagnostics'];
  completeness: { events: string; localization: string; iconImages: false; privateProjectEvents: false };
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
  sourceTitle: string;
  sourceId: string;
  sourceIndex: number;
  description: string | null;
  source: OrthodoxCalendarApi['dataset']['records'][number] | null;
  occurrenceDate: string;
  spanStart: string;
  spanFinish: string;
  dayIndexInSpan: number;
  category: ReturnType<typeof calendarContentCategory>;
  localization: ReturnType<typeof localizeCalendarEventTitleWithStatus>['status'];
  typikonMark: (typeof TYPIKON_MARKERS)[keyof typeof TYPIKON_MARKERS] | null;
  isIconCommemoration: boolean;
  reading: ScriptureReading | null;
}

export interface CalendarApiDay {
  date: string;
  oldStyleDate: string;
  weekday: number;
  events: CalendarApiEvent[];
  fasting: FastingDayResolution;
  weekdayName: string;
  pascha: string;
  daysFromPascha: number;
  dayStyle: ReturnType<typeof dayNumberTypikonStyle>;
  foodLabel: string;
  fastingColor: string;
  eventCount: number;
  icons: { eventId: string; title: string; imageUrl: null }[];
  foodMarkers: { packId: string; label: string; source: string }[];
  memorialMarkers: { packId: string; label: string; source: string }[];
}

export interface CalendarApiYear {
  metadata: CalendarApiMetadata;
  year: number;
  pascha: string;
  fastingPeriods: ReturnType<OrthodoxCalendarApi["getFastingPeriods"]>;
  days: CalendarApiDay[];
}

function serializeEvent(event: ResolvedCalendarEvent, api: OrthodoxCalendarApi, language: CalendarLanguage): CalendarApiEvent {
  const localized = localizeCalendarEventTitleWithStatus(event.title, language);
  const mark = typikonMarkForEvent(event);
  const source = api.dataset.records[event.sourceIndex - 1];
  return {
    id: event.id,
    title: localized.title,
    sourceTitle: event.title,
    sourceId: event.sourceId,
    sourceIndex: event.sourceIndex,
    source: source?.id === event.sourceId ? source : null,
    description: event.description ?? null,
    occurrenceDate: toIsoDate(event.occurrenceDate),
    spanStart: toIsoDate(event.spanStart),
    spanFinish: toIsoDate(event.spanFinish),
    dayIndexInSpan: event.dayIndexInSpan,
    category: calendarContentCategory(event),
    reading: calendarContentCategory(event) === 'scripture-reading' ? parseScriptureReading(event.title) : null,
    localization: localized.status,
    typikonMark: mark ? TYPIKON_MARKERS[mark] : null,
    isIconCommemoration: /икон[а-яё]*\s+(?:Божией|Божьей)\s+Матери/iu.test(event.title),
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
export function createCalendarPublicApi(api: OrthodoxCalendarApi, language: CalendarLanguage = 'ru') {
  const metadata = (): CalendarApiMetadata => ({
    apiVersion: ORTHODOX_CALENDAR_API_VERSION,
    calendarDataSource: api.dataset.sourceName,
    fastingProfileId: api.profile.id,
    fastingRulesVersion: FASTING_PROFILES[api.profile.id].rulesVersion,
    sourceUrls: FASTING_PROFILES[api.profile.id].sourceUrls,
    language,
    datasetStatistics: api.dataset.statistics,
    datasetDiagnostics: api.dataset.diagnostics,
    completeness: {
      events: 'All events returned by the shared calendar engine, without print layout filters or truncation; engine deduplication and service rules still apply.',
      localization: 'Titles may fall back to Russian; see each event.localization. Descriptions and source records remain in the source language. Short titles remain source-language variants.',
      iconImages: false, privateProjectEvents: false,
    },
  });
  const getDay = (date: CalendarDate): CalendarApiDay | undefined => {
    const day = api.getDay(date);
    const fasting = api.getFasting(date);
    if (!day || !fasting) return undefined;
    return {
      date: day.isoDate,
      oldStyleDate: toIsoDate(day.oldStyleDate),
      weekday: day.weekday,
      events: day.events.map(event => serializeEvent(event, api, language)),
      fasting,
      weekdayName: calendarWeekdayLabels(language)[(day.weekday + 6) % 7]!,
      pascha: toIsoDate(api.getPascha(date.year)),
      daysFromPascha: compareDates(date, api.getPascha(date.year)),
      dayStyle: dayNumberTypikonStyle(day),
      foodLabel: calendarFoodRuleLabel(fasting.foodRule.id, language) || fasting.foodRule.label,
      fastingColor: FASTING_COLORS[fasting.foodRule.id],
      eventCount: day.events.length,
      icons: day.events.filter(event => /икон[а-яё]*\s+(?:Божией|Божьей)\s+Матери/iu.test(event.title)).map(event => ({
        eventId: event.id, title: localizeCalendarEventTitleWithStatus(event.title, language).title, imageUrl: null,
      })),
      foodMarkers: FOOD_MARKER_PACKS.map(pack => ({ packId: pack.id, label: pack.label, source: pack.sources[fasting.foodRule.id] })),
      memorialMarkers: fasting.memorial ? FOOD_MARKER_PACKS.map(pack => ({ packId: pack.id, label: pack.label, source: pack.sources.memorial })) : [],
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
