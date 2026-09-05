<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  DECOR_CATEGORY_LABELS,
  type DecorCategory,
  type DecorLibraryItem,
} from "../decor/decor-library";

const props = defineProps<{ items: readonly DecorLibraryItem[] }>();
const emit = defineEmits<{ insert: [item: DecorLibraryItem] }>();

const search = ref("");
const collection = ref<"gold" | "svg">("gold");
const category = ref<"all" | DecorCategory>("all");
const categories = Object.entries(DECOR_CATEGORY_LABELS) as Array<[DecorCategory, string]>;
const collectionItems = computed(() => props.items.filter((item) =>
  collection.value === "gold" ? item.kind === "image" : item.kind !== "image",
));
const visibleItems = computed(() => {
  const query = search.value.trim().toLocaleLowerCase("ru");
  return collectionItems.value.filter((item) =>
    (category.value === "all" || item.category === category.value) &&
    (!query || `${item.label} ${item.sourceId}`.toLocaleLowerCase("ru").includes(query)),
  );
});

watch(collection, () => {
  category.value = "all";
});

function previewSource(item: DecorLibraryItem): string {
  return item.kind === "image"
    ? item.source.replace("/assets/decor/gold-print/", "/assets/decor/gold-print-previews/")
    : item.source;
}
</script>

<template>
  <div class="decor-library">
    <div class="decor-library__collections" role="group" aria-label="Коллекция элементов">
      <button
        type="button"
        :class="['decor-library__collection', { 'is-active': collection === 'gold' }]"
        :aria-pressed="collection === 'gold'"
        data-testid="decor-collection-gold"
        @click="collection = 'gold'"
      >
        Золотые
      </button>
      <button
        type="button"
        :class="['decor-library__collection', { 'is-active': collection === 'svg' }]"
        :aria-pressed="collection === 'svg'"
        data-testid="decor-collection-svg"
        @click="collection = 'svg'"
      >
        SVG
      </button>
    </div>
    <div class="decor-library__controls">
      <label class="field-stack">
        <span>Поиск</span>
        <input v-model="search" type="search" placeholder="Рамка, крест, угол…" />
      </label>
      <label class="field-stack">
        <span>Раздел</span>
        <select v-model="category">
          <option value="all">Все элементы</option>
          <option v-for="([id, label]) in categories" :key="id" :value="id">{{ label }}</option>
        </select>
      </label>
    </div>
    <p class="decor-library__summary">
      {{ visibleItems.length }} из {{ collectionItems.length }} · щелчок вставляет на новый верхний слой
    </p>
    <div class="decor-library__grid">
      <button
        v-for="item in visibleItems"
        :key="item.id"
        type="button"
        class="decor-library__item"
        :title="`${item.label} · ${item.kind === 'image' ? `PNG, ${item.nominalDpi ?? 300} dpi` : `исходник ${item.sourceId}`}`"
        @click="emit('insert', item)"
      >
        <span class="decor-library__preview"><img :src="previewSource(item)" alt="" loading="lazy" decoding="async" /></span>
        <span class="decor-library__item-label">{{ item.label }}</span>
        <small v-if="item.kind === 'image'" class="decor-library__item-meta">PNG · {{ item.nominalDpi ?? 300 }} dpi</small>
      </button>
    </div>
    <p v-if="visibleItems.length === 0" class="empty-panel-message">По этому запросу элементов нет.</p>
  </div>
</template>
