import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getLiturgicalText, listLiturgicalTexts, LITURGICAL_TEXT_TYPES, LITURGICAL_TEXT_SCOPES, type LiturgicalTextLibrary } from '../src/calendar/api/liturgical-texts';

const library: LiturgicalTextLibrary = JSON.parse(readFileSync('public/data/liturgical-texts.json', 'utf8'));
describe('liturgical reference texts', () => {
  it('covers eight explicit Sunday tones and each weekday without claiming the annual cycle', () => {
    expect(library.completeness.annualCycle).toBe(false);
    expect(library.completeness.automaticAssignment).toBe(false);
    for (let tone = 1; tone <= 8; tone++) {
      const rows = listLiturgicalTexts(library, { scope: 'resurrection', tone, weekday: 0 });
      expect(rows.map(row => row.type).sort()).toEqual(['kontakion', 'troparion']);
    }
    for (let weekday = 1; weekday <= 6; weekday++) {
      expect(listLiturgicalTexts(library, { scope: 'weekday', weekday }).length).toBeGreaterThanOrEqual(2);
    }
    expect(listLiturgicalTexts(library, { scope: 'weekday', weekday: 3 })).toEqual(listLiturgicalTexts(library, { scope: 'weekday', weekday: 5 }));
  });
  it('stores traceable plain Church Slavonic text, not HTML, translations or editorial commentary', () => {
    expect(new Set(library.texts.map(row => row.id)).size).toBe(library.texts.length);
    expect(library.contentHash).toBe(createHash('sha256').update(JSON.stringify(library.texts)).digest('hex'));
    for (const row of library.texts) {
      expect(row.id).toMatch(/^[a-z0-9-]+$/);
      expect(row.text.length).toBeGreaterThan(35);
      expect(row.text).not.toMatch(/[<>]|&[a-z#0-9]+;|Перевод:|https?:|[a-zA-Z]/);
      expect(row.language).toBe('cu');
      expect(LITURGICAL_TEXT_TYPES).toContain(row.type);
      expect(LITURGICAL_TEXT_SCOPES).toContain(row.scope);
      expect(row.tone === null || Number.isInteger(row.tone) && row.tone >= 1 && row.tone <= 8).toBe(true);
      expect(row.weekdays.every(day => Number.isInteger(day) && day >= 0 && day <= 6)).toBe(true);
      expect(row.sources.length).toBeGreaterThan(0);
      expect(row.sources[0]!.url).toMatch(/^https:\/\/azbyka\.ru\//);
      expect(row.review.status).toBe('source-transcribed');
      expect(row.rights.status).toBe('public-domain');
    }
  });
  it('returns only the exact requested reference and does not guess unknown identifiers or languages', () => {
    expect(getLiturgicalText(library, 'resurrection-tone-1-troparion')?.text).toContain('Ка́мени запеча́тану');
    expect(getLiturgicalText(library, '2026-09-09')).toBeUndefined();
    expect(listLiturgicalTexts(library, { language: 'ru' })).toEqual([]);
    expect(listLiturgicalTexts(library, { tone: 9 })).toEqual([]);
    expect(listLiturgicalTexts(library, { weekday: 7 })).toEqual([]);
    expect(listLiturgicalTexts(library, { tone: 1.5 })).toEqual([]);
    expect(listLiturgicalTexts(library, { scope: 'common', weekday: 0 })).toEqual([]);
    expect(listLiturgicalTexts(library, { id: 'resurrection-tone-1-troparion', type: 'kontakion' })).toEqual([]);
  });
  it('preserves name placeholders in common references without substituting a saint automatically', () => {
    expect(getLiturgicalText(library, 'common-05-troparion')?.text).toContain('(имярек)');
    expect(listLiturgicalTexts(library, { type: 'prayer' })).toHaveLength(4);
    expect(listLiturgicalTexts(library, { type: 'magnification' })).toHaveLength(12);
  });
  it('distinguishes present prayers and magnifications from a complete corpus and assigns no dates or tones', () => {
    expect(library.availability).toEqual({ prayers: true, magnifications: true });
    expect(library.completeness.prayers).toBe(false);
    expect(library.completeness.magnifications).toBe(false);
    for (const type of ['prayer', 'magnification'] as const) {
      for (const row of listLiturgicalTexts(library, { type })) {
        expect(row.scope).toBe('common');
        expect(row.tone).toBeNull();
        expect(row.weekdays).toEqual([]);
        expect(row.subject).toBeTruthy();
      }
    }
    expect(getLiturgicalText(library, 'prayer-lords-prayer')?.text).toMatch(/^О́тче наш.+лука́ваго\.$/);
    expect(getLiturgicalText(library, 'magnification-annunciation')?.text).toContain('Арха́нгельский глас');
    expect(getLiturgicalText(library, 'prayer-holy-trinity')?.text).not.toMatch(/\d|сноск|Перевод/);
  });
});
