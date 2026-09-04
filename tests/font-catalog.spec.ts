import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  BUNDLED_FONT_FILES,
  FONT_OPTIONS,
} from "../src/typography/font-catalog";

describe("bundled print fonts", () => {
  it("ships every listed face with its declared character support", async () => {
    const fontFolder = resolve(import.meta.dirname, "../public/fonts");
    const pdfDocument = await PDFDocument.create();
    pdfDocument.registerFontkit(fontkit);
    for (const [family, files] of Object.entries(BUNDLED_FONT_FILES)) {
      const bytes = await readFile(resolve(fontFolder, files.regular));
      const face = fontkit.create(bytes) as {
        glyphForCodePoint: (codePoint: number) => { id: number };
      };
      const option = FONT_OPTIONS.find((item) => item.family === family);
      const sample = option?.scriptSupport === "latin"
        ? "Aa"
        : option?.scriptSupport === "partial-cyrillic"
          ? "авя"
          : "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя";
      for (const character of sample) {
        expect(face.glyphForCodePoint(character.codePointAt(0)!).id, `${family}: ${character}`).toBeGreaterThan(0);
      }
      const embedded = await pdfDocument.embedFont(bytes, { subset: true });
      embedded.encodeText(sample);
    }
    expect((await pdfDocument.save()).length).toBeGreaterThan(0);
  });

  it("does not bundle duplicate font files", async () => {
    const fontFolder = resolve(import.meta.dirname, "../public/fonts");
    const hashes = await Promise.all(Object.values(BUNDLED_FONT_FILES).map(async (files) => (
      createHash("sha256").update(await readFile(resolve(fontFolder, files.regular))).digest("hex")
    )));
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it("offers decorative, book and system choices in the editor", () => {
    const decorativeFamilies = FONT_OPTIONS.filter((font) => font.kind === "decorative").map((font) => font.family);
    expect(decorativeFamilies).toHaveLength(38);
    expect(decorativeFamilies).toEqual(expect.arrayContaining([
      "Ruslan Display", "Yeseva One", "Marck Script", "Monomakh Unicode", "Afisha", "Lavka 2021", "TD Elena2021",
    ]));
    expect(FONT_OPTIONS.some((font) => font.family === "Cormorant Garamond" && font.kind === "text")).toBe(true);
  });
});
