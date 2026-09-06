<script setup lang="ts">
import { computed } from "vue";
import VisualContentEditor from './VisualContentEditor.vue';
import { blockStyle, type ContentBlock as Block, type BlockStyle } from '../content/site-pages';
const props = defineProps<{ modelValue: Block[]; disabled: boolean; subject: string }>();
const emit = defineEmits<{ "update:modelValue": [blocks: Block[]] }>();
const labels = { heading: "Заголовок", text: "Текст", image: "Изображение", button: "Кнопка" };
function update(index: number, field: "text" | "url", value: string) {
  emit("update:modelValue", props.modelValue.map((block, i) => i === index ? { ...block, [field]: value } : block));
}
function add(type: Block["type"]) {
  emit("update:modelValue", [...props.modelValue, { type, text: "", url: "" }]);
}
function move(index: number, direction: number) {
  const blocks = [...props.modelValue];
  const target = index + direction;
  if (target < 0 || target >= blocks.length) return;
  [blocks[index], blocks[target]] = [blocks[target]!, blocks[index]!];
  emit("update:modelValue", blocks);
}
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const css = (style?:BlockStyle) => Object.entries(blockStyle(style)).filter(([,v])=>v!==undefined).map(([k,v])=>`${k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}:${v}`).join(';');
const safeUrl = (url: string) => { try { const parsed = new URL(url); return parsed.protocol === "https:" && !parsed.username ? escape(url) : ""; } catch { return ""; } };
const preview = computed(() => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; style-src 'unsafe-inline';"><style>body{margin:0;padding:24px;background:#f2efe8;color:#253a32;font:16px Arial}main{max-width:552px;margin:auto;padding:24px;background:#fffdf8;border-top:4px solid #b3924d}h1,h2{font-family:Georgia;color:#28483b}p{line-height:1.7}img{width:100%;height:auto}a{color:#28483b}</style></head><body><main><img style="max-width:280px" src="https://kalender.georg-kloster.ru/brand/logo-kalendar.png" alt="Календарная мастерская"><h1>${escape(props.subject)}</h1>${props.modelValue.map(block => {
  const text = escape(block.text); const url = safeUrl(block.url);
  if (block.type === "heading") return `<h2 style="${css(block.style)}">${text}</h2>`;
  if (block.type === "image") return url ? `<p><img src="${url}" alt="${text}"></p>` : '<p>Укажите HTTPS-ссылку на изображение</p>';
  if (block.type === "button") return `<p><a href="${url}" style="display:inline-block;background:#28483b;color:white;padding:14px 22px;text-decoration:none;border-radius:4px">${text}</a></p>`;
  return `<p style="${css(block.style)}">${text.replace(/\n/g, "<br>")}</p>`;
}).join("")}<hr><p>Календарная мастерская · Монастырь</p><p>Вы подтвердили подписку на новости мастерской и напоминания о календарях.</p><p><u>Отписаться от рассылки</u></p></main></body></html>`);
</script>

<template>
  <div class="newsletter-editor">
    <div>
      <p>HTML-письмо собирается из блоков. Оформление, текстовая версия и ссылка отписки добавляются автоматически.</p>
      <VisualContentEditor :model-value="modelValue" :disabled="disabled" @update:model-value="emit('update:modelValue',$event)" />
      <details><summary>Поля блоков и ссылки</summary>
      <fieldset v-for="(block, index) in modelValue" :key="index" :disabled="disabled">
        <legend>{{ index + 1 }}. {{ labels[block.type] }}</legend>
        <label>{{ block.type === 'image' ? 'Описание изображения (alt)' : 'Текст' }}
          <textarea :value="block.text" :rows="block.type === 'text' ? 5 : 2" maxlength="3000" @input="update(index, 'text', ($event.target as HTMLTextAreaElement).value)" />
        </label>
        <label v-if="block.type === 'image' || block.type === 'button'">HTTPS-ссылка {{ block.type === 'image' ? 'на изображение' : 'перехода' }}
          <input type="url" :value="block.url" placeholder="https://…" maxlength="2048" @input="update(index, 'url', ($event.target as HTMLInputElement).value)" />
        </label>
        <div class="block-actions">
          <button type="button" :disabled="index === 0" @click="move(index, -1)">↑ Выше</button>
          <button type="button" :disabled="index === modelValue.length - 1" @click="move(index, 1)">↓ Ниже</button>
          <button type="button" @click="emit('update:modelValue', modelValue.filter((_, i) => i !== index))">Удалить блок</button>
        </div>
      </fieldset>
      <div class="block-actions"><button v-for="(label, type) in labels" :key="type" type="button" :disabled="disabled || modelValue.length >= 40" @click="add(type)">+ {{ label }}</button></div>
      <p>Изображения должны быть опубликованы по HTTPS без авторизации. Не используйте приватные ссылки. Почтовый клиент может скрывать картинки до разрешения получателя.</p>
      </details>
    </div>
    <aside><h3>Предпросмотр письма</h3><iframe title="Предпросмотр HTML-рассылки" sandbox="" referrerpolicy="no-referrer" :srcdoc="preview" /></aside>
  </div>
</template>

<style scoped>
.newsletter-editor{display:grid;grid-template-columns:minmax(280px,1fr) minmax(320px,1fr);gap:24px}
fieldset{border:1px solid #586456;border-radius:8px;margin:16px 0;padding:16px;min-width:0}
label{display:block;margin:8px 0}input,textarea{display:block;box-sizing:border-box;width:100%;color:inherit;background:#26372f;border:1px solid #586456;padding:10px;font:inherit;border-radius:4px}
.block-actions{display:flex;gap:8px;flex-wrap:wrap}button{color:inherit;background:#26372f;border:1px solid #586456;padding:8px;cursor:pointer;border-radius:4px}button:disabled{opacity:.4;cursor:default}
iframe{width:100%;height:700px;border:0;border-radius:8px;background:#fff}aside{min-width:0}
@media(max-width:1050px){.newsletter-editor{grid-template-columns:1fr}}
</style>
