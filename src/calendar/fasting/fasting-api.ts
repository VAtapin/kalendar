import type {
  CalendarDate,
  MemoryDaysDataset,
  OrthodoxCalendarDay,
  OrthodoxCalendarYear,
  ResolvedCalendarEvent,
} from "../types";
import {
  addDays,
  compareDates,
  dayOfWeek,
  gregorianToJulian,
  julianToGregorian,
  toIsoDate,
} from "../date/calendar-date";
import { buildOrthodoxCalendarYear } from "../engine/build-calendar-year";
import { calculateOrthodoxPascha } from "../pascha/orthodox-pascha";
import { parseMemoryDaysXml } from "../xml/parse-memory-days";

export type FoodRuleId =
  | "no-fast"
  | "fast"
  | "fish"
  | "oil"
  | "boiled-no-oil"
  | "dry-eating"
  | "strict-fast"
  | "dairy-eggs"
  | "memorial";

export interface FoodRule {
  id: FoodRuleId;
  label: string;
  color: string;
}

export const FOOD_RULES: Readonly<Record<FoodRuleId, FoodRule>> = {
  "no-fast": { id: "no-fast", label: "поста нет", color: "#7b4433" },
  fast: { id: "fast", label: "постный день без рыбы", color: "#527b43" },
  fish: { id: "fish", label: "разрешается рыба", color: "#3a6f85" },
  oil: { id: "oil", label: "варёная пища с маслом (елеем)", color: "#a36b22" },
  "boiled-no-oil": { id: "boiled-no-oil", label: "варёная пища без масла (елея)", color: "#92724f" },
  "dry-eating": { id: "dry-eating", label: "сухоядение", color: "#6c613a" },
  "strict-fast": { id: "strict-fast", label: "строгий пост", color: "#40584a" },
  "dairy-eggs": { id: "dairy-eggs", label: "разрешаются молочные продукты и яйца", color: "#b18642" },
  memorial: { id: "memorial", label: "день особого поминовения усопших", color: "#66524c" },
};

export type FastingPeriodId =
  | "great-lent"
  | "apostles-fast"
  | "dormition-fast"
  | "nativity-fast";

export interface FastingPeriod {
  id: FastingPeriodId;
  label: string;
  start: CalendarDate;
  finish: CalendarDate;
}

export interface FastingDayInput {
  date: CalendarDate;
  weekday?: number;
  events?: readonly Pick<ResolvedCalendarEvent, "title" | "typeCode">[];
}

export interface FastingDayResolution {
  date: CalendarDate;
  profileId: "typikon-strict";
  period?: FastingPeriodId;
  foodRule: FoodRule;
  memorial: boolean;
  reason: string;
  sourceUrls: readonly string[];
}

/**
 * The strict table is intentionally a named profile. A milder parish profile
 * can be added later without changing callers or the page-layout code.
 */
export const FASTING_PROFILE_ID = "typikon-strict" as const;
export const FASTING_RULE_SOURCE_URLS = [
  "https://otrada-i-uteshenie.ru/kalendar/",
  "https://azbyka.ru/days/p-kalendar-postov-i-trapez",
] as const;

const PERIOD_LABELS: Record<FastingPeriodId, string> = {
  "great-lent": "Великий пост",
  "apostles-fast": "Петров (Апостольский) пост",
  "dormition-fast": "Успенский пост",
  "nativity-fast": "Рождественский (Филиппов) пост",
};

function inRange(date: CalendarDate, start: CalendarDate, finish: CalendarDate): boolean {
  return compareDates(date, start) >= 0 && compareDates(date, finish) <= 0;
}

function sameOldStyleDate(date: CalendarDate, month: number, day: number): boolean {
  const oldStyle = gregorianToJulian(date);
  return oldStyle.month === month && oldStyle.day === day;
}

function paschaOffset(date: CalendarDate): number {
  return compareDates(date, calculateOrthodoxPascha(date.year));
}

function eventsFor(input: FastingDayInput): readonly Pick<ResolvedCalendarEvent, "title" | "typeCode">[] {
  return input.events ?? [];
}

function hasTitle(input: FastingDayInput, pattern: RegExp): boolean {
  return eventsFor(input).some((event) => pattern.test(event.title));
}

function hasMajorSaint(input: FastingDayInput): boolean {
  return eventsFor(input).some((event) => event.typeCode >= 2 && event.typeCode <= 4);
}

function result(
  input: FastingDayInput,
  rule: FoodRuleId,
  reason: string,
  period?: FastingPeriodId,
): FastingDayResolution {
  return {
    date: input.date,
    profileId: FASTING_PROFILE_ID,
    ...(period ? { period } : {}),
    foodRule: FOOD_RULES[rule],
    memorial: eventsFor(input).some((event) => event.typeCode === 9),
    reason,
    sourceUrls: FASTING_RULE_SOURCE_URLS,
  };
}

