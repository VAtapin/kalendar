<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type {
  DocumentAsset,
  ImageElement,
  LayerMask,
  LayoutElementNode,
  PageModel,
  SvgElement,
} from "../document/types";
import { calculateImagePlacement } from "../document/image-placement";
import { flattenObjectLayers } from "../document/layer-operations";

const props = defineProps<{
  page: PageModel;
  assets: DocumentAsset[];
  year: number;
}>();

const canvas = ref<HTMLCanvasElement>();
const isVisible = ref(false);
const longEdgePx = 152;
const canvasWidth = computed(() => Math.max(48, Math.round(longEdgePx * props.page.width / Math.max(props.page.width, props.page.height))));
const canvasHeight = computed(() => Math.max(48, Math.round(longEdgePx * props.page.height / Math.max(props.page.width, props.page.height))));
const bitmapCache = new Map<string, { source: string; bitmap: ImageBitmap }>();
let observer: IntersectionObserver | undefined;
let renderTimer: number | undefined;
let renderRevision = 0;

function drawPlaceholder(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.fillStyle = "#f6f3e9";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#b9aa7d";
  context.lineWidth = 1;
  context.strokeRect(0.5, 0.5, width - 1, height - 1);
}

async function bitmapForAsset(asset: DocumentAsset): Promise<ImageBitmap | undefined> {
  const cached = bitmapCache.get(asset.id);
  if (cached?.source === asset.source) return cached.bitmap;
  try {
    const blob = await fetch(asset.source).then((response) => response.blob());
    const originalWidth = Math.max(1, asset.widthPx ?? 256);
    const originalHeight = Math.max(1, asset.heightPx ?? 256);
    const scale = Math.min(1, 256 / Math.max(originalWidth, originalHeight));
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: Math.max(1, Math.round(originalWidth * scale)),
      resizeHeight: Math.max(1, Math.round(originalHeight * scale)),
      resizeQuality: "high",
    });
    cached?.bitmap.close();
    bitmapCache.set(asset.id, { source: asset.source, bitmap });
    return bitmap;
  } catch {
    return undefined;
  }
}

function drawBitmapInFrame(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  element: ImageElement | SvgElement,
  scaleX: number,
  scaleY: number,
): void {
  const x = element.x * scaleX;
  const y = element.y * scaleY;
  const width = Math.max(1, element.width * scaleX);
  const height = Math.max(1, element.height * scaleY);
  const placement = calculateImagePlacement(
    { x, y, width, height },
    bitmap.width,
    bitmap.height,
    element.type === "image" ? element.fit : "fit",
    element.type === "image" ? element.crop : undefined,
  );
  context.drawImage(bitmap, placement.x, placement.y, placement.width, placement.height);
}

function applyElementRotation(
  context: CanvasRenderingContext2D,
  element: LayoutElementNode,
  scaleX: number,
  scaleY: number,
): void {
  if (!element.rotation) return;
  const centerX = (element.x + element.width / 2) * scaleX;
  const centerY = (element.y + element.height / 2) * scaleY;
  context.translate(centerX, centerY);
  context.rotate((element.rotation * Math.PI) / 180);
  context.translate(-centerX, -centerY);
}

function elementNeedsMask(element: LayoutElementNode, layerMask: LayerMask | undefined): boolean {
  return (element.cornerRadiusMm ?? 0) > 0 ||
    (element.type === "image" && element.fit === "crop") ||
    Boolean(layerMask?.enabled !== false && layerMask?.assetId);
}

function drawElementMask(
  context: CanvasRenderingContext2D,
  element: LayoutElementNode,
  maskBitmap: ImageBitmap | undefined,
  scaleX: number,
  scaleY: number,
): void {
  const x = element.x * scaleX;
  const y = element.y * scaleY;
  const width = element.width * scaleX;
  const height = element.height * scaleY;
  const radius = Math.max(0, Math.min(
    (element.cornerRadiusMm ?? 0) * (scaleX + scaleY) / 2,
    width / 2,
    height / 2,
  ));
  context.save();
  applyElementRotation(context, element, scaleX, scaleY);
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.clip();
  context.fillStyle = maskBitmap ? "#000" : "#fff";
  context.fillRect(x, y, width, height);
  if (maskBitmap) {
    const placement = calculateImagePlacement(
      { x, y, width, height },
      maskBitmap.width,
      maskBitmap.height,
      "fit",
    );
    context.drawImage(maskBitmap, placement.x, placement.y, placement.width, placement.height);
  }
  context.restore();
  if (maskBitmap) {
    const pixels = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const luminance = (
        (pixels.data[index] ?? 0) * 0.2126 +
        (pixels.data[index + 1] ?? 0) * 0.7152 +
        (pixels.data[index + 2] ?? 0) * 0.0722
      ) / 255;
      pixels.data[index] = 255;
      pixels.data[index + 1] = 255;
      pixels.data[index + 2] = 255;
      pixels.data[index + 3] = Math.round((pixels.data[index + 3] ?? 0) * luminance);
    }
    context.putImageData(pixels, 0, 0);
  }
}

