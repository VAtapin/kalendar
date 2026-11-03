import { sourceBookSections, selectBookSection } from './book-sections.js';
import { createReaderPdfControls } from './reader-pdf-controls.js';
import { BOOK_GROUPS, BOOK_MONTHS, BOOK_WEEKDAYS, fetchBookCatalogue, fetchBookText, filterBooks, sourceBookIndex } from './book-library.js';

const nextFrame = () => new Promise(resolve => globalThis.requestAnimationFrame ? requestAnimationFrame(resolve) : setTimeout(resolve, 0));
const displayTitle = title => /^(.+?)\s+\([^()]+\)$/u.exec(title)?.[1] || title;
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
  const weekdayLabel = create('label', 'День недели в книге', 'control'), weekday = create('select'); weekday.dataset.bookControl = 'bookWeekday'; weekdayLabel.append(weekday); controls.append(weekdayLabel);
  const partLabel = create('label', 'Служба / раздел', 'control'), part = create('select'); part.dataset.bookControl = 'bookPart'; part.dataset.textLanguage = 'cu'; part.lang = 'cu'; partLabel.classList.add('book-part-control'); partLabel.append(part); controls.append(partLabel);
  const printButton = create('button', 'Печать открытого текста', 'reader-button'); printButton.type = 'button'; printButton.disabled = true; controls.append(printButton);
  const navigation = create('nav', '', 'book-section-navigation'); navigation.hidden = true;
  const previous = create('button', '← Предыдущий раздел', 'reader-button'), following = create('button', 'Следующий раздел →', 'reader-button'), showContents = create('button', 'Оглавление книги', 'reader-button');
  for (const button of [previous, following, showContents]) button.type = 'button';
  const positionLabel = create('span', '', 'hint'); navigation.append(previous, showContents, positionLabel, following); page.append(navigation);
  const sectionToc = create('details', '', 'book-section-toc worship-navigation'); sectionToc.hidden = true; page.append(sectionToc);
  function openContents() { sectionToc.open = true; sectionToc.scrollIntoView?.({ block: 'start' }); }
  showContents.addEventListener('click', openContents);
  const content = create('div', '', 'book-content'); content.setAttribute('aria-live', 'polite'); page.append(content);
  let entries = [], book, index, entry, controller, disposed = false, generation = 0, complete = false, visibleLimit = 60, wantedIndex;
  let sections = [], activeSection, activeRange, blockNodes = new Map(), navigationObserver;
  const pdf = createReaderPdfControls({ create, load: pdfLoad, host: controls, available: () => complete && !disposed, selection: () => generation + ':' + (state.bookWeekday || ''), getSnapshot: () => getDocument() });
  function dataNode(tag, value, className = '') { const node = create(tag, null, className); node.textContent = value; return node; }
  function save(values, history = false) { Object.assign(state, values); onStateChange(values, { history }); }
  function clearBook() {
    ++generation; controller?.abort(); navigationObserver?.disconnect(); book = null; index = null; entry = null; activeRange = null; wantedIndex = undefined; complete = false; printButton.disabled = true; content.replaceChildren(); pdf.refresh();
    sections = []; activeSection = null; toneLabel.hidden = true; weekdayLabel.hidden = true; partLabel.hidden = true; navigation.hidden = true; sectionToc.hidden = true; sectionToc.replaceChildren(); blockNodes.clear();
  }
  function changeFilter(values) { clearBook(); save({ ...values, book: '', edition: '', bookTone: '', bookWeekday: '', bookPart: '' }, true); visibleLimit = 60; updateFilters(); renderList(); }
  function setOptions(input, values, selected, source = false) {
    input.replaceChildren();
    for (const [value, text] of Object.entries(values)) { const option = source ? dataNode('option', text) : create('option', text); option.value = value; input.append(option); }
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
      const heading = dataNode('span', displayTitle(item.title)); heading.dataset.textLanguage = 'cu'; heading.lang = 'cu'; button.append(heading);
      button.addEventListener('click', () => { save({ book: item.slug, edition: item.edition.code, bookTone: '', bookWeekday: '', bookPart: '' }, true); void openBook(item); }); list.append(button);
    }
    if (!found.length) list.append(create('p', 'В опубликованном каталоге нет подходящей редакции.', 'reader-message'));
    if (found.length > visibleLimit) { const more = create('button', 'Показать ещё', 'reader-button'); more.type = 'button'; more.addEventListener('click', () => { visibleLimit += 60; renderList(); }); list.append(more); }
  }
  search.addEventListener('input', () => { visibleLimit = 60; renderList(); });
  size.addEventListener('input', () => { page.style.setProperty('--reader-size', size.value + 'px'); save({ textSize: Number(size.value) }); });
  page.style.setProperty('--reader-size', size.value + 'px');
  tone.addEventListener('change', () => { save({ bookTone: tone.value, bookWeekday: '', bookPart: '' }, true); return renderBook(); });
  weekday.addEventListener('change', () => { save({ bookWeekday: weekday.value, bookPart: '' }, true); return renderBook(); });
  part.addEventListener('change', () => chooseSection(part.value));
  function chooseSection(id) {
    const selected = sections.find(section => section.id === id); if (!selected || disposed) return;
    save({ bookPart: selected.id, bookTone: selected.tone, bookWeekday: selected.weekday }, true);
    sectionToc.open = false; navigation.scrollIntoView?.({ block: 'start' }); return renderBook();
  }
  previous.addEventListener('click', () => chooseSection(sections[sections.indexOf(activeSection) - 1]?.id));
  following.addEventListener('click', () => chooseSection(sections[sections.indexOf(activeSection) + 1]?.id));
  function jump(position) {
    const node = blockNodes.get(position);
    if (node) { node.scrollIntoView?.({ block: 'start' }); node.focus?.({ preventScroll: true }); wantedIndex = undefined; }
    else wantedIndex = position;
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
      book = value; index = sourceBookIndex(book); sections = sourceBookSections(book, index); await renderBook();
    } catch {
      if (!disposed && request === generation) { content.replaceChildren(create('p', 'Эта редакция сейчас недоступна. Другая редакция или язык не подставлены.', 'reader-message')); complete = false; printButton.disabled = true; }
    }
  }
  function sectionLabel(section) {
    return (section.start === section.serviceStart ? section.serviceTitle : section.serviceTitle + (section.title ? ' · ' + section.title : ''))
      + (section.part > 1 ? ' · ' + create('span', 'Часть').textContent + ' ' + section.part : '');
  }
  function scopeLabel(section) {
    if (!section.tone) return create('span', 'Раздел книги').textContent;
    const scope = section.tone === 'preface' ? 'Предисловие' : section.tone === 'appendices' ? 'Приложения' : 'Глас';
    return create('span', scope).textContent + (/^[1-8]$/.test(section.tone) ? ' ' + section.tone : '')
      + (section.weekday !== '0' ? ' · ' + create('span', BOOK_WEEKDAYS[section.weekday]).textContent : '');
  }
  function documentHeadings() {
    const headings = index.headings.filter(item => item.index >= activeRange.start && item.index < activeRange.end);
    if (activeSection?.title && !headings.some(heading => heading.index === activeSection.start)) headings.unshift({ index: activeSection.start, text: activeSection.title });
    return headings;
  }
  function renderSectionToc(scopes) {
    sectionToc.replaceChildren(create('summary', 'Оглавление книги'));
    for (const scope of scopes) {
      const group = create('details'), heading = create('summary', !scope ? 'Разделы книги' : scope === 'preface' ? 'Предисловие' : scope === 'appendices' ? 'Приложения' : create('span', 'Глас').textContent + ' ' + scope); group.append(heading);
      group.open = scope === state.bookTone;
      for (const section of sections.filter(section => section.tone === scope)) {
        const link = dataNode('a', sectionLabel(section)); link.dataset.bookSection = section.id; link.dataset.textLanguage = 'cu'; link.lang = 'cu';
        const params = new URLSearchParams({ view: 'books', book: book.slug, edition: book.edition, bookPart: section.id });
        if (state.lang) params.set('lang', state.lang);
        link.href = '?' + params; if (section.id === state.bookPart) link.setAttribute('aria-current', 'page');
        link.addEventListener('click', event => { event.preventDefault(); chooseSection(section.id); }); group.append(link);
      }
      sectionToc.append(group);
    }
  }
  async function renderBook() {
    if (!book || disposed) return;
    const request = ++generation, value = book;
    complete = false; printButton.disabled = true; pdf.refresh(); navigationObserver?.disconnect(); content.replaceChildren(); blockNodes = new Map();
    activeSection = selectBookSection(sections, state);
    activeRange = activeSection ? { start: activeSection.start, end: activeSection.end } : { start: 0, end: value.blocks.length };
    if (activeSection) save({ bookPart: activeSection.id, bookTone: activeSection.tone, bookWeekday: activeSection.weekday });
    partLabel.hidden = navigation.hidden = sectionToc.hidden = !sections.length;
    toneLabel.hidden = weekdayLabel.hidden = !sections.length || book.slug !== 'octoechos-ponomar-whole';
    if (sections.length) {
      const scopes = [...new Set(sections.map(section => section.tone))];
      setOptions(tone, Object.fromEntries(scopes.map(key => [key, key === 'preface' ? 'Предисловие' : key === 'appendices' ? 'Приложения' : create('span', 'Глас').textContent + ' ' + key])), state.bookTone);
      const weekdays = [...new Set(sections.filter(section => section.tone === state.bookTone).map(section => section.weekday))];
      setOptions(weekday, Object.fromEntries(weekdays.map(key => [key, key === '0' ? 'Начало раздела' : BOOK_WEEKDAYS[key]])), state.bookWeekday);
      setOptions(part, Object.fromEntries(sections.filter(section => section.tone === state.bookTone && section.weekday === state.bookWeekday).map(section => [section.id, sectionLabel(section)])), state.bookPart, true);
      const position = sections.indexOf(activeSection); previous.disabled = position === 0; following.disabled = position === sections.length - 1;
      positionLabel.textContent = `${position + 1} / ${sections.length}`;
      renderSectionToc(scopes);
    }
    const sourceTitle = dataNode('h2', displayTitle(value.title)); sourceTitle.dataset.textLanguage = 'cu'; sourceTitle.lang = 'cu'; content.append(sourceTitle);
    content.append(create('p', value.artifactType === 'source-book'
      ? 'В тексте сохранены исходные рубрики и отсылки.'
      : 'Объём опубликованного текста определяется выбранной редакцией.', 'hint'));
    if (activeSection) { const label = dataNode('p', sectionLabel(activeSection), 'book-section-title'); label.dataset.textLanguage = 'cu'; label.lang = 'cu'; content.append(label); }
    if (activeSection) content.append(dataNode('p', scopeLabel(activeSection), 'book-scope'));
    if (activeSection) content.append(create('p', 'Открыт только выбранный книжный раздел. Печать и PDF сохраняют этот же объём.', 'hint'));
    const toc = create('details', '', 'worship-navigation'); toc.append(create('summary', 'Оглавление'));
    const headings = documentHeadings();
    for (const heading of headings) {
      const link = dataNode('a', heading.text); link.href = '#book-block-' + heading.index; link.dataset.textLanguage = 'cu'; link.lang = 'cu';
      link.addEventListener('click', event => { event.preventDefault(); jump(heading.index); }); toc.append(link);
    }
    if (headings.length || sections.length) {
      if (!sections.length) content.append(toc);
      const up = create('button', '↑ К оглавлению', 'reader-button worship-to-toc'); up.type = 'button';
      up.addEventListener('click', () => { if (sections.length) openContents(); else { toc.open = true; toc.scrollIntoView?.({ block: 'start' }); } }); content.append(up);
      if (!sections.length && globalThis.IntersectionObserver) {
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
    complete = true; printButton.disabled = false; pdf.refresh();
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
      const headings = documentHeadings();
      const ids = new Set(headings.map(item => item.index));
      const navigation = headings.map(item => ({ blockIndex: item.index - activeRange.start, title: item.text, language: 'cu' }));
      const firstDays = new Set();
      const contents = headings.filter(item => {
        if (activeSection) return true;
        if (!index.tones.length) return true;
        const tone = index.tones.find(tone => item.index >= tone.index && item.index < tone.end);
        if (tone?.index === item.index) return true;
        const key = tone?.tone + ':' + item.weekday;
        if (tone && item.weekday && !firstDays.has(key)) { firstDays.add(key); return true; }
        return false;
      }).map(item => ({ blockIndex: item.index - activeRange.start, title: item.text, language: 'cu' }));
      return structuredClone({ kind: 'book', title: displayTitle(book.title), titleLanguage: 'cu', subtitle: activeSection ? sectionLabel(activeSection) : undefined,
        status: translate('Книжный текст'), complete: false, warnings: [],
        information: activeSection ? [scopeLabel(activeSection), translate('Открыт только выбранный книжный раздел. Печать и PDF сохраняют этот же объём.')] : [],
        sources: [],
        blocks: book.blocks.slice(activeRange.start, activeRange.end).map((block, offset) => ({ kind: ids.has(offset + activeRange.start) ? 'heading' : 'paragraph',
          language: 'cu', origin: 'source', runs: block.segments.map(segment => ({ text: segment.text, rubric: segment.style === 'rubric' || block.kind === 'rubric', language: 'cu' })) })),
        navigation, contents,
        sourceMetadata: { slug: book.slug, edition: book.edition, language: 'cu', orthography: 'traditional', sourceUrl: book.source_url,
          contentHash: book.content_hash, sourceScope: book.sourceScope || 'published-text', bookCompleteness: book.bookCompleteness || null, appointedForDate: false,
          selection: { kind: 'book', tone: state.bookTone || null, weekday: activeSection?.weekday || null, part: activeSection?.id || null, serviceStart: activeSection?.serviceStart ?? null, range: activeRange } },
        labels: { contents: translate('Оглавление'), sources: translate('Источники'), incomplete: translate('Книжный текст'), page: translate('Страница') } });
    }
}
