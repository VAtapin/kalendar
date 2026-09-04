import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FOOD_RULES, type FoodRuleId } from "../src/calendar/presentation/fasting";
import {
  FOOD_MARKER_PACKS,
  foodMarkerPackSource,
} from "../src/calendar/presentation/marker-packs";

describe("built-in food marker packs", () => {
  it("contains every installed pack with all rule mappings", () => {
    const ruleIds = Object.keys(FOOD_RULES).sort() as FoodRuleId[];
    expect(FOOD_MARKER_PACKS).toHaveLength(16);
    for (const pack of FOOD_MARKER_PACKS) {
      expect(Object.keys(pack.sources).sort()).toEqual(ruleIds);
      expect(new Set(Object.values(pack.sources)).size).toBe(9);
    }
  });

  it("resolves a stable public asset path for every sign", () => {
    for (const pack of FOOD_MARKER_PACKS) {
      for (const rule of Object.keys(FOOD_RULES) as FoodRuleId[]) {
        const source = foodMarkerPackSource(pack.id, rule);
        expect(source).toMatch(/^\/assets\/markers\/.+\.png$/);
        if (rule !== "no-fast") expect(source).toContain(`/markers/${pack.id}/`);
      }
    }
  });

  it("has all visible PNG files and no exact duplicates between the 14 imported packs", async () => {
    const imported = FOOD_MARKER_PACKS.slice(2);
    const fingerprints = new Set<string>();
    for (const pack of imported) {
      for (const rule of Object.keys(FOOD_RULES) as FoodRuleId[]) {
        if (rule === "no-fast") continue;
        const publicPath = resolve(
          import.meta.dirname,
          "..",
          "public",
          foodMarkerPackSource(pack.id, rule).replace(/^\//, ""),
        );
        const bytes = await readFile(publicPath);
        const fingerprint = createHash("sha256").update(bytes).digest("hex");
        expect(fingerprints.has(fingerprint), `${pack.id}/${rule}`).toBe(false);
        fingerprints.add(fingerprint);
      }
    }
    expect(fingerprints.size).toBe(112);
  });
});
