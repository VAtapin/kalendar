// Public Bible Desktop contracts. Availability is always resolved by the server.
export const OFFICES = {
  'first-hour': 'Первый час', 'third-hour': 'Третий час',
  'sixth-hour': 'Шестой час', 'ninth-hour': 'Девятый час', liturgy: 'Литургия',
};
export const TEMPLES = {
  'george-victorious': 'Храм великомученика Георгия', nicholas: 'Храм святителя Николая',
  transfiguration: 'Храм Преображения Господня', dormition: 'Храм Успения Богородицы',
};
export const EDITIONS = { cu: 'Церковнославянский', 'cu-civil': 'Церковнославянский — гражданская запись', ru: 'Русский' };
export const MODES = {
  'first-hour': { 'after-matins': 'После утрени (отпуст совершён)' },
  'third-hour': { standalone: 'Самостоятельно' },
  'sixth-hour': { 'after-third-hour': 'После третьего часа' },
  'ninth-hour': { standalone: 'Самостоятельно', 'before-vespers': 'Перед вечерней' },
  liturgy: { default: 'По назначению дня' },
};

export function lectionNumber(reading) {
  const match = reading?.lectionary;
  if (match?.status !== 'exact-reference-match' || match.basis !== 'exact-source-coordinates'
    || !Array.isArray(match.candidates) || !match.candidates.length) return null;
  const identities = new Set();
  for (const candidate of match.candidates) {
    if (!candidate || !['gospel', 'apostle'].includes(candidate.kind) || !/^[1-3]?[A-Za-z]+$/.test(candidate.book || '')
      || !/^[1-9]\d{0,5}$/.test(String(candidate.number ?? ''))) return null;
    identities.add(candidate.book + ':' + candidate.number);
  }
  return identities.size === 1 ? String(match.candidates[0].number) : null;
}

export function textLanguage(item) {
  if (item?.language === 'cu' && ['civil', 'civil-accented'].includes(item.orthography)) return 'cu-civil';
  return Object.hasOwn(EDITIONS, item?.language) ? item.language : null;
}

export function validateCalendarTexts(value) {
  if (value?.schemaVersion !== 2 || value.textPolicy !== 'calendar-language-v1' || value.calendarLanguage !== 'ru') {
    throw new Error('Unsupported automatic text policy');
  }
  for (const item of [...(value.assignments || []), ...(value.properAssignments || []), ...(value.expansions || [])]) {
    if (item.text && !textLanguage(item)) throw new Error('Missing text edition');
  }
  return value;
}

function worshipParams(state, language) {
  const params = { date: state.date, language, calendarStyle: 'julian', sequence: state.sequence };
  // The published third/sixth Hour contract does not accept a temple context.
  if (['first-hour', 'ninth-hour', 'liturgy'].includes(state.office)) params.temple = state.temple;
  if (state.office === 'first-hour') {
    params.matinsDismissalDone = '1';
    params.afterHourHymn = state.afterHourHymn;
  }
  if (state.office === 'ninth-hour' && state.sequence === 'before-vespers') {
    params.nextOffice = 'vespers';
    params.location = state.location;
  }
  return params;
}

