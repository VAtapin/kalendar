<script setup lang="ts">
import {computed, ref, watch} from "vue";
import type {IconLibraryFilters} from "../icons/bible-desktop-icon-api";
import {iconKindLabel, type IconLibraryCard} from "../icons/icon-library";

const props = defineProps<{
  items: IconLibraryCard[];
  month?: number;
  loading?: boolean;
  error?: string;
  total: number;
  page: number;
  perPage: number;
  filters: IconLibraryFilters;
}>();
const emit = defineEmits<{
  insert: [item: IconLibraryCard, caption: boolean];
  drag: [item: IconLibraryCard, caption: boolean, event: DragEvent];
  refresh: [];
  filters: [filters: IconLibraryFilters, perPage: number];
  page: [page: number];
}>();

const query = ref(props.filters.query);
const kind = ref(props.filters.kind);
const celebrationMonth = ref(props.filters.month ? String(props.filters.month) : "");
const dateKind = ref(props.filters.movable === undefined ? "" : props.filters.movable ? "movable" : "fixed");
const caption = ref(true);
const perPage = ref(props.perPage);
const monthNames = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const kinds = ["mother-of-god", "savior", "saint"];

watch(() => props.filters, (filters) => {
  query.value = filters.query;
  kind.value = filters.kind;
  celebrationMonth.value = filters.month ? String(filters.month) : "";
  dateKind.value = filters.movable === undefined ? "" : filters.movable ? "movable" : "fixed";
}, {deep: true});
watch(() => props.perPage, value => { perPage.value = value; });

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.perPage)));
const pageNumbers = computed<Array<number | null>>(() => {
  const values = new Set([1, pageCount.value, props.page - 2, props.page - 1, props.page, props.page + 1, props.page + 2]);
  const ordered = [...values].filter(value => value >= 1 && value <= pageCount.value).sort((a, b) => a - b);
  return ordered.flatMap((value, index) => index && value > ordered[index - 1]! + 1 ? [null, value] : [value]);
});
const hasFilters = computed(() => Boolean(query.value || kind.value || celebrationMonth.value || dateKind.value));

function filters(): IconLibraryFilters {
  return {
    query: query.value,
    kind: kind.value,
    month: celebrationMonth.value ? Number(celebrationMonth.value) : undefined,
    movable: dateKind.value === "" ? undefined : dateKind.value === "movable",
    withHistory: false,
  };
}

function applyFilters(): void {
  emit("filters", filters(), perPage.value);
}

function resetFilters(): void {
  query.value = "";
  kind.value = "";
  celebrationMonth.value = "";
  dateKind.value = "";
  applyFilters();
}
</script>

<template>
  <section class="icon-library-panel">
    <header>
      <div>
        <strong>Иконы</strong>
        <span v-if="month">Можно отобрать празднования месяца макета</span>
      </div>
      <button type="button" @click="emit('refresh')">Обновить</button>
    </header>

    <div class="icon-library-panel__filters">
      <input v-model="query" type="search" placeholder="Название или текст истории" @change="applyFilters" @keydown.enter.prevent="applyFilters" />
      <select v-model="kind" aria-label="Раздел икон" @change="applyFilters">
        <option value="">Все разделы</option>
        <option v-for="item in kinds" :key="item" :value="item">{{ iconKindLabel(item) }}</option>
      </select>
      <select v-model="celebrationMonth" aria-label="Месяц празднования" @change="applyFilters">
        <option value="">Любой месяц празднования</option>
        <option v-for="(name, index) in monthNames" :key="name" :value="String(index + 1)">{{ name }}</option>
      </select>
      <select v-model="dateKind" aria-label="Тип даты празднования" @change="applyFilters">
        <option value="">Неподвижные и переходящие</option>
        <option value="fixed">Только неподвижные</option>
        <option value="movable">Только переходящие</option>
      </select>
      <label><input v-model="caption" type="checkbox" /> Подпись под иконой</label>
      <div class="icon-library-panel__filter-actions">
        <button v-if="hasFilters" type="button" @click="resetFilters">Сбросить фильтры</button>
        <label>На странице
          <select v-model.number="perPage" @change="applyFilters"><option :value="24">24</option><option :value="48">48</option><option :value="72">72</option></select>
        </label>
      </div>
    </div>

    <p v-if="loading">Загрузка икон…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <template v-else>
      <p v-if="total" class="icon-library-panel__count">Найдено {{ total }} · страница {{ page }} из {{ pageCount }}</p>
      <div v-if="items.length" class="icon-library-panel__list">
        <article v-for="item in items" :key="item.id">
          <button type="button" draggable="true" :title="`Вставить или перетащить ${item.title}`" @dragstart="emit('drag', item, caption, $event)" @click="emit('insert', item, caption)">
            <img :src="item.images[0]?.imageUrl" :alt="item.title" />
            <span><strong>{{ item.title }}</strong><small>{{ iconKindLabel(item.kind) }}<template v-if="item.celebrations.length"> · {{ item.celebrations.map(day => day.label).join(', ') }}</template></small></span>
          </button>
        </article>
      </div>
      <p v-else>По выбранным условиям икон пока нет.</p>
      <nav v-if="pageCount > 1" class="icon-library-panel__pagination" aria-label="Страницы каталога икон">
        <button type="button" :disabled="page === 1" @click="emit('page', page - 1)">← Назад</button>
        <template v-for="(number, index) in pageNumbers" :key="`${number}-${index}`">
          <span v-if="number === null" aria-hidden="true">…</span>
          <button v-else type="button" :class="{ 'is-current': number === page }" :aria-current="number === page ? 'page' : undefined" @click="emit('page', number)">{{ number }}</button>
        </template>
        <button type="button" :disabled="page === pageCount" @click="emit('page', page + 1)">Вперёд →</button>
      </nav>
    </template>
  </section>
</template>
