import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const browser=await chromium.launch(process.platform==='win32'?{channel:'msedge'}:{});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const makeDay=date=>({date,weekday:new Date(date+'T12:00:00Z').getUTCDay(),oldStyleDate:'2026-08-29',foodLabel:'пища с маслом',dayStyle:{rank:'great-feast'},events:[{category:'commemoration',title:'Память дня',typeCode:2}],icons:[{title:'Икона дня',imageUrl:'https://bible-desktop.com/api/calendar/icons/1/images/2'}]});
 await page.route('https://web.test/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/calendar-api-font.php')return route.fulfill({contentType:'font/ttf',body:fs.readFileSync('public/fonts/MonomakhUnicode.ttf')});
  if(url.pathname.endsWith('/service'))return route.fulfill({status:503,json:{message:'Temporarily unavailable'}});
  if(url.pathname.endsWith('/day'))return route.fulfill({json:{day:makeDay(url.searchParams.get('date'))}});
  if(url.pathname.endsWith('/month')||url.pathname.endsWith('/year')){
   const year=Number(url.searchParams.get('year')),month=url.searchParams.get('month');let days=[];
   for(let m=month?Number(month):1;m<=(month?Number(month):12);m++)for(let d=1;d<=new Date(Date.UTC(year,m,0)).getUTCDate();d++)days.push(makeDay(`${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`));
   return route.fulfill({json:{days}});
  }
  return route.fulfill({contentType:'text/html',body:fs.readFileSync('public/web-calendar.html','utf8')});
 });
 await page.route('https://bible-desktop.com/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="gold"/></svg>'}));
 await page.goto('https://web.test/web-calendar?date=2026-01-31');
 await page.locator('.day').first().waitFor();
 assert.equal(await page.locator('#days').evaluate(el=>getComputedStyle(el).display),'grid');
 await page.locator('#next').click();
 await page.waitForURL(/date=2026-02-28/);
 await page.locator('.day').first().click();
 await page.locator('dialog[open] .event-card').waitFor();
 assert.match(await page.locator('dialog').innerText(),/Богослужебные тексты сейчас недоступны/);
 assert.doesNotMatch(await page.locator('dialog').innerText(),/\[object Object\]|event-card|section-card/);
 assert.equal(await page.locator('dialog img').count(),1);
 await page.locator('#close').click();assert.equal(await page.locator('dialog[open]').count(),0);
 await page.locator('[data-view="year"]').click();await page.locator('.mini-month').first().waitFor();assert.equal(await page.locator('.mini-month').count(),12);
 await page.locator('[data-view="week"]').click();await page.locator('.week-day').first().waitFor();assert.equal(await page.locator('.week-day').count(),7);
 await page.locator('#lang').selectOption('cu');await page.locator('#submit').click();await page.waitForFunction(()=>document.querySelector('#calendar-panel').classList.contains('cu'));
 await page.locator('#lang').selectOption('ru');await page.locator('#submit').click();await page.waitForFunction(()=>!document.querySelector('#calendar-panel').classList.contains('cu'));
 await page.locator('#lang').selectOption('de');await page.locator('#submit').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Kalender geladen.');
 assert.equal(await page.locator('#submit').innerText(),'Kalender anzeigen');
 assert.equal(await page.locator('#calendar-panel .content-head h2').innerText(),'Woche');
 assert.equal(await page.locator('#month option:checked').innerText(),'Februar');
 await page.locator('.week-day').first().click();await page.locator('dialog[open] .event-card').waitFor();
 assert.match(await page.locator('dialog').innerText(),/Heilige und Feste/);
 assert.match(await page.locator('dialog').innerText(),/Liturgische Texte sind derzeit nicht verfügbar/);
 await page.locator('#close').click();
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'artifacts/web-calendar-verified.png'});
 console.log('PASS month/week/year layout, clamped month navigation, service failure isolation, day icons, close, font switching');
}finally{await browser.close()}
