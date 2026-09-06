<script setup lang="ts">
import { defineAsyncComponent, ref, watch } from 'vue';
import { routePath, isPublicPath, navigate } from './navigation';
const Home = defineAsyncComponent(() => import('./components/HomeRoute.vue'));
const Account = defineAsyncComponent(() => import('./components/AccountRoute.vue'));
const Admin = defineAsyncComponent(() => import('./components/AdminRoute.vue'));
const PublicPage = defineAsyncComponent(() => import('./components/PublicSitePage.vue'));
const Help = defineAsyncComponent(() => import('./components/ApplicationHelpDialog.vue'));
const VideoLessons = defineAsyncComponent(() => import('./components/VideoLessonsPage.vue'));
const path = ref(routePath.value);
const account = ref<{ saveBeforeLeave?: () => Promise<void> }>();
const error = ref('');
let transition = 0;
watch(routePath, async next => {
  const request = ++transition;
  error.value = '';
  try {
    if (path.value.startsWith('/calendar/') && !next.startsWith('/calendar/')) await account.value?.saveBeforeLeave?.();
    if (request === transition) path.value = next;
  } catch (e) {
    if (request !== transition) return;
    error.value = String(e);
    // Keep the current document and its URL when saving fails.
    navigate(path.value, true);
  }
});
if (new URLSearchParams(location.search).has('account-token')) {
  const query = location.search;
  navigate('/account', true);
  history.replaceState(history.state, '', location.pathname + query);
  path.value = '/account';
}
</script>
<template>
  <div class="route-shell">
    <p v-if="error" role="alert">{{ error }}</p>
    <Home v-if="path === '/'" />
    <VideoLessons v-else-if="path === '/videos'" />
    <Help v-else-if="path === '/help'" page="guide" @close="navigate('/')" />
    <PublicPage v-else-if="isPublicPath(path)" :key="path" />
    <Admin v-else-if="path.startsWith('/admin')" />
    <Account v-else ref="account" :path="path" />
  </div>
</template>
<style>
html, body, #app { min-width: 0; min-height: 0; overflow: hidden; }
.route-shell { width: 100%; height: 100%; overflow: auto; }
.route-shell > .welcome-page { position: relative; inset: auto; min-height: 100%; overflow: visible; }
</style>
