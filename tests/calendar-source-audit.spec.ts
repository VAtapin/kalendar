import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildOrthodoxCalendarYear,
  calculateFastingDay,
  calculateFastingPeriods,
  enumerateDates,
  parseMemoryDaysXml,
  toIsoDate,
} from "../src/calendar";

// Independently transcribed control dates, reviewed 2026-09-08. These are not
// calculated from the same Pascha offsets as the implementation under test.
// Sources and discrepancies: docs/AUDIT-DATES-2026-09-08.md.
const dataset = parseMemoryDaysXml(readFileSync(new URL("../public/data/MemoryDays.xml", import.meta.url), "utf8"));
const calendars = new Map([2019, 2026, 2027].map((year) => [year, buildOrthodoxCalendarYear(year, dataset)]));

function eventsAt(date: string) {
  return calendars.get(Number(date.slice(0, 4)))!.daysByIsoDate[date]!.events;
}

const fixedFeasts: Array<[string, RegExp]> = [
  ["01-07", /Рождество.*Христа|Рождество Христово/],
  ["01-14", /Обрезание Господне/],
  ["01-19", /Богоявление|Крещение Господне/],
  ["02-15", /Сретение Господ/],
  ["04-07", /Благовещение/],
  ["05-21", /Иоанна Богослова/],
  ["05-22", /Николая/],
  ["07-07", /Рождество.*Иоанна/],
  ["07-12", /Петра и Павла/],
  ["08-19", /Преображение/],
  ["08-28", /Успение/],
  ["09-11", /Усекновение/],
  ["09-21", /Рождество.*Богородицы/],
  ["09-27", /Воздвижение/],
  ["10-09", /Иоанна Богослова/],
  ["10-14", /Покров/],
  ["12-04", /Введение/],
  ["12-19", /Николая/],
];

