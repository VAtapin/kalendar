import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDict, PDFDocument, PDFName, PDFNumber } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildOrthodoxCalendarYear, parseMemoryDaysXml } from "../src/calendar";
import { createBlankCalendarProject } from "../src/document/factories";
import { createGoldGradient } from "../src/document/paint";
import { createElementOnOwnLayer } from "../src/editor/element-creation";
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
    const goldShape = createElementOnOwnLayer(
      project.document.pages[0]!,
      "rectangle",
      { x: 8, y: 8, width: 32, height: 12 },
    ).element;
    if (goldShape.type !== "shape") throw new Error("Expected shape");
    goldShape.opacity = 0.45;
    goldShape.fillGradient = createGoldGradient();
    for (const element of project.document.pages[0]!.elements) {
      if (element.type === "text") {
        element.textEffects = {
          gradient: createGoldGradient(),
          extrusion: { color: "#70430f", depthMm: 1.2, angleDeg: 45, opacity: 0.9 },
          shadow: { color: "#000000", offsetXMm: 1, offsetYMm: 1, blurMm: 0.8, opacity: 0.4 },
        };
      }
      if (element.type === "calendar-grid") {
        element.showFoodIcons = false;
        element.weekdayTextEffects = {
          gradient: createGoldGradient(),
          shadow: { color: "#000000", offsetXMm: 0.5, offsetYMm: 0.5, blurMm: 0.4, opacity: 0.35 },
        };
        element.dayNumberTextEffects = {
          gradient: createGoldGradient(),
          extrusion: { color: "#70430f", depthMm: 0.7, angleDeg: 45, opacity: 0.9 },
        };
      }
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
    const shadings = page.node.Resources()?.lookupMaybe(PDFName.of("Shading"), PDFDict);
    expect(shadings?.keys().length).toBeGreaterThan(0);
    for (const key of shadings?.keys() ?? []) {
      const shading = exported.context.lookup(shadings!.get(key), PDFDict);
      expect(shading.lookup(PDFName.of("ShadingType"), PDFNumber).asNumber()).toBe(2);
      const stitching = shading.lookup(PDFName.of("Function"), PDFDict);
      expect(stitching.lookup(PDFName.of("FunctionType"), PDFNumber).asNumber()).toBe(3);
    }
    expect(result.warnings.some((warning) => warning.code === "missing-asset")).toBe(true);
  });

  it("embeds PDF/X-4 metadata and a selected output intent", async () => {
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
    project.assets.push({
      id: "press-profile",
      name: "Press CMYK.icc",
      mimeType: "application/vnd.iccprofile",
      source: "data:application/vnd.iccprofile;base64,AAECAwQFBgcICQ==",
      kind: "icc-profile",
    });
    project.printSettings = {
      includeCropMarks: true,
      cropMarkLengthMm: 2,
      cropMarkOffsetMm: 0.5,
      pdfStandard: "PDF/X-4",
      colorProfile: "CMYK-custom",
      iccProfileAssetId: "press-profile",
      outputConditionName: "Press CMYK",
    };
    const result = await exportCalendarProjectPdf(project, calendar, { regular, bold, italic, boldItalic });
    const exported = await PDFDocument.load(result.bytes);
    expect(exported.catalog.get(PDFName.of("OutputIntents"))).toBeDefined();
    expect(exported.catalog.get(PDFName.of("Metadata"))).toBeDefined();
    expect(result.warnings.some((warning) => warning.code === "missing-output-profile")).toBe(false);
  });
});
