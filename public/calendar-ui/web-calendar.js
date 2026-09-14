import { UI_DE } from './web-calendar-i18n.js';
'use strict';

const $ = id => document.getElementById(id);
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const VIEW_LABELS = { day: 'День', week: 'Неделя', month: 'Месяц', year: 'Год' };
const state = { view: 'month', date: new Date().toISOString().slice(0, 10), lang: 'ru', profile: 'typikon-strict' };
let slavonicFontUrl = '', slavonicFontFace, loadSequence = 0, daySequence = 0;

for (let year = 1900; year <= 2200; year++) $('year').add(new Option(String(year), String(year)));
for (let month = 0; month < 12; month++) $('month').add(new Option(MONTHS[month], String(month + 1).padStart(2, '0')));

function ui(value) {
  if (typeof value !== 'string' || state.lang !== 'de') return value;
  if (UI_DE[value]) return UI_DE[value];
  if (value.startsWith('ещё ')) return 'weitere ' + value.slice(4);
  if (value.startsWith('Календарь на ')) return 'Kalender ' + value.slice(13);
  if (value.startsWith('Не удалось загрузить календарь: ')) return 'Kalender konnte nicht geladen werden: ' + value.slice(31);
  if (value.startsWith('Не удалось загрузить день: ')) return 'Tag konnte nicht geladen werden: ' + value.slice(26);
  return value;
}

const staticLabels = [];
document.querySelectorAll('.back,.eyebrow,.site-title,.intro,.filters,#close').forEach(root => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while (node = walker.nextNode()) if (node.textContent.trim()) staticLabels.push([node, node.textContent]);
});

function updateLabels() {
  document.documentElement.lang = state.lang === 'cu' ? 'cu' : state.lang;
  for (const [node, text] of staticLabels) node.textContent = text.replace(text.trim(), ui(text.trim()));
  for (let i = 0; i < 12; i++) $('month').options[i].text = titleDate('2026-' + String(i + 1).padStart(2, '0') + '-01', { month: 'long' });
  document.title = ui('Православный веб-календарь');
}

function e(tag, value = '', className = '') {
  const node = document.createElement(tag);
  if (value !== null) node.textContent = ui(value);
  if (className) node.className = className;
  return node;
}

function locale() { return state.lang === 'cu' ? 'ru' : state.lang; }

function titleDate(date, opts = { dateStyle: 'long' }) {
  try { return new Intl.DateTimeFormat(locale(), opts).format(new Date(date + 'T12:00:00Z')); }
  catch { return date; }
}

function setStatus(value, error = false) {
  $('status').textContent = ui(value);
  $('status').className = 'status' + (error ? ' error' : '');
}

function queryPath(path, params = {}) {
  const url = new URL('/api/v1/calendar-demo/' + path, location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

async function api(path, params) {
  const response = await fetch(queryPath(path, params), { method: 'POST', credentials: 'omit', headers: { Accept: 'application/json', 'X-Calendar-Demo': '1' } });
  const value = await response.json();
  if (!response.ok) throw new Error(value.message || value.error || 'Ошибка API');
  return value;
}

async function loadCalendarFont() {
  if (state.lang !== 'cu') return;
  const url = new URL('/calendar-api-font.php', location.origin).href;
  if (slavonicFontUrl === url) return;
  const face = new FontFace('Calendar API Slavonic', 'url(' + JSON.stringify(url) + ')', { weight: '400', style: 'normal' });
  await face.load();
  if (slavonicFontFace) document.fonts.delete(slavonicFontFace);
  document.fonts.add(face);
  slavonicFontFace = face;
  slavonicFontUrl = url;
}

function applyTextLanguage(node) {
  node.classList.add('calendar-text');
  node.classList.toggle('cu', state.lang === 'cu');
  return node;
}

function updateFilterSummary() {
  const labels = [$('filter-summary'), VIEW_LABELS[state.view], titleDate(state.date, { month: 'long', year: 'numeric' }), $('lang').selectedOptions[0]?.textContent, $('profile').selectedOptions[0]?.textContent];
  $('filter-summary').textContent = labels.slice(1).filter(Boolean).map(ui).join(' · ');
}

function syncControls() {
  updateLabels();
  const [year, month] = state.date.split('-');
  $('date').value = state.date;
  $('year').value = year;
  $('month').value = month;
  $('lang').value = state.lang;
  $('profile').value = state.profile;
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
  updateFilterSummary();
}

function saveLocation() {
  const url = new URL(location.href);
  url.search = '';
  Object.entries(state).forEach(([key, value]) => url.searchParams.set(key, value));
  history.replaceState(null, '', url);
}

function readLocation() {
  const params = new URLSearchParams(location.search);
  const view = params.get('view'), date = params.get('date'), lang = params.get('lang'), profile = params.get('profile');
  if (['day', 'week', 'month', 'year'].includes(view)) state.view = view;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date || '')) state.date = date;
  if (['ru', 'cu', 'de', 'uk', 'pl'].includes(lang)) state.lang = lang;
  if (['typikon-strict', 'parish'].includes(profile)) state.profile = profile;
}

