import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge' } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [], requests = [];
  let published = false, httpFailure = 0, delay = false;
  page.on('pageerror', error => errors.push(error.message));
  const day = date => ({ date, events: [
    { category: 'commemoration', title: 'Святитель Николай' },
    { category: 'scripture-reading', title: 'Лк.5:17–26', reading: { reference: 'Лк.5:17–26', lectionary: { status: 'exact-reference-match', basis: 'exact-source-coordinates', candidates: [{ kind: 'gospel', book: 'Luke', number: 19 }] } } },
    { category: 'scripture-reading', title: 'Неоднозначное чтение', reading: { lectionary: { status: 'ambiguous', basis: 'exact-source-coordinates', candidates: [{ kind: 'gospel', book: 'Luke', number: 19 }] } } },
  ] });
  const route = async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/public-api-config.php') return route.fulfill({ contentType: 'text/javascript', body: 'globalThis.KalendarConfig={publicApiUrl:"https://bible.example"};' });
    if (/^\/calendar-ui\/[a-z0-9-]+\.(js|css)$/.test(url.pathname)) return route.fulfill({ contentType: url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css', body: fs.readFileSync('public' + url.pathname) });
    if (url.pathname === '/fonts/MonomakhUnicode.ttf') return route.fulfill({ contentType: 'font/ttf', body: fs.readFileSync('public/fonts/MonomakhUnicode.ttf') });
    if (url.pathname === '/api/v1/calendar/day') return route.fulfill({ json: { day: day(url.searchParams.get('date')) } });
    if (url.pathname === '/api/v1/calendar/service') return route.fulfill({ json: {
      schemaVersion: 2, textPolicy: 'calendar-language-v1', calendarLanguage: 'ru',
      assignments: [
        { title: 'Тропарь', insert: true, text: 'Церковнославянский оригинал', language: 'cu', orthography: 'traditional' },
        { title: 'Кондак', insert: true, text: 'Гражданская запись', language: 'cu-civil', orthography: 'civil-accented' },
        { title: 'Молитва', insert: true, text: 'Русский текст', language: 'ru' },
      ],
    } });
    if (url.pathname.startsWith('/api/v1/liturgical/services/')) {
      requests.push(url); assert.equal(url.origin, 'https://bible.example');
      const office = url.pathname.split('/').at(-1), language = url.searchParams.get('language'), date = url.searchParams.get('date');
      const context = { office, language, date, sequence: url.searchParams.get('sequence'), calendarStyle: 'julian', temple: url.searchParams.get('temple') };
      if (delay && office === 'third-hour') await new Promise(resolve => setTimeout(resolve, 300));
      if (httpFailure) return route.fulfill({ status: httpFailure, json: { error: 'error' } });
      if (language !== 'cu-civil') return route.fulfill({ status: 409, json: { data: { schemaVersion: 1, context, status: 'unsupported', issues: [{ code: 'unsupported-edition' }] } } });
      if (!published) return route.fulfill({ status: 409, json: { data: { schemaVersion: 1, context, status: office === 'liturgy' ? 'not-appointed' : 'needs-review', blocks: [{ segments: [{ text: 'PRIVATE MUST NOT RENDER' }] }], fragments: { private: 'secret' } } } });
      return route.fulfill({ json: { data: { schemaVersion: 1, context, status: 'complete', completeness: { text: true, appointment: true, review: true }, blocks: [
        { kind: 'heading', role: 'rubric', segments: [{ text: `${office} ${date}`, style: 'rubric' }] },
        { kind: 'paragraph', role: 'priest', segments: [{ text: 'Священник: ', style: 'rubric' }, { text: 'Благослове́н Бог наш. <script>unsafe</script>', style: 'text' }] },
        { kind: 'paragraph', repeatIndex: 1, repeatCount: 2, segments: [{ text: 'Го́споди, поми́луй.', style: 'text' }] },
        { kind: 'paragraph', repeatIndex: 2, repeatCount: 2, segments: [{ text: 'Го́споди, поми́луй.', style: 'text' }] },
      ] } } });
    }
    return route.fulfill({ contentType: 'text/html', body: fs.readFileSync('public/web-calendar.html') });
  };
  await page.route('https://web.test/**', route);
  await page.route('https://bible.example/**', route);
  await page.goto('https://web.test/web-calendar?view=day&date=2026-10-21&lang=ru');
  await page.locator('.day-texts summary').waitFor();
  assert.match(await page.locator('.reading-list').innerText(), /Лк.5:17–26 · зачало 19/);
  assert.doesNotMatch(await page.locator('.reading-list .event-card').nth(1).innerText(), /зачало/);
  assert.equal(await page.locator('.day-texts').evaluate(el => el.open), false);
  await page.locator('.day-texts summary').click(); await page.evaluate(() => document.fonts.ready);
  assert.match(await page.locator('[data-text-language="cu"]').evaluate(el => getComputedStyle(el).fontFamily), /Calendar API Slavonic/);
  assert.doesNotMatch(await page.locator('[data-text-language="cu-civil"]').evaluate(el => getComputedStyle(el).fontFamily), /Calendar API Slavonic/);
  assert.doesNotMatch(await page.locator('[data-text-language="ru"]').evaluate(el => getComputedStyle(el).fontFamily), /Calendar API Slavonic/);
  await page.getByRole('button', { name: 'Читать службу целиком' }).click();
  await page.getByRole('button', { name: 'Проверить доступность' }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('date'), '2026-10-21');
  assert.equal(new URL(page.url()).searchParams.get('view'), 'worship');
  assert.doesNotMatch(await page.locator('.worship-content').innerText(), /PRIVATE|secret/);
  published = true;
  await page.getByRole('button', { name: 'Проверить доступность' }).click();
  await page.locator('.worship-text').waitFor();
  assert.equal(await page.locator('.worship-block').count(), 4);
  assert.equal(await page.locator('.worship-text script').count(), 0);
  assert.match(await page.locator('.worship-text').innerText(), /<script>unsafe<\/script>/);
  assert.equal((await page.locator('.worship-text').innerText()).match(/Го́споди, поми́луй./g).length, 2);
  assert.equal(await page.locator('.worship-toc a').count(), 1);
  assert.equal(await page.locator('.worship-toc a').getAttribute('href'), '#worship-part-0');
  await page.locator('[data-worship-control="temple"]').selectOption('nicholas');
  await page.locator('[data-worship-control="office"]').selectOption('first-hour');
  await page.locator('.worship-text').waitFor();
  assert.match(await page.locator('.worship-text').innerText(), /first-hour/);
  assert.equal(requests.at(-1).searchParams.get('temple'), 'nicholas');
  assert.equal(requests.at(-1).searchParams.get('matinsDismissalDone'), '1');
  const direct = page.url(); await page.reload(); await page.locator('.worship-text').waitFor();
  assert.equal(page.url(), direct);
  assert.equal(await page.locator('[data-worship-control="office"]').inputValue(), 'first-hour');
  assert.equal(await page.locator('[data-worship-control="temple"]').inputValue(), 'nicholas');
  await page.locator('[data-worship-control="office"]').selectOption('ninth-hour');
  await page.locator('[data-worship-control="sequence"]').selectOption('before-vespers');
  await page.locator('[data-worship-control="location"]').selectOption('narthex');
  await page.locator('.worship-text').waitFor();
  assert.equal(requests.at(-1).searchParams.get('location'), 'narthex');
  assert.equal(requests.at(-1).searchParams.get('nextOffice'), 'vespers');
  await page.locator('[data-worship-control="office"]').selectOption('sixth-hour');
  await page.locator('.worship-text').waitFor();
  assert.equal(requests.at(-1).searchParams.get('sequence'), 'after-third-hour');
  assert.equal(requests.at(-1).searchParams.has('temple'), false);
  delay = true;
  await page.locator('[data-worship-control="office"]').selectOption('third-hour');
  await page.locator('[data-worship-control="office"]').selectOption('sixth-hour');
  await page.locator('.worship-text').waitFor(); await page.waitForTimeout(400);
  assert.match(await page.locator('.worship-text').innerText(), /sixth-hour/); delay = false;
  httpFailure = 429;
  const before = requests.length;
  await page.reload(); await page.getByRole('button', { name: 'Проверить доступность' }).waitFor();
  assert.match(await page.locator('.worship-content').innerText(), /Не удалось загрузить службу/);
  assert.equal(requests.length, before + 1); httpFailure = 0;
  published = false;
  await page.locator('[data-worship-control="office"]').selectOption('liturgy');
  await page.getByText('Литургия в этот день не назначена.', { exact: true }).waitFor();
  published = true;
  await page.goto('https://web.test/web-calendar?view=worship&date=2027-10-21&lang=de&office=third-hour&temple=george-victorious');
  await page.locator('.worship-text').waitFor();
  assert.match(await page.locator('.worship-text').innerText(), /2027-10-21/);
  assert.equal(await page.locator('.worship-quick button').innerText(), 'Gottesdienst heute');
  assert.equal(await page.locator('.edition-label').innerText(), 'Kirchenslawisch — moderne Schrift');
  await page.locator('input[type="range"]').fill('28');
  await page.locator('input[type="range"]').dispatchEvent('input');
  assert.equal(await page.locator('.worship-text').evaluate(el => getComputedStyle(el).fontSize), '28px');
  fs.mkdirSync('tmp/worship-reader', { recursive: true });
  await page.screenshot({ path: 'tmp/worship-reader/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: 'tmp/worship-reader/mobile.png', fullPage: true });
  await page.getByRole('button', { name: '← Zum Kalendertag' }).click();
  await page.locator('.day-texts summary').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('date'), '2027-10-21');
  assert.deepEqual(errors, []);
  console.log('PASS worship direct links, altar/Hour modes, live readiness, source order/repeats/rubrics, safe text, edition fonts, lection numbers, stale requests, rate limits, DE, desktop/mobile');
} finally { await browser.close(); }
