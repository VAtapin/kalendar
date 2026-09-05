<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  busy: boolean;
  sentTo?: string;
  error?: string;
  developmentVerificationUrl?: string;
}>();

const emit = defineEmits<{
  submit: [email: string, subscribe: boolean];
  close: [];
}>();

const email = ref("");
const subscribe = ref(false);
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
          <p>Письмо отправлено на <strong>{{ sentTo }}</strong>. Нажмите ссылку в письме — можно на телефоне или другом устройстве.</p>
          <p class="application-dialog__note">Этот браузер получит подтверждение автоматически. Ссылка действует 30 минут. Если закроете вкладку, откройте мастерскую в этом же браузере — запрос сохранён.</p>
          <p v-if="error" class="online-dialog__error" role="status">{{ error }}</p>
          <a v-if="developmentVerificationUrl" class="development-verification-link" :href="developmentVerificationUrl">Открыть тестовую ссылку подтверждения</a>
        </template>
        <form v-else @submit.prevent="emit('submit', email, subscribe)">
          <p>Подтвердите адрес для входа и серверных функций календаря. Подписка на новости необязательна.</p>
          <label class="field-stack"><span>E-mail</span><input v-model.trim="email" type="email" autocomplete="email" required autofocus placeholder="name@example.com" /></label>
          <label style="display:flex;gap:10px;margin:18px 0;align-items:flex-start;line-height:1.5;">
            <input v-model="subscribe" type="checkbox" style="width:auto;flex:none;margin-top:4px;" />
            <span>Хочу получать по электронной почте новости Календарной мастерской и напоминания о создании календарей. Отписаться можно в любой момент.</span>
          </label>
          <p class="application-dialog__note">Если галочка отмечена, одна ссылка в письме подтвердит и адрес, и подписку. Без галочки рассылок не будет. Серверные календари доступны владельцу мастерской для просмотра и поддержки.</p>
          <p v-if="error" class="online-dialog__error">{{ error }}</p>
          <button class="primary-action online-dialog__submit" type="submit" :disabled="busy || !email">{{ busy ? 'Отправляем…' : 'Получить ссылку' }}</button>
        </form>
      </div>
    </section>
  </div>
</template>
