import type { CalendarDate, ResolvedCalendarEvent } from "../types";
import {
  addDays,
  compareDates,
  gregorianToJulianDay,
  julianToGregorian,
  toIsoDate,
} from "../date/calendar-date";
import { calculateOrthodoxPascha } from "../pascha/orthodox-pascha";

export const LITURGICAL_STYLE = {
  sunday: "liturgical-sunday",
  holyWeek: "liturgical-holy-week",
  afterfeast: "liturgical-afterfeast",
  leaveTaking: "liturgical-leave-taking",
} as const;

interface GeneratedDefinition {
  date: CalendarDate;
  title: string;
  shortTitle?: string;
  veryShortTitle?: string;
  styleToken: string;
  priority: number;
}

interface PaschaRelativeDefinition {
  offset: number;
  title: string;
  shortTitle?: string;
  veryShortTitle?: string;
  styleToken: string;
  priority?: number;
}

interface FixedAfterfeastDefinition {
  julianMonth: number;
  julianDay: number;
  title: string;
  afterfeastLastOffset: number;
  leaveTakingOffset: number;
  variableLeaveTaking?: "meeting-of-the-lord";
}

const NAMED_PASCHAL_DAYS: readonly PaschaRelativeDefinition[] = [
  {
    offset: -77,
    title: "Неделя о Закхее",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: -70,
    title: "Неделя о мытаре и фарисее",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: -63,
    title: "Неделя о блудном сыне",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: -56,
    title: "Неделя о Страшном Суде (мясопустная)",
    shortTitle: "Неделя о Страшном Суде",
    veryShortTitle: "О Страшном Суде",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: -49,
    title: "Неделя сыропустная. Воспоминание Адамова изгнания. Прощеное воскресенье",
    shortTitle: "Неделя сыропустная. Прощеное воскресенье",
    veryShortTitle: "Прощеное воскресенье",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: -42,
    title: "Неделя 1-я Великого поста. Торжество Православия",
    shortTitle: "Торжество Православия",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: -35,
    title: "Неделя 2-я Великого поста. Свт. Григория Паламы",
    shortTitle: "Неделя 2-я Великого поста",
    veryShortTitle: "2-я Неделя Великого поста",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: -28,
    title: "Неделя 3-я Великого поста, Крестопоклонная",
    shortTitle: "Неделя Крестопоклонная",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: -21,
    title: "Неделя 4-я Великого поста. Прп. Иоанна Лествичника",
    shortTitle: "Неделя 4-я Великого поста",
    veryShortTitle: "4-я Неделя Великого поста",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: -14,
    title: "Неделя 5-я Великого поста. Прп. Марии Египетской",
    shortTitle: "Неделя 5-я Великого поста",
    veryShortTitle: "5-я Неделя Великого поста",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: -8,
    title: "Лазарева суббота",
    styleToken: LITURGICAL_STYLE.holyWeek,
  },
  {
    offset: -6,
    title: "Великий Понедельник",
    styleToken: LITURGICAL_STYLE.holyWeek,
  },
  {
    offset: -5,
    title: "Великий Вторник",
    styleToken: LITURGICAL_STYLE.holyWeek,
  },
  {
    offset: -4,
    title: "Великая Среда",
    styleToken: LITURGICAL_STYLE.holyWeek,
  },
  {
    offset: -3,
    title: "Великий Четверток. Воспоминание Тайной Вечери",
    shortTitle: "Великий Четверток. Тайная Вечеря",
    veryShortTitle: "Великий Четверток",
    styleToken: LITURGICAL_STYLE.holyWeek,
  },
  {
    offset: -2,
    title: "Великий Пяток. Воспоминание Святых спасительных Страстей Господа Иисуса Христа",
    shortTitle: "Великий Пяток. Распятие Христа",
    veryShortTitle: "Великий Пяток",
    styleToken: LITURGICAL_STYLE.holyWeek,
  },
  {
    offset: -1,
    title: "Великая Суббота. Сошествие Христа во ад",
    shortTitle: "Великая Суббота",
    styleToken: LITURGICAL_STYLE.holyWeek,
  },
  {
    offset: 7,
    title: "Неделя 2-я по Пасхе, апостола Фомы. Антипасха",
    shortTitle: "Антипасха. Неделя апостола Фомы",
    veryShortTitle: "Антипасха",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: 14,
    title: "Неделя 3-я по Пасхе, святых жен-мироносиц",
    shortTitle: "Неделя святых жен-мироносиц",
    veryShortTitle: "Неделя жен-мироносиц",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: 21,
    title: "Неделя 4-я по Пасхе, о расслабленном",
    shortTitle: "Неделя о расслабленном",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: 24,
    title: "Преполовение Пятидесятницы",
    styleToken: LITURGICAL_STYLE.afterfeast,
  },
  {
    offset: 28,
    title: "Неделя 5-я по Пасхе, о самаряныне",
    shortTitle: "Неделя о самаряныне",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: 35,
    title: "Неделя 6-я по Пасхе, о слепом",
    shortTitle: "Неделя о слепом",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: 38,
    title: "Отдание праздника Пасхи",
    shortTitle: "Отдание Пасхи",
    styleToken: LITURGICAL_STYLE.leaveTaking,
    priority: 970,
  },
  {
    offset: 42,
    title: "Неделя 7-я по Пасхе, святых отцов I Вселенского Собора",
    shortTitle: "Неделя святых отцов I Вселенского Собора",
    veryShortTitle: "Неделя святых отцов",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: 50,
    title: "Понедельник Пятидесятницы. День Святого Духа",
    shortTitle: "День Святого Духа",
    styleToken: LITURGICAL_STYLE.afterfeast,
  },
  {
    offset: 56,
    title: "Неделя 1-я по Пятидесятнице, Всех святых",
    shortTitle: "Неделя Всех святых",
    styleToken: LITURGICAL_STYLE.sunday,
  },
  {
    offset: 63,
    title: "Неделя 2-я по Пятидесятнице, Всех святых, в земле Русской просиявших",
    shortTitle: "Неделя Всех святых, в земле Русской просиявших",
    veryShortTitle: "Неделя Всех русских святых",
    styleToken: LITURGICAL_STYLE.sunday,
  },
] as const;

