<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {printRequest,printMoney,printOption,type PrintConfig,type PrintQuote,type PrintOrder,type PrintSource} from '../printing/print-client';
const props=defineProps<{source:PrintSource}>();
const emit=defineEmits<{close:[]}>();
const config=ref<PrintConfig>();const quote=ref<PrintQuote>();const created=ref<PrintOrder>();const error=ref('');const busy=ref(false);const accepted=ref(false);
const quantity=ref(50);const paper=ref('matte');const cover=ref('matte');const delivery=ref('pickup');const services=ref<string[]>([]);
const weights=ref('170');
const contact=ref({name:'',phone:'',address:'',company:'',taxId:'',comment:''});const requestId=crypto.randomUUID();
function options(){return {...props.source,quantity:quantity.value,paper:paper.value,cover:cover.value,delivery:delivery.value,services:services.value,weights:weights.value};}
watch([quantity,paper,cover,delivery,services,weights],()=>{quote.value=undefined;accepted.value=false;},{deep:true});
async function calculate(){busy.value=true;error.value='';quote.value=undefined;try{quote.value=await printRequest<PrintQuote>('quote','POST',options());}catch(e){error.value=String(e);}finally{busy.value=false;}}
async function submit(){if(!quote.value||!accepted.value)return;busy.value=true;error.value='';try{created.value=await printRequest<PrintOrder>('orders','POST',{...options(),contact:contact.value,requestId,acceptedTerms:true,acceptedTotal:quote.value.total,pricingRevision:quote.value.pricingRevision});}catch(e){error.value=String(e);}finally{busy.value=false;}}
onMounted(async()=>{try{config.value=await printRequest<PrintConfig>('config');paper.value=Object.keys(config.value.paper)[0]??'';cover.value=Object.keys(config.value.cover)[0]??'';delivery.value=Object.keys(config.value.delivery)[0]??'';}catch(e){error.value=String(e);}});
</script>
<template>
  <div class="application-dialog-backdrop"><section class="application-dialog print-order-dialog" role="dialog" aria-modal="true" aria-label="Заказать печать календаря">
    <header class="application-dialog__header"><h2>Заказать печать календаря</h2><button :disabled="busy" @click="emit('close')">Закрыть</button></header>
    <div class="application-dialog__content"><p v-if="error" role="alert">{{error}}</p>
      <template v-if="created"><h3>Заявка принята</h3><p>Заказ {{created.id}}</p><p>Типография проверит PDF и подтвердит заказ. Оплата появится в личном кабинете, в разделе «Мои заказы».</p><p>Итого: {{printMoney(created.quote.total,created.quote.currency)}}</p></template>
      <template v-else-if="config"><p v-if="!config.enabled">Приём заказов ещё не открыт. Типография настраивает цены и условия.</p>
        <form v-else @submit.prevent="submit"><fieldset :disabled="busy">
          <p>К заказу прикрепляется готовый PDF. Дальнейшее редактирование календаря не изменит этот файл.</p>
          <p>Monatskalender 13 Blatt (12 Monate + Deckblatt)</p>
          <div class="print-fields"><label>Тираж, шт.<input v-model.number="quantity" type="number" :min="config.minQuantity" max="10000" required /></label>
          <label>Плотность бумаги<select v-model="weights"><option v-for="(price,weight) in config.weights" :key="weight" :value="String(weight)">{{weight}} г/м² — +{{printMoney(price,config.currency)}} / шт.</option></select></label>
          <label>Бумага<select v-model="paper"><option v-for="(_,key) in config.paper" :key="key" :value="key">{{printOption(key)}} — +{{printMoney(config.paper[key]!,config.currency)}} / шт.</option></select></label>
          <label>Обложка<select v-model="cover"><option v-for="(_,key) in config.cover" :key="key" :value="key">{{printOption(key)}} — +{{printMoney(config.cover[key]!,config.currency)}} / шт.</option></select></label>
          <label>Получение<select v-model="delivery"><option v-for="(_,key) in config.delivery" :key="key" :value="key">{{printOption(key)}} — {{printMoney(config.delivery[key]!,config.currency)}}</option></select></label></div>
          <h3>Дополнительные услуги</h3><label v-for="service in config.services.filter(s=>s.enabled)" :key="service.id"><input v-model="services" type="checkbox" :value="service.id" /> {{service.name}} — {{printMoney(service.price,config.currency)}} {{service.perCopy?'за экземпляр':'за заказ'}}</label>
          <p><button type="button" @click="calculate">Рассчитать стоимость</button></p>
          <section v-if="quote"><h3>{{quote.format}} · {{quote.pages}} стр. · {{quantity}} шт.</h3><p v-for="(line,i) in quote.lines" :key="i">{{line.name}} · {{line.quantity}} × {{printMoney(line.unit,quote.currency)}} = {{printMoney(line.total,quote.currency)}}</p><h3>Итого: {{printMoney(quote.total,quote.currency)}}</h3><p>{{quote.taxNote}}</p><p style="white-space:pre-wrap">{{quote.terms}}</p></section>
          <h3>Контактные данные</h3><div class="print-fields"><label>Имя<input v-model="contact.name" required maxlength="200" autocomplete="name" /></label><label>Телефон<input v-model="contact.phone" type="tel" maxlength="100" autocomplete="tel" /></label><label>Организация<input v-model="contact.company" maxlength="200" /></label><label>Налоговый номер (если нужен)<input v-model="contact.taxId" maxlength="100" /></label></div><label>Адрес доставки<textarea v-model="contact.address" :required="delivery==='shipping'" maxlength="2000" autocomplete="street-address" /></label><label>Комментарий<textarea v-model="contact.comment" maxlength="2000" /></label>
          <label><input v-model="accepted" type="checkbox" :disabled="!quote" required /> Я проверил PDF, состав заказа, стоимость и принимаю условия печати.</label>
          <p><button :disabled="!quote||!accepted">Отправить заявку в типографию</button></p><p>Сейчас деньги не списываются. После проверки заказа оплатить его можно через Stripe.</p>
        </fieldset></form>
      </template>
    </div>
  </section></div>
</template>
<style scoped>
.print-order-dialog button{padding:8px 14px;border:1px solid #8c784a;border-radius:5px;background:#544a30;color:#f5ead1;cursor:pointer}.print-order-dialog button:disabled{opacity:.5;cursor:default}.print-order-dialog input:not([type=checkbox]),.print-order-dialog textarea,.print-order-dialog select{background:#18241e;border:1px solid #526458;border-radius:5px;color:#f3f2e7}.print-order-dialog input:focus,.print-order-dialog textarea:focus,.print-order-dialog select:focus{outline:2px solid #b39859}
.print-order-dialog{width:min(900px,95vw);max-height:92vh;overflow:auto}.print-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}label{display:block;margin:8px 0}input:not([type=checkbox]),textarea,select{display:block;width:100%;padding:8px}fieldset{border:0;padding:0}section section{padding:14px;background:#26382e;border:1px solid #8a7749;border-radius:8px}
</style>
