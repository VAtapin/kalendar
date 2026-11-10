import { describe, expect, it } from 'vitest';
import { HOUR_OFFICES, calendarServiceValue, renderCalendarHymns } from '../public/calendar-ui/worship-calendar-hymns.js';
import { create } from './fixtures/reader-pdf-dom.mjs';

const proper = { textId: 'a', slot: 'troparion-of-day', heading: 'Тропарь памяти', text: 'Образец текста', language: 'cu', orthography: 'civil-accented', insert: false };
const other = { textId: 'b', slot: 'kontakion-of-day', heading: 'Кондак памяти', text: 'Другой образец', language: 'ru', insert: true };
const value = office => ({ schemaVersion: 2, textPolicy: 'calendar-language-v1', calendarLanguage: 'ru', date: '2026-11-02', office,
  assignments: [proper, other], properAssignments: [proper, other], expansions: [] });

describe('calendar hymn references beside the Hours', () => {
  it('unwraps the calendar service HTTP envelope and rejects an invalid policy', () => {
    expect(calendarServiceValue({ data: value('third-hour') })).toEqual(value('third-hour'));
    expect(() => calendarServiceValue({ data: { schemaVersion: 1 } })).toThrow();
  });
  it.each(HOUR_OFFICES)('displays published texts with actual language for %s', office => {
    const section = renderCalendarHymns({ create, state: { date: '2026-11-02', office }, value: value(office) });
    expect(section.textContent).toContain('Справочно: порядок службы не подтверждён.');
    expect(section.querySelectorAll('article')).toHaveLength(2);
    expect(section.textContent).toContain('Тропарь памяти');
    expect(section.textContent).toContain('Кондак памяти');
    const texts = section.querySelectorAll('p').filter(node => node.dataset.textLanguage);
    expect(texts.map(node => node.dataset.textLanguage).sort()).toEqual(['cu-civil', 'ru']);
    expect(texts.find(node => node.dataset.textLanguage === 'cu-civil').lang).toBe('cu');
  });
  it('shows unavailable and empty states and rejects stale date or missing edition', () => {
    const state = { date: '2026-11-02', office: 'first-hour' };
    expect(renderCalendarHymns({ create, state, error: true }).textContent).toContain('сейчас недоступны');
    expect(renderCalendarHymns({ create, state, value: { ...value(state.office), assignments: [], properAssignments: [] } }).textContent).toContain('пока недоступны');
    expect(() => renderCalendarHymns({ create, state, value: { ...value(state.office), date: '2026-11-03' } })).toThrow();
    expect(() => renderCalendarHymns({ create, state, value: { ...value(state.office), assignments: [{ ...proper, language: undefined }] } })).toThrow();
  });
});