const FIXED_AFTERFEASTS: readonly FixedAfterfeastDefinition[] = [
  { julianMonth: 1, julianDay: 6, title: "Богоявления", afterfeastLastOffset: 7, leaveTakingOffset: 8 },
  { julianMonth: 2, julianDay: 2, title: "Сретения Господня", afterfeastLastOffset: 6, leaveTakingOffset: 7, variableLeaveTaking: "meeting-of-the-lord" },
  { julianMonth: 3, julianDay: 25, title: "Благовещения Пресвятой Богородицы", afterfeastLastOffset: 0, leaveTakingOffset: 1 },
  { julianMonth: 8, julianDay: 6, title: "Преображения Господня", afterfeastLastOffset: 6, leaveTakingOffset: 7 },
  { julianMonth: 8, julianDay: 15, title: "Успения Пресвятой Богородицы", afterfeastLastOffset: 7, leaveTakingOffset: 8 },
  { julianMonth: 9, julianDay: 8, title: "Рождества Пресвятой Богородицы", afterfeastLastOffset: 3, leaveTakingOffset: 4 },
  { julianMonth: 9, julianDay: 14, title: "Воздвижения Креста Господня", afterfeastLastOffset: 6, leaveTakingOffset: 7 },
  { julianMonth: 11, julianDay: 21, title: "Введения во храм Пресвятой Богородицы", afterfeastLastOffset: 3, leaveTakingOffset: 4 },
  { julianMonth: 12, julianDay: 25, title: "Рождества Христова", afterfeastLastOffset: 5, leaveTakingOffset: 6 },
] as const;

function inCivilYear(date: CalendarDate, year: number): boolean {
  return date.year === year;
}

function generatedEvent(definition: GeneratedDefinition, index: number): ResolvedCalendarEvent {
  const isoDate = toIsoDate(definition.date);
  return {
    id: `generated-liturgical-${String(index).padStart(4, "0")}:${isoDate}`,
    sourceId: "generated-liturgical-cycle",
    sourceIndex: 900_000 + index,
    title: definition.title,
    ...(definition.shortTitle ? { shortTitle: definition.shortTitle } : {}),
    ...(definition.veryShortTitle ? { veryShortTitle: definition.veryShortTitle } : {}),
    typeCode: -20,
    occurrenceDate: definition.date,
    spanStart: definition.date,
    spanFinish: definition.date,
    dayIndexInSpan: 0,
    ruleKind: "generated-liturgical",
    priority: definition.priority,
    styleToken: definition.styleToken,
  };
}

function fixedJulianDate(julianYear: number, month: number, day: number): CalendarDate {
  return julianToGregorian({ year: julianYear, month, day });
}

/** Implements the variable leave-taking table in the Typikon for the Meeting. */
function meetingLeaveTakingDate(feastDate: CalendarDate): CalendarDate {
  const pascha = calculateOrthodoxPascha(feastDate.year);
  const prodigalSunday = addDays(pascha, -63);
  const meatfareSunday = addDays(pascha, -56);
  const cheesefareSunday = addDays(pascha, -49);
  const fromProdigal = compareDates(feastDate, prodigalSunday);
  const fromMeatfare = compareDates(feastDate, meatfareSunday);

  if (fromProdigal < 0) return addDays(feastDate, 7);
  if (fromProdigal <= 2) return addDays(prodigalSunday, 5);
  if (fromProdigal <= 6) return addDays(meatfareSunday, 2);
  if (fromMeatfare <= 1) return addDays(meatfareSunday, 4);
  if (fromMeatfare <= 3) return addDays(meatfareSunday, 6);
  if (compareDates(feastDate, cheesefareSunday) <= 0) return cheesefareSunday;

  // When the fixed date reaches the first day of Lent the service itself is
  // transferred to Cheesefare Sunday and has no separate afterfeast.
  return addDays(feastDate, -1);
}

