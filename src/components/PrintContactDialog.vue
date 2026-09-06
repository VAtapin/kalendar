<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import LegalLinks from './LegalLinks.vue';
const emit = defineEmits<{ close: [] }>();
const closeButton = ref<HTMLButtonElement>();
let previousFocus: HTMLElement | null = null;
function keydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopImmediatePropagation();
    emit('close');
  }
}
onMounted(() => {
  previousFocus = document.activeElement as HTMLElement | null;
  closeButton.value?.focus();
  window.addEventListener('keydown', keydown, true);
});
onUnmounted(() => {
  window.removeEventListener('keydown', keydown, true);
  previousFocus?.focus();
});
</script>

<template>
  <div class="application-dialog-backdrop print-contact-backdrop" @click.self="emit('close')">
    <section class="application-dialog print-contact-dialog" role="dialog" aria-modal="true" aria-labelledby="print-contact-title">
      <header class="application-dialog__header">
        <h2 id="print-contact-title">Заказать печать календаря</h2>
        <button ref="closeButton" type="button" class="application-dialog__close" aria-label="Закрыть" @click="emit('close')">×</button>
      </header>
      <div class="application-dialog__content">
        <p>Для заказа печати свяжитесь с нами по следующим контактным данным:</p>
        <address>
          <span>Volodymyr Atapin · ATAPIN.DE</span>
          <a href="tel:+491713517274">+49 171 351 72 74</a>
          <a href="mailto:atapin@gmail.com">atapin@gmail.com</a>
        </address>
        <p>Тираж, стоимость и детали печати обсудим лично.</p>
        <LegalLinks />
      </div>
    </section>
  </div>
</template>

<style scoped>
.print-contact-backdrop { z-index: 2100; }
.print-contact-dialog { width: min(560px, 94vw); }
address { display: grid; gap: 16px; margin: 24px 0; font-style: normal; font-size: 20px; }
address a { color: #e6cd8e; overflow-wrap: anywhere; }
</style>
