import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US', timezoneId: 'Europe/Berlin' });

for (const language of [
  { path: '/account', locale: 'ru-RU', open: 'Корзина', label: 'Дата удаления:', unknown: 'Дата удаления неизвестна', restore: 'Вернуть календарь' },
  { path: '/de/account', locale: 'de-DE', open: 'Papierkorb', label: 'Gelöscht am:', unknown: 'Löschdatum unbekannt', restore: 'Kalender wiederherstellen' },
  { path: '/en/account', locale: 'en-GB', open: 'Trash', label: 'Deleted on:', unknown: 'Deletion date unknown', restore: 'Restore calendar' },
  { path: '/uk/account', locale: 'uk-UA', open: 'Кошик', label: 'Дата видалення:', unknown: 'Дата видалення невідома', restore: 'Відновити календар' },
]) {
  test(`trash shows localized deletion dates and still restores calendars (${language.locale})`, async ({ page }) => {
    let items = [
      { id: 'first.json', name: 'Православный календарь 2027', year: 2027, owner: 'alice', deletedAt: '2026-09-08T11:24:00.000Z' },
      { id: 'second.json', name: 'Православный календарь 2027', year: 2027, owner: 'alice', deletedAt: '2026-09-07T07:05:00.000Z' },
      { id: 'unknown.json', name: 'Без даты', year: 2027, owner: 'alice', deletedAt: null },
      { id: 'invalid.json', name: 'Некорректная дата', year: 2027, owner: 'alice', deletedAt: 'invalid' },
    ];
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/account/session')) {
        await route.fulfill({ json: { user: { id: 'alice', email: 'alice@example.org', blocked: false, createdAt: '2026-01-01' } } });
      } else if (path.endsWith('/account/trash/restore')) {
        const { id } = route.request().postDataJSON();
        expect(id).toBe('first.json');
        items = items.filter(item => item.id !== id);
        await route.fulfill({ json: { ok: true } });
      } else {
        await route.fulfill({ json: { items: path.endsWith('/account/trash') ? items : [] } });
      }
    });
    await page.goto(language.path);
    await page.getByRole('button', { name: language.open, exact: true }).click();
    const rows = page.locator('.trash-entry');
    await expect(rows).toHaveCount(4);
    const formatter = new Intl.DateTimeFormat(language.locale, {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    for (let index = 0; index < 2; index++) {
      await expect(rows.nth(index).locator('.trash-entry__date')).toContainText(language.label);
      await expect(rows.nth(index).locator('time')).toHaveAttribute('datetime', items[index].deletedAt!);
      await expect(rows.nth(index).locator('time')).toHaveText(formatter.format(new Date(items[index].deletedAt!)));
    }
    for (let index = 2; index < 4; index++) {
      await expect(rows.nth(index).locator('.trash-entry__date')).toHaveText(language.unknown);
      await expect(rows.nth(index).locator('time')).toHaveCount(0);
    }
    if (language.locale === 'ru-RU') {
      await page.screenshot({ path: 'tmp/account-trash-dates.png' });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.locator('.account-overlay').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    await rows.first().getByRole('button', { name: language.restore, exact: true }).click();
    await expect(rows).toHaveCount(3);
    await expect(rows.first().locator('time')).toHaveAttribute('datetime', '2026-09-07T07:05:00.000Z');
  });
}
