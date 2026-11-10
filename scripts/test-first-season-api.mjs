import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fetchWorshipParts } from '../public/calendar-ui/worship-parts.js';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { create, installReaderPdfDocument } from '../tests/fixtures/reader-pdf-dom.mjs';
import { captureWorshipPdf, exportWorshipPdf } from '../src/export/worship-pdf-browser.ts';
import { partsHash, textHash } from '../public/calendar-ui/worship-hash.js';
const directory = process.argv[2]; assert.ok(directory, 'Pass the directory containing original local API responses');
const hashes = { template: '29317075865fb64ca2686ee447e71be1324b40896bfc68804a511d83297b8580', assignments: 'a534b9e6af99d883e600e7af1978e40213c3d95520e15009653062ff7dbfeb62', full: 'dcfc567a03a66864367d788a30cbdfe2bd80373aa238e1f5e2ffe349e272c78d' };
const read = async name => { const bytes = await readFile(`${directory}/first-hour-season-${name}.json`); assert.equal(createHash('sha256').update(bytes).digest('hex'), hashes[name]); return JSON.parse(bytes); };
const template = await read('template'), assignments = await read('assignments'), full = await read('full');
const state = { date: '2026-03-03', office: 'first-hour', sequence: 'before-matins-dismissal', afterHourHymn: 'none', temple: 'george-victorious', textLanguage: 'cu', textSize: 22 };
const local = { schemaVersion: 1, templeProfileId: state.temple, confirmedLiteralForms: true, people: { primate: { rank: 'patriarch', forms: { accusative: 'Иоанна' } }, diocesan: { rank: 'bishop', forms: { accusative: 'Петра' } } } };
let calls = [];
const fetcher = async (url, options) => {
  calls.push({ url, options });
  if (!options.method) { assert.equal(url.searchParams.get('matinsDismissalDone'), '0'); return { status: 200, json: async () => template }; }
  assert.equal(url.search, ''); assert.equal(options.method, 'POST'); assert.deepEqual(JSON.parse(options.body).localContext, local);
  return { status: 200, headers: new Headers({ 'cache-control': 'no-store, private' }), json: async () => assignments };
};
const base = await fetchWorshipParts('https://offline.invalid', state, () => {}, fetcher);
assert.equal(base.status, 'first-season-context-required');
const result = await fetchWorshipParts('https://offline.invalid', state, () => {}, fetcher, undefined, { localContext: local });
assert.equal(result.preparedPrintedBook, true); assert.equal(result.complete, false); assert.deepEqual(result.entries.flatMap(entry => entry.blocks), full.data.blocks);
for (const mutate of [
  async a => { a.data.acceptance.wholeMatinsAccepted = true; },
  async a => { a.data.localValues.currentAuthorityAttestation = true; },
  async a => { a.data.context.temple = 'nicholas'; },
  async a => { a.data.localValues.inputHash = '0'.repeat(64); },
  async a => { const block = a.data.operations[0].blocks.find(b => b.provenance?.bodyHash); block.segments[0].text += ' '; a.data.composedBlocksHash = await partsHash(a.data.operations[0].blocks); },
  async a => { const block = a.data.operations[0].blocks.find(b => b.provenance?.sourcePieces?.length === 1); block.segments[0].text += ' '; a.data.composedBlocksHash = await partsHash(a.data.operations[0].blocks); },
  async a => { const block = a.data.operations[0].blocks.find(b => b.provenance?.sourcePieces?.length === 1); block.segments[0].text += ' '; const range = block.provenance.sourcePieces[0].range || block.provenance.sourcePieces[0].sourceRange; range.length++; range.textSha256 = await textHash(block.segments.map(s => s.text).join('')); a.data.composedBlocksHash = await partsHash(a.data.operations[0].blocks); },
]) {
  const altered = structuredClone(assignments); await mutate(altered);
  let n = 0; await assert.rejects(() => fetchWorshipParts('https://offline.invalid', state, () => {}, async () => ++n === 1
    ? { status: 200, json: async () => template }
    : { status: 200, headers: new Headers({ 'cache-control': 'no-store, private' }), json: async () => altered }, undefined, { localContext: local }));
}
const restore = installReaderPdfDocument();
try {
  let snapshot, printed = false;
  const reader = renderWorshipReader({ state, create, formatDate: date => date, onChange() {}, onRetry() {}, onLocalSubmit() {}, print() { printed = true; }, pdfLoad: async () => ({ captureWorshipPdf, downloadWorshipPdf: async value => { snapshot = value; } }) });
  reader.render(base); assert.equal(reader.page.querySelectorAll('input').filter(x => x.type === 'text').length, 2);
  reader.render(result);
  await reader.page.querySelectorAll('button').find(button => button.textContent === 'Печать службы').events.click();
  await reader.page.querySelectorAll('button').find(button => button.textContent === 'Скачать PDF').events.click();
  const fonts = { civil: await readFile('public/fonts/DejaVuSerif.ttf'), cu: await readFile('public/fonts/Ponomar-Regular.ttf'), fallback: await readFile('public/fonts/DejaVuSans.ttf') };
  const pdf = await exportWorshipPdf(snapshot, { fontBytes: fonts });
  assert.ok(printed && snapshot.blocks.length && pdf.bytes.length);
  console.log(JSON.stringify({ blocks: full.data.blocks.length, snapshotBlocks: snapshot.blocks.length, pages: pdf.pageCount, negative: 7, actualBody: true })); reader.dispose();
} finally { restore(); }
