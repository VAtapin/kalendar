<script setup lang="ts">
import { onMounted, ref } from "vue";
import { loadGlobalCalendarGridTemplates, updateGlobalCalendarGridTemplate, deleteGlobalCalendarGridTemplate, createGlobalCalendarGridTemplate } from "../collaboration/shared-project-client";
import VisualGridEditor from './VisualGridEditor.vue';
import type { GlobalCalendarGridTemplate } from "../templates/calendar-grid-presets";
import { mergeGlobalCalendarGridTemplates } from "../templates/calendar-grid-presets";
const templates = ref<GlobalCalendarGridTemplate[]>([]);
const busy = ref(false);
const error = ref("");
const notice = ref("");
const pendingDelete = ref("");
const selected = ref("");
async function copy(template: GlobalCalendarGridTemplate) {
  busy.value=true;error.value='';
  try { const saved=await createGlobalCalendarGridTemplate('',{name:template.name+' — копия',description:template.description,grid:template.grid});templates.value.push(saved);selected.value=saved.id; }
  catch(e){error.value=String(e);}finally{busy.value=false;}
}
async function load() {
  busy.value = true;
  try { templates.value = mergeGlobalCalendarGridTemplates((await loadGlobalCalendarGridTemplates()).templates); }
  catch (e) { error.value = String(e); }
  finally { busy.value = false; }
}
async function save(template: GlobalCalendarGridTemplate) {
  busy.value = true; error.value = ""; notice.value = "";
  try {
    const saved = await updateGlobalCalendarGridTemplate("", template.id, { name: template.name, description: template.description, grid: template.grid });
    templates.value = templates.value.map(item => item.id === saved.id ? saved : item);
    notice.value = `Макет «${saved.name}» обновлён`;
  } catch (e) { error.value = String(e); } finally { busy.value = false; }
}
async function remove(template: GlobalCalendarGridTemplate) {
  busy.value = true; error.value = ""; notice.value = "";
  try {
    await deleteGlobalCalendarGridTemplate("", template.id);
    templates.value = templates.value.filter(item => item.id !== template.id);
    pendingDelete.value = "";
    notice.value = `Общий макет «${template.name}» удалён из каталога. Уже созданные календари не изменены.`;
  } catch (e) { error.value = String(e); } finally { busy.value = false; }
}
onMounted(load);
</script>

<template>
  <section>
    <h3>Общие макеты календарной сетки</h3>
    <p>Выберите макет и редактируйте настоящую календарную сетку. Перетаскивайте число, текст и значки в увеличенной ячейке. «Сохранить макет» обновляет каталог; календари пользователей не изменяются.</p>
    <p v-if="error" role="alert">{{ error }}</p><p role="status">{{ notice }}</p>
    <p v-if="busy">Сохранение / загрузка…</p>
    <div class="template-cards">
      <article v-for="template in templates" :key="template.id" :class="{expanded:selected===template.id}">
        <small>{{ template.builtIn ? 'Встроенный макет' : 'Авторский макет' }}</small>
        <h3>{{template.name}}</h3>
        <button :disabled="busy" @click="selected=selected===template.id?'':template.id">{{selected===template.id?'Свернуть':'Редактировать визуально'}}</button>
        <button :disabled="busy" @click="copy(template)">Создать копию</button>
        <template v-if="selected===template.id">
        <label>Название<input v-model="template.name" :disabled="busy" maxlength="100" /></label>
        <label>Описание<textarea v-model="template.description" :disabled="busy" rows="3" maxlength="500" /></label>
        <VisualGridEditor v-model="template.grid" :disabled="busy" />
        <button :disabled="busy || !template.name.trim()" @click="save(template)">Сохранить макет</button>
        <button v-if="!template.builtIn" :disabled="busy" @click="pendingDelete = template.id">Удалить…</button>
        <div v-if="pendingDelete === template.id" role="alert">
          <p>Удалить этот макет из общего каталога? Это действие нельзя отменить здесь.</p>
          <button :disabled="busy" @click="remove(template)">Подтвердить удаление</button>
          <button :disabled="busy" @click="pendingDelete = ''">Отмена</button>
        </div>
        </template>
      </article>
    </div>
  </section>
</template>

<style scoped>
.template-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
.expanded{grid-column:1/-1}
article{border:1px solid #586456;padding:20px;border-radius:8px}label{display:block;margin:12px 0}small{color:#d1b46b}
input,textarea{box-sizing:border-box;display:block;width:100%;font:inherit;color:inherit;background:#26372f;border:1px solid #586456;padding:10px;border-radius:4px}
button{font:inherit;color:inherit;background:#26372f;border:1px solid #586456;padding:10px;margin:4px;cursor:pointer;border-radius:4px}button:disabled{opacity:.4;cursor:default}
</style>
