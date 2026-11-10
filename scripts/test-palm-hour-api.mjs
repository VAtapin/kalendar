// Replay local BibleDesktop JSON bodies; the ordinary-template 422 is emulated from its controller contract.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fetchWorshipParts, composeParts, partsHash } from '../public/calendar-ui/worship-parts.js';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { create, installReaderPdfDocument } from '../tests/fixtures/reader-pdf-dom.mjs';
import { captureWorshipPdf, exportWorshipPdf } from '../src/export/worship-pdf-browser.ts';
const directory = process.argv[2]; assert.ok(directory, 'Pass the local capture directory');
const hashes = { template: '26fe096025135021a996eed72d4b1a02cba1fc3df3ea70f3b7d0ec00fece2414', assignments: '61c46e881726a3aa360f0cc37c56a1af093337ba56beb87946b5aa3657abf15a', full: 'ed8225809893a08efda680d520d6d038b5c589d3701a242a51299e7808fc2b3b' };
const read = async name => { const bytes = await readFile(`${directory}/palm-hour-${name}.json`); assert.equal(createHash('sha256').update(bytes).digest('hex'), hashes[name]); return JSON.parse(bytes); };
const template = await read('template'), assignments = await read('assignments'), full = await read('full');
const state = { office: 'first-hour', date: '2026-04-05', temple: 'george-victorious', sequence: 'after-matins', afterHourHymn: 'none', textLanguage: 'cu', textSize: 22 };
let calls = 0;
const result = await fetchWorshipParts('https://offline.invalid', state, () => {}, async url => {
  calls++;
  if (calls === 1) {
    assert.equal(url.searchParams.get('date'), state.date);
    return { status: 422, json: async () => ({ errors: Object.fromEntries(['date', 'temple', 'calendarStyle'].map(key => [key, ['Unsupported Hour parts parameter.']])) }) };
  }
  return { status: 200, json: async () => url.pathname.includes('/templates/') ? template : assignments };
});
assert.equal(calls, 3); assert.equal(result.complete, true);
assert.deepEqual(result.entries.flatMap(entry => entry.blocks || []), full.data.blocks);
for (const change of [
  a => { a.operations.find(op => op.type === 'replace' && op.blocks).blocks[0].segments[0].text += ' '; },
  a => { a.operations.find(op => op.type === 'replace' && op.blocks).blocks[0].provenance.sourceRange.textSha256 = '0'.repeat(64); },
  a => { a.operations.find(op => op.type === 'replace' && op.blocks).nodeId = a.operations.find(op => op.type === 'replace' && op.blockMetadata).nodeId; },
]) {
  const changed = structuredClone(assignments.data); change(changed);
  // Also update the outer hash: source checks must still reject replacement changes.
  const replacement = changed.operations.find(op => op.type === 'replace' && op.blocks).blocks[0];
  changed.composedBlocksHash = await partsHash(full.data.blocks.map(block => block.occurrenceId === replacement.occurrenceId ? replacement : block));
  await assert.rejects(() => composeParts(template.data, changed, state));
}
const restore = installReaderPdfDocument();
try {
  let printed = false, snapshot;
  const reader = renderWorshipReader({ state, create, formatDate: date => date, onChange() {}, onRetry() {}, print() { printed = true; }, pdfLoad: async () => ({ captureWorshipPdf, downloadWorshipPdf: async value => { snapshot = value; } }) });
  reader.render(result);
  await reader.page.querySelectorAll('button').find(button => button.textContent === 'Печать службы').events.click();
  await reader.page.querySelectorAll('button').find(button => button.textContent === 'Скачать PDF').events.click();
  const fonts = { civil: await readFile('public/fonts/DejaVuSerif.ttf'), cu: await readFile('public/fonts/Ponomar-Regular.ttf'), fallback: await readFile('public/fonts/DejaVuSans.ttf') };
  const pdf = await exportWorshipPdf(snapshot, { fontBytes: fonts }); assert.ok(printed && snapshot.blocks.length && pdf.bytes.length);
  console.log(JSON.stringify({ blocks: full.data.blocks.length, snapshotBlocks: snapshot.blocks.length, pdfPages: pdf.pageCount, negatives: 3 }));
  reader.dispose();
} finally { restore(); }
