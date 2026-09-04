import { describe, expect, it } from "vitest";
import { layoutTextBlock } from "../src/layout/text-layout";

const monoMeasure = (text: string) => text.length;

describe("layoutTextBlock", () => {
  it("wraps words and reports vertical overflow", () => {
    const layout = layoutTextBlock("один два три четыре", 8, 2, 1, monoMeasure);
    expect(layout.lines.map((line) => line.text)).toEqual(["один два", "три"]);
    expect(layout.overflow).toBe(true);
  });

  it("preserves explicit paragraph breaks", () => {
    const layout = layoutTextBlock("первая\nвторая", 20, 4, 1, monoMeasure);
    expect(layout.lines.map((line) => line.text)).toEqual(["первая", "вторая"]);
    expect(layout.overflow).toBe(false);
  });

  it("breaks a word which cannot fit a line", () => {
    const layout = layoutTextBlock("длинноеслово", 5, 10, 1, monoMeasure);
    expect(layout.lines.map((line) => line.text)).toEqual(["длинн", "оесло", "во"]);
  });
});
