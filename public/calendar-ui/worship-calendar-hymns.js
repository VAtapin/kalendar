import { calendarAssignments, EDITIONS, textLanguage, validateCalendarTexts } from './worship-reader.js';

export const HOUR_OFFICES = ['first-hour', 'third-hour', 'sixth-hour', 'ninth-hour'];

export function calendarServiceValue(response) {
  return validateCalendarTexts(response?.data ?? response);
}

export function renderCalendarHymns({ create, state, value, error = false }) {
  const section = create('section', '', 'section-card calendar-hour-hymns');
  section.append(create('h3', 'Песнопения календарного дня'));
  section.append(create('p', 'Справочно: порядок службы не подтверждён.', 'hint'));
  if (error) {
    section.append(create('p', 'Песнопения календаря сейчас недоступны.', 'hint'));
    return section;
  }
  validateCalendarTexts(value);
  if (value.date !== state.date || value.office !== state.office
      || !Array.isArray(value.assignments) || !Array.isArray(value.properAssignments)) throw Error('Wrong calendar hymn context');
  const groups = calendarAssignments(value);
  const hymns = [...groups.appointed, ...groups.reference].filter(item =>
    typeof item.text === 'string' && item.text.trim() && /^(troparion|kontakion)(-|$)/.test(item.slot || ''));
  if (!hymns.length) {
    section.append(create('p', 'Для этого дня тексты песнопений пока недоступны.', 'hint'));
    return section;
  }
  for (const item of hymns) {
    const article = create('article', '', 'assignment'), title = create('strong', null);
    title.textContent = item.heading || item.title || item.slot;
    const language = textLanguage(item), label = create('small', EDITIONS[language], 'edition-label');
    const text = create('p', null); text.textContent = item.text;
    text.dataset.textLanguage = language; text.lang = language === 'cu-civil' ? 'cu' : language;
    article.append(title, label, text); section.append(article);
  }
  return section;
}
