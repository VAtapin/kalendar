import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBookReader } from '../public/calendar-ui/book-reader.js';
import { libraryFixture, octoechosFixture } from './fixtures/book-library.mjs';
import { create, descendants } from './fixtures/worship-dom.mjs';

afterEach(() => vi.unstubAllGlobals());
function reader(f = libraryFixture(), options = {}) {
  const state = { book: f.work.slug, edition: f.data.edition, bookGroup: 'minea', bookMonth: '', bookDay: '', bookTone: '', bookWeekday: '', textSize: 22, date: '2027-12-24', temple: 'nicholas', ...options.state };
  const fetcher = options.fetcher || (async url => ({ status: 200, json: async () => url.pathname.endsWith('/works') ? f.catalogue : { data: f.data } }));
  const instance = createBookReader({ base: 'https://bible.example', create, onStateChange() {}, onCalendar() {}, yieldFrame: async () => {}, ...options, state, fetcher });
  return { instance, state, nodes: () => descendants(instance.page) };
}
describe('book mode reader and document snapshot', () => {
  it('defaults to a small day section and persists next/previous selections for deep links and Back', async () => {
    const changes=[], f=octoechosFixture(), ui=reader(f,{ onStateChange: (values,options)=>changes.push({values,options}) }); await ui.instance.start();
    const first=ui.instance.getDocument(); expect(first.blocks.length).toBeLessThan(6);expect(first.sourceMetadata.selection.tone).toBe('1');
    const next=ui.nodes().find(n=>n.textContent==='Следующий раздел →'); await next.events.click();
    const second=ui.instance.getDocument();expect(second.sourceMetadata.selection.part).not.toBe(first.sourceMetadata.selection.part);
    expect(changes.some(change=>change.options?.history===true && change.values.bookPart===second.sourceMetadata.selection.part)).toBe(true);
    await ui.nodes().find(n=>n.textContent==='← Предыдущий раздел').events.click();expect(ui.instance.getDocument()).toEqual(first);
    const reloaded=reader(f,{state:{bookPart:second.sourceMetadata.selection.part}});await reloaded.instance.start();expect(reloaded.instance.getDocument()).toEqual(second);
    expect(ui.nodes().some(n=>n.dataset.bookSection===first.sourceMetadata.selection.part)).toBe(true);
    const tone=ui.nodes().find(n=>n.dataset.bookControl==='bookTone');tone.value='8';await tone.events.change();
    const weekday=ui.nodes().find(n=>n.dataset.bookControl==='bookWeekday');weekday.value='1';await weekday.events.change();
    expect(ui.instance.getDocument().sourceMetadata.selection).toMatchObject({tone:'8',weekday:'1'});
    ui.instance.dispose();reloaded.instance.dispose();
  });
  it('discards an older section render and exports only the completed current section to PDF and print', async () => {
    const releases=[], print=vi.fn(), downloads=vi.fn(async()=>({}));
    const ui=reader(octoechosFixture(),{yieldFrame:()=>new Promise(resolve=>releases.push(resolve)),print,pdfLoad:async()=>({downloadWorshipPdf:downloads})});
    const starting=ui.instance.start();await new Promise(resolve=>setTimeout(resolve,0));expect(ui.instance.getDocument()).toBeNull();
    const tone=ui.nodes().find(n=>n.dataset.bookControl==='bookTone');tone.value='8';const changed=tone.events.change();
    expect(ui.nodes().find(n=>n.textContent==='Скачать PDF').disabled).toBe(true);
    releases[0]();await starting;expect(ui.instance.getDocument()).toBeNull();releases[1]();await changed;
    const snapshot=ui.instance.getDocument();expect(snapshot.sourceMetadata.selection.tone).toBe('8');
    await ui.nodes().find(n=>n.textContent==='Скачать PDF').events.click();expect(downloads.mock.calls[0][0]).toEqual(snapshot);
    vi.stubGlobal('document',{fonts:{ready:Promise.resolve()}});await ui.nodes().find(n=>n.textContent==='Печать открытого текста').events.click();expect(print).toHaveBeenCalledOnce();
    ui.instance.dispose();
  });

  it('preserves native text, rubrics and source edition without daily-service warnings or slots', async () => {
    const f = libraryFixture(), ui = reader(f); await ui.instance.start();
    const snapshot = ui.instance.getDocument();
    expect(snapshot.kind).toBe('book'); expect(snapshot.warnings).toEqual([]);
    expect(snapshot.status).toBe('Книжный источник'); expect(snapshot.sourceMetadata.edition).toBe(f.data.edition);
    expect(snapshot.blocks.flatMap(block => block.runs.map(run => run.text))).toEqual(f.data.blocks.flatMap(block => block.segments.map(segment => segment.text)));
    expect(snapshot.blocks[0].runs[0].rubric).toBe(true);
    expect(JSON.stringify(snapshot)).not.toMatch(/2027-12-24|nicholas|missing|partial|служба дня|не подтвержден/);
    expect(ui.nodes().some(node => node.className === 'worship-missing')).toBe(false);
    expect(ui.nodes().some(node => node.dataset.textLanguage === 'cu')).toBe(true);
    expect(ui.nodes().find(node => node.tag === 'h2' && node.textContent === f.data.title).dataset.textLanguage).toBe('cu');
    snapshot.blocks[0].runs[0].text = 'mutated'; expect(ui.instance.getDocument().blocks[0].runs[0].text).toBe(f.data.blocks[0].text);
    ui.instance.dispose();
  });
  it('refuses a linked edition absent from the public catalogue rather than choosing a public sibling', async () => {
    let calls = 0; const f = libraryFixture();
    const ui = reader(f, { state: { edition: 'private-edition' }, fetcher: async () => { calls++; return { status: 200, json: async () => f.catalogue }; } });
    await ui.instance.start(); expect(calls).toBe(1); expect(ui.instance.getDocument()).toBeNull();
  });
  it('does not render a partial long document or enable print while blocks are still being added', async () => {
    let release; const ui = reader(libraryFixture(undefined, 241), { yieldFrame: () => new Promise(resolve => { release = resolve; }) });
    const pending = ui.instance.start(); await new Promise(resolve => setTimeout(resolve, 0));
    expect(ui.instance.getDocument()).toBeNull();
    expect(ui.nodes().find(node => node.textContent === 'Печать открытого текста').disabled).toBe(true);
    ui.instance.dispose(); release(); await pending; expect(ui.instance.getDocument()).toBeNull();
  });
  it('captures only a selected day section, excluding other services and appendices', async () => {
    const f = octoechosFixture(), ui = reader(f, { state: { bookTone: '8', bookWeekday: '1' } }); await ui.instance.start();
    const snapshot = ui.instance.getDocument();
    expect(snapshot.sourceMetadata.selection.tone).toBe('8'); expect(snapshot.sourceMetadata.selection.weekday).toBe('1');
    expect(snapshot.blocks).toHaveLength(3); expect(snapshot.information).toContain('Открыт только выбранный книжный раздел. Печать и PDF сохраняют этот же объём.');
    expect(snapshot.warnings).toEqual([]); ui.instance.dispose();
  });
  it('waits for fonts and cancels a pending print when a different book filter is chosen', async () => {
    let fontsReady; vi.stubGlobal('document', { fonts: { ready: new Promise(resolve => { fontsReady = resolve; }) } });
    const print = vi.fn(), ui = reader(libraryFixture(), { print }); await ui.instance.start();
    const button = ui.nodes().find(node => node.textContent === 'Печать открытого текста'); const pending = button.events.click();
    expect(print).not.toHaveBeenCalled();
    const group = ui.nodes().find(node => node.dataset.bookControl === 'bookGroup'); group.value = 'other'; group.events.change();
    fontsReady(); await pending; expect(print).not.toHaveBeenCalled(); expect(ui.instance.getDocument()).toBeNull(); ui.instance.dispose();
  });
  it('never translates source words with the UI dictionary', async () => {
    const f = libraryFixture(), translated = (tag, text, className) => create(tag, text === 'Заголо́вокъ' ? 'wrong source translation' : text, className);
    const ui = reader(f, { create: translated }); await ui.instance.start();
    expect(ui.nodes().map(node => node.textContent)).toContain('Заголо́вокъ'); expect(ui.nodes().map(node => node.textContent)).not.toContain('wrong source translation'); ui.instance.dispose();
  });
  it('prints the fully rendered body after fonts are ready', async () => {
    let fontsReady; vi.stubGlobal('document', { fonts: { ready: new Promise(resolve => { fontsReady = resolve; }) } });
    const print = vi.fn(), ui = reader(libraryFixture(), { print }); await ui.instance.start();
    const body = ui.nodes().find(node => node.tag === 'article'), button = ui.nodes().find(node => node.textContent === 'Печать открытого текста');
    const pending = button.events.click(); expect(print).not.toHaveBeenCalled(); fontsReady(); await pending;
    expect(print).toHaveBeenCalledOnce(); expect(ui.nodes()).toContain(body); ui.instance.dispose();
  });
  it('ignores an older book reply after another exact edition is opened', async () => {
    const a = libraryFixture('book-a'), b = libraryFixture('book-b'); b.data.title = b.work.title = 'Вторая книга';
    let replyA, signalA;
    const ui = reader(a, { fetcher: async (url, options) => {
      if (url.pathname.endsWith('/works')) return { status: 200, json: async () => ({ data: [a.work, b.work] }) };
      if (url.pathname.includes('/book-a/')) { signalA = options.signal; return new Promise(resolve => { replyA = () => resolve({ status: 200, json: async () => ({ data: a.data }) }); }); }
      return { status: 200, json: async () => ({ data: b.data }) };
    } });
    const pending = ui.instance.start(); await new Promise(resolve => setTimeout(resolve, 0));
    ui.nodes().find(node => node.dataset.bookSlug === 'book-b').events.click(); await new Promise(resolve => setTimeout(resolve, 0));
    expect(signalA.aborted).toBe(true); replyA(); await pending;
    expect(ui.instance.getDocument().sourceMetadata.slug).toBe('book-b'); expect(ui.instance.getDocument().title).toBe('Вторая книга'); ui.instance.dispose();
  });
});
