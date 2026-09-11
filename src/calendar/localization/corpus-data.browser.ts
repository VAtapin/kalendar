import { shallowReactive } from 'vue';
import type { CalendarLanguage } from '../../document/types';
type Dictionary = Readonly<Record<string, string>>;
const dictionaries = shallowReactive<Partial<Record<CalendarLanguage, Dictionary>>>({ ru: {} });
const pending = new Map<CalendarLanguage, Promise<void>>();
const loaders = {
  de: () => import('./german-commemorations').then(module => module.GERMAN_COMMEMORATIONS),
  cu: () => import('./slavonic-editorial-titles.json').then(module => module.default),
  uk: () => import('./uk-commemorations.json').then(module => module.default),
  pl: () => import('./pl-commemorations.json').then(module => module.default),
};
export const calendarDictionary = (language: CalendarLanguage): Dictionary => dictionaries[language] ?? {};
export async function loadCalendarDictionary(language: CalendarLanguage): Promise<void> {
  if (dictionaries[language] || language === 'ru') return;
  let request = pending.get(language);
  if (!request) {
    request = loaders[language]().then(data => { dictionaries[language] = data; })
      .finally(() => { pending.delete(language); });
    pending.set(language, request);
  }
  await request;
}
