import { UI_DE } from './web-calendar-i18n.js';
'use strict';
const $ = id => document.getElementById(id), MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const state = { view: 'month', date: new Date().toISOString().slice(0, 10), lang: 'ru', profile: 'typikon-strict' };
let slavonicFontUrl = '', slavonicFontFace, loadSequence = 0, daySequence = 0;
for (let year = 1900; year <= 2200; year++)
    $('year').add(new Option(String(year), String(year)));
for (let month = 0; month < 12; month++)
    $('month').add(new Option(MONTHS[month], String(month + 1).padStart(2, '0')));
function ui(value) { if (typeof value !== 'string' || state.lang !== 'de')
    return value; if (UI_DE[value])
    return UI_DE[value]; if (value.startsWith('ещё '))
    return 'weitere ' + value.slice(4); if (value.startsWith('Календарь на '))
    return 'Kalender ' + value.slice(13); if (value.startsWith('Не удалось загрузить календарь: '))
    return 'Kalender konnte nicht geladen werden: ' + value.slice(31); if (value.startsWith('Не удалось загрузить день: '))
    return 'Tag konnte nicht geladen werden: ' + value.slice(26); return value; }
const staticLabels = [];
document.querySelectorAll('.back,.eyebrow,.site-title,.intro,.sidebar,#close').forEach(root => { const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let node; while (node = walker.nextNode()) {
    if (node.textContent.trim())
        staticLabels.push([node, node.textContent]);
} });
function updateLabels() { document.documentElement.lang = state.lang === 'cu' ? 'cu' : state.lang; for (const [node, text] of staticLabels)
    node.textContent = text.replace(text.trim(), ui(text.trim())); for (let i = 0; i < 12; i++)
    $('month').options[i].text = titleDate('2026-' + String(i + 1).padStart(2, '0') + '-01', { month: 'long' }); document.title = ui('Православный веб-календарь'); }
function e(tag, value = '', className = '') { const node = document.createElement(tag); if (value !== null)
    node.textContent = ui(value); if (className)
    node.className = className; return node; }
function locale() { return state.lang === 'cu' ? 'ru' : state.lang; }
function titleDate(date, opts = { dateStyle: 'long' }) { try {
    return new Intl.DateTimeFormat(locale(), opts).format(new Date(date + 'T12:00:00Z'));
}
catch {
    return date;
} }
function setStatus(value, error = false) { $('status').textContent = ui(value); $('status').className = 'status' + (error ? ' error' : ''); }
function queryPath(path, params = {}) { const url = new URL('/api/v1/calendar-demo/' + path, location.origin); Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value)); return url; }
async function api(path, params) { const response = await fetch(queryPath(path, params), { method: 'POST', credentials: 'omit', headers: { Accept: 'application/json', 'X-Calendar-Demo': '1' } }); const value = await response.json(); if (!response.ok)
    throw new Error(value.message || value.error || 'Ошибка API'); return value; }
async function loadCalendarFont() { if (state.lang !== 'cu')
    return; const url = new URL('/calendar-api-font.php', location.origin).href; if (slavonicFontUrl === url)
    return; const face = new FontFace('Calendar API Slavonic', 'url(' + JSON.stringify(url) + ')', { weight: '400', style: 'normal' }); await face.load(); if (slavonicFontFace)
    document.fonts.delete(slavonicFontFace); document.fonts.add(face); slavonicFontFace = face; slavonicFontUrl = url; }
function applyTextLanguage(node) { node.classList.add('calendar-text'); node.classList.toggle('cu', state.lang === 'cu'); return node; }
function syncControls() { updateLabels(); const [year, month] = state.date.split('-'); $('date').value = state.date; $('year').value = year; $('month').value = month; $('lang').value = state.lang; $('profile').value = state.profile; document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === state.view))); }
function saveLocation() { const url = new URL(location.href); url.search = ''; Object.entries(state).forEach(([key, value]) => url.searchParams.set(key, value)); history.replaceState(null, '', url); }
function readLocation() { const params = new URLSearchParams(location.search), view = params.get('view'), date = params.get('date'), lang = params.get('lang'), profile = params.get('profile'); if (['day', 'week', 'month', 'year'].includes(view))
    state.view = view; if (/^\d{4}-\d{2}-\d{2}$/.test(date || ''))
    state.date = date; if (['ru', 'cu', 'de', 'uk', 'pl'].includes(lang))
    state.lang = lang; if (['typikon-strict', 'parish'].includes(profile))
    state.profile = profile; }
