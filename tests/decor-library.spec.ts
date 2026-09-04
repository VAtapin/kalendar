import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DECOR_LIBRARY_ITEMS } from "../src/decor/decor-library";

describe("библиотека декоративных SVG", () => {
  it("содержит только уникальные самостоятельные элементы", () => {
    expect(DECOR_LIBRARY_ITEMS).toHaveLength(127);
    expect(new Set(DECOR_LIBRARY_ITEMS.map((item) => item.id)).size).toBe(127);
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
    for (const item of DECOR_LIBRARY_ITEMS) {
      expect(item.aspectRatio).toBeGreaterThan(0);
      expect(item.source.endsWith(".svg")).toBe(true);
      const absolute = path.join(process.cwd(), "public", item.source.replace(/^\//, ""));
      const source = await readFile(absolute, "utf8");
      expect(source).toContain("<svg");
      expect(source).toMatch(/viewBox="[-\d.]+ [-\d.]+ [\d.]+ [\d.]+"/);
    }
  });
});
