import { describe, expect, it } from "vitest";
import {
  INTERFACE_LANGUAGE_OPTIONS,
  isInterfaceLanguage,
  translateInterfaceText,
} from "../src/i18n/interface-language";

describe("interface languages", () => {
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
    expect(translateInterfaceText(
      "Язык можно выбрать на стартовой странице или в меню Файл → Настройки программы…. Переводятся меню, кнопки, подсказки и окна программы. Церковные данные календаря и введённый вами текст не переводятся.",
      "en",
    )).toContain("Church calendar data");
    expect(translateInterfaceText("Святитель Николай Чудотворец", "en")).toBe("Святитель Николай Чудотворец");
  });
});
