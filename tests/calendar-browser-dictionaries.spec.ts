import { describe, expect, it } from 'vitest';
import { calendarDictionary, loadCalendarDictionary } from '../src/calendar/localization/corpus-data.browser';
import { calendarDictionary as completeDictionary } from '../src/calendar/localization/corpus-data';

describe('browser dictionary loading', () => {
  it('starts without optional corpora and loads only the requested language', async () => {
    expect(Object.keys(calendarDictionary('de'))).toHaveLength(0);
    expect(Object.keys(calendarDictionary('uk'))).toHaveLength(0);
    await Promise.all([loadCalendarDictionary('de'), loadCalendarDictionary('de')]);
    expect(calendarDictionary('de')).toEqual(completeDictionary('de'));
    expect(Object.keys(calendarDictionary('uk'))).toHaveLength(0);
    const cached = calendarDictionary('de');
    await loadCalendarDictionary('de');
    expect(calendarDictionary('de')).toBe(cached);
  });
  it('preserves every entry in the remaining language corpora', async () => {
    for (const language of ['cu', 'uk', 'pl'] as const) {
      await loadCalendarDictionary(language);
      expect(calendarDictionary(language)).toEqual(completeDictionary(language));
    }
  });
});
