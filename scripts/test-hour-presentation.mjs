// Replay one locally captured ordinary Hour; no network or fabricated positive response.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { PDFDocument, decodePDFRawStream } from 'pdf-lib';
import { fetchWorshipParts } from '../public/calendar-ui/worship-parts.js';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { create, installReaderPdfDocument } from '../tests/fixtures/reader-pdf-dom.mjs';
import { captureWorshipPdf, exportWorshipPdf } from '../src/export/worship-pdf-browser.ts';
const dir = process.argv[2]; assert.ok(dir, 'Pass the local capture directory');
const read = async name => JSON.parse(await readFile(`${dir}/season-2026-06-27-${name}.json`));
const template = await read('template'), assignments = await read('assignments');
const state = { office: 'third-hour', date: '2026-06-27', temple: 'george-victorious', sequence: 'standalone', textLanguage: 'cu', textSize: 16 };
const result = await fetchWorshipParts('https://offline.invalid', state, () => {}, async url => ({ status: 200, json: async () => url.pathname.includes('/templates/') ? template : assignments }));
assert.equal(result.complete, true); assert.equal(result.entries.filter(entry => entry.variableSlotId).length, 6);
const restore = installReaderPdfDocument();
try {
  let snapshot, printed = false;
  const reader = renderWorshipReader({ state, create, formatDate: date => date, onChange() {}, onRetry() {}, print() { printed = true; }, pdfLoad: async () => ({ captureWorshipPdf, downloadWorshipPdf: async value => { snapshot = value; } }) });
  reader.render(result);
  const boxes = reader.page.querySelectorAll('.worship-variable'); assert.equal(boxes.length, 3);
  assert.ok(boxes.every(box => box.querySelector('h3') && box.querySelector('p')));
  await reader.page.querySelectorAll('button').find(button => button.textContent === 'Печать службы').events.click();
  await reader.page.querySelectorAll('button').find(button => button.textContent === 'Скачать PDF').events.click();
  assert.equal(printed, true); assert.equal(new Set(snapshot.blocks.map(block => block.variableGroup).filter(Boolean)).size, 3);
  const fonts = { civil: await readFile('public/fonts/DejaVuSerif.ttf'), cu: await readFile('public/fonts/Ponomar-Regular.ttf'), fallback: await readFile('public/fonts/DejaVuSans.ttf') };
  const exported = await exportWorshipPdf(snapshot, { fontBytes: fonts });
  if (process.argv.includes('--pdf')) await writeFile('tmp/pdfs/hour-presentation-review.pdf', exported.bytes);
  const pdf = await PDFDocument.load(exported.bytes); let borders = 0;
  for (const page of pdf.getPages()) for (const ref of page.node.Contents().asArray()) {
    const stream = Buffer.from(decodePDFRawStream(pdf.context.lookup(ref)).decode()).toString('latin1');
    borders += [...stream.matchAll(/0\.5 w\s+\[\] 0 d/g)].length;
  }
  assert.ok(borders >= 3); console.log(JSON.stringify({ frames: boxes.length, pdfBorders: borders, pages: pdf.getPageCount(), actualBody: true })); reader.dispose();
} finally { restore(); }