function weekdayNames() { return Array.from({ length: 7 }, (_, index) => titleDate('2024-01-' + String(index + 1).padStart(2, '0'), { weekday: 'short' }).replace('.', '')); }
function commemorationEvents(day) { return (day.events || []).filter(event => event.category === 'commemoration'); }

function buildHead(title, subtitle, badge = '', headingId = '') {
  const head = e('div', '', 'content-head');
  const text = e('div');
  const heading = e('h2', title);
  if (headingId) heading.id = headingId;
  text.append(heading, e('p', subtitle));
  head.append(text);
  if (badge) head.append(e('span', badge, 'badge'));
  return head;
}

function dayDisplayTitle(day) { return day.shortTitle || day.veryShortTitle || day.title || 'Память дня'; }

function dayButton(day) {
  const button = e('button', '', 'day');
  button.type = 'button';
  button.dataset.date = day.date;
  const food = e('div', '', 'food');
  const hasFast = Boolean(day.foodLabel && day.foodLabel !== 'поста нет');
  if (hasFast) {
    food.classList.add('has-fast');
    if (day.fastingColor) food.style.setProperty('--fast-color', day.fastingColor);
    food.textContent = ui(day.foodLabel);
    button.title = [titleDate(day.date), day.foodLabel, ...commemorationEvents(day).map(event => event.title)].join(' · ');
  } else button.title = [titleDate(day.date), ...commemorationEvents(day).map(event => event.title)].join(' · ');
  button.append(e('div', String(Number(day.date.slice(-2))), 'day-number'), e('div', (day.oldStyleDate || '') + ' ' + ui('ст. ст.'), 'old-style'), food);
  const events = commemorationEvents(day);
  const primary = events.find(event => event.typeCode <= 2) || events[0];
  if (primary) button.append(e('span', dayDisplayTitle(primary), 'event ' + (primary.typeCode <= 2 ? 'main' : '')));
  const remaining = events.length - (primary ? 1 : 0);
  if (remaining > 0) button.append(e('div', 'ещё ' + remaining, 'more'));
  button.setAttribute('aria-label', [titleDate(day.date), day.foodLabel, ...events.map(event => event.title)].filter(Boolean).join('. '));
  return button;
}

