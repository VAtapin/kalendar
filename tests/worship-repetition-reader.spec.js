import { describe, expect, it } from 'vitest';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { create, installReaderPdfDocument } from './fixtures/reader-pdf-dom.mjs';
import { captureWorshipPdf } from '../src/export/worship-pdf-browser';

describe('repetitions in the reader, print and PDF', () => {
  it('uses one unchanged prayer and a red Slavonic count in all three', async () => {
    const restore = installReaderPdfDocument();
    try {
      const state = { office: 'first-hour', date: '2026-03-03', temple: 'george-victorious', sequence: 'after-matins', textLanguage: 'cu', textSize: 22 };
      const text = 'Господи, помилуй.', count = 12;
      const blocks = Array.from({ length: count }, (_, i) => ({ kind: 'text', role: 'reader', slot: 'fixed:mercy', segments: [{ text, style: 'text' }], provenance: { work: 'test', block: 1 }, occurrenceId: 'repeat:0:' + i, repeatIndex: i + 1, repeatCount: count }));
      const original = structuredClone(blocks), entries = blocks.map(block => ({ kind: 'fixed', role: 'reader', language: 'cu', blocks: [block] }));
      let snapshot, printed = false;
      const reader = renderWorshipReader({ state, create, formatDate: date => date, onChange() {}, onRetry() {}, print() { printed = true; }, pdfLoad: async () => ({ captureWorshipPdf, downloadWorshipPdf: async value => { snapshot = value; } }) });
      reader.render({ status: 'parts', preparedPrintedBook: true, template: {}, entries, assignmentsStatus: 'complete' });
      const lines = reader.page.querySelectorAll('p').filter(node => node.dataset.repeatCount);
      expect(lines).toHaveLength(1); expect(lines[0].textContent).toBe(text + ' в҃і');
      expect(lines[0].querySelector('.repetition-number').classList.contains('rubric')).toBe(true);
      await reader.page.querySelectorAll('button').find(button => button.textContent === 'Печать службы').events.click();
      await reader.page.querySelectorAll('button').find(button => button.textContent === 'Скачать PDF').events.click();
      expect(printed).toBe(true); expect(blocks).toEqual(original);
      expect(snapshot.blocks).toHaveLength(1);
      expect(snapshot.blocks[0].runs).toContainEqual({ text: 'в҃і', rubric: true, language: 'cu' });
      expect(snapshot.blocks[0].runs.map(run => run.text).join('')).toBe(text + ' в҃і');
      reader.dispose();
    } finally { restore(); }
  });
});
