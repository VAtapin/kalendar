<script setup lang="ts">
import { computed,onMounted,onBeforeUnmount,ref,watch } from 'vue';
import { catalogRequest } from '../collaboration/catalog-client';
import { loadSitePages,type SitePage,type PageTranslation } from '../content/site-pages';
import type { InterfaceLanguage } from '../document/types';
import VisualContentEditor from './VisualContentEditor.vue';
import AiDraftAssistant from './AiDraftAssistant.vue';
const items=ref<SitePage[]>([]),revision=ref(0),selected=ref<SitePage>(),lang=ref<InterfaceLanguage>('ru'),busy=ref(false),error=ref(''),notice=ref(''),reviewed=ref(false),dirty=ref(false);
const tr=computed(()=>selected.value?.translations[lang.value]);
const emit=defineEmits<{dirty:[boolean]}>();
watch(dirty,value=>emit('dirty',value));
function beforeUnload(event:BeforeUnloadEvent){if(dirty.value&&selected.value){event.preventDefault();event.returnValue='';}}
onMounted(()=>window.addEventListener('beforeunload',beforeUnload));
onBeforeUnmount(()=>{window.removeEventListener('beforeunload',beforeUnload);emit('dirty',false);});
watch(selected,()=>{reviewed.value=false;dirty.value=true;},{deep:true});
function ensureLanguage(){if(selected.value && !selected.value.translations[lang.value])selected.value.translations[lang.value]={title:'',blocks:[]};}
const clone=(p:SitePage):SitePage=>JSON.parse(JSON.stringify(p));
function select(page:SitePage){if(dirty.value && selected.value && !window.confirm('Оставить несохранённые изменения?'))return;selected.value=clone(page);ensureLanguage();setTimeout(()=>dirty.value=false,0);}
function add(){if(dirty.value && selected.value && !window.confirm('Оставить несохранённые изменения?'))return;selected.value={id:crypto.randomUUID(),slug:'page-'+Date.now(),order:items.value.length*10+10,published:false,translations:{ru:{title:'Новая страница',blocks:[]},de:{title:'',blocks:[]}}};ensureLanguage();}
async function load(){if(dirty.value&&selected.value&&!window.confirm('Перезагрузить страницы и отменить несохранённые изменения?'))return;busy.value=true;try{const r=await catalogRequest<{items:SitePage[];revision:number}>('admin/site-pages');items.value=r.items;revision.value=r.revision;selected.value=undefined;setTimeout(()=>dirty.value=false,0);}catch(e){error.value=String(e);}finally{busy.value=false;}}
async function save(action:'draft'|'publish'|'unpublish'|'delete'){if(!selected.value)return;if(['unpublish','delete'].includes(action)&&!window.confirm(action==='delete'?'Удалить страницу и её черновик?':'Убрать страницу с сайта?'))return;busy.value=true;error.value='';
try{const id=selected.value.id;const r=await catalogRequest<{items:SitePage[];revision:number}>('admin/site-pages','PUT',{page:selected.value,revision:revision.value,action,reviewed:reviewed.value});items.value=r.items;revision.value=r.revision;const saved=r.items.find(p=>p.id===id);selected.value=saved?clone(saved):undefined;await loadSitePages();notice.value=action==='publish'?'Страница опубликована':action==='draft'?'Черновик сохранён; опубликованный текст не изменён':'Сайт обновлён';setTimeout(()=>dirty.value=false,0);}catch(e){error.value=String(e);}finally{busy.value=false;}}
function applyAi(value:PageTranslation,language:string){if(!selected.value)return;selected.value.translations[language as InterfaceLanguage]=value;lang.value=language as InterfaceLanguage;}
onMounted(load);
</script>
<template><section><h2>Страницы сайта</h2><p>Опубликованные страницы автоматически появляются в футере. Начальные юридические тексты нужно проверить: фактические сроки хранения, обязанности оператора и условия деятельности.</p><p v-if="error" role="alert">{{error}}</p><p role="status">{{notice}}</p>
<button type="button" :disabled="busy" @click="add">+ Добавить страницу</button><button type="button" :disabled="busy" @click="load">Обновить список</button>
<nav><button v-for="page in items" :key="page.id" type="button" :disabled="busy" @click="select(page)">{{page.translations.ru?.title || page.slug}} · {{page.published?'На сайте':'Черновик'}}</button></nav>
<fieldset v-if="selected" :disabled="busy"><label>Адрес страницы<input v-model="selected.slug" maxlength="80" pattern="[a-z][a-z0-9-]*" /></label><label>Порядок в футере<input v-model.number="selected.order" type="number" min="-10000" max="10000" /></label>
<label>Язык<select v-model="lang" @change="ensureLanguage"><option value="ru">Русский</option><option value="de">Deutsch</option><option value="en">English</option><option value="uk">Українська</option></select></label>
<template v-if="tr"><label>Название<input v-model="tr.title" maxlength="100" /></label><VisualContentEditor :key="selected.id+lang" v-model="tr.blocks" :disabled="busy" /><AiDraftAssistant :key="'ai-'+selected.id+lang" :language="lang" :source="JSON.stringify(tr)" :disabled="busy" @apply="applyAi" /></template>
<button type="button" @click="save('draft')">Сохранить черновик</button><label><input v-model="reviewed" type="checkbox" /> Я проверил тексты и переводы перед публикацией</label><button type="button" :disabled="!reviewed" @click="save('publish')">Опубликовать</button><button type="button" v-if="selected.published" @click="save('unpublish')">Снять с публикации</button><button type="button" @click="save('delete')">Удалить страницу…</button></fieldset></section></template>
<style scoped>nav{display:flex;flex-wrap:wrap;margin:15px 0;gap:8px}fieldset{border:0;padding:0}label{display:block;margin:12px 0}input:not([type=checkbox]),select{padding:8px;display:block;max-width:100%;box-sizing:border-box}button{padding:9px;margin:4px;color:inherit;background:#304738;border:1px solid #8a784e;border-radius:5px;cursor:pointer}button:disabled{opacity:.4}input:not([type=checkbox]){width:min(600px,100%)}</style>