function renderMonth(value) {
  const panel = applyTextLanguage($('calendar-panel'));
  panel.replaceChildren(buildHead(titleDate(state.date, { month: 'long', year: 'numeric' }), 'Нажмите на день, чтобы открыть праздники, пост, чтения и богослужебные тексты.', value.metadata?.fastingProfileName || ''));
  const wrap = e('div', '');
  wrap.style.overflow = 'auto';
  const weekdays = e('div', '', 'month-grid');
  weekdayNames().forEach(name => weekdays.append(e('div', name, 'weekday')));
  const days = e('div', '', 'month-grid');
  days.id = 'days';
  const first = value.days[0], offset = (Number(first.weekday) + 6) % 7;
  for (let i = 0; i < offset; i++) days.append(e('div', '', 'blank'));
  value.days.forEach(day => days.append(dayButton(day)));
  wrap.append(weekdays, days);
  panel.append(wrap);
  days.addEventListener('click', event => {
    const date = event.target.closest('.day')?.dataset.date;
    if (date) void showDay(date, true);
  });
}

function eventCard(event) {
  const card = e('article', '', 'event-card');
  card.append(e('h4', event.title || event.shortTitle || 'Память дня'));
  const annotation = [event.typikonMark?.label].filter(Boolean).join(' · ');
  if (annotation) card.append(e('small', annotation));
  if (event.description) card.append(e('p', event.description));
  const reference = event.reading?.reference || event.reference;
  if (reference) card.append(e('p', reference, 'hint'));
  return card;
}

function serviceSection(serviceState) {
  const card = e('section', '', 'section-card');
  card.dataset.section = 'service';
  card.append(e('h3', 'Богослужение дня'));
  if (serviceState.status === 'loading') {
    card.append(e('div', null, 'loading-block'), e('p', 'Загружаю богослужебные тексты…', 'hint'));
    return card;
  }
  if (serviceState.status === 'error') {
    card.append(e('p', 'Богослужебные тексты сейчас недоступны.', 'hint'));
    return card;
  }
  const service = serviceState.value;
  const metadata = e('div', '', 'service-meta');
  [service.cycles?.weekly?.subject, service.cycles?.movable?.label, service.cycles?.movable?.tone ? ('глас ' + service.cycles.movable.tone) : ''].filter(Boolean).forEach(value => metadata.append(e('span', value)));
  card.append(metadata);
  const assignments = [...(service.assignments || []), ...(service.properAssignments || [])].filter(item => item.insert === true || item.text);
  if (assignments.length) {
    const list = e('div', '', 'service-list');
    assignments.forEach(item => {
      const assignment = e('article', '', 'assignment');
      assignment.append(e('strong', item.title || item.slot));
      if (item.rubric) assignment.append(e('p', item.rubric, 'rubric'));
      if (item.text) assignment.append(e('p', item.text));
      list.append(assignment);
    });
    card.append(list);
  }
  if (service.assignmentStatus && service.assignmentStatus !== 'complete') card.append(e('p', 'Собственные праздничные тексты пока не переданы API; показан доступный проверенный цикл.', 'hint'));
  if (service.expansions?.length) {
    const expansion = e('div', '', 'expansion');
    service.expansions.forEach(item => {
      const details = e('details');
      details.open = true;
      details.append(e('summary', item.title || item.id), e('p', item.text || ''));
      expansion.append(details);
    });
    card.append(expansion);
  }
  return card;
}

function safeMarkerUrl(source) {
  if (typeof source !== 'string') return '';
  try {
    const url = new URL(source, location.origin);
    return url.origin === location.origin && url.pathname.startsWith('/assets/markers/') ? url.href : '';
  } catch { return ''; }
}

function fastingHero(day) {
  const hero = e('section', '', 'hero');
  const summary = e('div', '', 'fasting-summary');
  const isFast = Boolean(day.foodLabel && day.foodLabel !== 'поста нет');
  if (isFast) {
    const marker = (day.foodMarkers || []).find(item => safeMarkerUrl(item.source));
    const source = safeMarkerUrl(marker?.source);
    if (source) {
      const image = e('img');
      image.src = source;
      image.alt = day.foodLabel;
      image.loading = 'eager';
      image.addEventListener('error', () => image.remove(), { once: true });
      summary.append(image);
    }
  }
  const text = e('div');
  text.append(e('h3', day.foodLabel || 'Календарный день'), e('p', day.fasting?.reason || day.fasting?.description || ''));
  summary.append(text);
  hero.append(summary);
  if (day.fastingColor) hero.style.borderLeftColor = day.fastingColor;
  return hero;
}

