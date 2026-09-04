import type { LayoutElementNode } from "../document/types";

export type AlignMode = "left" | "horizontal-center" | "right" | "top" | "vertical-center" | "bottom";
export type DistributeMode = "horizontal" | "vertical";

export function alignElements(elements: LayoutElementNode[], mode: AlignMode): void {
  if (elements.length < 2) return;
  const left = Math.min(...elements.map((element) => element.x));
  const top = Math.min(...elements.map((element) => element.y));
  const right = Math.max(...elements.map((element) => element.x + element.width));
  const bottom = Math.max(...elements.map((element) => element.y + element.height));
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  for (const element of elements) {
    if (mode === "left") element.x = left;
    if (mode === "horizontal-center") element.x = centerX - element.width / 2;
    if (mode === "right") element.x = right - element.width;
    if (mode === "top") element.y = top;
    if (mode === "vertical-center") element.y = centerY - element.height / 2;
    if (mode === "bottom") element.y = bottom - element.height;
  }
}

export function distributeElements(elements: LayoutElementNode[], mode: DistributeMode): void {
  if (elements.length < 3) return;
  if (mode === "horizontal") {
    const sorted = [...elements].sort((a, b) => a.x - b.x);
    const first = sorted[0]!;
    const last = sorted.at(-1)!;
    const span = last.x + last.width - first.x;
    const content = sorted.reduce((total, element) => total + element.width, 0);
    const gap = (span - content) / (sorted.length - 1);
    let cursor = first.x;
    for (const element of sorted) {
      element.x = cursor;
      cursor += element.width + gap;
    }
    return;
  }
  const sorted = [...elements].sort((a, b) => a.y - b.y);
  const first = sorted[0]!;
  const last = sorted.at(-1)!;
  const span = last.y + last.height - first.y;
  const content = sorted.reduce((total, element) => total + element.height, 0);
  const gap = (span - content) / (sorted.length - 1);
  let cursor = first.y;
  for (const element of sorted) {
    element.y = cursor;
    cursor += element.height + gap;
  }
}
