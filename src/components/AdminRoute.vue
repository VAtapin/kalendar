<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref } from 'vue';
import AdminLoginDialog from './AdminLoginDialog.vue';
import { adminRequest } from '../collaboration/shared-project-client';
import { navigate } from '../navigation';
const Admin = defineAsyncComponent(() => import('./AdminDialog.vue'));
const ready = ref(false), authenticated = ref(false), error = ref('');
onMounted(async () => {
  try { authenticated.value = (await adminRequest<{authenticated:boolean}>('', 'session')).authenticated; }
  catch(e) { error.value = String(e); }
  finally { ready.value = true; }
});
</script>
<template>
  <p v-if="error" role="alert">{{ error }}</p>
  <p v-if="!ready" role="status">…</p>
  <Admin v-else-if="authenticated" access-token="" close-label="На главную" @close="navigate('/')" @logout="authenticated = false" />
  <AdminLoginDialog v-else @authenticated="authenticated = true" @close="navigate('/')" />
</template>
