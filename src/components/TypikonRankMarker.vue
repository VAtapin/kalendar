<script setup lang="ts">
import type { TypikonMarkKind } from "../calendar/presentation/typikon-style";
import { typikonMarkerSvgSource } from "../calendar/presentation/typikon-markers";

const props = withDefaults(defineProps<{
  kind: TypikonMarkKind;
  x?: number;
  y?: number;
  size?: number;
}>(), {
  x: 0,
  y: 0,
  size: 2,
});
</script>

<template>
  <image
    class="typikon-rank-marker"
    :href="typikonMarkerSvgSource(props.kind)"
    :x="props.x"
    :y="props.y"
    :width="props.size"
    :height="props.size"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
  />
</template>
