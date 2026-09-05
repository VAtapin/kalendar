<script setup lang="ts">
import { ref } from "vue";
import { adminRequest } from "../collaboration/shared-project-client";
const emit = defineEmits<{ authenticated: []; close: [] }>();
const login = ref("");
const password = ref("");
const busy = ref(false);
const error = ref("");
async function submit() {
  busy.value = true; error.value = "";
  try {
    await adminRequest("", "login", {login: login.value.trim(), password: password.value});
    password.value = "";
    emit("authenticated");
  } catch (e) { error.value = e instanceof Error ? e.message : String(e); }
  finally { busy.value = false; }
}
</script>
<template>
  <div class="application-dialog-backdrop">
    <section class="application-dialog online-dialog" role="dialog" aria-modal="true" aria-label="Вход администратора">
      <header class="application-dialog__header"><h2>Вход администратора</h2><button class="application-dialog__close" :disabled="busy" aria-label="Закрыть" @click="emit('close')">×</button></header>
      <form class="application-dialog__content" @submit.prevent="submit">
        <p>Отдельный вход для управления мастерской и общими макетами. Подтверждение e-mail не требуется.</p>
        <label class="field-stack"><span>Логин</span><input v-model="login" autocomplete="username" maxlength="100" required autofocus /></label>
        <label class="field-stack"><span>Пароль</span><input v-model="password" type="password" autocomplete="current-password" maxlength="1024" required /></label>
        <p v-if="error" class="online-dialog__error" role="alert">{{ error }}</p>
        <button class="primary-action online-dialog__submit" :disabled="busy" type="submit">{{ busy ? 'Входим…' : 'Войти' }}</button>
      </form>
    </section>
  </div>
</template>