function pushFixedAfterfeasts(year: number, definitions: GeneratedDefinition[]): void {
  for (const feast of FIXED_AFTERFEASTS) {
    for (const julianYear of [year - 1, year]) {
      const feastDate = fixedJulianDate(julianYear, feast.julianMonth, feast.julianDay);
      const leaveTaking = feast.variableLeaveTaking === "meeting-of-the-lord"
        ? meetingLeaveTakingDate(feastDate)
        : addDays(feastDate, feast.leaveTakingOffset);
      const effectiveAfterfeastLastOffset = Math.min(
        feast.afterfeastLastOffset,
        Math.max(0, compareDates(leaveTaking, feastDate) - 1),
      );
      for (let offset = 1; offset <= effectiveAfterfeastLastOffset; offset += 1) {
        const date = addDays(feastDate, offset);
        if (!inCivilYear(date, year)) continue;
        definitions.push({
          date,
          title: `Попразднство ${feast.title}`,
          styleToken: LITURGICAL_STYLE.afterfeast,
          priority: 965,
        });
      }
      if (compareDates(leaveTaking, feastDate) > 0 && inCivilYear(leaveTaking, year)) {
        definitions.push({
          date: leaveTaking,
          title: `Отдание праздника ${feast.title}`,
          styleToken: LITURGICAL_STYLE.leaveTaking,
          priority: 970,
        });
      }
    }
  }
}

function pushMovableAfterfeasts(pascha: CalendarDate, year: number, definitions: GeneratedDefinition[]): void {
  const spans = [
    { start: 25, finish: 30, title: "Преполовения Пятидесятницы" },
    { start: 40, finish: 46, title: "Вознесения Господня" },
    { start: 51, finish: 54, title: "Пятидесятницы" },
  ] as const;
  for (const span of spans) {
    for (let offset = span.start; offset <= span.finish; offset += 1) {
      const date = addDays(pascha, offset);
      if (!inCivilYear(date, year)) continue;
      definitions.push({
        date,
        title: `Попразднство ${span.title}`,
        styleToken: LITURGICAL_STYLE.afterfeast,
        priority: 965,
      });
    }
  }
  for (const leaveTaking of [
    { offset: 31, title: "Преполовения Пятидесятницы" },
    { offset: 47, title: "Вознесения Господня" },
    { offset: 55, title: "Пятидесятницы" },
  ] as const) {
    const date = addDays(pascha, leaveTaking.offset);
    if (!inCivilYear(date, year)) continue;
    definitions.push({
      date,
      title: `Отдание праздника ${leaveTaking.title}`,
      styleToken: LITURGICAL_STYLE.leaveTaking,
      priority: 970,
    });
  }
}

function pushNamedPaschalDays(pascha: CalendarDate, year: number, definitions: GeneratedDefinition[]): void {
  for (const item of NAMED_PASCHAL_DAYS) {
    const date = addDays(pascha, item.offset);
    if (!inCivilYear(date, year)) continue;
    definitions.push({
      date,
      title: item.title,
      ...(item.shortTitle ? { shortTitle: item.shortTitle } : {}),
      ...(item.veryShortTitle ? { veryShortTitle: item.veryShortTitle } : {}),
      styleToken: item.styleToken,
      priority: item.priority ?? 980,
    });
  }
}

function pushPentecostSundayNumbers(
  pascha: CalendarDate,
  nextPascha: CalendarDate,
  year: number,
  definitions: GeneratedDefinition[],
): void {
  const pentecost = addDays(pascha, 49);
  const first = addDays(pentecost, 7);
  const lastExclusive = addDays(nextPascha, -77);
  for (let date = first, number = 1; compareDates(date, lastExclusive) < 0; date = addDays(date, 7), number += 1) {
    if (!inCivilYear(date, year) || number <= 2) continue;
    definitions.push({
      date,
      title: `Неделя ${number}-я по Пятидесятнице`,
      styleToken: LITURGICAL_STYLE.sunday,
      priority: 980,
    });
  }
}

/**
 * Builds the recurring Triodion/Pentecostarion labels and the stable
 * afterfeast periods used by the compact printed calendar. The source XML
 * remains intact; these generated records make the cycle complete for any
 * selected civil year.
 */
export function buildGeneratedLiturgicalEvents(year: number): ResolvedCalendarEvent[] {
  const definitions: GeneratedDefinition[] = [];
  for (const paschaYear of [year - 1, year, year + 1]) {
    const pascha = calculateOrthodoxPascha(paschaYear);
    pushNamedPaschalDays(pascha, year, definitions);
    pushMovableAfterfeasts(pascha, year, definitions);
    pushPentecostSundayNumbers(pascha, calculateOrthodoxPascha(paschaYear + 1), year, definitions);
  }
  pushFixedAfterfeasts(year, definitions);

  const unique = new Map<string, GeneratedDefinition>();
  for (const definition of definitions) {
    const key = `${toIsoDate(definition.date)}:${definition.title.toLocaleLowerCase("ru")}`;
    if (!unique.has(key)) unique.set(key, definition);
  }
  return [...unique.values()]
    .sort((left, right) =>
      gregorianToJulianDay(left.date) - gregorianToJulianDay(right.date) ||
      left.title.localeCompare(right.title, "ru"),
    )
    .map(generatedEvent);
}
