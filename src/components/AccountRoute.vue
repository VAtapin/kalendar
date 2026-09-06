<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import AccountPanel from './AccountPanel.vue';
import { accountRequest, type AccountUser } from '../collaboration/account-client';
import { navigate } from '../navigation';
import { editorIntent } from '../editor-intent';
const props = defineProps<{ path: string }>();
const Editor = defineAsyncComponent(() => import('../App.vue'));
const user = ref<AccountUser|null>(null);
const ready = ref(false);
const error = ref('');
const editor = ref<{ saveBeforeLeave: () => Promise<void> }>();
const picker = ref<HTMLInputElement>();
const token = ref(new URLSearchParams(location.search).get('account-token') ?? undefined);
const editing = computed(() => props.path.startsWith('/calendar/') && !!user.value && !token.value);
async function loadSession() {
  ready.value = false;
  try { user.value = (await accountRequest<{user: AccountUser|null}>('session')).user; }
  catch(e) { error.value = String(e); }
  finally { ready.value = true; }
}
onMounted(loadSession);
watch(() => props.path, (next, previous) => {
  if (!next.startsWith('/calendar/') && previous.startsWith('/calendar/')) void loadSession();
});
function authenticated(value: AccountUser) {
  user.value = value;
  if (token.value) { token.value = undefined; history.replaceState(history.state, '', location.pathname); }
}
function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  editorIntent.file = file;
  navigate('/calendar/import');
}
defineExpose({ saveBeforeLeave: async () => { await editor.value?.saveBeforeLeave(); } });
</script>
<template>
  <p v-if="!ready" role="status">…</p>
  <Editor v-else-if="editing" ref="editor" />
  <AccountPanel v-else :key="user?.id" :user="user" :token="token" :external-error="error"
    @authenticated="authenticated" @logout="user = null" @close="navigate('/')"
    @create="navigate('/calendar/new')" @open="navigate(`/calendar/${$event}`)" @import="picker?.click()" />
  <input ref="picker" type="file" accept=".kalendar,.json" hidden @change="importFile" />
</template>
