import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILT_IN_PRINT_PROFILES } from "../src/export/print-profile";

describe("built-in print profiles", () => {
  it("ships real CMYK printer ICC files for every paper choice", () => {
    for (const profile of BUILT_IN_PRINT_PROFILES) {
      const file = new URL(`../public${profile.url}`, import.meta.url);
      const bytes = readFileSync(file);
      expect(bytes.length).toBeGreaterThan(128);
      expect(bytes.readUInt32BE(0)).toBe(bytes.length);
      expect(bytes.toString("ascii", 12, 16)).toBe("prtr");
      expect(bytes.toString("ascii", 16, 20)).toBe("CMYK");
      expect(bytes.toString("ascii", 36, 40)).toBe("acsp");
    }
  });
});
