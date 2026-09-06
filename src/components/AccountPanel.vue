<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import LegalLinks from './LegalLinks.vue';
import { accountRequest, type AccountUser, type AccountCalendar } from '../collaboration/account-client';
const props = defineProps<{ user: AccountUser | null; token?: string; externalError?: string; reauthenticate?: boolean }>();
const emit = defineEmits<{ close: []; authenticated: [user: AccountUser]; logout: []; open: [id: string]; create: []; import: []; deleted: [id: string] }>();
const email = ref(''); const password = ref(''); const repeatPassword = ref(''); const subscribe = ref(false);
const mode = ref(props.token ? 'password' : 'login'); const error = ref(''); const notice = ref(''); const busy = ref(false);
const calendars = ref<AccountCalendar[]>([]); const pendingDelete = ref('');
const search = ref('');
const visibleCalendars = computed(() => calendars.value.filter(item => `${item.name} ${item.year}`.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())));
const trash = ref<{id: string; name: string; year: number}[]>([]); const showingTrash = ref(false);
async function openTrash() {
  busy.value = true; error.value = '';
  try { trash.value = (await accountRequest<{items: typeof trash.value}>('trash')).items; showingTrash.value = true; }
  catch (e) { error.value = String(e); } finally { busy.value = false; }
}
async function restoreTrash(id: string) {
  busy.value = true; error.value = '';
  try { await accountRequest('trash/restore', 'POST', {id}); await load(); await openTrash(); notice.value = 'Календарь возвращён в личный кабинет'; }
  catch (e) { error.value = String(e); } finally { busy.value = false; }
}
async function download(calendar: AccountCalendar) {
  busy.value = true; error.value = '';
  try {
    const value = await accountRequest<{project: unknown}>(`calendars/${calendar.id}`);
    const url = URL.createObjectURL(new Blob([JSON.stringify({format:'orthodox-calendar-project',archiveVersion:1,savedAt:new Date().toISOString(),project:value.project})],{type:'application/json'}));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = calendar.name.replace(/[^\p{L}\p{N}._-]+/gu,'-') + '.kalendar'; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  } catch (e) { error.value = String(e); } finally { busy.value = false; }
}
const historyFor = ref<AccountCalendar>();
const backups = ref<{revision: number; at: string}[]>([]);
const settings = ref(false); const subscribed = ref(false); const consentText = ref('');
const oldPassword = ref(''); const newPassword = ref(''); const newPasswordRepeat = ref('');
async function openSettings() {
  busy.value = true; error.value = '';
  try { const value = await accountRequest<{subscribed: boolean; consentText: string}>('subscription'); subscribed.value = value.subscribed; consentText.value = value.consentText; settings.value = true; }
  catch (e) { error.value = String(e); } finally { busy.value = false; }
}
async function saveSubscription() {
  busy.value = true; error.value = '';
  try { await accountRequest('subscription','PUT',{subscribed: subscribed.value}); notice.value = 'Настройки подписки сохранены'; }
  catch (e) { error.value = String(e); } finally { busy.value = false; }
}
async function changePassword() {
  busy.value = true; error.value = '';
  try {
    if (newPassword.value !== newPasswordRepeat.value) throw new Error('Пароли не совпадают');
    await accountRequest('change-password','POST',{current: oldPassword.value, password: newPassword.value});
    oldPassword.value = ''; newPassword.value = ''; newPasswordRepeat.value = ''; notice.value = 'Пароль изменён. Другие сеансы завершены.';
  } catch (e) { error.value = String(e); } finally { busy.value = false; }
}
async function history(calendar: AccountCalendar) {
  busy.value = true; error.value = '';
  try { backups.value = (await accountRequest<{items: {revision: number; at: string}[]}>(`calendars/${calendar.id}/history`)).items; historyFor.value = calendar; }
  catch (e) { error.value = String(e); } finally { busy.value = false; }
}
async function restore(revision: number) {
  const calendar = historyFor.value; if (!calendar || !window.confirm('Восстановить выбранную серверную версию календаря?')) return;
  busy.value = true; error.value = '';
  try { await accountRequest(`calendars/${calendar.id}`, 'PUT', {revision: calendar.revision, restoreRevision: revision}); historyFor.value = undefined; await load(); notice.value = 'Версия восстановлена. Откройте календарь.'; }
  catch (e) { error.value = String(e); } finally { busy.value = false; }
}
async function load() { if (props.user && !props.reauthenticate) calendars.value = (await accountRequest<{items: AccountCalendar[]}>('calendars')).items; }
async function action() {
  busy.value = true; error.value = ''; notice.value = '';
  try {
    if (mode.value === 'email' || mode.value === 'reset') {
      await accountRequest('email', 'POST', { email: email.value, subscribe: mode.value === 'email' && subscribe.value, purpose: mode.value === 'reset' ? 'reset' : 'register' });
      notice.value = 'Письмо отправлено. Откройте ссылку, задайте пароль, затем войдите на любом устройстве.';
    } else {
      if (mode.value === 'password' && password.value !== repeatPassword.value) throw new Error('Пароли не совпадают');
      const user = await accountRequest<AccountUser>(mode.value === 'password' ? 'password' : 'login', 'POST', {email: email.value, password: password.value, token: props.token});
      password.value = ''; repeatPassword.value = ''; mode.value = 'login'; emit('authenticated', user);
      calendars.value = (await accountRequest<{items: AccountCalendar[]}>('calendars')).items;
    }
  } catch (e) { error.value = String(e); } finally { busy.value = false; }
}
async function logout() {
  busy.value = true;
  try { await accountRequest('logout', 'POST', {}); mode.value = 'login'; notice.value = ''; password.value = ''; repeatPassword.value = ''; calendars.value = []; settings.value = false; historyFor.value = undefined; backups.value = []; pendingDelete.value = ''; oldPassword.value = ''; newPassword.value = ''; newPasswordRepeat.value = ''; emit('logout'); }
  catch (e) { error.value = String(e); } finally { busy.value = false; }
}
async function remove(id: string) {
  busy.value = true; error.value = '';
  try { await accountRequest(`calendars/${id}`, 'DELETE'); pendingDelete.value = ''; emit('deleted', id); await load(); }
  catch (e) { error.value = String(e); } finally { busy.value = false; }
}
onMounted(async () => { try { await load(); } catch (e) { error.value = String(e); } });
</script>
<template>
  <div class="account-overlay">
    <section role="dialog" aria-modal="true" aria-label="Личный кабинет" class="account-panel">
      <header><div><small>КАЛЕНДАРНАЯ МАСТЕРСКАЯ</small><h1>Личный кабинет</h1><p v-if="user">{{ user.email }}</p></div><button :disabled="busy" @click="emit('close')">Закрыть</button></header>
      <p v-if="error || externalError" role="alert">{{ error || externalError }}</p><p v-if="notice" role="status">{{ notice }}</p>
      <LegalLinks />
      <template v-if="user && !reauthenticate">
        <nav><button :disabled="busy" @click="emit('create')">+ Новый календарь</button><button :disabled="busy" @click="emit('import')">Импортировать календарь</button><button :disabled="busy" @click="openSettings">Настройки аккаунта</button><button :disabled="busy" @click="logout">Выйти</button></nav>
        <section v-if="settings"><h2>Настройки</h2><label><input v-model="subscribed" type="checkbox" /> {{ consentText }}</label><button :disabled="busy" @click="saveSubscription">Сохранить подписку</button>
          <form @submit.prevent="changePassword"><h3>Изменить пароль</h3><label>Текущий пароль<input v-model="oldPassword" type="password" autocomplete="current-password" required maxlength="72" /></label><label>Новый пароль<input v-model="newPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="72" /></label><label>Повтор нового пароля<input v-model="newPasswordRepeat" type="password" autocomplete="new-password" required minlength="12" maxlength="72" /></label><button :disabled="busy">Изменить пароль</button></form><button @click="settings = false">Закрыть настройки</button>
        </section>
        <p>Календари и фотографии сохраняются на сервере. Скачать копию на компьютер можно из меню «Файл» в редакторе.</p>
        <label>Поиск календаря<input v-model="search" type="search" placeholder="Название или год" /></label>
        <button :disabled="busy" @click="openTrash">Корзина</button>
        <section v-if="showingTrash"><h2>Моя корзина</h2><p v-if="!trash.length">Корзина пуста.</p><p v-for="item in trash" :key="item.id">{{ item.name }} · {{ item.year }} <button :disabled="busy" @click="restoreTrash(item.id)">Вернуть календарь</button></p><button @click="showingTrash = false">Закрыть корзину</button></section>
        <p v-if="!calendars.length">Календарей пока нет. Создайте первый.</p>
        <p v-if="calendars.length && !visibleCalendars.length">По этому запросу ничего не найдено.</p>
        <div class="account-cards"><article v-for="calendar in visibleCalendars" :key="calendar.id"><h2>{{ calendar.name }}</h2><p>{{ calendar.year }} · {{ new Date(calendar.updatedAt).toLocaleString() }}</p>
          <button :disabled="busy" @click="download(calendar)">Скачать копию</button>
          <button :disabled="busy" @click="emit('open', calendar.id)">Открыть</button><button :disabled="busy" @click="pendingDelete = calendar.id">Удалить…</button>
          <button :disabled="busy" @click="history(calendar)">Восстановление</button>
          <div v-if="pendingDelete === calendar.id"><p>Убрать этот календарь из кабинета? Его можно будет вернуть из корзины.</p><button :disabled="busy" @click="remove(calendar.id)">Подтвердить удаление</button><button @click="pendingDelete = ''">Отмена</button></div>
        </article></div>
        <section v-if="historyFor"><h2>Версии: {{ historyFor.name }}</h2><p v-if="!backups.length">Предыдущих версий пока нет.</p><p v-for="backup in backups" :key="backup.revision">{{ new Date(backup.at).toLocaleString() }} · версия {{ backup.revision }} <button :disabled="busy" @click="restore(backup.revision)">Восстановить</button></p><button @click="historyFor = undefined">Закрыть версии</button></section>
      </template>
      <form v-else @submit.prevent="action">
        <h2>{{ mode === 'password' ? 'Установите пароль' : mode === 'email' ? 'Создать аккаунт' : mode === 'reset' ? 'Восстановление пароля' : 'Вход' }}</h2>
        <label v-if="mode !== 'password'">E-mail<input v-model="email" type="email" autocomplete="username" required maxlength="254" /></label>
        <template v-if="mode !== 'email' && mode !== 'reset'"><label>Пароль<input v-model="password" type="password" :autocomplete="mode === 'password' ? 'new-password' : 'current-password'" :minlength="mode === 'password' ? 12 : 1" maxlength="72" required /></label>
          <label v-if="mode === 'password'">Повторите пароль<input v-model="repeatPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="72" /></label>
        </template>
        <label v-if="mode === 'email'"><input v-model="subscribe" type="checkbox" /> Хочу получать новости мастерской и напоминания о календарях. Можно отписаться в каждом письме.</label>
        <button :disabled="busy">{{ busy ? 'Подождите…' : mode === 'email' || mode === 'reset' ? 'Получить письмо' : mode === 'password' ? 'Сохранить пароль и войти' : 'Войти' }}</button>
        <p><button type="button" :disabled="busy" @click="mode = mode === 'login' ? 'email' : 'login'; error = ''; notice = ''">{{ mode === 'login' ? 'Создать аккаунт' : 'Уже есть пароль — войти' }}</button><button v-if="mode === 'login'" type="button" :disabled="busy" @click="mode = 'reset'; error = ''; notice = ''">Забыли пароль?</button></p>
      </form>
    </section>
  </div>
</template>
<style scoped>
.account-overlay{position:fixed;inset:0;background:#17251f;z-index:5000;overflow:auto;color:#e8ece5;padding:32px}.account-panel{max-width:1200px;margin:auto}header{display:flex;justify-content:space-between;align-items:start}small{color:#c4a55f;letter-spacing:2px}h1,h2{font-family:Georgia}button,input{font:inherit;background:#283b30;border:1px solid #69735e;border-radius:5px;color:inherit;padding:10px 16px}button{cursor:pointer;margin:4px}button:disabled{opacity:.5}form{max-width:480px;margin:40px auto}label{display:block;margin:16px 0}input:not([type=checkbox]){display:block;box-sizing:border-box;width:100%;margin-top:8px}.account-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}article{padding:24px;border:1px solid #526451;border-radius:8px}[role=alert]{color:#ffa6a6}button:focus-visible,input:focus-visible{outline:2px solid #d3b05e}
</style>