function drawElementContent(
  context: CanvasRenderingContext2D,
  element: LayoutElementNode,
  bitmap: ImageBitmap | undefined,
  scaleX: number,
  scaleY: number,
): void {
  if (element.type === "image" || element.type === "svg") {
    if (bitmap) drawBitmapInFrame(context, bitmap, element, scaleX, scaleY);
  } else if (element.type === "text" || element.type === "month-text") drawText(context, element, scaleX, scaleY);
  else if (element.type === "calendar-grid") drawCalendarGrid(context, element, scaleX, scaleY);
  else if (element.type === "shape") drawShape(context, element, scaleX, scaleY);
  else if (element.type === "legend") {
    context.strokeStyle = "#ad9b6b";
    context.strokeRect(element.x * scaleX, element.y * scaleY, element.width * scaleX, element.height * scaleY);
  }
}

function drawText(context: CanvasRenderingContext2D, element: Extract<LayoutElementNode, { type: "text" | "month-text" }>, scaleX: number, scaleY: number): void {
  const fontSize = Math.max(3, Math.min(17, element.typography.fontSizePt * scaleY * 0.36));
  context.fillStyle = element.typography.color ?? "#17201d";
  context.font = `${element.typography.fontWeight ?? 400} ${fontSize}px Georgia, serif`;
  context.textBaseline = "top";
  const x = element.x * scaleX;
  const y = element.y * scaleY;
  const width = element.width * scaleX;
  context.save();
  context.beginPath();
  context.rect(x, y, width, Math.max(2, element.height * scaleY));
  context.clip();
  const measured = context.measureText(element.content.title).width;
  const textX = element.typography.align === "center"
    ? x + (width - measured) / 2
    : element.typography.align === "right"
      ? x + width - measured
      : x;
  context.fillText(element.content.title, textX, y);
  context.restore();
}