function weeklyGreatFastRule(
  input: FastingDayInput,
  period: "great-lent" | "dormition-fast" | "nativity-fast",
): FastingDayResolution {
  const weekday = input.weekday ?? dayOfWeek(input.date);
  const majorSaint = hasMajorSaint(input);
  if (majorSaint && (weekday === 2 || weekday === 4)) {
    return result(input, "oil", "Великий или полиелейный праздник: пища с маслом", period);
  }
  if (majorSaint && (weekday === 1 || weekday === 3 || weekday === 5)) {
    return result(input, "boiled-no-oil", "Великий или полиелейный праздник: горячая пища без масла", period);
  }
  if (weekday === 1 || weekday === 3 || weekday === 5) {
    return result(input, "dry-eating", "Понедельник, среда или пятница строгой седмичной меры", period);
  }
  if (weekday === 2 || weekday === 4) {
    return result(input, "boiled-no-oil", "Вторник или четверг: горячая пища без масла", period);
  }
  return result(input, "oil", "Суббота или воскресенье: пища с растительным маслом", period);
}

function apostlesFastRule(input: FastingDayInput): FastingDayResolution {
  const weekday = input.weekday ?? dayOfWeek(input.date);
  if (sameOldStyleDate(input.date, 6, 24)) {
    return result(input, "fish", "Рождество Иоанна Предтечи: разрешается рыба", "apostles-fast");
  }
  if (hasMajorSaint(input) && (weekday === 1 || weekday === 3 || weekday === 5)) {
    return result(input, "oil", "Великий или полиелейный праздник: пища с маслом", "apostles-fast");
  }
  if (weekday === 1) {
    return result(input, "boiled-no-oil", "Понедельник Петрова поста: горячая пища без масла", "apostles-fast");
  }
  if (weekday === 3 || weekday === 5) {
    return result(input, "dry-eating", "Среда или пятница Петрова поста: сухоядение", "apostles-fast");
  }
  return result(input, "fish", "В Петров пост в этот день разрешается рыба", "apostles-fast");
}

function nativityFastRule(input: FastingDayInput): FastingDayResolution {
  const weekday = input.weekday ?? dayOfWeek(input.date);
  const oldStyle = gregorianToJulian(input.date);
  const oldOrdinal = oldStyle.month * 100 + oldStyle.day;

  // The Nativity eve is a separate strict day. When it falls on a weekend,
  // the published rule explicitly permits food with vegetable oil.
  if (oldOrdinal === 1224) {
    return result(
      input,
      weekday === 0 || weekday === 6 ? "oil" : "strict-fast",
      weekday === 0 || weekday === 6
        ? "Навечерие Рождества в субботу или воскресенье: пища с маслом"
        : "Навечерие Рождества: воздержание до первой звезды",
      "nativity-fast",
    );
  }

  if (sameOldStyleDate(input.date, 11, 21) || sameOldStyleDate(input.date, 12, 6)) {
    return result(input, "fish", "Введение Богородицы или память святителя Николая: разрешается рыба", "nativity-fast");
  }

  if (hasMajorSaint(input) && (weekday === 1 || weekday === 3 || weekday === 5)) {
    return result(input, "oil", "Великий или полиелейный праздник: пища с маслом", "nativity-fast");
  }

  // 15 November–6 December old style: the same measure as the Apostles fast.
  if (oldOrdinal <= 1206) {
    if (weekday === 1) return result(input, "boiled-no-oil", "Понедельник: горячая пища без масла", "nativity-fast");
    if (weekday === 3 || weekday === 5) return result(input, "dry-eating", "Среда или пятница: сухоядение", "nativity-fast");
    return result(input, "fish", "Начальная часть Рождественского поста: разрешается рыба", "nativity-fast");
  }

  // From St Nicholas until the forefeast fish is left only for weekends.
  if (oldOrdinal < 1220) {
    if (weekday === 0 || weekday === 6) return result(input, "fish", "Суббота или воскресенье: разрешается рыба", "nativity-fast");
    if (weekday === 2 || weekday === 4) return result(input, "oil", "Вторник или четверг: горячая пища с маслом", "nativity-fast");
    if (weekday === 1) return result(input, "boiled-no-oil", "Понедельник: горячая пища без масла", "nativity-fast");
    return result(input, "dry-eating", "Среда или пятница: сухоядение", "nativity-fast");
  }

  return weeklyGreatFastRule(input, "nativity-fast");
}

const fastingPeriodsCache = new Map<number, readonly FastingPeriod[]>();

