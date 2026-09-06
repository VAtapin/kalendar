<script setup lang="ts">
import { onMounted } from 'vue';
import { sitePages,loadSitePages } from '../content/site-pages';
import { interfaceLanguage } from '../i18n/interface-language';
import { pagePath } from '../navigation';
onMounted(()=>{void loadSitePages().catch(()=>{});});
</script>
<template>
  <nav class="legal-links" aria-label="Правовая информация">
    <a v-for="page in sitePages" :key="page.id" :href="pagePath(page.slug)">{{page.translations[interfaceLanguage]?.title ?? page.translations.de?.title ?? page.slug}}</a>
  </nav>
</template>

<style scoped>
.legal-links { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; font-size: 12px; }
.legal-links a { color: #e6cd8e; text-decoration: underline; text-underline-offset: 3px; }
.legal-links a:focus-visible { outline: 2px solid #d3b05e; outline-offset: 3px; }
</style>
