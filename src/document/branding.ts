import type { CalendarProject, DocumentAsset, ImageElement, PageModel } from "./types";

export const BRAND_LOGO_ASSET_ID = "calendar-workshop-brand-logo";
export const BRAND_LOGO_SOURCE = "/brand/logo-kalendar.png";
export const BRAND_LOGO_WIDTH_PX = 1476;
export const BRAND_LOGO_HEIGHT_PX = 1066;
export const BRAND_LOGO_HEIGHT_RATIO = BRAND_LOGO_HEIGHT_PX / BRAND_LOGO_WIDTH_PX;

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
  const width = page.width * (page.kind === "cover" ? 0.26 : 0.16);
  const height = width * BRAND_LOGO_HEIGHT_RATIO;
  const inset = Math.max(4, page.safeArea.right * 0.55);
  const layerId = `layer-${page.id}-calendar-workshop-brand`;
  const elementId = `element-${page.id}-calendar-workshop-brand`;
  page.layers.push({
    id: layerId,
    kind: "layer",
    name: "Фирменный знак Календарной мастерской",
    order: page.layers.length,
    visible: true,
    locked: true,
    color: "#c9a548",
    elementId,
  });
  const element: ImageElement = {
    id: elementId,
    type: "image",
    layerId,
    x: page.kind === "cover" ? (page.width - width) / 2 : page.width - width - inset,
    y: page.height - height - Math.max(4, page.safeArea.bottom * 0.55),
    width,
    height,
    rotation: 0,
    zIndex: page.elements.length,
    locked: true,
    visible: true,
    overflow: "none",
    opacity: 1,
    assetId: BRAND_LOGO_ASSET_ID,
    fit: "fit",
  };
  page.elements.push(element);
}

/**
 * The monastery distributes calendars made with this editor under a common
 * mark. Re-applying this before sharing/export also restores the mark if an
 * older project predates branding support.
 */
export function ensureCalendarWorkshopBranding(project: CalendarProject): void {
  const asset = project.assets.find((item) => item.id === BRAND_LOGO_ASSET_ID);
  if (asset) Object.assign(asset, createBrandLogoAsset());
  else project.assets.push(createBrandLogoAsset());
  project.publisherProfile.logoAssetId = BRAND_LOGO_ASSET_ID;

  const target = project.document.pages.find((page) => page.kind === "cover") ?? project.document.pages[0];
  if (!target) return;
  const existing = target.elements.find(
    (element): element is ImageElement => element.type === "image" && element.assetId === BRAND_LOGO_ASSET_ID,
  );
  if (!existing) addBrandLogoToPage(target);
  else {
    existing.visible = true;
    existing.locked = true;
    const layer = target.layers.find((item) => item.id === existing.layerId);
    if (layer) {
      layer.visible = true;
      layer.locked = true;
    }
  }
}
