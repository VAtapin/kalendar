import {ownerCapture} from './test-presanctified-owner-capture.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { PDFDocument, decodePDFRawStream } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { composePreparedPresanctified } from '../public/calendar-ui/worship-presanctified-prepared.js';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { create, installReaderPdfDocument } from '../tests/fixtures/reader-pdf-dom.mjs';
import { compactRepetitions, repetitionEntries, repetitionNumber } from '../public/calendar-ui/worship-repeats.js';
import { captureWorshipPdf, exportWorshipPdf } from '../src/export/worship-pdf-browser.ts';
const directory = process.argv[2]; assert.ok(directory);
const owner = await ownerCapture(directory), read = owner.read;
const request = await read('retry-request.http.json'), proposal = (await read('discovery-409.http.json')).preparedSourceProposal;
const template = (await read('public-template.http.json')).data, body = await read('private-prepared.http.json');
const state = { office: 'liturgy', rite: request.rite, date: request.date, temple: request.temple,
  midLentBranch: request.midLentBranch, textLanguage: 'cu', sequence: 'standalone', textSize: 22 };
const result = await composePreparedPresanctified(template, body, state, request, proposal);
result.preparedSourceProposal = proposal;
const restore = installReaderPdfDocument();
try {
  let snapshot, printed;
  const reader = renderWorshipReader({ state, create, formatDate: date => date, onChange() {}, onRetry() {},
    print() { printed = reader.page.querySelector('.worship-text'); },
    pdfLoad: async () => ({ captureWorshipPdf, downloadWorshipPdf: async value => { snapshot = value; } }) });
  reader.render(result);
  assert.equal(reader.page.querySelector('.worship-coverage').children[0].textContent, 'Полный текст выбранного печатного чина');
  assert.ok(!reader.page.textContent.includes('Полная служба дня'));
  assert.equal(reader.page.querySelectorAll('.worship-missing').length, 0);
  await reader.page.querySelectorAll('button').find(b => b.textContent === 'Печать службы').events.click();
  await reader.page.querySelectorAll('button').find(b => b.textContent === 'Скачать PDF').events.click();
  assert.ok(printed); assert.ok(snapshot); assert.equal(snapshot.kind, 'book'); assert.equal(snapshot.complete, true);
  assert.deepEqual(snapshot.sources, []); assert.deepEqual(snapshot.sourceMetadata.preparedContract, body.data);
  assert.deepEqual(snapshot.sourceMetadata.preparedSourceProposal, proposal);
  assert.equal(snapshot.status, 'Полный текст выбранного печатного чина');
  assert.equal(snapshot.subtitle, state.date);
  assert.ok(snapshot.information.some(text => text.includes('Имена: из вашего ввода.')));
  assert.ok(snapshot.information.every(text => !text.includes('местное совершение и расписание не подтверждены')));
  for (const flag of ['wholeLiturgyAccepted', 'wholeDatedServiceAccepted', 'dateAppointmentApproved',
    'actualPerformedSequenceConfirmed', 'actualLocalScheduleConfirmed', 'actualCurrentPeopleAsserted']) {
    assert.equal(snapshot.sourceMetadata.preparedContract[flag], false);
  }
  const expected = repetitionEntries(result.entries).flatMap(entry => compactRepetitions(entry.blocks).map(({ block, count }) =>
    (Number.isInteger(block.tone) && block.tone >= 1 && block.tone <= 8 ? 'Глас ' + block.tone : '')
    + block.segments.map(s => s.text).join('') + (count > 1 ? ' ' + repetitionNumber(count, 'cu') : '')));
  assert.deepEqual(snapshot.blocks.map(b => b.runs.map(r => r.text).join('')), expected);
  assert.deepEqual(captureWorshipPdf(printed, snapshot).blocks, snapshot.blocks);
  assert.ok(snapshot.blocks.some(b => b.role === 'deacon'));
  assert.ok(snapshot.blocks.some(b => b.origin === 'source-and-user'));
  for (const source of result.sourceVersions) for (const key of ['work', 'edition']) {
    if (source[key]?.length > 12) assert.ok(!reader.page.textContent.includes(source[key]));
  }
  const fonts = { civil: await readFile('public/fonts/DejaVuSerif.ttf'), cu: await readFile('public/fonts/Ponomar-Regular.ttf'),
    fallback: await readFile('public/fonts/DejaVuSans.ttf') };
  const faces = Object.values(fonts).map(bytes => fontkit.create(bytes)), graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const block of body.data.blocks) for (const segment of block.segments) for (const { segment: text } of graphemes.segment(segment.text)) {
    assert.ok(faces.some(face => [...text].every(c => /[\r\n\t]/.test(c) || face.hasGlyphForCodePoint(c.codePointAt(0)))), 'Uncovered native PDF grapheme');
  }
  const pdf = await exportWorshipPdf(snapshot, { fontBytes: fonts }), parsed = await PDFDocument.load(pdf.bytes), logical = [];
  assert.equal(parsed.getSubject(), undefined);
  for (const page of parsed.getPages()) for (const ref of page.node.Contents().asArray()) {
    const stream = Buffer.from(decodePDFRawStream(parsed.context.lookup(ref)).decode()).toString('latin1');
    for (const match of stream.matchAll(/\/ActualText\s*<([a-f0-9]+)>\s*\/KalendarBody\s+true/gi)) {
      logical.push(Buffer.from(match[1], 'hex').swap16().toString('utf16le').replace(/^\ufeff/, ''));
    }
  }
  const normalize = text => text.replace(/\s/g, ''); assert.equal(normalize(logical.join('')), normalize(expected.join('')));
  if (process.argv.includes('--pdf')) {
    await mkdir('tmp/pdfs', { recursive: true }); await writeFile('tmp/pdfs/presanctified-first-printed.pdf', pdf.bytes);
  }
  reader.dispose();
  console.log(JSON.stringify({ nativeBlocks: body.data.blocks.length, capturedBlocks: snapshot.blocks.length,
    pages: pdf.pageCount, unicodeParity: true, glyphCoverage: true, sourceHidden: true, falseAdmissionFlagsPreserved: true, published: false }));
} finally { restore(); }
