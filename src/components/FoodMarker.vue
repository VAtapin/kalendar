<script setup lang="ts">
import { computed } from "vue";
import { FOOD_RULES, type FoodRuleId } from "../calendar/presentation/fasting";

const props = withDefaults(defineProps<{
  rule: FoodRuleId;
  x?: number;
  y?: number;
  size?: number;
  source?: string;
}>(), { x: 0, y: 0, size: 5 });

const transform = computed(
  () => `translate(${props.x} ${props.y}) scale(${props.size / 10})`,
);
const markerColor = computed(() => FOOD_RULES[props.rule].color);
</script>

<template>
  <g class="food-marker" :transform="transform" :style="{ color: markerColor }" aria-hidden="true">
    <image v-if="source" :href="source" x="0" y="0" width="10" height="10" preserveAspectRatio="xMidYMid meet" />
    <g v-else class="food-marker__empty">
      <rect x="1.2" y="1.2" width="7.6" height="7.6" rx="0.8" />
      <path d="M2.4 7.4 4.3 5.2l1.4 1.3 1.2-1.4 1.1 1.2M6.8 3.5h.01" />
    </g>
  </g>
</template>
