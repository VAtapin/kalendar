import { describe, expect, it, vi } from 'vitest';
import { createReaderPdfControls, loadReaderPdf } from '../public/calendar-ui/reader-pdf-controls.js';
import { create, descendants } from './fixtures/worship-dom.mjs';
import { createBookReader } from '../public/calendar-ui/book-reader.js';
import { libraryFixture } from './fixtures/book-library.mjs';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { composeParts } from '../public/calendar-ui/worship-parts.js';
import { templateFor, assignmentsFor } from './fixtures/worship-parts.mjs';

function setup(overrides = {}) {
  const host = create('div'); let token = 1, allowed = true;
  const snapshot = { kind: 'book', title: 'Source', information: [], blocks: [{ runs: [{ text: 'Exact source' }] }] };
  const downloadWorshipPdf = vi.fn(async () => ({}));
  const controls = createReaderPdfControls({ create, host, available: () => allowed, selection: () => token,
    getSnapshot: () => structuredClone(snapshot), load: async () => ({ downloadWorshipPdf }), ...overrides });
  const nodes = descendants(host);
  return { controls, snapshot, downloadWorshipPdf, change() { token++; controls.refresh(); }, unavailable() { allowed = false; controls.refresh(); },
    button: nodes.find(n => n.textContent === 'Скачать PDF'), cancel: nodes.find(n => n.textContent === 'Отменить подготовку PDF'), comment: nodes.find(n => n.tag === 'textarea'), status: nodes.find(n => n.tag === 'p') };
}
describe('reader PDF controls', () => {
  it('stays disabled until an entire reader snapshot is available, includes only an explicit comment', async () => {
    const ui = setup(); expect(ui.button.disabled).toBe(true); ui.controls.refresh(); expect(ui.button.disabled).toBe(false);
    ui.comment.value = 'My comment'; await ui.button.events.click();
    expect(ui.downloadWorshipPdf).toHaveBeenCalledOnce();
    const [snapshot] = ui.downloadWorshipPdf.mock.calls[0];
    expect(snapshot.information).toEqual(['Комментарий пользователя: My comment']); expect(ui.snapshot.information).toEqual([]);
    expect(snapshot.blocks[0].runs[0].text).toBe('Exact source'); expect(ui.cancel.hidden).toBe(true);
    ui.unavailable(); expect(ui.button.disabled).toBe(true); ui.controls.dispose(); expect(ui.comment.value).toBe('');
  });
  it('discards a lazy module arriving after selection change', async () => {
    let release; const downloadWorshipPdf = vi.fn(); const ui = setup({ load: () => new Promise(resolve => { release = resolve; }) });
    ui.controls.refresh(); const pending = ui.button.events.click(); ui.change(); release({ downloadWorshipPdf }); await pending;
    expect(downloadWorshipPdf).not.toHaveBeenCalled(); expect(ui.status.textContent).toBe('');
  });
  it('reports progress and aborts an active export on cancel, comment edit and disposal', async () => {
    for (const action of ['cancel', 'comment', 'dispose']) {
      let release, options; const ui = setup({ load: async () => ({ downloadWorshipPdf: async (_, __, value) => { options = value; value.onProgress(8, 100); await new Promise(resolve => { release = resolve; }); } }) });
      ui.controls.refresh(); const pending = ui.button.events.click(); await Promise.resolve();
      expect(ui.status.textContent).toContain('8 / 100');
      if (action === 'cancel') ui.cancel.events.click(); else if (action === 'comment') ui.comment.events.input(); else ui.controls.dispose();
      expect(options.signal.aborted).toBe(true); expect(options.isCurrent()).toBe(false); release(); await pending;
      expect(ui.status.textContent).not.toContain('PDF готов к скачиванию.');
    }
  });
  it('leaves retry enabled after a module error', async () => {
    const ui = setup({ load: async () => { throw new Error('offline'); } }); ui.controls.refresh(); await ui.button.events.click();
    expect(ui.status.textContent).toContain('Не удалось'); expect(ui.button.disabled).toBe(false);
  });
  it('rejects an external or non-versioned module manifest', async () => {
    const original = globalThis.fetch;
    try {
      for (const module of ['https://evil.example/code.js', '/calendar-ui/code.js']) {
        globalThis.fetch = async () => ({ ok: true, json: async () => ({ module }) });
        await expect(loadReaderPdf()).rejects.toThrow('Invalid PDF module');
      }
    } finally { globalThis.fetch = original; }
  });
  it('wires the book download to the exact displayed edition and no dated context', async () => {
    const f = libraryFixture(), downloadWorshipPdf = vi.fn(async () => ({}));
    const reader = createBookReader({ base: 'https://bible.example', state: { book: f.work.slug, edition: f.data.edition, date: '2027-12-24', temple: 'nicholas' }, create,
      onStateChange() {}, onCalendar() {}, yieldFrame: async () => {}, pdfLoad: async () => ({ downloadWorshipPdf }),
      fetcher: async url => ({ status: 200, json: async () => url.pathname.endsWith('/works') ? f.catalogue : { data: f.data } }) });
    const button = descendants(reader.page).find(n => n.textContent === 'Скачать PDF'); expect(button.disabled).toBe(true);
    await reader.start(); expect(button.disabled).toBe(false); await button.events.click();
    const [snapshot] = downloadWorshipPdf.mock.calls[0]; expect(snapshot.kind).toBe('book'); expect(snapshot.sourceMetadata.edition).toBe(f.data.edition);
    expect(JSON.stringify(snapshot)).not.toMatch(/2027-12-24|nicholas/); reader.dispose();
  });
  it('rejects a dated context change while its PDF module is loading', async () => {
    let release; const downloadWorshipPdf = vi.fn(), state = { office: 'third-hour', sequence: 'standalone', temple: 'nicholas', date: '2026-11-03' };
    const reader = renderWorshipReader({ state, create, formatDate: value => value, onChange() {}, onCalendar() {}, onRetry() {},
      pdfLoad: () => new Promise(resolve => { release = resolve; }) });
    const button = descendants(reader.page).find(n => n.textContent === 'Скачать PDF');
    reader.render({ status: 'parts', assignmentsStatus: 'loading', entries: [] }); expect(button.disabled).toBe(true);
    reader.render({ status: 'ready', language: 'cu', data: { blocks: [{ kind: 'text', segments: [{ text: 'Exact' }] }] } });
    const pending = button.events.click(); state.date = '2026-11-04'; release({ downloadWorshipPdf }); await pending;
    expect(downloadWorshipPdf).not.toHaveBeenCalled(); reader.dispose();
  });
  it('captures only the selected dated article, preserving partial status and separate conditional scope', async () => {
    const captureWorshipPdf = vi.fn((body, metadata) => ({ ...metadata, blocks: [{ runs: [{ text: 'Captured' }] }] })), downloadWorshipPdf = vi.fn(async () => ({}));
    const reader = renderWorshipReader({ state: { office: 'third-hour', sequence: 'standalone', temple: 'nicholas', date: '2026-11-03' }, create, formatDate: value => value,
      onChange() {}, onCalendar() {}, onRetry() {}, pdfLoad: async () => ({ captureWorshipPdf, downloadWorshipPdf }) });
    reader.render({ status: 'parts', assignmentsStatus: 'partial', entries: [{ language: 'cu', blocks: [{ kind: 'text', segments: [{ text: 'Exact displayed text' }] }] }] });
    await descendants(reader.page).find(n => n.textContent === 'Скачать PDF').events.click();
    expect(captureWorshipPdf.mock.calls[0][0].tag).toBe('article'); const [snapshot] = downloadWorshipPdf.mock.calls[0];
    expect(snapshot.kind).toBe('dated-service'); expect(snapshot.complete).toBe(false); expect(snapshot.warnings).not.toEqual([]);
    expect(snapshot.sourceMetadata.selection.date).toBe('2026-11-03'); reader.dispose();
  });
  it('keeps composed hymn provenance internal and omits the PDF bibliography', async () => {
    const state = { office: 'third-hour', sequence: 'standalone', temple: 'nicholas', date: '2026-11-03' };
    const template = templateFor(state.office), assignments = assignmentsFor(template, state);
    const source = { work: 'appointed-source', edition: 'cu-civil', language: 'cu-civil', sourceUrl: 'https://source.example/appointed' };
    assignments.operations.filter(operation => operation.type === 'fill').forEach(operation => { operation.blockSources = [source]; });
    const captureWorshipPdf = (_, metadata) => metadata, downloadWorshipPdf = vi.fn(async () => ({}));
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
    const reader = renderWorshipReader({ state, create, formatDate: value => value, onChange() {}, onCalendar() {}, onRetry() {},
      pdfLoad: async () => ({ captureWorshipPdf, downloadWorshipPdf }) });
    try {
      const result = await composeParts(template, assignments, state);
      expect(result.sourceVersions).toContainEqual(source);
      reader.render(result);
      await descendants(reader.page).find(node => node.textContent === 'Скачать PDF').events.click();
      expect(downloadWorshipPdf.mock.calls[0][0].sources).toEqual([]);
    } finally { reader.dispose(); vi.unstubAllGlobals(); }
  });
});
