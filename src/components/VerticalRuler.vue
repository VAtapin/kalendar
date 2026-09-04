<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  startMm: number;
  endMm: number;
  pixelsPerMm: number;
}>();

interface Tick {
  value: number;
  length: number;
  label?: string;
}

const heightMm = computed(() => props.endMm - props.startMm);
const ticks = computed<Tick[]>(() => {
  const result: Tick[] = [];
  for (let value = Math.ceil(props.startMm); value <= Math.floor(props.endMm); value += 1) {
    const major = value % 10 === 0;
    const medium = value % 5 === 0;
    result.push({
      value,
      length: major ? 5.5 : medium ? 4 : 2.2,
      label: major && value >= 0 ? String(value) : undefined,
    });
  }
  return result;
});
</script>

<template>
  <svg
    class="ruler ruler--vertical"
    :style="{ height: `${heightMm * pixelsPerMm}px` }"
    :viewBox="`0 ${startMm} 9 ${heightMm}`"
    preserveAspectRatio="none"
    aria-label="Вертикальная линейка в миллиметрах"
  >
    <line x1="8.8" :y1="startMm" x2="8.8" :y2="endMm" class="ruler__axis" />
    <g v-for="tick in ticks" :key="tick.value">
      <line
        x1="9"
        :y1="tick.value"
        :x2="9 - tick.length"
        :y2="tick.value"
        class="ruler__tick"
      />
      <text
        v-if="tick.label"
        x="1.1"
        :y="tick.value + 3"
        class="ruler__label ruler__label--vertical"
      >
        {{ tick.label }}
      </text>
    </g>
  </svg>
</template>

