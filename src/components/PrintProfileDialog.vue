<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { BUILT_IN_PRINT_PROFILES, type PrintProfileChoice } from "../export/print-profile";

const props = defineProps<{
  customProfileName?: string;
  busy?: boolean;
  stage?: "render" | "upload" | "convert";
  uploadPercent?: number;
  pageProgress?: { current: number; total: number };
  error?: string;
}>();
const emit = defineEmits<{
  close: [];
  upload: [];
  confirm: [choice: PrintProfileChoice];
}>();
const selected = ref<PrintProfileChoice>("coated");
const conversionSeconds = ref(0);
let conversionStartedAt = 0;
let conversionTimer: ReturnType<typeof setInterval> | undefined;

watch(() => [props.busy, props.stage] as const, ([busy, stage]) => {
  if (conversionTimer) clearInterval(conversionTimer);
  conversionTimer = undefined;
  if (busy && stage === "convert") {
    conversionStartedAt = Date.now();
    conversionSeconds.value = 0;
    conversionTimer = setInterval(() => {
      conversionSeconds.value = Math.floor((Date.now() - conversionStartedAt) / 1000);
    }, 1000);
  }
});
onBeforeUnmount(() => { if (conversionTimer) clearInterval(conversionTimer); });
const conversionElapsed = computed(() => `${Math.floor(conversionSeconds.value / 60)}:${String(conversionSeconds.value % 60).padStart(2, "0")}`);
</script>

<template>
  <div class="application-dialog-backdrop" @click.self="!busy && emit('close')">
    <section class="application-dialog profile-dialog" role="dialog" aria-modal="true" aria-label="Формат PDF">
      <header class="application-dialog__header">
        <div>
          <span class="application-dialog__eyebrow">{{ selected === 'rgb' ? 'RGB · стандартный PDF' : 'PDF/X-1a:2001 · PDF 1.3' }}</span>
          <h2>{{ selected === 'rgb' ? 'Какой PDF подготовить?' : 'Для какой бумаги подготовить PDF?' }}</h2>
        </div>
        <button type="button" class="application-dialog__close" aria-label="Закрыть" :disabled="busy" @click="emit('close')">×</button>
      </header>
      <form class="application-dialog__content profile-dialog__content" @submit.prevent="emit('confirm', selected)">
        <p>{{ selected === 'rgb' ? 'Стандартный RGB PDF, как в прежнем экспорте: без преобразования в CMYK и PDF/X.' : 'Выберите бумагу по данным заказа. Цвета будут преобразованы в соответствующий CMYK-профиль, а прозрачности сведены.' }}</p>
        <label v-for="profile in BUILT_IN_PRINT_PROFILES" :key="profile.id" class="profile-dialog__option">
          <input v-model="selected" type="radio" name="print-profile" :value="profile.id" />
          <span><strong>{{ profile.label }}</strong><small>{{ profile.name }}</small></span>
        </label>
        <label class="profile-dialog__option">
          <input v-model="selected" type="radio" name="print-profile" value="custom" />
          <span><strong>Другая бумага или типография</strong><small>{{ customProfileName || 'Нужен CMYK ICC-профиль типографии' }}</small></span>
        </label>
        <label class="profile-dialog__option">
          <input v-model="selected" type="radio" name="print-profile" value="rgb" />
          <span><strong>RGB — стандартный PDF</strong><small>Прежний вариант, без выбора бумаги и ICC-профиля</small></span>
        </label>
        <button v-if="selected === 'custom'" type="button" class="secondary-action" :disabled="busy" @click="emit('upload')">
          {{ customProfileName ? 'Заменить ICC-профиль…' : 'Загрузить ICC-профиль…' }}
        </button>
        <div v-if="busy" class="profile-dialog__progress" role="status" aria-live="polite">
          <span class="profile-dialog__spinner" aria-hidden="true"></span>
          <div>
            <strong v-if="stage === 'upload'"><span>{{ selected === 'rgb' ? 'Передаём PDF на сервер' : 'Передаём страницы на сервер' }}</span>: {{ uploadPercent ?? 0 }}%</strong>
            <strong v-else-if="stage === 'convert'">Создаём CMYK PDF/X-1a из страниц календаря</strong>
            <strong v-else-if="selected === 'rgb'">Формируем стандартный RGB PDF</strong>
            <strong v-else><span>Отрисовываем страницы календаря</span>: {{ pageProgress?.current ?? 0 }} / {{ pageProgress?.total ?? 0 }}</strong>
            <p v-if="stage === 'convert'"><span>Прошло</span> {{ conversionElapsed }}. <span>Сервер собирает страницы в печатный PDF. Не закрывайте вкладку.</span></p>
          </div>
        </div>
        <p v-if="error" class="online-dialog__error">{{ error }}</p>
        <div class="profile-dialog__actions">
          <button type="button" class="secondary-action" :disabled="busy" @click="emit('close')">Отмена</button>
          <button type="submit" class="primary-action" :disabled="busy || (selected === 'custom' && !customProfileName)">
            {{ busy ? 'Формирование…' : selected === 'rgb' ? 'Сформировать RGB PDF' : 'Сформировать PDF для печати' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.profile-dialog { width: min(570px, calc(100vw - 32px)); }
.profile-dialog__content { display: grid; gap: 12px; }
.profile-dialog__content p { margin: 0; }
.profile-dialog__option { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid #43554e; border-radius: 6px; background: #17221e; cursor: pointer; }
.profile-dialog__option:has(input:checked) { border-color: #b9913c; background: #262d22; }
.profile-dialog__option input { accent-color: #d4aa4d; }
.profile-dialog__option span { display: grid; gap: 3px; }
.profile-dialog__option small { color: #c8d0c8; }
.profile-dialog__progress { display: flex; align-items: flex-start; gap: 12px; padding: 12px; border: 1px solid #b9913c; border-radius: 6px; background: #262d22; }
.profile-dialog__progress p { margin-top: 4px; color: #c8d0c8; }
.profile-dialog__spinner { flex: none; width: 16px; height: 16px; margin-top: 2px; border: 2px solid #6d6d59; border-top-color: #d4aa4d; border-radius: 50%; animation: profile-spin 0.9s linear infinite; }
@keyframes profile-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .profile-dialog__spinner { animation: none; border-top-color: #d4aa4d; } }
.profile-dialog__actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
</style>
