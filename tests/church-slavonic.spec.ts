import { readFileSync } from "node:fs";
import fontkit from "@pdf-lib/fontkit";
import { describe, expect, it } from "vitest";
import {
  CHURCH_SLAVONIC_FOOD_CORRECTIONS, CHURCH_SLAVONIC_SHORT_WEEKDAYS,
  verifiedChurchSlavonicTitle,
} from "../src/calendar/localization/church-slavonic";
import { calendarMonthName, calendarWeekdayLabels } from "../src/calendar/localization/calendar-language";
import { layoutTextBlock } from "../src/layout/text-layout";

describe("source-attested Church Slavonic vocabulary", () => {
  it("preserves superscript letter clusters rather than invented two-letter titla", () => {
    expect(CHURCH_SLAVONIC_SHORT_WEEKDAYS).toHaveLength(7);
    expect(CHURCH_SLAVONIC_SHORT_WEEKDAYS[1]).toBe("втоⷬ҇");
    expect(CHURCH_SLAVONIC_SHORT_WEEKDAYS[6]).toBe("ндⷧ҇ѧ");
  });

  it("does not guess spellings or inflections of unknown saint names", () => {
    expect(verifiedChurchSlavonicTitle("Вмч. Георгия Победоносца (303)")).toContain("геѡ́ргїа (303)");
    expect(verifiedChurchSlavonicTitle("Мц. Еввулы (ок. 305)")).toBeUndefined();
  });

  it("never sends a detached accent to the next line in a narrow frame", () => {
    const result = layoutTextBlock("і҆а́", 1, 10, 1, (text) => [...text].length);
    expect(result.lines.map((line) => line.text)).toEqual(["і҆", "а́"]);
    expect(result.lines.every((line) => !/^\p{M}/u.test(line.text))).toBe(true);
  });

  it("checks actual bundled font glyphs for months, weekdays and the verified corrections", () => {
    const font = fontkit.create(readFileSync("public/fonts/MonomakhUnicode.ttf"));
    const vocabulary = [
      ...Array.from({ length: 12 }, (_, index) => calendarMonthName(index + 1, "cu")),
      ...calendarWeekdayLabels("cu"), ...CHURCH_SLAVONIC_SHORT_WEEKDAYS,
      ...Object.values(CHURCH_SLAVONIC_FOOD_CORRECTIONS),
      verifiedChurchSlavonicTitle("Вмч. Георгия Победоносца (303)")!,
    ].join(" ");
    const missing = [...new Set(vocabulary)].filter((character) => !font.hasGlyphForCodePoint(character.codePointAt(0)!));
    expect(missing).toEqual([]);
    // This is a real cmap check, unlike a Unicode-range allowlist.
    expect(font.hasGlyphForCodePoint(0x0378)).toBe(false);
  });
});
