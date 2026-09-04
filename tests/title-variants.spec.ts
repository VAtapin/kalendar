import { describe, expect, it } from "vitest";
import {
  createShortCalendarTitle,
  createVeryShortCalendarTitle,
} from "../src/calendar/presentation/title-variants";

describe("calendar title variants", () => {
  it("creates deterministic church-calendar abbreviations", () => {
    expect(createShortCalendarTitle("Священномученика Петра, епископа Воронежского"))
      .toBe("Сщмч. Петра, еп. Воронежского");
  });

  it("keeps a compact semantic list for a very small cell", () => {
    expect(createVeryShortCalendarTitle("Преподобного А; Мученика Б; Святителя В"))
      .toBe("Прп. А; Мч. Б; и др.");
  });
});
