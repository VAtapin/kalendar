import type { LayoutElementNode, PageModel } from "../document/types";
import type { ElementFrame } from "./element-creation";

export interface GroupGeometrySnapshot {
  frame: ElementFrame;
  elements: Array<{
    id: string;
    frame: ElementFrame;
    fontSizePt?: number;
    paddingMm?: number;
  }>;
}

function frameOf(element: LayoutElementNode): ElementFrame {
  return {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };
}

/** Returns one visible frame around every printable object in a layer group. */
export function groupBounds(elements: readonly LayoutElementNode[]): ElementFrame | undefined {
  if (!elements.length) return undefined;
  const left = Math.min(...elements.map((element) => element.x));
  const top = Math.min(...elements.map((element) => element.y));
  const right = Math.max(...elements.map((element) => element.x + element.width));
  const bottom = Math.max(...elements.map((element) => element.y + element.height));
  return { x: left, y: top, width: Math.max(.2, right - left), height: Math.max(.2, bottom - top) };
}

/** Captures geometry once at the start of a drag, so pointer updates never compound rounding errors. */
export function snapshotGroupGeometry(elements: readonly LayoutElementNode[]): GroupGeometrySnapshot | undefined {
  const frame = groupBounds(elements);
  if (!frame) return undefined;
  return {
    frame,
    elements: elements.map((element) => ({
      id: element.id,
      frame: frameOf(element),
      ...(element.type === "text" || element.type === "month-text"
        ? {
            fontSizePt: element.typography.fontSizePt,
            paddingMm: element.typography.paddingMm,
          }
        : {}),
    })),
  };
}

/**
 * Moves or scales every object in a group into a new outer frame.
 * Text keeps its own layer but follows the group and scales its typography with it.
 */
export function applyGroupGeometry(
  page: PageModel,
  snapshot: GroupGeometrySnapshot,
  target: ElementFrame,
): void {
  const scaleX = Math.max(.001, target.width) / Math.max(.2, snapshot.frame.width);
  const scaleY = Math.max(.001, target.height) / Math.max(.2, snapshot.frame.height);
  const typographyScale = Math.sqrt(scaleX * scaleY);

  for (const original of snapshot.elements) {
    const element = page.elements.find((candidate) => candidate.id === original.id);
    if (!element) continue;
    element.x = target.x + (original.frame.x - snapshot.frame.x) * scaleX;
    element.y = target.y + (original.frame.y - snapshot.frame.y) * scaleY;
    element.width = Math.max(.2, original.frame.width * scaleX);
    element.height = Math.max(.2, original.frame.height * scaleY);
    if ((element.type === "text" || element.type === "month-text") && original.fontSizePt !== undefined) {
      element.typography.fontSizePt = Math.max(1, original.fontSizePt * typographyScale);
      if (original.paddingMm !== undefined) element.typography.paddingMm = Math.max(0, original.paddingMm * typographyScale);
    }
  }
}
