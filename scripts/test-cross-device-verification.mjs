import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({channel:'msedge'});
try {
  for (const closeDesktop of [false, true]) {
    let confirmed = false;
    const requestToken = 'desktop-only-secret-'.padEnd(48, 'a');
    const desktop = await browser.newContext({viewport:{width:1500,height:1000}});
    const phone = await browser.newContext({viewport:{width:390,height:844},isMobile:true});
    for (const context of [desktop, phone]) await context.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      let json = {};
      if (path.endsWith('email-verifications')) json = {sent:true, requestToken, expiresAt:new Date(Date.now()+1800000).toISOString()};
      else if (path.endsWith('/confirm')) { confirmed = true; json = {email:'reader@example.org',returnToRequestingBrowser:true}; }
      else if (path.endsWith('/status')) {
        assert.equal(route.request().postDataJSON().requestToken,requestToken);
        json = confirmed ? {status:'confirmed',email:'reader@example.org'} : {status:'pending'};
      } else if (path.endsWith('calendar-grid-templates')) json = {templates:[],canManage:false};
      else if (path.endsWith('user-settings')) json = {interfaceLanguage:'ru'};
      return route.fulfill({json});
    });
    let computer = await desktop.newPage();
    computer.on('dialog', d => d.accept());
    await computer.goto('http://127.0.0.1:5178/');
    await computer.getByTestId('welcome-create').click();
    const dialog = computer.getByRole('dialog',{name:'Подтверждение e-mail'});
    await dialog.getByRole('textbox').fill('reader@example.org');
    await dialog.getByRole('button',{name:'Получить ссылку'}).click();
    await dialog.getByText('Этот браузер получит подтверждение автоматически.',{exact:false}).waitFor();
    if (closeDesktop) await computer.close();
    const mobile = await phone.newPage();
    await mobile.goto('http://127.0.0.1:5178/?verify=email-token');
    await mobile.getByRole('dialog',{name:'E-mail подтверждён',exact:true}).waitFor();
    assert.equal(await mobile.evaluate(() => localStorage.getItem('orthodox-calendar-layout:verified-email-token')),null);
    if (closeDesktop) {
      computer = await desktop.newPage();
      computer.on('dialog', d => d.accept());
      await computer.goto('http://127.0.0.1:5178/');
    }
    await computer.waitForFunction(() => !!localStorage.getItem('orthodox-calendar-layout:verified-email-token'));
    assert.equal(await computer.evaluate(() => localStorage.getItem('orthodox-calendar-layout:verified-email-token')),requestToken);
    await computer.getByRole('dialog',{name:'Подтверждение e-mail'}).waitFor({state:'hidden'});
    await computer.getByRole('button',{name:'Файл',exact:true}).click();
    await computer.getByTestId('menu-command-new-project').click();
    assert.equal(await computer.getByRole('dialog',{name:'Подтверждение e-mail'}).count(),0);
    console.log(`PASS: phone confirms, desktop ${closeDesktop ? 'reopened' : 'open'} receives access; phone gets no token; another calendar needs no email.`);
    await desktop.close(); await phone.close();
  }
} finally { await browser.close(); }
