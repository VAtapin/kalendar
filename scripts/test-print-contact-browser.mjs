import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5178');
  await page.waitForSelector('#app');
  const requests = [];
  page.on('request', r => { if (r.url().includes('/print/') || r.url().includes('/pdf-exports')) requests.push(r.url()); });
  await page.evaluate(async () => {
    const vueUrl = performance.getEntriesByType('resource').map(r => r.name).find(url => url.includes('/deps/vue.js?'));
    const { createApp, h } = await import(vueUrl);
    const { default: Dialog } = await import('/src/components/PrintContactDialog.vue');
    const host = document.createElement('div'); document.body.append(host);
    const app = createApp({ render: () => h(Dialog, { onClose: () => app.unmount() }) }); app.mount(host);
  });
  const dialog = page.getByRole('dialog', { name: 'Заказать печать календаря' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: '+49 171 351 72 74' })).toHaveAttribute('href', 'tel:+491713517274');
  await expect(dialog.getByRole('link', { name: 'atapin@gmail.com' })).toHaveAttribute('href', 'mailto:atapin@gmail.com');
  await expect(dialog.locator('input, select')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(requests).toEqual([]);
  console.log('PASS: print contacts, clickable phone/email, Escape, no order or PDF requests.');
} finally { await browser.close(); }
