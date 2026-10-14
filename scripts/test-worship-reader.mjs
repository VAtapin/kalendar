import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { templateFor, assignmentsFor } from '../tests/fixtures/worship-parts.mjs';

const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge' } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [], requests = [];
  let published = false, httpFailure = 0, delay = false, traditional = false;
  const editionTemplate = (office, language) => {
    const template = templateFor(['matins', 'vespers'].includes(office) ? 'liturgy' : office);
    if (['matins', 'vespers'].includes(office)) template.templateId = office + ':fixture';
    const prayer = template.nodes[0].blocks[2];
    template.nodes[0].blocks.splice(2, 2, ...Array.from({ length: 12 }, (_, index) => ({
      ...structuredClone(prayer), occurrenceId: office + ':mercy:0:' + index, repeatIndex: index + 1, repeatCount: 12,
    })));
    if (language === 'cu') {
      template.language = 'cu'; template.orthography = 'traditional';
      template.nodes.filter(node => node.kind !== 'slot').forEach(node => { node.language = 'cu'; node.orthography = 'traditional'; });
      template.nodes[0].blocks[1].segments[1].text = 'Бл҃гослове́нъ Бо́гъ на́шъ.';
      if (office === 'liturgy') {
        template.nodes[0].blocks[1].segments[0].text = 'Сщ҃е́нникъ глаго́летъ та́йно: ';
        template.nodes[0].blocks[1].parallelWith = 'choir';
        template.nodes[0].blocks.push(...Array.from({ length: 20 }, (_, index) => ({ kind: 'text', segments: [{ text: 'Молитва ' + index }] })));
        Object.assign(template, { status: 'fixed-template', cleanTemplate: true, compositionReady: true,
          wholeLiturgyAccepted: false, profile: { id: 'ordinary-one-priest-one-deacon', rite: 'john-chrysostom' } });
        template.nodes[0].kind = 'fixed'; template.nodes[0].role = 'priest'; template.nodes[0].delivery = 'secret';
        template.parallelGroups = { prayer: { lanes: { priest: ['opening'] } } };
      }
    }
    return template;
  };
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
    if (['/fonts/MonomakhUnicode.ttf','/fonts/Ponomar-Regular.ttf','/fonts/DejaVuSerif.ttf'].includes(url.pathname)) return route.fulfill({ contentType: 'font/ttf', body: fs.readFileSync('public'+url.pathname) });
    if (url.pathname === '/api/v1/calendar/day') return route.fulfill({ json: { day: day(url.searchParams.get('date')) } });
    if (url.pathname === '/api/v1/calendar/service') return route.fulfill({ json: {
      schemaVersion: 2, textPolicy: 'calendar-language-v1', calendarLanguage: 'ru',
      assignments: [
        { title: 'Тропарь', insert: true, text: 'Церковнославянский оригинал', language: 'cu', orthography: 'traditional' },
        { title: 'Кондак', insert: true, text: 'Гражданская запись', language: 'cu-civil', orthography: 'civil-accented' },
        { title: 'Молитва', insert: true, text: 'Русский текст', language: 'ru' },
        { textId: 'reference-example', title: 'Справочный тропарь', insert: false, text: 'Не вставлять в последование', language: 'cu-civil' },
      ],
      properAssignments: [{ textId: 'reference-example', title: 'Справочный тропарь', insert: false, text: 'Не вставлять в последование', language: 'cu-civil' }],
    } });
    if (url.pathname.startsWith('/api/v1/liturgical/templates/')) {
      const office = url.pathname.split('/').at(-1);
      const language = url.searchParams.get('language');
      if (language === 'ru' || (language === 'cu' && !traditional)) return route.fulfill({ status: 422, json: { errors: { language: ['validation.in'] } } });
      return route.fulfill({ json: { data: editionTemplate(office, language) } });
    }
    if (url.pathname.startsWith('/api/v1/liturgical/assignments/')) {
      requests.push(url); assert.equal(url.origin, 'https://bible.example');
      const office = url.pathname.split('/').at(-1), date = url.searchParams.get('date');
      const context = { ...Object.fromEntries(url.searchParams), office, date };
      if (delay && office === 'third-hour') await new Promise(resolve => setTimeout(resolve, 300));
      if (httpFailure) return route.fulfill({ status: httpFailure, json: { error: 'error' } });
      const data = assignmentsFor(editionTemplate(office, context.language), context, published && !['liturgy', 'matins', 'vespers'].includes(office));
      data.context.language = context.language;
      if (!published && office === 'liturgy') data.status = 'not-appointed';
      data.fragments = { private: 'PRIVATE MUST NOT RENDER' };
      return route.fulfill({ json: { data } });
    }
    return route.fulfill({ contentType: 'text/html', body: fs.readFileSync('public/web-calendar.html') });
  };
  await page.route('https://web.test/**', route);
  await page.route('https://bible.example/**', route);
  await page.goto('https://web.test/web-calendar?view=day&date=2026-10-21&lang=ru');
  await page.locator('.day-texts summary').first().waitFor();
  assert.equal(await page.locator('.intro').count(), 0);
  assert.match(await page.locator('.reading-list').innerText(), /Лк.5:17–26 · зачало 19/);
  assert.doesNotMatch(await page.locator('.reading-list .event-card').nth(1).innerText(), /зачало/);
  assert.equal(await page.locator('.day-texts').first().evaluate(el => el.open), false);
  await page.locator('[data-assignment-kind="appointed"] summary').click(); await page.evaluate(() => document.fonts.ready);
  assert.match(await page.locator('[data-text-language="cu"]').evaluate(el => getComputedStyle(el).fontFamily), /Calendar Liturgical Slavonic/);
  assert.match(await page.locator('[data-assignment-kind="appointed"] [data-text-language="cu-civil"]').evaluate(el => getComputedStyle(el).fontFamily), /Calendar Civil Text/);
  assert.match(await page.locator('[data-text-language="ru"]').evaluate(el => getComputedStyle(el).fontFamily), /Calendar Civil Text/);
  assert.equal(await page.locator('[data-assignment-kind="reference"] .assignment').count(), 1);
  assert.equal(await page.evaluate(() => document.fonts.check('21px "Calendar Liturgical Slavonic"')), true);
  assert.equal(await page.evaluate(() => document.fonts.check('18px "Calendar Civil Text"')), true);
  await page.getByRole('button', { name: 'Читать службу целиком' }).click();
  await page.getByRole('button', { name: 'Проверить доступность' }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('date'), '2026-10-21');
  assert.equal(new URL(page.url()).searchParams.get('view'), 'worship');
  assert.doesNotMatch(await page.locator('.worship-content').innerText(), /PRIVATE|secret/);
  await page.locator('.worship-text[data-composition="partial"]').waitFor();
  assert.match(await page.locator('.worship-text').innerText(), /Благослове́н Бог наш/);
  assert.equal(await page.locator('.worship-missing').count(), 3);
  published = true;
  await page.getByRole('button', { name: 'Проверить доступность' }).click();
  await page.locator('.worship-text[data-composition="complete"]').waitFor();
  assert.equal(await page.locator('.worship-block').count(), 6);
  assert.equal(await page.locator('.worship-missing').count(), 0);
  assert.equal(await page.locator('.worship-text script').count(), 0);
  assert.match(await page.locator('.worship-text').innerText(), /<script>unsafe<\/script>/);
  assert.equal((await page.locator('.worship-text').innerText()).match(/Го́споди, поми́луй./g).length, 1);
  assert.equal(await page.locator('.repetition-number').innerText(), '12');
  assert.equal(await page.locator('.worship-toc a').count(), 1);
  assert.equal(await page.locator('.worship-toc a').getAttribute('href'), '#worship-part-0');
  assert.equal(await page.locator('.worship-toc a').getAttribute('data-text-language'), 'cu-civil');
  assert.match(await page.locator('.worship-toc a').evaluate(el => getComputedStyle(el).fontFamily), /Calendar Civil Text/);
  await page.locator('[data-worship-control="temple"]').selectOption('nicholas');
  await page.locator('[data-worship-control="office"]').selectOption('first-hour');
  await page.locator('.worship-text[data-composition="complete"]').waitFor();
  assert.match(await page.locator('.worship-text').innerText(), /first-hour/);
  assert.equal(requests.at(-1).searchParams.get('temple'), 'nicholas');
  assert.equal(requests.at(-1).searchParams.get('matinsDismissalDone'), '1');
  const direct = page.url(); await page.reload(); await page.locator('.worship-text[data-composition="complete"]').waitFor();
  assert.equal(page.url(), direct);
  assert.equal(await page.locator('[data-worship-control="office"]').inputValue(), 'first-hour');
  assert.equal(await page.locator('[data-worship-control="temple"]').inputValue(), 'nicholas');
  await page.locator('[data-worship-control="office"]').selectOption('ninth-hour');
  await page.locator('[data-worship-control="sequence"]').selectOption('before-vespers');
  await page.locator('[data-worship-control="location"]').selectOption('narthex');
  await page.locator('.worship-text[data-composition="complete"]').waitFor();
  assert.equal(requests.at(-1).searchParams.get('location'), 'narthex');
  assert.equal(requests.at(-1).searchParams.get('nextOffice'), 'vespers');
  await page.locator('[data-worship-control="office"]').selectOption('sixth-hour');
  await page.locator('.worship-text[data-composition="complete"]').waitFor();
  assert.equal(requests.at(-1).searchParams.get('sequence'), 'after-third-hour');
  assert.equal(requests.at(-1).searchParams.has('temple'), false);
  delay = true;
  await page.locator('[data-worship-control="office"]').selectOption('third-hour');
  await page.locator('[data-worship-control="office"]').selectOption('sixth-hour');
  await page.locator('.worship-text[data-composition="complete"]').waitFor(); await page.waitForTimeout(400);
  assert.match(await page.locator('.worship-text').innerText(), /sixth-hour/); delay = false;
  httpFailure = 429;
  const before = requests.length;
  await page.reload(); await page.locator('.worship-content[data-assignments-status="error"]').waitFor();
  assert.match(await page.locator('.worship-content').innerText(), /Постоянный текст доступен/);
  assert.match(await page.locator('.worship-text').innerText(), /Благослове́н Бог наш/);
  assert.equal(requests.length, before + 1); httpFailure = 0;
  published = false;
  await page.locator('[data-worship-control="office"]').selectOption('liturgy');
  await page.getByText('Литургия в этот день не назначена. Ниже приведён книжный текст для чтения.', { exact: true }).waitFor();
  assert.equal(await page.locator('.worship-text[data-composition="source-outline"]').count(), 1);
  for (const office of ['matins', 'vespers']) {
    traditional = true;
    await page.locator('[data-worship-control="office"]').selectOption(office);
    await page.locator('.worship-text[data-composition="source-outline"]').waitFor();
    assert.match(await page.locator('.worship-content').innerText(), /Показан полный исходный текст службы/);
    assert.doesNotMatch(await page.locator('.worship-content').innerText(), /Книжная основа Литургии/);
    await page.locator('[data-worship-control="sequence"]').selectOption('vigil');
    await page.reload(); await page.locator('.worship-text[data-composition="source-outline"]').waitFor();
    assert.equal(await page.locator('[data-worship-control="office"]').inputValue(), office);
    assert.equal(await page.locator('[data-worship-control="sequence"]').inputValue(), 'vigil');
  }
  traditional = false;
  await page.locator('[data-worship-control="office"]').selectOption('liturgy');
  await page.locator('.worship-text[data-composition="source-outline"]').waitFor();
  await page.locator('[data-worship-control="textLanguage"]').selectOption('cu');
  await page.getByText('Выбранная редакция этой службы пока отсутствует в BibleDesktop.', { exact: true }).waitFor();
  assert.equal(await page.locator('.worship-text').count(), 0);
  assert.equal(new URL(page.url()).searchParams.get('textLanguage'), 'cu');
  traditional = true;
  await page.getByRole('button', { name: 'Проверить доступность' }).click();
  await page.locator('.worship-part[data-text-language="cu"]').first().waitFor();
  assert.match(await page.locator('.worship-text').innerText(), /Бл҃гослове́нъ Бо́гъ/);
  assert.equal(await page.locator('.repetition-number').innerText(), 'ві҃');
  await page.getByText('Постоянная основа Литургии: один священник и один диакон.', { exact: true }).waitFor();
  assert.equal(await page.locator('.worship-part[data-parallel-group="prayer"]').count(),1);
  assert.equal(await page.locator('.worship-text .edition-label').count(),0);
  assert.equal(await page.locator('.worship-part[data-role="priest"][data-delivery="secret"]').count(),1);
  assert.match(await page.locator('.worship-text').innerText(), /Сщ҃е́нникъ глаго́летъ та́йно:/);
  assert.equal(await page.locator('.parallel-prayer').count(),1);
  assert.equal(requests.at(-1).searchParams.get('mode'),'fixed');
  assert.match(await page.locator('.worship-part').first().evaluate(el => getComputedStyle(el).fontFamily), /Calendar Liturgical Slavonic/);
  assert.equal(await page.locator('.worship-toc a').getAttribute('lang'), 'cu');
  assert.match(await page.locator('.worship-toc a').evaluate(el => getComputedStyle(el).fontFamily), /Calendar Liturgical Slavonic/);
  assert.equal(await page.locator('.worship-toc a').textContent(), await page.locator('.worship-text h3').textContent());
  for (const width of [1280,390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('.worship-text p').last().scrollIntoViewIfNeeded();
    await page.locator('.worship-to-toc').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.worship-to-toc').evaluate(el => getComputedStyle(el).position),'fixed');
    await page.locator('.worship-to-toc').click();
    await page.waitForFunction(() => document.querySelector('.worship-navigation summary').getBoundingClientRect().top >= 0);
    assert.equal(await page.locator('.worship-navigation').getAttribute('open'),'');
    await page.locator('.worship-to-toc').waitFor({ state: 'hidden' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
  await page.locator('.worship-part[data-text-language="cu"]').first().waitFor();
  assert.equal(await page.locator('[data-worship-control="textLanguage"]').inputValue(), 'cu');
  await page.locator('[data-worship-control="office"]').selectOption('sixth-hour');
  await page.locator('.worship-part[data-text-language="cu"]').first().waitFor();
  await page.locator('[data-worship-control="textLanguage"]').selectOption('cu-civil');
  await page.locator('.worship-part[data-text-language="cu-civil"]').first().waitFor();
  traditional = false;
  published = true;
  await page.goto('https://web.test/web-calendar?view=worship&date=2027-10-21&lang=de&office=third-hour&temple=george-victorious');
  await page.locator('.worship-text[data-composition="complete"]').waitFor();
  assert.match(await page.locator('.worship-text').innerText(), /2027-10-21/);
  assert.equal(await page.locator('.worship-quick button').innerText(), 'Gottesdienst heute');
  assert.equal(await page.locator('.worship-part').first().getAttribute('data-text-language'), 'cu-civil');
  await page.locator('input[type="range"]').fill('28');
  await page.locator('input[type="range"]').dispatchEvent('input');
  assert.equal(await page.locator('.worship-text').evaluate(el => getComputedStyle(el).fontSize), '28px');
  fs.mkdirSync('tmp/worship-reader', { recursive: true });
  await page.screenshot({ path: 'tmp/worship-reader/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: 'tmp/worship-reader/mobile.png', fullPage: true });
  await page.getByRole('button', { name: '← Zum Kalendertag' }).click();
  assert.equal(await page.locator('.worship-to-toc').count(),0);
  await page.locator('.day-texts summary').first().waitFor();
  assert.equal(new URL(page.url()).searchParams.get('date'), '2027-10-21');
  assert.deepEqual(errors, []);
  console.log('PASS worship direct links, altar/Hour modes, live readiness, source order/repeats/rubrics, safe text, edition fonts, lection numbers, stale requests, rate limits, DE, desktop/mobile');
} finally { await browser.close(); }
