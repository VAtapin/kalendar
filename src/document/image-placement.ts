import type { ImageCrop } from "./types";

export interface ImagePlacementFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImagePlacement extends ImagePlacementFrame {
  clipped: boolean;
}

export function clampUnit(value: number | undefined, fallback = 0.5): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value!)) : fallback;
}

export function normalizedImageCrop(crop: ImageCrop | undefined): ImageCrop {
  return {
    x: clampUnit(crop?.x),
    y: clampUnit(crop?.y),
    width: 1,
    height: 1,
  };
}

/**
 * Calculates image geometry in a top-left coordinate system. Crop focus is
 * independent of the object frame and therefore survives resizing/rotation.
 */
export function calculateImagePlacement(
  frame: ImagePlacementFrame,
  intrinsicWidth: number,
  intrinsicHeight: number,
  fit: "fill" | "fit" | "crop",
  crop?: ImageCrop,
): ImagePlacement {
  const width = Math.max(0.0001, frame.width);
  const height = Math.max(0.0001, frame.height);
  const sourceWidth = Math.max(0.0001, intrinsicWidth);
  const sourceHeight = Math.max(0.0001, intrinsicHeight);
  if (fit === "fill") return { ...frame, width, height, clipped: false };

  const scale = fit === "crop"
    ? Math.max(width / sourceWidth, height / sourceHeight)
    : Math.min(width / sourceWidth, height / sourceHeight);
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  const focus = normalizedImageCrop(crop);
  const x = fit === "crop"
    ? frame.x - Math.max(0, drawnWidth - width) * focus.x
    : frame.x + (width - drawnWidth) / 2;
  const y = fit === "crop"
    ? frame.y - Math.max(0, drawnHeight - height) * focus.y
    : frame.y + (height - drawnHeight) / 2;
  return { x, y, width: drawnWidth, height: drawnHeight, clipped: fit === "crop" };
}
