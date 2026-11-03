// Source navigation only: never calendar appointments or a reconstruction of a rite.
import { bookSearchText } from './book-library.js';
export const BOOK_SECTION_BLOCK_LIMIT = 80;
export const BOOK_SECTION_TEXT_LIMIT = 18000;
const textOf = block => block.segments.map(segment => segment.text).join('');
export function sourceBookSections(book, index) {
  if (book.slug !== 'octoechos-ponomar-whole') return [];
  const scopes = [], sections = [];
  let cursor = 0;
  for (const [toneIndex, tone] of index.tones.entries()) {
    if (cursor < tone.index) scopes.push({ start: cursor, end: tone.index, tone: cursor ? 'appendices' : 'preface' });
    const end = index.tones[toneIndex + 1]?.index ?? tone.end;
    scopes.push({ start: tone.index, end, tone: String(tone.tone) }); cursor = end;
  }
  if (cursor < book.blocks.length) scopes.push({ start: cursor, end: book.blocks.length, tone: cursor ? 'appendices' : 'preface' });
  const texts = book.blocks.map(textOf), headingAt = new Map(index.headings.map(heading => [heading.index, heading]));
  const appendixHeading = position => texts[position].length <= 180 && /^(?:прокимены|светилны |тропари воскр|песни тр|трчны сия|еилие воскр|\[?ѿпустителныя)/.test(bookSearchText(texts[position]));
  const structural = texts.map((text, position) => ({ position, text, normalized: bookSearchText(text) })).filter(({ position, text, normalized }) =>
    book.blocks[position].kind === 'heading' || (text.length <= 140 && /^(?:песн [авгдеѕзиѳ]|канон |(?:ин|иныи) канон |на (?:оу|у)трени|по \S+ (?:песни|стихословии))/.test(normalized))).map(item => item.position);
  for (const scope of scopes) {
    let weekday = '0';
    const starts = [scope.start, ...index.headings.filter(h => h.index > scope.start && h.index < scope.end && h.weekday).map(h => h.index),
      ...structural.filter(position => position > scope.start && position < scope.end && /^на (?:оу|у)трени/.test(bookSearchText(texts[position]))),
      ...(scope.tone === 'appendices' ? texts.map((_, position) => position).filter(position => position > scope.start && position < scope.end && appendixHeading(position)) : [])];
    const boundaries = [...new Set(starts)].sort((a,b) => a-b);
    for (let service = 0; service < boundaries.length; service++) {
      const serviceStart = boundaries[service], end = boundaries[service + 1] ?? scope.end;
      weekday = scope.tone === 'appendices' && appendixHeading(serviceStart) ? '0' : String(headingAt.get(serviceStart)?.weekday || weekday);
      let start = serviceStart, part = 0;
      while (start < end) {
        let limit = start, length = 0;
        while (limit < end && limit - start < BOOK_SECTION_BLOCK_LIMIT && (limit === start || length + texts[limit].length <= BOOK_SECTION_TEXT_LIMIT)) length += texts[limit++].length;
        if (limit < end) {
          const semantic = structural.filter(position => position >= start + 12 && position <= limit).at(-1);
          if (semantic !== undefined) limit = semantic;
        }
        sections.push({ id: 's' + start, start, end: limit, tone: scope.tone, weekday, serviceStart, serviceTitle: texts[serviceStart],
          title: start === serviceStart || structural.includes(start) || headingAt.has(start) ? texts[start] : '', part: ++part });
        start = limit;
      }
    }
  }
  return sections;
}
export function selectBookSection(sections, state) {
  return sections.find(section => section.id === state.bookPart)
    || sections.find(section => section.tone === (state.bookTone || '1') && section.weekday === (state.bookWeekday || '6'))
    || sections.find(section => section.tone === (state.bookTone || '1') && section.weekday !== '0')
    || sections.find(section => section.tone === (state.bookTone || '1')) || sections[0];
}
