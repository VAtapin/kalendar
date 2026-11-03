import { readFileSync } from 'node:fs';
import { PDFDocument, PDFName, PDFPage } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { exportWorshipPdf, StaleWorshipPdfError, type WorshipPdfSnapshot } from '../src/export/worship-pdf';

const fontBytes = { civil: readFileSync('public/fonts/DejaVuSerif.ttf'), cu: readFileSync('public/fonts/Ponomar-Regular.ttf'), fallback: readFileSync('public/fonts/DejaVuSans.ttf') };
function fixture(): WorshipPdfSnapshot {
  return { kind: 'dated-service', title: 'Reader export', information: ['Selection 2026-11-03'], status: 'Partial source', complete: false,
    warnings: ['Assignments remain unconfirmed.'], sources: ['Test fixture, not a service.'],
    labels: { contents: 'Contents', sources: 'Source', incomplete: 'Not a complete appointed service', page: 'Page' },
    blocks: [
      { kind: 'heading', runs: [{ text: 'CU / civil' }] },
      { kind: 'paragraph', language: 'cu', role: 'priest', origin: 'user-provided', runs: [{ text: 'сꙋббѡ́та і҆аннꙋарїй гдⷭ҇а Бл҃говѣ́щенїе' }] },
      { kind: 'paragraph', language: 'cu-civil', runs: [{ text: 'Иерей: ' }, { text: 'І҆ѡа́ннъ', rubric: true }, { text: ' (3)\nDeutsch: Größe; Українська: їєґ; Polski: święty.' }] },
      { kind: 'warning', runs: [{ text: 'Unresolved required place' }] },
    ] };
}
describe('real worship PDF export', () => {
  it('draws the Orthodox cross with four vector lines and never prints provenance, even from older snapshots', async () => {
    const lines = vi.spyOn(PDFPage.prototype, 'drawLine');
    const source = fixture(); source.sources = ['https://source.example/private-edition'];
    source.sourceMetadata = { work: 'internal-work', edition: 'internal-edition' };
    try {
      const result = await exportWorshipPdf(source, { fontBytes, collectPlacements: true });
      const pdf = await PDFDocument.load(result.bytes);
      expect(pdf.getSubject()).toBeUndefined();
      const text = result.placements.map(placement => placement.text).join('');
      expect(text).not.toContain(source.sources[0]); expect(text).not.toContain(source.labels.sources);
      const cross = lines.mock.calls.slice(0, 4).map(([line]) => line!);
      expect(cross).toHaveLength(4);
      expect(cross[0]!.start.x).toBe(cross[0]!.end.x);
      expect(cross[1]!.start.y).toBe(cross[1]!.end.y);
      expect(cross[2]!.end.x - cross[2]!.start.x).toBeGreaterThan(cross[1]!.end.x - cross[1]!.start.x);
      expect(cross[3]!.start.y).toBeGreaterThan(cross[3]!.end.y);
    } finally { lines.mockRestore(); }
  });
  it('supports a native CU book title and exposes cancellable block progress', async () => {
    const source = fixture(); source.kind = 'book'; source.title = 'Ѻ҆ктѡ́ихъ'; source.titleLanguage = 'cu';
    const onProgress = vi.fn(); const result = await exportWorshipPdf(source, { fontBytes, onProgress, collectPlacements: true });
    expect(result.placements.map(p => p.text).join('')).toContain(source.title);
    expect(onProgress).toHaveBeenLastCalledWith(source.blocks.length, source.blocks.length);
  });

  it('embeds fonts, Unicode logical text, links and bookmarks on a compact A4 page', async () => {
    const result = await exportWorshipPdf(fixture(), { fontBytes, collectPlacements: true });
    const pdf = await PDFDocument.load(result.bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.276);
    expect(pdf.catalog.get(PDFName.of('Outlines'))).toBeDefined();
    expect(pdf.getPage(0).node.Annots()?.size()).toBe(1);
    const text = result.placements.map(p => p.text).join('');
    expect(text).toContain('Not a complete appointed service');
    expect(text).toContain('сꙋббѡ́та і҆аннꙋарїй гдⷭ҇а Бл҃говѣ́щенїе');
    expect(text).toContain('І҆ѡа́ннъ');
    for (const p of result.placements) {
      expect(p.x).toBeGreaterThanOrEqual(46);
      expect(p.x + p.width).toBeLessThanOrEqual(549.277);
      expect(p.y).toBeGreaterThanOrEqual(49);
      expect(p.y + p.size).toBeLessThan(796);
    }
  });
  it('paginates a large block and unbroken graphemes without truncating text', async () => {
    const source = fixture();
    const text = ('сло́во '.repeat(450) + 'а́'.repeat(180) + '\n').repeat(4);
    source.blocks = [{ kind: 'paragraph', language: 'cu', runs: [{ text }] }];
    const result = await exportWorshipPdf(source, { fontBytes, collectPlacements: true });
    expect(result.pageCount).toBeGreaterThan(2);
    const output = result.placements.filter(p => p.size === 12).map(p => p.text).join('');
    expect(output).toBe(text.replace(/\n/g, ''));
    expect(result.placements.every(p => p.x + p.width <= 549.277 && p.y >= 49)).toBe(true);
  }, 30_000);
  it('stops a stale selection before font loading and during a long export', async () => {
    await expect(exportWorshipPdf(fixture(), { fontBytes, isCurrent: () => false })).rejects.toBeInstanceOf(StaleWorshipPdfError);
    const source = fixture(); source.blocks = Array.from({ length: 70 }, () => source.blocks[1]!);
    let current = true;
    await expect(exportWorshipPdf(source, { fontBytes, isCurrent: () => current, yieldControl: async () => { current = false; } })).rejects.toBeInstanceOf(StaleWorshipPdfError);
  });
  it('honors AbortSignal through its default macrotask yields', async () => {
    const source = fixture(); source.blocks = Array.from({ length: 100 }, () => source.blocks[1]!);
    const controller = new AbortController();
    const pending = exportWorshipPdf(source, { fontBytes, signal: controller.signal });
    setTimeout(() => controller.abort(), 0);
    await expect(pending).rejects.toBeInstanceOf(StaleWorshipPdfError);
  });
  it('discards a PDF if selection changes during save', async () => {
    let current = true;
    const original = PDFDocument.prototype.save;
    const save = vi.spyOn(PDFDocument.prototype, 'save').mockImplementation(async function (this: PDFDocument, options) {
      const bytes = await original.call(this, options); current = false; return bytes;
    });
    try {
      await expect(exportWorshipPdf(fixture(), { fontBytes, isCurrent: () => current })).rejects.toBeInstanceOf(StaleWorshipPdfError);
    } finally { save.mockRestore(); }
  });
  it('does not confuse a whole source book with an incomplete daily service', async () => {
    const source = fixture(); source.kind = 'book'; source.status = 'Whole source book'; source.warnings = [];
    const result = await exportWorshipPdf(source, { fontBytes, collectPlacements: true });
    const text = result.placements.map(p => p.text).join('');
    expect(text).toContain('Whole source book');
    expect(text).not.toContain('Not a complete appointed service');
  });
  it('omits the appended catalogue edition from the book heading and PDF title', async () => {
    const source = fixture(); source.kind = 'book';
    source.sources = [];
    source.title = 'Октоих (' + 'Полное церковнославянское издание '.repeat(8) + 'Ponomar)';
    const result = await exportWorshipPdf(source, { fontBytes, collectPlacements: true });
    const pdf = await PDFDocument.load(result.bytes);
    expect(pdf.getTitle()).toBe('Октоих');
    const title = result.placements.filter(p => p.size === 20);
    expect(title.map(p => p.text).join('')).toBe('Октоих');
    expect(result.placements.filter(p => p.size === 11)).toEqual([]);
    expect(result.placements.every(p => p.x + p.width <= 549.277)).toBe(true);
  });
  it('captures immutable input before its asynchronous work and rejects unsupported glyphs', async () => {
    const source = fixture();
    const pending = exportWorshipPdf(source, { fontBytes, collectPlacements: true });
    source.blocks[1]!.runs[0]!.text = 'Changed after click';
    const result = await pending;
    expect(result.placements.map(p => p.text).join('')).not.toContain('Changed after click');
    source.blocks[1]!.runs[0]!.text = '\u{10ffff}';
    await expect(exportWorshipPdf(source, { fontBytes })).rejects.toThrow('PDF font lacks Unicode');
  });
});
