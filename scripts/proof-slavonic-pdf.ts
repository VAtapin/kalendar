import { mkdir, readFile, writeFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { drawPdfText, embedShapingFont } from "../src/export/pdf-text-shaping.ts";

const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);
const face = await embedShapingFont(pdf, await readFile("public/fonts/MonomakhUnicode.ttf"));
const label = await pdf.embedFont(StandardFonts.Helvetica);
const page = pdf.addPage([842, 595]);
page.drawText("Church Slavonic PDF proof - Monomakh Unicode / 2026-09-08", {
  x: 30, y: 560, size: 15, font: label,
});
page.drawText("BEFORE: glyph IDs without GPOS", { x: 30, y: 525, size: 13, font: label });
page.drawText("AFTER: positioned glyphs, selectable text", { x: 435, y: 525, size: 13, font: label });
const samples = [
  { text: "і҆а́ і҆а́", size: 48, y: 440 },
  { text: "сꙋббѡ́та", size: 48, y: 330 },
  { text: "гдⷭ҇а", size: 60, y: 220 },
  { text: "Бл҃говѣ́щенїе", size: 32, y: 120 },
];
for (const { text, size, y } of samples) {
  page.drawLine({ start: { x: 30, y }, end: { x: 810, y }, thickness: 0.4, color: rgb(0.85, 0.85, 0.85) });
  page.drawText(text, { x: 30, y, size, font: face, color: rgb(0.08, 0.08, 0.08) });
  drawPdfText(page, text, { x: 435, y, size, font: face, color: rgb(0.08, 0.08, 0.08) });
}
page.drawText("Source shaping: bundled font OpenType tables. No text converted to outlines or images.", {
  x: 30, y: 35, size: 11, font: label,
});
await mkdir("tmp/pdfs", { recursive: true });
await writeFile("tmp/pdfs/slavonic-gpos-proof.pdf", await pdf.save());
console.log("tmp/pdfs/slavonic-gpos-proof.pdf");
