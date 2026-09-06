<script setup lang="ts">
import { computed } from 'vue';
import App from './App.vue';
import PublicSitePage from './components/PublicSitePage.vue';
import { routePath,isPublicPath } from './navigation';
const publicPage = computed(() => isPublicPath(routePath.value));
</script>
<template>
  <div v-show="!publicPage"><App /></div>
  <PublicSitePage v-if="publicPage" :key="routePath" />
</template>
