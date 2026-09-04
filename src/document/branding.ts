import { findLayerLocation } from "./layer-operations";
import type {
  CalendarProject,
  DocumentAsset,
  ImageElement,
  LayoutElementNode,
  PageModel,
  PageObjectLayer,
} from "./types";

export const BRAND_LOGO_ASSET_ID = "calendar-workshop-brand-logo";
export const BRAND_LOGO_SOURCE = "/brand/logo-kalendar.png";
export const BRAND_LOGO_WIDTH_PX = 1476;
export const BRAND_LOGO_HEIGHT_PX = 1066;
export const BRAND_LOGO_HEIGHT_RATIO = BRAND_LOGO_HEIGHT_PX / BRAND_LOGO_WIDTH_PX;
export const BRAND_LOGO_LAYER_NAME = "Фирменный знак Календарной мастерской";

function brandLogoFrame(page: PageModel): Pick<ImageElement, "x" | "y" | "width" | "height"> {
  const width = page.width * (page.kind === "cover" ? 0.26 : 0.16);
  const height = width * BRAND_LOGO_HEIGHT_RATIO;
  const inset = Math.max(4, page.safeArea.right * 0.55);
  return {
    x: page.kind === "cover" ? (page.width - width) / 2 : page.width - width - inset,
    y: page.height - height - Math.max(4, page.safeArea.bottom * 0.55),
    width,
    height,
  };
}

export function createBrandLogoAsset(): DocumentAsset {
  return {
    id: BRAND_LOGO_ASSET_ID,
    name: "Календарная мастерская — фирменный знак",
    mimeType: "image/png",
    source: BRAND_LOGO_SOURCE,
    kind: "image",
    widthPx: BRAND_LOGO_WIDTH_PX,
    heightPx: BRAND_LOGO_HEIGHT_PX,
  };
}

function addBrandLogoToPage(page: PageModel): void {
  const frame = brandLogoFrame(page);
  const layerId = `layer-${page.id}-calendar-workshop-brand`;
  const elementId = `element-${page.id}-calendar-workshop-brand`;
  page.layers.push({
    id: layerId,
    kind: "layer",
    name: BRAND_LOGO_LAYER_NAME,
    order: Math.max(-1, ...page.layers.map((layer) => layer.order)) + 1,
    visible: true,
    locked: true,
    color: "#c9a548",
    protected: true,
    pinnedToFront: true,
    elementId,
  });
  const element: ImageElement = {
    id: elementId,
    type: "image",
    layerId,
    ...frame,
    rotation: 0,
    zIndex: Math.max(-1, ...page.elements.map((item) => item.zIndex)) + 1,
    locked: true,
    visible: true,
    overflow: "none",
    opacity: 1,
    assetId: BRAND_LOGO_ASSET_ID,
    fit: "fit",
  };
  page.elements.push(element);
}

function isBrandLayerMarker(page: PageModel, layerId: string): boolean {
  const layer = findLayerLocation(page, layerId)?.node;
  return Boolean(
    layer?.kind === "layer" &&
    (layer.name === BRAND_LOGO_LAYER_NAME || layer.id.includes("calendar-workshop-brand")),
  );
}

/** True for the compulsory workshop mark, including its fixed system layer. */
export function isCalendarWorkshopBrandElement(
  page: PageModel,
  element: LayoutElementNode | undefined,
): boolean {
  return Boolean(
    element?.type === "image" &&
    (element.assetId === BRAND_LOGO_ASSET_ID || isBrandLayerMarker(page, element.layerId)),
  );
}

/** The protected leaf and any parent folders that must not be moved or removed. */
export function calendarWorkshopBrandProtectedLayerIds(page: PageModel): string[] {
  const element = page.elements.find((item) => isCalendarWorkshopBrandElement(page, item));
  if (!element) return [];
  const location = findLayerLocation(page, element.layerId);
  if (!location) return [];
  return [location.node.id, ...location.ancestors.map((group) => group.id)];
}

function createBrandLayer(page: PageModel, elementId: string): PageObjectLayer {
  const layer: PageObjectLayer = {
    id: `layer-${page.id}-calendar-workshop-brand`,
    kind: "layer",
    name: BRAND_LOGO_LAYER_NAME,
    order: Math.max(-1, ...page.layers.map((item) => item.order)) + 1,
    visible: true,
    locked: true,
    color: "#c9a548",
    protected: true,
    pinnedToFront: true,
    elementId,
  };
  page.layers.push(layer);
  return layer;
}

function placeBrandLayerOnTop(page: PageModel, layer: PageObjectLayer): void {
  const location = findLayerLocation(page, layer.id);
  const highestOtherOrder = Math.max(
    -1,
    ...page.layers.filter((node) => node.id !== layer.id).map((node) => node.order),
  );
  if (location?.siblings === page.layers && location.ancestors.length === 0 && layer.order > highestOtherOrder) {
    return;
  }
  if (location) location.siblings.splice(location.siblings.indexOf(location.node), 1);
  const remaining = [...page.layers].sort((left, right) => left.order - right.order);
  remaining.forEach((node, index) => (node.order = index));
  layer.order = remaining.length;
  page.layers.splice(0, page.layers.length, ...remaining, layer);
}

function restoreBrandElement(page: PageModel, element: ImageElement): void {
  const previousLayer = findLayerLocation(page, element.layerId)?.node;
  let brandLayer = previousLayer?.kind === "layer" ? previousLayer : undefined;
  if (!brandLayer || !isBrandLayerMarker(page, brandLayer.id)) {
    if (previousLayer?.kind === "layer" && previousLayer.elementId === element.id) {
      previousLayer.elementId = undefined;
    }
    brandLayer = createBrandLayer(page, element.id);
  }

  Object.assign(element, brandLogoFrame(page), {
    type: "image" as const,
    layerId: brandLayer.id,
    rotation: 0,
    zIndex: Math.max(-1, ...page.elements.filter((item) => item.id !== element.id).map((item) => item.zIndex)) + 1,
    locked: true,
    visible: true,
    overflow: "none" as const,
    opacity: 1,
    assetId: BRAND_LOGO_ASSET_ID,
    fit: "fit" as const,
  });
  element.crop = undefined;
  element.cornerRadiusMm = undefined;
  element.mask = undefined;
  Object.assign(brandLayer, {
    name: BRAND_LOGO_LAYER_NAME,
    visible: true,
    locked: true,
    color: "#c9a548",
    protected: true,
    pinnedToFront: true,
    elementId: element.id,
  });
  placeBrandLayerOnTop(page, brandLayer);
}

/** Keeps the compulsory workshop mark intact before persistence and export. */
export function ensureCalendarWorkshopBranding(project: CalendarProject): void {
  const asset = project.assets.find((item) => item.id === BRAND_LOGO_ASSET_ID);
  if (asset) Object.assign(asset, createBrandLogoAsset());
  else project.assets.push(createBrandLogoAsset());
  project.publisherProfile.logoAssetId = BRAND_LOGO_ASSET_ID;

  const target = project.document.pages.find((page) => page.kind === "cover") ?? project.document.pages[0];
  if (!target) return;
  const existing = target.elements.find(
    (element): element is ImageElement => element.type === "image" && isBrandLayerMarker(target, element.layerId),
  ) ?? target.elements.find(
    (element): element is ImageElement => element.type === "image" && element.assetId === BRAND_LOGO_ASSET_ID,
  );
  if (!existing) addBrandLogoToPage(target);
  else restoreBrandElement(target, existing);
}
