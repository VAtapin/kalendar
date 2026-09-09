import { describe, expect, it } from "vitest";
import {
  createShortCalendarTitle,
  createVeryShortCalendarTitle,
  createLocalizedCalendarTitleVariants,
} from "../src/calendar/presentation/title-variants";

describe("calendar title variants", () => {
  it('abbreviates Ukrainian and Polish ranks without removing names or dates from the short form', () => {
    expect(createLocalizedCalendarTitleVariants('Священномучеників Петра і Павла, єпископа (1937)', 'uk').shortTitle)
      .toBe('Сщмчч. Петра і Павла, єп. (1937)');
    const title = 'Świętych męczenników Piotra i Pawła, arcybiskupa (ok. 1937)';
    const result = createLocalizedCalendarTitleVariants(title, 'pl');
    expect(result.shortTitle).toBe('Św. męczenników Piotra i Pawła, abp. (ok. 1937)');
    expect(result.veryShortTitle).toBe('Św. męczenników Piotra i Pawła, abp.');
    expect(createLocalizedCalendarTitleVariants('Najświętszej Bogurodzicy', 'pl').shortTitle)
      .toBe('Najświętszej Bogurodzicy');
    for (const language of ['uk', 'pl'] as const) {
      const long = createLocalizedCalendarTitleVariants('Antoni '.repeat(20), language);
      expect(long.shortTitle).toBe('Antoni '.repeat(20));
      expect(long.veryShortTitle).toMatch(/…$/u);
      expect([...long.veryShortTitle].length).toBeLessThanOrEqual(72);
    }
  });
  it('builds localized print variants without breaking Slavonic combining marks', () => {
    const title = 'Мч҃никѡвъ ' + 'а҆леѯа́ндра '.repeat(20) + '(1937)';
    const result = createLocalizedCalendarTitleVariants(title, 'cu');
    expect(result.shortTitle).toBe(title);
    expect(result.veryShortTitle).toMatch(/…$/u);
    expect(result.veryShortTitle).not.toMatch(/(?:^|\s|…)\p{M}/u);
    expect(result.veryShortTitle).not.toContain('1937');
    expect(createLocalizedCalendarTitleVariants('Heiliger Johannes, Erzbischof (1937)', 'de').shortTitle)
      .toBe('Hl. Johannes, Erzb. (1937)');
  });
  it("preserves a name following its primary rank", () => {
    expect(createVeryShortCalendarTitle("День кончины Святейшего Патриарха Пимена"))
      .toBe("День кончины Святейшего патр. Пимена");
    expect(createVeryShortCalendarTitle("Память игумении Марии"))
      .toBe("Память игумении Марии");
  });
  it("does not corrupt plural ranks or match inside longer words", () => {
    expect(createShortCalendarTitle("Собор Вселенских учителей и святителей"))
      .toBe("Собор Вселенских учителей и Свтт.");
    expect(createShortCalendarTitle("Собор новомучеников и исповедников Церкви Русской"))
      .toBe("Собор Новомчч. и Исп. Церкви Русской");
    expect(createShortCalendarTitle("Священномучеников и преподобномучеников"))
      .toBe("Сщмчч. и Прмчч.");
  });
  it("creates deterministic church-calendar abbreviations", () => {
    expect(createShortCalendarTitle("Священномученика Петра, епископа Воронежского"))
      .toBe("Сщмч. Петра, еп. Воронежского");
  });

  it("keeps a compact semantic list for a very small cell", () => {
    expect(createVeryShortCalendarTitle("Преподобного А; Мученика Б; Святителя В"))
      .toBe("Прп. А; Мч. Б; и др.");
  });

  it("removes dates and secondary ranks from a print-cell variant", () => {
    expect(createVeryShortCalendarTitle(
      "Святителя Тихона, патриарха Московского и всея России чудотворца (1925)",
    )).toBe("Свт. Тихона");
  });

  it("shortens common feast formulas without losing their subject", () => {
    expect(createVeryShortCalendarTitle(
      "Рождество Пресвятой Владычицы нашей Богородицы и Приснодевы Марии",
    )).toBe("Рождество Пресвятой Богородицы");
  });
});
