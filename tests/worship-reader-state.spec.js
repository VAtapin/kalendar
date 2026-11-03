import { describe, expect, it } from 'vitest';
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
