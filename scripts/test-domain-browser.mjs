import {chromium,expect} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
mkdirSync('tmp',{recursive:true});const data=mkdtempSync(resolve('tmp/domain-browser-'));
const hash=execFileSync('php',['-r','echo password_hash("test-admin-password-123",PASSWORD_DEFAULT);'],{encoding:'utf8'});
execFileSync('php',['-r','require "public/api/lib.php"; $s=new CalendarStore($argv[1]);$l=$s->accountEmailLink("alias@example.org",false);$s->accountSetPassword($l["token"],"test-domain-password-123");',data]);
const server=spawn('php',['-S','127.0.0.1:18995','scripts/php-dev-router.php'],{windowsHide:true,stdio:'ignore',env:{...process.env,CALENDAR_DATA_DIR:data,APP_PUBLIC_URL:'https://kalender.georg-kloster.ru',ADMIN_LOGIN:'admin',ADMIN_PASSWORD_HASH:hash,MAIL_TRANSPORT:'disabled-test'}});
const browser=await chromium.launch({channel:'msedge'});
try{
 for(let i=0;i<50;i++){try{await fetch('http://127.0.0.1:18995/api/health');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 const context=await browser.newContext({locale:'en-US'});
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());if(!['kalender.georg-kloster.ru','kalender.georg-kloster.de'].includes(u.hostname))return route.continue();
  const api=u.pathname.startsWith('/api/');
  const response=await route.fetch({url:`http://127.0.0.1:${api?18995:5178}${u.pathname}${u.search}`,headers:{...await route.request().allHeaders(),host:api?u.host:'127.0.0.1:5178'}});
  await route.fulfill({response});
 });
 const page=await context.newPage();const ru='https://kalender.georg-kloster.ru',de='https://kalender.georg-kloster.de';
 await page.goto(de+'/account');await expect(page.locator('.account-panel h1')).toHaveText('Mein Konto');
 await page.locator('input[type=email]').fill('alias@example.org');await page.locator('input[type=password]').fill('test-domain-password-123');
 await page.getByRole('button',{name:'Anmelden',exact:true}).click();await expect(page.locator('.account-panel header')).toContainText('alias@example.org');
 // Both account and admin sessions must travel together.
 expect(await page.evaluate(async()=>{const r=await fetch('/api/v1/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:'admin',password:'test-admin-password-123'})});return r.status;})).toBe(200);
 await page.goto(de+'/impressum');await page.locator('.public-site-page select').selectOption('ru');
 await expect(page).toHaveURL(ru+'/impressum',{timeout:20000});
 expect(await page.evaluate(async()=>{const r=await(await fetch('/api/v1/account/session')).json();return r.user?.email;})).toBe('alias@example.org');
 expect(await page.evaluate(async()=>{const r=await(await fetch('/api/v1/admin/session')).json();return r.authenticated;})).toBe(true);
 await page.locator('.public-site-page select').selectOption('de');await expect(page).toHaveURL(de+'/impressum',{timeout:20000});
 expect(await page.evaluate(async()=>{const r=await(await fetch('/api/v1/account/session')).json();return r.user?.email;})).toBe('alias@example.org');
 await page.locator('.public-site-page select').selectOption('en');await expect(page).toHaveURL(ru+'/en/impressum',{timeout:20000});
 await page.locator('.public-site-page select').selectOption('uk');await expect(page).toHaveURL(ru+'/uk/impressum');
 console.log('PASS: actual alias URLs, German login, RU/DE/EN/UK switching, account and admin session transfer without password. Local isolated servers only.');
}finally{await browser.close();server.kill();}
