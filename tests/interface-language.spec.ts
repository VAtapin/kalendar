import { describe, expect, it } from "vitest";
import {
  INTERFACE_LANGUAGE_OPTIONS,
  isInterfaceLanguage,
  domainDefaultLanguage,
  resolveInterfaceLanguage,
  translateInterfaceText,
} from "../src/i18n/interface-language";

describe("interface languages", () => {
  it("defaults to the domain language without overriding a manual preference", () => {
    expect(domainDefaultLanguage('kalender.georg-kloster.de')).toBe('de');
    expect(domainDefaultLanguage('KALENDER.GEORG-KLOSTER.DE.')).toBe('de');
    expect(domainDefaultLanguage('kalender.georg-kloster.ru')).toBe('ru');
    expect(domainDefaultLanguage('localhost')).toBe('ru');
    expect(resolveInterfaceLanguage('kalender.georg-kloster.de', null)).toBe('de');
    expect(resolveInterfaceLanguage('kalender.georg-kloster.de', 'invalid')).toBe('de');
    for (const preference of ['ru', 'de', 'en', 'uk']) {
      expect(resolveInterfaceLanguage('kalender.georg-kloster.de', preference)).toBe(preference);
      expect(resolveInterfaceLanguage('kalender.georg-kloster.ru', preference)).toBe(preference);
    }
  });
  it("offers Russian, German, English and Ukrainian", () => {
    expect(INTERFACE_LANGUAGE_OPTIONS.map((option) => option.id)).toEqual(["ru", "de", "en", "uk"]);
    expect(isInterfaceLanguage("de")).toBe(true);
    expect(isInterfaceLanguage("fr")).toBe(false);
  });

  it("translates application copy but leaves unknown calendar content unchanged", () => {
    expect(translateInterfaceText("Настройки программы", "de")).toBe("Programmeinstellungen");
    expect(translateInterfaceText("Настройки программы", "en")).toBe("Program settings");
    expect(translateInterfaceText("Настройки программы", "uk")).toBe("Налаштування програми");
    expect(translateInterfaceText("Страница 3 из 13", "de")).toBe("Seite 3 von 13");
    expect(translateInterfaceText("По горизонтали: -25%", "en")).toBe("Horizontal: -25%");
    expect(translateInterfaceText("Удалить шаблон «Мой»?", "uk")).toBe("Видалити шаблон «Мой»?");
    expect(translateInterfaceText("Макеты календарной сетки", "en")).toBe("Calendar grid layouts");
    expect(translateInterfaceText(
      "Заменить общий макет «Книжный» оформлением выбранной сетки? Изменение увидят все пользователи.",
      "de",
    )).toContain("Alle Benutzer");
    expect(translateInterfaceText(
      "Язык интерфейса можно выбрать на стартовой странице или в меню Файл → Настройки программы…. Он меняет меню, кнопки, подсказки и окна, но не язык печатного календаря.",
      "en",
    )).toContain("printed calendar language");
    expect(translateInterfaceText("Святитель Николай Чудотворец", "en")).toBe("Святитель Николай Чудотворец");
  });
});
