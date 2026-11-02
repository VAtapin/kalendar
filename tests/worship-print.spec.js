import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { readFileSync } from 'node:fs';

import { create, descendants } from './fixtures/worship-dom.mjs';

const state = { office: 'third-hour', date: '2026-11-02', temple: 'nicholas', sequence: 'standalone', textLanguage: 'cu', textSize: 22 };
const ready = { status: 'ready', language: 'cu', data: { blocks: [{ kind: 'text', segments: [{ text: 'Exact API body' }] }] } };
afterEach(() => vi.unstubAllGlobals());
describe('printing the displayed worship body', () => {
  it('uses A4 margins and a fixed print size, hiding the outer calendar controls', () => {
    const css = readFileSync(new URL('../public/calendar-ui/web-calendar.css', import.meta.url), 'utf8');
    expect(css).toMatch(/@page worship\s*\{\s*size: A4;\s*margin: 16mm;/);
    expect(css).toContain('page: worship;');
    expect(css).toContain('--reader-size: 12pt !important;');
    expect(css).toContain('body:has(.worship-page) main > :not(.shell)');
    expect(css).toContain('.worship-controls, .worship-navigation');
  });
  function setup(isCurrent = () => true) {
    let fontsReady;
    vi.stubGlobal('document', { fonts: { ready: new Promise(resolve => { fontsReady = resolve; }) } });
    const print = vi.fn(), reader = renderWorshipReader({ state: { ...state }, create, formatDate: date => date,
      onChange() {}, onCalendar() {}, onRetry() {}, isCurrent, print });
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
});
