import { describe, expect, it } from "vitest";
import { createBlankA3Page } from "../src/document/factories";
import { createElementOnOwnLayer } from "../src/editor/element-creation";

describe("editor element creation", () => {
  it("creates every object on a separate page layer", () => {
    const page = createBlankA3Page();
    let sequence = 0;
    const id = () => String(++sequence);

    const text = createElementOnOwnLayer(page, "text", { x: 10, y: 20, width: 50, height: 25 }, { idFactory: id });
    const image = createElementOnOwnLayer(page, "image", { x: 30, y: 50, width: 90, height: 70 }, { idFactory: id });

    expect(text.layer.elementId).toBe(text.element.id);
    expect(image.layer.elementId).toBe(image.element.id);
    expect(text.layer.id).not.toBe(image.layer.id);
    expect(page.elements).toHaveLength(2);
  });

  it("creates the expected publishing object type", () => {
    const page = createBlankA3Page();
    let sequence = 0;
    const id = () => String(++sequence);
    const created = createElementOnOwnLayer(
      page,
      "calendar-grid",
      { x: 10, y: 100, width: 277, height: 180 },
      { idFactory: id },
    );

    expect(created.element.type).toBe("calendar-grid");
    expect(created.layer.name).toBe("Календарная сетка");
    expect(created.element.type === "calendar-grid" && created.element.showTypikonIcons).toBe(false);
  });
});
