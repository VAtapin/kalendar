import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileMo, readPo} from './wordpress-po.mjs';

const root = 'docs/translations/wordpressorg';
const locales = ['ru', 'de', 'uk', 'pl'];
const key = entry => (entry.msgctxt ?? '') + '\u0004' + entry.msgid;
const tokens = {
  urls: /https?:\/\/[^\s<>"\\]+/g,
  shortcodes: /\[orthocal_[^\]]*\]/g,
  parameters: /\b[a-z_]+="[^"]*"/g,
  html: /<\/?[a-zA-Z][^>]*>/g,
  dates: /YYYY-MM-DD/g,
};
const find = (text, pattern, type) => (text.match(pattern) ?? [])
  .map(value => type === 'urls' ? value.replace(/[.,;:]+$/, '') : value)
  .sort();

const readme = readFileSync('wordpress/orthocal/readme.txt', 'utf8');
assert.ok(!/â†|â€“/.test(readme), 'Readme contains UTF-8 decoding artifacts');
for (const line of readme.split(/\r?\n/)) {
  if (line.startsWith('<code>[orthocal_')) assert.match(line, /^<code>\[orthocal_[^\]]+\]<\/code>$/);
}

const catalogues = new Map(locales.map(locale => [
  locale,
  readPo(`${root}/stable-readme-1.3.79-${locale}.po`).filter(entry => entry.msgid),
]));
const sourceKeys = catalogues.get('ru').map(key).sort();
assert.equal(sourceKeys.length, 69, 'Readme catalogue coverage');
for (const [locale, entries] of catalogues) {
  assert.equal(entries.length, 69, `${locale}: readme catalogue coverage`);
  assert.deepEqual(entries.map(key).sort(), sourceKeys, `${locale}: originals and contexts`);
  for (const entry of entries) {
    assert.ok(entry.msgstr.trim(), `${locale}: empty translation`);
    assert.ok(!entry.comments.some(line => /^#,.*\bfuzzy\b/.test(line)), `${locale}: fuzzy translation`);
    assert.ok(!/â†|â€“/.test(entry.msgid + entry.msgstr), `${locale}: UTF-8 decoding artifact`);
    for (const [type, pattern] of Object.entries(tokens)) {
      assert.deepEqual(find(entry.msgstr, pattern, type), find(entry.msgid, pattern, type), `${locale}: ${type}`);
    }
  }
  assert.equal(compileMo(readPo(`${root}/stable-readme-1.3.79-${locale}.po`)).readUInt32LE(0), 0x950412de, `${locale}: MO compilation`);
}

for (const msgid of [
  'Show the API-recommended vestment colour as a patterned ornament in day, month and year views.',
  'Place the day’s source commemoration above the horizontal vestment ornament without repeating the colour name.',
]) {
  for (const [locale, entries] of catalogues) assert.ok(entries.some(entry => entry.msgid === msgid && entry.msgstr), `${locale}: 1.3.79 changelog`);
}
console.log('PASS reviewed RU/DE/UK/PL Readme 1.3.79 proposals: UTF-8, code shortcodes, source parity, technical tokens, changelog and MO compilation');
