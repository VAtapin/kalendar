import { describe, expect, it } from "vitest";
import {
  CALENDAR_LANGUAGE_OPTIONS,
  calendarFoodRuleLabel,
  calendarMonthName,
  calendarWeekdayLabels,
  localizeCalendarEvent,
  localizeCalendarEventTitle,
  calendarEventTitleLocalizationStatus,
} from "../src/calendar/localization/calendar-language";
import { createShortCalendarTitle, createVeryShortCalendarTitle, createLocalizedCalendarTitleVariants } from '../src/calendar/presentation/title-variants';
import { buildGeneratedLiturgicalEvents } from '../src/calendar/engine/liturgical-cycle';
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

  it("uses the editorial dictionary for feasts and fasting legends", () => {
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
      title: "Светлое Христово Воскресение. Пасха",
      shortTitle: "Светлое Христово Воскресение",
      veryShortTitle: "Пасха Христова",
      typeCode: 2,
      occurrenceDate: { year: 2027, month: 5, day: 22 },
      spanStart: { year: 2027, month: 5, day: 22 },
      spanFinish: { year: 2027, month: 5, day: 22 },
      dayIndexInSpan: 0,
      ruleKind: "fixed-julian",
      priority: 900,
    };
    const polish = localizeCalendarEvent(event, "pl");
    expect(event.title).toBe("Светлое Христово Воскресение. Пасха");
    expect(polish.title).toBe("Święte Zmartwychwstanie Chrystusa. Pascha");
    expect(polish.title).not.toMatch(/[А-Яа-яЁё]/u);
    expect(polish.shortTitle).toBeUndefined();
    expect(polish.veryShortTitle).toBeUndefined();
    expect(event.shortTitle).toBe("Светлое Христово Воскресение");
    expect(event.veryShortTitle).toBe("Пасха Христова");

    const unknown = { ...event, title: "Перенесение мощей Свт. Николая", shortTitle: "Свт. Николая", veryShortTitle: "Свт. Николай" };
    expect(localizeCalendarEvent(unknown, "pl")).toEqual(unknown);

    const known = { ...event, title: "Святое Богоявление. Крещение Господа Бога и Спаса нашего Иисуса Христа", shortTitle: "Богоявление", veryShortTitle: undefined };
    expect(localizeCalendarEvent(known, "de").shortTitle).toBe("Theophanie");

    const sourceTitle = 'Успение Пресвятой Владычицы нашей Богородицы и Приснодевы Марии';
    const generated = { ...event, title: sourceTitle, shortTitle: createShortCalendarTitle(sourceTitle), veryShortTitle: createVeryShortCalendarTitle(sourceTitle) };
    for (const language of ['uk', 'pl'] as const) {
      const result = localizeCalendarEvent(generated, language);
      expect(result.title).not.toBe(sourceTitle);
      expect(result).toMatchObject(createLocalizedCalendarTitleVariants(result.title, language));
      expect(generated.title).toBe(sourceTitle);
      const custom = { ...generated, shortTitle: 'Моя особая подпись', veryShortTitle: 'Моя подпись' };
      expect(localizeCalendarEvent(custom, language).shortTitle).toBeUndefined();
      expect(localizeCalendarEvent(custom, language).veryShortTitle).toBeUndefined();
      expect(localizeCalendarEvent({ ...custom, title: 'Новая пользовательская память' }, language))
        .toEqual({ ...custom, title: 'Новая пользовательская память' });
    }
  });

  it('covers generated liturgical-cycle titles and their editorial print forms in Ukrainian and Polish', () => {
    for (const language of ['uk', 'pl'] as const) {
      for (const event of buildGeneratedLiturgicalEvents(2027)) {
        expect(calendarEventTitleLocalizationStatus(event.title, language), event.title).not.toBe('source-fallback');
        const result = localizeCalendarEvent(event, language);
        for (const key of ['title', 'shortTitle', 'veryShortTitle'] as const) {
          if (!event[key]) continue;
          expect(result[key], `${language}: ${event[key]}`).toBeTruthy();
          if (language === 'pl') expect(result[key]).not.toMatch(/\p{Script=Cyrillic}/u);
        }
      }
    }
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
