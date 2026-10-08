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
  console.log('PASS real Bible Desktop browser month/day, Ukrainian calendar, verified icon gallery, no Kalendar calendar API requests');
}finally{await browser?.close();server.kill();}
