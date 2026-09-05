<script setup lang="ts">
import { computed } from "vue";
import type { GlobalCalendarGridTemplate } from "../templates/calendar-grid-presets";

const props = defineProps<{
  template: GlobalCalendarGridTemplate;
  canManage: boolean;
  hasSelectedGrid: boolean;
}>();

defineEmits<{
  apply: [];
  applyAll: [];
  update: [];
  remove: [];
}>();

const weekdaySamples = computed(() => props.template.grid.weekdayLabelMode === "short"
  ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
  : ["Пон", "Вто", "Сре", "Чет", "Пят", "Суб", "Вос"]);
</script>

<template>
  <article class="grid-preset-card" :data-testid="`global-grid-template-${template.id}`">
    <button class="grid-preset-preview" type="button" title="Применить к выбранной сетке" @click="$emit('apply')">
      <span class="grid-preset-preview__weekdays" :style="{ fontFamily: template.grid.weekdayFontFamily }">
        <span v-for="(label, index) in weekdaySamples" :key="label" :class="{ sunday: index === 6 }">{{ label }}</span>
      </span>
      <span class="grid-preset-preview__days" :data-grid-style="template.grid.gridStyle ?? 'editorial'">
        <span v-for="day in [12, 13, 14]" :key="day" class="grid-preset-preview__day">
          <b :style="{ fontFamily: template.grid.dayNumberFontFamily }">{{ day }}</b>
          <i :style="{ fontFamily: template.grid.eventFontFamily }">Праздник<br />память святого</i>
        </span>
      </span>
    </button>
    <div class="grid-preset-card__copy">
      <strong>{{ template.name }}</strong>
      <small>{{ template.description }}</small>
    </div>
    <div class="grid-preset-card__actions">
      <button type="button" :disabled="!hasSelectedGrid" @click="$emit('apply')">Применить</button>
      <button type="button" title="Применить ко всем месяцам" @click="$emit('applyAll')">12 месяцев</button>
      <button v-if="canManage" type="button" :disabled="!hasSelectedGrid" title="Заменить макет оформлением выбранной сетки" @click="$emit('update')">Обновить</button>
      <button v-if="canManage && !template.builtIn" class="danger-action" type="button" title="Удалить общий макет" @click="$emit('remove')">Удалить</button>
    </div>
  </article>
</template>

<style scoped>
.grid-preset-card {
  display: grid;
  gap: 7px;
  padding: 8px;
  border: 1px solid #3c4742;
  border-radius: 6px;
  background: #17201d;
}

.grid-preset-preview {
  display: grid;
  gap: 3px;
  width: 100%;
  padding: 6px;
  overflow: hidden;
  border-color: #62552e;
  background: #f8f5ec;
  color: #17201d;
}

.grid-preset-preview__weekdays,
.grid-preset-preview__days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.grid-preset-preview__weekdays {
  gap: 1px;
  padding-bottom: 3px;
  border-bottom: 1px solid #4b554f;
  font-size: 6px;
  font-style: normal;
  text-align: center;
}

.grid-preset-preview__weekdays .sunday { color: #a02b27; }

.grid-preset-preview__days {
  grid-template-columns: repeat(3, 1fr);
  min-height: 40px;
}

.grid-preset-preview__day {
  display: grid;
  grid-template-columns: 18px 1fr;
  align-content: start;
  gap: 2px;
  padding: 3px;
  text-align: left;
}

.grid-preset-preview__days[data-grid-style="boxed"] .grid-preset-preview__day {
  border: 1px solid #747d78;
}

.grid-preset-preview__days[data-grid-style="editorial"] .grid-preset-preview__day {
  border-bottom: 1px dashed #747d78;
}

.grid-preset-preview__day b {
  font-size: 15px;
  line-height: 1;
}

.grid-preset-preview__day i {
  overflow: hidden;
  font-size: 5.5px;
  font-style: normal;
  line-height: 1.15;
}

.grid-preset-card__copy {
  display: grid;
  gap: 2px;
}

.grid-preset-card__copy strong { color: #f1dfaa; font-size: 11px; }
.grid-preset-card__copy small { color: #99a69f; font-size: 9px; line-height: 1.35; }

.grid-preset-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.grid-preset-card__actions button {
  flex: 1 1 auto;
  min-width: 64px;
  padding: 5px 7px;
  font-size: 9px;
}

.grid-preset-card__actions .danger-action { color: #efb1aa; }
</style>
