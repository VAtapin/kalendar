<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { adminRequest } from "../collaboration/shared-project-client";
import PageScene from "./PageScene.vue";
import NewsletterEditor from "./NewsletterEditor.vue";
import AdminTemplates from "./AdminTemplates.vue";
import AdminCatalog from "./AdminCatalog.vue";
import AdminAccounts from "./AdminAccounts.vue";
import { catalogRequest } from "../collaboration/catalog-client";
import type { CalendarProject } from "../document/types";
import type { OrthodoxCalendarYear } from "../calendar/types";
import { mergeMonasteryEvents } from "../calendar/engine/merge-monastery-events";

const props = defineProps<{ accessToken: string }>();
const emit = defineEmits<{ close: []; logout: [] }>();
async function logout() {
  try { await adminRequest("", "logout", {}); emit("logout"); }
  catch (e) { error.value = String(e); }
}
type Row = { id?: string; name?: string; year?: number; ownerEmail?: string; pages?: number; bytes?: number;
  email?: string; status?: string; at?: string; kind?: string; confirmedAt?: string; consentVersion?: string; consentText?: string };
const tab = ref("calendars");
const items = ref<Row[]>([]);
const total = ref(0);
const offset = ref(0);
const busy = ref(false);
const error = ref("");
const preview = shallowRef<CalendarProject>();
const year = shallowRef<OrthodoxCalendarYear>();
const pageIndex = ref(0);
const selectedPage = computed(() => preview.value?.document.pages[pageIndex.value]);
const subject = ref("");
const text = ref("");
const blocks = ref<{type: "heading" | "text" | "image" | "button"; text: string; url: string}[]>([{type: "text", text: "", url: ""}]);
const hasContent = computed(() => blocks.value.some(block => block.text.trim()));
const approved = ref(false);
watch([subject, blocks], () => { approved.value = false; }, { deep: true });
const sending = ref(false);
const campaign = ref("");
const progress = ref("");
let draftRevision = 0;
const campaignList = ref<{id: string; subject: string; counts: Record<string, number>}[]>([]);
async function saveDraft() {
  busy.value = true; error.value = '';
  try { const value = await adminRequest<{revision: number}>('', 'newsletter-draft', {revision: draftRevision, subject: subject.value, blocks: blocks.value}); draftRevision = value.revision; progress.value = 'Черновик сохранён на сервере'; }
  catch (e) { error.value = String(e); } finally { busy.value = false; }
}
async function loadDraft() {
  busy.value = true; error.value = '';
  try { const value = await adminRequest<{revision: number; subject: string; blocks: typeof blocks.value}>('', 'newsletter-draft'); draftRevision = value.revision; subject.value = value.subject; blocks.value = value.blocks; campaign.value = ''; approved.value = false; }
  catch (e) { error.value = String(e); } finally { busy.value = false; }
}
async function listCampaigns() {
  try { campaignList.value = (await adminRequest<{items: typeof campaignList.value}>('', 'campaigns')).items; } catch (e) { error.value = String(e); }
}
async function openCampaign(id: string) {
  busy.value = true; error.value = '';
  try { const value = await adminRequest<{subject: string; text: string; blocks?: typeof blocks.value}>('', `campaigns/${id}`); subject.value = value.subject; blocks.value = value.blocks?.length ? value.blocks : [{type:'text', text:value.text,url:''}]; campaign.value = id; approved.value = false; progress.value = 'Рассылка загружена. Продолжение отправит только оставшиеся письма.'; }
  catch (e) { error.value = String(e); } finally { busy.value = false; }
}
let stopped: boolean = false;
function stopSending() { stopped = true; }
let requestVersion = 0;
onBeforeUnmount(() => { stopped = true; requestVersion++; });
const statusLabel = (status?: string) => ({ subscribed: "Подписан", unsubscribed: "Отписался", not_subscribed: "Без подписки",
  accepted: "Принято почтовым сервером", failed: "Ошибка отправки", unknown: "Результат неизвестен", skipped: "Пропущено" }[status ?? ""] ?? status);
