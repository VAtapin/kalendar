import { describe, expect, it } from 'vitest';
import { datedWorshipParams, matchesWorshipContext, validWorshipDate } from '../public/calendar-ui/worship-context.js';
import { fetchWorshipParts } from '../public/calendar-ui/worship-parts.js';
import { assignmentsFor, templateFor } from './fixtures/worship-parts.mjs';

const state = { date: '2026-11-02', office: 'third-hour', sequence: 'standalone', temple: 'nicholas', textLanguage: 'cu-civil' };
describe('selected worship context', () => {
  it.each(['2026-13-02', '2026-02-29', '2026-11-31', '1899-12-31', '2201-01-01', '', null])('rejects malformed date %s without throwing', date => {
    expect(validWorshipDate(date)).toBe(false);
    expect(() => datedWorshipParams({ ...state, date }, 'cu')).toThrow('Invalid worship date');
  });
  it.each(['2026-11-02', '2027-12-31', '2028-02-29'])('accepts a real date %s', date => expect(validWorshipDate(date)).toBe(true));
  it.each(['third-hour', 'sixth-hour', 'liturgy', 'matins', 'vespers'])('sends dated context for %s without adding unsupported template parameters', async office => {
    const selected = { ...state, office, sequence: office === 'sixth-hour' ? 'after-third-hour' : office === 'liturgy' ? 'default' : 'standalone' };
    const template = templateFor(office), urls = [];
    await fetchWorshipParts('https://bible.example', selected, () => {}, async url => {
      urls.push(url);
      return { status: 200, json: async () => ({ data: url.pathname.includes('/templates/') ? template : assignmentsFor(template, selected, false) }) };
    });
    expect(urls[0].searchParams.has('date')).toBe(false);
    expect(urls[0].searchParams.has('temple')).toBe(false);
    for (const [key, value] of Object.entries(datedWorshipParams(selected, 'cu-civil'))) expect(urls[1].searchParams.get(key)).toBe(value);
  });
  it.each(['third-hour', 'sixth-hour'])('accepts either temple representation for %s and rejects missing or conflicting IDs', office => {
    const selected = { ...state, office }, context = { ...datedWorshipParams(selected, 'cu'), office };
    expect(matchesWorshipContext(context, selected)).toBe(true);
    delete context.temple;
    expect(matchesWorshipContext(context, selected)).toBe(false);
    context.templeProfile = { id: 'nicholas' };
    expect(matchesWorshipContext(context, selected)).toBe(true);
    context.temple = 'dormition';
    expect(matchesWorshipContext(context, selected)).toBe(false);
  });
  it('rejects a different first Hour ending or ninth Hour location', () => {
    for (const selected of [
      { ...state, office: 'first-hour', sequence: 'after-matins', afterHourHymn: 'none' },
      { ...state, office: 'ninth-hour', sequence: 'before-vespers', location: 'narthex' },
    ]) {
      const context = { ...datedWorshipParams(selected, 'cu'), office: selected.office, matinsDismissalDone: true };
      expect(matchesWorshipContext(context, selected)).toBe(true);
      context[selected.office === 'first-hour' ? 'afterHourHymn' : 'location'] = 'other';
      expect(matchesWorshipContext(context, selected)).toBe(false);
    }
  });
  it('binds the ninth Hour before Typika to its explicit continuation', () => {
    const selected = { ...state, office: 'ninth-hour', sequence: 'after-sixth-hour' };
    const context = { ...datedWorshipParams(selected, 'cu'), office: selected.office };
    expect(context.nextOffice).toBe('typika'); expect(matchesWorshipContext(context, selected)).toBe(true);
    context.nextOffice = 'vespers'; expect(matchesWorshipContext(context, selected)).toBe(false);
  });
  it('cancels the previous assignment request instead of returning a stale fallback', async () => {
    const controller = new AbortController(), seen = [];
    const promise = fetchWorshipParts('https://bible.example', state, result => seen.push(result), async (url, options) => {
      if (url.pathname.includes('/templates/')) return { status: 200, json: async () => ({ data: templateFor(state.office) }) };
      return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
    }, controller.signal);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(seen).toHaveLength(1);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('captures selection before awaiting a template', async () => {
    const selected = { ...state }, urls = [], template = templateFor(state.office);
    const result = await fetchWorshipParts('https://bible.example', selected, () => {}, async url => {
      urls.push(url);
      selected.date = '2027-01-01'; selected.temple = 'dormition';
      return { status: 200, json: async () => ({ data: url.pathname.includes('/templates/') ? template : assignmentsFor(template, state, false) }) };
    });
    expect(result.assignmentsStatus).toBe('partial');
    expect(urls[1].searchParams.get('date')).toBe(state.date);
    expect(urls[1].searchParams.get('temple')).toBe(state.temple);
  });
});