function renderDayValue(value, serviceState, target) {
  const day = value.day;
  const panel = applyTextLanguage(target);
  panel.replaceChildren();
  const page = e('div', '', 'day-page');
  page.append(buildHead(titleDate(day.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), (day.oldStyleDate || '') + ' ' + ui('по старому стилю'), value.metadata?.fastingProfileName || '', target === $('detail-content') ? 'detail-title' : ''));
  page.append(fastingHero(day));
  const facts = e('div', '', 'facts');
  facts.append(fact('Стиль дня', day.dayStyle?.label || ({ pascha: 'Пасха', 'great-feast': 'Великий праздник', 'medium-feast': 'Праздничный день', 'monastery-feast': 'Престольный праздник', sunday: 'Воскресенье', ordinary: 'Будний день' }[day.dayStyle?.rank]) || '—'), fact('Пост', day.foodLabel || '—'), fact('Событий', String((day.events || []).length)));
  page.append(facts);
  const events = e('section', '', 'section-card');
  events.append(e('h3', 'Святые и праздники'));
  const eventList = e('div', '', 'events-list');
  const commemorations = commemorationEvents(day);
  if (commemorations.length) commemorations.forEach(event => eventList.append(eventCard(event)));
  else eventList.append(e('p', 'Сведения о памятях для этого дня не найдены.', 'hint'));
  events.append(eventList);
  page.append(events);
  const readings = (day.events || []).filter(event => event.category === 'scripture-reading' || event.reading || event.reference);
  const readingSection = e('section', '', 'section-card');
  readingSection.append(e('h3', 'Чтения'));
  const readingList = e('div', '', 'reading-list');
  if (readings.length) readings.forEach(event => readingList.append(eventCard(event)));
  else readingList.append(e('p', 'Библейские чтения для этого дня API не передал.', 'hint'));
  readingSection.append(readingList);
  page.append(readingSection);
  const icons = day.icons || [];
  if (icons.length) {
    const section = e('section', '', 'section-card');
    section.append(e('h3', 'Иконы дня'));
    icons.forEach(icon => {
      const figure = e('figure', '', 'icon-card');
      const src = icon.imageUrl || icon.image_url;
      const title = icon.title || icon.name || 'Икона дня';
      if (src && /^https:\/\/bible-desktop\.com\//.test(src)) {
        const image = e('img');
        image.src = src;
        image.alt = title;
        image.loading = 'lazy';
        image.style.cssText = 'max-width:100%;max-height:320px;object-fit:contain';
        figure.append(image);
      }
      figure.append(e('figcaption', title));
      if (icon.description) figure.append(e('p', icon.description));
      section.append(figure);
    });
    page.append(section);
  }
  page.append(serviceSection(serviceState));
  panel.append(page);
}

function renderDayLoading(date, target) {
  const panel = applyTextLanguage(target);
  panel.replaceChildren();
  const page = e('div', '', 'day-page');
  page.append(buildHead(titleDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), 'Открываю состав дня…', '', target === $('detail-content') ? 'detail-title' : ''));
  const hero = e('section', '', 'hero');
  hero.append(e('h3', 'Календарный день'), e('div', null, 'loading-block'));
  page.append(hero, e('div', null, 'loading-block'), e('section', '', 'section-card'));
  page.lastElementChild.append(e('h3', 'Загрузка данных'), e('p', 'Праздники, чтения, иконы и богослужебные тексты загружаются отдельно.', 'hint'));
  panel.append(page);
}

function renderDayError(error, target) {
  const panel = applyTextLanguage(target);
  panel.replaceChildren(e('p', 'Не удалось загрузить день: ' + error.message, 'empty'));
}

