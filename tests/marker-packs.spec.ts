import { describe, expect, it } from "vitest";
import { FOOD_RULES, type FoodRuleId } from "../src/calendar/presentation/fasting";
import {
  FOOD_MARKER_PACKS,
  foodMarkerPackSource,
} from "../src/calendar/presentation/marker-packs";

describe("built-in food marker packs", () => {
  it("contains both user-provided packs with all nine signs", () => {
    const ruleIds = Object.keys(FOOD_RULES).sort() as FoodRuleId[];
    expect(FOOD_MARKER_PACKS.map((pack) => pack.id)).toEqual(["ornamental", "dark"]);
    for (const pack of FOOD_MARKER_PACKS) {
      expect(Object.keys(pack.sources).sort()).toEqual(ruleIds);
      expect(new Set(Object.values(pack.sources)).size).toBe(9);
    }
  });

  it("resolves a stable public asset path for every sign", () => {
    for (const pack of FOOD_MARKER_PACKS) {
      for (const rule of Object.keys(FOOD_RULES) as FoodRuleId[]) {
        expect(foodMarkerPackSource(pack.id, rule)).toMatch(
          new RegExp(`^/assets/markers/${pack.id === "ornamental" ? "ornamental" : "dark"}/.+\\.png$`),
        );
      }
    }
  });
});
