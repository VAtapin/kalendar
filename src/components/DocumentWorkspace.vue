<script setup lang="ts">
import { computed } from "vue";
import type { DocumentAsset, ElementMaskStroke, ElementMaskStrokeMode, PageModel } from "../document/types";
import type { ElementFrame } from "../editor/element-creation";
import type { EditorTool } from "../editor/types";
import type { OrthodoxCalendarYear } from "../calendar";
import type { FoodRuleId } from "../calendar/presentation/fasting";
import type { FastingProfileId } from "../calendar/fasting/fasting-api";
import type { FoodMarkerPackId } from "../calendar/presentation/marker-packs";
import HorizontalRuler from "./HorizontalRuler.vue";
import PageScene from "./PageScene.vue";
import VerticalRuler from "./VerticalRuler.vue";

const props = defineProps<{
  page: PageModel;
  assets: DocumentAsset[];
  foodMarkerPackId?: FoodMarkerPackId;
  foodMarkerAssets?: Partial<Record<FoodRuleId, string>>;
  fastingProfileId?: FastingProfileId;
  calendarYear?: OrthodoxCalendarYear;
  pixelsPerMm: number;
  showGuides: boolean;
  activeTool: EditorTool;
  selectedElementId?: string;
  maskBrushMode: ElementMaskStrokeMode;
  maskBrushSizeMm: number;
}>();

const emit = defineEmits<{
  create: [tool: EditorTool, frame: ElementFrame];
  select: [elementId: string | undefined];
  geometryStart: [];
  updateGeometry: [elementId: string, frame: ElementFrame];
  geometryEnd: [];
  maskStroke: [elementId: string, stroke: ElementMaskStroke];
}>();

function forwardCreate(tool: EditorTool, frame: ElementFrame): void {
  emit("create", tool, frame);
}

function forwardGeometry(elementId: string, frame: ElementFrame): void {
  emit("updateGeometry", elementId, frame);
}

function forwardMaskStroke(elementId: string, stroke: ElementMaskStroke): void {
  emit("maskStroke", elementId, stroke);
}

const mediaStartX = computed(() => -props.page.bleed.left);
const mediaEndX = computed(() => props.page.width + props.page.bleed.right);
const mediaStartY = computed(() => -props.page.bleed.top);
const mediaEndY = computed(() => props.page.height + props.page.bleed.bottom);
</script>

<template>
  <main class="workspace" aria-label="Рабочая область документа">
    <div class="workspace__stage">
      <div class="workspace__corner">мм</div>
      <HorizontalRuler
        class="workspace__top-ruler"
        :start-mm="mediaStartX"
        :end-mm="mediaEndX"
        :pixels-per-mm="pixelsPerMm"
      />
      <VerticalRuler
        class="workspace__left-ruler"
        :start-mm="mediaStartY"
        :end-mm="mediaEndY"
        :pixels-per-mm="pixelsPerMm"
      />
      <PageScene
        class="workspace__page"
        :page="page"
        :assets="assets"
        :food-marker-pack-id="foodMarkerPackId"
        :food-marker-assets="foodMarkerAssets"
        :fasting-profile-id="fastingProfileId"
        :calendar-year="calendarYear"
        :pixels-per-mm="pixelsPerMm"
        :show-guides="showGuides"
        :active-tool="activeTool"
        :selected-element-id="selectedElementId"
        :mask-brush-mode="maskBrushMode"
        :mask-brush-size-mm="maskBrushSizeMm"
        @create="forwardCreate"
        @select="emit('select', $event)"
        @geometry-start="emit('geometryStart')"
        @update-geometry="forwardGeometry"
        @geometry-end="emit('geometryEnd')"
        @mask-stroke="forwardMaskStroke"
      />
    </div>
  </main>
</template>
