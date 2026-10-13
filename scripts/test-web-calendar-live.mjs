import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

// Read-only integration smoke test against the deployed Bible Desktop API.
mkdirSync('tmp',{recursive:true});
const data=mkdtempSync(resolve('tmp/calendar-live-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const origin=`http://127.0.0.1:${port}`;
const provider=process.env.CALENDAR_LIVE_PROVIDER||'https://bible-desktop.com';
const server=spawn(process.env.PHP_BINARY||'php',['-S',`127.0.0.1:${port}`,'-t','public','scripts/php-dev-router.php'],{windowsHide:true,stdio:'ignore',env:{...process.env,CALENDAR_DATA_DIR:data,APP_PUBLIC_URL:origin,PUBLIC_API_URL:provider}});
let browser;
try {
  for(let i=0;i<60;i++){try{if((await fetch(origin+'/public-api-config.php')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch(process.platform==='win32'?{channel:'msedge'}:{});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const localCalendarRequests=[], providerRequests=[], previews=[], errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{
    const url=new URL(request.url());
    if(url.origin===origin && /^\/api\/v1\/calendar/.test(url.pathname))localCalendarRequests.push(url.href);
    if(url.origin===provider && /^\/api\/v1\/calendar/.test(url.pathname))providerRequests.push(url.href);
    if(url.origin===provider && /^\/api\/calendar\/icons\/\d+\/images\/\d+$/.test(url.pathname) && url.searchParams.get('preview')==='1')previews.push(url.href);
  });
  page.on('requestfailed',request=>console.log('Request failed:',request.url(),request.failure()?.errorText));
  page.on('console',message=>{if(message.type()==='error')console.log('Browser:',message.text());});
  page.on('response',async response=>{if(response.status()>=400 && response.url().startsWith(provider))console.log(response.status(),response.url(),(await response.text()).slice(0,500));});
  await page.goto(origin+'/web-calendar.html?view=month&date=2026-09-21&lang=uk');
  await page.locator('.day').first().waitFor({timeout:30000});
  await page.locator('button[data-date="2026-09-21"]').click();
  await page.locator('#detail-content .icon-thumbnail').first().waitFor({timeout:30000});
  assert.ok(await page.locator('#detail-content .icon-thumbnail').count());
  await page.locator('#detail-content .icon-thumbnail').first().click();
  await page.locator('#icon-modal-thumbnails button').first().waitFor();
  await page.locator('#detail-content .icon-thumbnail img').first().evaluate(image=>image.decode());
  assert.ok(providerRequests.some(url=>url.includes('/month?')));
  assert.ok(providerRequests.some(url=>url.includes('/day?')));
  assert.ok(previews.length,'Published API previews are used for thumbnails');
  assert.deepEqual(localCalendarRequests,[]);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:resolve(data,'calendar.png'),fullPage:true});
  await page.goto(origin+'/web-calendar.html?view=worship&date=2025-11-09&office=third-hour&lang=ru&textLanguage=cu-civil');
  await page.locator('.worship-text[data-composition="complete"]').waitFor({timeout:30000});
  assert.equal(await page.locator('.worship-part').first().getAttribute('data-text-language'),'cu-civil');
  assert.ok(await page.locator('.worship-block').count()>50);
  assert.match(await page.locator('.worship-text').innerText(),/поми́луй/);
  await page.screenshot({path:resolve(data,'worship.png'),fullPage:true});
  await page.getByRole('button',{name:'← К календарному дню'}).click();
  await page.locator('.day-texts summary').first().waitFor({timeout:30000});
  assert.ok(providerRequests.some(url=>url.includes('text_policy=calendar-language-v1')));
  assert.ok(await page.locator('.service-text [data-text-language]').count()>0);
  await page.goto(origin+'/web-calendar.html?view=day&date=2026-10-12&lang=ru');
  await page.locator('[data-assignment-kind="reference"] summary').waitFor({timeout:30000});
  await page.locator('[data-assignment-kind="reference"] summary').click();
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('.intro').count(),0);
  assert.match(await page.locator('[data-assignment-kind="reference"] [data-text-language="cu-civil"]').first().evaluate(el=>getComputedStyle(el).fontFamily),/Calendar Civil Text/);
  assert.equal(await page.evaluate(()=>document.fonts.check('18px "Calendar Civil Text"')),true);
  await page.locator('[data-assignment-kind="reference"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(data,'day-text-fonts.png')});
  const offices = process.env.WORSHIP_LIVE_OFFICES?.split(',') || ['first-hour','third-hour','sixth-hour','ninth-hour','liturgy','matins','vespers'];
  for(const office of offices) {
    const responsePromise = page.waitForResponse(response => response.url().includes('/liturgical/templates/'+office+'?language=cu'));
    const assignmentsPromise = page.waitForResponse(response => response.url().includes('/liturgical/assignments/'+office+'?'));
    await page.goto(origin+`/web-calendar.html?view=worship&date=2026-10-12&office=${office}&temple=george-victorious&lang=ru`);
    const template = (await (await responsePromise).json()).data;
    const assignmentsResponse = await assignmentsPromise;
    assert.ok([200,429].includes(assignmentsResponse.status()), 'Appointments succeed or explicitly throttle');
    if (['matins','vespers'].includes(office)) {
      assert.equal(new URL(assignmentsResponse.url()).searchParams.get('temple'),'george-victorious');
      if (assignmentsResponse.status() === 200) {
        const context = (await assignmentsResponse.json()).data.context;
        assert.equal(context.temple ?? context.templeProfile?.id,'george-victorious');
      }
    }
    await page.locator(`.worship-content[data-assignments-status="${assignmentsResponse.status() === 429 ? 'error' : 'partial'}"]`).waitFor({timeout:30000});
    assert.equal(await page.locator('.worship-text').getAttribute('data-composition'), template.status === 'source-outline' ? 'source-outline' : 'partial');
    const expected = template.nodes.flatMap(node => node.blocks || []).map(block => block.segments.map(segment => segment.text).join(''));
    const actual = await page.locator('.worship-block').evaluateAll(nodes => nodes.flatMap(node =>
      Array.from({ length: Number(node.dataset.repeatCount || 1) }, () => [...node.querySelectorAll('span:not(.repetition-number)')].map(span => span.textContent).join(''))));
    assert.deepEqual(actual, expected, `All original source paragraphs are preserved for ${office}`);
    assert.equal(await page.locator('.worship-part').first().getAttribute('data-text-language'),'cu');
    assert.match(await page.locator('.worship-part').first().evaluate(el => getComputedStyle(el).fontFamily), /Calendar Liturgical Slavonic/);
    await page.screenshot({path:resolve(data,office+'-base.png')});
  }
  // A supported date must use CU daily fills, not merely show the book outline.
  await page.goto(origin+'/web-calendar.html?view=worship&date=2025-11-09&office=third-hour&lang=ru&textLanguage=cu');
  await page.locator('.worship-text[data-composition="complete"]').waitFor({timeout:30000});
  assert.equal(await page.locator('.worship-missing').count(),0);
  assert.ok(await page.locator('.worship-block').count()>30);
  assert.ok(await page.locator('.worship-block[data-repeat-count="12"]').count());
  assert.equal(await page.locator('.worship-block[data-repeat-count="12"] .repetition-number').first().innerText(),'ві҃');
  await page.locator('.worship-block[data-repeat-count="12"]').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(data,'cu-repetitions.png')});
  assert.equal(await page.locator('.worship-part').first().getAttribute('data-text-language'),'cu');
  assert.doesNotMatch(await page.locator('.worship-content').innerText(), /Показан полный исходный текст службы/);
  await page.screenshot({path:resolve(data,'cu-third-hour-complete.png'),fullPage:true});
  const liturgyAssignmentsPromise = page.waitForResponse(response => response.url().includes('/liturgical/assignments/liturgy?'));
  await page.goto(origin+'/web-calendar.html?view=worship&date=2025-11-09&office=liturgy&lang=ru&textLanguage=cu');
  const liturgyAssignments = (await (await liturgyAssignmentsPromise).json()).data;
  await page.locator('.worship-content[data-assignments-status="partial"]').waitFor({timeout:30000});
  assert.equal(await page.locator('.worship-text').getAttribute('data-composition'),'partial');
  assert.ok(liturgyAssignments.operations.length, 'Liturgy has verified daily insertions');
  for (const operation of liturgyAssignments.operations) {
    const part = page.locator('.worship-part').filter({ has: page.locator('.worship-block') });
    const actual = await part.evaluateAll((nodes,id) => nodes.filter(node => node.dataset.nodeId === id)
      .flatMap(node => [...node.querySelectorAll('.worship-block')].flatMap(block => Array.from({ length: Number(block.dataset.repeatCount || 1) },
        () => [...block.querySelectorAll('span:not(.repetition-number)')].map(span => span.textContent).join('')))),operation.nodeId);
    assert.deepEqual(actual,operation.blocks.map(block => block.segments.map(segment => segment.text).join('')));
  }
  assert.ok(await page.locator('.worship-part[data-parallel-group]').count());
  assert.ok(await page.locator('.worship-part[data-delivery="secret"]').count());
  assert.equal(await page.locator('.worship-part > .edition-label').count(),0);
  await page.locator('.worship-part[data-node-id="'+liturgyAssignments.operations[0].nodeId+'"]').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(data,'cu-liturgy-insertions.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS real Bible Desktop complete civil Third Hour; entire traditional sources: '+offices.join(',')+'; unresolved slots/throttling, policy/fonts, calendar/icons');
}finally{await browser?.close();server.kill();}
