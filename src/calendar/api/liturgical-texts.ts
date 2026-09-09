/** A reference library, never a service/tone assignment engine. */
export const LITURGICAL_TEXT_TYPES = ['troparion', 'kontakion', 'prayer', 'magnification'] as const;
export const LITURGICAL_TEXT_SCOPES = ['resurrection', 'weekday', 'common'] as const;
export type LiturgicalTextType = typeof LITURGICAL_TEXT_TYPES[number];
export type LiturgicalTextScope = typeof LITURGICAL_TEXT_SCOPES[number];
export interface LiturgicalText {
  id: string;
  type: LiturgicalTextType;
  title: string;
  language: 'cu';
  orthography: 'civil' | 'civil-accented';
  text: string;
  scope: LiturgicalTextScope;
  tone: number | null;
  /** Sunday = 0, Monday = 1. Empty means no weekday restriction in this source. */
  weekdays: number[];
  subject: string | null;
  sources: { url: string; title: string; accessedAt: string }[];
  rights: { status: 'public-domain'; basis: string };
  review: { status: 'source-transcribed' | 'editor-reviewed'; note: string };
}
export interface LiturgicalTextLibrary {
  schemaVersion: 1;
  version: string;
  contentHash: string;
  /** Presence is separate from completeness of a category. */
  availability: { prayers: boolean; magnifications: boolean };
  completeness: {
    annualCycle: false;
    automaticAssignment: false;
    resurrectionTones: number[];
    weekdayCycle: boolean;
    prayers: boolean;
    magnifications: boolean;
    akathists: false;
  };
  texts: LiturgicalText[];
}
export interface LiturgicalTextFilter {
  id?: string;
  type?: LiturgicalTextType;
  scope?: LiturgicalTextScope;
  tone?: number;
  weekday?: number;
  language?: string;
  subject?: string;
}

/** Filters are ANDed; unknown language/id gives an empty result, never fallback. */
export function listLiturgicalTexts(library: LiturgicalTextLibrary, filter: LiturgicalTextFilter = {}): LiturgicalText[] {
  if (filter.tone !== undefined && (!Number.isInteger(filter.tone) || filter.tone < 1 || filter.tone > 8)) return [];
  if (filter.weekday !== undefined && (!Number.isInteger(filter.weekday) || filter.weekday < 0 || filter.weekday > 6)) return [];
  return library.texts.filter(text =>
    (filter.id === undefined || text.id === filter.id) &&
    (filter.type === undefined || text.type === filter.type) &&
    (filter.scope === undefined || text.scope === filter.scope) &&
    (filter.tone === undefined || text.tone === filter.tone) &&
    (filter.weekday === undefined || text.weekdays.includes(filter.weekday)) &&
    (filter.language === undefined || text.language === filter.language) &&
    (filter.subject === undefined || text.subject === filter.subject));
}

export function getLiturgicalText(library: LiturgicalTextLibrary, id: string): LiturgicalText | undefined {
  return library.texts.find(text => text.id === id);
}
