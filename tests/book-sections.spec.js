import { describe, expect, it } from 'vitest';
import { sourceBookIndex, readBookLocation, BOOK_URL_KEYS } from '../public/calendar-ui/book-library.js';
import { sourceBookSections, selectBookSection, BOOK_SECTION_BLOCK_LIMIT, BOOK_SECTION_TEXT_LIMIT } from '../public/calendar-ui/book-sections.js';
import { libraryFixture, octoechosFixture } from './fixtures/book-library.mjs';

describe('bounded source-book sections', () => {
  it('bounds a long Menaion chapter without inventing tones or changing any source block', () => {
    const book = libraryFixture(undefined, 241).data;
    const sections = sourceBookSections(book, sourceBookIndex(book));
    expect(sections.length).toBeGreaterThan(1);
    expect(sections.every(section => section.end - section.start <= BOOK_SECTION_BLOCK_LIMIT && section.tone === '' && section.weekday === '0')).toBe(true);
    expect(JSON.stringify(sections.flatMap(section => book.blocks.slice(section.start, section.end)))).toBe(JSON.stringify(book.blocks));
    expect(selectBookSection(sections, {})).toBe(sections[0]);
    expect(selectBookSection(sections, { bookPart: sections[1].id })).toBe(sections[1]);
  });
  it('bounds Menaion text volume, preserves indivisible blocks and recognises legacy source locators', () => {
    const long = libraryFixture(undefined, 12).data;
    long.blocks.forEach(block => { block.segments = [{ text: 'Сло́во '.repeat(400) }]; });
    const bounded = sourceBookSections(long, sourceBookIndex(long));
    expect(bounded.length).toBeGreaterThan(1);
    expect(bounded.every(section => long.blocks.slice(section.start, section.end).reduce((sum, block) => sum + block.segments[0].text.length, 0) <= BOOK_SECTION_TEXT_LIMIT)).toBe(true);
    expect(bounded.flatMap(section => long.blocks.slice(section.start, section.end))).toEqual(long.blocks);
    const book = libraryFixture('legacy-minea', 3).data;
    book.source_url = 'https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/mineja-na-tserkovnoslavjanskom-jazyke-mart/25';
    book.blocks.forEach(block => { block.segments = [{ text: 'Сло́во '.repeat(3200) }]; });
    const sections = sourceBookSections(book, sourceBookIndex(book));
    expect(sections.map(section => section.end - section.start)).toEqual([1, 1, 1]);
    expect(sections.flatMap(section => book.blocks.slice(section.start, section.end))).toEqual(book.blocks);
    expect(sourceBookSections(libraryFixture().data, { tones: [], headings: [] })).toEqual([]);
    expect(sourceBookSections(libraryFixture('other-book', 241).data, { tones: [], headings: [] })).toEqual([]);
  });
  it('partitions all eight tones, preface and appendices exactly once in printed order', () => {
    const book = octoechosFixture().data, original = JSON.stringify(book.blocks), sections = sourceBookSections(book, sourceBookIndex(book));
    expect(sections.flatMap(s => book.blocks.slice(s.start, s.end))).toEqual(book.blocks);
    expect(JSON.stringify(sections.flatMap(s => book.blocks.slice(s.start, s.end)))).toBe(original);
    expect(sections[0]).toMatchObject({ tone: 'preface', start: 0 }); expect(sections.at(-1).tone).toBe('appendices');
    expect([...new Set(sections.map(s => s.tone).filter(s => /^[1-8]$/.test(s)))]).toEqual(['1','2','3','4','5','6','7','8']);
    sections.forEach((s, i) => { expect(s.end).toBeGreaterThan(s.start); if (i) expect(s.start).toBe(sections[i-1].end); });
    expect(JSON.stringify(book.blocks)).toBe(original);
  });
  it('uses the requested printed day or section and never defaults to the whole book or tone', () => {
    const book = octoechosFixture().data, sections = sourceBookSections(book, sourceBookIndex(book));
    expect(selectBookSection(sections, {})).toMatchObject({ tone: '1', weekday: '7' });
    const selected = selectBookSection(sections, { bookTone: '8', bookWeekday: '1' });
    expect(selected.end - selected.start).toBe(3);
    expect(selectBookSection(sections, { bookPart: sections[0].id })).toBe(sections[0]);
    expect(selectBookSection(sections, { bookTone: '8', bookPart: 's99999' }).tone).toBe('8');
  });
  it('bounds a long service by printed structural headings, then by size without dropping blocks', () => {
    const book = octoechosFixture().data;
    const firstDay = book.blocks.findIndex(b => b.text === 'Въ недѣ́лю оу҆́тра');
    const extra = Array.from({length: 205}, (_, i) => ({ id: 'long-'+i, kind: 'text', segments: [{ text: i === 60 || i === 130 ? 'Пѣ́снь а҃' : 'Сло́во '.repeat(70) }] }));
    book.blocks.splice(firstDay + 1, 0, ...extra);
    const sections = sourceBookSections(book, sourceBookIndex(book));
    expect(sections.flatMap(s => book.blocks.slice(s.start, s.end))).toEqual(book.blocks);
    expect(sections.every(s => s.end-s.start <= BOOK_SECTION_BLOCK_LIMIT)).toBe(true);
    expect(sections.every(s => book.blocks.slice(s.start,s.end).reduce((sum,b) => sum+b.segments.map(s=>s.text).join('').length,0) <= BOOK_SECTION_TEXT_LIMIT)).toBe(true);
    expect(sections.some(s => s.title === 'Пѣ́снь а҃')).toBe(true);
  });
  it('handles an uncertain tone index without inventing numbered tones or losing source blocks', () => {
    const book = octoechosFixture().data; book.blocks.splice(1,1);
    const index=sourceBookIndex(book); expect(index.tones).toEqual([]);
    const sections=sourceBookSections(book,index);expect(sections.flatMap(s=>book.blocks.slice(s.start,s.end))).toEqual(book.blocks);
    expect(sections.every(s=>s.tone === 'preface')).toBe(true);
  });
  it('round-trips part deep links, preface and appendix scope independently of dated context', () => {
    const state = { date:'2027-01-01', temple:'nicholas' };
    readBookLocation(new URLSearchParams({book:'octoechos-ponomar-whole',edition:'library-cu',bookTone:'appendices',bookWeekday:'0',bookPart:'s14037'}),state);
    expect(state).toMatchObject({bookPart:'s14037',bookTone:'appendices',bookWeekday:'0',date:'2027-01-01'}); expect(BOOK_URL_KEYS).toContain('bookPart');
    readBookLocation(new URLSearchParams({bookPart:'../bad'}),state);expect(state.bookPart).toBe('');
  });
});
