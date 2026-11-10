import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { readFileSync } from 'node:fs';

import { create, descendants } from './fixtures/worship-dom.mjs';
import { additionalLiturgy } from './fixtures/additional-liturgy.mjs';
import { localLiturgy } from './fixtures/local-liturgy.mjs';
import { fetchWorshipParts } from '../public/calendar-ui/worship-parts.js';

const state = { office: 'third-hour', date: '2026-11-02', temple: 'nicholas', sequence: 'standalone', textLanguage: 'cu', textSize: 22 };
const ready = { status: 'ready', language: 'cu', data: { blocks: [{ kind: 'text', segments: [{ text: 'Exact API body' }] }] } };
afterEach(() => vi.unstubAllGlobals());
describe('printing the displayed worship body', () => {
  it('uses A4 margins and a fixed print size, hiding the outer calendar controls', () => {
    const css = readFileSync(new URL('../public/calendar-ui/web-calendar.css', import.meta.url), 'utf8');
    expect(css).toMatch(/@page worship\s*\{\s*size: A4;\s*margin: 16mm;/);
    expect(css).toContain('page: worship;');
    expect(css).toContain('--reader-size: var(--reader-print-size, 16pt) !important;');
    expect(css).toContain('.worship-block { white-space: pre-wrap; margin: 0; }');
    expect(css).toContain('font-size: 2em; line-height: 1.8;');
    expect(css).toContain('.worship-text .worship-part[data-text-language="cu"] { font-size: 2em; }');
    expect(css).toContain('body:has(.worship-page) main > :not(.shell)');
    expect(css).toContain('.worship-controls, .worship-navigation');
    expect(css.slice(css.indexOf('@media print'))).toContain('.calendar-hour-hymns');
  });
  function setup(isCurrent = () => true, selected = state, callbacks = {}) {
    let fontsReady;
    vi.stubGlobal('document', { fonts: { ready: new Promise(resolve => { fontsReady = resolve; }) } });
    const print = vi.fn(), reader = renderWorshipReader({ state: { ...selected }, create, formatDate: date => date,
      onChange() {}, onCalendar() {}, onRetry() {}, isCurrent, print, ...callbacks });
    const button = descendants(reader.page).find(node => node.className.includes('worship-print'));
    return { reader, button, print, fontsReady };
  }
  it('waits for fonts and prints the same body with selected date, service and temple', async () => {
    const { reader, button, print, fontsReady } = setup();
    expect(button.disabled).toBe(true);
    reader.render(ready);
    const body = descendants(reader.page).find(node => node.tag === 'article');
    const pending = button.events.click();
    expect(print).not.toHaveBeenCalled();
    fontsReady(); await pending;
    expect(print).toHaveBeenCalledOnce();
    expect(descendants(reader.page).find(node => node.tag === 'article')).toBe(body);
    const texts = descendants(reader.page).map(node => node.textContent);
    expect(texts).toEqual(expect.arrayContaining(['Exact API body', '2026-11-02', 'Третий час', 'Храм святителя Николая']));
  });
  it.each(['selection', 'dispose', 'render'])('does not print after %s changes while fonts load', async change => {
    let current = true;
    const { reader, button, print, fontsReady } = setup(() => current);
    reader.render(ready);
    const pending = button.events.click();
    if (change === 'selection') current = false;
    if (change === 'dispose') reader.dispose();
    if (change === 'render') reader.render({ status: 'error' });
    fontsReady(); await pending;
    expect(print).not.toHaveBeenCalled();
  });
  it('disables printing until daily assignments settle and retains partial notices', () => {
    const { reader, button } = setup();
    const partial = { status: 'parts', entries: [{ language: 'cu', blocks: ready.data.blocks }], assignmentsStatus: 'loading' };
    reader.render(partial); expect(button.disabled).toBe(true);
    reader.render({ ...partial, assignmentsStatus: 'partial' }); expect(button.disabled).toBe(false);
    expect(descendants(reader.page).some(node => node.textContent.includes('полный порядок этого дня пока не подтверждён'))).toBe(true);
  });
  it('opens service appendices for printing and restores their previous state', async () => {
    const { reader, button, print, fontsReady } = setup();
    reader.render(ready);
    const content = descendants(reader.page).find(node => node.className === 'worship-content');
    const appendix = create('details'); appendix.open = false; content.append(appendix);
    const pending = button.events.click();
    expect(appendix.open).toBe(true);
    print.mockImplementation(() => expect(appendix.open).toBe(true));
    fontsReady(); await pending;
    expect(appendix.open).toBe(false);
  });
  it('changes the date in the reader and rejects an impossible date', () => {
    const onChange = vi.fn();
    const reader = renderWorshipReader({ state, create, formatDate: date => date, onChange });
    const date = descendants(reader.page).find(node => node.dataset.worshipControl === 'date');
    date.value = '2027-01-01'; date.events.change();
    expect(onChange).toHaveBeenCalledWith('date', '2027-01-01');
    onChange.mockClear(); date.value = '2026-02-29'; date.events.change();
    expect(onChange).not.toHaveBeenCalled(); expect(date.value).toBe(state.date);
  });
  it('prints an additional Liturgy basis with its rite and gaps while leaving unselected variants closed', async () => {
    const fixture = additionalLiturgy('presanctified', 'from-mid-lent-wednesday');
    const result = await fetchWorshipParts('https://bible.example', fixture.state, () => {}, async url => ({ status: 200,
      json: async () => ({ data: url.pathname.includes('/templates/') ? fixture.template : fixture.assignments }) }));
    const { reader, button, print, fontsReady } = setup(() => true, fixture.state);
    reader.render(result);
    const nodes = descendants(reader.page), variants = nodes.find(node => node.className === 'worship-conditional');
    variants.open = false;
    const pending = button.events.click(); fontsReady(); await pending;
    expect(print).toHaveBeenCalledOnce(); expect(variants.open).toBe(false);
    expect(nodes.map(node => node.textContent)).toEqual(expect.arrayContaining([
      'Литургия Преждеосвященных Даров', 'Начиная со средопостной среды',
      'Постоянная основа — назначения дня не подтверждены', 'Fixed source words',
    ]));
    expect(nodes.filter(node => node.className === 'worship-missing')).toHaveLength(2);
    expect(nodes.some(node => node.dataset.worshipControl === 'temple')).toBe(false);
    expect(nodes.some(node => node.dataset.worshipControl === 'midLentBranch')).toBe(true);
  });
  it('does not translate conditional source words through the UI dictionary', async () => {
    const fixture = additionalLiturgy();
    const result = await fetchWorshipParts('https://bible.example', fixture.state, () => {}, async url => ({ status: 200,
      json: async () => ({ data: url.pathname.includes('/templates/') ? fixture.template : fixture.assignments }) }));
    const translatedCreate = (tag, text, className) => create(tag, text === 'Unselected variant words' ? 'Wrong translated source' : text, className);
    const reader = renderWorshipReader({ state: fixture.state, create: translatedCreate, formatDate: date => date, onRetry() {} });
    reader.render(result);
    const texts = descendants(reader.page).map(node => node.textContent);
    expect(texts).toContain('Unselected variant words'); expect(texts).not.toContain('Wrong translated source');
  });
  it('prints applied literal names with user attribution while keeping the private form out of print', async () => {
    const f = await localLiturgy();
    const result = await fetchWorshipParts('https://bible.example', f.state, () => {}, async (url, options) => ({ status: 200,
      json: async () => ({ data: options.method === 'POST' ? f.assignments : f.template }) }), undefined, { localContext: f.input });
    const ui = setup(() => true, f.state, { onLocalSubmit: vi.fn() });
    ui.reader.render(result);
    const before = descendants(ui.reader.page), body = before.find(node => node.tag === 'article');
    expect(before.some(node => node.className === 'worship-local-context')).toBe(true);
    expect(before.filter(node => node.dataset.origin === 'user-provided')).toHaveLength(4);
    expect(before.map(node => node.textContent)).toContain('Местные имена введены пользователем. Они не подтверждают назначение всей службы.');
    const pending = ui.button.events.click(); ui.fontsReady(); await pending;
    expect(ui.print).toHaveBeenCalledOnce(); expect(descendants(ui.reader.page)).toContain(body);
    const css = readFileSync(new URL('../public/calendar-ui/web-calendar.css', import.meta.url), 'utf8');
    expect(css.slice(css.indexOf('@media print'))).toContain('.worship-local-context');
    ui.reader.dispose();
  });
  it('keeps the local form hidden until the runtime POST guard succeeds', () => {
    const f = additionalLiturgy(), ui = setup(() => true, f.state, { onLocalSubmit: vi.fn() });
    const base = { status: 'parts', additionalFixed: true, template: f.template, entries: [], assignmentsStatus: 'partial', complete: false };
    ui.reader.render(base);
    expect(descendants(ui.reader.page).some(node => node.className === 'worship-local-context')).toBe(false);
    ui.reader.render({ ...base, localContextAvailable: true });
    expect(descendants(ui.reader.page).filter(node => node.dataset.localField)).toHaveLength(4);
    ui.reader.dispose();
  });
});
