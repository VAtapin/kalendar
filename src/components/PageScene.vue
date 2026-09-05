<script setup lang="ts">
import { computed, ref } from "vue";
import FoodMarker from "./FoodMarker.vue";
import { FASTING_COLORS } from '../calendar/presentation/fasting-colors';
import TypikonRankMarker from "./TypikonRankMarker.vue";
import type {
  CalendarGridElement,
  CalendarLanguage,
  DocumentAsset,
  ImageElement,
  LargeTextEffects,
  LayerMask,
  LayoutElementNode,
  MonthTextElement,
  PageModel,
  ShapeElement,
  TextElement,
} from "../document/types";
import {
  calendarMonasteryEventLabel,
  calendarOldStylePrefix,
  calendarWeekdayLabels,
  localizedTextTitle,
} from "../calendar/localization/calendar-language";
import { calculateImagePlacement } from "../document/image-placement";
import { hasRoundedCorners, resolvedCornerRadii } from "../document/corner-radii";
import { normalizedOpacity } from "../document/paint";
import {
  normalizedTextShadow,
  textExtrusionOffsets,
} from "../document/text-effects";
import type { EditorTool } from "../editor/types";
import type { ElementFrame } from "../editor/element-creation";
import { flattenObjectLayers } from "../document/layer-operations";
import { buildPageScene } from "../rendering/page-scene";
import type { OrthodoxCalendarYear } from "../calendar";
import type { FastingProfileId } from "../calendar/fasting/fasting-api";
import {
  dayNumberTypikonStyle,
  eventTypikonStyle,
  typikonMarkForEvent,
} from "../calendar/presentation/typikon-style";
import {
  FOOD_RULES,
  foodRuleLegendLabel,
  resolveFoodRule,
  usedFoodRulesForMonths,
  type FoodRuleId,
} from "../calendar/presentation/fasting";
import {
  foodMarkerPackPreviewSource,
  type FoodMarkerPackId,
} from "../calendar/presentation/marker-packs";
import {
  buildCalendarGridLayout,
  calendarFoodMarkerGeometry,
  calendarCellTypography,
  layoutCalendarCellTextAutoFit,
  type CalendarGridCellLayout,
  type CalendarGridLayout,
} from "../layout/calendar-grid-layout";
import { layoutTextBlock, type TextBlockLayout } from "../layout/text-layout";
import { buildRightAlignedLegendLayout } from "../layout/legend-layout";