function weekdayNames() { return Array.from({ length: 7 }, (_, index) => titleDate('2024-01-' + String(index + 1).padStart(2, '0'), { weekday: 'short' }).replace('.', '')); }
function commemorationEvents(day) { return (day.events || []).filter(event => event.category === 'commemoration'); }
function buildHead(title, subtitle, badge = '') { const head = e('div', '', 'content-head'); const text = e('div'); text.append(e('h2', title), e('p', subtitle)); head.append(text); if (badge)
    head.append(e('span', badge, 'badge')); return head; }
function dayButton(day) { const button = e('button', '', 'day'); button.type = 'button'; button.dataset.date = day.date; button.append(e('div', String(Number(day.date.slice(-2))), 'day-number'), e('div', (day.oldStyleDate || '') + ' ' + ui('ст. ст.'), 'old-style'), e('div', day.foodLabel || '', 'food')); const events = commemorationEvents(day); events.slice(0, 2).forEach(event => button.append(e('span', event.shortTitle || event.title, 'event ' + (event.typeCode <= 2 ? 'main' : '')))); if (events.length > 2)
    button.append(e('div', 'ещё ' + (events.length - 2), 'more')); return button; }
function renderMonth(value) { const panel = applyTextLanguage($('calendar-panel')); panel.replaceChildren(buildHead(titleDate(state.date, { month: 'long', year: 'numeric' }), 'Нажмите на день, чтобы открыть праздники, пост, чтения и богослужебные тексты.', value.metadata?.fastingProfileName || '')); const wrap = e('div', ''); wrap.style.overflow = 'auto'; const weekdays = e('div', '', 'month-grid'); weekdayNames().forEach(name => weekdays.append(e('div', name, 'weekday'))); const days = e('div', '', 'month-grid'); days.id = 'days'; const first = value.days[0], offset = (Number(first.weekday) + 6) % 7; for (let i = 0; i < offset; i++)
    days.append(e('div', '', 'blank')); value.days.forEach(day => days.append(dayButton(day))); wrap.append(weekdays, days); panel.append(wrap); panel.querySelector('#days').addEventListener('click', event => { const date = event.target.closest('.day')?.dataset.date; if (date)
    void showDay(date, true); }); }
function eventCard(event) { const card = e('article', '', 'event-card'); card.append(e('h4', event.title || event.shortTitle || 'Память дня')); const annotation = [event.typikonMark?.label].filter(Boolean).join(' · '); if (annotation)
    card.append(e('small', annotation)); if (event.description)
    card.append(e('p', event.description)); const reference = event.reading?.reference || event.reference; if (reference)
    card.append(e('p', reference, 'hint')); return card; }
