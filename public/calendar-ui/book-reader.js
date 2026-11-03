import { createReaderPdfControls } from './reader-pdf-controls.js';
import { BOOK_GROUPS, BOOK_MONTHS, BOOK_WEEKDAYS, bookSearchText, fetchBookCatalogue, fetchBookText, filterBooks, sourceBookIndex, bookBlockRange } from './book-library.js';

const nextFrame = () => new Promise(resolve => globalThis.requestAnimationFrame ? requestAnimationFrame(resolve) : setTimeout(resolve, 0));
export function createBookReader({ base, state, create, onStateChange, onCalendar, fetcher = fetch, print = () => globalThis.print(), pdfLoad, yieldFrame = nextFrame }) {
  const page = create('section', '', 'worship-page book-page');
  const title = create('h2', 'Книги'), back = create('button', '← К календарю', 'reader-button'); back.type = 'button'; back.addEventListener('click', onCalendar);
  page.append(back, title, create('p', 'Библиотека опубликованных церковнославянских источников.', 'hint'));
  const catalogue = create('details', '', 'book-catalog'); catalogue.open = true; catalogue.append(create('summary', 'Выбрать книгу'));
  const filters = create('div', '', 'worship-controls book-controls'); catalogue.append(filters);
  function select(label, field, options, handler) {
    const wrapper = create('label', label, 'control'), input = create('select'); input.dataset.bookControl = field;
    for (const [value, text] of Object.entries(options)) { const option = create('option', text); option.value = value; input.append(option); }
    input.addEventListener('change', () => handler(input.value)); wrapper.append(input); filters.append(wrapper); return input;
  }
  const group = select('Раздел библиотеки', 'bookGroup', BOOK_GROUPS, value => changeFilter({ bookGroup: value, bookMonth: '', bookDay: '' }));
  const month = select('Месяц Минеи', 'bookMonth', { '': 'Все месяцы', ...Object.fromEntries(BOOK_MONTHS.map((value, index) => [String(index + 1), value])) }, value => changeFilter({ bookMonth: value, bookDay: '' }));
  const day = select('День в Минее', 'bookDay', { '': 'Все опубликованные главы' }, value => changeFilter({ bookDay: value }));
  const searchLabel = create('label', 'Поиск по названиям книг', 'control'), search = create('input'); search.type = 'search'; searchLabel.append(search); filters.append(searchLabel);
  group.disabled = true; month.disabled = true; day.disabled = true; search.disabled = true;
  const listStatus = create('p', 'Загружаю каталог книг…', 'hint'), list = create('div', '', 'book-list'); catalogue.append(create('p', 'Месяц и день — по печатной Минее (старый стиль), а не гражданская дата службы. Память можно найти по названию.', 'hint'), listStatus, list); page.append(catalogue);
  const controls = create('div', '', 'worship-controls book-controls'); page.append(controls);
  const sizeLabel = create('label', 'Размер текста', 'control'), size = create('input'); size.type = 'range'; size.min = '18'; size.max = '32'; size.value = String(state.textSize || 22); sizeLabel.append(size); controls.append(sizeLabel);
  const toneLabel = create('label', 'Глас Октоиха', 'control'), tone = create('select'); tone.dataset.bookControl = 'bookTone'; toneLabel.append(tone); controls.append(toneLabel);
  const weekdayLabel = create('label', 'Переход к дню недели', 'control'), weekday = create('select'); weekday.dataset.bookControl = 'bookWeekday'; weekdayLabel.append(weekday); controls.append(weekdayLabel);
  const printButton = create('button', 'Печать открытого текста', 'reader-button'); printButton.type = 'button'; printButton.disabled = true; controls.append(printButton);
  const content = create('div', '', 'book-content'); content.setAttribute('aria-live', 'polite'); page.append(content);
  let entries = [], book, index, entry, controller, disposed = false, generation = 0, complete = false, visibleLimit = 60, wantedIndex;
  let activeRange, blockNodes = new Map(), navigationObserver;
  const pdf = createReaderPdfControls({ create, load: pdfLoad, host: controls, available: () => complete && !disposed, selection: () => generation + ':' + (state.bookWeekday || ''), getSnapshot: () => getDocument() });
  function dataNode(tag, value, className = '') { const node = create(tag, null, className); node.textContent = value; return node; }
  function save(values) { Object.assign(state, values); onStateChange(values); }
  function clearBook() {
    ++generation; controller?.abort(); navigationObserver?.disconnect(); book = null; index = null; entry = null; activeRange = null; wantedIndex = undefined; complete = false; printButton.disabled = true; content.replaceChildren(); pdf.refresh();
    toneLabel.hidden = true; weekdayLabel.hidden = true; blockNodes.clear();
  }
  function changeFilter(values) { clearBook(); save({ ...values, book: '', edition: '', bookTone: '', bookWeekday: '' }); visibleLimit = 60; updateFilters(); renderList(); }
  function setOptions(input, values, selected) {
    input.replaceChildren();
    for (const [value, text] of Object.entries(values)) { const option = create('option', text); option.value = value; input.append(option); }
    input.value = selected;
  }
  function updateFilters() {
    group.value = state.bookGroup || 'minea'; month.value = state.bookMonth || ''; month.parentElement && (month.parentElement.hidden = group.value !== 'minea');
    day.disabled = group.value !== 'minea'; month.disabled = group.value !== 'minea';
    const days = [...new Set(entries.filter(item => item.group === 'minea' && (!state.bookMonth || item.locator.month === Number(state.bookMonth))).map(item => item.locator.day))].sort((a, b) => a - b);
    setOptions(day, { '': 'Все опубликованные главы', ...Object.fromEntries(days.map(value => [String(value), String(value)])) }, state.bookDay || '');
  }
  function renderList() {
    list.replaceChildren();
    const found = filterBooks(entries, { ...state, query: search.value || '' });
    listStatus.replaceChildren(create('span', 'Найдено редакций:'), dataNode('span', ' ' + found.length));
    for (const item of found.slice(0, visibleLimit)) {
      const button = create('button', '', 'book-card'); button.type = 'button'; button.dataset.bookSlug = item.slug; button.dataset.bookEdition = item.edition.code;
      if (item.locator) button.append(create('span', BOOK_MONTHS[item.locator.month - 1], 'edition-label'), dataNode('span', ' · ' + item.locator.day));
      const heading = dataNode('span', item.title); heading.dataset.textLanguage = 'cu'; heading.lang = 'cu'; button.append(heading);
      button.append(dataNode('small', item.edition.title || item.edition.code, 'edition-label'));
      button.addEventListener('click', () => { save({ book: item.slug, edition: item.edition.code, bookTone: '', bookWeekday: '' }); void openBook(item); }); list.append(button);
    }
    if (!found.length) list.append(create('p', 'В опубликованном каталоге нет подходящей редакции.', 'reader-message'));
    if (found.length > visibleLimit) { const more = create('button', 'Показать ещё', 'reader-button'); more.type = 'button'; more.addEventListener('click', () => { visibleLimit += 60; renderList(); }); list.append(more); }
  }
  search.addEventListener('input', () => { visibleLimit = 60; renderList(); });
  size.addEventListener('input', () => { page.style.setProperty('--reader-size', size.value + 'px'); save({ textSize: Number(size.value) }); });
  page.style.setProperty('--reader-size', size.value + 'px');
  tone.addEventListener('change', () => { save({ bookTone: tone.value, bookWeekday: '' }); void renderBook(); });
  weekday.addEventListener('change', () => { save({ bookWeekday: weekday.value }); pdf.refresh(); jumpToDay(); });
  function jump(position) {
    const node = blockNodes.get(position);
    if (node) { node.scrollIntoView?.({ block: 'start' }); node.focus?.({ preventScroll: true }); wantedIndex = undefined; }
    else wantedIndex = position;
  }
  function jumpToDay() {
    const target = index?.headings.find(heading => heading.index >= activeRange.start && heading.index < activeRange.end && heading.weekday === Number(state.bookWeekday));
    if (target) jump(target.index);
  }
  async function openBook(selected) {
    clearBook(); entry = selected; catalogue.open = false;
    save({ book: selected.slug, edition: selected.edition.code, bookGroup: selected.group,
      bookMonth: selected.locator ? String(selected.locator.month) : '', bookDay: selected.locator ? String(selected.locator.day) : '' });
    updateFilters(); renderList();
    const request = generation; controller = new AbortController();
    content.append(create('p', 'Загружаю выбранную книгу…', 'reader-message'));
    try {
      const value = await fetchBookText(base, selected, fetcher, controller.signal);
      if (disposed || request !== generation) return;
      book = value; index = sourceBookIndex(book); await renderBook();
    } catch {
      if (!disposed && request === generation) { content.replaceChildren(create('p', 'Эта редакция сейчас недоступна. Другая редакция или язык не подставлены.', 'reader-message')); complete = false; printButton.disabled = true; }
    }
  }
  async function renderBook() {
    if (!book || disposed) return;
    const request = ++generation, value = book;
    complete = false; printButton.disabled = true; pdf.refresh(); navigationObserver?.disconnect(); content.replaceChildren(); blockNodes = new Map();
    activeRange = bookBlockRange(value, index, state.bookTone);
    const selectedTone = index.tones.find(item => item.tone === Number(state.bookTone));
    if (state.bookTone && !selectedTone) save({ bookTone: '', bookWeekday: '' });
    toneLabel.hidden = !index.tones.length;
    setOptions(tone, { '': 'Весь источник', ...Object.fromEntries(index.tones.map(item => [String(item.tone), String(item.tone)])) }, state.bookTone || '');
    weekdayLabel.hidden = !selectedTone;
    const weekdays = [...new Set(index.headings.filter(item => item.index >= activeRange.start && item.index < activeRange.end && item.weekday).map(item => item.weekday))];
    if (state.bookWeekday && (!selectedTone || !weekdays.includes(Number(state.bookWeekday)))) save({ bookWeekday: '' });
    setOptions(weekday, { '': 'К началу раздела', ...Object.fromEntries(weekdays.map(day => [String(day), BOOK_WEEKDAYS[day]])) }, state.bookWeekday || '');
    const sourceTitle = dataNode('h2', value.title); sourceTitle.dataset.textLanguage = 'cu'; sourceTitle.lang = 'cu'; content.append(sourceTitle);
    content.append(create('p', value.artifactType === 'source-book'
      ? 'В тексте сохранены исходные рубрики и отсылки.'
      : 'Объём опубликованного текста определяется выбранной редакцией.', 'hint'));
    if (selectedTone) { const label = dataNode('p', selectedTone.text, 'book-section-title'); label.dataset.textLanguage = 'cu'; label.lang = 'cu'; content.append(label); }
    if (selectedTone) content.append(create('p', 'Открыт отдельный глас; предисловие и другие гласы не включены.', 'hint'));
    content.append(dataNode('p', value.edition_title, 'edition-label'));
    try {
      const source = new URL(value.source_url);
      if (['https:', 'http:'].includes(source.protocol)) { const link = create('a', 'Источник'); link.href = source.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; content.append(link); }
    } catch { /* Never turn an invalid source URL into an executable link. */ }
    const toc = create('details', '', 'worship-navigation'); toc.append(create('summary', 'Оглавление'));
    const headings = index.headings.filter(item => item.index >= activeRange.start && item.index < activeRange.end);
    for (const heading of headings) {
      const link = dataNode('a', heading.text); link.href = '#book-block-' + heading.index; link.dataset.textLanguage = 'cu'; link.lang = 'cu';
      link.addEventListener('click', event => { event.preventDefault(); jump(heading.index); }); toc.append(link);
    }
    if (headings.length) {
      content.append(toc);
      const up = create('button', '↑ К оглавлению', 'reader-button worship-to-toc'); up.type = 'button';
      up.addEventListener('click', () => { toc.open = true; toc.scrollIntoView?.({ block: 'start' }); }); content.append(up);
      if (globalThis.IntersectionObserver) {
        navigationObserver = new IntersectionObserver(([entry]) => { up.hidden = entry.isIntersecting || entry.boundingClientRect.bottom >= 0; });
        navigationObserver.observe(toc);
      }
    }
    const body = create('article', '', 'worship-text book-text'); body.dataset.textLanguage = 'cu'; body.lang = 'cu'; body.dataset.composition = 'source-book'; content.append(body);
    const headingIds = new Set(headings.map(item => item.index));
    for (let start = activeRange.start; start < activeRange.end; start += 120) {
      if (disposed || request !== generation) return;
      for (let position = start; position < Math.min(start + 120, activeRange.end); ++position) {
        const block = value.blocks[position], line = create(headingIds.has(position) ? 'h3' : 'p', '', 'worship-block');
        line.id = 'book-block-' + position; line.tabIndex = -1;
        if (block.kind === 'rubric' || block.role === 'rubric') line.classList.add('rubric');
        for (const segment of block.segments) line.append(dataNode('span', segment.text, segment.style === 'rubric' ? 'rubric' : ''));
        body.append(line); blockNodes.set(position, line);
      }
      if (wantedIndex !== undefined && blockNodes.has(wantedIndex)) jump(wantedIndex);
      await yieldFrame();
    }
    if (disposed || request !== generation) return;
    complete = true; printButton.disabled = false; pdf.refresh(); jumpToDay();
  }
  printButton.addEventListener('click', async () => {
    if (!complete || disposed) return;
    const request = generation; printButton.disabled = true;
    try { await document.fonts.ready; if (!disposed && complete && request === generation) print(); }
    finally { if (!disposed && complete && request === generation) printButton.disabled = false; }
  });
  async function start() {
    controller = new AbortController(); const request = generation;
    try {
      entries = await fetchBookCatalogue(base, fetcher, controller.signal);
      if (disposed || request !== generation) return;
      group.disabled = false; search.disabled = false;
      updateFilters(); renderList();
      if (state.book || state.edition) {
        const selected = entries.find(item => item.slug === state.book && item.edition.code === state.edition);
        if (selected) await openBook(selected);
        else content.append(create('p', 'Выбранная редакция не найдена в опубликованном каталоге.', 'reader-message'));
      }
    } catch { if (!disposed && request === generation) listStatus.textContent = create('span', 'Каталог книг сейчас недоступен. Попробуйте открыть раздел заново.').textContent; }
  }
  return { page, start, dispose() { disposed = true; pdf.dispose(); ++generation; controller?.abort(); navigationObserver?.disconnect(); book = null; entry = null; blockNodes.clear(); },
    getDocument };
  function getDocument() {
      if (!complete || !book || !entry || disposed) return null;
      const translate = text => create('span', text).textContent;
      const headings = index.headings.filter(item => item.index >= activeRange.start && item.index < activeRange.end);
      const ids = new Set(headings.map(item => item.index));
      const navigation = headings.map(item => ({ blockIndex: item.index - activeRange.start, title: item.text, language: 'cu' }));
      const firstDays = new Set();
      const contents = headings.filter(item => {
        if (!index.tones.length) return true;
        const tone = index.tones.find(tone => item.index >= tone.index && item.index < tone.end);
        if (tone?.index === item.index) return true;
        const key = tone?.tone + ':' + item.weekday;
        if (tone && item.weekday && !firstDays.has(key)) { firstDays.add(key); return true; }
        return false;
      }).map(item => ({ blockIndex: item.index - activeRange.start, title: item.text, language: 'cu' }));
      return structuredClone({ kind: 'book', title: book.title, titleLanguage: 'cu', subtitle: index.tones.find(tone => tone.tone === Number(state.bookTone))?.text,
        status: translate(book.artifactType === 'source-book' ? 'Книжный источник' : 'Опубликованный текст'), complete: false, warnings: [],
        information: [book.edition_title, ...(state.bookTone ? [translate('Открыт отдельный глас; предисловие и другие гласы не включены.')] : [])],
        sources: [book.source_url, book.credit].filter(Boolean),
        blocks: book.blocks.slice(activeRange.start, activeRange.end).map((block, offset) => ({ kind: ids.has(offset + activeRange.start) ? 'heading' : 'paragraph',
          language: 'cu', origin: 'source', runs: block.segments.map(segment => ({ text: segment.text, rubric: segment.style === 'rubric' || block.kind === 'rubric', language: 'cu' })) })),
        navigation, contents,
        sourceMetadata: { slug: book.slug, edition: book.edition, language: 'cu', orthography: 'traditional', sourceUrl: book.source_url,
          contentHash: book.content_hash, sourceScope: book.sourceScope || 'published-text', bookCompleteness: book.bookCompleteness || null, appointedForDate: false,
          selection: { kind: 'book', tone: state.bookTone || null, weekdayJump: state.bookWeekday || null, range: activeRange } },
        labels: { contents: translate('Оглавление'), sources: translate('Источники'), incomplete: translate('Книжный текст'), page: translate('Страница') } });
    }
}
