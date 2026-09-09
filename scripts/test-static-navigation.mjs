import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const server=await createServer({server:{host:'127.0.0.1',port:0}});
await server.listen();
const origin=server.resolvedUrls.local[0].replace(/\/$/,'');
const browser=await chromium.launch(process.platform==='win32'?{channel:'msedge'}:{});
try {
  const page=await browser.newPage({locale:'ru-RU'});
  // Only navigation is under test; no live calendar service or account is needed.
  await page.route('**/api/**',route=>route.fulfill({status:503,json:{error:'offline-test'}}));
  for(const [path,title] of [['/icons','Православные иконы'],['/web-calendar','Веб-календарь']]) {
    await page.goto(origin+'/');
    const response=page.waitForResponse(r=>r.request().isNavigationRequest()&&new URL(r.url()).pathname===path,{timeout:5000});
    await Promise.all([response,page.locator(`a[href="${path}"]`).click()]);
    await expect(page.locator('h1')).toHaveText(title);
    await page.reload();
    await expect(page).toHaveURL(origin+path);
    await expect(page.locator('h1')).toHaveText(title);
    assert.equal(await page.locator('.route-shell').count(),0,'Standalone HTML must replace the SPA document');
    await page.goBack();
    await expect(page.locator('.welcome-page')).toBeVisible();
    await page.goForward();
    await expect(page.locator('h1')).toHaveText(title);
  }
  for(const path of ['/calendar-api','/videos']) {
    await page.goto(origin+'/');
    await page.evaluate(()=>{window.navigationTestMarker=true;});
    await page.locator(`a[href="${path}"]`).first().click();
    await expect(page).toHaveURL(origin+path);
    assert.equal(await page.evaluate(()=>window.navigationTestMarker),true,'Application route must retain the document');
    await expect(page.locator('.welcome-page')).toHaveCount(0);
  }
  const apache=readFileSync('public/.htaccess','utf8');
  assert.match(apache,/RewriteRule \^\(icons\|icons-of-mother-of-god\|web-calendar\|wordpress-plugin\|calendar-api-test\|calendar-icons-test\)\/\?\$ \$1\.html \[L\]/);
  console.log('PASS: clean document URLs, first click/reload/Back/Forward; API/videos retain SPA navigation; Apache route mapping');
} finally {await browser.close();await server.close();}