function addService(root, service) { const appointed=(service.assignments||[]).filter(item=>item.insert===true); const card = e('section', '', 'section-card'); card.append(e('h3', 'Богослужение дня')); const metadata = e('div', '', 'service-meta'); [service.cycles?.weekly?.subject, service.cycles?.movable?.label, service.cycles?.movable?.tone ? ('глас ' + service.cycles.movable.tone) : ''].filter(Boolean).forEach(value => metadata.append(e('span', value))); card.append(metadata);   if (appointed.length) {
    const list = e('div', '', 'service-list');
    appointed.forEach(item => { const assignment = e('article', '', 'assignment'); assignment.append(e('strong', item.title || item.slot)); if (item.insert === true && item.rubric)
        assignment.append(e('p', item.rubric, 'rubric')); assignment.append(e('p', item.text || ''));  list.append(assignment); });
    card.append(list);
}
if (service.expansions?.length) {
    const expansion = e('div', '', 'expansion');
    service.expansions.forEach(item => { const details = e('details'); details.append(e('summary', item.title || item.id), e('p', item.text || '')); expansion.append(details); });
    card.append(expansion);
} root.append(card); }
function renderFullDay(value, service = null, target = $('calendar-panel')) { const day = value.day, panel = applyTextLanguage(target); panel.replaceChildren(); const page = e('div', '', 'day-page'); page.append(buildHead(titleDate(day.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), (day.oldStyleDate || '') + ' ' + ui('по старому стилю'), value.metadata?.fastingProfileName || '')); const hero = e('section', '', 'hero'); hero.append(e('h3', day.foodLabel || 'Календарный день'), e('p', day.fasting?.reason || day.fasting?.description || '')); page.append(hero); const facts = e('div', '', 'facts'); facts.append(fact('Стиль дня', day.dayStyle?.label || ({ 'pascha': 'Пасха', 'great-feast': 'Великий праздник', 'medium-feast': 'Праздничный день', 'monastery-feast': 'Престольный праздник', 'sunday': 'Воскресенье', 'ordinary': 'Будний день' }[day.dayStyle?.rank]) || '—'), fact('Пост', day.foodLabel || '—'), fact('Событий', String((day.events || []).length))); page.append(facts); const events = e('section', '', 'section-card'); events.append(e('h3', 'Святые и праздники')); const eventList = e('div', '', 'events-list'); const commemorations = commemorationEvents(day); if (commemorations.length)
    commemorations.forEach(event => eventList.append(eventCard(event)));
else
    eventList.append(e('p', 'Сведения о памятях для этого дня не найдены.', 'hint')); events.append(eventList); page.append(events); const readings = (day.events || []).filter(event => event.category === 'scripture-reading' || event.reading || event.reference); if (readings.length) {
    const section = e('section', '', 'section-card');
    section.append(e('h3', 'Чтения'));
    const list = e('div', '', 'reading-list');
    readings.forEach(event => list.append(eventCard(event)));
    section.append(list);
    page.append(section);
} const icons = (day.icons || []); if (icons.length) {
    const section = e('section', '', 'section-card');
    section.append(e('h3', 'Иконы дня'));
    icons.forEach(icon => { const figure = e('figure', '', 'icon-card'), src = icon.imageUrl || icon.image_url; const title = icon.title || icon.name || 'Икона дня'; if (src && /^https:\/\/bible-desktop\.com\//.test(src)) {
        const image = e('img');
        image.src = src;
        image.alt = title;
        image.loading = 'lazy';
        image.style.cssText = 'max-width:100%;max-height:320px;object-fit:contain';
        figure.append(image);
    } figure.append(e('figcaption', title)); if (icon.description)
        figure.append(e('p', icon.description)); section.append(figure); });
    page.append(section);
} if (service)
    addService(page, service);
else
    page.append(e('p', 'Богослужебные тексты сейчас недоступны.', 'hint')); panel.append(page); }
function fact(label, value) { const item = e('div', '', 'fact'); item.append(e('strong', label), e('span', value)); return item; }
function renderWeek(days) { const panel = applyTextLanguage($('calendar-panel')); panel.replaceChildren(buildHead('Неделя', titleDate(days[0].date, { day: 'numeric', month: 'long' }) + ' — ' + titleDate(days.at(-1).date, { day: 'numeric', month: 'long', year: 'numeric' }))); const grid = e('div', '', 'week-grid'); days.forEach(day => { const button = e('button', '', 'week-day'); button.type = 'button'; button.dataset.date = day.date; button.append(e('h3', titleDate(day.date, { weekday: 'short', day: 'numeric' })), e('p', (day.oldStyleDate || '') + ' ' + ui('ст. ст.'), 'hint'), e('p', day.foodLabel || '')); commemorationEvents(day).slice(0, 3).forEach(event => button.append(e('p', event.shortTitle || event.title, 'event'))); grid.append(button); }); grid.addEventListener('click', event => { const date = event.target.closest('.week-day')?.dataset.date; if (date)
    void showDay(date, true); }); panel.append(grid); }
function renderYear(value) { const panel = applyTextLanguage($('calendar-panel')); panel.replaceChildren(buildHead('Календарь на ' + state.date.slice(0, 4), 'Выберите дату, чтобы открыть её полный состав.')); const grid = e('div', '', 'year-grid'); for (let month = 1; month <= 12; month++) {
    const monthDays = value.days.filter(day => Number(day.date.slice(5, 7)) === month), card = e('section', '', 'mini-month');
    card.append(e('h3', titleDate(monthDays[0].date, { month: 'long' })));
    const mini = e('div', '', 'mini-days');
    weekdayNames().forEach(name => mini.append(e('span', name.slice(0, 1))));
    const offset = (Number(monthDays[0].weekday) + 6) % 7;
    for (let i = 0; i < offset; i++)
        mini.append(e('span'));
    monthDays.forEach(day => { const button = e('button', String(Number(day.date.slice(-2)))); button.type = 'button'; button.dataset.date = day.date; if (commemorationEvents(day).length)
        button.classList.add('has-event'); if (day.foodLabel && day.foodLabel !== 'поста нет')
        button.classList.add('fast'); mini.append(button); });
    card.append(mini);
    grid.append(card);
} grid.addEventListener('click', event => { const date = event.target.closest('button')?.dataset.date; if (date)
    void showDay(date, true); }); panel.append(grid); }
