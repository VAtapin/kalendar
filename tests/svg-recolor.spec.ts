import { describe, expect, it } from "vitest";
import { recolorSvgMarkup, svgMarkupDataUrl } from "../src/decor/svg-recolor";

describe("перекрашивание SVG", () => {
  it("меняет реальные заливки и обводки, сохраняя none и url", () => {
    const source = `<svg><g fill="#000000" stroke="none"><path style="fill:#111;stroke:url(#ink)"/><circle stroke="#222"/></g></svg>`;
    const result = recolorSvgMarkup(source, "#b51f2e");
    expect(result).toContain('fill="#b51f2e"');
    expect(result).toContain('stroke="none"');
    expect(result).toContain("fill:#b51f2e");
    expect(result).toContain("stroke:url(#ink)");
    expect(result).toContain('stroke="#b51f2e"');
  });

  it("создаёт переносимый data URL без внешнего doctype", () => {
    const result = svgMarkupDataUrl(`<?xml version="1.0"?><!DOCTYPE svg PUBLIC "x" "y"><svg fill="#000"/>`);
    expect(result.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(result)).not.toContain("DOCTYPE");
    expect(decodeURIComponent(result)).toContain("<svg");
  });
});
