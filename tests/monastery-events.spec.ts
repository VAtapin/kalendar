import { describe, expect, it } from "vitest";
import { mergeMonasteryEvents } from "../src/calendar/engine/merge-monastery-events";
import type { OrthodoxCalendarYear } from "../src/calendar";

const day = {
  date: { year: 2027, month: 9, day: 10 },
  isoDate: "2027-09-10",
  oldStyleDate: { year: 2027, month: 8, day: 28 },
  weekday: 5,
  events: [],
};
const calendar: OrthodoxCalendarYear = {
  year: 2027,
  pascha: { year: 2027, month: 5, day: 2 },
  days: [day],
  daysByIsoDate: { [day.isoDate]: day },
  diagnostics: [],
};

describe("monastery events", () => {
  it("adds unlimited annual project events without changing the source calendar", () => {
    const result = mergeMonasteryEvents(calendar, [
      {
        id: "local-1",
        title: "Праздник монастыря",
        dateRule: { type: "annual", month: 9, day: 10 },
        priority: 950,
        styleToken: "monastery-feast",
      },
    ]);
    expect(result.daysByIsoDate["2027-09-10"]?.events[0]?.title).toBe("Праздник монастыря");
    expect(calendar.days[0]?.events).toHaveLength(0);
  });
});
