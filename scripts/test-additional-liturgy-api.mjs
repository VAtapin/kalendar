// Node-only API/reader check; never opens a browser or changes server data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fetchWorshipParts, partsHash } from '../public/calendar-ui/worship-parts.js';
import { renderWorshipReader, OFFICES } from '../public/calendar-ui/worship-reader.js';
import { create, descendants } from '../tests/fixtures/worship-dom.mjs';
import { LITURGY_RITES } from '../public/calendar-ui/worship-additional-liturgy.js';

let captures = process.argv[2] === '--responses' ? JSON.parse(await readFile(process.argv[3], 'utf8')) : null;
if (process.argv[2] === '--manifest') {
  const manifest = JSON.parse(await readFile(process.argv[3], 'utf8')), payloads = new Map();
  assert.equal(manifest.verbatimResponseContent, true);
  for (const [name, info] of Object.entries(manifest.files)) {
    const bytes = await readFile(resolve(dirname(process.argv[3]), name));
    assert.equal(bytes.length, info.bytes); assert.equal(info.httpStatus, 200);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), info.sha256);
    payloads.set(name, JSON.parse(bytes.toString('utf8')));
  }
  captures = Object.entries(manifest.files).filter(([name]) => name.endsWith('-template.json')).map(([name, info]) => ({
    query: Object.fromEntries(new URL(info.url, 'https://isolated-api.example').searchParams),
    template: payloads.get(name), assignments: payloads.get(name.replace('-template.json', '-assignments.json')),
  }));
}
const base = captures ? 'https://isolated-api.example' : process.argv[2] || 'https://bible-desktop.com';
const profiles = [['basil-great', undefined, 728, 36], ['presanctified', 'before-mid-lent-wednesday', 598, 30], ['presanctified', 'from-mid-lent-wednesday', 634, 30]];
globalThis.document = { fonts: { ready: Promise.resolve() }, createTextNode: text => create('span', text) };
globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
assert.equal(Object.keys(OFFICES).length, 7);
for (const [rite, midLentBranch, count, missing] of profiles) {
  const captured = captures?.find(row => row.query.rite === rite && row.query.midLentBranch === midLentBranch);
  if (captures) assert.ok(captured, 'Missing actual API capture');
  const urls = [];
  const fetcher = async (url, options) => {
    urls.push(url);
    return captured ? { status: 200, json: async () => url.pathname.includes('/templates/') ? captured.template : captured.assignments } : fetch(url, options);
  };
  const state = { office: 'liturgy', date: captured?.assignments?.data?.requestedContext?.date || '2026-11-02', textLanguage: 'cu', textSize: 22, rite, midLentBranch, temple: 'nicholas', sequence: 'default' };
  const result = await fetchWorshipParts(base, state, () => {}, fetcher);
  assert.equal(result.assignmentsStatus, 'partial'); assert.equal(result.complete, false);
  const blocks = result.entries.flatMap(node => node.blocks || []);
  assert.equal(blocks.length, count); assert.equal(await partsHash(blocks), result.template.fixedBlocksHash);
  assert.equal(result.entries.filter(node => node.missing).length, missing);
  for (const url of urls) for (const key of ['temple', 'sequence', 'calendarStyle']) assert.equal(url.searchParams.has(key), false);
  const reader = renderWorshipReader({ state, create, formatDate: date => date, onRetry() {} }); reader.render(result);
  const nodes = descendants(reader.page), body = nodes.find(node => node.tag === 'article');
  assert.ok(nodes.some(node => node.textContent === LITURGY_RITES[rite]));
  assert.equal(descendants(body).filter(node => node.className.includes('worship-missing')).length, missing);
  assert.ok(nodes.some(node => node.className === 'worship-conditional'));
  assert.ok(!nodes.some(node => node.textContent === 'Полная служба дня'));
  if (captured?.rejectedTemple) assert.ok(captured.rejectedTemple.errors?.temple);
  else if (!captured) {
    const url = new URL(urls[1]); url.searchParams.set('temple', 'nicholas');
    const response = await fetch(url); assert.equal(response.status, 422);
  }
  reader.dispose();
  console.log(`${rite}/${midLentBranch || 'ordinary'}: ${count} fixed blocks, ${missing} required slots, partial; API/reader PASS`);
}
