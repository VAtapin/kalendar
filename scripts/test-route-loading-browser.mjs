import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5180', '--strictPort'], {stdio:'ignore', windowsHide:true});
const browser = await chromium.launch({channel:'msedge'});
try {
  for (let i=0;i<50;i++) { try { await fetch('http://127.0.0.1:5180'); break; } catch { await new Promise(r=>setTimeout(r,100)); } }
  for (const path of ['/', '/impressum', '/account', '/admin', '/calendar/private-id']) {
    const context = await browser.newContext({locale:'ru-RU', viewport:{width:1600,height:1000}});
    await context.route('**/api/**', route => route.fulfill({json: {user:null, authenticated:false, items:[]}}));
    const page = await context.newPage();
    const requests = [], errors = [];
    page.on('request', r=>requests.push(new URL(r.url()).pathname));
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5180'+path);
    await page.waitForLoadState('networkidle');
    expect(await page.locator('.app-shell').count()).toBe(0);
    expect(requests.filter(p=>/\/App-|pdf-exporter|parse-memory-days|calendar-grid-presets|\/PageScene-|\/AdminTemplates-|\/NewsletterEditor-|MemoryDays/i.test(p))).toEqual([]);
    expect(errors).toEqual([]);
    if(path==='/') {
      await expect(page.locator('.welcome-hero__blessing')).toHaveText('По благословению игумена Даниила, настоятеля Свято-Георгиевского монастыря');
      await expect(page.locator('.welcome-hero__blessing')).toBeVisible();
      const videoLink = page.locator('.welcome-hero__actions a.button-link');
      await expect(videoLink).toHaveText('Видеоуроки');
      await expect(videoLink).toHaveAttribute('href', '/videos');
      await expect(videoLink).toHaveClass(/welcome-primary/);
      await expect(page.getByText('Как пользоваться? Видеоуроки', {exact:true})).toHaveCount(0);
      expect(requests.filter(p=>p.startsWith('/api/'))).toEqual(['/api/v1/site-pages']); // Footer links only.
      for(const width of [1600, 1100, 390]) {
        await page.setViewportSize({width,height:800});
        expect(await page.evaluate(()=>({horizontal:document.documentElement.scrollWidth>innerWidth, vertical:document.documentElement.scrollHeight>innerHeight}))).toEqual({horizontal:false,vertical:false});
        expect(await page.locator('.route-shell').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
      }
    }
    console.log('PASS isolated route',path, requests.filter(p=>p.endsWith('.js')).length,'JS chunks');
    await context.close();
  }
} finally { await browser.close(); server.kill(); }
