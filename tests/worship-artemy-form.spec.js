import { describe, expect, it, vi } from 'vitest';
import { createArtemyFields, createArtemyForm } from '../public/calendar-ui/worship-artemy-form.js';
import { create } from './fixtures/reader-pdf-dom.mjs';
import { buildArtemyPost } from '../public/calendar-ui/worship-artemy-request.js';

const state = { office: 'liturgy', rite: 'john-chrysostom', date: '2026-11-02', temple: 'george-victorious' };
describe('Artemy private forms', () => {
  it('requires every literal and explicit many-years confirmation, then erases them', () => {
    const dirty = vi.fn(), form = createArtemyFields({ state, create, onDirty: dirty });
    const inputs = form.page.querySelectorAll('input'), literals = inputs.filter(input => input.type === 'text');
    const consent = inputs.find(input => input.type === 'checkbox');
    expect(literals).toHaveLength(9); expect(form.valid()).toBe(false);
    for (const input of literals) { input.value = 'Те́стовая форма'; input.events.input(); }
    expect(form.valid()).toBe(false); consent.checked = true; consent.events.change();
    expect(form.valid()).toBe(true);
    const result = form.collect();
    expect(result.localContext.people.primate.forms.locative).toBe('Те́стовая форма');
    expect(result.manyYearsContext.confirmedLiteralForm).toBe(true);
    const post = buildArtemyPost({ ...state, textLanguage: 'cu', officeMode: 'auto' }, 'a'.repeat(64), result.localContext, result.manyYearsContext);
    expect(post.localContext).toEqual(result.localContext); expect(post.manyYearsContext).toEqual(result.manyYearsContext);
    expect(() => buildArtemyPost({ ...state, officeMode: 'alleluia' }, 'a'.repeat(64), result.localContext, result.manyYearsContext)).toThrow();
    expect(JSON.stringify(state)).not.toContain('Те́стовая форма');
    form.erase(); expect(form.valid()).toBe(false); expect(literals.every(input => input.value === '')).toBe(true);
    expect(dirty).toHaveBeenCalled();
  });
  it('does not offer the form for other dates or temples', () => {
    expect(createArtemyFields({ state: { ...state, date: '2026-11-03' }, create, onDirty() {} })).toBeNull();
    expect(createArtemyFields({ state: { ...state, temple: 'nicholas' }, create, onDirty() {} })).toBeNull();
  });
  it('aborts a pending request, clears confirmations on edit, and erases names on dispose', async () => {
    let finish, sent;
    const form = createArtemyForm({ state, create, onDirty() {}, onClear() {}, onSubmit: vi.fn((context, pending) => {
      sent = { context, pending }; return new Promise(resolve => { finish = resolve; });
    }) });
    const inputs = form.page.querySelectorAll('input'), literals = inputs.filter(input => input.type === 'text');
    const checkboxes = inputs.filter(input => input.type === 'checkbox');
    for (const input of literals) { input.value = 'Те́стовая форма'; input.events.input(); }
    checkboxes[0].checked = true; checkboxes[0].events.change();
    checkboxes[1].checked = true; checkboxes[1].events.change();
    const button = form.page.querySelectorAll('button').find(input => input.type === 'submit');
    expect(button.disabled).toBe(false);
    const submit = form.page.querySelector('form').events.submit({ preventDefault() {} });
    expect(sent.pending.manyYearsContext.diocesanTitledAccusative).toBe('Те́стовая форма');
    literals[0].value = 'Иное имя'; literals[0].events.input();
    expect(sent.pending.signal.aborted).toBe(true); expect(sent.pending.isCurrent()).toBe(false);
    expect(checkboxes.every(input => !input.checked)).toBe(true);
    finish(); await submit; form.dispose(); expect(literals.every(input => input.value === '')).toBe(true);
  });
});
