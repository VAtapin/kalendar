<script setup lang="ts">
import type { SharedEditorPresence } from "../collaboration/shared-project-types";
import { INTERFACE_LANGUAGE_LOCALES, interfaceLanguage } from "../i18n/interface-language";

defineProps<{
  mode: "loading" | "locked" | "waiting" | "error";
  editor?: SharedEditorPresence;
  error?: string;
  busy?: boolean;
}>();

const emit = defineEmits<{
  wait: [];
  retry: [];
  copy: [];
  home: [];
}>();

function time(value?: string): string {
  return value ? new Date(value).toLocaleTimeString(INTERFACE_LANGUAGE_LOCALES[interfaceLanguage.value], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
}
</script>

<template>
  <div class="application-dialog-backdrop shared-lock-backdrop">
    <section class="application-dialog online-dialog" role="dialog" aria-modal="true" aria-label="Совместная работа">
      <header class="application-dialog__header">
        <div><span class="application-dialog__eyebrow">Общий календарь</span><h2>{{ mode === 'error' ? 'Не удалось открыть' : mode === 'loading' ? 'Открываем календарь…' : 'Календарь сейчас занят' }}</h2></div>
      </header>
      <div class="application-dialog__content">
        <p v-if="mode === 'loading'">Загружаем проект и проверяем право редактирования.</p>
        <template v-else-if="mode === 'error'">
          <p class="online-dialog__error">{{ error }}</p>
          <div class="online-dialog__actions"><button type="button" class="primary-action" @click="emit('retry')">Повторить</button><button type="button" @click="emit('home')">На главную</button></div>
        </template>
        <template v-else>
          <p><strong>{{ editor?.label ?? 'Другой редактор' }}</strong> открыл этот документ. Одновременное редактирование выключено, чтобы изменения не перезаписывали друг друга.</p>
          <p class="application-dialog__note">Последний сигнал: {{ time(editor?.lastSeenAt) }}. Если вкладку закрыли или пропала связь, доступ освободится автоматически примерно через 45 секунд.</p>
          <p v-if="mode === 'waiting'" class="online-dialog__waiting"><i></i> Ждём освобождения и проверяем автоматически…</p>
          <div class="online-dialog__actions">
            <button type="button" class="primary-action" :disabled="busy" @click="emit('copy')">Сделать копию</button>
            <button v-if="mode !== 'waiting'" type="button" @click="emit('wait')">Подождать</button>
            <button v-else type="button" @click="emit('retry')">Проверить сейчас</button>
            <button type="button" @click="emit('home')">На главную</button>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>
