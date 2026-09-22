/** SVG preview styling lives in the app stylesheet; make it self-contained for canvas capture. */
export function inlinePrintSvgStyles(svg: SVGSVGElement): void {
  const properties = [
    "fill", "fill-opacity", "stroke", "stroke-opacity", "stroke-width", "stroke-dasharray",
    "stroke-linecap", "stroke-linejoin", "opacity", "font-family", "font-size", "font-weight",
    "font-style", "letter-spacing", "text-anchor", "dominant-baseline", "display", "visibility",
    "vector-effect", "paint-order", "color", "background-color",
  ];
  for (const element of [svg, ...svg.querySelectorAll<SVGElement>("*")]) {
    const computed = getComputedStyle(element);
    for (const property of properties) {
      const value = computed.getPropertyValue(property);
      if (value) element.style.setProperty(property, value);
    }
  }
}