async function removeCalendar(id: string) {
  if (!window.confirm('Переместить календарь пользователя в корзину?')) return;
  try { await catalogRequest(`admin/private-calendars/${id}`, 'DELETE'); await load('calendars'); }
  catch (e) { error.value = String(e); }
}
async function restoreTrash(id: string) {
  try { await catalogRequest('admin/private-calendars-trash/restore', 'POST', {id}); await load('trash'); }
  catch (e) { error.value = String(e); }
}
async function load(nextTab = tab.value, nextOffset = 0) {
  tab.value = nextTab; offset.value = nextOffset; preview.value = undefined;
  const version = ++requestVersion;
  if (['campaigns', 'templates', 'catalog', 'accounts'].includes(nextTab)) { busy.value = false; error.value = ""; return; }
  busy.value = true; error.value = "";
  try {
    const data = nextTab === 'calendars' || nextTab === 'trash'
      ? await catalogRequest<{items: Row[]; total?: number}>(nextTab === 'trash' ? 'admin/private-calendars-trash' : 'admin/private-calendars')
      : await adminRequest<{items: Row[]; total: number}>(props.accessToken, `${nextTab}?offset=${nextOffset}`);
    if (version !== requestVersion) return;
    items.value = nextTab === 'calendars' || nextTab === 'trash' ? data.items.slice(nextOffset, nextOffset + 25) : data.items; total.value = data.total ?? data.items.length;
  } catch (e) { error.value = String(e); }
  finally { if (version === requestVersion) busy.value = false; }
}
async function openPreview(id: string) {
  busy.value = true; error.value = "";
  try {
    const result = await catalogRequest<{project: CalendarProject}>(`admin/private-calendars/${id}`);
    const [parser, engine, response] = await Promise.all([
      import("../calendar/xml/parse-memory-days"), import("../calendar/engine/build-calendar-year"),
      fetch("/data/MemoryDays.xml")]);
    if (!response.ok) throw new Error("Не удалось загрузить календарные данные");
    year.value = mergeMonasteryEvents(engine.buildOrthodoxCalendarYear(result.project.year, parser.parseMemoryDaysXml(await response.text())), result.project.monasteryEvents);
    preview.value = result.project; pageIndex.value = 0;
  } catch (e) { error.value = String(e); } finally { busy.value = false; }
}
async function send() {
  if (sending.value || !approved.value || !subject.value.trim() || !hasContent.value) return;
  sending.value = true; error.value = ""; stopped = false;
  try {
    if (!campaign.value) {
      const result = await adminRequest<{id: string; total: number}>(props.accessToken, "campaigns", {subject: subject.value, text: text.value, blocks: blocks.value});
      campaign.value = result.id;
    }
    while (!stopped) {
      const result = await adminRequest<{pending: number; total: number; accepted: number; failed: number; unknown: number; skipped: number}>(props.accessToken, `campaigns/${campaign.value}/send`, {});
      progress.value = `Всего ${result.total} · Принято сервером ${result.accepted} · Ошибки ${result.failed} · Неизвестно ${result.unknown} · Пропущено ${result.skipped} · Осталось ${result.pending}`;
      if (!result.pending) { stopped = true; progress.value += " · Завершено"; }
    }
  } catch (e) { error.value = String(e); } finally { sending.value = false; }
}
onMounted(() => void load());
</script>