function fastingPeriodsForYear(year: number): readonly FastingPeriod[] {
  const cached = fastingPeriodsCache.get(year);
  if (cached) return cached;
  const pascha = calculateOrthodoxPascha(year);
  // Convert fixed Julian dates instead of adding a hard-coded 13 days; this
  // keeps the API valid when the offset changes in future centuries.
  const periods: FastingPeriod[] = [
    {
      id: "nativity-fast",
      label: PERIOD_LABELS["nativity-fast"],
      start: julianToGregorian({ year: year - 1, month: 11, day: 15 }),
      finish: julianToGregorian({ year: year - 1, month: 12, day: 24 }),
    },
    {
      id: "great-lent",
      label: PERIOD_LABELS["great-lent"],
      start: addDays(pascha, -48),
      finish: addDays(pascha, -1),
    },
    {
      id: "apostles-fast",
      label: PERIOD_LABELS["apostles-fast"],
      start: addDays(pascha, 57),
      finish: julianToGregorian({ year, month: 6, day: 28 }),
    },
    {
      id: "dormition-fast",
      label: PERIOD_LABELS["dormition-fast"],
      start: julianToGregorian({ year, month: 8, day: 1 }),
      finish: julianToGregorian({ year, month: 8, day: 14 }),
    },
    {
      id: "nativity-fast",
      label: PERIOD_LABELS["nativity-fast"],
      start: julianToGregorian({ year, month: 11, day: 15 }),
      finish: julianToGregorian({ year, month: 12, day: 24 }),
    },
  ];
  const applicable = periods.filter(
    (period) => period.id !== "apostles-fast" || compareDates(period.start, period.finish) <= 0,
  );
  fastingPeriodsCache.set(year, applicable);
  return applicable;
}

/** Returns the movable and fixed multi-day fasts that touch a civil year. */
export function calculateFastingPeriods(year: number): FastingPeriod[] {
  return fastingPeriodsForYear(year).map((period) => ({
    ...period,
    start: { ...period.start },
    finish: { ...period.finish },
  }));
}

export function fastingPeriodForDate(date: CalendarDate): FastingPeriod | undefined {
  return fastingPeriodsForYear(date.year).find((period) => inRange(date, period.start, period.finish));
}

/**
 * Pure calculation API. XML is used only for feast ranks and local exceptions;
 * all standard fast periods are calculated from Pascha and fixed Julian dates.
 */
