import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{windowsHide:true,stdio:'ignore'});
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
  const zip=await fetch(origin+'/downloads/orthocal-1.3.24.zip');assert.equal(zip.status,200);const bytes=new Uint8Array(await zip.arrayBuffer());assert.equal(String.fromCharCode(...bytes.slice(0,2)),'PK');
  const guide=await fetch(origin+'/downloads/calendar-api-guide.md');assert.equal(guide.status,200);assert.ok((await guide.text()).includes('X-API-Key'));
  assert.ok(!requests.some(url=>/\/assets\/(?:App-|pdf-exporter-)/.test(url)),'Editor must not load on home/docs');
  mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/calendar-api-docs-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.querySelector('.route-shell').scrollWidth<=innerWidth));await page.screenshot({path:'artifacts/calendar-api-docs-mobile.png',fullPage:true});
  await page.reload();await page.getByRole('heading',{name:'API календаря',exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS home link, documentation route/reload, published plans/contact, real ZIP and guide, mobile width, no editor download');
}finally{await browser?.close();server.kill();}
