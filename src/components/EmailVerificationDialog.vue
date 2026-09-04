<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  busy: boolean;
  sentTo?: string;
  error?: string;
  developmentVerificationUrl?: string;
}>();

const emit = defineEmits<{
  submit: [email: string];
  close: [];
}>();

const email = ref("");
</script>

<template>
  <div class="application-dialog-backdrop">
    <section class="application-dialog online-dialog" role="dialog" aria-modal="true" aria-label="Подтверждение e-mail">
      <header class="application-dialog__header">
        <div><span class="application-dialog__eyebrow">Первый календарь</span><h2>Подтвердите e-mail</h2></div>
        <button type="button" class="application-dialog__close" aria-label="Закрыть" :disabled="busy" @click="emit('close')">×</button>
      </header>
      <div class="application-dialog__content">
        <template v-if="sentTo">
          <p>Письмо отправлено на <strong>{{ sentTo }}</strong>. Откройте ссылку из письма — пароль и регистрация не нужны.</p>
          <p class="application-dialog__note">Ссылка действует 30 минут. Эту вкладку можно закрыть.</p>
          <a v-if="developmentVerificationUrl" class="development-verification-link" :href="developmentVerificationUrl">Открыть тестовую ссылку подтверждения</a>
        </template>
        <form v-else @submit.prevent="emit('submit', email)">
          <p>Мы запрашиваем адрес один раз. Он нужен только для подтверждения, что календарь создаёт человек, и для серверного экспорта PDF.</p>
          <label class="field-stack"><span>E-mail</span><input v-model.trim="email" type="email" autocomplete="email" required autofocus placeholder="name@example.com" /></label>
          <p v-if="error" class="online-dialog__error">{{ error }}</p>
          <button class="primary-action online-dialog__submit" type="submit" :disabled="busy || !email">{{ busy ? 'Отправляем…' : 'Получить ссылку' }}</button>
        </form>
      </div>
    </section>
  </div>
</template>