export function calculateFastingDay(input: FastingDayInput): FastingDayResolution {
  const weekday = input.weekday ?? dayOfWeek(input.date);
  const offset = paschaOffset(input.date);

  const fastFreeEvents = eventsFor(input).filter((event) => event.typeCode === 100);
  if (fastFreeEvents.some((event) => /сырн|маслениц/i.test(event.title)) || (offset >= -55 && offset <= -49)) {
    return result(input, "dairy-eggs", "Сырная седмица: разрешены молочные продукты, яйца и рыба");
  }
  if (
    fastFreeEvents.length > 0 ||
    (offset >= -69 && offset <= -63) ||
    (offset >= 0 && offset <= 6) ||
    (offset >= 50 && offset <= 56) ||
    inRange(
      input.date,
      julianToGregorian({ year: input.date.year - 1, month: 12, day: 25 }),
      julianToGregorian({ year: input.date.year, month: 1, day: 4 }),
    )
  ) {
    return result(input, "no-fast", "Сплошная седмица или Святки: поста нет");
  }

  if (sameOldStyleDate(input.date, 12, 25) || sameOldStyleDate(input.date, 1, 6) || offset === 0) {
    return result(input, "no-fast", "Рождество Христово, Богоявление или Пасха: поста нет");
  }

  if (
    sameOldStyleDate(input.date, 1, 5) ||
    sameOldStyleDate(input.date, 8, 29) ||
    sameOldStyleDate(input.date, 9, 14)
  ) {
    return result(input, "oil", "Однодневный пост: без рыбы, разрешается пища с маслом");
  }

  const period = fastingPeriodForDate(input.date);
  if (period?.id === "great-lent") {
    if (offset === -48 || offset === -47 || offset === -2) {
      return result(input, "strict-fast", "Первые два дня поста или Великая пятница: полное воздержание", "great-lent");
    }
    if (offset === -8) {
      return result(input, "fast", "Лазарева суббота: разрешается рыбная икра, но не рыба", "great-lent");
    }
    if (offset === -7) {
      return result(input, "fish", "Вход Господень в Иерусалим: разрешается рыба", "great-lent");
    }
    if ((sameOldStyleDate(input.date, 3, 25) || hasTitle(input, /Благовещение/i)) && !(offset >= -6 && offset <= -1)) {
      return result(input, "fish", "Благовещение вне Страстной седмицы: разрешается рыба", "great-lent");
    }
    return weeklyGreatFastRule(input, "great-lent");
  }

  if (period?.id === "apostles-fast") return apostlesFastRule(input);

  if (period?.id === "dormition-fast") {
    if (sameOldStyleDate(input.date, 8, 6) || hasTitle(input, /Преображение Господне/i)) {
      return result(input, "fish", "Преображение Господне: разрешается рыба", "dormition-fast");
    }
    return weeklyGreatFastRule(input, "dormition-fast");
  }

  if (period?.id === "nativity-fast") return nativityFastRule(input);

  // The week following the fast-free Publican and Pharisee week is a gradual
  // preparation for Great Lent.
  if (offset >= -62 && offset <= -56) {
    if (weekday === 1) return result(input, "oil", "Подготовительная седмица: в понедельник пища с маслом");
    if (weekday === 3 || weekday === 5) return result(input, "dry-eating", "Подготовительная седмица: сухоядение");
    return result(input, "no-fast", "Подготовительная седмица: обычный день");
  }

  // Fixed fish allowances when a feast lands on a weekly fasting day.
  const fishFeast =
    sameOldStyleDate(input.date, 2, 2) ||
    sameOldStyleDate(input.date, 6, 24) ||
    sameOldStyleDate(input.date, 6, 29) ||
    sameOldStyleDate(input.date, 8, 6) ||
    sameOldStyleDate(input.date, 8, 15) ||
    sameOldStyleDate(input.date, 9, 8) ||
    sameOldStyleDate(input.date, 10, 1) ||
    sameOldStyleDate(input.date, 11, 21) ||
    sameOldStyleDate(input.date, 5, 8) ||
    sameOldStyleDate(input.date, 9, 26);
  if ((weekday === 3 || weekday === 5) && fishFeast) {
    return result(input, "fish", "Праздник в среду или пятницу: разрешается рыба");
  }

  if (weekday === 3 || weekday === 5) {
    // Winter meat-eater and the period from Bright week to Trinity are milder.
    if (offset >= 7 && offset <= 49) {
      return result(input, "fish", "Весенний мясоед: в среду и пятницу разрешается рыба");
    }
    const publicanWeekStart = addDays(calculateOrthodoxPascha(input.date.year), -69);
    const theophany = julianToGregorian({ year: input.date.year, month: 1, day: 6 });
    if (compareDates(input.date, theophany) > 0 && compareDates(input.date, publicanWeekStart) < 0) {
      return result(input, "fish", "Зимний мясоед: в среду и пятницу разрешается рыба");
    }
    if (hasMajorSaint(input)) {
      return result(input, "oil", "Великий или полиелейный праздник: пища с маслом");
    }
    return result(input, "dry-eating", "Среда или пятница летнего/осеннего мясоеда: сухоядение");
  }

  if (eventsFor(input).some((event) => event.typeCode === 10)) {
    return result(input, "fast", "Явно заданный в календарных данных постный день");
  }

  return result(input, "no-fast", "Постного правила на этот день нет");
}

export function resolveFoodRuleForDay(input: FastingDayInput): FoodRule {
  const resolution = calculateFastingDay(input);
  return resolution.memorial ? FOOD_RULES.memorial : resolution.foodRule;
}

export interface OrthodoxCalendarApi {
  readonly dataset: MemoryDaysDataset;
  getYear(year: number): OrthodoxCalendarYear;
  getDay(date: CalendarDate): OrthodoxCalendarDay | undefined;
  getFasting(date: CalendarDate): FastingDayResolution | undefined;
  getFastingPeriods(year: number): FastingPeriod[];
  getPascha(year: number): CalendarDate;
  clearCache(): void;
}

/** Creates a reusable calendar/feast/fasting API backed by one parsed dataset. */
export function createOrthodoxCalendarApi(dataset: MemoryDaysDataset): OrthodoxCalendarApi {
  const years = new Map<number, OrthodoxCalendarYear>();
  const getYear = (year: number) => {
    let calendar = years.get(year);
    if (!calendar) {
      calendar = buildOrthodoxCalendarYear(year, dataset);
      years.set(year, calendar);
    }
    return calendar;
  };
  return {
    dataset,
    getYear,
    getDay(date) {
      return getYear(date.year).daysByIsoDate[toIsoDate(date)];
    },
    getFasting(date) {
      const day = getYear(date.year).daysByIsoDate[toIsoDate(date)];
      return day ? calculateFastingDay(day) : undefined;
    },
    getFastingPeriods: calculateFastingPeriods,
    getPascha: calculateOrthodoxPascha,
    clearCache() {
      years.clear();
    },
  };
}

export function createOrthodoxCalendarApiFromXml(
  xml: string,
  sourceName = "MemoryDays.xml",
): OrthodoxCalendarApi {
  return createOrthodoxCalendarApi(parseMemoryDaysXml(xml, sourceName));
}
