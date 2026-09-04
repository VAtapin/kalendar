import type {
  DocumentModel,
  LayoutElementNode,
  PageInsets,
  PageModel,
} from "../document/types";
import { flattenObjectLayers } from "../document/layer-operations";

export interface SceneBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageScene {
  mediaBox: SceneBox;
  trimBox: SceneBox;
  safeBox: SceneBox;
  elements: LayoutElementNode[];
}

function insetBox(width: number, height: number, insets: PageInsets): SceneBox {
  return {
    x: insets.left,
    y: insets.top,
    width: width - insets.left - insets.right,
    height: height - insets.top - insets.bottom,
  };
}

/**
 * Produces a UI-independent print scene. SVG preview and future PDF exporters
 * consume this structure; Vue and the DOM are never the document model.
 */
export function buildPageScene(page: PageModel): PageScene {
  const layerById = new Map(
    flattenObjectLayers(page.layers).map((entry) => [entry.layer.id, entry]),
  );

  return {
    mediaBox: {
      x: -page.bleed.left,
      y: -page.bleed.top,
      width: page.width + page.bleed.left + page.bleed.right,
      height: page.height + page.bleed.top + page.bleed.bottom,
    },
    trimBox: { x: 0, y: 0, width: page.width, height: page.height },
    safeBox: insetBox(page.width, page.height, page.safeArea),
    elements: [...page.elements]
      .filter((element) => {
        const entry = layerById.get(element.layerId);
        return (
          element.visible &&
          entry?.effectiveVisible === true &&
          entry.layer.elementId === element.id
        );
      })
      .sort((left, right) => {
        const leftLayerOrder = layerById.get(left.layerId)?.stackOrder ?? 0;
        const rightLayerOrder = layerById.get(right.layerId)?.stackOrder ?? 0;
        return leftLayerOrder - rightLayerOrder || left.zIndex - right.zIndex;
      }),
  };
}

export interface DocumentRenderer<TOutput> {
  render(document: DocumentModel): TOutput | Promise<TOutput>;
}
