<script setup lang="ts">
import { ref } from "vue";
import type { DocumentAsset } from "../document/types";
defineProps<{ photos: DocumentAsset[]; collapsed: boolean; busy: boolean }>();
const emit = defineEmits<{ toggle: []; upload: [files: File[]]; place: [id: string]; remove: [id: string] }>();
const input = ref<HTMLInputElement>();
function upload(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('upload', Array.from(target.files ?? []));
  target.value = '';
}
function drag(event: DragEvent, id: string) {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData('application/x-calendar-photo', id);
  event.dataTransfer.effectAllowed = 'copy';
}
</script>

<template>
  <aside class="photo-library" :class="{collapsed}" aria-label="Фотографии проекта">
    <button class="photo-toggle" type="button" :aria-expanded="!collapsed" :title="collapsed ? 'Показать фотографии' : 'Свернуть фотографии'" @click="emit('toggle')">{{ collapsed ? '▧' : 'Фотографии ‹' }}</button>
    <template v-if="!collapsed">
      <button type="button" :disabled="busy" @click="input?.click()">{{ busy ? 'Загрузка…' : '+ Загрузить фотографии' }}</button>
      <p>Перетащите фото на страницу или дважды нажмите на миниатюру.</p>
      <div class="photo-grid">
        <div v-for="photo in photos" :key="photo.id">
        <button type="button" draggable="true" :title="photo.name" :aria-label="`Поместить фото: ${photo.name}`" @dragstart="drag($event, photo.id)" @dblclick="emit('place', photo.id)" @keydown.enter.prevent="emit('place', photo.id)">
          <img :src="photo.source" :alt="photo.name" draggable="false" loading="lazy" />
          <span>{{ photo.name }}</span>
        </button>
        <button type="button" :aria-label="`Убрать из панели: ${photo.name}`" @click="emit('remove', photo.id)">Убрать</button>
        </div>
      </div>
      <p v-if="!photos.length">Загрузите JPG, PNG или WebP. Фотографии хранятся вместе с проектом и доступны для повторного размещения.</p>
    </template>
    <input ref="input" hidden type="file" multiple accept="image/jpeg,image/png,image/webp" @change="upload" />
  </aside>
</template>

<style scoped>
.photo-library{min-width:0;overflow:auto;background:#1d2923;border-right:1px solid #445047;padding:10px;box-sizing:border-box;color:#e6e7dc}
.photo-library.collapsed{padding:4px}.photo-library button{font:inherit;color:inherit;background:#28382f;border:1px solid #59624e;border-radius:4px;cursor:pointer;padding:8px;width:100%}
.photo-library button:focus-visible{outline:2px solid #c5a559}.photo-toggle{margin-bottom:12px}.photo-library p{font-size:12px;line-height:1.5;color:#adb7af}
.photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.photo-grid button{padding:4px;cursor:grab}.photo-grid img{display:block;width:100%;height:90px;object-fit:contain;background:#111b16}.photo-grid span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;margin-top:5px}
</style>
