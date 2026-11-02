import { describe, expect, it, vi } from 'vitest';
import { buildLocalClergyContext, createLocalContextForm, localClergyFields, validLocalLiteral } from '../public/calendar-ui/worship-local-context.js';
import { create, descendants } from './fixtures/worship-dom.mjs';

const state = { office: 'liturgy', rite: 'basil-great', temple: 'nicholas' };
const temples = { nicholas: 'Храм святителя Николая', dormition: 'Храм Успения Богородицы' };
describe('transient local clergy form preparation', () => {
  it('offers four literal forms for Basil and only two nominatives for Presanctified', () => {
    expect(localClergyFields(state).map(field => field.key)).toEqual(['celebrant.nominative', 'celebrant.dative', 'deacon.nominative', 'deacon.dative']);
    expect(localClergyFields({ ...state, rite: 'presanctified' }).map(field => field.key)).toEqual(['celebrant.nominative', 'deacon.nominative']);
    expect(localClergyFields({ ...state, rite: 'john-chrysostom' })).toEqual([]);
  });
  it('preserves literal accents and omits unfilled forms instead of inventing inflection', () => {
    const context = buildLocalClergyContext(state, { 'celebrant.nominative': 'Те́стовый', 'celebrant.dative': '', 'deacon.dative': 'Те́стовому' }, 'nicholas', true, temples);
    expect(context).toEqual({ schemaVersion: 1, templeProfileId: 'nicholas', confirmedLiteralForms: true,
      people: { celebrant: { forms: { nominative: 'Те́стовый' } }, deacon: { forms: { dative: 'Те́стовому' } } },
      commemorations: { living: [], departed: [] } });
    expect(state).toEqual({ office: 'liturgy', rite: 'basil-great', temple: 'nicholas' });
  });
  it.each(['', ' Test', 'Тест ', '<b>Тест</b>', 'Тест\nИмя', 'Тест\u200b', 'Тест123', 'имярек', 'и҆́мⷬ҇къ', '́Тест', 'А'.repeat(161)])('rejects an unsupported literal %s', literal => {
    expect(validLocalLiteral(literal)).toBe(false);
  });
  it('requires confirmation and a known temple and rejects extra fields', () => {
    const values = { 'celebrant.nominative': 'Те́стовый' };
    expect(() => buildLocalClergyContext(state, values, 'nicholas', false, temples)).toThrow();
    expect(() => buildLocalClergyContext(state, values, 'unknown', true, temples)).toThrow();
    expect(() => buildLocalClergyContext(state, { ...values, 'primate.nominative': 'Тест' }, 'nicholas', true, temples)).toThrow();
    expect(() => buildLocalClergyContext({ ...state, rite: 'presanctified' }, { 'celebrant.dative': 'Тесту' }, 'nicholas', true, temples)).toThrow();
  });
  function form(onSubmit = vi.fn()) {
    const widget = createLocalContextForm({ state, temples, create, onSubmit });
    const nodes = descendants(widget.page);
    return { widget, onSubmit, nodes, name: nodes.find(node => node.dataset.localField === 'celebrant.nominative'),
      consent: nodes.find(node => node.type === 'checkbox'), submit: nodes.find(node => node.type === 'submit'),
      form: nodes.find(node => node.tag === 'form') };
  }
  it('clears confirmation on every name or temple change and submits no URL state', async () => {
    const ui = form();
    ui.name.value = 'Те́стовый'; ui.name.events.input();
    expect(ui.submit.disabled).toBe(true);
    ui.consent.checked = true; ui.consent.events.change(); expect(ui.submit.disabled).toBe(false);
    ui.name.value = 'Тест'; ui.name.events.input(); expect(ui.consent.checked).toBe(false);
    ui.consent.checked = true; ui.consent.events.change();
    await ui.form.events.submit({ preventDefault() {} });
    expect(ui.onSubmit).toHaveBeenCalledOnce();
    expect(ui.onSubmit.mock.calls[0][0].people.celebrant.forms.nominative).toBe('Тест');
    const temple = ui.nodes.find(node => node.tag === 'select'); temple.value = 'dormition'; temple.events.change();
    expect(ui.consent.checked).toBe(false);
    expect(JSON.stringify(state)).not.toContain('Тест');
  });
  it('erases names when cleared or disposed and suppresses stale errors', async () => {
    let reject;
    const ui = form(() => new Promise((resolve, fail) => { reject = fail; }));
    ui.name.value = 'Тест'; ui.name.events.input(); ui.consent.checked = true; ui.consent.events.change();
    const pending = ui.form.events.submit({ preventDefault() {} });
    ui.widget.dispose(); reject(new Error('private payload must not be displayed')); await pending;
    expect(ui.name.value).toBe(''); expect(ui.submit.disabled).toBe(true);
    expect(ui.nodes.find(node => node.className === 'reader-message').hidden).toBe(true);
    expect(ui.nodes.map(node => node.textContent).join(' ')).not.toContain('private payload');
  });
  it('aborts a pending application when the user edits a form', async () => {
    let options;
    const ui = form((context, request) => { options = request; return new Promise((resolve, reject) => request.signal.addEventListener('abort', () => reject(request.signal.reason))); });
    ui.name.value = 'Тест'; ui.name.events.input(); ui.consent.checked = true; ui.consent.events.change();
    const pending = ui.form.events.submit({ preventDefault() {} });
    expect(options.isCurrent()).toBe(true);
    ui.name.value = 'Те́стовый'; ui.name.events.input(); await pending;
    expect(options.signal.aborted).toBe(true); expect(options.isCurrent()).toBe(false);
    expect(ui.submit.disabled).toBe(true);
  });
});
