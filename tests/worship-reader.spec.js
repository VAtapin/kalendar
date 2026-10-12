import { describe, expect, it } from 'vitest';
import { fetchWorship, lectionNumber, textLanguage, validateCalendarTexts } from '../public/calendar-ui/worship-reader.js';

const state = { date: '2026-10-21', office: 'third-hour', sequence: 'standalone', temple: 'george-victorious', afterHourHymn: 'vzbrannoi', location: 'nave' };
const response = (status, data) => ({ status, json: async () => ({ data }) });
const data = (language = 'cu-civil', extra = {}) => ({ schemaVersion: 1, context: { date: state.date, office: state.office, sequence: state.sequence, calendarStyle: 'julian', language }, ...extra });
const complete = (language = 'cu-civil') => data(language, { status: 'complete', completeness: { text: true, appointment: true, review: true }, blocks: [{ kind: 'paragraph', segments: [{ text: 'Го́споди, поми́луй.', style: 'text' }] }] });

describe('calendar lection numbers', () => {
  const match = (candidates, status = 'exact-reference-match') => ({ lectionary: { status, basis: 'exact-source-coordinates', candidates } });
  const candidate = { kind: 'gospel', book: 'Luke', number: 19 };
  it('displays one identity even with multiple source variants', () => {
    expect(lectionNumber(match([candidate, { ...candidate, source_variant: 'Б' }]))).toBe('19');
  });
  it('does not guess ambiguous, unmatched, malformed or non-Gospel/Apostle numbers', () => {
    expect(lectionNumber(match([candidate], 'ambiguous'))).toBeNull();
    expect(lectionNumber(match([candidate, { ...candidate, book: 'John' }]))).toBeNull();
    expect(lectionNumber(match([{ ...candidate, number: 0 }]))).toBeNull();
    expect(lectionNumber(match([{ ...candidate, kind: 'psalm' }]))).toBeNull();
    expect(lectionNumber(match([null]))).toBeNull();
    expect(lectionNumber({})).toBeNull();
  });
});

describe('automatic text editions', () => {
  it('uses the actual orthography rather than the interface language', () => {
    expect(textLanguage({ language: 'cu', orthography: 'civil-accented' })).toBe('cu-civil');
    expect(textLanguage({ language: 'cu', orthography: 'traditional' })).toBe('cu');
  });
  it('rejects servers ignoring automatic policy and unlabeled text', () => {
    expect(() => validateCalendarTexts({ schemaVersion: 1 })).toThrow();
    expect(() => validateCalendarTexts({ schemaVersion: 2, textPolicy: 'calendar-language-v1', calendarLanguage: 'ru', assignments: [{ text: 'text' }] })).toThrow();
    expect(() => validateCalendarTexts({ schemaVersion: 2, textPolicy: 'calendar-language-v1', calendarLanguage: 'ru', assignments: [{ text: 'text', language: 'ru' }] })).not.toThrow();
  });
});

describe('public worship availability', () => {
  it('prefers traditional Slavonic and does not require a prepared client-side date', async () => {
    const urls = [];
    const result = await fetchWorship('https://bible.example', state, async url => { urls.push(url); return response(200, complete('cu')); });
    expect(result.status).toBe('ready');
    expect(result.language).toBe('cu');
    expect(urls).toHaveLength(1);
    expect(urls[0].searchParams.get('date')).toBe(state.date);
    expect(urls[0].searchParams.has('temple')).toBe(false);
  });
  it('falls back only for explicit edition absence', async () => {
    const languages = [];
    const result = await fetchWorship('https://bible.example', state, async url => {
      const language = url.searchParams.get('language'); languages.push(language);
      return language === 'ru' ? response(200, complete('ru')) : response(409, data(language, { status: 'unsupported', issues: [{ code: 'unsupported-edition' }] }));
    });
    expect(languages).toEqual(['cu', 'cu-civil', 'ru']);
    expect(result.language).toBe('ru');
  });
  it('never exposes fragments or falls back on a review failure', async () => {
    let calls = 0;
    const result = await fetchWorship('https://bible.example', state, async () => {
      calls++; return response(409, data('cu', { status: 'needs-review', issues: [{ code: 'editorial-review-required' }], blocks: complete().blocks, fragments: { secret: 'private' } }));
    });
    expect(result).toEqual({ status: 'pending' });
    expect(calls).toBe(1);
  });
  it('does not mask a source integrity error accompanying unsupported edition', async () => {
    let calls = 0;
    const result = await fetchWorship('https://bible.example', state, async () => {
      calls++; return response(409, data('cu', { status: 'unsupported', issues: [{ code: 'unsupported-edition' }, { code: 'source-body-changed' }] }));
    });
    expect(result).toEqual({ status: 'pending' }); expect(calls).toBe(1);
  });
  it.each([401, 403, 422, 429, 503])('does not substitute a language on HTTP %s', async status => {
    let calls = 0;
    await expect(fetchWorship('https://bible.example', state, async () => { calls++; return response(status, {}); })).rejects.toThrow();
    expect(calls).toBe(1);
  });
  it('rechecks a pending date and displays it when the server publishes it', async () => {
    let published = false;
    const fetcher = async () => published ? response(200, complete('cu')) : response(409, data('cu', { status: 'needs-review' }));
    expect(await fetchWorship('https://bible.example', state, fetcher)).toEqual({ status: 'pending' });
    published = true;
    expect((await fetchWorship('https://bible.example', state, fetcher)).status).toBe('ready');
  });
  it('rejects incomplete successes and wrong-date replies', async () => {
    await expect(fetchWorship('https://bible.example', state, async () => response(200, data('cu', { status: 'complete', blocks: complete().blocks })))).rejects.toThrow();
    await expect(fetchWorship('https://bible.example', state, async () => response(200, { ...complete('cu'), context: { ...complete('cu').context, date: '2026-10-20' } }))).rejects.toThrow();
    await expect(fetchWorship('https://bible.example', state, async () => response(200, { ...complete('cu'), context: { ...complete('cu').context, sequence: 'after-third-hour' } }))).rejects.toThrow();
    const altar = { ...state, office: 'liturgy', sequence: 'default' };
    await expect(fetchWorship('https://bible.example', altar, async () => response(200, { ...complete('cu'), context: { ...complete('cu').context, office: 'liturgy', temple: 'nicholas' } }))).rejects.toThrow();
  });
  it('treats a disabled endpoint as unavailable and a day without Liturgy distinctly', async () => {
    expect(await fetchWorship('https://bible.example', state, async () => response(404, {}))).toEqual({ status: 'unavailable' });
    expect(await fetchWorship('https://bible.example', state, async () => response(409, data('cu', { status: 'not-appointed' })))).toEqual({ status: 'not-appointed' });
  });
  it('passes the explicit first/ninth Hour context and altar', async () => {
    const first = { ...state, office: 'first-hour', sequence: 'after-matins' };
    const ninth = { ...state, office: 'ninth-hour', sequence: 'before-vespers', location: 'narthex' };
    for (const selected of [first, ninth]) {
      await fetchWorship('https://bible.example', selected, async url => {
        expect(url.searchParams.get('temple')).toBe('george-victorious');
        if (selected.office === 'first-hour') {
          expect(url.searchParams.get('matinsDismissalDone')).toBe('1');
          expect(url.searchParams.get('afterHourHymn')).toBe('vzbrannoi');
        } else {
          expect(url.searchParams.get('nextOffice')).toBe('vespers');
          expect(url.searchParams.get('location')).toBe('narthex');
        }
        return response(404, {});
      });
    }
  });
});
