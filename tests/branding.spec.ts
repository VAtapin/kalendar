import { describe, expect, it } from "vitest";
import {
  BRAND_LOGO_ASSET_ID,
  BRAND_LOGO_LAYER_NAME,
  ensureCalendarWorkshopBranding,
} from "../src/document/branding";
import { createBlankCalendarProject } from "../src/document/factories";
import { flattenObjectLayers } from "../src/document/layer-operations";
import { createCoverTemplatePage } from "../src/templates/calendar-templates";

describe("calendar workshop branding", () => {
  it("restores the compulsory mark and keeps its system layer on top", () => {
    const project = createBlankCalendarProject(2027);
    const cover = createCoverTemplatePage("A3", "portrait", 2027, "Издатель");
    project.document.pages = [cover];
    const logo = cover.elements.find(
      (element) => element.type === "image" && element.assetId === BRAND_LOGO_ASSET_ID,
    );
    if (!logo || logo.type !== "image") throw new Error("Expected workshop logo");
    const layer = cover.layers.find((item) => item.id === logo.layerId);
    if (!layer || layer.kind !== "layer") throw new Error("Expected workshop layer");

    logo.assetId = "another-image";
    logo.opacity = 0;
    logo.visible = false;
    logo.locked = false;
    logo.rotation = 25;
    logo.fit = "fill";
    logo.crop = { x: 0, y: 1, width: 1, height: 1 };
    logo.cornerRadiusMm = 100;
    logo.mask = {
      enabled: true,
      strokes: [{ id: "hide-logo", mode: "hide", sizeMm: 100, points: [{ x: 0.5, y: 0.5 }] }],
    };
    layer.visible = false;
    layer.locked = false;
    layer.protected = false;
    layer.pinnedToFront = false;
    layer.order = -10;

    ensureCalendarWorkshopBranding(project);

    expect(logo).toMatchObject({
      assetId: BRAND_LOGO_ASSET_ID,
      opacity: 1,
      visible: true,
      locked: true,
      rotation: 0,
      fit: "fit",
    });
    expect(layer).toMatchObject({
      name: BRAND_LOGO_LAYER_NAME,
      visible: true,
      locked: true,
      protected: true,
      pinnedToFront: true,
    });
    expect(logo.crop).toBeUndefined();
    expect(logo.cornerRadiusMm).toBeUndefined();
    expect(logo.mask).toBeUndefined();
    expect(flattenObjectLayers(cover.layers).at(-1)?.layer.id).toBe(layer.id);
  });
});
