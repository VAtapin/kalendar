<script setup lang="ts">
import { ref } from 'vue';
import { safeContentUrl, blockStyle, type ContentBlock, type BlockStyle } from '../content/site-pages';
const props=defineProps<{modelValue:ContentBlock[];disabled?:boolean}>();
const emit=defineEmits<{'update:modelValue':[ContentBlock[]]}>();
const selected=ref(-1);
function update(index:number,field:'text'|'url',value:string){ emit('update:modelValue',props.modelValue.map((b,i)=>i===index?{...b,[field]:value.slice(0,field==='text'?3000:2048)}:b)); }
function move(i:number,d:number){const list=[...props.modelValue];const to=i+d;if(to<0||to>=list.length)return;[list[i],list[to]]=[list[to]!,list[i]!];emit('update:modelValue',list);selected.value=to;}
function add(type:ContentBlock['type']){emit('update:modelValue',[...props.modelValue,{type,text:type==='heading'?'Заголовок':type==='button'?'Подробнее':'',url:''}]);selected.value=props.modelValue.length;}
function paste(event:ClipboardEvent){event.preventDefault();document.execCommand('insertText',false,event.clipboardData?.getData('text/plain') ?? '');}
function format(index:number,key:keyof BlockStyle,value:unknown){emit('update:modelValue',props.modelValue.map((b,i)=>i===index?{...b,style:{...b.style,[key]:value}}:b));}
</script>
<template>
  <section class="visual-content-editor">
    <nav><button v-for="(label,type) in {heading:'Заголовок',text:'Абзац',image:'Изображение',button:'Кнопка'}" :key="type" type="button" :disabled="disabled || modelValue.length>=40" @click="add(type)">+ {{label}}</button></nav>
    <p>Нажмите на текст и редактируйте прямо на странице. Выберите блок, чтобы переместить его или изменить ссылку.</p>
    <div class="visual-paper" data-no-translate @drop.prevent>
      <article v-for="(block,i) in modelValue" :key="i" :class="{selected:selected===i}" @focusin="selected=i" @click="selected=i">
        <div v-if="selected===i" class="block-tools">
          <button type="button" :disabled="disabled||i===0" @click="move(i,-1)">↑</button><button type="button" :disabled="disabled||i===modelValue.length-1" @click="move(i,1)">↓</button>
          <button type="button" :disabled="disabled" @click="emit('update:modelValue',modelValue.filter((_,j)=>j!==i))">Удалить блок</button>
          <template v-if="block.type==='text'||block.type==='heading'">
            <button type="button" :disabled="disabled" :aria-pressed="!!block.style?.bold" @click="format(i,'bold',!block.style?.bold)"><b>Жирный</b></button>
            <button type="button" :disabled="disabled" :aria-pressed="!!block.style?.italic" @click="format(i,'italic',!block.style?.italic)"><i>Курсив</i></button>
            <select aria-label="Выравнивание блока" :disabled="disabled" :value="block.style?.align??'left'" @change="format(i,'align',($event.target as HTMLSelectElement).value)"><option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option></select>
            <input aria-label="Размер текста блока" type="number" min="10" max="48" :disabled="disabled" :value="block.style?.fontSize??(block.type==='heading'?24:16)" @change="format(i,'fontSize',Number(($event.target as HTMLInputElement).value))" style="width:70px" />
            <input aria-label="Цвет текста блока" type="color" :disabled="disabled" :value="block.style?.color??'#253a32'" @input="format(i,'color',($event.target as HTMLInputElement).value)" style="width:45px" />
          </template>
        </div>
        <img v-if="block.type==='image' && safeContentUrl(block.url)" :src="safeContentUrl(block.url)" :alt="block.text" referrerpolicy="no-referrer" />
        <component :is="block.type==='heading'?'h2':'div'" class="editable-block" :style="blockStyle(block.style)" :class="{'visual-button':block.type==='button'}" :contenteditable="!disabled" role="textbox" :aria-label="`Блок ${i+1}`" :data-placeholder="block.type==='image'?'Описание изображения':'Введите текст…'" @paste="paste" @blur="update(i,'text',($event.target as HTMLElement).innerText)">{{block.text}}</component>
        <label v-if="selected===i && ['image','button'].includes(block.type)">HTTPS-ссылка<input :value="block.url" :disabled="disabled" @input="update(i,'url',($event.target as HTMLInputElement).value)" /></label>
      </article>
      <p v-if="!modelValue.length">Добавьте первый блок кнопками выше.</p>
    </div>
  </section>
</template>
<style scoped>
.visual-paper{background:#fffdf8;color:#253a32;padding:24px;border-radius:8px;min-height:250px}.visual-paper article{position:relative;padding:12px;border:1px solid transparent}.visual-paper article.selected{border-color:#b3924d}.editable-block{white-space:pre-wrap;min-height:1.7em;line-height:1.7;outline:none;overflow-wrap:anywhere}.editable-block:empty:before{content:attr(data-placeholder);color:#999}img{max-width:100%;height:auto}.visual-button{display:inline-block;background:#28483b;color:white;padding:12px 20px;border-radius:5px}nav,.block-tools{display:flex;gap:6px;flex-wrap:wrap}.block-tools{margin-bottom:8px}button{padding:7px 12px;background:#28483b;color:#fff;border:1px solid #8b7954;border-radius:4px;cursor:pointer}button:disabled{opacity:.4}input{display:block;width:100%;padding:8px;box-sizing:border-box}label{display:block;margin-top:12px}
</style>
