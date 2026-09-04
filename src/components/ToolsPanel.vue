<script setup lang="ts">
import type { EditorTool } from "../editor/types";

interface ToolDefinition {
  id: EditorTool;
  label: string;
  shortcut?: string;
  icon: string;
  group: "edit" | "create" | "view";
}

const props = defineProps<{
  activeTool: EditorTool;
  fillColor: string;
  strokeColor: string;
}>();
const emit = defineEmits<{
  select: [tool: EditorTool];
  updateFill: [color: string];
  updateStroke: [color: string];
}>();

function swapColors(): void {
  const fill = props.fillColor;
  emit("updateFill", props.strokeColor);
  emit("updateStroke", fill);
}

function resetColors(): void {
  emit("updateFill", "#ffffff");
  emit("updateStroke", "#17201d");
}

const tools: ToolDefinition[] = [
  { id: "selection", label: "Выделение", shortcut: "V", icon: "↖", group: "edit" },
  { id: "text", label: "Текстовый блок", shortcut: "T", icon: "T", group: "create" },
  { id: "image", label: "Изображение", shortcut: "F", icon: "▧", group: "create" },
  { id: "rectangle", label: "Прямоугольник", shortcut: "M", icon: "□", group: "create" },
  { id: "ellipse", label: "Эллипс", shortcut: "L", icon: "○", group: "create" },
  { id: "line", label: "Линия", shortcut: "\\", icon: "╱", group: "create" },
  { id: "svg", label: "SVG и декор", icon: "✦", group: "create" },
  { id: "calendar-grid", label: "Календарная сетка", icon: "▦", group: "create" },
  { id: "hand", label: "Рука", shortcut: "H", icon: "✋", group: "view" },
  { id: "zoom", label: "Масштаб", shortcut: "Z", icon: "⌕", group: "view" },
];
</script>

<template>
  <aside class="tools-panel" aria-label="Инструменты">
    <template v-for="(tool, index) in tools" :key="tool.id">
      <span
        v-if="index > 0 && tools[index - 1]?.group !== tool.group"
        class="tools-panel__divider"
      ></span>
      <button
        type="button"
        class="tool-button"
        :class="{ 'tool-button--active': activeTool === tool.id }"
        :title="`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`"
        :aria-label="tool.label"
        @click="emit('select', tool.id)"
      >
        {{ tool.icon }}
      </button>
    </template>
    <div class="tools-panel__color-actions">
      <button type="button" title="Поменять заливку и обводку местами" @click="swapColors">↔</button>
      <button type="button" title="Цвета по умолчанию" @click="resetColors">◩</button>
    </div>
    <div class="tools-panel__colors">
      <label class="color-chip color-chip--fill" title="Цвет заливки" :style="{ backgroundColor: fillColor }">
        <input type="color" :value="fillColor" @input="emit('updateFill', ($event.target as HTMLInputElement).value)" />
      </label>
      <label class="color-chip color-chip--stroke" title="Цвет обводки" :style="{ backgroundColor: strokeColor }">
        <input type="color" :value="strokeColor" @input="emit('updateStroke', ($event.target as HTMLInputElement).value)" />
      </label>
    </div>
  </aside>
</template>
