import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

const server=await createServer({server:{host:'127.0.0.1',port:0}});
await server.listen();
const origin=server.resolvedUrls.local[0].replace(/\/$/,'');
const browser=await chromium.launch(process.platform==='win32'?{channel:'msedge'}:{});
try {
  const page=await browser.newPage({locale:'ru-RU'});
  // Only navigation is under test; no live calendar service or account is needed.
  await page.route('**/api/**',route=>route.fulfill({status:503,json:{error:'offline-test'}}));
  for(const [path,title] of [['/icons.html','Православные иконы'],['/web-calendar.html','Веб-календарь']]) {
    await page.goto(origin+'/');
    const response=page.waitForResponse(r=>r.request().isNavigationRequest()&&new URL(r.url()).pathname===path,{timeout:5000});
    await Promise.all([response,page.locator(`a[href="${path}"]`).click()]);
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
  console.log('PASS: homepage HTML links load documents on first click; Back/Forward work; API/videos retain SPA navigation');
} finally {await browser.close();await server.close();}
