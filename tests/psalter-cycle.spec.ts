import { describe, expect, it } from "vitest";
import { createOrthodoxCalendarApiFromXml, createCalendarPublicApi } from "../src/calendar";

describe("ordinary weekly Psalter", () => {
  it("exposes Wednesday's matins and vespers kathismata after Pentecost", () => {
    const engine = createOrthodoxCalendarApiFromXml("<MemoryDays><event><s_month>1</s_month><s_date>1</s_date><f_month>1</f_month><f_date>1</f_date><name>Тест</name><type>7</type></event></MemoryDays>");
    const day = createCalendarPublicApi(engine).getDay({ year: 2026, month: 9, day: 9 })!;
    const psalter = day.events.find((event) => event.typeCode === 302);
    expect(psalter?.title).toBe("Пс.70-76; Пс.77-84; Пс.85-90");
    expect(psalter?.source).toBeNull();
  });

  it("keeps an explicit XML Psalter row instead of generating a duplicate", () => {
    const xml = `<MemoryDays><event><s_month>0</s_month><s_date>150</s_date><f_month>0</f_month><f_date>150</f_date><name>Пс.1-8</name><type>302</type></event></MemoryDays>`;
    const engine = createOrthodoxCalendarApiFromXml(xml);
    const day = engine.getDay({ year: 2026, month: 9, day: 9 })!;
    expect(day.events.filter((event) => event.typeCode === 302)).toHaveLength(1);
    expect(day.events.find((event) => event.typeCode === 302)?.title).toBe("Пс.1-8");
  });
});
