import type {CalendarLanguage} from '../../document/types';
import type {FastingProfileId} from '../fasting/fasting-catalog';
import {loadCachedCalendarSnapshot, saveCachedCalendarSnapshot} from '../../persistence/project-storage';
import {snapshotMatches, verifyEditorSnapshot, type SavedEditorCalendarSnapshot} from './editor-snapshot';

const verified = new WeakSet<object>();
const inFlight = new Map<string, Promise<SavedEditorCalendarSnapshot>>();
let retryUntil = 0;

function freezeSnapshot(value: object): void {
  if (Object.isFrozen(value)) return;
  for (const nested of Object.values(value)) if (nested && typeof nested === 'object') freezeSnapshot(nested);
  Object.freeze(value);
}

export async function verifySavedCalendar(saved: SavedEditorCalendarSnapshot): Promise<void> {
  if (!saved || !Number.isFinite(Date.parse(saved.fetchedAt))) throw new Error('Неподдерживаемый календарный снимок');
  if (!verified.has(saved.snapshot)) {
    await verifyEditorSnapshot(saved.snapshot); freezeSnapshot(saved.snapshot); verified.add(saved.snapshot);
  }
}

export async function loadEditorCalendar(options: {
  year: number; language: CalendarLanguage; profile?: FastingProfileId;
  saved?: SavedEditorCalendarSnapshot; refresh?: boolean;
}): Promise<SavedEditorCalendarSnapshot> {
  if (!Number.isInteger(options.year) || options.year < 1900 || options.year > 2200
    || !['ru', 'cu', 'de', 'uk', 'pl'].includes(options.language)) throw new Error('Неверные параметры календаря');
  // Opening a pinned project must not silently update it, even when online.
  if (!options.refresh && snapshotMatches(options.saved, options.year, options.language)) {
    await verifySavedCalendar(options.saved!); return options.saved!;
  }
  const origin = __PUBLIC_API_URL__;
  const key = origin + ':' + options.year + ':' + options.language;
  const cached = !options.refresh ? await loadCachedCalendarSnapshot(key).catch(() => undefined) : undefined;
  if (cached) {
    try {
      await verifySavedCalendar(cached);
      if (snapshotMatches(cached, options.year, options.language)) return cached;
    } catch { /* A damaged cache never becomes a printable project. */ }
  }
  let request = inFlight.get(key);
  if (!request) {
    request = (async () => {
      if (Date.now() < retryUntil) throw new Error('API временно ограничило запросы. Повторите позже');
      const url = new URL('/api/v1/calendar/editor-year', origin);
      url.searchParams.set('year', String(options.year)); url.searchParams.set('lang', options.language);
      url.searchParams.set('profile', options.profile || 'typikon-strict');
      const response = await fetch(url, {credentials: 'omit', headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(90000)});
      if (response.status === 429) {
        const header = response.headers.get('Retry-After');
        const delay = header && /^\d+$/.test(header) ? Number(header) * 1000 : Math.max(0, Date.parse(header || '') - Date.now());
        retryUntil = Date.now() + Math.min(300000, Math.max(2100, Number.isFinite(delay) ? delay : 60000));
        throw new Error('API временно ограничило запросы. Повторите позже');
      }
      if (!response.ok) throw new Error(`API BibleDesktop: HTTP ${response.status}`);
      const text = await response.text();
      if (text.length > 16000000) throw new Error('Календарный снимок слишком большой');
      const saved: SavedEditorCalendarSnapshot = {fetchedAt: new Date().toISOString(), snapshot: JSON.parse(text)};
      await verifySavedCalendar(saved);
      if (!snapshotMatches(saved, options.year, options.language)) throw new Error('API вернул другой календарный год или язык');
      await saveCachedCalendarSnapshot(key, saved).catch(() => undefined);
      return saved;
    })();
    inFlight.set(key, request);
    void request.finally(() => inFlight.delete(key)).catch(() => undefined);
  }
  return request;
}
