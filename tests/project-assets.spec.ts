import { describe, expect, it } from "vitest";
import { compactProjectAssets } from "../src/document/project-assets";
import { createBlankCalendarProject } from "../src/document/factories";
import { createElementOnOwnLayer } from "../src/editor/element-creation";
import type { ImageElement } from "../src/document/types";

describe("project asset compaction", () => {
  it("retains unplaced library photos and transfers library membership on deduplication", () => {
    const project = createBlankCalendarProject();
    project.assets.push(
      { id: 'first-photo', name: 'a.png', kind: 'image', mimeType: 'image/png', source: 'data:image/png;base64,AQ==' },
      { id: 'library-copy', name: 'b.png', kind: 'image', mimeType: 'image/png', source: 'data:image/png;base64,AQ==', photoLibrary: true },
    );
    compactProjectAssets(project);
    expect(project.assets.find(asset => asset.id === 'first-photo')?.photoLibrary).toBe(true);
    expect(project.assets.some(asset => asset.id === 'library-copy')).toBe(false);
    compactProjectAssets(project);
    expect(project.assets.some(asset => asset.id === 'first-photo')).toBe(true);
  });
  it("remaps duplicate assets and removes assets that are no longer used", () => {
    const project = createBlankCalendarProject();
    const page = project.document.pages[0]!;
    const created = createElementOnOwnLayer(page, "image", { x: 0, y: 0, width: 10, height: 10 });
    const element = created.element as ImageElement;
    project.assets.push(
      { id: "first", name: "first.png", mimeType: "image/png", kind: "image", source: "data:image/png;base64,AA==" },
      { id: "duplicate", name: "copy.png", mimeType: "image/png", kind: "image", source: "data:image/png;base64,AA==" },
      { id: "orphan", name: "old.png", mimeType: "image/png", kind: "image", source: "data:image/png;base64,AQ==" },
    );
    element.assetId = "duplicate";

    expect(compactProjectAssets(project)).toEqual({ deduplicated: 1, removed: 2 });
    expect(element.assetId).toBe("first");
    expect(project.assets.map((asset) => asset.id)).toEqual(["calendar-workshop-brand-logo", "first"]);
  });

  it("keeps assets referenced by project settings and nested masks", () => {
    const project = createBlankCalendarProject();
    const page = project.document.pages[0]!;
    const created = createElementOnOwnLayer(page, "image", { x: 0, y: 0, width: 10, height: 10 });
    const mask = { id: "mask", name: "mask.svg", mimeType: "image/svg+xml", kind: "svg" as const, source: "data:image/svg+xml,mask" };
    const profile = { id: "profile", name: "print.icc", mimeType: "application/vnd.iccprofile", kind: "icc-profile" as const, source: "data:application/octet-stream;base64,AA==" };
    project.assets.push(mask, profile);
    const layer = page.layers.find((item) => item.id === created.layer.id);
    if (!layer || layer.kind !== "layer") throw new Error("Expected layer");
    layer.mask = { enabled: true, assetId: mask.id };
    project.printSettings = { includeCropMarks: true, cropMarkLengthMm: 2, cropMarkOffsetMm: 0.5, iccProfileAssetId: profile.id };

    compactProjectAssets(project);
    expect(project.assets.map((asset) => asset.id).sort()).toEqual(["calendar-workshop-brand-logo", "mask", "profile"]);
  });
});
