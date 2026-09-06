<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { catalogRequest } from '../collaboration/catalog-client';
const enabled=ref(false),model=ref(''),key=ref(''),hasKey=ref(false),clearKey=ref(false),busy=ref(false),message=ref('');
async function save(){busy.value=true;message.value='';try{const r=await catalogRequest<{hasKey:boolean}>('admin/ai-settings','PUT',{enabled:enabled.value,model:model.value,key:key.value,clearKey:clearKey.value});hasKey.value=r.hasKey;key.value='';clearKey.value=false;message.value='Настройки сохранены';}catch(e){message.value=String(e);}finally{busy.value=false;}}
onMounted(async()=>{try{const r=await catalogRequest<{enabled:boolean;model:string;hasKey:boolean}>('admin/ai-settings');enabled.value=r.enabled;model.value=r.model;hasKey.value=r.hasKey;}catch(e){message.value=String(e);}});
</script>
<template><section><h2>ИИ-помощник · OpenAI</h2><p>Ключ хранится только на сервере. Используется Responses API. Расходы оплачиваются в вашем аккаунте OpenAI; подписка ChatGPT не заменяет оплату API.</p>
<form @submit.prevent="save"><fieldset :disabled="busy"><label><input v-model="enabled" type="checkbox" /> Включить ИИ</label><label>Модель OpenAI<input v-model="model" placeholder="ID доступной вам модели" maxlength="100" /></label><label>Новый API-ключ<input v-model="key" type="password" autocomplete="new-password" maxlength="500" :placeholder="hasKey?'Ключ уже сохранён — оставьте поле пустым':'Введите ключ OpenAI'" /></label><label><input v-model="clearKey" type="checkbox" /> Удалить сохранённый ключ</label><button>Сохранить настройки ИИ</button></fieldset></form>
<p role="status">{{message}}</p><p>Лимит: 20 запросов в час, 100 в сутки. В OpenAI передаются только задание и текст, показанные в помощнике. Не вставляйте пароли, списки клиентов и другие конфиденциальные данные. Ответ не публикуется и не отправляется автоматически.</p></section></template>
<style scoped>label{display:block;margin:15px 0}input:not([type=checkbox]){display:block;width:min(500px,100%);padding:10px;box-sizing:border-box}fieldset{border:0;padding:0}button{padding:10px}</style>
