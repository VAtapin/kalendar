import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildOrthodoxCalendarYear, parseMemoryDaysXml } from "../src/calendar";
import { createBlankCalendarProject } from "../src/document/factories";
import { MM_TO_PT, exportCalendarProjectPdf } from "../src/export/pdf-exporter";
import { createMonthTemplatePage } from "../src/templates/calendar-templates";

describe("PDF exporter", () => {
  it("creates a Cyrillic print page with MediaBox, TrimBox and bleed", async () => {
    const workspace = resolve(import.meta.dirname, "..");
    const [xml, regular, bold, italic, boldItalic] = await Promise.all([
      readFile(resolve(workspace, "public/data/MemoryDays.xml"), "utf8"),
      readFile(resolve(workspace, "public/fonts/DejaVuSans.ttf")),
      readFile(resolve(workspace, "public/fonts/DejaVuSans-Bold.ttf")),
      readFile(resolve(workspace, "public/fonts/DejaVuSans-Oblique.ttf")),
      readFile(resolve(workspace, "public/fonts/DejaVuSans-BoldOblique.ttf")),
    ]);
    const calendar = buildOrthodoxCalendarYear(2027, parseMemoryDaysXml(xml));
    const project = createBlankCalendarProject(2027);
    project.document.pages = [createMonthTemplatePage("A6", "portrait", 1, 2027)];
    for (const element of project.document.pages[0]!.elements) {
      if (element.type === "calendar-grid") element.showFoodIcons = false;
    }
    const result = await exportCalendarProjectPdf(project, calendar, {
      regular,
      bold,
      italic,
      boldItalic,
    });
    const exported = await PDFDocument.load(result.bytes);
    expect(exported.getPageCount()).toBe(1);
    const page = exported.getPage(0);
    expect(page.getWidth()).toBeCloseTo((105 + 6) * MM_TO_PT, 2);
    expect(page.getHeight()).toBeCloseTo((148 + 6) * MM_TO_PT, 2);
    expect(page.getTrimBox().width).toBeCloseTo(105 * MM_TO_PT, 2);
    expect(result.warnings.some((warning) => warning.code === "missing-asset")).toBe(true);
  });
});
