import { readFileSync } from "node:fs";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  drawPdfText, embedShapingFont, pdfTextWidth, positionPdfGlyphs, positionedPdfTextOperators,
} from "../src/export/pdf-text-shaping";

const bytes = readFileSync("public/fonts/MonomakhUnicode.ttf");
const face = fontkit.create(bytes);
async function fixture() {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  return { pdf, font: await embedShapingFont(pdf, bytes) };
}

describe("combining-mark PDF text placement", () => {
  it("uses real Monomakh GPOS offsets/advances, including multi-codepoint superscript glyphs", async () => {
    const { font } = await fixture();
    for (const text of ["сꙋббѡ́та", "і҆аннꙋарїй", "гдⷭ҇а", "Бл҃говѣ́щенїе"]) {
      const run = face.layout(text);
      const positioned = positionPdfGlyphs(font, text, 20)!;
      let cursor = 0;
      run.glyphs.forEach((glyph, index) => {
        expect(positioned.glyphs[index]!.glyphId).toBe(glyph.id);
        expect(positioned.glyphs[index]!.x).toBeCloseTo(cursor + run.positions[index]!.xOffset * 0.02, 8);
        expect(positioned.glyphs[index]!.y).toBeCloseTo(run.positions[index]!.yOffset * 0.02, 8);
        cursor += run.positions[index]!.xAdvance * 0.02;
      });
      expect(positioned.width).toBeCloseTo(cursor, 8);
      expect(pdfTextWidth(font, text, 20)).toBeCloseTo(cursor, 8);
      expect(positioned.glyphs.map((glyph) => glyph.encoded.asString()).join("")).toBe(font.encodeText(text).asString());
    }
    expect(face.layout("сꙋббѡ́та").positions.some((position) => position.xOffset === -123)).toBe(true);
    expect(face.layout("гдⷭ҇а").glyphs.some((glyph) => glyph.codePoints.length > 1)).toBe(true);
  });

  it("adds tracking between graphemes, never between a base and its marks", async () => {
    const { font } = await fixture();
    const text = "і҆а́";
    const size = 24;
    const tracking = 2;
    const baseWidth = ["і҆", "а́"].reduce((sum, chunk) => sum + face.layout(chunk).advanceWidth * size / face.unitsPerEm, 0);
    expect(pdfTextWidth(font, text, size, tracking)).toBeCloseTo(baseWidth + tracking, 8);
    expect(positionPdfGlyphs(font, text, size, tracking)!.width).toBeCloseTo(baseWidth + tracking, 8);
  });

  it("leaves ordinary text on the existing rendering path", async () => {
    const { font } = await fixture();
    expect(positionPdfGlyphs(font, "Январь 2027", 20)).toBeUndefined();
    expect(pdfTextWidth(font, "Январь 2027", 20)).toBe(font.widthOfTextAtSize("Январь 2027", 20));
  });

  it("emits explicit positions and saves a valid subset font PDF", async () => {
    const { pdf, font } = await fixture();
    const page = pdf.addPage([500, 200]);
    const text = "і҆аннꙋарїй сꙋббѡ́та гдⷭ҇а";
    const operators = positionedPdfTextOperators(font, text, 30, 100, 22)!;
    expect(operators.filter((operator) => operator.toString().endsWith("Tm"))).toHaveLength(face.layout(text).glyphs.length);
    drawPdfText(page, text, { x: 30, y: 100, size: 22, font, color: rgb(0.1, 0.1, 0.1) });
    const loaded = await PDFDocument.load(await pdf.save());
    expect(loaded.getPageCount()).toBe(1);
  });
});
