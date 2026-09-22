import { textShadowOffsets } from "../document/text-effects";

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

/** Flatten SVG drop shadows as ordinary text layers behind any extrusion. */
export function flattenPrintSvgTextShadows(svg: SVGSVGElement): () => void {
  const filters = new Map(Array.from(svg.querySelectorAll<SVGFilterElement>("filter[id]"))
    .map((filter) => [filter.id, filter]));
  const generated: SVGTextElement[] = [];
  const originals: { text: SVGTextElement; filter: string }[] = [];
  for (const text of svg.querySelectorAll<SVGTextElement>("text[filter]")) {
    const reference = /^url\(#([^)]*)\)$/.exec(text.getAttribute("filter") ?? "");
    const drop = reference ? filters.get(reference[1]!)?.querySelector("feDropShadow") : undefined;
    if (!drop || !text.parentElement) continue;
    const filter = text.getAttribute("filter")!;
    const shadow = {
      color: drop.getAttribute("flood-color") ?? "#000000",
      offsetXMm: Number(drop.getAttribute("dx") ?? 0),
      offsetYMm: Number(drop.getAttribute("dy") ?? 0),
      blurMm: Number(drop.getAttribute("stdDeviation") ?? 0) * 2,
      opacity: Number(drop.getAttribute("flood-opacity") ?? 1),
    };
    const computedOpacity = Number(getComputedStyle(text).opacity);
    const opacity = Number.isFinite(computedOpacity) ? computedOpacity : 1;
    const anchor = Array.from(text.parentElement.children).find(
      (child) => child === text || child.classList.contains("large-text-extrusion"),
    ) ?? text;
    for (const offset of textShadowOffsets(shadow)) {
      const layer = text.cloneNode(true) as SVGTextElement;
      layer.removeAttribute("id");
      layer.removeAttribute("filter");
      layer.removeAttribute("data-calendar-date");
      layer.setAttribute("aria-hidden", "true");
      layer.style.removeProperty("filter");
      layer.style.setProperty("fill", shadow.color);
      layer.style.setProperty("stroke", "none");
      layer.style.setProperty("opacity", String(opacity * offset.opacity));
      layer.style.setProperty("pointer-events", "none");
      layer.setAttribute("transform", `translate(${offset.xMm} ${offset.yMm}) ${text.getAttribute("transform") ?? ""}`.trim());
      text.parentElement.insertBefore(layer, anchor);
      generated.push(layer);
    }
    text.removeAttribute("filter");
    originals.push({ text, filter });
  }
  return () => {
    for (const layer of generated) layer.remove();
    for (const { text, filter } of originals) text.setAttribute("filter", filter);
  };
}
