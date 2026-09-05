import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'msedge' });
const context = await browser.newContext({viewport:{width:1500,height:1000}});
await context.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  return route.fulfill({json: path.endsWith('calendar-grid-templates') ? {templates:[],canManage:true}
    : path.endsWith('user-settings') ? {interfaceLanguage:'ru'} : {items:[],total:0}});
});
try {
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  await page.goto('http://127.0.0.1:5178/');
  await page.getByTestId('welcome-create').click();
  await page.getByRole('dialog', {name:'Подтверждение e-mail'}).waitFor();
  assert.equal(await page.getByRole('dialog', {name:'Подтверждение e-mail'}).getByRole('checkbox').isChecked(), false);
  const other = await context.newPage();
  await other.goto('http://127.0.0.1:5178/');
  await other.evaluate(() => {
    localStorage.setItem('orthodox-calendar-layout:verified-email','owner@example.org');
    localStorage.setItem('orthodox-calendar-layout:verified-email-token','test-browser-token');
  });
  await page.getByRole('dialog', {name:'Подтверждение e-mail'}).waitFor({state:'hidden'});
  await page.getByTestId('welcome-create').click();
  await page.getByRole('button', {name:'Файл',exact:true}).click();
  await page.getByTestId('menu-command-new-project').click();
  assert.equal(await page.getByRole('dialog', {name:'Подтверждение e-mail'}).count(),0);
  await page.getByRole('button', {name:'Файл',exact:true}).click();
  await page.getByTestId('menu-command-administrator').click();
  await page.getByRole('dialog',{name:'Администратор',exact:true}).waitFor();
  await page.screenshot({path:'tmp/admin-preview.png'});
  console.log('PASS: checkbox unchecked, cross-tab confirmation closes prompt, second calendar requires no email, admin opens.');
} finally { await browser.close(); }
