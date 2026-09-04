import { describe, expect, it } from "vitest";
import { buildRightAlignedLegendLayout } from "../src/layout/legend-layout";

describe("right-aligned legend layout", () => {
  it("packs a short legend against the right edge and leaves space on the left", () => {
    const layout = buildRightAlignedLegendLayout(270, 15, [
      { id: "fish", label: "разрешается рыба" },
      { id: "memorial", label: "поминовение усопших" },
    ]);

    expect(layout.startXMm).toBeGreaterThan(150);
    expect(layout.items[1]!.xMm).toBeCloseTo(
      layout.items[0]!.xMm + layout.items[0]!.widthMm + layout.itemGapMm,
    );
    expect(layout.startXMm + layout.contentWidthMm).toBeCloseTo(270);
  });

  it("keeps even an overfull custom legend inside its frame", () => {
    const layout = buildRightAlignedLegendLayout(45, 8, [
      { id: "fish", label: "разрешается рыба" },
      { id: "oil", label: "пища с маслом" },
      { id: "dry", label: "сухоядение" },
    ]);

    expect(layout.startXMm).toBeGreaterThanOrEqual(0);
    expect(layout.startXMm + layout.contentWidthMm).toBeLessThanOrEqual(45.000_001);
    expect(layout.items.every((item) => item.xMm >= 0)).toBe(true);
  });
});
