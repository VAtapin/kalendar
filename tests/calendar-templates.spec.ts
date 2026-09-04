import { describe, expect, it } from "vitest";
import {
  CALENDAR_TEMPLATE_PRESETS,
  createFullCalendarTemplate,
  createMonthTemplatePageWithPreset,
  requiredMonthWeekRows,
} from "../src/templates/calendar-templates";
import { flattenObjectLayers } from "../src/document/layer-operations";
import { BRAND_LOGO_ASSET_ID, BRAND_LOGO_LAYER_NAME } from "../src/document/branding";
import { createElementOnOwnLayer } from "../src/editor/element-creation";

describe("calendar templates", () => {
  it("creates a cover and twelve independent month pages", () => {
    const pages = createFullCalendarTemplate("A3", "portrait", 2027, "Издатель");
    expect(pages).toHaveLength(13);
    expect(pages[0]?.kind).toBe("cover");
    expect(pages[1]?.kind).toBe("month");
    expect(pages[12]?.name).toContain("Декабрь");
  });

  it("locks the monastery wordmark onto every generated calendar cover", () => {
    const cover = createFullCalendarTemplate("A3", "portrait", 2027, "Издатель")[0];
    if (!cover) throw new Error("Expected cover");
    const wordmark = cover?.elements.find(
      (element) => element.type === "image" && element.assetId === BRAND_LOGO_ASSET_ID,
    );
    expect(wordmark).toMatchObject({ type: "image", locked: true, visible: true });
    expect(cover.layers.find((layer) => layer.id === wordmark?.layerId)).toMatchObject({
      name: BRAND_LOGO_LAYER_NAME,
      locked: true,
      visible: true,
      protected: true,
      pinnedToFront: true,
    });
    expect(flattenObjectLayers(cover.layers).at(-1)?.layer.id).toBe(wordmark?.layerId);

    createElementOnOwnLayer(cover, "rectangle", { x: 10, y: 10, width: 30, height: 30 });
    expect(flattenObjectLayers(cover.layers).at(-1)?.layer.id).toBe(wordmark?.layerId);
  });

  it("keeps every template object on its own layer", () => {
    const page = createFullCalendarTemplate("A4", "landscape", 2027, "Издатель")[1];
    if (!page) throw new Error("Expected January page");
    const layers = flattenObjectLayers(page.layers);
    expect(layers).toHaveLength(page.elements.length);
    expect(layers.every((entry) => Boolean(entry.layer.elementId))).toBe(true);
  });

  it("offers three templates with distinct calendar treatments", () => {
    expect(CALENDAR_TEMPLATE_PRESETS).toHaveLength(3);
    const styles = CALENDAR_TEMPLATE_PRESETS.map((preset) => {
      const page = createMonthTemplatePageWithPreset("A3", "portrait", 9, 2027, preset.id);
      const grid = page.elements.find((element) => element.type === "calendar-grid");
      return grid?.type === "calendar-grid" ? grid.gridStyle : undefined;
    });
    expect(styles).toEqual(["editorial", "boxed", "minimal"]);
  });

  it("uses only the required week rows and does not reserve space for a quote", () => {
    expect(requiredMonthWeekRows(2027, 2)).toBe(4);
    expect(requiredMonthWeekRows(2027, 1)).toBe(5);
    expect(requiredMonthWeekRows(2027, 5)).toBe(6);
    const february = createMonthTemplatePageWithPreset("A3", "portrait", 2, 2027, "editorial-photo");
    const january = createMonthTemplatePageWithPreset("A3", "portrait", 1, 2027, "editorial-photo");
    const may = createMonthTemplatePageWithPreset("A3", "portrait", 5, 2027, "editorial-photo");
    const rows = [february, january, may].map((page) => {
      const grid = page.elements.find((element) => element.type === "calendar-grid");
      return grid?.type === "calendar-grid" ? grid.weekRows : undefined;
    });
    expect(rows).toEqual([4, 5, 6]);
    expect([february, january, may].every(
      (page) => page.elements.every((element) => element.type !== "month-text"),
    )).toBe(true);
  });

  it("uses a large date number and keeps even the compact template readable", () => {
    const editorial = createMonthTemplatePageWithPreset("A3", "portrait", 9, 2027, "editorial-photo");
    const compact = createMonthTemplatePageWithPreset("A3", "portrait", 9, 2027, "photo-feature");
    const editorialGrid = editorial.elements.find((element) => element.type === "calendar-grid");
    const compactGrid = compact.elements.find((element) => element.type === "calendar-grid");
    expect(editorialGrid?.type === "calendar-grid" ? editorialGrid.dayNumberFontSizePt : 0).toBe(30);
    expect(editorialGrid?.type === "calendar-grid" ? editorialGrid.eventFontSizePt : 0).toBe(10);
    expect(compactGrid?.type === "calendar-grid" ? compactGrid.dayNumberFontSizePt : 0).toBeGreaterThanOrEqual(26);
    expect(compactGrid?.type === "calendar-grid" ? compactGrid.eventFontSizePt : 0).toBeGreaterThanOrEqual(8.5);
  });
});
