import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { create, descendants } from './fixtures/worship-dom.mjs';
import { UI_DE } from '../public/calendar-ui/web-calendar-i18n.js';

const state = { office: 'liturgy', date: '2026-11-02', temple: 'nicholas', sequence: 'default', textLanguage: 'cu', textSize: 22 };
const base = { status: 'parts', complete: false, assignmentsStatus: 'partial', entries: [] };
function render(result) {
  const reader = renderWorshipReader({ state, create, formatDate: date => date, onRetry() {} });
  reader.render(result);
  const nodes = descendants(reader.page);
  return { reader, nodes, texts: nodes.map(node => node.textContent),
    coverage: nodes.find(node => node.className === 'worship-coverage') };
}
describe('service completeness in the reader', () => {
  it('groups remaining requirements, navigates to their actual placeholders and ignores stale controls', () => {
    const entries = [
      { missing: true, slotId: 'locality-petition', reason: 'traditional-cu-verified-local-context-required', contract: {} },
      { missing: true, slotId: 'gospel', reason: 'traditional-cu-appointment-not-independently-verified', contract: [] },
      { missing: true, slotId: 'hidden-id', contract: { contractKind: 'evangelist' }, reason: 'traditional-cu-verified-local-context-required' },
      { missing: true, slotId: 'unknown', reason: 'opaque-private-code' },
    ];
    const { reader, nodes, texts, coverage } = render({ ...base, entries });
    for (const [label, count] of [['Данные вашего храма:', ' 1'], ['Назначения дня:', ' 2'], ['Другие условия службы:', ' 1']]) {
      const row = coverage.children.find(node => node.children.some(child => child.textContent === label));
      expect(row.children.map(node => node.textContent)).toContain(count); expect(UI_DE[label]).toBeTruthy();
    }
    const target = nodes.find(node => node.className === 'worship-missing' && node.dataset.slotId === 'gospel');
    target.scrollIntoView = vi.fn(); target.focus = vi.fn();
    const button = nodes.find(node => node.dataset.missingGroup === 'day'); button.events.click();
    expect(target.scrollIntoView).toHaveBeenCalledOnce(); expect(target.focus).toHaveBeenCalledOnce();
    expect(nodes.filter(node => node.className === 'worship-missing')).toHaveLength(4);
    expect(texts).toContain('Назначение этой части на выбранную дату пока не подтверждено.');
    reader.render({ ...base, complete: true, assignmentsStatus: 'complete' }); button.events.click();
    expect(target.scrollIntoView).toHaveBeenCalledOnce();
    expect(descendants(reader.page).some(node => node.dataset.missingGroup)).toBe(false); reader.dispose();
  });
  it('links the local group to the existing available form without submitting names', () => {
    const onLocalSubmit = vi.fn(), reader = renderWorshipReader({ state: { ...state, rite: 'basil-great' }, create, formatDate: date => date, onLocalSubmit });
    reader.render({ ...base, template: { conditionalTemplates: {} }, additionalFixed: true, localContextAvailable: true, entries: [{ missing: true, slotId: 'local', contract: { category: 'local-source-variant-or-name' } }] });
    const nodes = descendants(reader.page), form = nodes.find(node => node.className === 'worship-local-context');
    form.open = false; form.scrollIntoView = vi.fn();
    nodes.find(node => node.dataset.missingGroup === 'local').events.click();
    expect(form.open).toBe(true); expect(form.scrollIntoView).toHaveBeenCalledOnce(); expect(onLocalSubmit).not.toHaveBeenCalled(); reader.dispose();
  });
  it.each([
    [{ ...base, complete: true, assignmentsStatus: 'complete' }, 'Полная служба дня'],
    [base, 'Служба дня составлена не полностью'],
    [{ ...base, outline: true }, 'Книжный текст — служба дня не составлена'],
    [{ ...base, assignmentsStatus: 'loading' }, 'Уточняются назначения дня'],
    [{ ...base, assignmentsStatus: 'error' }, 'Назначения дня недоступны'],
    [{ ...base, assignmentsStatus: 'not-appointed' }, 'Служба в этот день не назначена'],
  ])('labels only verified complete results as a full daily service (%s)', (result, label) => {
    const { coverage, texts } = render(result);
    expect(coverage.children[0].textContent).toBe(label);
    if (!result.complete) expect(texts).not.toContain('Полная служба дня');
    expect(UI_DE[label]).toBeTruthy();
  });
  it('distinguishes dated assignments from local data without exposing raw API codes', () => {
    const entries = [
      { missing: true, slotId: 'gospel', reason: 'traditional-cu-appointment-not-independently-verified' },
      { missing: true, slotId: 'local-commemorations', reason: 'traditional-cu-verified-local-context-required' },
      { missing: true, slotId: 'unknown', reason: '<private-unrecognized-error>' },
    ];
    const { coverage, texts } = render({ ...base, entries });
    expect(descendants(coverage).map(node => node.textContent)).toContain(' 3');
    expect(texts).toContain('Назначение этой части на выбранную дату пока не подтверждено.');
    expect(texts).toContain('Эту часть задают местные данные храма: точные формы имён или выбор условий службы.');
    expect(texts).toContain('Назначение этой части пока не определено.');
    expect(texts.join(' ')).not.toContain('<private-unrecognized-error>');
  });
  it('labels temple setup clearly but keeps evangelist and appointed saint names as dated requirements', () => {
    const entries = [
      { missing: true, slotId: 'locality-petition', reason: 'traditional-cu-verified-local-context-required', contract: { wholeWordsMustBeSourceBound: true } },
      { missing: true, slotId: 'parish-or-monastery-brethren', reason: 'traditional-cu-verified-local-context-required' },
      { missing: true, slotId: 'private-id-a', reason: 'traditional-cu-verified-local-context-required', contract: { contractKind: 'evangelist' } },
      { missing: true, slotId: 'private-id-b', reason: 'traditional-cu-verified-local-context-required', contract: { contractKind: 'appointed-saint' } },
    ];
    const { texts, coverage } = render({ ...base, entries });
    expect(texts).toEqual(expect.arrayContaining(['Местоположение храма', 'Приход или монастырь: община', 'Имя евангелиста', 'Имя святого дня']));
    expect(texts.filter(text => text === 'Назначение этой части на выбранную дату пока не подтверждено.')).toHaveLength(2);
    expect(descendants(coverage).map(node => node.textContent)).toContain(' 4');
    expect(texts.join(' ')).not.toMatch(/private-id|Полная служба дня/);
  });
  it('does not describe missing appointments as empty source text', () => {
    const block = { kind: 'text', segments: [{ text: 'Unmodified source words' }] };
    const { texts } = render({ ...base, entries: [{ blocks: [block], language: 'cu' }, { missing: true, slotId: 'gospel', reason: 'dated-appointment-not-verified' }] });
    expect(texts).toContain('Unmodified source words');
    expect(texts).toContain('Назначение этой части на выбранную дату пока не подтверждено.');
  });
  it('keeps source-outline slots clearly separate from a composed daily service', () => {
    const { coverage, texts } = render({ ...base, outline: true, entries: [{ missing: true, slotId: 'gospel', reason: 'traditional-cu-office-appointment-not-verified' }] });
    expect(coverage.children[0].textContent).toBe('Книжный текст — служба дня не составлена');
    expect(texts).not.toContain('Полная служба дня');
  });
  it('keeps completeness and missing reasons in the printed content', () => {
    const { nodes, coverage } = render({ ...base, entries: [{ missing: true, slotId: 'gospel' }] });
    const content = nodes.find(node => node.className === 'worship-content');
    expect(descendants(content)).toContain(coverage);
    const css = readFileSync(new URL('../public/calendar-ui/web-calendar.css', import.meta.url), 'utf8');
    const print = css.slice(css.indexOf('@media print'));
    expect(print).not.toMatch(/\.worship-(coverage|missing)[^{]*\{[^}]*display:\s*none/);
  });
});
