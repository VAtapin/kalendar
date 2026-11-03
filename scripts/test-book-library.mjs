// Read-only public API and Node DOM check; no browser, local book copies or service requests.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fetchBookCatalogue, sourceBookIndex } from '../public/calendar-ui/book-library.js';
import { sourceBookSections, BOOK_SECTION_BLOCK_LIMIT, BOOK_SECTION_TEXT_LIMIT } from '../public/calendar-ui/book-sections.js';
import { createBookReader } from '../public/calendar-ui/book-reader.js';
import { create, descendants } from '../tests/fixtures/worship-dom.mjs';

const base = process.argv[2] || 'https://bible-desktop.com';
const entries = await fetchBookCatalogue(base);
assert.ok(entries.some(entry => entry.group === 'minea')); assert.ok(entries.some(entry => entry.slug === 'octoechos-ponomar-whole'));
globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
for (const entry of [entries.find(entry => entry.group === 'minea'), entries.find(entry => entry.slug === 'octoechos-ponomar-whole'), entries.find(entry => entry.group === 'other')]) {
  assert.ok(entry); let source;
  const fetcher = async (url, options) => {
    assert.ok(!/calendar|assignments|templates|services/.test(url.pathname));
    assert.equal(url.searchParams.has('date'), false);
    const response = await fetch(url, options); assert.equal(response.status, 200);
    const value = await response.json(); if (url.pathname.includes('/versions/')) source = value.data;
    return { status: response.status, json: async () => value };
  };
  const state = { book: entry.slug, edition: entry.edition.code, bookGroup: entry.group, bookMonth: '', bookDay: '', bookTone: '', bookWeekday: '', textSize: 22 };
  const reader = createBookReader({ base, state, create, onStateChange() {}, onCalendar() {}, fetcher, yieldFrame: async () => {} });
  await reader.start(); const snapshot = reader.getDocument();
  assert.ok(snapshot); assert.equal(snapshot.kind, 'book'); assert.deepEqual(snapshot.warnings, []);
  assert.equal(snapshot.sourceMetadata.edition, entry.edition.code); const range = snapshot.sourceMetadata.selection.range;
  assert.equal(snapshot.blocks.length, range.end - range.start);
  for (let i = range.start; i < range.end; ++i) assert.equal(snapshot.blocks[i - range.start].runs.map(run => run.text).join(''), source.blocks[i].segments.map(segment => segment.text).join(''));
  assert.equal(descendants(reader.page).filter(node => node.className === 'worship-missing').length, 0);
  if (entry.group === 'octoechos') {
    const index = sourceBookIndex(source); assert.deepEqual(index.tones.map(item => item.tone), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.ok(index.tones[7].end < source.blocks.length, 'Separate appendices must remain outside the eighth-tone selection');
    const sections = sourceBookSections(source, index);
    assert.deepEqual(sections.flatMap(section => source.blocks.slice(section.start, section.end)), source.blocks);
    assert.equal(Buffer.compare(Buffer.from(JSON.stringify(sections.flatMap(section => source.blocks.slice(section.start, section.end)))), Buffer.from(JSON.stringify(source.blocks))), 0);
    assert.ok(sections.every(section => section.end - section.start <= BOOK_SECTION_BLOCK_LIMIT));
    assert.ok(sections.every(section => section.end - section.start === 1 || source.blocks.slice(section.start, section.end).reduce((sum, block) => sum + block.segments.map(segment => segment.text).join('').length, 0) <= BOOK_SECTION_TEXT_LIMIT));
    assert.deepEqual([...new Set(sections.map(section => section.tone).filter(tone => /^[1-8]$/.test(tone)))], ['1','2','3','4','5','6','7','8']);
    assert.ok(sections.some(section => section.tone === 'preface')); assert.ok(sections.some(section => section.tone === 'appendices'));
    for (const section of sections) {
      const input = descendants(reader.page).find(node => node.dataset.bookControl === 'bookPart'); input.value = section.id; await input.events.change();
      const part = reader.getDocument(); assert.ok(part); assert.deepEqual(part.sourceMetadata.selection.range, { start: section.start, end: section.end });
      assert.equal(part.blocks.map(block => block.runs.map(run => run.text).join('')).join(''), source.blocks.slice(section.start, section.end).map(block => block.segments.map(segment => segment.text).join('')).join(''));
    }
    console.log(`${sections.length} bounded sections: complete partition byte parity + every reader snapshot PASS`);
    const witnessAt = process.argv.indexOf('--witness');
    if (witnessAt >= 0) {
      const witness = JSON.parse(await readFile(process.argv[witnessAt + 1], 'utf8'));
      const hashes = new Set(source.blocks.map(block => createHash('sha256').update(block.segments.map(segment => segment.text).join('')).digest('hex')));
      for (const anchor of Object.values(witness.serviceAnchors)) assert.ok(hashes.has(anchor.headingHash), 'Source heading witness must match a verbatim published block');
      console.log('Read-only Octoechos heading witness: PASS');
    }
  }
  console.log(`${entry.slug}/${entry.edition.code}: ${source.blocks.length} native CU source blocks preserved across sections; book mode PASS`);
  reader.dispose();
}
