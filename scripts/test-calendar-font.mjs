import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const probe = createServer();
await new Promise(r => probe.listen(0, '127.0.0.1', r));
const port = probe.address().port;
await new Promise(r => probe.close(r));
const origin = `http://127.0.0.1:${port}`;
const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', 'public'], {windowsHide:true,stdio:'ignore'});
let browser;
try {
  for (let n=0;n<50;n++) {
    try { await fetch(origin); break; } catch { await new Promise(r=>setTimeout(r,100)); }
  }
  const response = await fetch(`${origin}/calendar-api-font.php`, {headers:{Origin:'null'}});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('access-control-allow-origin'),'*');
  assert.ok((await response.arrayBuffer()).byteLength > 100000);
  browser = await chromium.launch({channel:'msedge',headless:true});
  const page = await browser.newPage();
  await page.goto(pathToFileURL(resolve('public/calendar-api-test.html')).href);
  await page.evaluate(async origin => {
    await loadCalendarFont('cu', new URL(origin));
    if (!document.fonts.check('18px "Calendar API Slavonic"')) throw new Error('Font not loaded');
    const span = calendarText(document.createElement('span'), 'cu');
    span.textContent = 'Прпⷣбнагѡ І҆ѡа́нна'; document.body.append(span);
    if (!getComputedStyle(span).fontFamily.includes('Calendar API Slavonic')) throw new Error('Font not applied');
  }, origin);
  console.log('PASS: bundled Slavonic font loads from local HTML across origins and is applied.');
} finally { await browser?.close(); server.kill(); }
