import { describe, expect, it } from "vitest";
import { createBlankPage } from "../src/document/factories";
import { buildCropMarkSegments, cropMarksFitBleed } from "../src/export/print-marks";

describe("print crop marks", () => {
  it("places eight marks outside the A3 trim box", () => {
    const page = createBlankPage("A3", "portrait");
    const settings = { includeCropMarks: true, cropMarkLengthMm: 2, cropMarkOffsetMm: 0.5 };
    const marks = buildCropMarkSegments(page, settings);

    expect(marks).toHaveLength(8);
    expect(marks[0]).toEqual({ start: { x: -2.5, y: 0 }, end: { x: -0.5, y: 0 } });
    expect(marks[7]).toEqual({ start: { x: 297, y: 420.5 }, end: { x: 297, y: 422.5 } });
    expect(cropMarksFitBleed(page, settings)).toBe(true);
  });

  it("warns when marks do not fit the available bleed", () => {
    const page = createBlankPage("A4", "portrait");
    expect(cropMarksFitBleed(page, {
      includeCropMarks: true,
      cropMarkLengthMm: 4,
      cropMarkOffsetMm: 0.5,
    })).toBe(false);
  });
});
