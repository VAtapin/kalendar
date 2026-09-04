import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { describe, expect, it } from "vitest";
import {
  BUNDLED_FONT_FILES,
  FONT_OPTIONS,
} from "../src/typography/font-catalog";

describe("bundled print fonts", () => {
  it("ships every listed face and its Cyrillic alphabet", async () => {
    const fontFolder = resolve(import.meta.dirname, "../public/fonts");
    for (const [family, files] of Object.entries(BUNDLED_FONT_FILES)) {
      const bytes = await readFile(resolve(fontFolder, files.regular));
      const face = fontkit.create(bytes) as {
        glyphForCodePoint: (codePoint: number) => { id: number };
      };
      for (const character of "АБВабвЯя") {
        expect(face.glyphForCodePoint(character.codePointAt(0)!).id, `${family}: ${character}`).toBeGreaterThan(0);
      }
    }
  });

  it("offers decorative, book and system choices in the editor", () => {
    expect(FONT_OPTIONS.filter((font) => font.kind === "decorative").map((font) => font.family)).toEqual([
      "Ruslan Display",
      "Yeseva One",
      "Marck Script",
    ]);
    expect(FONT_OPTIONS.some((font) => font.family === "Cormorant Garamond" && font.kind === "text")).toBe(true);
  });
});
