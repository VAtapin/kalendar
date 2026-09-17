import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const wordpressPluginDownload='https://github.com/VAtapin/wp_orthodox_calendar/releases/latest/download/orthocal.zip';
const translatorPluginRelease='https://github.com/VAtapin/wp_cu_translator/releases/tag/1.0.0';
const translatorPluginRepository='https://github.com/VAtapin/wp_cu_translator';
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{windowsHide:true,stdio:'ignore'});
let browser;
try {
  for(let i=0;i<60;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch(process.platform==='win32'?{channel:'msedge'}:{});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.route('**/api/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(route.request().url().includes('calendar-access/plans')?{plans:[{id:'free',name:'Free',priceCents:0,currency:'EUR',perMinute:30,perDay:300,perMonth:1000}],settings:{contactEmail:'test@example.invalid'}}:{items:[],pages:[]})}));
  await page.goto(origin);await page.getByRole('link',{name:'API календаря',exact:true}).click();
  await page.getByRole('heading',{name:'API календаря',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Free',exact:true}).waitFor();
  assert.ok(page.url().endsWith('/calendar-api'));
  assert.equal(await page.getByRole('link',{name:'Запросить API-ключ'}).getAttribute('href'),'mailto:test@example.invalid');
  const pluginLink=page.getByRole('link',{name:'Скачать последнюю версию WordPress-плагина'});
  assert.equal(await pluginLink.getAttribute('href'),wordpressPluginDownload);
  assert.match(await page.locator('#wordpress').textContent(),/работает сразу, без регистрации и API-ключа/);
  const translatorSection=page.locator('#translator-plugin');
  await translatorSection.getByRole('heading',{name:'Церковнославянский переводчик для WordPress'}).waitFor();
  assert.equal(await translatorSection.getByRole('link',{name:'Открыть GitHub Release 1.0.0 ↗'}).getAttribute('href'),translatorPluginRelease);
  assert.equal(await translatorSection.getByRole('link',{name:'Исходный код на GitHub ↗'}).getAttribute('href'),translatorPluginRepository);
  assert.match(await translatorSection.textContent(),/Бесплатный режим работает сразу/);
  assert.match(await page.locator('#connection').textContent(),/X-Calendar-Client: orthocal-wordpress/);
  const guide=await fetch(origin+'/downloads/calendar-api-guide.md');assert.equal(guide.status,200);const guideText=await guide.text();assert.ok(guideText.includes('X-API-Key'));assert.ok(guideText.includes(wordpressPluginDownload));
  assert.ok(!requests.some(url=>/\/assets\/(?:App-|pdf-exporter-)/.test(url)),'Editor must not load on home/docs');
  if(process.env.CALENDAR_API_DOCS_SCREENSHOTS!=='0'){mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/calendar-api-docs-desktop.png',fullPage:true});}
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.querySelector('.route-shell').scrollWidth<=innerWidth));if(process.env.CALENDAR_API_DOCS_SCREENSHOTS!=='0')await page.screenshot({path:'artifacts/calendar-api-docs-mobile.png',fullPage:true});
  await page.reload();await page.getByRole('heading',{name:'API календаря',exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS home link, documentation route/reload, published plans/contact, real ZIP and guide, mobile width, no editor download');
}finally{await browser?.close();server.kill();}
