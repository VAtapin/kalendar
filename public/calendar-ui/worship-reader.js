import { createReaderPdfControls } from './reader-pdf-controls.js';
import { datedWorshipParams, matchesWorshipContext, validWorshipDate, worshipRequestSignal } from './worship-context.js';
import { LITURGY_RITES, MID_LENT_BRANCHES, isAdditionalLiturgy } from './worship-additional-liturgy.js';
import { createLocalContextForm } from './worship-local-context.js';
// Public Bible Desktop contracts. Availability is always resolved by the server.
import { sourceLanguage } from './worship-parts.js';
import { compactRepetitions, repetitionEntries, repetitionNumber } from './worship-repeats.js';
export const OFFICES = {
  'first-hour': 'Первый час', 'third-hour': 'Третий час',
  'sixth-hour': 'Шестой час', 'ninth-hour': 'Девятый час', liturgy: 'Литургия',
  matins: 'Утреня', vespers: 'Вечерня',
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
  matins: { standalone: 'Самостоятельно', vigil: 'В составе всенощного бдения' },
  vespers: { standalone: 'Самостоятельно', vigil: 'В составе всенощного бдения' },
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
  return sourceLanguage(item);
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

export function calendarAssignments(value) {
  const entries = new Map();
  for (const item of [...(value.assignments || []), ...(value.properAssignments || [])]) {
    if (!item.text && item.insert !== true) continue;
    // Proper assignments are also included in assignments by Bible Desktop.
    const identity = item.textId || item.id || item.familyId;
    const key = identity ? JSON.stringify([identity, item.slot || '', item.workSlug || '']) : 'anonymous:' + entries.size;
    const previous = entries.get(key);
    if (!previous || item.insert === true) entries.set(key, item);
  }
  return {
    appointed: [...entries.values()].filter(item => item.insert === true),
    reference: [...entries.values()].filter(item => item.insert !== true),
  };
}

function coverageLabel(result) {
  if (result.additionalFixed) return 'Постоянная основа — назначения дня не подтверждены';
  if (result.outline) return 'Книжный текст — служба дня не составлена';
  if (result.status === 'ready' || result.complete) return 'Полная служба дня';
  return {
    loading: 'Уточняются назначения дня',
    error: 'Назначения дня недоступны',
    'not-appointed': 'Служба в этот день не назначена',
  }[result.assignmentsStatus] || 'Служба дня составлена не полностью';
}

function missingExplanation(reason, contract) {
  const category = contract?.completionClassification?.category || contract?.category || '';
  if (category.includes('local')) return 'Для этой части требуются подтверждённые местные данные. Они не подставлены автоматически.';
  if (category.includes('day') || category.includes('dated')) return 'Назначение этой части на выбранную дату пока не подтверждено.';
  if (contract) return 'Требуется подтверждение порядка или условий исполнения. Автоматическая вставка не выполнена.';
  if (reason === 'traditional-cu-verified-local-context-required') return 'Для этой части требуются подтверждённые местные данные. Они не подставлены автоматически.';
  if (['dated-appointment-not-verified', 'traditional-cu-appointment-not-independently-verified',
    'traditional-cu-office-appointment-not-verified'].includes(reason)) return 'Назначение этой части на выбранную дату пока не подтверждено.';
  return 'Назначение этой части пока не определено.';
}

export async function fetchWorship(base, state, fetcher = fetch, signal) {
  state = { ...state };
  if (isAdditionalLiturgy(state)) throw new Error('Additional Liturgy has no full-service endpoint');
  if (state.textLanguage && !['auto', 'cu', 'cu-civil', 'ru'].includes(state.textLanguage)) throw new Error('Invalid text language');
  const requestSignal = worshipRequestSignal(signal);
  for (const language of (state.textLanguage && state.textLanguage !== 'auto' ? [state.textLanguage] : ['cu', 'cu-civil', 'ru'])) {
    requestSignal.throwIfAborted();
    const url = new URL('/api/v1/liturgical/services/' + state.office, base);
    for (const [key, value] of Object.entries(datedWorshipParams(state, language))) url.searchParams.set(key, value);
    const response = await fetcher(url, { credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' }, signal: requestSignal });
    if (response.status === 404) return { status: 'unavailable' };
    if (response.status !== 200 && response.status !== 409) throw new Error('Worship request failed: ' + response.status);
    const value = await response.json(), data = value?.data;
    if (data?.schemaVersion !== 1 || !matchesWorshipContext(data.context, state) || data.context?.language !== language) throw new Error('Invalid worship context');
    if (response.status === 409) {
      if (data.status === 'not-appointed') return { status: 'not-appointed' };
      // Fall back only when this edition is explicitly unsupported, never on
      // review/source errors, transport failures, permission errors or throttling.
      const absenceCodes = ['unsupported-edition', 'unsupported-offline-edition-or-calendar'];
      const editionMissing = Array.isArray(data.issues) && data.issues.some(issue => absenceCodes.includes(issue?.code))
        && data.issues.every(issue => [...absenceCodes, 'editorial-review-required'].includes(issue?.code));
      if (editionMissing && (!state.textLanguage || state.textLanguage === 'auto') && language !== 'ru') continue;
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

export function renderWorshipReader({ state, create, formatDate, onChange, onCalendar, onRetry, onLocalSubmit, onLocalDirty, onLocalClear, isCurrent = () => true, pdfLoad, print = () => globalThis.print() }) {
  const page = create('section', '', 'worship-page');
  const head = create('div', '', 'content-head');
  const additional = isAdditionalLiturgy(state);
  head.append(create('h2', state.office === 'liturgy' ? LITURGY_RITES[state.rite || 'john-chrysostom'] : OFFICES[state.office]), create('p', formatDate(state.date), 'hint'));
  const contextLabel = create('p', '', 'worship-context');
  if (additional) contextLabel.append(create('span', state.rite === 'presanctified' ? MID_LENT_BRANCHES[state.midLentBranch] || 'Ветвь не выбрана' : 'Постоянная основа'));
  else contextLabel.append(create('span', TEMPLES[state.temple]), create('span', ' · '), create('span', MODES[state.office][state.sequence]));
  head.append(contextLabel);
  const back = create('button', '← К календарному дню', 'reader-button');
  back.type = 'button'; back.addEventListener('click', onCalendar);
  page.append(back, head);
  const controls = create('div', '', 'worship-controls');
  const dateLabel = create('label', 'Дата', 'control'), date = create('input');
  date.type = 'date'; date.min = '1900-01-01'; date.max = '2200-12-31'; date.value = state.date;
  date.dataset.worshipControl = 'date';
  date.addEventListener('change', () => {
    if (validWorshipDate(date.value)) onChange('date', date.value);
    else date.value = state.date;
  });
  dateLabel.append(date); controls.append(dateLabel);
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
  if (state.office === 'liturgy') select('Чин Литургии', 'rite', LITURGY_RITES);
  if (additional && state.rite === 'presanctified') select('Ветвь постоянного текста', 'midLentBranch', { '': 'Выберите ветвь', ...MID_LENT_BRANCHES });
  select('Язык текста', 'textLanguage', additional ? { auto: 'Автоматически — сначала церковнославянский', cu: EDITIONS.cu } : { auto: 'Автоматически — сначала церковнославянский', ...EDITIONS });
  if (!additional) {
    select('Храм', 'temple', TEMPLES);
    select('Порядок службы', 'sequence', MODES[state.office]);
  }
  if (state.office === 'first-hour') select('После первого часа', 'afterHourHymn', { vzbrannoi: 'Взбранной Воеводе', none: 'Без заключительного песнопения' });
  if (state.office === 'ninth-hour' && state.sequence === 'before-vespers') select('Место чтения', 'location', { nave: 'В храме', narthex: 'В притворе' });
  const sizeLabel = create('label', 'Размер текста', 'control'), size = create('input');
  size.type = 'range'; size.min = '18'; size.max = '32'; size.value = String(state.textSize);
  size.addEventListener('input', () => { state.textSize = Number(size.value); onChange('textSize', state.textSize); page.style.setProperty('--reader-size', size.value + 'px'); });
  sizeLabel.append(size); controls.append(sizeLabel); page.append(controls);
  page.style.setProperty('--reader-size', state.textSize + 'px');
  const localHost = create('div'); localHost.hidden = true; page.append(localHost);
  const summary = create('div', '', 'worship-day-summary');
  const content = create('div', '', 'worship-content'); content.setAttribute('aria-live', 'polite');
  const loading = create('p', 'Загружаю службу…', 'hint'); loading.setAttribute('role', 'status');
  content.append(loading); page.append(summary, content);
  const printButton = create('button', 'Печать службы', 'reader-button worship-print');
  printButton.type = 'button'; printButton.disabled = true;
  let disposed = false, renderVersion = 0;
  printButton.addEventListener('click', async () => {
    const version = renderVersion;
    printButton.disabled = true;
    const details = [...content.querySelectorAll('details')].filter(node => !node.classList.contains('worship-navigation') && !node.classList.contains('worship-conditional'));
    const opened = details.map(node => node.open);
    try {
      details.forEach(node => { node.open = true; });
      await document.fonts.ready;
      if (!disposed && isCurrent() && version === renderVersion) print();
    } finally {
      details.forEach((node, index) => { node.open = opened[index]; });
      if (!disposed && version === renderVersion) printButton.disabled = false;
    }
  });
  controls.append(printButton);
  let navigationObserver, localForm, snapshotProvider, pdfReady = false;
  const pdf = createReaderPdfControls({ create, load: pdfLoad, host: controls, available: () => !disposed && isCurrent() && pdfReady && !!snapshotProvider, selection: () => JSON.stringify([renderVersion, state.date, state.office, state.rite, state.midLentBranch, state.temple, state.sequence, state.textLanguage]), getSnapshot: module => snapshotProvider?.(module) });
  function render(result) {
    ++renderVersion; snapshotProvider = null; pdf.refresh();
    printButton.disabled = !['ready', 'parts'].includes(result.status) || result.assignmentsStatus === 'loading';
    pdfReady = !printButton.disabled;
    navigationObserver?.disconnect();
    content.replaceChildren();
    if (result.additionalFixed && result.localContextAvailable && onLocalSubmit && !localForm) {
      localForm = createLocalContextForm({ state, temples: TEMPLES, create, onSubmit: onLocalSubmit, onDirty: onLocalDirty, onClear: onLocalClear });
      localHost.append(localForm.page); localHost.hidden = false;
    }
    if (result.status === 'edition-unavailable') {
      content.append(create('p', 'Выбранная редакция этой службы пока отсутствует в BibleDesktop.', 'reader-message'));
      const retry = create('button', 'Проверить доступность', 'reader-button'); retry.type = 'button'; retry.addEventListener('click', onRetry); content.append(retry);
      return;
    }
    if (!['ready', 'parts'].includes(result.status)) {
      const messages = {
        'context-required': 'Выберите ветвь постоянного текста Преждеосвященной Литургии. Дата сама по себе не определяет этот выбор.',
        pending: 'BibleDesktop пока не смог составить эту службу для выбранного дня. Назначения переменных частей требуют уточнения.',
        unavailable: 'Эта служба пока недоступна. Её можно проверить позднее.',
        'not-appointed': 'Литургия в этот день не назначена.',
        error: 'Не удалось загрузить службу. Попробуйте ещё раз.',
      };
      const message = create('p', messages[result.status] || messages.error, 'reader-message');
      message.setAttribute('role', 'status'); content.append(message);
      if (!['not-appointed', 'context-required'].includes(result.status)) {
        const retry = create('button', 'Проверить доступность', 'reader-button');
        retry.type = 'button'; retry.addEventListener('click', onRetry); content.append(retry);
      }
      return;
    }
    const coverage = create('aside', '', 'worship-coverage');
    coverage.setAttribute('role', 'status');
    coverage.append(create('strong', coverageLabel(result)));
    const unresolved = result.entries?.filter(entry => entry.missing).length || 0;
    if (unresolved) {
      const count = create('p');
      count.append(create('span', 'Неопределённых частей:'), create('span', ' ' + unresolved));
      coverage.append(count);
    }
    content.append(coverage);
    if (result.localValuesApplied) {
      const notice = create('p', '', 'reader-message');
      notice.append(create('span', 'Местные имена введены пользователем. Они не подтверждают назначение всей службы.'),
        create('span', ' '), create('span', TEMPLES[result.localTempleId]));
      content.append(notice);
    }
    if (result.status === 'parts') {
      if (result.additionalFixed) content.append(create('p', 'Показаны постоянные слова выбранного чина. Дата сохранена как дата запроса, но назначения службы, местные данные и условные варианты не подтверждены.', 'reader-message'));
      if (result.template?.status === 'fixed-template') content.append(create('p', 'Постоянная основа Литургии: один священник и один диакон.', 'edition-label'));
      if (result.fallback) content.append(create('p', 'Церковнославянская редакция пока недоступна; показана следующая доступная редакция.', 'reader-message'));
      const notices = {
        loading: 'Постоянный текст загружен. Уточняю переменные части дня…',
        partial: result.additionalFixed ? 'Обязательные вставки отмечены в тексте. Полная служба выбранной даты не составлена.' : state.office === 'liturgy' ? 'Постоянный текст Литургии и подтверждённые дневные вставки показаны. Неопределённые части отмечены; полная служба этого дня ещё не подтверждена.'
          : 'Показана постоянная основа обычного Часа. Неопределённые вставки отмечены в тексте; полный порядок этого дня пока не подтверждён.',
        error: 'Постоянный текст доступен. Дневные назначения сейчас не получены; места вставок отмечены в тексте.',
        'not-appointed': 'Литургия в этот день не назначена. Ниже приведён книжный текст для чтения.',
      };
      if (result.outline) content.append(create('p', state.office === 'liturgy'
        ? 'Книжная основа Литургии Иоанна Златоуста. Переменные части и условные варианты ещё не выбраны для этой даты; это не готовая служба дня.'
        : 'Показан полный исходный текст службы. Дневные вставки и условные варианты ещё не выбраны; это не готовая служба дня.', 'reader-message'));
      if (!result.complete) {
        const notice = create('p', result.outline && result.assignmentsStatus !== 'not-appointed'
          ? (result.assignmentsStatus === 'error' ? notices.error : 'Дневные вставки пока не определены.')
          : notices[result.assignmentsStatus] || notices.partial, 'reader-message');
        notice.setAttribute('role', 'status');
        if (!result.outline || ['error', 'not-appointed'].includes(result.assignmentsStatus)) content.append(notice);
        const retry = create('button', 'Проверить доступность', 'reader-button'); retry.type = 'button'; retry.addEventListener('click', onRetry); content.append(retry);
      }
    } else content.append(create('p', EDITIONS[result.language], 'edition-label'));
    const toc = create('nav', '', 'worship-toc'); toc.setAttribute('aria-label', create('span', 'Оглавление').textContent);
    const body = create('article', '', 'worship-text');
    body.dataset.composition = result.status === 'ready' || result.complete ? 'complete' : result.outline ? 'source-outline' : 'partial';
    content.dataset.assignmentsStatus = result.assignmentsStatus || '';
    const entries = result.status === 'parts' ? result.entries : [{ language: result.language, blocks: result.data.blocks }];
    const languages = [...new Set(entries.filter(entry => !entry.missing).map(entry => entry.language))];
    if (result.status === 'parts') languages.forEach(language => content.append(create('p', EDITIONS[language], 'edition-label')));
    let blockIndex = 0, appendix;
    const slotNames = { 'troparion-of-day:leading': 'Дополнительный тропарь дня', 'troparion-of-day:last': 'Тропарь дня',
      'day-leading': 'Дополнительный тропарь дня', 'day-last': 'Тропарь дня', 'day-kontakion': 'Кондак дня',
      'day-dismissal-prefix': 'Дневное начало отпуста',
      'kontakion-of-day': 'Кондак дня', 'troparia-kontakia': 'Тропари и кондаки после входа',
      'antiphon-1': 'Первый антифон', 'antiphon-2': 'Второй антифон', 'apostle': 'Апостол', gospel: 'Евангелие',
      'only-begotten': 'Единородный Сыне', 'antiphon-3-or-beatitudes': 'Третий антифон или Блаженны', entrance: 'Входное',
      'trisagion-or-replacement': 'Трисвятое или его замена', prokeimenon: 'Прокимен', 'apostle-title': 'Заглавие Апостола',
      alleluia: 'Аллилуиарий', 'evangelist-names': 'Имя евангелиста', 'gospel-title': 'Заглавие Евангелия',
      'local-commemorations': 'Местные поминовения', 'optional-petitions': 'Условные прошения',
      'cherubic-or-replacement': 'Херувимская или её замена', megalynarion: 'Достойно есть или задостойник',
      communion: 'Причастен', 'blessed-name': 'Буди имя Господне', 'psalm-33': 'Псалом 33', dismissal: 'Отпуст',
      'thanksgiving-appendix': 'Благодарственные молитвы' };
    for (const entry of repetitionEntries(entries)) {
      if (entry.missing) {
        const missing = create('aside', '', 'worship-missing');
        missing.dataset.slotId = entry.slotId;
        missing.append(create('strong', slotNames[entry.slotId] || 'Переменная часть службы'), create('p', missingExplanation(entry.reason, entry.contract)));
        if (result.outline) {
          // Outline anchors identify source locations, not approved insertion operations.
          let unresolved = content.querySelector('.outline-missing');
          if (!unresolved) { unresolved = create('details', '', 'outline-missing'); unresolved.append(create('summary', state.office === 'liturgy' ? 'Неопределённые части Литургии' : 'Неопределённые части службы')); content.append(unresolved); }
          unresolved.append(missing);
        } else body.append(missing);
        continue;
      }
      const part = create('section', '', 'worship-part');
      if (result.template?.status === 'fixed-template') {
        if (entry.role) part.dataset.role = entry.role;
        const parallelGroup = entry.parallelGroup || Object.entries(result.template.parallelGroups || {}).find(([, group]) =>
          Object.values(group.lanes || {}).some(ids => ids.includes(entry.nodeId)))?.[0];
        if (parallelGroup) {
          part.dataset.parallelGroup = parallelGroup;
        }
        if (entry.delivery) part.dataset.delivery = entry.delivery;
      }
      part.dataset.textLanguage = entry.language;
      if (entry.userProvided) part.dataset.origin = 'user-provided';
      part.lang = entry.language === 'cu-civil' ? 'cu' : entry.language;
      if (entry.nodeId) part.dataset.nodeId = entry.nodeId;
      if (entry.kind === 'source-block') part.dataset.sourceClassification = entry.classification;
      for (const { block, count } of compactRepetitions(entry.blocks)) {
        const index = blockIndex++;
        const heading = block.kind === 'heading', node = create(heading ? 'h3' : 'p', null, 'worship-block');
        if (block.role === 'rubric' || block.kind === 'rubric') node.classList.add('rubric');
        if (block.parallelWith) {
          node.classList.add('parallel-prayer');
        }
        if (Number.isInteger(block.tone) && block.tone >= 1 && block.tone <= 8) {
          const tone = create('small', 'Глас', 'edition-label'); tone.append(document.createTextNode(' ' + block.tone)); node.append(tone);
        }
        for (const segment of block.segments) {
          const span = create('span', null, segment.style === 'rubric' ? 'rubric' : '');
          span.textContent = segment.text; node.append(span);
        }
        if (count > 1) {
          node.dataset.repeatCount = String(count);
          const number = create('span', null, 'rubric repetition-number');
          number.textContent = repetitionNumber(count, entry.language);
          node.append(document.createTextNode(' '), number);
        }
        if (heading) {
          node.id = 'worship-part-' + index;
          const link = create('a', null); link.textContent = node.textContent; link.href = '#' + node.id; toc.append(link);
          link.dataset.textLanguage = entry.language;
          link.lang = part.lang;
        }
        part.append(node);
      }
      if (entry.section === 'post-service-appendix') {
        if (!appendix) { appendix = create('details', '', 'worship-appendix'); appendix.append(create('summary', 'Приложение после службы')); body.append(appendix); }
        appendix.append(part);
      } else body.append(part);
    }
    if (toc.childElementCount) {
      const navigation = create('details', '', 'worship-navigation'), title = create('summary', 'Оглавление');
      navigation.append(title, toc); content.append(navigation);
      const up = create('button', '↑ К оглавлению', 'reader-button worship-to-toc');
      up.type = 'button'; up.hidden = true;
      up.addEventListener('click', () => {
        navigation.open = true;
        title.focus({ preventScroll: true });
        navigation.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      });
      content.append(up);
      navigationObserver = new IntersectionObserver(([entry]) => {
        up.hidden = entry.isIntersecting || entry.boundingClientRect.bottom >= 0;
      });
      navigationObserver.observe(title);
    }
    content.append(body);
    const conditionalVariants = result.additionalFixed ? Object.entries(result.template.conditionalTemplates).filter(([id]) => !result.selectedConditionalIds?.includes(id)).map(([, variant]) => variant) : [];
    if (conditionalVariants.length) {
      const variants = create('details', '', 'worship-conditional');
      variants.append(create('summary', 'Условные варианты — не включены в службу'),
        create('p', result.selectedConditionalIds?.length ? 'Остальные условные варианты не выбраны. Они не включены в основной текст службы.' : 'Ни один вариант не выбран. Условия исполнения и число повторений требуют подтверждения; эти тексты не являются продолжением составленной службы.', 'reader-message'));
      conditionalVariants.forEach((variant, index) => {
        const section = create('section', '', 'worship-text');
        section.dataset.textLanguage = 'cu'; section.lang = 'cu';
        const title = create('h3'); title.append(create('span', 'Условный вариант'), create('span', ' ' + (index + 1))); variants.append(title);
        for (const node of variant.template.nodes) {
          if (node.kind === 'slot') {
            section.append(create('p', 'Обязательная вставка этого варианта не назначена.', 'worship-missing'));
            continue;
          }
          for (const block of node.blocks) {
            const line = create(block.kind === 'heading' ? 'h3' : 'p', '', 'worship-block');
            if (block.kind === 'rubric' || block.role === 'rubric') line.classList.add('rubric');
            for (const segment of block.segments) {
              const span = create('span', null, segment.style === 'rubric' ? 'rubric' : '');
              span.textContent = segment.text; line.append(span);
            }
            section.append(line);
          }
        }
        variants.append(section);
      });
      content.append(variants);
    }
    snapshotProvider = module => module.captureWorshipPdf(body, {
      kind: 'dated-service', title: head.children[0].textContent, subtitle: formatDate(state.date),
      status: create('span', coverageLabel(result)).textContent, complete: result.status === 'ready' || result.complete === true,
      information: [contextLabel.textContent, ...[...content.children].filter(node => ['reader-message', 'edition-label'].some(name => node.classList.contains(name))).map(node => node.textContent)].filter(Boolean),
      warnings: result.status === 'ready' || result.complete ? [] : [create('span', 'Полная служба выбранной даты не составлена.').textContent, ...[...content.children].filter(node => node.classList.contains('outline-missing')).map(node => node.textContent)],
      sources: [],
      sourceMetadata: { selection: { date: state.date, office: state.office, rite: state.rite, midLentBranch: state.midLentBranch, temple: state.temple, edition: state.textLanguage, sequence: state.sequence }, status: result.assignmentsStatus },
      labels: { contents: create('span', 'Оглавление').textContent, sources: create('span', 'Источники').textContent, incomplete: create('span', 'Полная служба выбранной даты не составлена.').textContent, page: create('span', 'Страница').textContent }
    });
    pdf.refresh();
  }
  return { page, summary, render, dispose: () => { disposed = true; pdf.dispose(); printButton.disabled = true; localForm?.dispose(); navigationObserver?.disconnect(); } };
}
