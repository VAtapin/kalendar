import {chromium,expect} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
mkdirSync('tmp',{recursive:true});const data=mkdtempSync(resolve('tmp/print-browser-'));
const hash=execFileSync('php',['-r','echo password_hash("local-test-password-123", PASSWORD_DEFAULT);'],{encoding:'utf8'});
const env={...process.env,CALENDAR_DATA_DIR:data,APP_PUBLIC_URL:'http://127.0.0.1:5178',ADMIN_LOGIN:'admin',ADMIN_PASSWORD_HASH:hash,MAIL_TRANSPORT:'disabled-test',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:''};
const seed=JSON.parse(execFileSync('php',['-r',`
require 'public/api/lib.php';$s=new CalendarStore(getenv('CALENDAR_DATA_DIR'));
$c=$s->printConfig();$c['enabled']=true;$c['notificationEmail']='test@example.org';$c['taxNote']='TEST inclusive price';$s->printConfig($c);
$l=$s->accountEmailLink('print-browser@example.org',false);$t=$s->accountSetPassword($l['token'],'print-password-123');$u=$s->accountUser($t);
$p=['name'=>'Тестовый календарь','year'=>2027,'document'=>['pages'=>array_fill(0,13,['width'=>297,'height'=>420])],'assets'=>[]];$r=$s->accountSaveCalendar($u['id'],null,$p,0);
$pdf="%PDF-1.4\\nfixture\\n%%EOF";$upload=$s->createPdfUpload($u['id'],'print.pdf',strlen($pdf));$id=$upload['upload']['id'];$s->writePdfChunk($id,$upload['uploadToken'],0,$pdf);$s->completePdfUpload($id,$upload['uploadToken']);
echo json_encode(['token'=>$t,'source'=>['calendarId'=>$r['id'],'calendarRevision'=>$r['revision'],'pdfId'=>$id]]);
`],{env,encoding:'utf8'}));
const server=spawn('php',['-S','127.0.0.1:18992','scripts/php-dev-router.php'],{env,stdio:'ignore',windowsHide:true});
const browser=await chromium.launch({channel:'msedge'});
try{
  for(let i=0;i<50;i++){try{await fetch('http://127.0.0.1:18992/api/health');break;}catch{await new Promise(r=>setTimeout(r,100));}}
  const context=await browser.newContext({viewport:{width:1280,height:1000}});
  await context.addCookies([{name:'calendar_account',value:seed.token,domain:'127.0.0.1',path:'/api',httpOnly:true,sameSite:'Strict'}]);
  await context.route('**/api/**',async route=>{const u=new URL(route.request().url());const response=await route.fetch({url:'http://127.0.0.1:18992'+u.pathname+u.search});await route.fulfill({response});});
  const page=await context.newPage();page.on('pageerror',e=>console.log('PAGE ERROR',e.message));await page.goto('http://127.0.0.1:5178');
  async function mount(component,props){await page.evaluate(async({component,props})=>{const {createApp}=await import(performance.getEntriesByType('resource').map(r=>r.name).find(url=>url.includes('/deps/vue.js?'))??'/node_modules/.vite/deps/vue.js');const {default:Panel}=await import('/src/components/'+component+'.vue');document.querySelector('#app')?.remove();document.querySelector('#print-test')?.remove();const host=document.createElement('div');host.id='print-test';document.body.append(host);createApp(Panel,props).mount(host);},{component,props});}
  await mount('PrintOrderDialog',{source:seed.source});
  await page.getByLabel('Тираж, шт.').fill('50');await page.getByLabel('Плотность бумаги').selectOption('250');
  await page.getByLabel(/Проверка перед печатью/).check();await page.getByLabel(/Фолирование первой страницы/).check();
  await page.getByRole('button',{name:'Рассчитать стоимость'}).click();
  await expect(page.getByRole('heading',{name:/Итого:/})).toContainText('350');
  await page.getByLabel('Имя',{exact:true}).fill('Тестовый клиент');await page.getByLabel(/Я проверил PDF/).check();
  await page.screenshot({path:'tmp/print-order-form.png',fullPage:true});
  await page.getByRole('button',{name:'Отправить заявку в типографию'}).click();await expect(page.getByRole('heading',{name:'Заявка принята'})).toBeVisible();
  const order=await page.evaluate(async()=>(await(await fetch('/api/v1/print/orders')).json()).items[0]);
  if(order.quote.total!==35000)throw new Error('Incorrect server total');
  const denied=await fetch('http://127.0.0.1:18992/api/v1/print/orders/'+order.id+'/pdf');if(denied.status!==401)throw new Error('Anonymous PDF access');
  await mount('PrintOrdersPanel',{});await expect(page.getByText('Тестовый календарь · 50 шт.')).toBeVisible();await expect(page.getByRole('button',{name:'Оплатить через Stripe'})).toHaveCount(0);
  await page.evaluate(async()=>{const r=await fetch('/api/v1/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:'admin',password:'local-test-password-123'})});if(!r.ok)throw new Error('Admin login failed');});
  await mount('PrintOrdersPanel',{admin:true});await page.getByRole('button',{name:'PDF проверен — разрешить оплату'}).click();await expect(page.getByText(/Подтверждён — можно оплатить/).first()).toBeVisible();
  await page.getByRole('button',{name:'Цены и Stripe'}).click();await expect(page.getByText(/Stripe: не настроен/)).toBeVisible();await page.screenshot({path:'tmp/print-admin-pricing.png',fullPage:true});
  await mount('PrintOrdersPanel',{});await page.getByRole('button',{name:'Оплатить через Stripe'}).click();await expect(page.getByRole('alert')).toContainText('Stripe');
  console.log('PASS: real pricing API, form, options, order creation, private PDF, admin approval, cabinet, Stripe disabled safely. No real emails/payments.');
}finally{await browser.close();server.kill();}
