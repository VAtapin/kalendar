import { describe, expect, it } from "vitest";
import { createOrthodoxCalendarApiFromXml } from "../src/calendar";

const xml = `
  <MemoryDays>
    <event>
      <s_month>3</s_month><s_date>25</s_date>
      <f_month>3</f_month><f_date>25</f_date>
      <name>Благовещение Пресвятой Богородицы</name><type>1</type>
    </event>
  </MemoryDays>
`;

describe("public Orthodox calendar API", () => {
  it("provides cached feasts, Pascha, periods and fasting through one facade", () => {
    const api = createOrthodoxCalendarApiFromXml(xml, "test.xml");
    expect(api.getYear(2027)).toBe(api.getYear(2027));
    expect(api.getPascha(2027)).toEqual({ year: 2027, month: 5, day: 2 });
    expect(api.getDay({ year: 2027, month: 4, day: 7 })?.events[0]?.title).toContain("Благовещение");
    expect(api.getFasting({ year: 2027, month: 4, day: 7 })?.foodRule.id).toBe("fish");
    expect(api.getFastingPeriods(2027).some((period) => period.id === "apostles-fast")).toBe(true);

    api.clearCache();
    expect(api.getYear(2027).year).toBe(2027);
  });
});
