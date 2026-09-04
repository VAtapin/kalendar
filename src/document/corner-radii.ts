import type { CornerRadiiMm } from "./types";

export interface CornerRadiusElement {
  width: number;
  height: number;
  cornerRadiusMm?: number;
  cornerRadiiMm?: CornerRadiiMm;
}

function finiteRadius(value: number | undefined, maximum: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(value ?? 0, maximum)) : 0;
}

export function resolvedCornerRadii(element: CornerRadiusElement): CornerRadiiMm {
  const maximum = Math.max(0, Math.min(element.width, element.height) / 2);
  const shared = finiteRadius(element.cornerRadiusMm, maximum);
  const individual = element.cornerRadiiMm;
  return {
    topLeft: finiteRadius(individual?.topLeft ?? shared, maximum),
    topRight: finiteRadius(individual?.topRight ?? shared, maximum),
    bottomRight: finiteRadius(individual?.bottomRight ?? shared, maximum),
    bottomLeft: finiteRadius(individual?.bottomLeft ?? shared, maximum),
  };
}

export function hasRoundedCorners(element: CornerRadiusElement): boolean {
  return Object.values(resolvedCornerRadii(element)).some((radius) => radius > 0);
}
