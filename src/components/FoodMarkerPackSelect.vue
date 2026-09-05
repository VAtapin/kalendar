<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from "vue";
import type { FoodRuleId } from "../calendar/presentation/fasting";
import { catalogEnabled, catalogItems } from "../collaboration/catalog-client";
import {
  FOOD_MARKER_PACKS,
  foodMarkerPackPreviewSource,
  getFoodMarkerPack,
  type FoodMarkerPackId,
} from "../calendar/presentation/marker-packs";

const props = defineProps<{
  modelValue: FoodMarkerPackId;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: FoodMarkerPackId];
}>();

const previewRules: readonly FoodRuleId[] = ["fast", "fish", "strict-fast"];
const root = ref<HTMLElement>();
const trigger = ref<HTMLButtonElement>();
const optionButtons = ref<HTMLButtonElement[]>([]);
const isOpen = ref(false);
const listboxId = useId();
const selectedPack = computed(() => getFoodMarkerPack(props.modelValue));
const availablePacks = computed(() => FOOD_MARKER_PACKS.filter(pack => catalogEnabled(`food-pack-${pack.id}`)).map(pack => ({...pack, label: catalogItems.value.find(item => item.id === `food-pack-${pack.id}`)?.name ?? pack.label})));

function setOptionRef(element: unknown, index: number): void {
  if (element instanceof HTMLButtonElement) optionButtons.value[index] = element;
}

async function openMenu(focusSelected = false): Promise<void> {
  isOpen.value = true;
  if (!focusSelected) return;
  await nextTick();
  const selectedIndex = availablePacks.value.findIndex((pack) => pack.id === props.modelValue);
  optionButtons.value[Math.max(0, selectedIndex)]?.focus();
}

function closeMenu(restoreFocus = false): void {
  isOpen.value = false;
  if (restoreFocus) trigger.value?.focus();
}

function selectPack(packId: FoodMarkerPackId): void {
  emit("update:modelValue", packId);
  closeMenu(true);
}

function focusOption(index: number): void {
  const count = availablePacks.value.length;
  if (!count) return;
  optionButtons.value[(index + count) % count]?.focus();
}

function handleTriggerKeydown(event: KeyboardEvent): void {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  void openMenu(true);
}

function handleListboxKeydown(event: KeyboardEvent): void {
  const currentIndex = optionButtons.value.findIndex((button) => button === document.activeElement);
  if (event.key === "Escape") {
    event.preventDefault();
    closeMenu(true);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    focusOption(currentIndex + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    focusOption(currentIndex - 1);
  } else if (event.key === "Home") {
    event.preventDefault();
    focusOption(0);
  } else if (event.key === "End") {
    event.preventDefault();
    focusOption(availablePacks.value.length - 1);
  }
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!(event.target instanceof Node) || root.value?.contains(event.target)) return;
  closeMenu();
}

onMounted(() => document.addEventListener("pointerdown", handleDocumentPointerDown));
onBeforeUnmount(() => document.removeEventListener("pointerdown", handleDocumentPointerDown));
</script>

<template>
  <div ref="root" class="food-marker-pack-select">
    <span class="food-marker-pack-select__label">Стиль</span>
    <button
      ref="trigger"
      class="food-marker-pack-select__trigger"
      type="button"
      data-testid="food-marker-pack"
      :data-value="selectedPack.id"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-controls="listboxId"
      @click="isOpen ? closeMenu() : openMenu()"
      @keydown="handleTriggerKeydown"
    >
      <span class="food-marker-pack-option__preview" aria-hidden="true">
        <img
          v-for="rule in previewRules"
          :key="rule"
          :src="foodMarkerPackPreviewSource(selectedPack.id, rule)"
          alt=""
          loading="lazy"
          decoding="async"
        />
      </span>
      <span class="food-marker-pack-option__copy">
        <strong>{{ selectedPack.label }}</strong>
        <small>{{ selectedPack.description }}</small>
      </span>
      <span class="food-marker-pack-select__chevron" aria-hidden="true">⌄</span>
    </button>

    <div
      v-if="isOpen"
      :id="listboxId"
      class="food-marker-pack-select__menu"
      role="listbox"
      aria-label="Набор картинок"
      @keydown="handleListboxKeydown"
    >
      <button
        v-for="(pack, index) in availablePacks"
        :key="pack.id"
        :ref="(element) => setOptionRef(element, index)"
        class="food-marker-pack-option"
        :class="{ 'food-marker-pack-option--selected': pack.id === selectedPack.id }"
        type="button"
        role="option"
        :aria-selected="pack.id === selectedPack.id"
        :data-testid="`food-marker-pack-option-${pack.id}`"
        @click="selectPack(pack.id)"
      >
        <span class="food-marker-pack-option__preview" aria-hidden="true">
          <img
            v-for="rule in previewRules"
            :key="rule"
            :src="foodMarkerPackPreviewSource(pack.id, rule)"
            alt=""
            loading="lazy"
            decoding="async"
          />
        </span>
        <span class="food-marker-pack-option__copy">
          <strong>{{ pack.label }}</strong>
          <small>{{ pack.description }}</small>
        </span>
        <span v-if="pack.id === selectedPack.id" class="food-marker-pack-option__check" aria-hidden="true">✓</span>
      </button>
    </div>
  </div>
</template>
