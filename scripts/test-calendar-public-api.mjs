import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { chromium } from 'playwright';

// Test only an isolated local PHP server and its disposable generated cache.
mkdirSync('tmp', { recursive: true });
const data = mkdtempSync(resolve('tmp/calendar-api-test-'));
const unitData = mkdtempSync(resolve('tmp/calendar-access-test-'));
console.log(execFileSync('php', ['scripts/test-calendar-access.php', unitData], {encoding:'utf8'}).trim());
const key = execFileSync('php', ['scripts/test-calendar-access.php', data, '--fixture'], {encoding:'utf8'}).trim();
const systemKey = execFileSync('php', ['scripts/test-calendar-access.php', data, '--system-fixture'], {encoding:'utf8'}).trim();
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const base = `${origin}/api/v1/calendar`;
let logs = '';
const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', resolve('dist'), 'scripts/php-dev-router.php'], {
  windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
  env: { ...process.env, CALENDAR_DATA_DIR: data, APP_PUBLIC_URL: origin },
});
server.stderr.on('data', chunk => { logs += chunk; });
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { await fetch(base); break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  const request = async (path, options) => {
    const response = await fetch(base + path, {...options, headers:{'X-API-Key':key,...options?.headers}});
    return { response, body: await response.json() };
  };
  assert.equal((await fetch(base)).status,200);
  const demoUrl=origin+'/api/v1/calendar-demo/day?date=2027-05-02';
  const demoHeaders={Origin:origin,Referer:origin+'/calendar-api-test.html','Sec-Fetch-Site':'same-origin','X-Calendar-Demo':'1'};
  assert.equal((await fetch(demoUrl)).status,405);
  assert.equal((await fetch(demoUrl,{method:'OPTIONS'})).status,405);
  assert.equal((await fetch(demoUrl,{method:'POST'})).status,403);
  for(const overrides of [{Origin:'https://foreign.test'},{Origin:'null'},{Referer:origin+'/other.html'},{Referer:origin+'/calendar-api-test.html/other'},{'Sec-Fetch-Site':'cross-site'},{'X-Calendar-Demo':''}]) {
    const denied=await fetch(demoUrl,{method:'POST',headers:{...demoHeaders,...overrides}});
    assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
  }
  for(let run=0;run<3;run++) {
    const demo=await fetch(demoUrl,{method:'POST',headers:demoHeaders});
    assert.equal(demo.status,200);assert.equal((await demo.json()).day.date,'2027-05-02');
    assert.equal(demo.headers.get('x-api-month-limit'),null);
    assert.equal(demo.headers.get('access-control-allow-origin'),null);
  }
  assert.equal((await fetch(demoUrl+'&unknown=1',{method:'POST',headers:demoHeaders})).status,400);
  assert.equal((await fetch(origin+'/api/v1/calendar-demo/year?year=2027',{method:'POST',headers:demoHeaders})).status,404);
  assert.equal((await fetch(base+'/day?date=2027-05-02',{headers:demoHeaders})).status,401);
  console.log('PASS hosted demo: origin/page checks, no key or quota, day-only scope, normal API still protected');
  const textsBase=origin+'/api/v1/calendar-texts/';
  assert.equal((await fetch(textsBase)).status,401);
  const textRequest=(suffix='',options={})=>fetch(textsBase+suffix,{...options,headers:{'X-API-Key':systemKey,...options.headers}});
  const libraryResponse=await textRequest();const library=await libraryResponse.json();
  assert.equal(libraryResponse.status,200);assert.equal(library.count,98);
  assert.equal(library.assignment,'reference-only');assert.equal(library.completeness.automaticAssignment,false);
  assert.equal(libraryResponse.headers.get('X-Calendar-Application-Cache-TTL'),'300');
  assert.equal(library.contentHash,JSON.parse(readFileSync('public/data/liturgical-texts.json','utf8')).contentHash);
  assert.equal((await textRequest('',{headers:{'If-None-Match':libraryResponse.headers.get('etag')}})).status,304);
  assert.equal((await (await textRequest('?scope=resurrection&tone=1&type=troparion')).json()).count,1);
  assert.equal((await (await textRequest('?language=de')).json()).count,0);
  assert.equal((await textRequest('?id=not-a-real-text')).status,404);
  for(const query of ['?tone=9','?weekday=7','?type[]=prayer','?date=2027-05-02'])assert.equal((await textRequest(query)).status,400);
  assert.equal((await textRequest('',{method:'HEAD'})).status,200);
  console.log('PASS liturgical reference API: 98 texts, filters, auth, conditional cache, no automatic date assignment');
  for (const path of ['/day?date=2027-05-02','/month?year=2027&month=5','/year?year=2027','/pascha?year=2027']) {
    const denied=await fetch(base+path);assert.equal(denied.status,401);assert.equal(denied.headers.get('cache-control'),'private, no-store');
  }
  const today=await fetch(base+'/today');assert.equal(today.status,200);
  const berlin=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  assert.equal((await today.json()).day.date,berlin);
  for (const path of ['/today?date=2027-05-02','/today?year=2027','/today?api_key=example','/day?date=2027-05-02&unknown=1']) assert.equal((await fetch(base+path)).status,400);
  assert.equal((await fetch(base+'/day?date=2027-05-02',{headers:{'X-API-Key':'cal_'+ '0'.repeat(64)}})).status,401);
  const systemResponse=await fetch(base+'/day?date=2027-05-02',{headers:{'X-API-Key':systemKey}});
  await systemResponse.json();
  assert.equal(systemResponse.status,200);assert.equal(systemResponse.headers.get('X-API-Month-Limit'),null);assert.equal(systemResponse.headers.get('X-API-Month-Remaining'),null);
  assert.equal((await fetch(base+'/day?date=2027-05-02',{method:'POST',headers:{'X-API-Key':systemKey}})).status,405);
  const metadata = await request('');
  assert.equal(metadata.response.status, 200);
  assert.equal(metadata.body.apiVersion, '1.0.0');
  assert.equal(metadata.response.headers.get('access-control-allow-origin'), '*');
  assert.equal(metadata.response.headers.get('access-control-allow-credentials'), null);
  assert.equal(metadata.response.headers.get('set-cookie'), null);
  assert.deepEqual(metadata.body.yearRange, { min: 1900, max: 2200 });
  const options = await fetch(base + '/day', { method: 'OPTIONS', headers: { Origin: 'null', 'Access-Control-Request-Method': 'GET' } });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('access-control-allow-origin'), '*');
  assert.equal((await request('/day', {method:'POST'})).response.status, 405);
  for (const path of ['/day?date=2027-02-29', '/day?date=2027-13-01', '/day?date[]=2027-05-02',
    '/year?year=../2027', '/year?year=1899', '/year?year=2201', '/month?year=2027&month=13',
    '/day?date=2027-05-02&lang=en', '/day?date=2027-05-02&profile=unknown']) {
    assert.equal((await request(path)).response.status, 400, path);
  }
  assert.equal((await request('/unknown')).response.status, 404);
  const first = await request('/day?date=2027-05-02', {headers:{Origin:'null'}});
  assert.equal(first.response.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.day.pascha, '2027-05-02');
  assert.equal(first.body.day.daysFromPascha, 0);
  assert.equal(first.body.day.events[0].typikonMark.id, 'great');
  assert.equal(first.body.day.events[0].source.raw.name, 'Светлое Христово Воскресение. Пасха');
  assert.ok(first.body.day.events.some(event => event.category === 'scripture-reading'));
  assert.ok(first.body.day.events.some(event => event.typeCode > 6 && event.typikonMark === null));
  assert.ok(first.body.day.foodMarkers.length > 1);
  const etag = first.response.headers.get('etag');
  const unchanged = await fetch(base + '/day?date=2027-05-02', {headers:{'If-None-Match':etag,'X-API-Key':key}});
  assert.equal(unchanged.status, 304); assert.equal(await unchanged.text(), '');
  const head = await fetch(base + '/day?date=2027-05-02', {method:'HEAD',headers:{'X-API-Key':key}});
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  const year = await request('/year?year=2027');
  assert.equal(year.body.days.length, 365);
  assert.deepEqual(year.body.days.find(day => day.date === '2027-05-02'), first.body.day);
  const leap = await request('/month?year=2028&month=02');
  assert.equal(leap.body.days.length, 29); assert.equal(leap.body.days.at(-1).date, '2028-02-29');
  const summary = await request('/month?year=2028&month=02&view=summary');
  assert.equal(summary.body.view,'summary'); assert.equal(summary.body.days.length,29);
  assert.equal(summary.body.days[0].date,leap.body.days[0].date);
  assert.ok(!('source' in summary.body.days[0].events[0]));
  assert.ok(JSON.stringify(summary.body).length < JSON.stringify(leap.body).length / 2);
  assert.equal(summary.response.headers.get('x-calendar-application-cache-ttl'),'300');
  const upcoming = await request('/upcoming?date=2027-12-30&limit=5&filter=twelve');
  assert.equal(upcoming.response.status,200); assert.equal(upcoming.body.items.length,5);
  assert.ok(upcoming.body.items.every(item=>item.date>='2027-12-30'&&item.date<='2028-12-30'&&item.event.typeCode<=1));
  assert.ok(upcoming.body.items.some(item=>item.date.startsWith('2028')));
  for(const path of ['/month?year=2027&month=5&view=bad','/upcoming?date=2027-02-29','/upcoming?date=2027-01-01&limit=11','/upcoming?date=2027-01-01&filter=bad']) assert.equal((await request(path)).response.status,400);
  assert.equal((await fetch(base+'/upcoming?date=2027-01-01')).status,401);
  const pascha = await request('/pascha?year=2027'); assert.equal(pascha.body.pascha, first.body.day.pascha);
  for (const lang of ['de', 'cu', 'uk', 'pl']) {
    const localized = await request(`/day?date=2027-05-02&lang=${lang}`);
    assert.equal(localized.response.status, 200);
    assert.equal(localized.body.metadata.language, lang);
    assert.equal(localized.body.day.events.length, first.body.day.events.length);
    assert.notEqual(localized.body.day.events[0].localization, 'source-fallback');
  }
  const strict = await request('/day?date=2027-07-14');
  const parish = await request('/day?date=2027-07-14&profile=parish');
  assert.equal(strict.body.day.fasting.foodRule.id, 'dry-eating');
  assert.equal(parish.body.day.fasting.foodRule.id, 'oil');
  assert.notEqual(strict.body.metadata.fastingProfileId, parish.body.metadata.fastingProfileId);
  assert.ok(readdirSync(data).every(file => ['public-calendar-cache','api-access.json','locks'].includes(file)), 'Public API must not create account or project storage');
  for (const [path,method] of [['','GET'],['','PUT'],['/clients','POST'],['/clients/00000000-0000-4000-8000-000000000000/rotate','POST']]) {
    const denied=await fetch(origin+'/api/v1/admin/calendar-api'+path,{method,headers:{'Content-Type':'application/json','X-API-Key':systemKey},...(method==='GET'?{}:{body:'{}'})});
    assert.equal(denied.status,403);assert.equal(denied.headers.get('cache-control'),'private, no-store');
  }
  const privateSession=await fetch(origin+'/api/v1/account/session',{headers:{Origin:'null'}});
  assert.equal(privateSession.headers.get('access-control-allow-origin'),null,'Private routes must not inherit public CORS');
  assert.ok(readdirSync(resolve(data,'public-calendar-cache')).filter(file=>file.endsWith('.json')).length <= 32);
  console.log('PASS: real PHP/Node HTTP API, all endpoints, dates, profiles, five languages, CORS, cache/ETag/HEAD and public-data isolation');

  browser = await chromium.launch(process.platform === 'win32' ? { channel:'msedge' } : {});
  const page = await browser.newPage({ viewport:{width:1200,height:1000} });
  await page.route('https://bible-desktop.com/api/**',route=>route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{data:[]}}));
  await page.goto(origin+'/calendar-api-test.html');
  assert.equal(await page.locator('#api-key').count(),0);
  await page.locator('#date').fill('2027-05-02');
  await page.locator('#submit').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Получено'));
  assert.equal(await page.locator('#events article').count(),first.body.day.events.length);
  assert.deepEqual(JSON.parse(await page.locator('#raw').textContent()), first.body);
  const marker=page.locator('img.mark').first();
  await marker.waitFor();
  await page.waitForFunction(()=>document.querySelector('img.mark')?.naturalWidth>0);
  await page.screenshot({path:'tmp/calendar-api-local-test.png',fullPage:false});
  await page.locator('#events article').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:'tmp/calendar-api-local-events.png',fullPage:false});
  await page.evaluate(()=>scrollTo(0,0));
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'tmp/calendar-api-local-mobile.png',fullPage:false});
  // Render hostile data as plain text even when pointed at an untrusted endpoint.
  await page.route('**/api/v1/calendar-demo/day*', route => route.fulfill({
    contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},
    body:JSON.stringify({...first.body,day:{...first.body.day,events:[{...first.body.day.events[0],title:'<img src=x onerror="window.compromised=true">'}]}}),
  }));
  await page.locator('#submit').click();
  await page.waitForFunction(()=>document.querySelector('#events h3')?.textContent.includes('<img'));
  assert.equal(await page.evaluate(()=>window.compromised),undefined);
  assert.equal(await page.locator('#events [onerror]').count(),0);
  assert.ok(!readFileSync('public/calendar-api-test.html','utf8').includes('innerHTML'));
  console.log('PASS: hosted HTML without API key, real same-origin demo fetch, Typikon images, complete JSON, mobile layout and escaped content');
  await page.route(origin+'/calendar-api',route=>route.fulfill({contentType:'text/html',body:readFileSync('dist/index.html','utf8')}));
  let publishedPlans=[];
  await page.route('**/api/v1/calendar-access/plans',route=>route.fulfill({json:{plans:publishedPlans,settings:{}}}));
  await page.goto(origin+'/calendar-api');
  await page.locator('#connection').waitFor();
  assert.equal(await page.locator('#plans, a[href="#plans"]').count(),0);
  publishedPlans=[{id:'demo',name:'Опубликованный тариф',priceCents:1000,currency:'EUR',perMinute:10,perDay:100,perMonth:1000}];
  await page.reload();
  await page.locator('#plans article').waitFor();
  assert.equal(await page.locator('a[href="#plans"]').count(),1);
  assert.ok(await page.locator('#plans').textContent().then(text=>text.includes('Опубликованный тариф')));
  console.log('PASS: unpublished tariffs and navigation hidden, published tariffs visible');
} catch (error) {
  console.error(logs.slice(-5000)); throw error;
} finally {
  if (browser) await browser.close();
  server.kill();
}
