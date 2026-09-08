import { readFile, mkdir, writeFile } from "node:fs/promises";
import { buildOrthodoxCalendarYear, parseMemoryDaysXml } from "../src/calendar";
import { createBlankCalendarProject, createBlankPage } from "../src/document/factories";
import { createElementOnOwnLayer } from "../src/editor/element-creation";
import { createMonthTemplatePage } from "../src/templates/calendar-templates";
import { exportCalendarProjectPdf } from "../src/export/pdf-exporter";
import { CHURCH_SLAVONIC_CYCLE_TITLES } from "../src/calendar/localization/church-slavonic";

// Engineering proof, never the user's sample PDF and never an editorial approval.
const [xml, font, catalogue] = await Promise.all([
  readFile("public/data/MemoryDays.xml", "utf8"), readFile("public/fonts/MonomakhUnicode.ttf"),
  readFile("public/data/church-slavonic/catalogue.json", "utf8"),
]);
const project = createBlankCalendarProject(2027);
project.calendarLanguage = "cu";
const month = createMonthTemplatePage("A3", "portrait", 1, 2027);
const proof = createBlankPage("A4", "portrait");
proof.id = "slavonic-glyph-proof";
const corpus = JSON.parse(catalogue);
const samples: string[] = ["Церковнославянский: контроль вывода", ...Object.values(CHURCH_SLAVONIC_CYCLE_TITLES).slice(0, 5),
  ...corpus.entries.filter((entry: { cu: string }) => entry.cu.length < 80 && /ⷭ҇|ⷣ|҃/u.test(entry.cu)).slice(0, 5).map((entry: { cu: string }) => entry.cu)];
for (const [index, title] of samples.entries()) {
  const element = createElementOnOwnLayer(proof, "text", { x: 10, y: 12 + index * 24, width: 190, height: 23 }).element;
  if (element.type !== "text") throw new Error("No text element");
  element.content.title = title;
  element.typography.fontFamily = "Monomakh Unicode";
  element.typography.fontSizePt = 18;
  element.typography.lineHeight = 1.4;
}
project.document.pages = [month, proof];
const result = await exportCalendarProjectPdf(project, buildOrthodoxCalendarYear(2027, parseMemoryDaysXml(xml)),
  { regular: font, bold: font, italic: font, boldItalic: font, bundled: { "Monomakh Unicode": { regular: font } } },
  { slavonicCorpus: corpus, loadAssetSource: async () => undefined });
await mkdir("tmp/pdfs", { recursive: true });
await writeFile("tmp/pdfs/slavonic-proof.pdf", result.bytes);
console.log(JSON.stringify({ path: "tmp/pdfs/slavonic-proof.pdf", warnings: result.warnings }));