function updateDayService(serviceState, target) {
  const page = target.querySelector('.day-page');
  const current = page?.querySelector('[data-section="service"]');
  if (current) current.replaceWith(serviceSection(serviceState));
}

function fact(label, value) {
  const item = e('div', '', 'fact');
  item.append(e('strong', label), e('span', value));
  return item;
}

function renderWeek(days) {
  const panel = applyTextLanguage($('calendar-panel'));
  panel.replaceChildren(buildHead('Неделя', titleDate(days[0].date, { day: 'numeric', month: 'long' }) + ' — ' + titleDate(days.at(-1).date, { day: 'numeric', month: 'long', year: 'numeric' })));
  const grid = e('div', '', 'week-grid');
  days.forEach(day => {
    const button = e('button', '', 'week-day');
    button.type = 'button';
    button.dataset.date = day.date;
    button.append(e('h3', titleDate(day.date, { weekday: 'short', day: 'numeric' })), e('p', (day.oldStyleDate || '') + ' ' + ui('ст. ст.'), 'hint'));
    if (day.foodLabel && day.foodLabel !== 'поста нет') button.append(e('p', day.foodLabel));
    const events = commemorationEvents(day);
    const primary = events.find(event => event.typeCode <= 2) || events[0];
    if (primary) button.append(e('p', dayDisplayTitle(primary), 'event'));
    if (events.length > (primary ? 1 : 0)) button.append(e('p', 'ещё ' + (events.length - 1), 'more'));
    grid.append(button);
  });
  grid.addEventListener('click', event => {
    const date = event.target.closest('.week-day')?.dataset.date;
    if (date) void showDay(date, true);
  });
  panel.append(grid);
}

function renderYear(value) {
  const panel = applyTextLanguage($('calendar-panel'));
  panel.replaceChildren(buildHead('Календарь на ' + state.date.slice(0, 4), 'Выберите дату, чтобы открыть её полный состав.'));
  const grid = e('div', '', 'year-grid');
  for (let month = 1; month <= 12; month++) {
    const monthDays = value.days.filter(day => Number(day.date.slice(5, 7)) === month), card = e('section', '', 'mini-month');
    card.append(e('h3', titleDate(monthDays[0].date, { month: 'long' })));
    const mini = e('div', '', 'mini-days');
    weekdayNames().forEach(name => mini.append(e('span', name.slice(0, 1))));
    const offset = (Number(monthDays[0].weekday) + 6) % 7;
    for (let i = 0; i < offset; i++) mini.append(e('span'));
    monthDays.forEach(day => {
      const button = e('button', String(Number(day.date.slice(-2))));
      button.type = 'button';
      button.dataset.date = day.date;
      if (commemorationEvents(day).length) button.classList.add('has-event');
      if (day.foodLabel && day.foodLabel !== 'поста нет') button.classList.add('fast');
      mini.append(button);
    });
    card.append(mini);
    grid.append(card);
  }
  grid.addEventListener('click', event => {
    const date = event.target.closest('button')?.dataset.date;
    if (date) void showDay(date, true);
  });
  panel.append(grid);
}

async function serviceFor(date) { return api('service', { date, lang: state.lang, profile: state.profile, office: 'sixth-hour', expansion: 'full' }); }

