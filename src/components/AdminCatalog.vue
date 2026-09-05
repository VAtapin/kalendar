<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { catalogItems, catalogRequest, refreshCatalog, catalogContentUrl, type CatalogItem } from '../collaboration/catalog-client';
const kind = ref('all'); const search = ref(''); const busy = ref(false); const error = ref(''); const notice = ref('');
const edited = ref<CatalogItem>(); const fileInput = ref<HTMLInputElement>(); const uploadKind = ref<CatalogItem['kind']>('image'); const uploadName = ref(''); const licensed = ref(false);
const replaceId = ref<string>();
const category = ref('');
const categories = computed(() => [...new Set(catalogItems.value.map(item => item.category))].sort());
function replaceFile() {
  if (!edited.value || !licensed.value) { error.value = 'Подтвердите право публикации материала в форме загрузки'; return; }
  replaceId.value = edited.value.id; uploadKind.value = edited.value.kind; uploadName.value = edited.value.family ?? edited.value.name; fileInput.value?.click();
}
const visible = computed(() => catalogItems.value.filter(item => (kind.value === 'all' || item.kind === kind.value) && (!category.value || item.category === category.value) && item.name.toLowerCase().includes(search.value.toLowerCase())));
async function save() {
  if (!edited.value) return; busy.value = true; error.value = '';
  try { await catalogRequest(`admin/catalog/${edited.value.id}`, 'PUT', {name: edited.value.name, enabled: edited.value.enabled, category: edited.value.category}); await refreshCatalog(); notice.value = 'Изменения сохранены'; edited.value = undefined; }
  catch (e) { error.value = String(e); } finally { busy.value = false; }
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
  busy.value = true; error.value = ''; notice.value = '';
  try {
    if (!licensed.value) throw new Error('Подтвердите право публикации материала');
    if (file.size > 20 * 1024 * 1024) throw new Error('Максимальный размер файла — 20 МБ');
    const source = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]!); reader.onerror = reject; reader.readAsDataURL(file); });
    if (uploadKind.value === 'font') await new FontFace('CatalogUploadCheck', await file.arrayBuffer()).load();
    const item = await catalogRequest<CatalogItem>(replaceId.value ? `admin/catalog/${replaceId.value}` : 'admin/catalog', replaceId.value ? 'PUT' : 'POST', {name: uploadName.value.trim() || file.name, family: uploadName.value.trim() || file.name.replace(/\.[^.]+$/, ''), kind: uploadKind.value, source, enabled: true});
    await refreshCatalog(); notice.value = `Загружен материал «${item.name}»`; uploadName.value = '';
  } catch (e) { error.value = String(e); } finally { busy.value = false; input.value = ''; replaceId.value = undefined; }
}
onMounted(async () => { try { await refreshCatalog(); } catch (e) { error.value = String(e); } });
</script>
<template>
  <section class="catalog-manager">
    <h2>Все ресурсы мастерской</h2><p>Изображения, SVG, шрифты и шаблоны календарей. Выключенный материал скрывается для новых вставок, но остаётся в уже созданных календарях.</p>
    <p v-if="error" role="alert">{{ error }}</p><p role="status">{{ notice }}</p>
    <fieldset :disabled="busy"><legend>Загрузить ресурс</legend><select v-model="uploadKind" aria-label="Тип ресурса"><option value="image">Изображение JPG / PNG / WebP</option><option value="svg">SVG</option><option value="font">Шрифт TTF / OTF / WOFF / WOFF2</option><option value="template">Шаблон — файл календаря</option></select>
      <input v-model="uploadName" placeholder="Название (для шрифта — название семейства)" aria-label="Название нового ресурса" maxlength="100" />
      <label><input v-model="licensed" type="checkbox" /> У меня есть право публиковать этот материал и разрешать его использование в календарях.</label>
      <button :disabled="!licensed" @click="replaceId = undefined; fileInput?.click()">Выбрать и загрузить файл</button><input ref="fileInput" hidden type="file" @change="upload" />
    </fieldset>
    <nav><select v-model="kind" aria-label="Фильтр ресурсов"><option value="all">Все ресурсы</option><option value="image">Изображения</option><option value="svg">SVG</option><option value="font">Шрифты</option><option value="template">Шаблоны</option></select><select v-model="category" aria-label="Категория ресурсов"><option value="">Все категории</option><option v-for="entry in categories" :key="entry" :value="entry">{{ entry }}</option></select><input v-model="search" type="search" placeholder="Поиск…" aria-label="Поиск ресурса" /><span>{{ visible.length }} материалов</span></nav>
    <form v-if="edited" class="catalog-edit" @submit.prevent="save"><h3>Настройки ресурса</h3><label>Название<input v-model="edited.name" required maxlength="100" /></label><label>Категория<input v-model="edited.category" maxlength="80" /></label><label><input v-model="edited.enabled" type="checkbox" /> Доступен пользователям</label><button :disabled="busy">Сохранить</button><button v-if="edited.uploaded" type="button" :disabled="busy" @click="replaceFile">Заменить файл…</button><button type="button" :disabled="busy" @click="edited = undefined">Отмена</button></form>
    <div class="catalog-grid"><article v-for="item in visible" :key="item.id">
      <img v-if="item.kind === 'image' || item.kind === 'svg'" :src="item.uploaded ? catalogContentUrl(item.id) : item.source" :alt="item.name" loading="lazy" />
      <strong v-else>{{ item.kind === 'font' ? 'Аа Бб Вв' : '▤' }}</strong>
      <h3>{{ item.name }}</h3><p>{{ item.kind }} · {{ item.enabled ? 'Доступен' : 'Выключен' }} · {{ item.uploaded ? 'Загружен' : 'Встроенный' }}</p>
      <button :disabled="busy" @click="edited = { ...item }">Изменить / выключить</button>
      <a v-if="item.uploaded && item.kind === 'image'" :href="catalogContentUrl(item.id)" target="_blank" rel="noopener">Открыть изображение для рассылки</a>
    </article></div>
  </section>
</template>
<style scoped>
button,input,select{font:inherit;color:inherit;background:#26392e;border:1px solid #596853;padding:9px;border-radius:4px}button{cursor:pointer}nav{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}fieldset{border:1px solid #596853;padding:20px}label{display:block;margin:12px 0}.catalog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px}article{padding:16px;border:1px solid #485748;border-radius:6px;overflow-wrap:anywhere}article img{width:100%;height:110px;object-fit:contain;background:#f4f0e5}article strong{font-size:34px}h3{font-size:15px}p,a{font-size:13px}a{color:#d1b169;display:block;margin-top:8px}.catalog-edit{position:sticky;top:0;z-index:2;padding:20px;background:#20392c;border:1px solid #bfa064}button:disabled{opacity:.5}[role=alert]{color:#ffa6a6}
</style>
