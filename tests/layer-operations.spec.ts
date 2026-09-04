import { describe, expect, it } from "vitest";
import { createBlankA3Page } from "../src/document/factories";
import {
  attachElementToLayer,
  createLayerGroup,
  createEmptyLayer,
  flattenObjectLayers,
  groupLayerNodes,
  LayerOperationError,
  moveLayerNode,
  moveLayerNodeToEdge,
  removeLayerNode,
} from "../src/document/layer-operations";
import type { ShapeElement } from "../src/document/types";

function rectangle(id: string): ShapeElement {
  return {
    id,
    type: "shape",
    layerId: "",
    x: 10,
    y: 10,
    width: 40,
    height: 20,
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    overflow: "none",
    shape: "rectangle",
    strokeWidthMm: 0.2,
  };
}

describe("page layers", () => {
  it("allows no more than one object in a layer", () => {
    const page = createBlankA3Page();
    const layer = page.layers[0];
    if (!layer || layer.kind !== "layer") throw new Error("Expected initial object layer");

    attachElementToLayer(page, layer.id, rectangle("rectangle-1"));

    expect(layer.elementId).toBe("rectangle-1");
    expect(page.elements[0]?.layerId).toBe(layer.id);
    expect(() => attachElementToLayer(page, layer.id, rectangle("rectangle-2"))).toThrow(
      LayerOperationError,
    );
  });

  it("supports any number of empty layers", () => {
    const page = createBlankA3Page();
    createEmptyLayer(page, "layer-2");
    createEmptyLayer(page, "layer-3");

    expect(page.layers).toHaveLength(3);
    expect(page.layers.every((layer) => layer.kind === "layer" && !layer.elementId)).toBe(true);
  });

  it("groups layers into collapsible folders while leaves still hold one object", () => {
    const page = createBlankA3Page();
    const second = createEmptyLayer(page, "layer-2");
    const group = groupLayerNodes(page, ["layer-1", second.id], "group-1", "Фотографии");

    expect(page.layers).toHaveLength(1);
    expect(group.children).toHaveLength(2);
    expect(group.expanded).toBe(true);
    expect(group.children.every((node) => node.kind === "layer")).toBe(true);
  });

  it("inherits visibility and locking from a folder", () => {
    const page = createBlankA3Page();
    const group = createLayerGroup(page, "group-1");
    group.visible = false;
    group.locked = true;
    const nested = createEmptyLayer(page, "nested-layer", "Фото", group.id);

    const resolved = flattenObjectLayers(page.layers).find((entry) => entry.layer.id === nested.id);
    expect(resolved?.effectiveVisible).toBe(false);
    expect(resolved?.effectiveLocked).toBe(true);
  });

  it("moves a layer directly to the top and removes its object with the layer", () => {
    const page = createBlankA3Page();
    const second = createEmptyLayer(page, "layer-2");
    const third = createEmptyLayer(page, "layer-3");
    attachElementToLayer(page, second.id, rectangle("rectangle-2"));

    moveLayerNodeToEdge(page, second.id, "front");
    expect(second.order).toBeGreaterThan(third.order);
    expect(removeLayerNode(page, second.id)).toEqual(["rectangle-2"]);
    expect(page.elements).toHaveLength(0);
  });

  it("drops a layer before or after any target instead of moving one step", () => {
    const page = createBlankA3Page();
    const second = createEmptyLayer(page, "layer-2");
    const third = createEmptyLayer(page, "layer-3");
    const fourth = createEmptyLayer(page, "layer-4");

    moveLayerNode(page, second.id, fourth.id, "before");
    let topToBottom = [...page.layers].sort((a, b) => b.order - a.order).map((node) => node.id);
    expect(topToBottom).toEqual([second.id, fourth.id, third.id, "layer-1"]);

    moveLayerNode(page, fourth.id, "layer-1", "after");
    topToBottom = [...page.layers].sort((a, b) => b.order - a.order).map((node) => node.id);
    expect(topToBottom).toEqual([second.id, third.id, "layer-1", fourth.id]);
  });
});
