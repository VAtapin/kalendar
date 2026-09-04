import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildOrthodoxCalendarYear } from "../src/calendar/engine/build-calendar-year";
import { parseMemoryDaysXml } from "../src/calendar/xml/parse-memory-days";

const sourceXml = readFileSync(
  new URL("../public/data/MemoryDays.xml", import.meta.url),
  "utf8",
);

describe("MemoryDays XML parser", () => {
  it("imports the complete source file without losing its raw fields", () => {
    const dataset = parseMemoryDaysXml(sourceXml);

    expect(dataset.statistics).toMatchObject({
      recordCount: 3811,
      recordsWithDescription: 138,
      recordsWithLink: 0,
      exactDuplicateCount: 4,
      specialRuleCount: 89,
    });
    expect(dataset.records[0]).toMatchObject({
      startMonth: 0,
      startDate: 0,
      finishMonth: 0,
      finishDate: 0,
      typeCode: 0,
      title: "Светлое Христово Воскресение. Пасха",
      raw: { s_month: "0", s_date: "0", type: "0" },
    });
  });

  it("normalizes text but preserves the original source string", () => {
    const dataset = parseMemoryDaysXml(`
      <MemoryDays>
        <event>
          <s_month>1</s_month><s_date>1</s_date>
          <f_month>1</f_month><f_date>1</f_date>
          <name>  Тестовое   событие </name><type>8</type>
        </event>
      </MemoryDays>
    `);

    expect(dataset.records[0]?.title).toBe("Тестовое событие");
    expect(dataset.records[0]?.raw.name).toContain("  Тестовое   событие ");
  });
});

describe("calendar year engine", () => {
  it("resolves fixed and Pascha-relative records for 2027", () => {
    const dataset = parseMemoryDaysXml(sourceXml);
    const calendar = buildOrthodoxCalendarYear(2027, dataset);

    expect(calendar.days).toHaveLength(365);
    expect(calendar.pascha).toEqual({ year: 2027, month: 5, day: 2 });
    expect(calendar.daysByIsoDate["2027-05-02"]?.events.some((event) => event.typeCode === 0)).toBe(
      true,
    );
    expect(
      calendar.daysByIsoDate["2027-04-25"]?.events.some((event) =>
        event.title.includes("Вход Господень в Иерусалим"),
      ),
    ).toBe(true);
    expect(
      calendar.daysByIsoDate["2027-01-19"]?.events.some((event) =>
        event.title.includes("Богоявление"),
      ),
    ).toBe(true);
  });

  it("calculates the named Sunday cycle and Holy Week for every selected year", () => {
    const calendar = buildOrthodoxCalendarYear(2027, parseMemoryDaysXml(sourceXml));
    const titles = (isoDate: string) => calendar.daysByIsoDate[isoDate]?.events.map((event) => event.title) ?? [];

    expect(titles("2027-02-21")).toContain("Неделя о мытаре и фарисее");
    expect(titles("2027-03-21")).toContain("Неделя 1-я Великого поста. Торжество Православия");
    expect(titles("2027-04-26")).toContain("Великий Понедельник");
    expect(titles("2027-05-09")).toContain("Неделя 2-я по Пасхе, апостола Фомы. Антипасха");
    expect(titles("2027-07-11")).toContain("Неделя 3-я по Пятидесятнице");
  });

  it("fills afterfeasts and leave-takings instead of marking only their first day", () => {
    const calendar = buildOrthodoxCalendarYear(2027, parseMemoryDaysXml(sourceXml));
    const titles = (isoDate: string) => calendar.daysByIsoDate[isoDate]?.events.map((event) => event.title) ?? [];

    expect(titles("2027-01-12")).toContain("Попразднство Рождества Христова");
    expect(titles("2027-01-13")).toContain("Отдание праздника Рождества Христова");
    expect(titles("2027-06-16")).toContain("Попразднство Вознесения Господня");
    expect(titles("2027-06-18")).toContain("Отдание праздника Вознесения Господня");
    expect(titles("2027-06-26")).toContain("Отдание праздника Пятидесятницы");
  });

  it("shortens the afterfeast of the Meeting when the preparatory weeks require it", () => {
    const calendar2026 = buildOrthodoxCalendarYear(2026, parseMemoryDaysXml(sourceXml));
    const titles = (isoDate: string) => calendar2026.daysByIsoDate[isoDate]?.events.map((event) => event.title) ?? [];

    expect(titles("2026-02-18")).toContain("Попразднство Сретения Господня");
    expect(titles("2026-02-19")).toContain("Отдание праздника Сретения Господня");
    expect(titles("2026-02-22")).not.toContain("Отдание праздника Сретения Господня");
  });

  it("transfers the Meeting to Cheesefare Sunday when its fixed date reaches Clean Monday", () => {
    const calendar2010 = buildOrthodoxCalendarYear(2010, parseMemoryDaysXml(sourceXml));
    const hasMeeting = (isoDate: string) => calendar2010.daysByIsoDate[isoDate]?.events.some((event) =>
      event.title.startsWith("Сретение Господа"),
    ) ?? false;

    expect(hasMeeting("2010-02-14")).toBe(true);
    expect(hasMeeting("2010-02-15")).toBe(false);
  });
});
