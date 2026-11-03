import { describe, expect, it } from 'vitest';
import { BOOK_URL_KEYS, bookBlockRange, bookSearchText, fetchBookCatalogue, fetchBookText, filterBooks, mineaLocator, readBookLocation, sourceBookIndex, validateBookCatalogue, validateBookText } from '../public/calendar-ui/book-library.js';
import { libraryFixture, octoechosFixture } from './fixtures/book-library.mjs';

describe('independent published book library', () => {
  it('requests only the published CU catalogue and the exact selected edition, with no date or appointments', async () => {
    const f = libraryFixture(), urls = [];
    const fetcher = async (url, options) => { urls.push(url); expect(options.credentials).toBe('omit'); return { status: 200, json: async () => url.pathname.endsWith('/works') ? f.catalogue : { data: f.data } }; };
    const entries = await fetchBookCatalogue('https://bible.example', fetcher);
    expect((await fetchBookText('https://bible.example', entries[0], fetcher)).blocks).toEqual(f.data.blocks);
    expect(urls[0].pathname).toBe('/api/liturgical/works'); expect(urls[0].search).toBe('?language=cu');
    expect(urls[1].searchParams.get('edition')).toBe(f.data.edition);
    expect(urls.every(url => !/calendar|assignments|templates|services/.test(url.pathname))).toBe(true);
    expect(urls.every(url => !url.searchParams.has('date') && !url.searchParams.has('temple'))).toBe(true);
  });
  it('keeps only published native-CU editions returned by the catalogue and refuses duplicate identities', () => {
    const f = libraryFixture(); f.work.editions.push({ ...f.work.editions[0], code: 'civil', orthography: 'civil' }, { ...f.work.editions[0], code: 'ru', language: 'ru' });
    expect(validateBookCatalogue(f.catalogue)).toHaveLength(1);
    f.work.editions.push(f.work.editions[0]); expect(() => validateBookCatalogue(f.catalogue)).toThrow('Ambiguous');
  });
  it.each([404, 409, 403, 429, 503])('never substitutes another book, language or edition on HTTP %s', async status => {
    const f = libraryFixture(), entries = validateBookCatalogue(f.catalogue); let calls = 0;
    await expect(fetchBookText('https://bible.example', entries[0], async () => { calls++; return { status }; })).rejects.toThrow(); expect(calls).toBe(1);
  });
  it.each(['edition', 'language', 'orthography', 'slug', 'profile', 'text', 'duplicate', 'service-flag'])('rejects incorrect book response %s', problem => {
    const f = libraryFixture(), entry = validateBookCatalogue(f.catalogue)[0];
    if (problem === 'edition') f.data.edition = 'another';
    if (problem === 'language') f.data.language = 'ru';
    if (problem === 'orthography') f.data.orthography = 'civil';
    if (problem === 'slug') f.data.slug = 'another';
    if (problem === 'profile') f.data.reader_profile = 'short';
    if (problem === 'text') f.data.blocks[0].text = 'wrong copy';
    if (problem === 'duplicate') f.data.blocks.push(f.data.blocks[0]);
    if (problem === 'service-flag') f.data.appointedForDate = true;
    expect(() => validateBookText({ data: f.data }, entry)).toThrow();
  });
  it('recognizes bibliographic Minea chapters without treating chapter numbers as calendar dates', () => {
    expect(mineaLocator({ slug: 'whole-cu-minea-06-31' })).toEqual({ month: 6, day: 31 });
    expect(mineaLocator({ slug: 'legacy', source_url: 'https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/mineja-na-tserkovnoslavjanskom-jazyke-dekabr/24' })).toEqual({ month: 12, day: 24 });
    expect(mineaLocator({ slug: 'unknown-legacy' })).toBeNull();
    expect(mineaLocator({ slug: 'legacy', source_url: 'https://evil.example/mineja-na-tserkovnoslavjanskom-jazyke-dekabr/24' })).toBeNull();
  });
  it('keeps unknown legacy and one-block published texts searchable without calling them whole books', () => {
    const f = libraryFixture('legacy-text', 1), entries = validateBookCatalogue(f.catalogue);
    expect(entries[0].group).toBe('other');
    expect(filterBooks(entries, { bookGroup: 'other', query: 'ТЕСТ' })).toHaveLength(1);
    expect(f.work.title).toBe('Кни́га: те́стъ'); expect(bookSearchText(f.work.title)).toBe('книга: тест');
  });
  it('builds tone/day navigation only from the source and leaves preface and appendices in the whole-book range', () => {
    const f = octoechosFixture(), original = JSON.stringify(f.data.blocks), index = sourceBookIndex(f.data);
    expect(index.tones.map(item => item.tone)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const eighth = bookBlockRange(f.data, index, '8'); expect(eighth.end).toBe(f.data.blocks.length - 2);
    expect(index.headings.some(item => item.weekday === 1)).toBe(true); expect(index.headings.some(item => item.weekday === 7)).toBe(true);
    expect(bookBlockRange(f.data, index, '')).toEqual({ start: 0, end: f.data.blocks.length }); expect(JSON.stringify(f.data.blocks)).toBe(original);
    f.data.blocks.push({ ...f.data.blocks[1], id: 'duplicate-tone' }); expect(sourceBookIndex(f.data).tones).toEqual([]);
  });
  it('keeps book URLs separate from date, temple and office state and validates incoming identifiers', () => {
    expect(BOOK_URL_KEYS).not.toEqual(expect.arrayContaining(['date', 'temple', 'office']));
    const state = { date: '2027-05-01', temple: 'nicholas', office: 'matins' };
    readBookLocation(new URLSearchParams({ book: '../private', edition: 'ru/other', bookTone: '9', bookMonth: '13' }), state);
    expect(state.book).toBe(''); expect(state.edition).toBe(''); expect(state.bookTone).toBe(''); expect(state.date).toBe('2027-05-01');
  });
});
