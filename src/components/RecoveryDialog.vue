<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import type { ProjectBackup } from "../persistence/project-storage";
import { INTERFACE_LANGUAGE_LOCALES, interfaceLanguage } from "../i18n/interface-language";

defineProps<{
  backups: ProjectBackup[];
}>();

const emit = defineEmits<{
  close: [];
  restore: [backup: ProjectBackup];
}>();

const dialog = ref<HTMLElement>();

function formatBackupTime(value: string): string {
  return new Intl.DateTimeFormat(INTERFACE_LANGUAGE_LOCALES[interfaceLanguage.value], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

onMounted(async () => {
  await nextTick();
  dialog.value?.focus();
});
</script>

<template>
  <div class="application-dialog-backdrop" @click.self="emit('close')">
    <section
      ref="dialog"
      class="application-dialog recovery-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Восстановление проекта"
      tabindex="-1"
      @keydown.esc.stop="emit('close')"
    >
      <header class="application-dialog__header">
        <div>
          <span class="application-dialog__eyebrow">Файл проекта</span>
          <h2>Восстановление</h2>
        </div>
        <button type="button" class="application-dialog__close" aria-label="Закрыть" @click="emit('close')">×</button>
      </header>
      <div class="application-dialog__content">
        <p class="recovery-dialog__intro">Выберите локальную резервную точку. На кнопке показаны только дата и время; описание доступно при наведении.</p>
        <div v-if="backups.length" class="recovery-dialog__list">
          <button
            v-for="backup in backups"
            :key="backup.id"
            type="button"
            :title="backup.label"
            @click="emit('restore', backup)"
          >
            <span>{{ formatBackupTime(backup.createdAt) }}</span>
            <small>Восстановить</small>
          </button>
        </div>
        <p v-else class="empty-panel-message">Резервных точек пока нет.</p>
      </div>
      <footer class="application-dialog__footer">
        <button type="button" class="primary-action" @click="emit('close')">Закрыть</button>
      </footer>
    </section>
  </div>
</template>
