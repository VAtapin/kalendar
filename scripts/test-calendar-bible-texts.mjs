import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const browser=await chromium.launch(process.platform==='win32'?{channel:'msedge'}:{});
const page=await browser.newPage();
const requests=[];
const translations=[{code:'CU1',name:'Церковнославянский один',language:{code:'cu',name:'Церковнославянский'}},{code:'CU2',name:'Церковнославянский два',language:{code:'cu',name:'Церковнославянский'}},{code:'RU1',name:'Русский',language:{code:'ru',name:'Русский'}}];
let mode='ok',releaseSlow;
const passage=(sc,sv,ec,ev)=>({book:'Gal',start:{chapter:sc,verse:sv},end:{chapter:ec,verse:ev}});
const event={title:'Гал.2:21-3:3,5',sourceTitle:'Гал.2:21-3:3,5',category:'scripture-reading',typeCode:204,localization:'exact',source:null,reading:{schemaVersion:1,parseStatus:'parsed',numbering:'unknown',passages:[passage(2,21,3,3),passage(3,5,3,5),passage(3,1,3,1)],issues:[]}};
const calendar={metadata:{language:'cu'},day:{date:'2026-09-09',weekdayName:'Среда',oldStyleDate:'2026-08-27',pascha:'2026-04-12',daysFromPascha:150,foodLabel:'Пост',fasting:{},icons:[],events:[event]}};
try {
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname==='/calendar-api-test.html')return route.fulfill({contentType:'text/html',body:readFileSync('public/calendar-api-test.html','utf8')});
    const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'X-API-Key,Accept','Access-Control-Allow-Methods':'GET,OPTIONS'};
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    requests.push({url:url.href,key:request.headers()['x-api-key']});
    if(url.pathname==='/calendar-api-font.php')return route.fulfill({headers,contentType:'font/ttf',body:readFileSync('public/fonts/MonomakhUnicode.ttf')});
    if(url.hostname==='calendar.test')return route.fulfill({headers,json:calendar});
    assert.equal(url.hostname,'bible-desktop.com');assert.equal(request.headers()['x-api-key'],undefined,'Calendar secret leaked to BibleDesktop');
    if(url.pathname==='/api/translations')return route.fulfill({headers,json:{data:translations}});
    const match=url.pathname.match(/^\/api\/translations\/(CU1|CU2|RU1)\/books(?:\/galatians\/chapters\/(\d+))?$/);
    assert.ok(match,url.href);
    const translation=translations.find(t=>t.code===match[1]);
    const book={slug:'galatians',chapters_count:6,canonical_book:{osis_code:'Gal'}};
    if(!match[2])return route.fulfill({headers,json:{data:{translation,books:[book]}}});
    const chapter=Number(match[2]);
    if(mode==='slow'&&translation.code==='CU1')await new Promise(resolve=>{releaseSlow=resolve;});
    const count=chapter===2?21:6;
    let verses=Array.from({length:count},(_,i)=>({number:i+1,plain_text:translation.code+' '+chapter+':'+(i+1)+' <img onerror=alert(1)>',text:'unsafe'}));
    if(mode==='missing'&&chapter===3)verses=verses.filter(v=>v.number!==2);
    if(mode==='old')verses=verses.map(({plain_text,...v})=>v);
    await route.fulfill({headers,json:{data:{translation,book,chapter:{number:chapter},verses}}});
  });
  await page.goto('https://calendar.test/calendar-api-test.html');


  await page.locator('#lang').selectOption('cu');
  await page.locator('#submit').click();
  await page.waitForFunction(()=>document.getElementById('bible-status').textContent.includes('чтений получено 1'));
  assert.equal(await page.locator('#bible-language').inputValue(),'cu');
  assert.deepEqual(await page.locator('.bible-verse .tag').allTextContents(),['Gal 2:21 ','Gal 3:1 ','Gal 3:2 ','Gal 3:3 ','Gal 3:5 ','Gal 3:1 ']);
  assert.equal(await page.locator('.reading-text img').count(),0);
  assert.equal(await page.locator('.bible-verse span[lang=cu]').count(),6);
  assert.ok(requests.filter(r=>r.url.includes('calendar.test/api/')).every(r=>r.key===undefined));
  await page.locator('#bible-translation').selectOption('CU2');
  await page.waitForFunction(()=>document.querySelector('.bible-verse')?.textContent.includes('CU2'));
  assert.ok(!(await page.locator('.reading-text').textContent()).includes('CU1'));
  await page.locator('#bible-language').selectOption('ru');
  await page.waitForFunction(()=>document.querySelector('.bible-verse')?.textContent.includes('RU1'));
  assert.equal(await page.locator('#bible-translation').inputValue(),'RU1');
  // Gaps and old plain-text schema are errors, never silently incomplete success.
  mode='missing';await page.locator('#bible-refresh').click();
  await page.waitForFunction(()=>document.querySelector('.reading-text .error')?.textContent.includes('отсутствуют'));
  assert.equal(await page.locator('.bible-verse').count(),0);
  mode='old';await page.locator('#bible-refresh').click();
  await page.waitForFunction(()=>document.querySelector('.reading-text .error')?.textContent.includes('plain_text'));
  // An unavailable selected language must not fall back to Russian.
  await page.reload();mode='ok';calendar.metadata.language='pl';

  await page.locator('#submit').click();
  await page.waitForFunction(()=>document.getElementById('bible-status').textContent.includes('Нет перевода'));
  assert.equal(await page.locator('#bible-language').inputValue(),'pl');assert.equal(await page.locator('.bible-verse').count(),0);
  // A superseded in-flight response cannot replace the newly selected translation.
  calendar.metadata.language='cu';await page.locator('#submit').click();
  await page.waitForFunction(()=>document.getElementById('bible-status').textContent.includes('чтений получено 1'));
  mode='slow';await page.locator('#bible-refresh').click();
  for(let i=0;i<100&&!releaseSlow;i++)await new Promise(resolve=>setTimeout(resolve,20));
  assert.ok(releaseSlow,'Delayed request did not start');
  await page.locator('#bible-translation').selectOption('CU2');
  await page.waitForFunction(()=>document.querySelector('.bible-verse')?.textContent.includes('CU2'));
  mode='ok';releaseSlow();await page.waitForTimeout(100);
  assert.ok(!(await page.locator('.reading-text').textContent()).includes('CU1'));
  event.reading.passages=[passage(3,null,3,null)];await page.locator('#submit').click();
  await page.waitForFunction(()=>document.querySelectorAll('.bible-verse').length===6&&document.querySelector('.bible-verse')?.textContent.includes('3:1'));
  assert.deepEqual(await page.locator('.bible-verse .tag').allTextContents(),['Gal 3:1 ','Gal 3:2 ','Gal 3:3 ','Gal 3:4 ','Gal 3:5 ','Gal 3:6 ']);
  // Partial parse remains visible but does not become an apparently complete text.
  event.reading.parseStatus='partial';await page.locator('#submit').click();
  await page.waitForFunction(()=>document.querySelector('.reading-text .error')?.textContent.includes('не полностью'));
  assert.equal(await page.locator('.bible-verse').count(),0);
  console.log('PASS: Bible languages/catalogue, multi-chapter/gapped ranges, safe text, missing verses/schema, no language fallback, stale response guard, partial parse, calendar-key isolation');
} finally {await browser.close();}
