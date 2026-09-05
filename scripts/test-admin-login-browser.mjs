import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
mkdirSync('tmp',{recursive:true});
const data = mkdtempSync(resolve('tmp/admin-login-browser-'));
const hash = execFileSync('php',['-r','echo password_hash("local-test-password-123", PASSWORD_DEFAULT);'],{encoding:'utf8'});
const server = spawn('php',['-S','127.0.0.1:18990','scripts/php-dev-router.php'],{env:{...process.env,
  CALENDAR_DATA_DIR:data, APP_PUBLIC_URL:'http://127.0.0.1:5178', ADMIN_LOGIN:'admin', ADMIN_PASSWORD_HASH:hash,
  MAIL_TRANSPORT:'disabled-test'},stdio:'ignore',windowsHide:true});
const browser = await chromium.launch({channel:'msedge'});
try {
  for (let i=0;i<50;i++) { try { await fetch('http://127.0.0.1:18990/api/health'); break; } catch { await new Promise(r=>setTimeout(r,100)); } }
  const context = await browser.newContext({viewport:{width:1500,height:1000}});
  let mailRequests = 0;
  await context.route('**/api/**',async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('email-verifications')) mailRequests++;
    const response = await route.fetch({url:`http://127.0.0.1:18990${url.pathname}${url.search}`});
    await route.fulfill({response});
  });
  const page = await context.newPage();
  page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:5178/');
  await page.getByRole('button',{name:'Администратор',exact:true}).click();
  const login = page.getByRole('dialog',{name:'Вход администратора'});
  await login.getByLabel('Логин',{exact:true}).fill('admin');
  await login.getByLabel('Пароль',{exact:true}).fill('wrong');
  await login.getByRole('button',{name:'Войти',exact:true}).click();
  await login.getByText('Неверный логин или пароль').waitFor();
  await login.getByLabel('Пароль',{exact:true}).fill('local-test-password-123');
  await login.getByRole('button',{name:'Войти',exact:true}).click();
  const admin = page.getByRole('dialog',{name:'Администратор',exact:true});
  await admin.waitFor();
  await admin.getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.getByTestId('welcome-create').click();
  assert.equal(await page.getByRole('dialog',{name:'Подтверждение e-mail'}).count(),0);
  await page.reload();
  await page.getByRole('button',{name:'Администратор',exact:true}).click();
  await admin.waitFor();
  assert.equal(await login.count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('orthodox-calendar-layout:verified-email-token')),null);
  await page.screenshot({path:'tmp/admin-password-login.png'});
  await admin.getByRole('button',{name:'Выйти из аккаунта'}).click();
  await page.getByRole('button',{name:'Администратор',exact:true}).click();
  await login.waitFor();
  assert.equal(mailRequests,0);
  console.log('PASS: password login without email, bad password rejected, admin creates calendar, cookie survives reload, logout requires password again.');
} finally { await browser.close(); server.kill(); }
