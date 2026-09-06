<script setup lang="ts">
import { computed,onMounted,ref } from 'vue';
import { sitePages,loadSitePages } from '../content/site-pages';
import { interfaceLanguage,INTERFACE_LANGUAGE_OPTIONS } from '../i18n/interface-language';
import ContentBlocks from './ContentBlocks.vue';
import { routePath,pagePath,localizedPath } from '../navigation';
let slug=routePath.value.slice(1);
try { slug=decodeURIComponent(slug); } catch { /* Invalid URL is a not-found page. */ }
const loading=ref(true),error=ref('');
const page=computed(()=>sitePages.value.find(p=>p.slug===slug));
const translation=computed(()=>page.value?.translations[interfaceLanguage.value] ?? page.value?.translations.de ?? page.value?.translations.ru);
const fallback=computed(()=>!!page.value && !page.value.translations[interfaceLanguage.value]);
onMounted(async()=>{try{await loadSitePages();}catch{error.value='Не удалось загрузить страницу. Попробуйте ещё раз.';}finally{loading.value=false;}});
</script>
<template><main class="public-site-page"><header><a :href="localizedPath('/')">Календарная мастерская</a><select v-model="interfaceLanguage" aria-label="Язык"><option v-for="option in INTERFACE_LANGUAGE_OPTIONS" :key="option.id" :value="option.id">{{option.nativeLabel}}</option></select></header>
<p v-if="loading">Загрузка…</p><p v-else-if="error" role="alert">{{error}}</p><article v-else-if="translation" data-no-translate><p v-if="fallback">Перевод на выбранный язык ещё не опубликован. Показана доступная версия.</p><h1>{{translation.title}}</h1><ContentBlocks :blocks="translation.blocks"/></article><h1 v-else>Страница не найдена</h1>
<footer><span>Volodymyr Atapin · ATAPIN.DE</span><nav><a v-for="entry in sitePages" :key="entry.id" :href="pagePath(entry.slug)">{{entry.translations[interfaceLanguage]?.title ?? entry.translations.de?.title ?? entry.slug}}</a></nav></footer></main></template>
<style scoped>.public-site-page{box-sizing:border-box;max-width:900px;min-height:100vh;margin:auto;padding:30px;background:#fffdf8;color:#24392f;font:17px/1.7 Arial,sans-serif}header,nav{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}a{color:inherit}article{margin:40px 0}footer{border-top:1px solid #b9a36b;padding-top:20px}h1{font:32px Georgia}select{padding:8px}nav{margin-top:15px;justify-content:flex-start}</style>
