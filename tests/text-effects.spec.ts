import { describe, expect, it } from "vitest";
import {
  createDefaultTextExtrusion,
  createDefaultTextShadow,
  normalizedTextShadow,
  textExtrusionOffsets,
  textShadowOffsets,
} from "../src/document/text-effects";

describe("large text effects", () => {
  it("creates independent printable defaults", () => {
    const left = createDefaultTextShadow();
    const right = createDefaultTextShadow();
    left.offsetXMm = 9;
    expect(right.offsetXMm).toBe(1);
    expect(createDefaultTextExtrusion().depthMm).toBeGreaterThan(0);
  });

  it("keeps the requested extrusion depth with a bounded layer count", () => {
    const offsets = textExtrusionOffsets({
      color: "#70430f",
      depthMm: 24,
      angleDeg: 0,
      opacity: 0.8,
    });
    expect(offsets).toHaveLength(36);
    expect(offsets[0]?.xMm).toBeCloseTo(24, 5);
    expect(offsets.at(-1)?.xMm).toBeGreaterThan(0);
  });

  it("normalizes invalid shadow values without moving valid offsets", () => {
    expect(normalizedTextShadow({
      color: "#123456",
      offsetXMm: -3,
      offsetYMm: 4,
      blurMm: -5,
      opacity: 9,
    })).toEqual({
      color: "#123456",
      offsetXMm: -3,
      offsetYMm: 4,
      blurMm: 0,
      opacity: 1,
    });
  });

  it("uses the same nine shadow layers for vector and flattened print text", () => {
    const offsets = textShadowOffsets({ color: "#000000", offsetXMm: 1, offsetYMm: 2, blurMm: 0.9, opacity: 0.42 });
    expect(offsets).toHaveLength(9);
    expect(offsets[0]?.xMm).toBe(1);
    expect(offsets[0]?.yMm).toBe(2);
    expect(offsets[0]?.opacity).toBeCloseTo(0.14);
    expect(offsets[1]?.xMm).toBeCloseTo(0.37);
    expect(offsets[4]?.yMm).toBeCloseTo(2.63);
  });
});
