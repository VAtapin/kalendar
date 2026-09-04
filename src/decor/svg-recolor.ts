const RECOLORABLE_PAINT = /^(?!none$|transparent$|inherit$|currentcolor$|context-fill$|context-stroke$|url\().+/i;

function replacePaint(value: string, color: string): string {
  return RECOLORABLE_PAINT.test(value.trim()) ? color : value;
}

/** Recolours monochrome library SVGs while preserving transparency and paint servers. */
export function recolorSvgMarkup(svg: string, color: string): string {
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : "#17201d";
  return svg
    .replace(
      /((?:fill|stroke|stop-color|flood-color)\s*=\s*["'])([^"']+)(["'])/gi,
      (_, prefix: string, value: string, suffix: string) => `${prefix}${replacePaint(value, safeColor)}${suffix}`,
    )
    .replace(
      /((?:fill|stroke|stop-color|flood-color)\s*:\s*)([^;}]+)/gi,
      (_, prefix: string, value: string) => `${prefix}${replacePaint(value, safeColor)}`,
    );
}

export function svgMarkupDataUrl(svg: string): string {
  const clean = svg
    .replace(/<\?xml[\s\S]*?\?>\s*/i, "")
    .replace(/<!DOCTYPE[\s\S]*?>\s*/i, "");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clean)}`;
}
