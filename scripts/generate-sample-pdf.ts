import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildOrthodoxCalendarYear, parseMemoryDaysXml } from "../src/calendar";
import { createBlankCalendarProject } from "../src/document/factories";
import {
  exportCalendarProjectPdf,
  type PdfFontFamilyFiles,
} from "../src/export/pdf-exporter";
import { createFullCalendarTemplate } from "../src/templates/calendar-templates";
import {
  BUNDLED_FONT_FILES,
  type BundledFontFamily,
} from "../src/typography/font-catalog";

const workspace = resolve(import.meta.dirname, "..");
const year = Number(process.argv[2] ?? 2027);
if (!Number.isInteger(year) || year < 1900 || year > 2200) {
  throw new Error("Год должен быть целым числом от 1900 до 2200");
}

const xml = await readFile(resolve(workspace, "public/data/MemoryDays.xml"), "utf8");
const dataset = parseMemoryDaysXml(xml);
const calendar = buildOrthodoxCalendarYear(year, dataset);
const project = createBlankCalendarProject(year);
project.name = "Православный календарь";
project.publisherProfile.name = "Название монастыря";
project.document.pages = createFullCalendarTemplate("A3", "portrait", year, project.publisherProfile.name);

const fontsFolder = resolve(workspace, "public/fonts");
const [regular, bold, italic, boldItalic, serifRegular, serifBold, serifItalic, serifBoldItalic] = await Promise.all([
  readFile(resolve(fontsFolder, "DejaVuSans.ttf")),
  readFile(resolve(fontsFolder, "DejaVuSans-Bold.ttf")),
  readFile(resolve(fontsFolder, "DejaVuSans-Oblique.ttf")),
  readFile(resolve(fontsFolder, "DejaVuSans-BoldOblique.ttf")),
  readFile(resolve(fontsFolder, "DejaVuSerif.ttf")),
  readFile(resolve(fontsFolder, "DejaVuSerif-Bold.ttf")),
  readFile(resolve(fontsFolder, "DejaVuSerif-Italic.ttf")),
  readFile(resolve(fontsFolder, "DejaVuSerif-BoldItalic.ttf")),
]);
const bundled = {} as Record<BundledFontFamily, PdfFontFamilyFiles>;
for (const [family, files] of Object.entries(BUNDLED_FONT_FILES) as Array<
  [BundledFontFamily, (typeof BUNDLED_FONT_FILES)[BundledFontFamily]]
>) {
  const [familyRegular, familyBold, familyItalic, familyBoldItalic] = await Promise.all([
    readFile(resolve(fontsFolder, files.regular)),
    files.bold ? readFile(resolve(fontsFolder, files.bold)) : undefined,
    files.italic ? readFile(resolve(fontsFolder, files.italic)) : undefined,
    files.boldItalic ? readFile(resolve(fontsFolder, files.boldItalic)) : undefined,
  ]);
  bundled[family] = {
    regular: familyRegular,
    ...(familyBold ? { bold: familyBold } : {}),
    ...(familyItalic ? { italic: familyItalic } : {}),
    ...(familyBoldItalic ? { boldItalic: familyBoldItalic } : {}),
  };
}
const result = await exportCalendarProjectPdf(project, calendar, {
  regular,
  bold,
  italic,
  boldItalic,
  serifRegular,
  serifBold,
  serifItalic,
  serifBoldItalic,
  bundled,
}, {
  loadAssetSource: async (source) => {
    if (!source.startsWith("/")) return undefined;
    return new Uint8Array(await readFile(resolve(workspace, "public", source.slice(1))));
  },
});
const outputFolder = resolve(workspace, "output/pdf");
await mkdir(outputFolder, { recursive: true });
const outputPath = resolve(outputFolder, `orthodox-calendar-${year}-a3-preview.pdf`);
await writeFile(outputPath, result.bytes);

console.log(JSON.stringify({
  outputPath,
  pages: project.document.pages.length,
  bytes: result.bytes.length,
  warnings: result.warnings,
}, null, 2));
