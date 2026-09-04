import { describe, expect, it } from "vitest";
import { createBlankCalendarProject } from "../src/document/factories";
import { attachElementToLayer, createEmptyLayer } from "../src/document/layer-operations";
import type { MonthTextElement } from "../src/document/types";
import {
  createPersistentProjectSnapshot,
  createProjectArchive,
  normalizeCalendarProject,
  parseProjectArchive,
} from "../src/persistence/project-storage";
import { createMonthTemplatePageWithPreset } from "../src/templates/calendar-templates";

describe("project storage migration", () => {
  it("expands legacy month layouts, removes quote objects and uses only occupied week rows", () => {
    const project = createBlankCalendarProject(2027);
    const page = createMonthTemplatePageWithPreset("A3", "portrait", 1, 2027, "editorial-photo");
    const grid = page.elements.find((element) => element.type === "calendar-grid");
    const legend = page.elements.find((element) => element.type === "legend");
    const quoteLayer = createEmptyLayer(page, "legacy-quote-layer", "Старая цитата");
    const monthText: MonthTextElement = {
      id: "legacy-quote",
      type: "month-text",
      layerId: quoteLayer.id,
      x: 10,
      y: 360,
      width: 277,
      height: 30,
      rotation: 0,
      zIndex: 0,
      locked: false,
      visible: true,
      overflow: "none",
      content: { title: "Введите цитату" },
      attribution: "Источник цитаты",
      placement: "fixed-frame",
      typography: {
        fontFamily: "Georgia",
        fontSizePt: 11,
        lineHeight: 1.2,
        letterSpacingPt: 0,
        align: "center",
        verticalAlign: "middle",
        paddingMm: 2,
      },
    };
    attachElementToLayer(page, quoteLayer.id, monthText);
    if (grid?.type !== "calendar-grid" || legend?.type !== "legend") {
      throw new Error("Expected generated month elements");
    }
    grid.height = page.height * 0.35;
    monthText.y = grid.y + grid.height + 4;
    monthText.placement = "fixed-frame";
    legend.height = page.height * 0.035;
    project.document.pages = [page];

    normalizeCalendarProject(project);

    expect(grid.height).toBeCloseTo(page.height * 0.44);
    expect(grid.weekRows).toBe(5);
    expect(legend.y).toBeCloseTo(page.height * 0.945);
    expect(legend.height).toBeCloseTo(page.height * 0.05);
    expect(legend.columns).toBe(8);
    expect(page.elements.some((element) => element.type === "month-text")).toBe(false);
    expect(page.layers.some((layer) => layer.kind === "layer" && layer.elementId === monthText.id)).toBe(false);
  });

  it("upgrades the former generic template fonts without touching unrelated text", () => {
    const project = createBlankCalendarProject(2027);
    const page = createMonthTemplatePageWithPreset("A3", "portrait", 9, 2027, "editorial-photo");
    const grid = page.elements.find((element) => element.type === "calendar-grid");
    const title = page.elements.find(
      (element) => element.type === "text" && element.content.title === "Сентябрь 2027",
    );
    if (grid?.type !== "calendar-grid" || title?.type !== "text") {
      throw new Error("Expected generated month typography");
    }
    grid.weekdayFontFamily = "Georgia";
    grid.dayNumberFontFamily = "Georgia";
    grid.eventFontFamily = "Arial";
    title.typography.fontFamily = "Georgia";
    title.typography.fontWeight = 700;
    project.document.pages = [page];

    normalizeCalendarProject(project);

    expect(grid.weekdayFontFamily).toBe("Ruslan Display");
    expect(grid.dayNumberFontFamily).toBe("Yeseva One");
    expect(grid.eventFontFamily).toBe("Cormorant Garamond");
    expect(title.typography.fontFamily).toBe("Ruslan Display");
    expect(title.typography.fontWeight).toBe(400);
    expect(page.elements.some((element) => element.type === "month-text")).toBe(false);
  });

  it("keeps the immutable XML dataset out of persisted and reactive projects", () => {
    const project = createBlankCalendarProject(2027);
    project.calendarData = { records: Array.from({ length: 100 }, (_, id) => ({ id })) };

    const snapshot = createPersistentProjectSnapshot(project);
    normalizeCalendarProject(project);

    expect(snapshot.calendarData).toBeNull();
    expect(project.calendarData).toBeNull();
  });

  it("upgrades the former 24 pt date default once without overriding later user choices", () => {
    const project = createBlankCalendarProject(2027);
    const page = createMonthTemplatePageWithPreset("A3", "portrait", 1, 2027, "editorial-photo");
    const grid = page.elements.find((element) => element.type === "calendar-grid");
    if (grid?.type !== "calendar-grid") throw new Error("Expected calendar grid");
    project.document.pages = [page];
    project.layoutRevision = 1;
    grid.showTypikonIcons = undefined;
    grid.dayNumberFontSizePt = 24;
    grid.eventFontSizePt = 8;
    grid.minimumEventFontSizePt = 7;

    normalizeCalendarProject(project);
    expect(grid.dayNumberFontSizePt).toBe(30);
    expect(grid.eventFontSizePt).toBe(10);
    expect(grid.minimumEventFontSizePt).toBe(9);
    expect(grid.showTypikonIcons).toBe(false);
    expect(project.layoutRevision).toBe(5);

    grid.dayNumberFontSizePt = 24;
    grid.eventFontSizePt = 8;
    normalizeCalendarProject(project);
    expect(grid.dayNumberFontSizePt).toBe(24);
    expect(grid.eventFontSizePt).toBe(8);
  });

  it("round-trips a self-contained project archive and accepts legacy project JSON", () => {
    const project = createBlankCalendarProject(2027);
    project.assets.push({
      id: "embedded-font",
      name: "Custom.ttf",
      mimeType: "font/ttf",
      source: "data:font/ttf;base64,AA==",
      kind: "font",
    });
    project.customFonts = [{ assetId: "embedded-font", family: "Custom", fontWeight: 400, fontStyle: "normal" }];
    const archive = createProjectArchive(project);
    expect(archive.manifest.embeddedAssetCount).toBe(1);
    expect(archive.manifest.embeddedFontCount).toBe(1);
    expect(parseProjectArchive(JSON.parse(JSON.stringify(archive)))?.name).toBe(project.name);
    expect(parseProjectArchive(JSON.parse(JSON.stringify(project)))?.name).toBe(project.name);
  });
});
