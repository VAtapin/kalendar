// Published library resources only. No calendar, service template or assignments requests.
export const BOOK_GROUPS = { minea: 'Минеи', octoechos: 'Октоих', other: 'Другие книги и тексты', all: 'Все книги и тексты' };
export const BOOK_MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const BOOK_WEEKDAYS = { '1': 'Понедельник', '2': 'Вторник', '3': 'Среда', '4': 'Четверг', '5': 'Пятница', '6': 'Суббота', '7': 'Воскресенье' };
export const BOOK_URL_KEYS = ['view', 'lang', 'book', 'edition', 'bookGroup', 'bookMonth', 'bookDay', 'bookTone', 'bookWeekday', 'bookPart', 'textSize'];
const token = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/;
const sourceMonths = ['janvar', 'fevral', 'mart', 'aprel', 'maj', 'iyun', 'iyul', 'avgust', 'sentjabr', 'oktjabr', 'nojabr', 'dekabr'];
export function bookSearchText(value) {
  return String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[ъь]/g, '').replace(/ѣ/g, 'е').replace(/ѧ/g, 'я').replace(/ꙋ/g, 'у').replace(/[ѡѻ]/g, 'о').replace(/[іѵ]/g, 'и').replace(/є/g, 'е').replace(/ѳ/g, 'ф').replace(/\s+/g, ' ').trim();
}
export function mineaLocator(work) {
  const slug = /^whole-cu-minea-(\d{2})-([1-9]\d?)$/.exec(work.slug || '');
  if (slug && Number(slug[1]) >= 1 && Number(slug[1]) <= 12 && Number(slug[2]) <= 31) return { month: Number(slug[1]), day: Number(slug[2]) };
  try {
    const url = new URL(work.source_url), match = /\/mineja-na-tserkovnoslavjanskom-jazyke-([a-z]+)\/([1-9]\d?)\/?$/.exec(url.pathname);
    const month = match && sourceMonths.indexOf(match[1]) + 1;
    if (url.hostname === 'azbyka.ru' && month && Number(match[2]) <= 31) return { month, day: Number(match[2]) };
  } catch { /* A source URL is optional catalogue metadata. */ }
  return null;
}
export function validateBookCatalogue(value) {
  if (!Array.isArray(value?.data)) throw new Error('Invalid book catalogue');
  const entries = [], identities = new Set();
  for (const work of value.data) {
    if (!token.test(work?.slug || '') || typeof work.title !== 'string' || !Array.isArray(work.editions)) throw new Error('Invalid published work');
    for (const edition of work.editions) {
      if (edition.language !== 'cu' || edition.orthography !== 'traditional') continue;
      const key = work.slug + ':' + edition.code;
      if (!token.test(edition.code || '') || identities.has(key)) throw new Error('Ambiguous book edition');
      identities.add(key);
      const locator = mineaLocator(work);
      entries.push({ slug: work.slug, title: work.title, edition: { ...edition }, source_url: work.source_url,
        locator, group: locator ? 'minea' : work.slug === 'octoechos-ponomar-whole' ? 'octoechos' : 'other' });
    }
  }
  return entries.sort((a, b) => (a.locator?.month || 99) - (b.locator?.month || 99)
    || (a.locator?.day || 99) - (b.locator?.day || 99) || a.title.localeCompare(b.title, 'ru'));
}
async function libraryRequest(base, path, params, fetcher, signal) {
  const url = new URL('/api/liturgical/' + path, base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetcher(url, { credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) });
  if (response.status !== 200) throw new Error('Book request failed: ' + response.status);
  return response.json();
}
export async function fetchBookCatalogue(base, fetcher = fetch, signal) {
  return validateBookCatalogue(await libraryRequest(base, 'works', { language: 'cu' }, fetcher, signal));
}
export function validateBookText(value, entry) {
  const data = value?.data;
  if (data?.slug !== entry.slug || data.edition !== entry.edition.code || data.language !== 'cu' || data.orthography !== 'traditional'
    || data.reader_profile !== entry.edition.reader_profile || typeof data.title !== 'string' || !Array.isArray(data.blocks) || !data.blocks.length
    || !/^[a-f0-9]{64}$/.test(data.content_hash || '')) throw new Error('Wrong published book edition');
  const ids = new Set();
  for (const block of data.blocks) {
    if (typeof block?.id !== 'string' || ids.has(block.id) || typeof block.kind !== 'string' || !Array.isArray(block.segments) || !block.segments.length
      || block.segments.some(segment => typeof segment?.text !== 'string')
      || (block.text !== undefined && block.text !== block.segments.map(segment => segment.text).join(''))) throw new Error('Invalid published book body');
    ids.add(block.id);
  }
  if (data.artifactType === 'source-book' && (data.appointedForDate !== false || data.cleanTemplate !== false
    || data.bookCompleteness !== 'whole-source-section' || typeof data.sourceReviewBasis !== 'string')) throw new Error('Invalid source book context');
  return data;
}
export async function fetchBookText(base, entry, fetcher = fetch, signal) {
  return validateBookText(await libraryRequest(base, 'works/' + encodeURIComponent(entry.slug) + '/versions/cu', { edition: entry.edition.code }, fetcher, signal), entry);
}
export function filterBooks(entries, { bookGroup = 'minea', bookMonth = '', bookDay = '', query = '' }) {
  const search = bookSearchText(query);
  return entries.filter(entry => (bookGroup === 'all' || entry.group === bookGroup)
    && (bookGroup !== 'minea' || ((!bookMonth || entry.locator.month === Number(bookMonth)) && (!bookDay || entry.locator.day === Number(bookDay))))
    && (!search || bookSearchText(entry.title + ' ' + (entry.edition.title || '')).includes(search)));
}
export function sourceBookIndex(book) {
  const tones = [], headings = [], endings = [];
  const numerals = { а: 1, в: 2, г: 3, д: 4, е: 5, ѕ: 6, з: 7, и: 8 };
  book.blocks.forEach((block, index) => {
    const text = block.segments.map(segment => segment.text).join(''), normalized = bookSearchText(text);
    const tone = book.slug === 'octoechos-ponomar-whole' && /^глас ([авгдеѕзи])[.]?$/.exec(normalized);
    const day = text.length <= 140 && /^(?:в|во) (понедел|вторник|сред|четвер|пят|суббот|недел)/.exec(normalized);
    const weekday = day ? ['понедел', 'вторник', 'сред', 'четвер', 'пят', 'суббот', 'недел'].indexOf(day[1]) + 1 : null;
    if (tone) tones.push({ tone: numerals[tone[1]], index, text });
    if (/^конец \S+ гласу[.]?$/.test(normalized)) endings.push(index);
    const capitals = text.length <= 100 && /\p{L}/u.test(text) && text === text.toUpperCase();
    if (tone || day || capitals || block.kind === 'heading' || (text.length <= 140 && block.segments.every(segment => segment.style === 'rubric'))) headings.push({ index, text, weekday });
  });
  // A tone selector is safe only when the source has one unambiguous ordered heading per tone.
  const completeTones = tones.length === 8 && tones.every((item, index) => item.tone === index + 1);
  return { tones: completeTones ? tones.map((item, index) => {
    const next = tones[index + 1]?.index ?? book.blocks.length;
    const closing = endings.filter(position => position > item.index && position < next);
    return { ...item, end: closing.length === 1 ? closing[0] + 1 : next };
  }) : [], headings };
}
export function bookBlockRange(book, index, tone = '') {
  const selected = index.tones.find(item => item.tone === Number(tone));
  return { start: selected?.index ?? 0, end: selected?.end ?? book.blocks.length };
}
export function readBookLocation(params, state) {
  state.book = token.test(params.get('book') || '') ? params.get('book') : '';
  state.edition = token.test(params.get('edition') || '') ? params.get('edition') : '';
  state.bookPart = /^s\d{1,6}$/.test(params.get('bookPart') || '') ? params.get('bookPart') : '';
  state.bookGroup = Object.hasOwn(BOOK_GROUPS, params.get('bookGroup')) ? params.get('bookGroup') : 'minea';
  for (const [key, max] of [['bookMonth', 12], ['bookDay', 31], ['bookTone', 8], ['bookWeekday', 7]]) {
    const value = params.get(key); state[key] = /^[1-9]\d?$/.test(value || '') && Number(value) <= max ? value : '';
  }
  if (['preface', 'appendices'].includes(params.get('bookTone'))) state.bookTone = params.get('bookTone');
  if (params.get('bookWeekday') === '0') state.bookWeekday = '0';
}
