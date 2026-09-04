import { describe, expect, it } from "vitest";
import { hasRoundedCorners, resolvedCornerRadii } from "../src/document/corner-radii";

describe("object corner radii", () => {
  it("uses one shared value while corners are linked", () => {
    expect(resolvedCornerRadii({ width: 100, height: 60, cornerRadiusMm: 12 })).toEqual({
      topLeft: 12,
      topRight: 12,
      bottomRight: 12,
      bottomLeft: 12,
    });
  });

  it("keeps four independent values and clamps them to the frame", () => {
    const element = {
      width: 40,
      height: 20,
      cornerRadiusMm: 3,
      cornerRadiiMm: { topLeft: 2, topRight: 4, bottomRight: 30, bottomLeft: 0 },
    };
    expect(resolvedCornerRadii(element)).toEqual({
      topLeft: 2,
      topRight: 4,
      bottomRight: 10,
      bottomLeft: 0,
    });
    expect(hasRoundedCorners(element)).toBe(true);
  });
});
