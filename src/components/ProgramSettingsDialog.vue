<script setup lang="ts">
import { ref, watch } from "vue";
import type { InterfaceLanguage } from "../document/types";
import { INTERFACE_LANGUAGE_OPTIONS } from "../i18n/interface-language";

const props = defineProps<{
  language: InterfaceLanguage;
  verified: boolean;
  busy?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  close: [];
  save: [language: InterfaceLanguage];
}>();

const selectedLanguage = ref(props.language);
watch(() => props.language, (language) => { selectedLanguage.value = language; });
</script>

<template>
  <div class="application-dialog-backdrop" @click.self="emit('close')">
    <section
      class="application-dialog settings-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Настройки программы"
    >
      <header class="application-dialog__header">
        <div>
          <span class="application-dialog__eyebrow">Календарная мастерская</span>
          <h2>Настройки программы</h2>
        </div>
        <button
          type="button"
          class="application-dialog__close"
          aria-label="Закрыть"
          :disabled="busy"
          @click="emit('close')"
        >×</button>
      </header>

      <form class="application-dialog__content settings-dialog__content" @submit.prevent="emit('save', selectedLanguage)">
        <fieldset class="settings-dialog__fieldset">
          <legend>Язык интерфейса</legend>
          <label
            v-for="option in INTERFACE_LANGUAGE_OPTIONS"
            :key="option.id"
            class="settings-dialog__language"
            :class="{ 'settings-dialog__language--selected': selectedLanguage === option.id }"
          >
            <input v-model="selectedLanguage" type="radio" name="interface-language" :value="option.id" />
            <span :lang="option.id">{{ option.nativeLabel }}</span>
          </label>
        </fieldset>

        <p>Эта настройка меняет только меню, подсказки и окна программы. Язык печатного календаря выбирается отдельно в свойствах календаря.</p>
        <p class="application-dialog__note">
          {{ verified
            ? 'Настройка сохранена для подтверждённого пользователя и этого календаря. Она также применяется при открытии общей ссылки.'
            : 'Настройка сохранена на этом компьютере.' }}
        </p>
        <p v-if="error" class="online-dialog__error">{{ error }}</p>

        <div class="settings-dialog__actions">
          <button type="button" class="secondary-action" :disabled="busy" @click="emit('close')">Отмена</button>
          <button type="submit" class="primary-action" :disabled="busy">
            {{ busy ? 'Сохранение…' : 'Применить' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.settings-dialog {
  width: min(520px, calc(100vw - 32px));
}

.settings-dialog__content {
  display: grid;
  gap: 14px;
}

.settings-dialog__content p {
  margin: 0;
}

.settings-dialog__fieldset {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}

.settings-dialog__fieldset legend {
  grid-column: 1 / -1;
  margin-bottom: 8px;
  color: #f2ead2;
  font-weight: 700;
}

.settings-dialog__language {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 42px;
  padding: 8px 11px;
  border: 1px solid #43554e;
  border-radius: 6px;
  background: #17221e;
  cursor: pointer;
}

.settings-dialog__language:hover,
.settings-dialog__language--selected {
  border-color: #b9913c;
  background: #262d22;
}

.settings-dialog__language input {
  accent-color: #d4aa4d;
}

.settings-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

@media (max-width: 520px) {
  .settings-dialog__fieldset {
    grid-template-columns: 1fr;
  }
}
</style>
