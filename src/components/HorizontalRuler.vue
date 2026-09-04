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

const widthMm = computed(() => props.endMm - props.startMm);
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
    class="ruler ruler--horizontal"
    :style="{ width: `${widthMm * pixelsPerMm}px` }"
    :viewBox="`${startMm} 0 ${widthMm} 9`"
    preserveAspectRatio="none"
    aria-label="Горизонтальная линейка в миллиметрах"
  >
    <line :x1="startMm" y1="8.8" :x2="endMm" y2="8.8" class="ruler__axis" />
    <g v-for="tick in ticks" :key="tick.value">
      <line
        :x1="tick.value"
        y1="9"
        :x2="tick.value"
        :y2="9 - tick.length"
        class="ruler__tick"
      />
      <text
        v-if="tick.label"
        :x="tick.value + 1"
        y="2.8"
        class="ruler__label"
      >
        {{ tick.label }}
      </text>
    </g>
  </svg>
</template>