<template>
  <div class="application-dialog-backdrop admin-backdrop">
    <section class="application-dialog admin-dialog" role="dialog" aria-modal="true" aria-label="Администратор">
      <header class="application-dialog__header"><div><small>КАЛЕНДАРНАЯ МАСТЕРСКАЯ</small><h2>Управление мастерской</h2></div><div><button type="button" :disabled="sending" @click="logout">Выйти из аккаунта</button> <button type="button" :disabled="sending" @click="emit('close')">Вернуться в редактор</button></div></header>
      <div class="application-dialog__content">
        <nav class="admin-nav">
          <button v-for="entry in [['calendars','Календари'],['trash','Корзина'],['accounts','Аккаунты'],['subscribers','Подписки'],['catalog','Ресурсы: шрифты, SVG, изображения'],['templates','Макеты сеток'],['mail-log','Журнал писем'],['campaigns','Рассылка']]" :key="entry[0]" :disabled="busy || sending" :aria-pressed="tab === entry[0]" @click="load(entry[0])">{{ entry[1] }}</button>
        </nav>
        <p v-if="error" role="alert">{{ error }}</p><p v-if="busy">Загрузка…</p>
        <template v-if="tab === 'campaigns'">
          <p><button :disabled="busy || sending || !!campaign" @click="saveDraft">Сохранить черновик</button><button :disabled="busy || sending" @click="loadDraft">Загрузить черновик</button><button :disabled="busy || sending" @click="listCampaigns">Предыдущие рассылки</button></p>
          <div v-if="campaignList.length"><p v-for="entry in campaignList" :key="entry.id">{{ entry.subject }} · ожидают {{ entry.counts.pending ?? 0 }} · принято {{ entry.counts.accepted ?? 0 }} <button :disabled="busy || sending" @click="openCampaign(entry.id)">Открыть / продолжить</button></p></div>
          <p>Отправка только подтверждённым подписчикам. Отписка проверяется перед каждым письмом. Оставьте окно открытым до завершения.</p>
          <label class="field-stack">Тема<input v-model="subject" :disabled="!!campaign || sending" maxlength="100" /></label>
          <NewsletterEditor v-model="blocks" :disabled="!!campaign || sending" :subject="subject" />
          <label><input v-model="approved" type="checkbox" :disabled="sending" /> Я проверил текст и хочу отправить его подписчикам</label>
          <p><button :disabled="!approved || sending || !subject.trim() || !hasContent" @click="send">{{ campaign ? 'Продолжить отправку' : 'Создать и отправить рассылку' }}</button>
          <button v-if="sending" @click="stopSending">Остановить после текущего письма</button></p>
          <p aria-live="polite">{{ progress }}</p>
          <button v-if="campaign && !sending" @click="campaign = ''; approved = false; progress = ''; subject = ''; text = ''; blocks = [{type: 'text', text: '', url: ''}]">Новая рассылка</button>
        </template>
        <AdminTemplates v-else-if="tab === 'templates'" />
        <AdminCatalog v-else-if="tab === 'catalog'" />
        <AdminAccounts v-else-if="tab === 'accounts'" />
        <template v-else>
          <p v-if="tab === 'calendars'">Личные календари пользователей на сервере. Администратор может просматривать их без изменения оригинала.</p>
          <p v-if="tab === 'mail-log'">Последние 2000 событий. «Принято сервером» не означает доставку или прочтение. Ссылки входа в журнал не записываются.</p>
          <p v-if="tab === 'subscribers'">Рассылку получают только пользователи, которые выбрали подписку и подтвердили адрес.</p>
          <div class="admin-table-wrap"><table class="admin-table">
            <thead><tr><th>{{ tab === 'calendars' ? 'Календарь' : 'E-mail' }}</th><th>Информация</th><th>Действия / дата</th></tr></thead>
            <tbody><tr v-for="(row, i) in items" :key="row.id ?? `${row.email}-${i}`">
              <td>{{ row.name ?? row.email }}</td>
              <td v-if="tab === 'calendars'">{{ row.year }} · {{ row.pages }} стр. · {{ ((row.bytes ?? 0) / 1048576).toFixed(1) }} МБ<br>{{ row.ownerEmail ?? 'Владелец не указан' }}</td>
              <td v-else>{{ statusLabel(row.status) }}<br>{{ row.kind === 'verification' ? 'Подтверждение' : row.kind === 'newsletter' ? 'Рассылка' : '' }}<details v-if="row.consentText"><summary>Согласие {{ row.consentVersion }}</summary>{{ row.consentText }}</details></td>
              <td><template v-if="row.id"><button v-if="tab === 'trash'" :disabled="busy" @click="restoreTrash(row.id)">Восстановить</button><template v-else><button :disabled="busy" @click="openPreview(row.id)">Просмотреть</button><button :disabled="busy" @click="removeCalendar(row.id)">В корзину…</button></template></template><span v-else>{{ row.at ?? row.confirmedAt ?? '—' }}</span></td>
            </tr></tbody>
          </table></div>
          <p v-if="!items.length && !busy">Записей пока нет.</p>
          <p><button :disabled="offset === 0 || busy" @click="load(tab, offset - 25)">Назад</button> {{ offset + (items.length ? 1 : 0) }}–{{ offset + items.length }} из {{ total }} <button :disabled="offset + 25 >= total || busy" @click="load(tab, offset + 25)">Далее</button></p>
        </template>
        <section v-if="preview && selectedPage" class="admin-preview">
          <h3>{{ preview.name }} — только просмотр</h3>
          <select v-model.number="pageIndex"><option v-for="(page, i) in preview.document.pages" :key="page.id" :value="i">{{ page.name }}</option></select>
          <button @click="preview = undefined">Закрыть просмотр</button>
          <div inert style="pointer-events:none;overflow:auto;background:#fff;">
            <PageScene :page="selectedPage" :assets="preview.assets" :calendar-year="year" :calendar-language="preview.calendarLanguage" :food-marker-pack-id="preview.foodMarkerPackId" :food-marker-assets="preview.foodMarkerAssets" :fasting-profile-id="preview.fastingProfileId" :pixels-per-mm="2" :show-guides="false" active-tool="hand" />
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-backdrop { padding:0; }
.admin-dialog { box-sizing:border-box; width: 100%; max-width: none; height: 100dvh; max-height: 100dvh; border:0; border-radius:0; display:flex; flex-direction:column; }
.admin-dialog > .application-dialog__content { flex:1; min-height:0; overflow:auto; padding:24px 32px; }
.admin-dialog .application-dialog__header { flex-shrink:0; }
.admin-dialog .application-dialog__header small { color:#b3924d; letter-spacing:2px; }
.admin-dialog button, .admin-dialog select, .admin-dialog input:not([type="checkbox"]), .admin-dialog textarea {
  font:inherit; color:#e8ece5; background:#26372f; border:1px solid #586456; border-radius:4px; padding:8px 12px;
}
.admin-dialog button { cursor:pointer; }
.admin-dialog button:hover:not(:disabled) { background:#354a3d; border-color:#b3924d; }
.admin-dialog button:disabled { opacity:.45; cursor:default; }
.admin-dialog button:focus-visible, .admin-dialog input:focus-visible, .admin-dialog textarea:focus-visible { outline:2px solid #b3924d; outline-offset:2px; }
.admin-nav { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px; }
.admin-nav button[aria-pressed="true"] { border-color:#b3924d; color:#e5c875; }
.admin-table-wrap { overflow:auto; }
.admin-table { width:100%; border-collapse:collapse; text-align:left; }
.admin-table th,.admin-table td { padding:12px; border-bottom:1px solid #48534b; overflow-wrap:anywhere; }
.admin-preview { border-top:1px solid #b3924d; margin-top:20px; }
.field-stack { margin:16px 0; }
textarea { width:100%; }
</style>
