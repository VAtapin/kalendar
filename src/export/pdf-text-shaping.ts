import fontkit, { type Font } from "@pdf-lib/fontkit";
import {
  PDFDocument, PDFHexString, PDFName, type PDFFont, type PDFPage,
  type PDFOperator, type Color, beginText, endText, popGraphicsState,
  pushGraphicsState, setCharacterSpacing, setFillingColor, setFontAndSize,
  setGraphicsState, setTextMatrix, showText,
} from "pdf-lib";

// pdf-lib 1.17 embeds shaped glyph IDs but drops fontkit's GPOS offsets.
// Keep its subset encoding, while placing combining-mark runs ourselves.
const sources = new WeakMap<PDFFont, { bytes: Uint8Array; face?: Font }>();
const pageFonts = new WeakMap<PDFPage, Map<PDFFont, PDFName>>();
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export async function embedShapingFont(pdf: PDFDocument, bytes: Uint8Array): Promise<PDFFont> {
  const font = await pdf.embedFont(bytes, { subset: true });
  sources.set(font, { bytes });
  return font;
}

function shapingFace(font: PDFFont, text: string): Font | undefined {
  if (!/\p{M}/u.test(text)) return undefined;
  const source = sources.get(font);
  if (!source) return undefined;
  source.face ??= fontkit.create(source.bytes);
  return source.face;
}

function textChunks(text: string, spacing: number): string[] {
  return spacing ? [...graphemes.segment(text)].map(({ segment }) => segment) : [text];
}

export interface PositionedPdfGlyph {
  encoded: PDFHexString;
  glyphId: number;
  x: number;
  y: number;
}

export function positionPdfGlyphs(font: PDFFont, text: string, size: number, spacing = 0):
  { glyphs: PositionedPdfGlyph[]; width: number } | undefined {
  const face = shapingFace(font, text);
  if (!face) return undefined;
  const scale = size / face.unitsPerEm;
  const glyphs: PositionedPdfGlyph[] = [];
  let cursorX = 0;
  let cursorY = 0;
  const chunks = textChunks(text, spacing);
  chunks.forEach((chunk, chunkIndex) => {
    const run = face.layout(chunk);
    // Encode the WHOLE run: encoding one Unicode character at a time would
    // destroy GSUB ligatures and produce wrong subset CIDs for superscripts.
    const encoded = font.encodeText(chunk).asString();
    if (encoded.length !== run.glyphs.length * 4) {
      throw new Error("PDF shaped run and embedded font encoding disagree");
    }
    run.glyphs.forEach((glyph, index) => {
      const position = run.positions[index]!;
      glyphs.push({
        encoded: PDFHexString.of(encoded.slice(index * 4, index * 4 + 4)),
        glyphId: glyph.id,
        x: cursorX + position.xOffset * scale,
        y: cursorY + position.yOffset * scale,
      });
      cursorX += position.xAdvance * scale;
      cursorY += position.yAdvance * scale;
    });
    if (chunkIndex < chunks.length - 1) cursorX += spacing;
  });
  return { glyphs, width: cursorX };
}

export function pdfTextWidth(font: PDFFont, text: string, size: number, spacing = 0): number {
  const face = shapingFace(font, text);
  if (!face) return font.widthOfTextAtSize(text, size)
    + Math.max(0, [...graphemes.segment(text)].length - 1) * spacing;
  const chunks = textChunks(text, spacing);
  return chunks.reduce((width, chunk) => width + face.layout(chunk).positions
    .reduce((sum, position) => sum + position.xAdvance, 0) * size / face.unitsPerEm, 0)
    + Math.max(0, chunks.length - 1) * spacing;
}

/** Use inside an existing BT/ET text object, including gradient text clips. */
export function positionedPdfTextOperators(
  font: PDFFont, text: string, x: number, y: number, size: number, spacing = 0,
): PDFOperator[] | undefined {
  const positioned = positionPdfGlyphs(font, text, size, spacing);
  if (!positioned) return undefined;
  return [setCharacterSpacing(0), ...positioned.glyphs.flatMap((glyph) => [
    setTextMatrix(1, 0, 0, 1, x + glyph.x, y + glyph.y), showText(glyph.encoded),
  ])];
}

export interface PdfTextOptions {
  x: number;
  y: number;
  size: number;
  font: PDFFont;
  color: Color;
  opacity?: number;
}

/** Returns false for ordinary text, so its existing rendering remains intact. */
export function drawCombiningPdfText(page: PDFPage, text: string, options: PdfTextOptions, spacing = 0): boolean {
  const placed = positionedPdfTextOperators(options.font, text, options.x, options.y, options.size, spacing);
  if (!placed) return false;
  let fonts = pageFonts.get(page);
  if (!fonts) { fonts = new Map(); pageFonts.set(page, fonts); }
  let key = fonts.get(options.font);
  if (!key) {
    key = page.node.newFontDictionary(options.font.name, options.font.ref);
    fonts.set(options.font, key);
  }
  const operators: PDFOperator[] = [pushGraphicsState()];
  if (options.opacity !== undefined) {
    const graphicsState = page.doc.context.obj({ Type: "ExtGState", ca: options.opacity });
    operators.push(setGraphicsState(page.node.newExtGState("ShapedText", graphicsState)));
  }
  operators.push(setFillingColor(options.color), beginText(), setFontAndSize(key, options.size),
    ...placed, endText(), popGraphicsState());
  page.pushOperators(...operators);
  return true;
}

export function drawPdfText(page: PDFPage, text: string, options: PdfTextOptions): void {
  if (!drawCombiningPdfText(page, text, options)) page.drawText(text, options);
}
