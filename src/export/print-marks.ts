import type { PageModel, PrintSettings } from "../document/types";

export interface PrintMarkPoint {
  x: number;
  y: number;
}

export interface PrintMarkSegment {
  start: PrintMarkPoint;
  end: PrintMarkPoint;
}

/**
 * Returns crop marks in trim-box coordinates (millimetres). Negative values
 * occupy the bleed area and therefore never change the document geometry.
 */
export function buildCropMarkSegments(
  page: PageModel,
  settings: PrintSettings,
): PrintMarkSegment[] {
  if (!settings.includeCropMarks) return [];
  const length = Math.max(0.5, settings.cropMarkLengthMm);
  const offset = Math.max(0, settings.cropMarkOffsetMm);
  const left = 0;
  const right = page.width;
  const top = 0;
  const bottom = page.height;
  return [
    { start: { x: left - offset - length, y: top }, end: { x: left - offset, y: top } },
    { start: { x: left, y: top - offset - length }, end: { x: left, y: top - offset } },
    { start: { x: right + offset, y: top }, end: { x: right + offset + length, y: top } },
    { start: { x: right, y: top - offset - length }, end: { x: right, y: top - offset } },
    { start: { x: left - offset - length, y: bottom }, end: { x: left - offset, y: bottom } },
    { start: { x: left, y: bottom + offset }, end: { x: left, y: bottom + offset + length } },
    { start: { x: right + offset, y: bottom }, end: { x: right + offset + length, y: bottom } },
    { start: { x: right, y: bottom + offset }, end: { x: right, y: bottom + offset + length } },
  ];
}

export function cropMarksFitBleed(page: PageModel, settings: PrintSettings): boolean {
  if (!settings.includeCropMarks) return true;
  const required = Math.max(0.5, settings.cropMarkLengthMm) + Math.max(0, settings.cropMarkOffsetMm);
  return Object.values(page.bleed).every((value) => value >= required);
}
