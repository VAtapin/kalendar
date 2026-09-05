import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
mkdirSync('tmp', {recursive:true});
const data = mkdtempSync(resolve('tmp/account-browser-'));
const seed = JSON.parse(execFileSync('php', ['-r', 'require "public/api/lib.php"; $s=new CalendarStore($argv[1]); echo json_encode([$s->accountEmailLink("alice@example.org", false),$s->accountEmailLink("bob@example.org",false)]);', data], {encoding:'utf8'}));
const adminHash = execFileSync('php', ['-r', 'echo password_hash("test-admin-password-123", PASSWORD_DEFAULT);'], {encoding:'utf8'});
const server = spawn('php', ['-S','127.0.0.1:18991','scripts/php-dev-router.php'], {windowsHide:true, stdio:'ignore',env:{...process.env,CALENDAR_DATA_DIR:data,APP_PUBLIC_URL:'http://127.0.0.1:5178',MAIL_TRANSPORT:'disabled-test',ADMIN_LOGIN:'admin',ADMIN_PASSWORD_HASH:adminHash}});
const browser = await chromium.launch({channel:'msedge'});
async function context() {
  const c = await browser.newContext({viewport:{width:1600,height:1000}});
  await c.route('**/api/**', async route => { const url = new URL(route.request().url()); if (['POST','PUT'].includes(route.request().method()) && url.pathname.includes('/account/calendars')) { const b=route.request().postDataJSON(); console.log('SAVE',route.request().method(),url.pathname,b.revision,b.project?.assets?.map(a=>({name:a.name,library:a.photoLibrary,length:a.source?.length}))); } const response = await route.fetch({url:`http://127.0.0.1:18991${url.pathname}${url.search}`}); await route.fulfill({response}); });
  return c;
}
try {
  for(let i=0;i<50;i++){try{await fetch('http://127.0.0.1:18991/api/health');break;}catch{await new Promise(r=>setTimeout(r,100));}}
  const alice = await context(); const page = await alice.newPage(); page.on('dialog', d=>d.accept());
  await page.goto(`http://127.0.0.1:5178/?account-token=${seed[0].token}`);
  let cabinet = page.getByRole('dialog',{name:'Личный кабинет',exact:true});
  await cabinet.getByLabel('Пароль',{exact:true}).fill('test-account-password-123');
  await cabinet.getByLabel('Повторите пароль',{exact:true}).fill('test-account-password-123');
  await cabinet.getByRole('button',{name:'Сохранить пароль и войти'}).click();
  await cabinet.getByText('alice@example.org',{exact:true}).waitFor();
  await cabinet.getByRole('button',{name:'+ Новый календарь',exact:true}).click();
  await page.getByRole('complementary',{name:'Фотографии проекта'}).waitFor();
  await expect.poll(()=>page.evaluate(async()=>{const r=await fetch('/api/v1/account/calendars');return (await r.json()).items?.length;})).toBe(1);
  const getCalendars = ()=>page.evaluate(async()=> (await (await fetch('/api/v1/account/calendars')).json()).items);
  const id=(await getCalendars())[0].id;
  const photoPanel = page.getByRole('complementary',{name:'Фотографии проекта'});
  await photoPanel.locator('input[type=file]').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=','base64')});
  await photoPanel.getByRole('button',{name:'Поместить фото: photo.png'}).dblclick();
  await photoPanel.getByRole('button',{name:'Поместить фото: photo.png'}).dragTo(page.locator('.workspace__page'),{targetPosition:{x:150,y:150}});
  await expect.poll(()=>page.evaluate(async id=>{const v=await(await fetch(`/api/v1/account/calendars/${id}`)).json();return v.project?.assets?.some(a=>a.photoLibrary) === true;},id),{timeout:15000}).toBe(true);
  await expect.poll(()=>page.evaluate(async id=>{const v=await(await fetch(`/api/v1/account/calendars/${id}`)).json();const photo=v.project.assets.find(a=>a.photoLibrary); return v.project.document.pages.flatMap(p=>p.elements).filter(e=>e.assetId===photo.id).length;},id)).toBe(2);
  await page.screenshot({path:'tmp/account-photo-editor.png'});
  await page.reload();
  await cabinet.getByText('alice@example.org',{exact:true}).waitFor();
  await page.screenshot({path:'tmp/account-dashboard.png'});
  await cabinet.getByRole('button',{name:'Открыть',exact:true}).click();
  try { await photoPanel.getByRole('button',{name:'Поместить фото: photo.png'}).waitFor({timeout:8000}); }
  catch(e) { await page.screenshot({path:'tmp/account-reopen-error.png'}); console.log(await page.locator('.status-bar').innerText()); throw e; }
  const bob=await context();const bobPage=await bob.newPage();
  await bobPage.goto(`http://127.0.0.1:5178/?account-token=${seed[1].token}`);
  const bobCabinet=bobPage.getByRole('dialog',{name:'Личный кабинет',exact:true});
  await bobCabinet.getByLabel('Пароль',{exact:true}).fill('test-account-password-123');
  await bobCabinet.getByLabel('Повторите пароль',{exact:true}).fill('test-account-password-123');
  await bobCabinet.getByRole('button',{name:'Сохранить пароль и войти'}).click();
  await bobCabinet.getByText('bob@example.org',{exact:true}).waitFor();
  await bobCabinet.getByRole('button',{name:'Выйти',exact:true}).click();
  await bobCabinet.getByLabel('E-mail',{exact:true}).fill('bob@example.org');
  await bobCabinet.getByLabel('Пароль',{exact:true}).fill('test-account-password-123');
  await bobCabinet.getByRole('button',{name:'Войти',exact:true}).click();
  await bobCabinet.getByText('bob@example.org',{exact:true}).waitFor();
  assert.equal(await bobPage.evaluate(async id=>(await fetch(`/api/v1/account/calendars/${id}`)).status,id),404);
  assert.equal(await bobPage.evaluate(async id=>(await fetch(`/api/v1/account/calendars/${id}`,{method:'DELETE'})).status,id),404);
  assert.equal(await bobPage.evaluate(async()=> (await fetch('/api/v1/admin/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status),403);
  await page.getByRole('button',{name:/alice@example.org.*Мои календари/}).click();
  await cabinet.getByRole('button',{name:'Выйти',exact:true}).click();
  assert.equal(await page.evaluate(async id=>(await fetch(`/api/v1/account/calendars/${id}`)).status,id),401);
  await cabinet.getByLabel('E-mail',{exact:true}).fill('alice@example.org');
  await cabinet.getByLabel('Пароль',{exact:true}).fill('test-account-password-123');
  await cabinet.getByRole('button',{name:'Войти',exact:true}).click();
  await cabinet.getByText('alice@example.org',{exact:true}).waitFor();
  console.log('PASS: confirmation/password, private server calendar, photo placement/save/reopen, cross-account read/delete denied, admin denied, logout/login. No real email sent.');
} finally {await browser.close();server.kill();}
