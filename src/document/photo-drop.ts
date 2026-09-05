import type { ImageElement, LayoutElementNode, PageModel } from './types';
import { flattenObjectLayers } from './layer-operations';

/** Only empty, editable photo frames accept a drop. Existing photos remain untouched. */
export function emptyPhotoFrameAt(page: PageModel, point: {x: number; y: number}): ImageElement | undefined {
  const layers = new Map(flattenObjectLayers(page.layers).map(entry => [entry.layer.id, entry]));
  const target = page.elements.filter((element): element is ImageElement => {
    const layer = layers.get(element.layerId);
    if (element.type !== 'image' || !element.visible || (layer && !layer.effectiveVisible)) return false;
    const angle = -(element.rotation ?? 0) * Math.PI / 180;
    const dx = point.x - element.x - element.width / 2;
    const dy = point.y - element.y - element.height / 2;
    const x = dx * Math.cos(angle) - dy * Math.sin(angle);
    const y = dx * Math.sin(angle) + dy * Math.cos(angle);
    return Math.abs(x) <= element.width / 2 && Math.abs(y) <= element.height / 2;
  }).sort((a,b) => (layers.get(b.layerId)?.stackOrder ?? b.zIndex) - (layers.get(a.layerId)?.stackOrder ?? a.zIndex))[0];
  if (!target) return;
  const layer = layers.get(target.layerId);
  return target.assetId || target.locked || layer?.effectiveLocked || layer?.layer.protected ? undefined : target;
}

export function clearPhotoFrameImage(element: LayoutElementNode): boolean {
  if (element.type !== 'image' || !element.photoFrame || !element.assetId) return false;
  element.assetId = ''; element.crop = undefined;
  return true;
}
