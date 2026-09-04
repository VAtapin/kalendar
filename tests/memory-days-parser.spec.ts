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
});

