import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { DECOR_LIBRARY_ITEMS } from "../src/decor/decor-library";

const svgItems = DECOR_LIBRARY_ITEMS.filter((item) => item.kind !== "image");
const imageItems = DECOR_LIBRARY_ITEMS.filter((item) => item.kind === "image");

function pngDensity(source: Buffer): { x: number; y: number; unit: number } | undefined {
  let offset = 8;
  while (offset < source.length) {
    const length = source.readUInt32BE(offset);
    const type = source.toString("ascii", offset + 4, offset + 8);
    if (type === "pHYs") {
      return {
        x: source.readUInt32BE(offset + 8),
        y: source.readUInt32BE(offset + 12),
        unit: source.readUInt8(offset + 16),
      };
    }
    offset += length + 12;
  }
  return undefined;
}

function hasTransparentPixel(data: Buffer): boolean {
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] === 0) return true;
  }
  return false;
}

describe("библиотека декоративных элементов", () => {
  it("содержит только уникальные самостоятельные элементы", () => {
    expect(DECOR_LIBRARY_ITEMS).toHaveLength(145);
    expect(new Set(DECOR_LIBRARY_ITEMS.map((item) => item.id)).size).toBe(145);
    expect(new Set(DECOR_LIBRARY_ITEMS.map((item) => item.source)).size).toBe(145);
    expect(DECOR_LIBRARY_ITEMS.some((item) => item.sourceId === "47040")).toBe(false);
    expect(DECOR_LIBRARY_ITEMS.some((item) => item.sourceId === "2031234 (1)")).toBe(false);
  });

  it("делит листы на ожидаемое число элементов", () => {
    const count = (sourceId: string) => DECOR_LIBRARY_ITEMS.filter((item) => item.sourceId === sourceId).length;
    expect(count("43842")).toBe(2);
    expect(count("782469")).toBe(5);
    expect(count("2465163")).toBe(8);
    expect(count("2465361")).toBe(4);
    expect(count("3151525")).toBe(29);
  });

  it("указывает существующий SVG с корректной геометрией", async () => {
    expect(svgItems).toHaveLength(127);
    for (const item of svgItems) {
      expect(item.aspectRatio).toBeGreaterThan(0);
      expect(item.source.endsWith(".svg")).toBe(true);
      const absolute = path.join(process.cwd(), "public", item.source.replace(/^\//, ""));
      const source = await readFile(absolute, "utf8");
      expect(source).toContain("<svg");
      expect(source).toMatch(/viewBox="[-\d.]+ [-\d.]+ [\d.]+ [\d.]+"/);
    }
  });

  it("содержит 18 прозрачных золотых PNG с реальными 300 dpi", async () => {
    expect(imageItems).toHaveLength(18);
    const pixelsPerMetreAt300Dpi = Math.round(300 / 0.0254);
    const contentHashes = new Set<string>();
    for (const item of imageItems) {
      expect(item.nominalDpi).toBe(300);
      expect(item.source.endsWith(".png")).toBe(true);
      const absolute = path.join(process.cwd(), "public", item.source.replace(/^\//, ""));
      const source = await readFile(absolute);
      contentHashes.add(createHash("sha256").update(source).digest("hex"));
      const png = PNG.sync.read(source);
      expect(png.width).toBe(item.widthPx);
      expect(png.height).toBe(item.heightPx);
      expect(hasTransparentPixel(png.data)).toBe(true);
      expect(pngDensity(source)).toEqual({
        x: pixelsPerMetreAt300Dpi,
        y: pixelsPerMetreAt300Dpi,
        unit: 1,
      });
    }
    expect(contentHashes.size).toBe(imageItems.length);
  });
});
