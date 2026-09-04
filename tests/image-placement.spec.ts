import { describe, expect, it } from "vitest";
import { calculateImagePlacement, normalizedImageCrop } from "../src/document/image-placement";

describe("image placement", () => {
  it("moves a cropped landscape image from the left edge to the right edge", () => {
    const frame = { x: 10, y: 20, width: 100, height: 100 };
    const left = calculateImagePlacement(frame, 200, 100, "crop", { x: 0, y: 0.5, width: 1, height: 1 });
    const right = calculateImagePlacement(frame, 200, 100, "crop", { x: 1, y: 0.5, width: 1, height: 1 });

    expect(left).toMatchObject({ x: 10, y: 20, width: 200, height: 100, clipped: true });
    expect(right).toMatchObject({ x: -90, y: 20, width: 200, height: 100, clipped: true });
  });

  it("moves a cropped portrait image vertically and clamps saved focus", () => {
    const frame = { x: 0, y: 0, width: 100, height: 100 };
    const bottom = calculateImagePlacement(frame, 100, 200, "crop", { x: 0.5, y: 1, width: 1, height: 1 });

    expect(bottom).toMatchObject({ x: 0, y: -100, width: 100, height: 200, clipped: true });
    expect(normalizedImageCrop({ x: -4, y: 8, width: 0.2, height: 0.2 })).toEqual({ x: 0, y: 1, width: 1, height: 1 });
  });

  it("keeps fit mode centred and fill mode exact", () => {
    const frame = { x: 10, y: 20, width: 100, height: 100 };
    expect(calculateImagePlacement(frame, 200, 100, "fit")).toMatchObject({ x: 10, y: 45, width: 100, height: 50, clipped: false });
    expect(calculateImagePlacement(frame, 200, 100, "fill")).toEqual({ ...frame, clipped: false });
  });
});
