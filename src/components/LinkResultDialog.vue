<script setup lang="ts">
defineProps<{
  kind: "share" | "pdf";
  url: string;
  detail?: string;
}>();

const emit = defineEmits<{
  close: [];
  copy: [];
}>();
</script>

<template>
  <div class="application-dialog-backdrop" @click.self="emit('close')">
    <section class="application-dialog online-dialog" role="dialog" aria-modal="true" :aria-label="kind === 'share' ? 'Ссылка на календарь' : 'PDF готов'">
      <header class="application-dialog__header">
        <div><span class="application-dialog__eyebrow">{{ kind === 'share' ? 'Совместная работа' : 'Серверный экспорт' }}</span><h2>{{ kind === 'share' ? 'Ссылка на календарь готова' : 'PDF сохранён на сервере' }}</h2></div>
        <button type="button" class="application-dialog__close" aria-label="Закрыть" @click="emit('close')">×</button>
      </header>
      <div class="application-dialog__content">
        <p>{{ kind === 'share' ? 'Отправьте эту ссылку другому человеку. Пока вы работаете, он сможет подождать или создать независимую копию.' : 'Скачивание можно повторить или продолжить после разрыва соединения по этой ссылке.' }}</p>
        <label class="field-stack"><span>Ссылка</span><input :value="url" type="url" readonly @focus="($event.target as HTMLInputElement).select()" /></label>
        <p v-if="detail" class="application-dialog__note">{{ detail }}</p>
        <div class="online-dialog__actions"><button type="button" class="primary-action" @click="emit('copy')">Копировать ссылку</button><a class="button-link" :href="url" :download="kind === 'pdf' ? '' : undefined" target="_blank" rel="noreferrer">{{ kind === 'pdf' ? 'Скачать PDF' : 'Открыть ссылку' }}</a></div>
      </div>
    </section>
  </div>
</template>
