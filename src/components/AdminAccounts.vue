<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { catalogRequest } from '../collaboration/catalog-client';
import type { AccountUser } from '../collaboration/account-client';
const users = ref<AccountUser[]>([]); const error = ref(''); const busy = ref(false);
const search = ref('');
const visibleUsers = computed(() => users.value.filter(user => user.email.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())));
async function load() { users.value = (await catalogRequest<{items: AccountUser[]}>('admin/accounts')).items; }
async function block(user: AccountUser) {
  if (!window.confirm(`${user.blocked ? 'Разблокировать' : 'Заблокировать'} ${user.email}?`)) return;
  busy.value = true; error.value = '';
  try { await catalogRequest(`admin/accounts/${user.id}`, 'PUT', {blocked: !user.blocked}); await load(); }
  catch (e) { error.value = String(e); } finally { busy.value = false; }
}
onMounted(async () => { try { await load(); } catch (e) { error.value = String(e); } });
</script>
<template><section><h2>Учётные записи</h2><p>Подтверждённые аккаунты. Пароли не доступны администратору; восстановление выполняет сам пользователь через письмо.</p><label>Поиск пользователя <input v-model="search" type="search" placeholder="E-mail" /></label><p>Найдено: {{ visibleUsers.length }} из {{ users.length }}</p><p v-if="error" role="alert">{{ error }}</p><p v-if="!users.length">Аккаунтов пока нет.</p><article v-for="user in visibleUsers" :key="user.id"><strong>{{ user.email }}</strong><p>{{ user.blocked ? 'Заблокирован' : 'Активен' }} · {{ user.createdAt }}</p><button :disabled="busy" @click="block(user)">{{ user.blocked ? 'Разблокировать' : 'Заблокировать и завершить сеансы' }}</button></article></section></template>
<style scoped>article{border-bottom:1px solid #52614e;padding:20px}button{font:inherit;color:inherit;background:#2a3c30;border:1px solid #647458;padding:10px;border-radius:5px;cursor:pointer}</style>
