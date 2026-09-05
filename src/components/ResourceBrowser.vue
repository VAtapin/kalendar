<script setup lang="ts">
import { computed, ref } from 'vue';
import { catalogItems, type CatalogItem } from '../collaboration/catalog-client';
defineProps<{busy: boolean}>();
const emit = defineEmits<{ insert: [item: CatalogItem] }>();
const search = ref('');
const items = computed(() => catalogItems.value.filter(item => item.uploaded && item.enabled && ['font', 'template'].includes(item.kind) && item.name.toLowerCase().includes(search.value.toLowerCase())));
</script>
<template><section><h3>Шрифты и шаблоны мастерской</h3><input v-model="search" type="search" placeholder="Поиск шрифта / шаблона" /><p v-if="!items.length">Опубликованных материалов по этому запросу нет.</p><button v-for="item in items" :key="item.id" :disabled="busy" @click="emit('insert', item)">{{ item.kind === 'font' ? 'Добавить шрифт' : 'Применить шаблон' }}: {{ item.name }}</button></section></template>
<style scoped>section{padding:12px}input,button{display:block;box-sizing:border-box;width:100%;font:inherit;color:inherit;background:#24382d;border:1px solid #5a6652;padding:10px;margin:8px 0;border-radius:4px}button{cursor:pointer}</style>
