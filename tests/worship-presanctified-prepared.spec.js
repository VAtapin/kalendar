import { describe, expect, it } from 'vitest';
import { buildPreparedPresanctifiedPost, normalizePreparedLiturgyContext, validatePreparedChoices } from '../public/calendar-ui/worship-presanctified-prepared-context.js';
import { preparedPresanctifiedFormAvailable } from '../public/calendar-ui/worship-presanctified-form.js';
import { renderWorshipReader } from '../public/calendar-ui/worship-reader.js';
import { create, installReaderPdfDocument } from './fixtures/reader-pdf-dom.mjs';
import { UI_DE } from '../public/calendar-ui/web-calendar-i18n.js';
const state = { office: 'liturgy', rite: 'presanctified', date: '2026-03-18', temple: 'nicholas',
  textLanguage: 'cu', midLentBranch: 'from-mid-lent-wednesday' };
const context = () => ({ schemaVersion: 1, templeProfileId: 'nicholas', confirmedLiteralForms: true,
  people: { celebrant: { forms: { nominative: 'Те́стовый' } } } });
const choices = () => ({ schemaVersion: 1, private: true, variant: 'prepared-priest-and-deacon', building: 'temple', locality: 'city' });
describe('typed private printed Presanctified input', () => {
  it('preserves user accents, returns a separate object, and supplies no invented people', () => {
    const input = context(), normalized = normalizePreparedLiturgyContext(input, state.temple);
    expect(normalized.people).toEqual(input.people); expect(normalized.commemorations).toEqual({ living: [], departed: [] });
    normalized.people.celebrant.forms.nominative = 'Тест'; expect(input.people.celebrant.forms.nominative).toBe('Те́стовый');
  });
  it.each([
    input => { input.confirmedLiteralForms = false; }, input => { input.templeProfileId = 'dormition'; },
    input => { input.people.celebrant.forms.nominative = ' Тест'; }, input => { input.people.celebrant.extra = true; },
    input => { input.people.unknown = { forms: { nominative: 'Тест' } }; }, input => { input.commemorations = { living: Array(65).fill({ forms: { genitive: 'Теста' } }) }; },
    input => { input.commemorations = 0; }, input => { input.commemorations = { living: false }; },
  ])('rejects unsupported or unconfirmed local input', mutate => {
    const input = context(); mutate(input); expect(() => normalizePreparedLiturgyContext(input, state.temple)).toThrow();
  });
  it.each([
    { private: false }, { variant: 'ordinary' }, { building: '' }, { locality: '' }, { locality: 'monastery' },
    { preparedGarments: [] }, { preparedGarments: ['phelonion', 'phelonion'] }, { censingTripletRepeats: 0 },
    { censingTripletRepeats: 13 }, { censingTripletRepeats: 1.5 }, { localForms: null }, { unknown: true },
    { dismissalSaints: { temple: [], day: [] } },
  ])('requires explicit bounded source choices %j', patch => {
    expect(() => validatePreparedChoices({ ...choices(), ...patch })).toThrow();
  });
  it('builds an opaque discovery request without mutating calendar state or user inputs', () => {
    const selected = structuredClone(state), input = context(), source = choices();
    const request = buildPreparedPresanctifiedPost(selected, 'a'.repeat(64), input, source);
    expect(request.sourceBodyVersion).toBe('0'.repeat(64)); expect(request.localContext).toEqual(input);
    expect(selected).toEqual(state); expect(request.preparedSourceChoices).not.toBe(source);
  });
  it.each([{ rite: 'basil-great' }, { textLanguage: 'ru' }, { date: '2026-02-30' }, { midLentBranch: '' }])('rejects an incompatible request context %j', patch => {
    expect(() => buildPreparedPresanctifiedPost({ ...state, ...patch }, 'a'.repeat(64), context(), choices())).toThrow();
  });
  it('limits the first source choice to the reviewed printed composition', () => {
    expect(preparedPresanctifiedFormAvailable(state)).toBe(true);
    for (const patch of [{ date: '2026-03-19' }, { temple: 'dormition' }, { rite: 'basil-great' }]) {
      expect(preparedPresanctifiedFormAvailable({ ...state, ...patch })).toBe(false);
    }
  });
  it('clears old text and disables print/PDF during preparation and after failure while retaining transient form input', () => {
    const restore = installReaderPdfDocument();
    try {
      const reader = renderWorshipReader({ state, create, formatDate: date => date, onLocalSubmit() {} });
      // Reader models only; actual positive HTTP bodies are replayed by test-presanctified-api.mjs.
      reader.render({ status: 'parts', additionalFixed: true, localContextAvailable: true, assignmentsStatus: 'partial', complete: false, template: { conditionalTemplates: {} },
        entries: [{ kind: 'fixed', language: 'cu', blocks: [{ kind: 'text', segments: [{ text: 'Те́стовый', style: 'text' }] }] }] });
      const input = reader.page.querySelectorAll('input').find(node => node.dataset.localField === 'celebrant.nominative');
      input.value = 'Тест';
      expect(reader.page.querySelector('.worship-text')).toBeTruthy();
      for (const status of ['prepared-loading', 'prepared-unavailable']) {
        reader.render({ status });
        expect(reader.page.querySelector('.worship-text')).toBeNull();
        expect(reader.page.textContent).not.toContain('Те́стовый');
        expect(reader.page.querySelectorAll('button').find(b => b.textContent === 'Печать службы').disabled).toBe(true);
        expect(reader.page.querySelectorAll('button').find(b => b.textContent === 'Скачать PDF').disabled).toBe(true);
        expect(reader.page.querySelectorAll('input').includes(input)).toBe(true); expect(input.value).toBe('Тест');
      }
      reader.dispose(); expect(input.value).toBe('');
    } finally { restore(); }
  });
  it('localizes the printed scope without changing source words', () => {
    for (const text of ['Полный текст выбранного печатного чина', 'Подготавливаю выбранный печатный чин…',
      'Святые минейного дня вечерни — готовая родительная форма для отпуста']) expect(UI_DE[text]).toBeTruthy();
  });
  it('uses a neutral printed-rite heading without an actual-schedule caveat', () => {
    const reader = renderWorshipReader({ state, create, formatDate: date => date });
    // UI model only; genuine PDF capture and preserved false flags use the owner replay.
    reader.render({ status: 'parts', assignmentsStatus: 'complete', complete: true, preparedPrintedBook: true,
      localValuesApplied: true, localTempleId: 'nicholas', entries: [], template: {} });
    expect(reader.page.querySelector('.worship-coverage').textContent).toBe('Полный текст выбранного печатного чина');
    expect(reader.page.textContent).toContain('Имена: из вашего ввода.');
    expect(reader.page.textContent).not.toContain('местное совершение и расписание не подтверждены');
    reader.dispose();
  });
});