async function showDay(date, dialog = false) {
  const request = ++daySequence;
  const target = dialog ? $('detail-content') : $('calendar-panel');
  let serviceState = { status: 'loading' };
  renderDayLoading(date, target);
  if (dialog && !$('detail').open) $('detail').showModal();
  setStatus('Загружаю полный состав дня…');

  const servicePromise = serviceFor(date)
    .then(value => {
      serviceState = { status: 'ready', value };
      if (request === daySequence) updateDayService(serviceState, target);
      return value;
    })
    .catch(error => {
      serviceState = { status: 'error', error };
      if (request === daySequence) updateDayService(serviceState, target);
      return null;
    });
  const dayPromise = api('day', { date, lang: state.lang, profile: state.profile })
    .then(value => {
      if (request !== daySequence) return value;
      if (!dialog) {
        state.date = date;
        syncControls();
        saveLocation();
      }
      renderDayValue(value, serviceState, target);
      setStatus('День открыт; богослужебные тексты загружаются отдельно.');
      return value;
    })
    .catch(error => {
      if (request === daySequence) {
        renderDayError(error, target);
        setStatus('Не удалось загрузить день: ' + error.message, true);
      }
      throw error;
    });
  void loadCalendarFont().catch(() => undefined);
  await Promise.allSettled([dayPromise, servicePromise]);
}

async function load() {
  const request = ++loadSequence;
  ++daySequence;
  syncControls();
  saveLocation();
  $('submit').disabled = true;
  setStatus('Загружаю календарь…');
  void loadCalendarFont().catch(() => undefined);
  try {
    const common = { lang: state.lang, profile: state.profile };
    if (state.view === 'day') {
      await showDay(state.date);
      return;
    }
    if (state.view === 'week') {
      const start = new Date(state.date + 'T12:00:00Z');
      start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
      const dates = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setUTCDate(start.getUTCDate() + index); return date.toISOString().slice(0, 10); });
      const values = await Promise.all(dates.map(date => api('day', { ...common, date })));
      if (request !== loadSequence) return;
      renderWeek(values.map(value => value.day));
    } else if (state.view === 'year') {
      const value = await api('year', { ...common, year: state.date.slice(0, 4), view: 'summary' });
      if (request !== loadSequence) return;
      renderYear(value);
    } else {
      const value = await api('month', { ...common, year: state.date.slice(0, 4), month: state.date.slice(5, 7), view: 'summary' });
      if (request !== loadSequence) return;
      renderMonth(value);
    }
    setStatus('Календарь готов.');
  } catch (error) {
    if (request !== loadSequence) return;
    $('calendar-panel').replaceChildren(e('p', 'Не удалось загрузить календарь: ' + error.message, 'empty'));
    setStatus('Не удалось загрузить календарь: ' + error.message, true);
  } finally {
    if (request === loadSequence) $('submit').disabled = false;
  }
}

function shift(step) {
  const date = new Date(state.date + 'T12:00:00Z');
  if (state.view === 'year') date.setUTCFullYear(date.getUTCFullYear() + step);
  else if (state.view === 'month') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + step);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, last));
  } else if (state.view === 'week') date.setUTCDate(date.getUTCDate() + step * 7);
  else date.setUTCDate(date.getUTCDate() + step);
  state.date = date.toISOString().slice(0, 10);
  void load();
}

$('query').addEventListener('submit', event => {
  event.preventDefault();
  state.date = $('date').value;
  state.lang = $('lang').value;
  state.profile = $('profile').value;
  void load();
});
$('date').addEventListener('change', () => { $('year').value = $('date').value.slice(0, 4); $('month').value = $('date').value.slice(5, 7); });
$('year').addEventListener('change', () => { $('date').value = $('year').value + '-' + $('month').value + '-01'; });
$('month').addEventListener('change', () => { $('date').value = $('year').value + '-' + $('month').value + '-01'; });
document.querySelector('.view-tabs').addEventListener('click', event => { const view = event.target.dataset.view; if (view) { state.view = view; void load(); } });
$('today').addEventListener('click', () => { state.date = new Date().toISOString().slice(0, 10); void load(); });
$('previous').addEventListener('click', () => shift(-1));
$('next').addEventListener('click', () => shift(1));
$('close-filters').addEventListener('click', () => { $('filters').open = false; });
$('close').addEventListener('click', () => $('detail').close());
$('detail').addEventListener('close', () => { ++daySequence; });
$('detail').addEventListener('click', event => { if (event.target === $('detail')) $('detail').close(); });

readLocation();
syncControls();
void load();
