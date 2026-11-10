import { describe, expect, it, vi } from 'vitest';
import { firstSeasonParams, fetchFirstSeason } from '../public/calendar-ui/worship-first-season.js';
import { createFirstSeasonForm } from '../public/calendar-ui/worship-first-season-form.js';
import { create } from './fixtures/reader-pdf-dom.mjs';

const state = { date: '2026-03-03', office: 'first-hour', sequence: 'before-matins-dismissal', afterHourHymn: 'none', temple: 'george-victorious', textLanguage: 'cu' };
describe('First Hour with the Matins dismissal', () => {
  it('uses the explicit unfinished dismissal and rejects other endings', () => {
    expect(firstSeasonParams(state)).toMatchObject({ sequence: 'after-matins', matinsDismissalDone: false, afterHourHymn: 'none' });
    expect(() => firstSeasonParams({ ...state, afterHourHymn: 'vzbrannoi' })).toThrow();
  });
  it('requires both literal names and confirmation, aborts on edit and erases on disposal', async () => {
    let finish, sent;
    const form = createFirstSeasonForm({ state, create, onDirty() {}, onClear() {}, onSubmit: vi.fn((local, pending) => { sent = { local, pending }; return new Promise(resolve => { finish = resolve; }); }) });
    const inputs = form.page.querySelectorAll('input'), names = inputs.filter(input => input.type === 'text'), consent = inputs.find(input => input.type === 'checkbox');
    const apply = form.page.querySelectorAll('button').find(button => button.type === 'submit');
    names[0].value = 'Иоанна'; names[0].events.input(); names[1].value = 'Петра'; names[1].events.input();
    expect(apply.disabled).toBe(true); consent.checked = true; consent.events.change(); expect(apply.disabled).toBe(false);
    const submission = form.page.querySelector('form').events.submit({ preventDefault() {} });
    expect(sent.local.people.diocesan.rank).toBe('bishop'); expect(sent.pending.firstSeasonPrepared).toBe(true);
    names[0].value = 'Иное'; names[0].events.input(); expect(sent.pending.signal.aborted).toBe(true); expect(consent.checked).toBe(false);
    finish(); await submission; form.dispose(); expect(names.every(input => input.value === '')).toBe(true);
  });
  it('does not send personal input when the template is unavailable', async () => {
    const fetcher = vi.fn(async () => ({ status: 409 }));
    await expect(fetchFirstSeason('https://offline.invalid', state, fetcher, new AbortController().signal, {})).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][0].search).not.toContain('Иоанна');
  });
});
