import { expect, test } from '@playwright/test';

test('editor calculates thirteen pages and saves a valid project without calendar HTTP API', async ({ page }) => {
  const calendarCalls: string[] = [];
  const errors: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (/\/api\/v1\/calendar(?:\/|$)|\/api\/v1\/calendar-demo(?:\/|$)/.test(path)) calendarCalls.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  // Account fixtures isolate editor behavior; they do not replace calendar data,
  // the layout engine, export, or actual project serialization.
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
  await expect(page.locator('.workspace'), errors.join('\n')).toBeVisible({timeout: 20000});
  await expect(page.locator('.account-entry')).toContainText('editor@example.com');
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
  expect(calendarCalls).toEqual([]);
  expect(errors).toEqual([]);
});