interface Point {
  x: number;
  y: number;
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type GeometryInteraction =
  | {
      kind: "move";
      elementId: string;
      pointerStart: Point;
      original: ElementFrame;
    }
  | {
      kind: "resize";
      elementId: string;
      handle: ResizeHandle;
      original: ElementFrame;
    };

const props = defineProps<{
  page: PageModel;
  assets: DocumentAsset[];
  foodMarkerPackId?: FoodMarkerPackId;
  foodMarkerAssets?: Partial<Record<FoodRuleId, string>>;
  fastingProfileId?: FastingProfileId;
  calendarLanguage?: CalendarLanguage;
  calendarYear?: OrthodoxCalendarYear;
  pixelsPerMm: number;
  showGuides: boolean;
  activeTool: EditorTool;
  selectedElementId?: string;
}>();

const emit = defineEmits<{
  create: [tool: EditorTool, frame: ElementFrame];
  select: [elementId: string | undefined];
  geometryStart: [];
  updateGeometry: [elementId: string, frame: ElementFrame];
  geometryEnd: [];
}>();

const svg = ref<SVGSVGElement>();
const dragStart = ref<Point>();
const dragEnd = ref<Point>();
const geometryInteraction = ref<GeometryInteraction>();
const scene = computed(() => buildPageScene(props.page));
const assetById = computed(() => new Map(props.assets.map((asset) => [asset.id, asset])));
const layerMaskByElementId = computed(() => {
  const masks = new Map<string, LayerMask>();
  for (const { layer } of flattenObjectLayers(props.page.layers)) {
    const mask = layer.mask;
    if (layer.elementId && mask?.enabled !== false && mask && assetById.value.has(mask.assetId)) {
      masks.set(layer.elementId, mask);
    }
  }
  return masks;
});
const calendarLayouts = computed(() => {
  const layouts = new Map<string, CalendarGridLayout>();
  if (!props.calendarYear) return layouts;
  for (const element of scene.value.elements) {
    if (element.type === "calendar-grid") {
      layouts.set(element.id, buildCalendarGridLayout(element, props.calendarYear));
    }
  }
  return layouts;
});
const effectivelyLockedElementIds = computed(() => {
  const result = new Set<string>();
  for (const entry of flattenObjectLayers(props.page.layers)) {
    if (entry.effectiveLocked && entry.layer.elementId) result.add(entry.layer.elementId);
  }
  return result;
});
interface LegendPreviewItem {
  id: string;
  label: string;
  color: string;
  foodRule?: FoodRuleId;
  colorSwatch?: boolean;
}
const legendPreviewItems = computed<LegendPreviewItem[]>(() => {
  const items: LegendPreviewItem[] = [];
  const calendar = props.calendarYear;
  if (!calendar) return items;
  const grids = scene.value.elements.filter(
    (element): element is CalendarGridElement => element.type === "calendar-grid",
  );
  const months = new Set(grids.map((grid) => grid.month));
  if (calendar.days.some((day) => months.has(day.date.month) && day.events.some((event) => event.styleToken === "monastery-feast"))) {
    items.push({ id: "monastery", label: calendarMonasteryEventLabel(props.calendarLanguage), color: "#8a641b" });
  }
  const useColors = grids.some(grid => grid.showFastingColors);
  const foodRules = grids.some((grid) => grid.showFoodIcons || grid.showFastingColors)
    ? usedFoodRulesForMonths(calendar.days, months, props.fastingProfileId)
    : new Set<FoodRuleId>();
  for (const rule of Object.values(FOOD_RULES)) {
    if ((useColors || rule.id !== "no-fast") && foodRules.has(rule.id)) {
      items.push({ id: rule.id, label: foodRuleLegendLabel(rule.id, props.calendarLanguage), color: useColors ? FASTING_COLORS[rule.id] : rule.color, foodRule: useColors ? undefined : rule.id, colorSwatch: useColors });
    }
  }
  return items;
});
const viewBox = computed(() => {
  const box = scene.value.mediaBox;
  return `${box.x} ${box.y} ${box.width} ${box.height}`;
});
const draftFrame = computed<ElementFrame | undefined>(() => {
  if (!dragStart.value || !dragEnd.value) return undefined;
  return normalizeFrame(dragStart.value, dragEnd.value);
});

const creationTools = new Set<EditorTool>([
  "text",
  "image",
  "rectangle",
  "ellipse",
  "line",
  "svg",
  "calendar-grid",
]);

function toDocumentPoint(event: PointerEvent, clampToPage = true): Point | undefined {
  const root = svg.value;
  const matrix = root?.getScreenCTM();
  if (!root || !matrix) return undefined;
  const point = root.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(matrix.inverse());
  return clampToPage
    ? {
        x: Math.min(props.page.width, Math.max(0, transformed.x)),
        y: Math.min(props.page.height, Math.max(0, transformed.y)),
      }
    : { x: transformed.x, y: transformed.y };
}

function normalizeFrame(start: Point, end: Point): ElementFrame {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function defaultFrame(tool: EditorTool, origin: Point): ElementFrame {
  const sizes: Partial<Record<EditorTool, { width: number; height: number }>> = {
    text: { width: 55, height: 24 },
    image: { width: 90, height: 65 },
    rectangle: { width: 45, height: 30 },
    ellipse: { width: 40, height: 30 },
    line: { width: 45, height: 0.2 },
    svg: { width: 35, height: 35 },
    "calendar-grid": { width: Math.max(40, props.page.width - 20), height: 175 },
  };
  const size = sizes[tool] ?? { width: 40, height: 30 };
  const x = tool === "calendar-grid"
    ? Math.max(0, (props.page.width - size.width) / 2)
    : Math.min(origin.x, props.page.width - size.width);
  return {
    x,
    y: Math.min(origin.y, props.page.height - size.height),
    width: size.width,
    height: size.height,
  };
}

function beginCreation(event: PointerEvent): void {
  if (!creationTools.has(props.activeTool)) {
    if (props.activeTool === "selection") emit("select", undefined);
    return;
  }
  const point = toDocumentPoint(event);
  if (!point) return;
  dragStart.value = point;
  dragEnd.value = point;
  svg.value?.setPointerCapture(event.pointerId);
}

function updateCreation(event: PointerEvent): void {
  if (geometryInteraction.value) {
    updateGeometryInteraction(event);
    return;
  }
  if (!dragStart.value) return;
  const point = toDocumentPoint(event);
  if (point) dragEnd.value = point;
}

function finishCreation(event: PointerEvent): void {
  if (geometryInteraction.value) {
    geometryInteraction.value = undefined;
    emit("geometryEnd");
    svg.value?.releasePointerCapture(event.pointerId);
    return;
  }
  if (!dragStart.value) return;
  const start = dragStart.value;
  const end = toDocumentPoint(event) ?? dragEnd.value ?? start;
  const frame = normalizeFrame(start, end);
  if (props.activeTool === "line") {
    frame.lineDirection = (end.x - start.x) * (end.y - start.y) >= 0 ? "down" : "up";
  }
  const resolvedFrame = frame.width < 2 && frame.height < 2 ? defaultFrame(props.activeTool, start) : frame;
  emit("create", props.activeTool, resolvedFrame);
  dragStart.value = undefined;
  dragEnd.value = undefined;
  svg.value?.releasePointerCapture(event.pointerId);
}

function beginElementInteraction(event: PointerEvent, element: LayoutElementNode): void {
  if (props.activeTool !== "selection") return;
  event.stopPropagation();
  emit("select", element.id);
  if (element.locked || effectivelyLockedElementIds.value.has(element.id)) return;
  const pointerStart = toDocumentPoint(event, false);
  if (!pointerStart) return;
  geometryInteraction.value = {
    kind: "move",
    elementId: element.id,
    pointerStart,
    original: {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      ...(element.type === "shape" && element.shape === "line" && element.lineDirection
        ? { lineDirection: element.lineDirection }
        : {}),
    },
  };
  emit("geometryStart");
  svg.value?.setPointerCapture(event.pointerId);
}

function beginResize(
  event: PointerEvent,
  element: LayoutElementNode,
  handle: ResizeHandle,
): void {
  if (element.locked || effectivelyLockedElementIds.value.has(element.id)) return;
  geometryInteraction.value = {
    kind: "resize",
    elementId: element.id,
    handle,
    original: {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      ...(element.type === "shape" && element.shape === "line" && element.lineDirection
        ? { lineDirection: element.lineDirection }
        : {}),
    },
  };
  emit("geometryStart");
  svg.value?.setPointerCapture(event.pointerId);
}

function updateGeometryInteraction(event: PointerEvent): void {
  const interaction = geometryInteraction.value;
  const point = toDocumentPoint(event, false);
  if (!interaction || !point) return;
  if (interaction.kind === "move") {
    const rawX = interaction.original.x + point.x - interaction.pointerStart.x;
    const rawY = interaction.original.y + point.y - interaction.pointerStart.y;
    const snapped = props.showGuides && !event.altKey
      ? snapMovedFrame(interaction.elementId, rawX, rawY, interaction.original.width, interaction.original.height)
      : { x: rawX, y: rawY };
    emit("updateGeometry", interaction.elementId, {
      ...interaction.original,
      x: snapped.x,
      y: snapped.y,
    });
    return;
  }

  const minimum = 1;
  let left = interaction.original.x;
  let top = interaction.original.y;
  let right = interaction.original.x + interaction.original.width;
  let bottom = interaction.original.y + interaction.original.height;
  if (interaction.handle.includes("w")) left = Math.min(point.x, right - minimum);
  if (interaction.handle.includes("e")) right = Math.max(point.x, left + minimum);
  if (interaction.handle.includes("n")) top = Math.min(point.y, bottom - minimum);
  if (interaction.handle.includes("s")) bottom = Math.max(point.y, top + minimum);
  emit("updateGeometry", interaction.elementId, {
    ...interaction.original,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
}

function snapOrigin(origin: number, size: number, targets: number[], tolerance = 1.25): number {
  const anchors = [origin, origin + size / 2, origin + size];
  let correction = 0;
  let best = tolerance + 1;
  for (const anchor of anchors) {
    for (const target of targets) {
      const distance = Math.abs(target - anchor);
      if (distance <= tolerance && distance < best) {
        best = distance;
        correction = target - anchor;
      }
    }
  }
  return origin + correction;
}

function snapMovedFrame(elementId: string, x: number, y: number, width: number, height: number): Point {
  const xTargets = [
    0,
    props.page.safeArea.left,
    props.page.width / 2,
    props.page.width - props.page.safeArea.right,
    props.page.width,
  ];
  const yTargets = [
    0,
    props.page.safeArea.top,
    props.page.height / 2,
    props.page.height - props.page.safeArea.bottom,
    props.page.height,
  ];
  for (const element of scene.value.elements) {
    if (element.id === elementId) continue;
    xTargets.push(element.x, element.x + element.width / 2, element.x + element.width);
    yTargets.push(element.y, element.y + element.height / 2, element.y + element.height);
  }
  return {
    x: snapOrigin(x, width, xTargets),
    y: snapOrigin(y, height, yTargets),
  };
}

function assetSource(assetId: string): string | undefined {
  return assetById.value.get(assetId)?.source;
}

function imagePlacement(element: ImageElement) {
  const asset = assetById.value.get(element.assetId);
  return calculateImagePlacement(
    { x: element.x, y: element.y, width: element.width, height: element.height },
    asset?.widthPx ?? element.width,
    asset?.heightPx ?? element.height,
    element.fit,
    element.crop,
  );
}

function elementMaskId(elementId: string): string {
  return `object-mask-${elementId}`;
}

function elementMaskClipId(elementId: string): string {
  return `object-mask-frame-${elementId}`;
}

function elementCornerRadius(element: LayoutElementNode): number {
  return Math.max(0, Math.min(element.cornerRadiusMm ?? 0, element.width / 2, element.height / 2));
}

function individualCornerPath(element: LayoutElementNode): string {
  const { topLeft, topRight, bottomRight, bottomLeft } = resolvedCornerRadii(element);
  const left = element.x;
  const top = element.y;
  const right = element.x + element.width;
  const bottom = element.y + element.height;
  return [
    `M ${left + topLeft} ${top}`,
    `H ${right - topRight}`,
    `Q ${right} ${top} ${right} ${top + topRight}`,
    `V ${bottom - bottomRight}`,
    `Q ${right} ${bottom} ${right - bottomRight} ${bottom}`,
    `H ${left + bottomLeft}`,
    `Q ${left} ${bottom} ${left} ${bottom - bottomLeft}`,
    `V ${top + topLeft}`,
    `Q ${left} ${top} ${left + topLeft} ${top}`,
    "Z",
  ].join(" ");
}

function elementLayerMask(element: LayoutElementNode): LayerMask | undefined {
  return layerMaskByElementId.value.get(element.id);
}

function elementLayerMaskSource(element: LayoutElementNode): string | undefined {
  const mask = elementLayerMask(element);
  return mask ? assetSource(mask.assetId) : undefined;
}

function elementNeedsMask(element: LayoutElementNode): boolean {
  return hasRoundedCorners(element) ||
    (element.type === "image" && element.fit === "crop") ||
    Boolean(elementLayerMaskSource(element));
}

function foodMarkerSource(rule: FoodRuleId): string | undefined {
  const assetId = props.foodMarkerAssets?.[rule];
  const customSource = assetId ? assetSource(assetId) : undefined;
  return customSource ?? foodMarkerPackPreviewSource(props.foodMarkerPackId, rule);
}

function rotationTransform(x: number, y: number, width: number, height: number, rotation: number): string {
  return rotation ? `rotate(${rotation} ${x + width / 2} ${y + height / 2})` : "";
}

function fontSizeMm(fontSizePt: number): number {
  return fontSizePt * (25.4 / 72);
}

function calendarFontFamily(preferred: string): string {
  return props.calendarLanguage === "cu" ? `"Monomakh Unicode", ${preferred}` : preferred;
}

function textElementFontFamily(element: TextElement | MonthTextElement): string {
  return element.type === "text" && element.semanticRole === "calendar-month-title"
    ? calendarFontFamily(element.typography.fontFamily)
    : element.typography.fontFamily;
}

function shapeFill(element: ShapeElement): string {
  return element.fillGradient
    ? `url(#shape-gradient-${element.id})`
    : element.fillColor ?? "#f4f1e8";
}

function textEffectId(scope: string, kind: "gradient" | "shadow"): string {
  return `text-${kind}-${scope}`;
}

function largeTextFill(effects: LargeTextEffects | undefined, scope: string, fallback: string): string {
  return effects?.gradient ? `url(#${textEffectId(scope, "gradient")})` : fallback;
}

function largeTextFilter(effects: LargeTextEffects | undefined, scope: string): string | undefined {
  return effects?.shadow ? `url(#${textEffectId(scope, "shadow")})` : undefined;
}

function textShadow(effects: LargeTextEffects | undefined) {
  return normalizedTextShadow(effects?.shadow);
}

function textPositionX(element: TextElement | MonthTextElement): number {
  const padding = element.typography.paddingMm;
  if (element.typography.align === "center") return element.x + element.width / 2;
  if (element.typography.align === "right") return element.x + element.width - padding;
  return element.x + padding;
}

function textAnchor(element: TextElement | MonthTextElement): "start" | "middle" | "end" {
  if (element.typography.align === "center") return "middle";
  if (element.typography.align === "right") return "end";
  return "start";
}

function textFrameLayout(element: TextElement | MonthTextElement): TextBlockLayout {
  const fontSize = fontSizeMm(element.typography.fontSizePt);
  const lineHeight = fontSize * element.typography.lineHeight;
  const padding = element.typography.paddingMm;
  const attributionHeight = element.type === "month-text" && element.attribution
    ? fontSize * 0.72 + lineHeight * 0.25
    : 0;
  return layoutTextBlock(
    element.type === "text"
      ? localizedTextTitle(element, props.page, props.calendarYear?.year ?? new Date().getFullYear(), props.calendarLanguage)
      : element.content.title,
    Math.max(0, element.width - padding * 2),
    Math.max(0, element.height - padding * 2 - attributionHeight),
    lineHeight,
    (value) => value.length * fontSize * 0.52 + Math.max(0, Array.from(value).length - 1) * fontSizeMm(element.typography.letterSpacingPt),
  );
}

function textFirstBaseline(element: TextElement | MonthTextElement): number {
  const layout = textFrameLayout(element);
  const padding = element.typography.paddingMm;
  const fontSize = fontSizeMm(element.typography.fontSizePt);
  const lineHeight = fontSize * element.typography.lineHeight;
  const attributionHeight = element.type === "month-text" && element.attribution
    ? fontSize * 0.72 + lineHeight * 0.25
    : 0;
  const available = Math.max(0, element.height - padding * 2 - attributionHeight);
  const offset = element.typography.verticalAlign === "middle"
    ? Math.max(0, (available - layout.consumedHeight) / 2)
    : element.typography.verticalAlign === "bottom"
      ? Math.max(0, available - layout.consumedHeight)
      : 0;
  return element.y + padding + offset + fontSize;
}

function calendarLayout(element: CalendarGridElement): CalendarGridLayout | undefined {
  return calendarLayouts.value.get(element.id);
}

function calendarCellText(element: CalendarGridElement, cell: CalendarGridCellLayout) {
  return layoutCalendarCellTextAutoFit(
    element,
    cell,
    (value, fontSizeMm) => value.length * fontSizeMm * 0.52,
    props.calendarLanguage,
  );
}

function calendarCellPrimaryTypikonEvent(element: CalendarGridElement, cell: CalendarGridCellLayout) {
  return calendarCellText(element, cell).lines.find((line) => !line.isContinuation)?.event;
}

function calendarCellClipId(elementId: string, cellKey: string): string {
  return `calendar-cell-${elementId}-${cellKey}`;
}

function legendRowHeight(element: Extract<LayoutElementNode, { type: "legend" }>): number {
  return element.height;
}

let legendMeasureContext: CanvasRenderingContext2D | undefined;
function measureLegendText(value: string, fontSizeMm: number): number {
  if (typeof document === "undefined") return Array.from(value).length * fontSizeMm * 0.54;
  legendMeasureContext ??= document.createElement("canvas").getContext("2d") ?? undefined;
  if (!legendMeasureContext) return Array.from(value).length * fontSizeMm * 0.54;
  legendMeasureContext.font = `600 ${fontSizeMm}px "Cormorant Garamond", Georgia, serif`;
  return legendMeasureContext.measureText(value).width;
}

function legendLayout(element: Extract<LayoutElementNode, { type: "legend" }>) {
  return buildRightAlignedLegendLayout(
    element.width,
    element.height,
    legendPreviewItems.value,
    measureLegendText,
  );
}

function weekdayLabels(element: CalendarGridElement): readonly string[] {
  if (element.weekdayLabelMode === "custom" && element.customWeekdayLabels?.length === 7) {
    return element.customWeekdayLabels;
  }
  if (element.weekdayLabelMode === "short") {
    return calendarWeekdayLabels(props.calendarLanguage, true);
  }
  return calendarWeekdayLabels(props.calendarLanguage);
}

function weekdayFontSizeMm(element: CalendarGridElement): number {
  const requestedSize = Math.max(0.1, fontSizeMm(element.weekdayFontSizePt ?? 18));
  const labels = weekdayLabels(element);
  const availableWidth = Math.max(1, element.width / 7 - 2);
  const widestEstimatedWidth = Math.max(
    1,
    ...labels.map((label) => Array.from(label).length * requestedSize * 0.56),
  );
  return requestedSize * Math.min(1, availableWidth / widestEstimatedWidth);
}
</script>

<template>
  <svg
    ref="svg"
    class="page-scene"
    :class="`page-scene--tool-${activeTool}`"
    :style="{
      width: `${scene.mediaBox.width * pixelsPerMm}px`,
      height: `${scene.mediaBox.height * pixelsPerMm}px`,
    }"
    :viewBox="viewBox"
    role="img"
    :aria-label="`${page.name}, ${page.width} на ${page.height} миллиметров`"
    @pointerdown="beginCreation"
    @pointermove="updateCreation"
    @pointerup="finishCreation"
    @pointercancel="finishCreation"
  >
    <rect
      :x="scene.mediaBox.x"
      :y="scene.mediaBox.y"
      :width="scene.mediaBox.width"
      :height="scene.mediaBox.height"
      class="page-scene__paper"
    />

    <g class="page-scene__elements">
      <g
        v-for="element in scene.elements"
        :key="element.id"
        class="page-element"
        :class="{ 'page-element--selected': selectedElementId === element.id }"
        :data-element-id="element.id"
        :data-element-type="element.type"
        :transform="rotationTransform(element.x, element.y, element.width, element.height, element.rotation)"
        @pointerdown="beginElementInteraction($event, element)"
      >
        <defs v-if="elementNeedsMask(element)">
          <clipPath :id="elementMaskClipId(element.id)" clipPathUnits="userSpaceOnUse">
            <rect
              v-if="!element.cornerRadiiMm"
              :x="element.x"
              :y="element.y"
              :width="element.width"
              :height="element.height"
              :rx="elementCornerRadius(element)"
            />
            <path v-else :d="individualCornerPath(element)" />
          </clipPath>
          <mask
            :id="elementMaskId(element.id)"
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            :x="element.x"
            :y="element.y"
            :width="element.width"
            :height="element.height"
            style="mask-type: luminance"
          >
            <g :clip-path="`url(#${elementMaskClipId(element.id)})`">
              <rect
                :x="element.x"
                :y="element.y"
                :width="element.width"
                :height="element.height"
                :fill="elementLayerMaskSource(element) ? '#000' : '#fff'"
              />
              <image
                v-if="elementLayerMaskSource(element)"
                :href="elementLayerMaskSource(element)"
                :x="element.x"
                :y="element.y"
                :width="element.width"
                :height="element.height"
                preserveAspectRatio="xMidYMid meet"
              />
            </g>
          </mask>
        </defs>
        <g :mask="elementNeedsMask(element) ? `url(#${elementMaskId(element.id)})` : undefined">
        <template v-if="element.type === 'text' || element.type === 'month-text'">
          <defs v-if="element.type === 'text' && (element.textEffects?.gradient || element.textEffects?.shadow)">
            <linearGradient
              v-if="element.textEffects?.gradient"
              :id="textEffectId(element.id, 'gradient')"
              :x1="'0%'"
              :y1="'0%'"
              :x2="element.textEffects.gradient.direction === 'horizontal' ? '100%' : '0%'"
              :y2="element.textEffects.gradient.direction === 'vertical' ? '100%' : '0%'"
            >
              <stop offset="0%" :stop-color="element.textEffects.gradient.startColor" />
              <stop offset="50%" :stop-color="element.textEffects.gradient.centerColor" />
              <stop offset="100%" :stop-color="element.textEffects.gradient.endColor" />
            </linearGradient>
            <filter
              v-if="textShadow(element.textEffects)"
              :id="textEffectId(element.id, 'shadow')"
              x="-200%"
              y="-200%"
              width="500%"
              height="500%"
              color-interpolation-filters="sRGB"
            >
              <feDropShadow
                :dx="textShadow(element.textEffects)!.offsetXMm"
                :dy="textShadow(element.textEffects)!.offsetYMm"
                :stdDeviation="textShadow(element.textEffects)!.blurMm / 2"
                :flood-color="textShadow(element.textEffects)!.color"
                :flood-opacity="textShadow(element.textEffects)!.opacity"
              />
            </filter>
          </defs>
          <rect
            :x="element.x"
            :y="element.y"
            :width="element.width"
            :height="element.height"
            class="page-element__frame"
          />
          <template v-if="element.type === 'text' && element.textEffects?.extrusion">
            <template v-for="(line, lineIndex) in textFrameLayout(element).lines" :key="`${element.id}-extrusion-line-${lineIndex}`">
              <text
                v-for="(offset, effectIndex) in textExtrusionOffsets(element.textEffects.extrusion)"
                :key="`${element.id}-extrusion-${lineIndex}-${effectIndex}`"
                :x="textPositionX(element) + offset.xMm"
                :y="textFirstBaseline(element) + lineIndex * fontSizeMm(element.typography.fontSizePt) * element.typography.lineHeight + offset.yMm"
                :font-family="textElementFontFamily(element)"
                :font-size="fontSizeMm(element.typography.fontSizePt)"
                :fill="element.textEffects.extrusion.color"
                :opacity="normalizedOpacity(element.opacity) * offset.opacity"
                :font-weight="element.typography.fontWeight ?? 400"
                :font-style="element.typography.fontStyle ?? 'normal'"
                :letter-spacing="fontSizeMm(element.typography.letterSpacingPt)"
                :text-anchor="textAnchor(element)"
                class="page-element__text large-text-extrusion"
              >
                {{ line.text }}
              </text>
            </template>
          </template>
          <text
            v-for="(line, lineIndex) in textFrameLayout(element).lines"
            :key="`${element.id}-line-${lineIndex}`"
            :x="textPositionX(element)"
            :y="textFirstBaseline(element) + lineIndex * fontSizeMm(element.typography.fontSizePt) * element.typography.lineHeight"
            :font-family="textElementFontFamily(element)"
            :font-size="fontSizeMm(element.typography.fontSizePt)"
            :fill="element.type === 'text' ? largeTextFill(element.textEffects, element.id, element.typography.color ?? '#17201d') : element.typography.color ?? '#17201d'"
            :filter="element.type === 'text' ? largeTextFilter(element.textEffects, element.id) : undefined"
            :opacity="element.opacity ?? 1"
            :font-weight="element.typography.fontWeight ?? 400"
            :font-style="element.typography.fontStyle ?? 'normal'"
            :letter-spacing="fontSizeMm(element.typography.letterSpacingPt)"
            :text-anchor="textAnchor(element)"
            class="page-element__text"
          >
            {{ line.text }}
          </text>
          <text
            v-if="element.type === 'month-text' && element.attribution"
            :x="textPositionX(element)"
            :y="element.y + element.height - element.typography.paddingMm"
            :font-family="element.typography.fontFamily"
            :font-size="fontSizeMm(element.typography.fontSizePt * 0.72)"
            :fill="element.typography.color ?? '#17201d'"
            :opacity="element.opacity ?? 1"
            :text-anchor="textAnchor(element)"
            class="page-element__text page-element__attribution"
          >
            {{ element.attribution }}
          </text>
        </template>

        <template v-else-if="element.type === 'image'">
          <image
            v-if="assetSource(element.assetId)"
            :href="assetSource(element.assetId)"
            :x="imagePlacement(element).x"
            :y="imagePlacement(element).y"
            :width="imagePlacement(element).width"
            :height="imagePlacement(element).height"
            :opacity="element.opacity"
            preserveAspectRatio="none"
          />
          <g v-else class="page-element__placeholder">
            <rect :x="element.x" :y="element.y" :width="element.width" :height="element.height" />
            <line :x1="element.x" :y1="element.y" :x2="element.x + element.width" :y2="element.y + element.height" />
            <line :x1="element.x + element.width" :y1="element.y" :x2="element.x" :y2="element.y + element.height" />
            <text :x="element.x + element.width / 2" :y="element.y + element.height / 2">Изображение</text>
          </g>
        </template>

        <template v-else-if="element.type === 'shape'">
          <defs v-if="element.fillGradient && element.shape !== 'line'">
            <linearGradient
              :id="`shape-gradient-${element.id}`"
              :x1="'0%'"
              :y1="'0%'"
              :x2="element.fillGradient.direction === 'horizontal' ? '100%' : '0%'"
              :y2="element.fillGradient.direction === 'vertical' ? '100%' : '0%'"
            >
              <stop offset="0%" :stop-color="element.fillGradient.startColor" />
              <stop offset="50%" :stop-color="element.fillGradient.centerColor" />
              <stop offset="100%" :stop-color="element.fillGradient.endColor" />
            </linearGradient>
          </defs>
          <path
            v-if="element.shape === 'rectangle' && element.cornerRadiiMm"
            :d="individualCornerPath(element)"
            class="page-element__shape"
            :stroke-width="element.strokeWidthMm"
            :fill="shapeFill(element)"
            :stroke="element.strokeColor ?? '#17201d'"
            :opacity="element.opacity ?? 1"
          />
          <rect
            v-else-if="element.shape === 'rectangle'"
            :x="element.x"
            :y="element.y"
            :width="element.width"
            :height="element.height"
            :rx="elementCornerRadius(element)"
            class="page-element__shape"
            :stroke-width="element.strokeWidthMm"
            :fill="shapeFill(element)"
            :stroke="element.strokeColor ?? '#17201d'"
            :opacity="element.opacity ?? 1"
          />
          <ellipse
            v-else-if="element.shape === 'ellipse'"
            :cx="element.x + element.width / 2"
            :cy="element.y + element.height / 2"
            :rx="element.width / 2"
            :ry="element.height / 2"
            class="page-element__shape"
            :stroke-width="element.strokeWidthMm"
            :fill="shapeFill(element)"
            :stroke="element.strokeColor ?? '#17201d'"
            :opacity="element.opacity ?? 1"
          />
          <line
            v-else
            :x1="element.x"
            :y1="element.lineDirection === 'up' ? element.y + element.height : element.y"
            :x2="element.x + element.width"
            :y2="element.lineDirection === 'up' ? element.y : element.y + element.height"
            class="page-element__shape"
            :stroke-width="element.strokeWidthMm"
            fill="none"
            :stroke="element.strokeColor ?? '#17201d'"
            :opacity="element.opacity ?? 1"
          />
        </template>

        <template v-else-if="element.type === 'svg'">
          <image
            v-if="assetSource(element.assetId)"
            :href="assetSource(element.assetId)"
            :x="element.x"
            :y="element.y"
            :width="element.width"
            :height="element.height"
            :opacity="element.opacity ?? 1"
            :preserveAspectRatio="element.preserveAspectRatio ? 'xMidYMid meet' : 'none'"
          />
          <g v-else class="page-element__placeholder">
            <rect :x="element.x" :y="element.y" :width="element.width" :height="element.height" />
            <text :x="element.x + element.width / 2" :y="element.y + element.height / 2">SVG</text>
          </g>
        </template>

        <template v-else-if="element.type === 'calendar-grid'">
          <template v-if="calendarYear && calendarLayout(element)">
            <defs>
              <linearGradient
                v-if="element.weekdayTextEffects?.gradient"
                :id="textEffectId(`${element.id}-weekday`, 'gradient')"
                :x1="'0%'"
                :y1="'0%'"
                :x2="element.weekdayTextEffects.gradient.direction === 'horizontal' ? '100%' : '0%'"
                :y2="element.weekdayTextEffects.gradient.direction === 'vertical' ? '100%' : '0%'"
              >
                <stop offset="0%" :stop-color="element.weekdayTextEffects.gradient.startColor" />
                <stop offset="50%" :stop-color="element.weekdayTextEffects.gradient.centerColor" />
                <stop offset="100%" :stop-color="element.weekdayTextEffects.gradient.endColor" />
              </linearGradient>
              <filter
                v-if="textShadow(element.weekdayTextEffects)"
                :id="textEffectId(`${element.id}-weekday`, 'shadow')"
                x="-200%"
                y="-200%"
                width="500%"
                height="500%"
                color-interpolation-filters="sRGB"
              >
                <feDropShadow
                  :dx="textShadow(element.weekdayTextEffects)!.offsetXMm"
                  :dy="textShadow(element.weekdayTextEffects)!.offsetYMm"
                  :stdDeviation="textShadow(element.weekdayTextEffects)!.blurMm / 2"
                  :flood-color="textShadow(element.weekdayTextEffects)!.color"
                  :flood-opacity="textShadow(element.weekdayTextEffects)!.opacity"
                />
              </filter>
              <linearGradient
                v-if="element.dayNumberTextEffects?.gradient"
                :id="textEffectId(`${element.id}-day-number`, 'gradient')"
                :x1="'0%'"
                :y1="'0%'"
                :x2="element.dayNumberTextEffects.gradient.direction === 'horizontal' ? '100%' : '0%'"
                :y2="element.dayNumberTextEffects.gradient.direction === 'vertical' ? '100%' : '0%'"
              >
                <stop offset="0%" :stop-color="element.dayNumberTextEffects.gradient.startColor" />
                <stop offset="50%" :stop-color="element.dayNumberTextEffects.gradient.centerColor" />
                <stop offset="100%" :stop-color="element.dayNumberTextEffects.gradient.endColor" />
              </linearGradient>
              <filter
                v-if="textShadow(element.dayNumberTextEffects)"
                :id="textEffectId(`${element.id}-day-number`, 'shadow')"
                x="-200%"
                y="-200%"
                width="500%"
                height="500%"
                color-interpolation-filters="sRGB"
              >
                <feDropShadow
                  :dx="textShadow(element.dayNumberTextEffects)!.offsetXMm"
                  :dy="textShadow(element.dayNumberTextEffects)!.offsetYMm"
                  :stdDeviation="textShadow(element.dayNumberTextEffects)!.blurMm / 2"
                  :flood-color="textShadow(element.dayNumberTextEffects)!.color"
                  :flood-opacity="textShadow(element.dayNumberTextEffects)!.opacity"
                />
              </filter>
              <clipPath
                v-for="cell in calendarLayout(element)!.cells"
                :id="calendarCellClipId(element.id, cell.key)"
                :key="`clip-${cell.key}`"
              >
                <rect :x="cell.x" :y="cell.y" :width="cell.width" :height="cell.height" />
              </clipPath>
            </defs>
            <rect
              v-for="(label, column) in weekdayLabels(element)"
              v-show="calendarLayout(element)!.headerHeight > 0"
              :key="`weekday-${column}`"
              :x="element.x + calendarLayout(element)!.columnWidth * column"
              :y="element.y"
              :width="calendarLayout(element)!.columnWidth"
              :height="calendarLayout(element)!.headerHeight"
              :aria-label="label"
              class="page-element__calendar-heading"
              :class="{ 'page-element__calendar-heading--sunday': column === 6 }"
              :data-grid-style="element.gridStyle ?? 'editorial'"
            />
            <template v-if="element.weekdayTextEffects?.extrusion">
              <template v-for="(label, column) in weekdayLabels(element)" :key="`weekday-extrusion-group-${column}`">
                <text
                  v-for="(offset, effectIndex) in textExtrusionOffsets(element.weekdayTextEffects.extrusion)"
                  v-show="calendarLayout(element)!.headerHeight > 0"
                  :key="`weekday-extrusion-${column}-${effectIndex}`"
                  :x="element.x + calendarLayout(element)!.columnWidth * (column + 0.5) + offset.xMm"
                  :y="element.y + calendarLayout(element)!.headerHeight * 0.66 + offset.yMm"
                  class="page-element__calendar-weekday large-text-extrusion"
                  :style="{
                    fill: element.weekdayTextEffects.extrusion.color,
                    fontFamily: calendarFontFamily(element.weekdayFontFamily ?? 'Ruslan Display'),
                    fontSize: `${weekdayFontSizeMm(element)}px`,
                  }"
                  :opacity="offset.opacity"
                >
                  {{ label }}
                </text>
              </template>
            </template>
            <text
              v-for="(label, column) in weekdayLabels(element)"
              v-show="calendarLayout(element)!.headerHeight > 0"
              :key="`weekday-label-${column}`"
              :x="element.x + calendarLayout(element)!.columnWidth * (column + 0.5)"
              :y="element.y + calendarLayout(element)!.headerHeight * 0.66"
              class="page-element__calendar-weekday"
              :class="{ 'page-element__calendar-weekday--sunday': column === 6 }"
              :style="{
                fill: largeTextFill(element.weekdayTextEffects, `${element.id}-weekday`, column === 6 ? '#9d2929' : '#26322d'),
                fontFamily: calendarFontFamily(element.weekdayFontFamily ?? 'Ruslan Display'),
                fontSize: `${weekdayFontSizeMm(element)}px`,
              }"
              :filter="largeTextFilter(element.weekdayTextEffects, `${element.id}-weekday`)"
            >
              {{ label }}
            </text>
            <template v-if="(element.gridStyle ?? 'editorial') === 'editorial' && calendarLayout(element)!.headerHeight > 0">
              <line :x1="element.x" :y1="element.y" :x2="element.x + element.width" :y2="element.y" class="page-element__calendar-header-rule" />
              <line :x1="element.x" :y1="element.y + calendarLayout(element)!.headerHeight" :x2="element.x + element.width" :y2="element.y + calendarLayout(element)!.headerHeight" class="page-element__calendar-header-rule" />
            </template>
            <g
              v-for="cell in calendarLayout(element)!.cells"
              :key="cell.key"
              class="calendar-cell"
            >
              <rect
                :x="cell.x"
                :y="cell.y"
                :width="cell.width"
                :height="cell.height"
                class="page-element__calendar"
                :style="element.showFastingColors && cell.day ? { fill: FASTING_COLORS[resolveFoodRule(cell.day, fastingProfileId).id] } : undefined"
                :data-grid-style="element.gridStyle ?? 'editorial'"
              />
              <line
                v-if="(element.gridStyle ?? 'editorial') === 'editorial'"
                :x1="cell.x"
                :y1="cell.y + cell.height"
                :x2="cell.x + cell.width"
                :y2="cell.y + cell.height"
                class="page-element__calendar-editorial-rule"
              />
              <g
                v-if="cell.day"
                :clip-path="`url(#${calendarCellClipId(element.id, cell.key)})`"
              >
                <text
                  v-for="(offset, effectIndex) in textExtrusionOffsets(element.dayNumberTextEffects?.extrusion)"
                  :key="`${cell.key}-day-number-extrusion-${effectIndex}`"
                  :x="cell.x + calendarCellTypography(element).dayNumberXOffsetMm + offset.xMm"
                  :y="cell.y + calendarCellTypography(element).dayNumberYOffsetMm + calendarCellTypography(element).dayNumberFontSizeMm + offset.yMm"
                  :font-size="calendarCellTypography(element).dayNumberFontSizeMm"
                  :style="{
                    fill: element.dayNumberTextEffects?.extrusion?.color ?? '#70430f',
                    fontWeight: dayNumberTypikonStyle(cell.day).fontWeight,
                    fontFamily: element.dayNumberFontFamily ?? 'Yeseva One',
                  }"
                  :opacity="offset.opacity"
                  class="calendar-cell__number large-text-extrusion"
                >
                  {{ cell.day.date.day }}
                </text>
                <text
                  :x="cell.x + calendarCellTypography(element).dayNumberXOffsetMm"
                  :y="cell.y + calendarCellTypography(element).dayNumberYOffsetMm + calendarCellTypography(element).dayNumberFontSizeMm"
                  :font-size="calendarCellTypography(element).dayNumberFontSizeMm"
                  :style="{
                    fill: largeTextFill(
                      element.dayNumberTextEffects,
                      `${element.id}-day-number`,
                      element.showFeastColors === false ? '#17201d' : dayNumberTypikonStyle(cell.day).color,
                    ),
                    fontWeight: dayNumberTypikonStyle(cell.day).fontWeight,
                    fontFamily: element.dayNumberFontFamily ?? 'Yeseva One',
                  }"
                  :filter="largeTextFilter(element.dayNumberTextEffects, `${element.id}-day-number`)"
                  class="calendar-cell__number"
                  :data-calendar-date="cell.day.isoDate"
                >
                  {{ cell.day.date.day }}
                </text>
                <text
                  v-if="element.showOldStyleDate"
                  :x="cell.x + calendarCellTypography(element).oldStyleXOffsetMm"
                  :y="cell.y + calendarCellTypography(element).oldStyleYOffsetMm + calendarCellTypography(element).oldStyleFontSizeMm"
                  :font-size="calendarCellTypography(element).oldStyleFontSizeMm"
                  :style="{ fontFamily: calendarFontFamily(element.oldStyleFontFamily ?? 'Cormorant Garamond') }"
                  class="calendar-cell__old-style"
                >
                  {{ calendarOldStylePrefix(calendarLanguage) }} {{ cell.day.oldStyleDate.day }}.{{ cell.day.oldStyleDate.month }}
                </text>
                <FoodMarker
                  v-if="element.showFoodIcons && !element.showFastingColors && resolveFoodRule(cell.day, fastingProfileId).id !== 'no-fast'"
                  :rule="resolveFoodRule(cell.day, fastingProfileId).id"
                  :source="foodMarkerSource(resolveFoodRule(cell.day, fastingProfileId).id)"
                  :x="cell.x + calendarFoodMarkerGeometry(element, cell).xOffsetMm"
                  :y="cell.y + calendarFoodMarkerGeometry(element, cell).yOffsetMm"
                  :size="calendarFoodMarkerGeometry(element, cell).sizeMm"
                />
                <TypikonRankMarker
                  v-if="element.showTypikonIcons === true && calendarCellPrimaryTypikonEvent(element, cell)"
                  :kind="typikonMarkForEvent(calendarCellPrimaryTypikonEvent(element, cell)!)"
                  :x="cell.x + calendarCellTypography(element).eventMarkerXOffsetMm"
                  :y="cell.y + calendarCellTypography(element).eventMarkerYOffsetMm"
                  :size="calendarCellTypography(element).eventMarkerSizeMm"
                />
                <template v-for="line in calendarCellText(element, cell).lines" :key="line.key">
                  <text
                    :x="cell.x + line.x"
                    :y="cell.y + line.baselineY"
                    :font-size="line.fontSizeMm"
                    :style="{
                      fill: element.showFeastColors === false ? '#2a3530' : eventTypikonStyle(line.event, cell.day).color,
                      fontWeight: eventTypikonStyle(line.event, cell.day).fontWeight,
                      fontFamily: calendarFontFamily(element.eventFontFamily ?? 'Cormorant Garamond'),
                    }"
                    class="calendar-cell__event"
                    :data-style-token="line.event.styleToken"
                  >
                    {{ line.text }}
                  </text>
                </template>
              </g>
            </g>
            <text
              v-if="calendarLayout(element)!.hasRowOverflow"
              :x="element.x + element.width - 2"
              :y="element.y + element.height - 2"
              class="calendar-cell__overflow"
            >
              Не помещается {{ calendarLayout(element)!.requiredWeekRows }} недель
            </text>
          </template>
          <template v-else>
            <rect :x="element.x" :y="element.y" :width="element.width" :height="element.height" class="page-element__calendar" />
            <text :x="element.x + 3" :y="element.y + 6" class="page-element__calendar-label">
              Календарные данные загружаются…
            </text>
          </template>
        </template>

        <template v-else-if="element.type === 'legend'">
          <rect :x="element.x" :y="element.y" :width="element.width" :height="element.height" class="page-element__frame legend-frame" />
          <g
            v-for="(item, index) in legendPreviewItems"
            :key="item.id"
            class="legend-item"
            :transform="`translate(${element.x + legendLayout(element).items[index]!.xMm} ${element.y})`"
          >
            <FoodMarker
              v-if="item.foodRule"
              :rule="item.foodRule"
              :source="foodMarkerSource(item.foodRule)"
              :x="0"
              :y="Math.max(0, (legendRowHeight(element) - legendLayout(element).markerSizeMm) / 2)"
              :size="legendLayout(element).markerSizeMm"
            />
            <rect v-else-if="item.colorSwatch" :x="0" :y="(legendRowHeight(element) - legendLayout(element).markerSizeMm) / 2" :width="legendLayout(element).markerSizeMm" :height="legendLayout(element).markerSizeMm" :fill="item.color" stroke="#68736d" stroke-width="0.15" />
            <circle v-else :cx="legendLayout(element).markerSizeMm / 2" :cy="legendRowHeight(element) / 2" r="2.1" :fill="item.color" />
            <text
              :x="legendLayout(element).items[index]!.widthMm"
              :y="legendRowHeight(element) / 2 + legendLayout(element).fontSizeMm * 0.35"
              class="legend-item__label"
              text-anchor="end"
              :style="{ fontSize: `${legendLayout(element).fontSizeMm}px` }"
            >{{ item.label }}</text>
          </g>
        </template>
        </g>

        <rect
          v-if="selectedElementId === element.id"
          :x="element.x"
          :y="element.y"
          :width="element.width"
          :height="element.height"
          class="page-element__selection"
        />
        <g v-if="selectedElementId === element.id" class="page-element__handles">
          <circle :cx="element.x" :cy="element.y" r="1.7" class="resize-handle resize-handle--nw" @pointerdown.stop="beginResize($event, element, 'nw')" />
          <circle :cx="element.x + element.width / 2" :cy="element.y" r="1.7" class="resize-handle resize-handle--n" @pointerdown.stop="beginResize($event, element, 'n')" />
          <circle :cx="element.x + element.width" :cy="element.y" r="1.7" class="resize-handle resize-handle--ne" @pointerdown.stop="beginResize($event, element, 'ne')" />
          <circle :cx="element.x + element.width" :cy="element.y + element.height / 2" r="1.7" class="resize-handle resize-handle--e" @pointerdown.stop="beginResize($event, element, 'e')" />
          <circle :cx="element.x + element.width" :cy="element.y + element.height" r="1.7" class="resize-handle resize-handle--se" @pointerdown.stop="beginResize($event, element, 'se')" />
          <circle :cx="element.x + element.width / 2" :cy="element.y + element.height" r="1.7" class="resize-handle resize-handle--s" @pointerdown.stop="beginResize($event, element, 's')" />
          <circle :cx="element.x" :cy="element.y + element.height" r="1.7" class="resize-handle resize-handle--sw" @pointerdown.stop="beginResize($event, element, 'sw')" />
          <circle :cx="element.x" :cy="element.y + element.height / 2" r="1.7" class="resize-handle resize-handle--w" @pointerdown.stop="beginResize($event, element, 'w')" />
        </g>
      </g>
    </g>

    <rect
      v-if="draftFrame"
      :x="draftFrame.x"
      :y="draftFrame.y"
      :width="draftFrame.width"
      :height="draftFrame.height"
      class="page-scene__draft"
    />

    <g v-if="showGuides" class="page-scene__guides">
      <rect
        :x="scene.mediaBox.x"
        :y="scene.mediaBox.y"
        :width="scene.mediaBox.width"
        :height="scene.mediaBox.height"
        class="page-scene__bleed"
      />
      <rect
        :x="scene.trimBox.x"
        :y="scene.trimBox.y"
        :width="scene.trimBox.width"
        :height="scene.trimBox.height"
        class="page-scene__trim"
      />
      <rect
        :x="scene.safeBox.x"
        :y="scene.safeBox.y"
        :width="scene.safeBox.width"
        :height="scene.safeBox.height"
        class="page-scene__safe"
      />
    </g>
  </svg>
</template>
