import { describe, expect, it } from "vitest";
import {
  CALENDAR_LANGUAGE_OPTIONS,
  calendarFoodRuleLabel,
  calendarMonthName,
  calendarWeekdayLabels,
  localizeCalendarEvent,
  localizeCalendarEventTitle,
} from "../src/calendar/localization/calendar-language";
import { createBlankCalendarProject } from "../src/document/factories";
import type { ResolvedCalendarEvent } from "../src/calendar/types";
import { createMonthTemplatePageWithPreset } from "../src/templates/calendar-templates";
import { normalizeCalendarProject } from "../src/persistence/project-storage";
import { unsupportedGlyphs } from "../src/typography/glyph-coverage";

describe("calendar content language", () => {
  it("keeps the five calendar languages separate from interface languages", () => {
    expect(CALENDAR_LANGUAGE_OPTIONS.map((item) => item.id)).toEqual(["ru", "cu", "de", "uk", "pl"]);
    expect(calendarMonthName(1, "cu")).toBe("і҆аннꙋарїй");
    expect(calendarMonthName(2, "de")).toBe("Februar");
    expect(calendarMonthName(3, "uk")).toBe("Березень");
    expect(calendarMonthName(10, "pl")).toBe("Październik");
    expect(calendarWeekdayLabels("pl")[6]).toBe("Niedziela");
    expect(calendarWeekdayLabels("uk", true)[6]).toBe("Нд");
  });

  it("uses verified Orthodox terminology for feasts and fasting legends", () => {
    const pascha = "Светлое Христово Воскресение. Пасха";
    expect(localizeCalendarEventTitle(pascha, "uk")).toBe("Світле Христове Воскресіння. Пасха");
    expect(localizeCalendarEventTitle("Вознесение Господне", "de")).toBe("Christi Himmelfahrt");
    expect(localizeCalendarEventTitle("День Святой Троицы. Пятидесятница", "pl")).toBe("Dzień Świętej Trójcy. Pięćdziesiątnica");
    expect(localizeCalendarEventTitle("Обрезание Господне", "cu")).toBe("Ѡ҆брѣ́занїе гдⷭ҇не");
    expect(localizeCalendarEventTitle("Попразднство Богоявления", "de")).toBe("Nachfest der Theophanie");
    expect(localizeCalendarEventTitle("Отдание праздника Рождества Христова", "pl")).toBe("Zakończenie święta Narodzenia Chrystusa");
    expect(localizeCalendarEventTitle("Неделя 31-я по Пятидесятнице", "pl")).toBe("Niedziela 31. po Pięćdziesiątnicy");
    expect(calendarFoodRuleLabel("strict-fast", "de")).toBe("strenges Fasten");
    expect(calendarFoodRuleLabel("fast", "pl")).toBe("dzień postny");
  });

  it("localizes presentation without changing the source event", () => {
    const event: ResolvedCalendarEvent = {
      id: "test",
      sourceId: "test",
      sourceIndex: 1,
      title: "Перенесение мощей Свт. Николая",
      typeCode: 2,
      occurrenceDate: { year: 2027, month: 5, day: 22 },
      spanStart: { year: 2027, month: 5, day: 22 },
      spanFinish: { year: 2027, month: 5, day: 22 },
      dayIndexInSpan: 0,
      ruleKind: "fixed-julian",
      priority: 900,
    };
    const polish = localizeCalendarEvent(event, "pl");
    expect(event.title).toBe("Перенесение мощей Свт. Николая");
    expect(polish.title).toContain("Przeniesienie relikwii");
    expect(polish.title).not.toMatch(/[А-Яа-яЁё]/u);
  });

  it("marks generated month headings and saves the calendar language in the project", () => {
    const page = createMonthTemplatePageWithPreset("A3", "portrait", 1, 2027, "editorial-photo", undefined, "de");
    const heading = page.elements.find((element) => element.type === "text" && element.semanticRole === "calendar-month-title");
    expect(page.name).toBe("Januar 2027");
    expect(heading?.type === "text" ? heading.content.title : "").toBe("Januar 2027");

    const project = createBlankCalendarProject();
    project.calendarLanguage = "pl";
    expect(normalizeCalendarProject(project).calendarLanguage).toBe("pl");
  });

  it("ships glyph coverage for the Church-Slavonic calendar vocabulary", () => {
    const sample = `${calendarMonthName(1, "cu")} ${calendarWeekdayLabels("cu").join(" ")} ${localizeCalendarEventTitle("Обрезание Господне", "cu")}`;
    expect(unsupportedGlyphs(sample)).toEqual([]);
  });
});
