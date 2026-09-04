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

function transparentPixelRatio(data: Buffer): number {
  let transparent = 0;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] === 0) transparent += 1;
  }
  return transparent / (data.length / 4);
}

function averageGold(data: Buffer): [number, number, number] {
  let count = 0;
  const sum: [number, number, number] = [0, 0, 0];
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const alpha = data[index + 3] ?? 0;
    if (alpha > 128 && red > green && green > blue && red - blue > 45) {
      sum[0] += red;
      sum[1] += green;
      sum[2] += blue;
      count += 1;
    }
  }
  expect(count).toBeGreaterThan(0);
  return sum.map((channel) => channel / count) as [number, number, number];
}

describe("библиотека декоративных элементов", () => {
  it("содержит только уникальные самостоятельные элементы", () => {
    expect(DECOR_LIBRARY_ITEMS).toHaveLength(149);
    expect(new Set(DECOR_LIBRARY_ITEMS.map((item) => item.id)).size).toBe(149);
    expect(new Set(DECOR_LIBRARY_ITEMS.map((item) => item.source)).size).toBe(149);
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

  it("содержит 22 прозрачных золотых PNG с реальными 300 dpi", async () => {
    expect(imageItems).toHaveLength(22);
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
      expect(transparentPixelRatio(png.data)).toBeGreaterThan(0.25);
      expect(pngDensity(source)).toEqual({
        x: pixelsPerMetreAt300Dpi,
        y: pixelsPerMetreAt300Dpi,
        unit: 1,
      });
    }
    expect(contentHashes.size).toBe(imageItems.length);
  });

  it("держит новые золотые объекты в палитре исходной коллекции", async () => {
    const palettes = await Promise.all(imageItems.map(async (item) => {
      const absolute = path.join(process.cwd(), "public", item.source.replace(/^\//, ""));
      return averageGold(PNG.sync.read(await readFile(absolute)).data);
    }));
    const reference: [number, number, number] = [
      palettes.slice(0, 18).reduce((sum, color) => sum + color[0], 0) / 18,
      palettes.slice(0, 18).reduce((sum, color) => sum + color[1], 0) / 18,
      palettes.slice(0, 18).reduce((sum, color) => sum + color[2], 0) / 18,
    ];

    for (const color of palettes.slice(18)) {
      const distance = Math.hypot(
        color[0] - reference[0],
        color[1] - reference[1],
        color[2] - reference[2],
      );
      expect(distance).toBeLessThan(24);
    }
  });
});
