import { describe, expect, it } from "vitest";
import {
  PRINT_GOLD_COLOR,
  createGoldGradient,
  gradientColorAt,
  normalizedOpacity,
} from "../src/document/paint";

describe("document paint", () => {
  it("provides a three-stop metallic gold preset", () => {
    const gradient = createGoldGradient();

    expect(PRINT_GOLD_COLOR).toBe("#d4af37");
    expect(new Set([gradient.startColor, gradient.centerColor, gradient.endColor]).size).toBe(3);
    expect(gradient.centerColor).toBe("#ffe7a0");
  });

  it("interpolates both halves of the gradient", () => {
    const gradient = createGoldGradient();

    expect(gradientColorAt(gradient, 0)).toEqual({
      red: 122 / 255,
      green: 74 / 255,
      blue: 0,
    });
    const center = gradientColorAt(gradient, 0.5);
    expect(center.red).toBeCloseTo(1);
    expect(center.green).toBeCloseTo(231 / 255);
    expect(center.blue).toBeCloseTo(160 / 255);
    const end = gradientColorAt(gradient, 1);
    expect(end.red).toBeCloseTo(183 / 255);
    expect(end.green).toBeCloseTo(121 / 255);
    expect(end.blue).toBeCloseTo(31 / 255);
  });

  it("clamps opacity to the printable 0–1 range", () => {
    expect(normalizedOpacity(undefined)).toBe(1);
    expect(normalizedOpacity(-0.2)).toBe(0);
    expect(normalizedOpacity(0.42)).toBe(0.42);
    expect(normalizedOpacity(2)).toBe(1);
  });
});
