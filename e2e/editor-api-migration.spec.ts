import { expect, test } from '@playwright/test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {loadEnv} from 'vite';

test('editor saves a pinned BibleDesktop calendar and reopens it without API access', async ({ page }) => {
  test.setTimeout(60000);
  const calendarJson = gunzipSync(readFileSync('tests/fixtures/editor-calendar-2027-ru.json.gz')).toString('utf8');
  const snapshot = JSON.parse(calendarJson);
  const providerOrigin = new URL(loadEnv('development', process.cwd(), 'PUBLIC_API_URL').PUBLIC_API_URL!).origin;
  const calendarCalls: string[] = [];
  const legacyCalls: string[] = [];
  let apiAvailable = true;
  await page.route('**/api/v1/calendar/editor-year**', route => apiAvailable
    ? route.fulfill({body: calendarJson, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': '*'}})
    : route.abort('internetdisconnected'));
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') console.log('Browser console:', message.text()); });
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (/\/api\/v1\/calendar(?:\/|$)|\/api\/v1\/calendar-demo(?:\/|$)/.test(path)) calendarCalls.push(request.url());
    if (path === '/data/MemoryDays.xml' || /calendar-demo/.test(path)) legacyCalls.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  // Calendar fixture is an actual content-addressed BibleDesktop response.
  // Account fixtures isolate credentials; layout and file serialization are real.
  await page.route('**/api/v1/account/session', route => route.fulfill({json: {user: {
    id: 'editor-migration', email: 'editor@example.com', blocked: false, createdAt: '2026-01-01',
  }}}));
  await page.route('**/api/v1/account/library', route => route.fulfill({json: {revision: 0, templates: [], grids: []}}));
  await page.route('**/api/v1/account/calendars**', route => route.fulfill({json: {id: 'editor-migration', revision: 1, calendars: []}}));
  await page.addInitScript(() => {
    const state = {pickerCalls: 0, files: [] as string[]};
    Object.assign(window, {__migrationSave: state, showSaveFilePicker: async () => {
      state.pickerCalls++;
      return {
        name: 'migration.kalendar', queryPermission: async () => 'granted',
        createWritable: async () => ({write: async (data: string | Blob) => state.files.push(typeof data === 'string' ? data : await data.text()), close: async () => {}}),
      };
    }});
  });
  await page.goto('/calendar/new');
  try { await expect(page.locator('.workspace')).toBeVisible({timeout: 30000}); }
  catch (error) { console.log('Editor failed to open:', errors, await page.locator('body').innerText()); throw error; }
  await expect(page.locator('.account-entry')).toContainText('editor@example.com');
  await expect(page.locator('.status-chip').filter({hasText: 'BibleDesktop'})).toBeVisible();
  const cabinet = page.getByRole('dialog', {name: 'Личный кабинет', exact: true});
  if (await cabinet.isVisible()) await cabinet.getByRole('button', {name: 'Закрыть', exact: true}).click();
  await page.getByRole('button', {name: 'Шаблоны календаря', exact: true}).click();
  await page.getByRole('button', {name: 'Создать обложку и 12 месяцев', exact: true}).click();
  await page.getByRole('tab', {name: 'Страницы', exact: true}).click();
  await expect(page.locator('.page-card')).toHaveCount(13);
  await page.locator('.page-card').nth(1).click();
  await expect(page.locator('.page-element[data-element-type="calendar-grid"]')).toBeVisible();
  await expect.poll(() => page.locator('.page-element[data-element-type="calendar-grid"] .calendar-cell').count()).toBeGreaterThanOrEqual(28);
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', {name: 'Файл', exact: true}).click();
    await page.getByTestId('menu-command-save-as-project').click();
  }
  await expect.poll(() => page.evaluate(() => (window as unknown as {__migrationSave: {files: string[]}}).__migrationSave.files.length)).toBe(2);
  const state = await page.evaluate(() => (window as unknown as {__migrationSave: {pickerCalls: number; files: string[]}}).__migrationSave);
  expect(state.pickerCalls).toBe(2);
  const saved = JSON.parse(state.files[1]);
  expect(saved.project.document.pages).toHaveLength(13);
  expect(saved.project.document.pages[1].elements.some((element: {type: string}) => element.type === 'calendar-grid')).toBe(true);
  expect(saved.project.calendarSnapshot.snapshot.contentHash).toBe(snapshot.contentHash);
  expect(calendarCalls.length).toBeGreaterThan(0);
  expect(calendarCalls.every(url => new URL(url).pathname === '/api/v1/calendar/editor-year'
    && new URL(url).origin === providerOrigin)).toBe(true);
  const beforeReopen = calendarCalls.length;
  apiAvailable = false;
  await page.locator('input.visually-hidden[type="file"][accept*=".kalendar"]').setInputFiles({name: 'pinned.kalendar',
    mimeType: 'application/json', buffer: Buffer.from(state.files[1]!)});
  await expect(page.locator('.status-chip').filter({hasText: 'BibleDesktop'})).toBeVisible();
  await expect(page.locator('.page-card')).toHaveCount(13);
  await page.locator('.page-card').nth(1).click();
  await expect(page.locator('.page-element[data-element-type="calendar-grid"]')).toBeVisible();
  expect(calendarCalls).toHaveLength(beforeReopen);
  expect(legacyCalls).toEqual([]);
  expect(errors).toEqual([]);
});
