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
  it('keeps Tauern readable by browser font sanitizers, including the cmap sentinel', async () => {
    const bytes = await readFile(resolve(import.meta.dirname, '../public/fonts/TauernInlineCTT.ttf'));
    const count = bytes.readUInt16BE(4);
    const selector = Math.floor(Math.log2(count));
    expect(bytes.readUInt16BE(6)).toBe(16 * 2 ** selector);
    expect(bytes.readUInt16BE(8)).toBe(selector);
    expect(bytes.readUInt16BE(10)).toBe(16 * count - 16 * 2 ** selector);
    const tables = new Map<string, number>();
    for (let index = 0; index < count; index++) {
      const record = 12 + index * 16;
      tables.set(bytes.toString('ascii', record, record + 4), bytes.readUInt32BE(record + 8));
    }
    const glyphCount = bytes.readUInt16BE(tables.get('maxp')! + 4);
    const cmap = tables.get('cmap')!;
    let format4 = 0;
    for (let index = 0; index < bytes.readUInt16BE(cmap + 2); index++) {
      const record = cmap + 4 + index * 8;
      if (bytes.readUInt16BE(record) === 3 && bytes.readUInt16BE(record + 2) === 1) format4 = cmap + bytes.readUInt32BE(record + 4);
    }
    expect(bytes.readUInt16BE(format4)).toBe(4);
    const segments = bytes.readUInt16BE(format4 + 6) / 2;
    const end = format4 + 14;
    const start = end + segments * 2 + 2;
    const deltas = start + segments * 2;
    const ranges = deltas + segments * 2;
    const limit = format4 + bytes.readUInt16BE(format4 + 2);
    for (let index = 0; index < segments; index++) {
      const first = bytes.readUInt16BE(start + index * 2);
      const last = bytes.readUInt16BE(end + index * 2);
      const delta = bytes.readInt16BE(deltas + index * 2);
      const range = bytes.readUInt16BE(ranges + index * 2);
      for (let code = first; code <= last; code++) {
        let glyph = (code + delta) & 0xffff;
        if (range) {
          const address = ranges + index * 2 + range + (code - first) * 2;
          expect(address + 2).toBeLessThanOrEqual(limit);
          glyph = bytes.readUInt16BE(address);
          if (glyph) glyph = (glyph + delta) & 0xffff;
        }
        expect(glyph, `Tauern U+${code.toString(16)}`).toBeLessThan(glyphCount);
      }
    }
  });

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

  it("extends Rurintania with German umlauts and eszett", async () => {
    const bytes = await readFile(resolve(import.meta.dirname, "../public/fonts/Rurintania.ttf"));
    const face = fontkit.create(bytes);
    for (const character of "äÄöÖüÜß") {
      expect(face.glyphForCodePoint(character.codePointAt(0)!).id, character).toBeGreaterThan(0);
    }
  });

  it("offers decorative, book and system choices in the editor", () => {
    const decorativeFamilies = FONT_OPTIONS.filter((font) => font.kind === "decorative").map((font) => font.family);
    expect(decorativeFamilies).toHaveLength(39);
    expect(decorativeFamilies).toEqual(expect.arrayContaining([
      "Ruslan Display", "Yeseva One", "Marck Script", "Monomakh Unicode", "Ponomar", "Afisha", "Lavka 2021", "TD Elena2021",
    ]));
    expect(FONT_OPTIONS.some((font) => font.family === "Cormorant Garamond" && font.kind === "text")).toBe(true);
  });
});
