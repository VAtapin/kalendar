import { expect, it } from "vitest";
import { parseOfficialCalendar, officialTitleMatches } from "../scripts/lib/official-calendar-evidence";

it("parses Julian rather than parenthesized Gregorian day numbers", () => {
  const days = parseOfficialCalendar("2026 год\r1(14) января, среда\rСвт. Василия.\r20(2) января, понедельник\rПрп. Евфимия.\r");
  expect(days.map(d => [d.oldMonth, d.oldDay, d.newDay])).toEqual([[1, 1, 14], [1, 20, 2]]);
  expect(days[0]!.paragraphs).toEqual(["Свт. Василия."]);
  expect(days[1]!.paragraphs).toEqual(["Прп. Евфимия."]);
});
it("removes publisher stress encoding without discarding years or names", () => {
  const source = "Обре'тение мощей прп. Амвросия Оптинского (1998)\u0002.";
  expect(officialTitleMatches(source, "Обретение мощей прп. Амвросия Оптинского (1998)")).toBe(true);
  expect(officialTitleMatches(source, "Обретение мощей прп. Амвросия Оптинского (1988)")).toBe(false);
  expect(officialTitleMatches(source, "Обретение мощей прп. Анатолия Оптинского (1998)")).toBe(false);
});
