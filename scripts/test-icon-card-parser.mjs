import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseIconCard } from './lib/icon-card-parser.mjs';
const url = 'https://azbyka.ru/days/ikona-example';

test('nested gallery, entities, deduplication and unrelated photos', () => {
  const result = parseIconCard(`<div id="slider"><div><div>controls</div>
    <a data-fancybox-href='/days/storage/images/saints/1/a.jpg?x=1&amp;y=2'></a>
    <a data-fancybox-href='/days/storage/images/saints/1/a.jpg?x=1&amp;y=2'></a>
    <a data-fancybox-href='https://evil.example/days/storage/images/saints/1/x.jpg'></a>
    </div></div><h1>Икона &laquo;Имя&#x301;&raquo; &amp; &#1040;</h1>
    <a data-fancybox-href='/days/storage/images/saints/1/unrelated.jpg'></a>`, url);
  assert.equal(result.title, 'Икона «Имя́» & А');
  assert.deepEqual(result.images, [{ sourceUrl: 'https://azbyka.ru/days/storage/images/saints/1/a.jpg?x=1&y=2' }]);
  assert.deepEqual(result.dates, []);
});
test('celebration dates remain source examples and ignore sidebar and biography links', () => {
  const result = parseIconCard(`<h1>Икона</h1><div class="brif extra celebration"><div>Память</div>
    <p><a href="/days/2027-01-02">2 января</a> (20 декабря ст. ст.)</p></div>
    <aside><a href="/days/2026-09-09">9 сентября</a></aside>
    <div class="ikon-description"><a href="/days/2026-01-01">История</a></div>`, url);
  assert.deepEqual(result.dates, [{ label: '2 января (20 декабря ст. ст.)', sourceUrl: 'https://azbyka.ru/days/2027-01-02', exampleGregorianDate: '2027-01-02', movable: null, status: 'source-displayed-not-a-recurrence-rule' }]);
  assert.equal('biography' in result, false);
});
test('movable dates are never calculated from text or month/day', () => {
  const result = parseIconCard(`<h1>Святой</h1><div class='brif dates'><div><div>Даты</div>
    <p><span class='rolling'>Неделя по Пасхе</span></p>
    <p>Первое воскресенье сентября</p><p><a href='/days/2026-02-30'>30 февраля</a></p>
    </div></div>`, url);
  assert.equal(result.dates.length, 3);
  assert.equal(result.dates[0].movable, true);
  assert.equal(result.dates[1].movable, null);
  for (const date of result.dates) assert.equal(date.exampleGregorianDate, null);
});
test('explicit icon group fallback supports relative originals, not thumbnail src', () => {
  const result = parseIconCard(`<h1><span title='x > y'>Имя &quot;святого&quot;</span></h1>
    <a data-fancybox-group='ikon' data-fancybox-href='/days/storage/images/saints/a.png'><img src='/days/cache/200x160/x.jpg'></a>
    <script><a data-fancybox-group='ikon' data-fancybox-href='/days/storage/images/saints/fake.jpg'></a></script>`, url);
  assert.equal(result.title, 'Имя "святого"');
  assert.equal(result.images.length, 1);
});
test('missing heading fails closed', () => assert.throws(() => parseIconCard('<title>Not a card</title>', url), /Missing card title/));
test('gallery permits unknown image categories but rejects traversal and non-raster files', () => {
  const result = parseIconCard(`<h1>Святой</h1><div id='slider'>
    <a data-fancybox-href='/days/storage/images/new-category/42/image.JPG'></a>
    <a data-fancybox-href='/days/storage/images/new-category/../42/image.jpg'></a>
    <a data-fancybox-href='/days/storage/images/new-category/%2e%2e/42/image.jpg'></a>
    <a data-fancybox-href='/days/storage/images/new-category/image.svg'></a>
    <a data-fancybox-href='/days/storage/images/new-category/image.php'></a>
    </div><a data-fancybox-href='/days/storage/images/photos-of-day/outside.jpg'></a>`, url);
  assert.deepEqual(result.images, [{ sourceUrl: 'https://azbyka.ru/days/storage/images/new-category/42/image.JPG' }]);
});
test('saved source sample: four originals and January 2 celebration', { skip: !existsSync('tmp/icon-card-sample.html') }, () => {
  const result = parseIconCard(readFileSync('tmp/icon-card-sample.html', 'utf8'), url);
  assert.equal(result.images.length, 4);
  assert.equal(result.dates.length, 1);
  assert.equal(result.dates[0].exampleGregorianDate, '2027-01-02');
  assert.equal(result.dates[0].label, '2 января');
});
