<script setup lang="ts">
import { ref } from 'vue';
import { catalogRequest } from '../collaboration/catalog-client';
import type { PageTranslation } from '../content/site-pages';
import ContentBlocks from './ContentBlocks.vue';
const props=defineProps<{source:string;language?:string;disabled?:boolean}>();
const emit=defineEmits<{apply:[PageTranslation,string]}>();
const prompt=ref(''),language=ref(props.language??'ru'),busy=ref(false),approved=ref(false),error=ref(''),draft=ref<PageTranslation>(),draftLanguage=ref(''),sentSource=ref('');
async function generate(){busy.value=true;error.value='';draft.value=undefined;sentSource.value=props.source;draftLanguage.value=language.value;
try{draft.value=await catalogRequest<PageTranslation>('admin/ai-draft','POST',{prompt:prompt.value,source:sentSource.value,language:language.value,approved:approved.value});}catch(e){error.value=String(e);}finally{busy.value=false;}}
function apply(){if(draft.value && !props.disabled && !busy.value){if(props.source!==sentSource.value && !window.confirm('Исходный текст изменился. Заменить его результатом ИИ?'))return;emit('apply',draft.value,draftLanguage.value);draft.value=undefined;}}
</script>
<template><details class="ai-draft"><summary>ИИ: написать / улучшить / перевести</summary><fieldset :disabled="busy||disabled"><label>Язык результата<select v-model="language"><option value="ru">Русский</option><option value="de">Deutsch</option><option value="en">English</option><option value="uk">Українська</option></select></label><label>Задание<textarea v-model="prompt" maxlength="6000" placeholder="Напиши новость… или переведи исходный текст…" /></label>
<details><summary>Текст, который будет отправлен в OpenAI</summary><pre>{{source || '(пусто)'}}</pre></details><label><input v-model="approved" type="checkbox" /> Разрешаю отправить это задание и исходный текст в OpenAI</label><button type="button" :disabled="!approved||!prompt.trim()||source.length>30000" @click="generate">{{busy?'Готовим черновик…':'Получить черновик'}}</button></fieldset>
<p v-if="error" role="alert">{{error}}</p><article v-if="draft"><h3>{{draft.title}}</h3><ContentBlocks :blocks="draft.blocks"/><p>Проверьте факты и перевод. Юридический текст требует отдельной проверки.</p><button type="button" :disabled="disabled||busy" @click="apply">Применить в редакторе</button><button type="button" @click="draft=undefined">Отклонить</button></article></details></template>
<style scoped>.ai-draft{padding:15px;border:1px solid #9c8650;border-radius:8px;margin:15px 0}label{display:block;margin:10px 0}textarea{display:block;width:100%;min-height:90px;box-sizing:border-box}pre{white-space:pre-wrap;max-height:180px;overflow:auto}fieldset{border:0;padding:0}article{padding:20px;background:#fffdf8;color:#24392f}button{padding:8px;margin:5px}summary{cursor:pointer}select{margin-left:10px}</style>