export async function fetchWorship(base, state, fetcher = fetch) {
  for (const language of ['cu', 'cu-civil', 'ru']) {
    const url = new URL('/api/v1/liturgical/services/' + state.office, base);
    for (const [key, value] of Object.entries(worshipParams(state, language))) url.searchParams.set(key, value);
    const response = await fetcher(url, { credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' } });
    if (response.status === 404) return { status: 'unavailable' };
    if (response.status !== 200 && response.status !== 409) throw new Error('Worship request failed: ' + response.status);
    const value = await response.json(), data = value?.data;
    if (data?.schemaVersion !== 1 || data.context?.date !== state.date || data.context?.office !== state.office
      || data.context?.language !== language || data.context?.calendarStyle !== 'julian'
      || (['first-hour', 'ninth-hour', 'liturgy'].includes(state.office) && data.context?.temple !== state.temple)) throw new Error('Invalid worship context');
    if (response.status === 409) {
      if (data.status === 'not-appointed') return { status: 'not-appointed' };
      // Fall back only when this edition is explicitly unsupported, never on
      // review/source errors, transport failures, permission errors or throttling.
      const absenceCodes = ['unsupported-edition', 'unsupported-offline-edition-or-calendar'];
      const editionMissing = Array.isArray(data.issues) && data.issues.some(issue => absenceCodes.includes(issue?.code))
        && data.issues.every(issue => [...absenceCodes, 'editorial-review-required'].includes(issue?.code));
      if (editionMissing && language !== 'ru') continue;
      return { status: 'pending' };
    }
    if (data.status !== 'complete' || !['text', 'appointment', 'review'].every(key => data.completeness?.[key] === true)
      || (state.sequence !== 'default' && data.context.sequence !== state.sequence)
      || !Array.isArray(data.blocks) || !data.blocks.length
      || data.blocks.some(block => !Array.isArray(block.segments) || !block.segments.length
        || block.segments.some(segment => typeof segment.text !== 'string'))) throw new Error('Incomplete worship response');
    return { status: 'ready', data, language };
  }
  return { status: 'pending' };
}

export function renderWorshipReader({ state, create, formatDate, onChange, onCalendar, onRetry }) {
  const page = create('section', '', 'worship-page');
  const head = create('div', '', 'content-head');
  head.append(create('h2', 'Богослужение дня'), create('p', formatDate(state.date), 'hint'));
  const back = create('button', '← К календарному дню', 'reader-button');
  back.type = 'button'; back.addEventListener('click', onCalendar);
  page.append(back, head);
  const controls = create('div', '', 'worship-controls');
  function select(label, field, options) {
    const wrapper = create('label', label, 'control'), input = create('select');
    input.dataset.worshipControl = field;
    for (const [value, title] of Object.entries(options)) {
      const option = create('option', title); option.value = value; input.append(option);
    }
    input.value = state[field]; input.addEventListener('change', () => onChange(field, input.value));
    wrapper.append(input); controls.append(wrapper);
  }
  select('Служба', 'office', OFFICES);
  select('Храм', 'temple', TEMPLES);
  select('Порядок службы', 'sequence', MODES[state.office]);
  if (state.office === 'first-hour') select('После первого часа', 'afterHourHymn', { vzbrannoi: 'Взбранной Воеводе', none: 'Без заключительного песнопения' });
  if (state.office === 'ninth-hour' && state.sequence === 'before-vespers') select('Место чтения', 'location', { nave: 'В храме', narthex: 'В притворе' });
  const sizeLabel = create('label', 'Размер текста', 'control'), size = create('input');
  size.type = 'range'; size.min = '18'; size.max = '32'; size.value = String(state.textSize);
  size.addEventListener('input', () => { state.textSize = Number(size.value); page.style.setProperty('--reader-size', size.value + 'px'); });
  sizeLabel.append(size); controls.append(sizeLabel); page.append(controls);
  page.style.setProperty('--reader-size', state.textSize + 'px');
  const summary = create('div', '', 'worship-day-summary');
  const content = create('div', '', 'worship-content'); content.setAttribute('aria-live', 'polite');
  const loading = create('p', 'Загружаю службу…', 'hint'); loading.setAttribute('role', 'status');
  content.append(loading); page.append(summary, content);
  function render(result) {
    content.replaceChildren();
    if (result.status !== 'ready') {
      const messages = {
        pending: 'Текст этой службы для выбранного дня пока не опубликован. Он появится здесь, когда станет доступен в BibleDesktop.',
        unavailable: 'Эта служба пока недоступна. Её можно проверить позднее.',
        'not-appointed': 'Литургия в этот день не назначена.',
        error: 'Не удалось загрузить службу. Попробуйте ещё раз.',
      };
      const message = create('p', messages[result.status] || messages.error, 'reader-message');
      message.setAttribute('role', 'status'); content.append(message);
      if (result.status !== 'not-appointed') {
        const retry = create('button', 'Проверить доступность', 'reader-button');
        retry.type = 'button'; retry.addEventListener('click', onRetry); content.append(retry);
      }
      return;
    }
    content.append(create('p', EDITIONS[result.language], 'edition-label'));
    const toc = create('nav', '', 'worship-toc'); toc.setAttribute('aria-label', create('span', 'Оглавление').textContent);
    const body = create('article', '', 'worship-text'); body.lang = result.language === 'cu-civil' ? 'cu' : result.language;
    body.dataset.textLanguage = result.language;
    result.data.blocks.forEach((block, index) => {
      const heading = block.kind === 'heading', node = create(heading ? 'h3' : 'p', null, 'worship-block');
      if (block.role === 'rubric' || block.kind === 'rubric') node.classList.add('rubric');
      if (block.parallelWith) {
        node.classList.add('parallel-prayer');
        node.append(create('small', 'Молитва читается одновременно с песнопением', 'edition-label'));
      }
      if (Number.isInteger(block.tone) && block.tone >= 1 && block.tone <= 8) {
        const tone = create('small', 'Глас', 'edition-label'); tone.append(document.createTextNode(' ' + block.tone)); node.append(tone);
      }
      for (const segment of block.segments) {
        const span = create('span', null, segment.style === 'rubric' ? 'rubric' : '');
        span.textContent = segment.text; node.append(span);
      }
      if (heading) {
        node.id = 'worship-part-' + index;
        const link = create('a', null); link.textContent = node.textContent; link.href = '#' + node.id; toc.append(link);
      }
      body.append(node);
    });
    if (toc.childElementCount) content.append(toc);
    content.append(body);
  }
  return { page, summary, render };
}
