import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseMemoryDaysXml } from "../src/calendar";
import {
  calendarEventTitleLocalizationStatus,
  localizeCalendarEventTitle,
  localizeCalendarEventTitleWithStatus,
} from "../src/calendar/localization/calendar-language";

describe("source-audited localization corrections, 2026-09-08", () => {
  // OCU Calendar 2026, PDF pp. 7/9/10 and June-December Sundays.
  it.each([
    [1, "1-ша"], [2, "2-га"], [3, "3-тя"], [4, "4-та"], [5, "5-та"], [6, "6-та"],
    [7, "7-ма"], [8, "8-ма"], [9, "9-та"], [10, "10-та"], [11, "11-та"], [12, "12-та"],
    [13, "13-та"], [17, "17-та"], [18, "18-та"], [21, "21-ша"], [22, "22-га"],
    [23, "23-тя"], [27, "27-ма"], [28, "28-ма"], [31, "31-ша"], [32, "32-га"], [33, "33-тя"],
  ])("uses the Ukrainian feminine ordinal for Sunday %i", (number, ordinal) => {
    expect(localizeCalendarEventTitle(`Неделя ${number}-я по Пятидесятнице`, "uk"))
      .toBe(`Неділя ${ordinal} після П’ятдесятниці`);
  });

  it("uses the corrected spelling and ordinal in each structured family", () => {
    expect(localizeCalendarEventTitle("День Святой Троицы. Пятидесятница", "uk")).toBe("День Святої Тройці. П’ятдесятниця");
    expect(localizeCalendarEventTitle("Неделя 1-я Великого поста. Торжество Православия", "uk"))
      .toBe("Неділя 1-ша Великого посту. Торжество Православ’я");
    expect(localizeCalendarEventTitle("Неделя 3-я по Пасхе, святых жен-мироносиц", "uk"))
      .toBe("Неділя 3-тя після Пасхи, святих жінок-мироносиць");
    expect(localizeCalendarEventTitle("Отдание праздника Преполовения Пятидесятницы", "uk"))
      .toBe("Віддання свята Переполовення П’ятдесятниці");
    expect(localizeCalendarEventTitle("Преполовение Пятидесятницы", "pl"))
      .toBe("Połowa okresu Pięćdziesiątnicy");
  });

  it.each(["de", "uk", "pl"] as const)("covers the four previously missing great feasts in %s", (language) => {
    const dataset = parseMemoryDaysXml(readFileSync(new URL("../public/data/MemoryDays.xml", import.meta.url), "utf8"));
    const titles = [
      "Рождество честного славного Пророка, Предтечи и Крестителя Господня Иоанна",
      "Славных и всехвальных первоверховных апостолов Петра и Павла (67)",
      "Усекновение главы Пророка, Предтечи и Крестителя Господня Иоанна",
      "Покров Пресвятой Владычицы нашей Богородицы и Приснодевы Марии",
    ];
    for (const title of titles) {
      expect(dataset.records.some((record) => record.title === title)).toBe(true);
      expect(calendarEventTitleLocalizationStatus(title, language)).toBe("exact");
      expect(localizeCalendarEventTitle(title, language)).not.toBe(title);
    }
    expect(localizeCalendarEventTitle(titles[1]!, language)).toContain("(67)");
  });

  it.each(["cu", "de", "uk", "pl"] as const)("does not invent translations of unreviewed names in %s", (language) => {
    for (const source of ["Перенесение мощей Свт. Николая", "Прп. Марии Неизвестной (123)", "Неизвестное событие", "constructor"]) {
      expect(localizeCalendarEventTitleWithStatus(source, language)).toEqual({ title: source, status: "source-fallback" });
    }
  });

  it("does not misclassify a translated prefix and Russian saint as fully localized", () => {
    for (const source of [
      "Попразднство Богоявления. Прп. Марии Неизвестной",
      "Неделя 4-я Великого поста. Неизвестная память",
      "Неделя 6-я по Пасхе, неизвестная память",
    ]) {
      expect(localizeCalendarEventTitleWithStatus(source, "de")).toEqual({ title: source, status: "source-fallback" });
    }
    expect(localizeCalendarEventTitleWithStatus("Попразднство Богоявления. Собор Пресвятой Богородицы", "de")).toEqual({
      title: "Nachfest der Theophanie. Synaxis der Allheiligen Gottesgebärerin", status: "structured",
    });
    expect(calendarEventTitleLocalizationStatus("Произвольное имя", "ru")).toBe("source");
  });
});