async function serviceFor(date) { return api('service', { date, lang: state.lang, profile: state.profile, office: 'sixth-hour', expansion: 'short' }); }
async function showDay(date, dialog = false) { const request = ++daySequence; setStatus('Загружаю полный состав дня…'); try {
    await loadCalendarFont();
    const [value, service] = await Promise.all([api('day', { date, lang: state.lang, profile: state.profile }), serviceFor(date).catch(() => null)]);
    if (request !== daySequence)
        return;
    if (dialog) {
        renderFullDay(value, service, $('detail-content'));
        if (!$('detail').open)
            $('detail').showModal();
    }
    else {
        state.date = date;
        syncControls();
        saveLocation();
        renderFullDay(value, service);
    }
    setStatus('Данные дня получены.');
}
catch (error) {
    if (request !== daySequence)
        return;
    setStatus('Не удалось загрузить день: ' + error.message, true);
} }
async function load() { const request = ++loadSequence; ++daySequence; syncControls(); saveLocation(); $('submit').disabled = true; setStatus('Загружаю календарь…'); try {
    await loadCalendarFont();
    if (request !== loadSequence)
        return;
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
        if (request !== loadSequence)
            return;
        renderWeek(values.map(value => value.day));
    }
    else if (state.view === 'year') {
        const value = await api('year', { ...common, year: state.date.slice(0, 4), view: 'summary' });
        if (request !== loadSequence)
            return;
        renderYear(value);
    }
    else {
        const value = await api('month', { ...common, year: state.date.slice(0, 4), month: state.date.slice(5, 7), view: 'summary' });
        if (request !== loadSequence)
            return;
        renderMonth(value);
    }
    setStatus('Календарь готов.');
}
catch (error) {
    if (request !== loadSequence)
        return;
    $('calendar-panel').replaceChildren(e('p', 'Не удалось загрузить календарь: ' + error.message, 'empty'));
    setStatus('Не удалось загрузить календарь: ' + error.message, true);
}
finally {
    if (request === loadSequence)
        $('submit').disabled = false;
} }
function shift(step) { const date = new Date(state.date + 'T12:00:00Z'); if (state.view === 'year')
    date.setUTCFullYear(date.getUTCFullYear() + step);
else if (state.view === 'month') {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + step);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, last));
}
else if (state.view === 'week')
    date.setUTCDate(date.getUTCDate() + step * 7);
else
    date.setUTCDate(date.getUTCDate() + step); state.date = date.toISOString().slice(0, 10); void load(); }
$('query').addEventListener('submit', event => { event.preventDefault(); state.date = $('date').value; state.lang = $('lang').value; state.profile = $('profile').value; void load(); });
$('date').addEventListener('change', () => { $('year').value = $('date').value.slice(0, 4); $('month').value = $('date').value.slice(5, 7); });
$('year').addEventListener('change', () => { $('date').value = $('year').value + '-' + $('month').value + '-01'; });
$('month').addEventListener('change', () => { $('date').value = $('year').value + '-' + $('month').value + '-01'; });
document.querySelector('.view-tabs').addEventListener('click', event => { const view = event.target.dataset.view; if (view) {
    state.view = view;
    void load();
} });
$('today').addEventListener('click', () => { state.date = new Date().toISOString().slice(0, 10); void load(); });
$('previous').addEventListener('click', () => shift(-1));
$('next').addEventListener('click', () => shift(1));
$('close').addEventListener('click', () => $('detail').close());
$('detail').addEventListener('close', () => { ++daySequence; });
$('detail').addEventListener('click', event => { if (event.target === $('detail'))
    $('detail').close(); });
readLocation();
syncControls();
void load();
