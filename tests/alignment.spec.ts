import { describe, expect, it } from "vitest";
import { alignElements, distributeElements } from "../src/editor/alignment";
import { createBlankPage } from "../src/document/factories";
import { createElementOnOwnLayer } from "../src/editor/element-creation";

function elements() {
  const page = createBlankPage();
  return [
    createElementOnOwnLayer(page, "rectangle", { x: 10, y: 20, width: 10, height: 10 }).element,
    createElementOnOwnLayer(page, "rectangle", { x: 40, y: 40, width: 20, height: 20 }).element,
    createElementOnOwnLayer(page, "rectangle", { x: 90, y: 80, width: 10, height: 10 }).element,
  ];
}

describe("object alignment", () => {
  it("aligns selected objects to their common right edge", () => {
    const items = elements();
    alignElements(items, "right");
    expect(items.map((item) => item.x + item.width)).toEqual([100, 100, 100]);
  });

  it("distributes three objects horizontally between the outside edges", () => {
    const items = elements();
    distributeElements(items, "horizontal");
    expect(items[0]?.x).toBe(10);
    expect(items[1]?.x).toBe(45);
    expect(items[2]?.x).toBe(90);
  });
});
