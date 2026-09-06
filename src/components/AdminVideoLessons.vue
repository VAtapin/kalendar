<script setup lang="ts">
import {onMounted,onBeforeUnmount,ref,watch} from 'vue';
import {videoRequest,type VideoLesson} from '../content/video-lessons';
const emit=defineEmits<{dirty:[boolean]}>();
const crypto=window.crypto;
const items=ref<VideoLesson[]>([]),revision=ref(0),busy=ref(false),error=ref(''),notice=ref('');
watch(items,()=>emit('dirty',true),{deep:true,flush:'sync'});onBeforeUnmount(()=>emit('dirty',false));
onMounted(async()=>{busy.value=true;try{const data=await videoRequest(true);items.value=data.items;revision.value=data.revision;emit('dirty',false);}catch(e){error.value=String(e);}finally{busy.value=false;}});
function move(index:number,offset:number){const next=index+offset;if(next<0||next>=items.value.length)return;const item=items.value.splice(index,1)[0]!;items.value.splice(next,0,item);}
function remove(index:number){if(confirm('Удалить видео из списка?'))items.value.splice(index,1);}
async function save(){busy.value=true;error.value='';try{const data=await videoRequest(true,{items:items.value,revision:revision.value});items.value=data.items;revision.value=data.revision;emit('dirty',false);notice.value='Видеоуроки сохранены';}catch(e){error.value=String(e);}finally{busy.value=false;}}
</script>
<template><section><h2>Видеоуроки</h2><p>Добавьте ссылки YouTube. Порядок в списке — порядок уроков на сайте. Скрытые видео посетителям не показываются.</p><p v-if="error" role="alert">{{error}}</p><p role="status">{{notice}}</p><fieldset :disabled="busy"><article v-for="(item,index) in items" :key="item.id"><label>Название<input v-model="item.title" maxlength="160" /></label><label>Ссылка YouTube<input v-model="item.url" type="url" placeholder="https://www.youtube.com/watch?v=…" /></label><label>Длительность<input v-model="item.duration" placeholder="3:25" maxlength="20" /></label><label><input v-model="item.enabled" type="checkbox" /> Опубликовано</label><button type="button" :disabled="index===0" @click="move(index,-1)">↑</button><button type="button" :disabled="index===items.length-1" @click="move(index,1)">↓</button><button type="button" @click="remove(index)">Удалить</button></article><button type="button" @click="items.push({id:crypto.randomUUID(),title:'',url:'',duration:'',enabled:false})">+ Добавить видео</button><button type="button" @click="save">Сохранить видеоролики</button></fieldset></section></template>
<style scoped>fieldset{border:0;padding:0}article{padding:16px;border:1px solid #68745f;margin:15px 0;border-radius:6px}label{display:block;margin:8px 0}input:not([type=checkbox]){display:block;width:min(600px,100%);box-sizing:border-box;padding:8px}button{padding:8px;margin:4px}</style>
