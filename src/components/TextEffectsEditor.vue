<script setup lang="ts">
import { computed } from "vue";
import { createGoldGradient } from "../document/paint";
import {
  createDefaultTextExtrusion,
  createDefaultTextShadow,
} from "../document/text-effects";
import type {
  LargeTextEffects,
  LinearGradientFill,
  TextExtrusionEffect,
  TextShadowEffect,
} from "../document/types";

const props = defineProps<{
  modelValue?: LargeTextEffects;
  title: string;
  testIdPrefix: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: LargeTextEffects];
}>();

const effects = computed(() => props.modelValue ?? {});
const enabledEffectCount = computed(() => [
  effects.value.gradient,
  effects.value.extrusion,
  effects.value.shadow,
].filter(Boolean).length);

function update(next: Partial<LargeTextEffects>): void {
  emit("update:modelValue", { ...effects.value, ...next });
}

function toggleGradient(enabled: boolean): void {
  update({ gradient: enabled ? createGoldGradient() : undefined });
}

function updateGradient(field: keyof LinearGradientFill, value: string): void {
  if (!effects.value.gradient) return;
  update({ gradient: { ...effects.value.gradient, [field]: value } });
}

function toggleExtrusion(enabled: boolean): void {
  update({ extrusion: enabled ? createDefaultTextExtrusion() : undefined });
}

function updateExtrusion(field: keyof TextExtrusionEffect, value: string | number): void {
  if (!effects.value.extrusion) return;
  update({ extrusion: { ...effects.value.extrusion, [field]: value } });
}

function toggleShadow(enabled: boolean): void {
  update({ shadow: enabled ? createDefaultTextShadow() : undefined });
}

function updateShadow(field: keyof TextShadowEffect, value: string | number): void {
  if (!effects.value.shadow) return;
  update({ shadow: { ...effects.value.shadow, [field]: value } });
}

function numberValue(event: Event): number {
  return Number((event.target as HTMLInputElement).value);
}
</script>

<template>
  <details class="text-effects-editor" open>
    <summary class="text-effects-editor__title">
      <span>{{ title }}</span>
      <small>{{ enabledEffectCount ? `включено: ${enabledEffectCount}` : "выключены" }}</small>
    </summary>
    <div class="text-effects-editor__body">

    <label class="checkbox-field">
      <input
        :data-testid="`${testIdPrefix}-gradient-enabled`"
        :checked="Boolean(effects.gradient)"
        type="checkbox"
        @change="toggleGradient(($event.target as HTMLInputElement).checked)"
      />
      <span>Градиент букв</span>
    </label>
    <div v-if="effects.gradient" class="text-effect-controls">
      <label class="field-control"><span>Начало</span><input :value="effects.gradient.startColor" type="color" @input="updateGradient('startColor', ($event.target as HTMLInputElement).value)" /></label>
      <label class="field-control"><span>Блик</span><input :value="effects.gradient.centerColor" type="color" @input="updateGradient('centerColor', ($event.target as HTMLInputElement).value)" /></label>
      <label class="field-control"><span>Конец</span><input :value="effects.gradient.endColor" type="color" @input="updateGradient('endColor', ($event.target as HTMLInputElement).value)" /></label>
      <label class="field-control"><span>Направление</span><select :value="effects.gradient.direction" @change="updateGradient('direction', ($event.target as HTMLSelectElement).value)"><option value="horizontal">Слева направо</option><option value="vertical">Сверху вниз</option></select></label>
      <button type="button" class="gold-preset-button" @click="update({ gradient: createGoldGradient() })">Золотой градиент</button>
    </div>

    <label class="checkbox-field">
      <input
        :data-testid="`${testIdPrefix}-extrusion-enabled`"
        :checked="Boolean(effects.extrusion)"
        type="checkbox"
        @change="toggleExtrusion(($event.target as HTMLInputElement).checked)"
      />
      <span>Объём букв</span>
    </label>
    <div v-if="effects.extrusion" class="text-effect-controls">
      <label class="field-control"><span>Цвет объёма</span><input :value="effects.extrusion.color" type="color" @input="updateExtrusion('color', ($event.target as HTMLInputElement).value)" /></label>
      <label class="field-control"><span>Глубина, мм</span><input :data-testid="`${testIdPrefix}-extrusion-depth`" :value="effects.extrusion.depthMm" type="number" min="0" step="0.1" @input="updateExtrusion('depthMm', numberValue($event))" /></label>
      <label class="field-control"><span>Направление, °</span><input :value="effects.extrusion.angleDeg" type="number" step="1" @input="updateExtrusion('angleDeg', numberValue($event))" /></label>
      <label class="field-control"><span>Непрозрачность, %</span><input :value="Math.round(effects.extrusion.opacity * 100)" type="number" min="0" max="100" step="1" @input="updateExtrusion('opacity', numberValue($event) / 100)" /></label>
    </div>

    <label class="checkbox-field">
      <input
        :data-testid="`${testIdPrefix}-shadow-enabled`"
        :checked="Boolean(effects.shadow)"
        type="checkbox"
        @change="toggleShadow(($event.target as HTMLInputElement).checked)"
      />
      <span>Тень</span>
    </label>
    <div v-if="effects.shadow" class="text-effect-controls">
      <label class="field-control"><span>Цвет тени</span><input :value="effects.shadow.color" type="color" @input="updateShadow('color', ($event.target as HTMLInputElement).value)" /></label>
      <label class="field-control"><span>X, мм</span><input :data-testid="`${testIdPrefix}-shadow-x`" :value="effects.shadow.offsetXMm" type="number" step="0.1" @input="updateShadow('offsetXMm', numberValue($event))" /></label>
      <label class="field-control"><span>Y, мм</span><input :value="effects.shadow.offsetYMm" type="number" step="0.1" @input="updateShadow('offsetYMm', numberValue($event))" /></label>
      <label class="field-control"><span>Размытие, мм</span><input :value="effects.shadow.blurMm" type="number" min="0" step="0.1" @input="updateShadow('blurMm', numberValue($event))" /></label>
      <label class="field-control"><span>Непрозрачность, %</span><input :value="Math.round(effects.shadow.opacity * 100)" type="number" min="0" max="100" step="1" @input="updateShadow('opacity', numberValue($event) / 100)" /></label>
    </div>
    </div>
  </details>
</template>
