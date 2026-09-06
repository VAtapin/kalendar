<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { cleanPageHtml } from '../content/page-html';
const props=defineProps<{modelValue:string;disabled?:boolean}>();
const emit=defineEmits<{'update:modelValue':[string]}>();
const editor=ref<HTMLDivElement>();
const htmlMode=ref(false),source=ref('');
watch(source,value=>{if(htmlMode.value)emit('update:modelValue',cleanPageHtml(value));},{flush:'sync'});
function sync(){if(editor.value&&editor.value.innerHTML!==props.modelValue)editor.value.innerHTML=cleanPageHtml(props.modelValue);}
onMounted(sync);
watch(()=>props.modelValue,()=>{if(document.activeElement!==editor.value)sync();});
function update(){emit('update:modelValue',cleanPageHtml(editor.value?.innerHTML??''));}
function paste(event:ClipboardEvent){event.preventDefault();const html=event.clipboardData?.getData('text/html');if(html)document.execCommand('insertHTML',false,cleanPageHtml(html));else document.execCommand('insertText',false,event.clipboardData?.getData('text/plain')??'');update();}
function toggle(){if(!htmlMode.value){source.value=props.modelValue;htmlMode.value=true;}else{const html=cleanPageHtml(source.value);emit('update:modelValue',html);htmlMode.value=false;if(editor.value)editor.value.innerHTML=html;}}
</script>
<template><section class="page-text-editor" data-no-translate><div class="page-text-editor__mode"><button type="button" :disabled="disabled" @click="toggle">{{htmlMode?'Применить HTML':'HTML'}}</button></div><textarea v-if="htmlMode" v-model="source" :disabled="disabled" aria-label="HTML страницы" spellcheck="false" /><div v-show="!htmlMode" ref="editor" class="page-text-editor__document" :contenteditable="!disabled" role="textbox" aria-label="Текст страницы" aria-multiline="true" @input="update" @paste="paste" @drop.prevent /></section></template>
<style scoped>
.page-text-editor{margin:16px 0}.page-text-editor__mode{display:flex;justify-content:flex-end;margin-bottom:6px}button{padding:6px 12px;cursor:pointer}textarea,.page-text-editor__document{box-sizing:border-box;width:100%;min-height:420px;padding:28px;border:1px solid #a99b7b;border-radius:5px;background:#fffdf8;color:#24392f;overflow-wrap:anywhere;font:17px/1.7 Arial,sans-serif}.page-text-editor__document:focus{outline:2px solid #b69646}.page-text-editor__document:deep(img){max-width:100%;height:auto}.page-text-editor__document:deep(table){max-width:100%;border-collapse:collapse}.page-text-editor__document:deep(td),.page-text-editor__document:deep(th){border:1px solid #aaa;padding:6px}textarea{font:14px/1.5 monospace;resize:vertical}
</style>
