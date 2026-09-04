import { describe, expect, it } from "vitest";
import {
  TYPIKON_MARKERS,
  typikonMarkerPdfSource,
  typikonMarkerSvgSource,
} from "../src/calendar/presentation/typikon-markers";

describe("built-in typikon marker images", () => {
  it("uses the five supplied SVG drawings and their PDF raster copies", () => {
    const kinds = ["great", "vigil", "polyeleos", "doxology", "six_stichera"] as const;
    expect(Object.keys(TYPIKON_MARKERS)).toEqual(kinds);
    for (const kind of kinds) {
      expect(typikonMarkerSvgSource(kind)).toMatch(/^\/assets\/typikon\/.+\.svg$/);
      expect(typikonMarkerPdfSource(kind)).toMatch(/^\/assets\/typikon\/.+\.png$/);
    }
    expect(new Set(kinds.map(typikonMarkerSvgSource)).size).toBe(5);
    expect(new Set(kinds.map(typikonMarkerPdfSource)).size).toBe(5);
  });
});