function drawCalendarGrid(context: CanvasRenderingContext2D, element: Extract<LayoutElementNode, { type: "calendar-grid" }>, scaleX: number, scaleY: number): void {
  const x = element.x * scaleX;
  const y = element.y * scaleY;
  const width = element.width * scaleX;
  const height = element.height * scaleY;
  const headerHeight = element.showWeekdayHeader ? Math.min(7, height * 0.1) : 0;
  const rowHeight = (height - headerHeight) / element.weekRows;
  const columnWidth = width / 7;
  context.fillStyle = "rgb(255 255 255 / 70%)";
  context.fillRect(x, y, width, height);
  context.strokeStyle = "#8e9892";
  context.lineWidth = 0.55;
  context.beginPath();
  if (headerHeight) {
    context.moveTo(x, y + headerHeight);
    context.lineTo(x + width, y + headerHeight);
  }
  for (let row = 1; row <= element.weekRows; row += 1) {
    context.moveTo(x, y + headerHeight + row * rowHeight);
    context.lineTo(x + width, y + headerHeight + row * rowHeight);
  }
  if (element.gridStyle === "boxed") {
    for (let column = 1; column < 7; column += 1) {
      context.moveTo(x + column * columnWidth, y);
      context.lineTo(x + column * columnWidth, y + height);
    }
  }
  context.stroke();
  if (headerHeight) {
    context.fillStyle = "#29332f";
    context.font = "bold 3.5px Georgia, serif";
    for (let column = 0; column < 7; column += 1) {
      context.fillText(["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][column] ?? "", x + column * columnWidth + 1, y + 1);
    }
  }
  const firstWeekday = (new Date(Date.UTC(props.year, element.month - 1, 1)).getUTCDay() + 6) % 7;
  const dayCount = new Date(Date.UTC(props.year, element.month, 0)).getUTCDate();
  context.font = "bold 4.5px Georgia, serif";
  for (let day = 1; day <= dayCount; day += 1) {
    const slot = firstWeekday + day - 1;
    const column = slot % 7;
    const row = Math.floor(slot / 7);
    if (row >= element.weekRows) break;
    context.fillStyle = column === 6 ? "#b22b2b" : "#17201d";
    context.fillText(String(day), x + column * columnWidth + 1, y + headerHeight + row * rowHeight + 1);
    context.fillStyle = column === 6 ? "#c9766d" : "#a2aaa5";
    context.fillRect(x + column * columnWidth + 1, y + headerHeight + row * rowHeight + 7, Math.max(2, columnWidth - 4), 0.7);
  }
}

function drawShape(context: CanvasRenderingContext2D, element: Extract<LayoutElementNode, { type: "shape" }>, scaleX: number, scaleY: number): void {
  const x = element.x * scaleX;
  const y = element.y * scaleY;
  const width = element.width * scaleX;
  const height = element.height * scaleY;
  context.fillStyle = element.fillColor ?? "transparent";
  context.strokeStyle = element.strokeColor ?? "#17201d";
  context.lineWidth = Math.max(0.5, element.strokeWidthMm * (scaleX + scaleY) / 2);
  context.beginPath();
  if (element.shape === "ellipse") context.ellipse(x + width / 2, y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
  else if (element.shape === "line") {
    context.moveTo(x, element.lineDirection === "up" ? y + height : y);
    context.lineTo(x + width, element.lineDirection === "up" ? y : y + height);
  } else context.rect(x, y, width, height);
  if (element.shape !== "line") context.fill();
  context.stroke();
}

async function renderThumbnail(): Promise<void> {
  if (!isVisible.value) return;
  const revision = ++renderRevision;
  await nextTick();
  const target = canvas.value;
  const context = target?.getContext("2d");
  if (!target || !context) return;
  drawPlaceholder(context, target.width, target.height);
  const assetElements = props.page.elements.filter(
    (element): element is ImageElement | SvgElement => element.visible && (element.type === "image" || element.type === "svg"),
  );
  const bitmaps = new Map<string, ImageBitmap>();
  const layerMasksByElementId = new Map<string, LayerMask>();
  for (const { layer } of flattenObjectLayers(props.page.layers)) {
    const mask = layer.mask;
    if (layer.elementId && mask?.enabled !== false && mask) layerMasksByElementId.set(layer.elementId, mask);
  }
  const maskBitmaps = new Map<string, ImageBitmap>();
  await Promise.all(assetElements.map(async (element) => {
    const asset = props.assets.find((item) => item.id === element.assetId);
    if (!asset) return;
    const bitmap = await bitmapForAsset(asset);
    if (bitmap) bitmaps.set(element.id, bitmap);
  }));
  await Promise.all([...layerMasksByElementId.values()].map(async (mask) => {
    const asset = props.assets.find((item) => item.id === mask.assetId);
    if (!asset) return;
    const bitmap = await bitmapForAsset(asset);
    if (bitmap) maskBitmaps.set(mask.assetId, bitmap);
  }));
  if (revision !== renderRevision) return;
  drawPlaceholder(context, target.width, target.height);
  const scaleX = target.width / props.page.width;
  const scaleY = target.height / props.page.height;
  const elementCanvas = document.createElement("canvas");
  const maskCanvas = document.createElement("canvas");
  elementCanvas.width = maskCanvas.width = target.width;
  elementCanvas.height = maskCanvas.height = target.height;
  const elementContext = elementCanvas.getContext("2d");
  const maskContext = maskCanvas.getContext("2d");
  if (!elementContext || !maskContext) return;
  for (const element of [...props.page.elements].filter((item) => item.visible).sort((left, right) => left.zIndex - right.zIndex)) {
    elementContext.clearRect(0, 0, target.width, target.height);
    maskContext.clearRect(0, 0, target.width, target.height);
    elementContext.save();
    elementContext.globalAlpha = Math.max(0, Math.min(1, element.opacity ?? 1));
    applyElementRotation(elementContext, element, scaleX, scaleY);
    drawElementContent(elementContext, element, bitmaps.get(element.id), scaleX, scaleY);
    elementContext.restore();
    const layerMask = layerMasksByElementId.get(element.id);
    if (elementNeedsMask(element, layerMask)) {
      drawElementMask(maskContext, element, layerMask ? maskBitmaps.get(layerMask.assetId) : undefined, scaleX, scaleY);
      elementContext.save();
      elementContext.globalCompositeOperation = "destination-in";
      elementContext.drawImage(maskCanvas, 0, 0);
      elementContext.restore();
    }
    context.drawImage(elementCanvas, 0, 0);
  }
}

function scheduleRender(): void {
  if (!isVisible.value) return;
  if (renderTimer !== undefined) window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => void renderThumbnail(), 90);
}

onMounted(() => {
  if (!canvas.value || typeof IntersectionObserver === "undefined") {
    isVisible.value = true;
    scheduleRender();
    return;
  }
  observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    isVisible.value = true;
    observer?.disconnect();
    scheduleRender();
  }, { rootMargin: "100px" });
  observer.observe(canvas.value);
});

watch(() => props.page, scheduleRender, { deep: true });
watch(() => [props.assets.length, props.year], scheduleRender);

onBeforeUnmount(() => {
  observer?.disconnect();
  if (renderTimer !== undefined) window.clearTimeout(renderTimer);
});
</script>

<template>
  <canvas
    ref="canvas"
    class="page-thumbnail"
    :class="{ 'page-thumbnail--landscape': page.orientation === 'landscape' }"
    :width="canvasWidth"
    :height="canvasHeight"
    aria-hidden="true"
  ></canvas>
</template>
