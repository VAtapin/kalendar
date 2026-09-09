<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { catalogRequest } from '../collaboration/catalog-client';
type Plan = {id:string;name:string;priceCents:number;currency:string;perMinute:number;perDay:number;perMonth:number;enabled:boolean;published:boolean};
type Client = {id:string;name:string;email:string;kind:'standard'|'system';planId:string|null;enabled:boolean;expiresAt:string|null;revision:number;keyPrefix:string;createdAt:string;keyCreatedAt:string;lastUsedAt?:string;totalRequests?:number;usage?:Record<string,{bucket:string;count:number}>};
type Overview = {revision:number;plans:Plan[];clients:Client[];settings:{contactEmail:string;wordpressUrl:string};serverTime:string};
const emit=defineEmits<{dirty:[value:boolean]}>();
const data=ref<Overview>(); const busy=ref(false),error=ref(''),notice=ref(''),secret=ref(''),search=ref('');
const form=ref({name:'',email:'',kind:'standard',planId:'free',enabled:true,expiresAt:''});
const clients=computed(()=>data.value?.clients.filter(c=>`${c.name} ${c.email} ${c.keyPrefix}`.toLowerCase().includes(search.value.toLowerCase()))??[]);
async function load(){data.value=await catalogRequest<Overview>('admin/calendar-api');emit('dirty',false);}
async function run(action:()=>Promise<void>){busy.value=true;error.value='';notice.value='';try{await action();}catch(e){error.value=String(e);}finally{busy.value=false;}}
function changed(){emit('dirty',true);}
function price(plan:Plan,event:Event){plan.priceCents=Math.round(Number((event.target as HTMLInputElement).value)*100);changed();}
async function saveSettings(){await run(async()=>{data.value=await catalogRequest<Overview>('admin/calendar-api','PUT',data.value);emit('dirty',false);notice.value='Настройки API сохранены';});}
async function create(){await run(async()=>{const r=await catalogRequest<{key:string}>('admin/calendar-api/clients','POST',{...form.value,expiresAt:form.value.expiresAt||null});secret.value=r.key;await load();form.value.name='';form.value.email='';notice.value='Клиент создан. Скопируйте ключ и передайте клиенту безопасным способом.';});}
async function saveClient(client:Client){await run(async()=>{const r=await catalogRequest<{client:Client}>(`admin/calendar-api/clients/${client.id}`,'PUT',{...client,expiresAt:client.expiresAt||null});Object.assign(client,r.client);notice.value='Клиент сохранён';});}
async function rotate(client:Client){if(!confirm('Перевыпустить ключ? Прежний ключ немедленно перестанет работать.'))return;await run(async()=>{const r=await catalogRequest<{key:string;client:Client}>(`admin/calendar-api/clients/${client.id}/rotate`,'POST',{revision:client.revision});secret.value=r.key;Object.assign(client,r.client);notice.value='Новый ключ создан. Счётчики запросов сохранены.';});}
async function copy(){try{await navigator.clipboard.writeText(secret.value);notice.value='Ключ скопирован';}catch{notice.value='Выделите ключ и скопируйте вручную.';}}
function count(client:Client,window:string){const now=data.value?.serverTime??'';const bucket=window==='month'?now.slice(0,7):window==='day'?now.slice(0,10):now.slice(0,16);return client.usage?.[window]?.bucket===bucket?client.usage[window]!.count:0;}
function addPlan(){if(!data.value)return;data.value.plans.push({id:`plan-${Date.now()}`,name:'Новый тариф',priceCents:0,currency:'EUR',perMinute:30,perDay:300,perMonth:1000,enabled:false,published:false});changed();}
onMounted(()=>run(load));
</script>
<template><section class="api-admin">
  <h2>API календаря — тарифы и клиенты</h2>
  <p>Стоимость указана за месяц в EUR. Оплата и предоставление платного доступа согласуются вручную; автоматических списаний нет.</p>
  <p v-if="error" role="alert">{{error}}</p><p v-if="notice" role="status">{{notice}}</p>
  <section v-if="secret" class="secret"><h3>Новый ключ — показывается только сейчас</h3><p>Сохраните и передайте клиенту. После закрытия получить этот же ключ нельзя: только перевыпустить. На сервере хранится хеш, не открытый ключ.</p><input :value="secret" readonly aria-label="Новый API-ключ" autocomplete="off" data-no-translate><button @click="copy">Скопировать ключ</button><button @click="secret=''">Скрыть ключ</button></section>
  <template v-if="data">
    <h3>Тарифы</h3><p>«Включён» разрешает доступ назначенным клиентам; «Показывать на сайте» публикует включённый тариф. Начальные платные тарифы — черновики.</p>
    <div class="plans"><fieldset v-for="plan in data.plans" :key="plan.id" :disabled="busy" @input="changed"><legend>{{plan.id}}</legend>
      <label>Название<input v-model="plan.name" maxlength="120"></label>
      <label>EUR / месяц<input type="number" min="0" max="100000" step="0.01" :value="plan.priceCents/100" @input="price(plan,$event)"></label>
      <label>Запросов в минуту<input v-model.number="plan.perMinute" type="number" min="1" max="10000"></label>
      <label>Запросов в день<input v-model.number="plan.perDay" type="number" min="1" max="10000000"></label>
      <label>Запросов в месяц<input v-model.number="plan.perMonth" type="number" min="1" max="100000000"></label>
      <label><input v-model="plan.enabled" type="checkbox"> Включён</label><label><input v-model="plan.published" type="checkbox"> Показывать на сайте</label>
    </fieldset></div>
    <button :disabled="busy||data.plans.length>=20" @click="addPlan">Добавить тариф</button>
    <label>Контактный e-mail для получения API-ключа<input v-model="data.settings.contactEmail" type="email" @input="changed"></label>
    <label>Дополнительная ссылка на WordPress-плагин<input v-model="data.settings.wordpressUrl" type="url" placeholder="https://…" @input="changed"></label>
    <p>Установочный ZIP доступен на странице «API календаря». Здесь можно указать дополнительную страницу плагина.</p>
    <button :disabled="busy" @click="saveSettings">Сохранить тарифы и настройки</button>
    <h3>Создать клиента и выдать ключ</h3><p>Системный доступ — для собственных серверных интеграций, например BibleDesktop: без тарифных квот, только чтение. Отключение и срок действия сохраняются.</p><form @submit.prevent="create"><fieldset :disabled="busy"><div class="fields">
      <label>Имя / организация<input v-model="form.name" required maxlength="160"></label><label>E-mail клиента<input v-model="form.email" type="email" required maxlength="254"></label>
      <label>Тип доступа<select v-model="form.kind"><option value="standard">Клиент по тарифу</option><option value="system">Системный — без квот</option></select></label>
      <label v-if="form.kind!=='system'">Тариф<select v-model="form.planId"><option v-for="plan in data.plans" :key="plan.id" :value="plan.id">{{plan.name}}{{plan.enabled?'':' — отключён'}}</option></select></label>
      <label>Доступ до даты включительно (UTC)<input v-model="form.expiresAt" type="date"></label></div><button>Создать клиента и ключ</button></fieldset></form>
    <h3>Клиенты и запросы</h3><label>Поиск клиента<input v-model="search" type="search"></label><button :disabled="busy" @click="run(load)">Обновить список</button>
    <p>Лимиты и счётчики — по UTC. Смена ключа не обнуляет использование. После редактирования клиента нажмите «Сохранить клиента».</p>
    <article v-for="client in clients" :key="client.id"><h4 data-no-translate>{{client.name}} · {{client.keyPrefix}}…</h4><div class="fields">
      <label>Имя / организация<input v-model="client.name" maxlength="160"></label><label>E-mail клиента<input v-model="client.email" type="email"></label>
      <label>Тип доступа<select v-model="client.kind"><option value="standard">Клиент по тарифу</option><option value="system">Системный — без квот</option></select></label>
      <label v-if="client.kind!=='system'">Тариф<select v-model="client.planId"><option :value="null" disabled>Выберите тариф</option><option v-for="plan in data.plans" :key="plan.id" :value="plan.id">{{plan.name}}</option></select></label>
      <label>Доступ до даты включительно (UTC)<input v-model="client.expiresAt" type="date"></label></div>
      <label><input v-model="client.enabled" type="checkbox"> Доступ включён</label>
      <p>Сегодня: {{count(client,'day')}} · За месяц: {{count(client,'month')}} · Всего: {{client.totalRequests??0}}</p>
      <p>Последний запрос: {{client.lastUsedAt?new Date(client.lastUsedAt).toLocaleString():'—'}}</p>
      <button :disabled="busy" @click="saveClient(client)">Сохранить клиента</button><button :disabled="busy" @click="rotate(client)">Перевыпустить ключ</button>
    </article><p v-if="!clients.length">Клиентов пока нет.</p>
  </template>
</section></template>
<style scoped>
.api-admin{max-width:1200px;margin:auto}.plans,.fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}fieldset,article,.secret{border:1px solid #69735e;padding:18px;border-radius:8px;margin:16px 0;min-width:0}.secret{border-color:#e1bd65}label{display:block;margin:10px 0}input:not([type=checkbox]),select{display:block;box-sizing:border-box;width:100%;margin-top:5px;padding:9px;font:inherit}button{margin:5px;padding:10px}h4{overflow-wrap:anywhere}[role=alert]{color:#ffa6a6}
</style>