describe("live-source calendar control dates", () => {
  it("omits Annunciation leave-taking on Holy Week but retains it in ordinary Lent", () => {
    expect(eventsAt("2026-04-08").some((event) => /Отдание.*Благовещения/.test(event.title))).toBe(false);
    expect(eventsAt("2027-04-08").some((event) => /Отдание.*Благовещения/.test(event.title))).toBe(true);
  });

  it("includes every day of the Nativity and Theophany forefeasts", () => {
    for (const day of [2, 3, 4, 5, 6]) {
      expect(eventsAt(`2027-01-${String(day).padStart(2, "0")}`).some((event) =>
        event.title === "Предпразднство Рождества Христова")).toBe(true);
    }
    for (const day of [15, 16, 17, 18]) {
      expect(eventsAt(`2027-01-${day}`).some((event) => event.title === "Предпразднство Богоявления")).toBe(true);
    }
  });

  // All 18 fixed-date entries of the Otrada page (not a full menologion).
  it.each(fixedFeasts)("Otrada fixed date 2019-%s", (suffix, title) => {
    expect(eventsAt(`2019-${suffix}`).some((event) => title.test(event.title))).toBe(true);
  });

  // All 31 movable entries in its explicitly labelled 2019 section.
  it.each([
    ["02-10", /Закхее/], ["02-10", /Собор новомучеников/],
    ["02-17", /мытаре и фарисее/], ["02-24", /блудном сыне/],
    ["03-03", /Страшном Суде/], ["03-10", /Прощеное воскресенье/],
    ["03-17", /Торжество Православия/], ["03-24", /Григория Паламы/],
    ["03-31", /Крестопоклонная/], ["04-07", /Иоанна Лествичника/],
    ["04-14", /Марии Египетской/], ["04-20", /Лазарева суббота/],
    ["04-21", /Вход Господень/], ["04-22", /Великий Понедельник/],
    ["04-23", /Великий Вторник/], ["04-24", /Великая Среда/],
    ["04-25", /Великий Четверток/], ["04-26", /Великий Пяток/],
    ["04-27", /Великая Суббота/], ["04-28", /Пасха/],
    ["05-05", /Антипасха/], ["05-12", /жен-мироносиц/],
    ["05-19", /расслабленном/], ["05-26", /самаряныне/],
    ["06-02", /слепом/], ["06-06", /Вознесение/],
    ["06-09", /I Вселенского Собора/], ["06-16", /Троицы/],
    ["06-17", /Святого Духа/], ["06-23", /Всех святых/],
    ["06-30", /земле Русской/],
  ] as Array<[string, RegExp]>)("Otrada movable date 2019-%s", (suffix, title) => {
    expect(eventsAt(`2019-${suffix}`).some((event) => title.test(event.title))).toBe(true);
  });

  // The 2019 source has a typo: Radonitsa is printed as 7 April, although
  // its own rule says Tuesday after Antipascha (which is 7 May that year).
  it.each([
    ["03-02", /мясопустная/], ["03-23", /2-й седмицы/],
    ["03-30", /3-й седмицы/], ["04-06", /4-й седмицы/],
    ["05-07", /Радоница/], ["05-09", /усопших воинов/],
    ["06-15", /Троицкая родительская/], ["11-02", /Димитриевская/],
  ] as Array<[string, RegExp]>)("Otrada memorial rule 2019-%s", (suffix, title) => {
    expect(eventsAt(`2019-${suffix}`).some((event) => event.typeCode === 9 && title.test(event.title))).toBe(true);
  });

  // All 18 feast items from days.pravoslavie.ru/docs/2026_1.html. Christmas
  // is explicitly 7 Jan 2027 on that source, not civil-year January 2026.
  it.each([
    ["2026-04-12", /Пасха/], ["2026-04-05", /Вход Господень/],
    ["2026-05-21", /Вознесение/], ["2026-05-31", /Троицы/],
    ["2026-01-19", /Богоявление|Крещение Господне/], ["2026-02-15", /Сретение/],
    ["2026-04-07", /Благовещение/], ["2026-08-19", /Преображение/],
    ["2026-08-28", /Успение/], ["2026-09-21", /Рождество.*Богородицы/],
    ["2026-09-27", /Воздвижение/], ["2026-12-04", /Введение/],
    ["2027-01-07", /Рождество.*Христа|Рождество Христово/],
    ["2026-01-14", /Обрезание/], ["2026-07-07", /Рождество.*Иоанна/],
    ["2026-07-12", /Петра и Павла/], ["2026-09-11", /Усекновение/],
    ["2026-10-14", /Покров/],
  ] as Array<[string, RegExp]>)("Pravoslavie feast %s", (date, title) => {
    expect(eventsAt(date).some((event) => title.test(event.title))).toBe(true);
  });

  it.each([
    ["02-08", /гонений/], ["02-14", /мясопустная/],
    ["03-07", /2-й седмицы/], ["03-14", /3-й седмицы/],
    ["03-21", /4-й седмицы/], ["05-09", /усопших воинов/],
    ["04-21", /Радоница/], ["05-30", /Троицкая родительская/],
    ["11-07", /Димитриевская/],
  ] as Array<[string, RegExp]>)("Pravoslavie memorial date 2026-%s", (suffix, title) => {
    expect(eventsAt(`2026-${suffix}`).some((event) => event.typeCode === 9 && title.test(event.title))).toBe(true);
  });

  it("matches the four published multi-day fast intervals in 2026", () => {
    expect(calculateFastingPeriods(2026).filter((period) => period.start.year === 2026).map((period) => [
      period.id, toIsoDate(period.start), toIsoDate(period.finish),
    ])).toEqual([
      ["great-lent", "2026-02-23", "2026-04-11"],
      ["apostles-fast", "2026-06-08", "2026-07-11"],
      ["dormition-fast", "2026-08-14", "2026-08-27"],
      ["nativity-fast", "2026-11-28", "2027-01-06"],
    ]);
  });

  it.each(["2026-01-18", "2026-09-11", "2026-09-27"])("keeps the one-day fast on %s", (date) => {
    expect(calculateFastingDay(calendars.get(2026)!.daysByIsoDate[date]!).foodRule.id).toBe("oil");
  });

  it.each([
    [1, 7, 1, 17, "no-fast"], [2, 1, 2, 7, "no-fast"],
    [2, 16, 2, 22, "dairy-eggs"], [4, 12, 4, 18, "no-fast"],
    [5, 31, 6, 6, "no-fast"],
  ] as const)("checks every day of the published fast-free interval %i/%i–%i/%i", (sm, sd, fm, fd, rule) => {
    for (const date of enumerateDates({ year: 2026, month: sm, day: sd }, { year: 2026, month: fm, day: fd })) {
      expect(calculateFastingDay(calendars.get(2026)!.daysByIsoDate[toIsoDate(date)]!).foodRule.id).toBe(rule);
    }
  });

  // All 18 principal feast dates in https://azbyka.ru/days/calendar/2027.
  it.each([
    ["01-07", /Рождество.*Христа/], ["01-14", /Обрезание/],
    ["01-19", /Богоявление/], ["02-15", /Сретение/],
    ["04-07", /Благовещение/], ["04-25", /Вход Господень/],
    ["05-02", /Пасха/], ["06-10", /Вознесение/], ["06-20", /Троицы/],
    ["07-07", /Рождество.*Иоанна/], ["07-12", /Петра и Павла/],
    ["08-19", /Преображение/], ["08-28", /Успение/], ["09-11", /Усекновение/],
    ["09-21", /Рождество.*Богородицы/], ["09-27", /Воздвижение/],
    ["10-14", /Покров/], ["12-04", /Введение/],
  ] as Array<[string, RegExp]>)("Azbyka principal feast 2027-%s", (suffix, title) => {
    expect(eventsAt(`2027-${suffix}`).some((event) => title.test(event.title))).toBe(true);
  });

  it("matches all four published fasting periods for 2027", () => {
    expect(calculateFastingPeriods(2027).filter((period) => period.start.year === 2027).map((period) => [
      period.id, toIsoDate(period.start), toIsoDate(period.finish),
    ])).toEqual([
      ["great-lent", "2027-03-15", "2027-05-01"],
      ["apostles-fast", "2027-06-28", "2027-07-11"],
      ["dormition-fast", "2027-08-14", "2027-08-27"],
      ["nativity-fast", "2027-11-28", "2028-01-06"],
    ]);
  });

  it.each(["2027-01-18", "2027-09-11", "2027-09-27"])("Azbyka one-day fast %s", (date) => {
    expect(calculateFastingDay(calendars.get(2027)!.daysByIsoDate[date]!).foodRule.id).toBe("oil");
  });

  it.each([
    ["02-07", /гонений/], ["03-06", /мясопустная/], ["03-27", /2-й седмицы/],
    ["04-03", /3-й седмицы/], ["04-10", /4-й седмицы/], ["05-09", /усопших воинов/],
    ["05-11", /Радоница/], ["06-19", /Троицкая родительская/], ["11-06", /Димитриевская/],
  ] as Array<[string, RegExp]>)("Azbyka memorial date 2027-%s", (suffix, title) => {
    expect(eventsAt(`2027-${suffix}`).some((event) => event.typeCode === 9 && title.test(event.title))).toBe(true);
  });
});
