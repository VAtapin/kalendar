<script setup lang="ts">
import { ref } from "vue";
import { BUILT_IN_PRINT_PROFILES, type PrintProfileChoice } from "../export/print-profile";

defineProps<{ customProfileName?: string; busy?: boolean; error?: string }>();
const emit = defineEmits<{
  close: [];
  upload: [];
  confirm: [choice: PrintProfileChoice];
}>();
const selected = ref<PrintProfileChoice>("coated");
</script>

<template>
  <div class="application-dialog-backdrop" @click.self="!busy && emit('close')">
    <section class="application-dialog profile-dialog" role="dialog" aria-modal="true" aria-label="Профиль бумаги для печатного PDF">
      <header class="application-dialog__header">
        <div>
          <span class="application-dialog__eyebrow">PDF/X-1a:2001 · PDF 1.3</span>
          <h2>Для какой бумаги подготовить PDF?</h2>
        </div>
        <button type="button" class="application-dialog__close" aria-label="Закрыть" :disabled="busy" @click="emit('close')">×</button>
      </header>
      <form class="application-dialog__content profile-dialog__content" @submit.prevent="emit('confirm', selected)">
        <p>Выберите бумагу по данным заказа. Цвета будут преобразованы в соответствующий CMYK-профиль, а прозрачности сведены.</p>
        <label v-for="profile in BUILT_IN_PRINT_PROFILES" :key="profile.id" class="profile-dialog__option">
          <input v-model="selected" type="radio" name="print-profile" :value="profile.id" />
          <span><strong>{{ profile.label }}</strong><small>{{ profile.name }}</small></span>
        </label>
        <label class="profile-dialog__option">
          <input v-model="selected" type="radio" name="print-profile" value="custom" />
          <span><strong>Другая бумага или типография</strong><small>{{ customProfileName || 'Нужен CMYK ICC-профиль типографии' }}</small></span>
        </label>
        <button v-if="selected === 'custom'" type="button" class="secondary-action" :disabled="busy" @click="emit('upload')">
          {{ customProfileName ? 'Заменить ICC-профиль…' : 'Загрузить ICC-профиль…' }}
        </button>
        <p v-if="error" class="online-dialog__error">{{ error }}</p>
        <div class="profile-dialog__actions">
          <button type="button" class="secondary-action" :disabled="busy" @click="emit('close')">Отмена</button>
          <button type="submit" class="primary-action" :disabled="busy || (selected === 'custom' && !customProfileName)">
            {{ busy ? 'Формирование…' : 'Сформировать PDF для печати' }}
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
.profile-dialog__actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
</style>
