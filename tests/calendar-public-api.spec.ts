import { describe, expect, it } from "vitest";
import {
  createCalendarPublicApi,
  createOrthodoxCalendarApiFromXml,
  parseCalendarApiDate,
} from "../src/calendar";

const xml = `<MemoryDays><event>
  <s_month>1</s_month><s_date>1</s_date><f_month>1</f_month><f_date>1</f_date>
  <name>Праздник</name><type>1</type>
</event></MemoryDays>`;

describe("public calendar API contract", () => {
  it("validates civil ISO dates", () => {
    expect(parseCalendarApiDate("2027-02-28")).toEqual({ year: 2027, month: 2, day: 28 });
    expect(parseCalendarApiDate("2027-02-29")).toBeUndefined();
  });

  it("returns a versioned serializable day", () => {
    const api = createCalendarPublicApi(createOrthodoxCalendarApiFromXml(xml));
    const day = api.getDay({ year: 2027, month: 1, day: 14 });
    expect(day?.date).toBe("2027-01-14");
    expect(api.metadata().apiVersion).toBe("1.0.0");
    expect(JSON.parse(JSON.stringify(day))).toEqual(day);
  });
});
