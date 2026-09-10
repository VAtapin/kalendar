import { describe, expect, it } from "vitest";
import { createBlankA3Page } from "../src/document/factories";
import { createElementOnOwnLayer } from "../src/editor/element-creation";
import { applyGroupGeometry, groupBounds, snapshotGroupGeometry } from "../src/editor/group-geometry";

describe("icon group geometry", () => {
  it("moves the image and its caption as one group", () => {
    const page = createBlankA3Page();
    let sequence = 0;
    const id = () => String(++sequence);
    const image = createElementOnOwnLayer(page, "image", { x: 10, y: 20, width: 100, height: 100 }, { idFactory: id }).element;
    const caption = createElementOnOwnLayer(page, "text", { x: 10, y: 121, width: 100, height: 10 }, { idFactory: id }).element;
    const snapshot = snapshotGroupGeometry([image, caption]);
    if (!snapshot) throw new Error("Expected icon group snapshot");

    applyGroupGeometry(page, snapshot, { x: 30, y: 40, width: 100, height: 111 });

    expect(groupBounds(page.elements)).toEqual({ x: 30, y: 40, width: 100, height: 111 });
    expect(image).toMatchObject({ x: 30, y: 40, width: 100, height: 100 });
    expect(caption).toMatchObject({ x: 30, y: 141, width: 100, height: 10 });
  });

  it("scales the caption frame and type together with the image", () => {
    const page = createBlankA3Page();
    let sequence = 0;
    const id = () => String(++sequence);
    const image = createElementOnOwnLayer(page, "image", { x: 10, y: 20, width: 100, height: 100 }, { idFactory: id }).element;
    const caption = createElementOnOwnLayer(page, "text", { x: 10, y: 121, width: 100, height: 10 }, { idFactory: id }).element;
    if (caption.type !== "text") throw new Error("Expected text caption");
    const originalFontSize = caption.typography.fontSizePt;
    const snapshot = snapshotGroupGeometry([image, caption]);
    if (!snapshot) throw new Error("Expected icon group snapshot");

    applyGroupGeometry(page, snapshot, { x: 30, y: 40, width: 200, height: 222 });

    expect(groupBounds(page.elements)).toEqual({ x: 30, y: 40, width: 200, height: 222 });
    expect(image).toMatchObject({ x: 30, y: 40, width: 200, height: 200 });
    expect(caption).toMatchObject({ x: 30, y: 242, width: 200, height: 20 });
    expect(caption.typography.fontSizePt).toBe(originalFontSize * 2);
  });
});
