// Synchronous adapter for the server, CLI tools and corpus validation tests.
// Vite uses corpus-data.browser.ts for browser builds only.
import type { CalendarLanguage } from '../../document/types';
import cu from './slavonic-editorial-titles.json';
import uk from './uk-commemorations.json';
import pl from './pl-commemorations.json';
import { GERMAN_COMMEMORATIONS as de } from './german-commemorations';
const dictionaries: Partial<Record<CalendarLanguage, Readonly<Record<string, string>>>> = { cu, uk, pl, de };
export const calendarDictionary = (language: CalendarLanguage): Readonly<Record<string, string>> => dictionaries[language] ?? {};
export async function loadCalendarDictionary(_language: CalendarLanguage): Promise<void> {}
