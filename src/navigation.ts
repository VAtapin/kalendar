import { ref, watch } from 'vue';
import { interfaceLanguage, isInterfaceLanguage, type InterfaceLanguage } from './i18n/interface-language';
import { domainRoute, splitLanguagePath as splitPath } from './i18n/domain-routing';
import { sessionRequest } from './domain-session';

// Internal routes omit the language; browser URLs always include it.
export const routePath = ref(splitPath(location.pathname).path);
export function localizedPath(path: string, language = interfaceLanguage.value): string {
  return domainRoute(path, language, location.origin);
}
const guards = new Set<() => boolean>();
let position = Number(history.state?.calendarPosition ?? 0);
let restoring = false;
let applyingLocation = false;
let currentUrl = localizedPath(routePath.value) + location.search + location.hash;
if (new URL(currentUrl, location.origin).origin !== location.origin) location.replace(currentUrl);
else history.replaceState({ ...history.state, calendarPosition: position }, '', currentUrl);
const externalPreparations = new Set<() => Promise<void>>();
export function beforeDomainChange(prepare: () => Promise<void>): () => void {
  externalPreparations.add(prepare); return () => externalPreparations.delete(prepare);
}
async function leaveDomain(url: string, previous: InterfaceLanguage): Promise<void> {
  try {
    for (const prepare of externalPreparations) await prepare();
    const target=new URL(url);
    const result=await sessionRequest('create',{target:target.origin,path:target.pathname});
    location.assign(result.url);
  } catch {
    applyingLocation = true; interfaceLanguage.value = previous; applyingLocation = false;
    window.dispatchEvent(new CustomEvent('calendar-navigation-error',{detail:'Не удалось перенести вход между доменами. Повторите переключение языка.'}));
  }
}
export function beforeNavigate(guard: () => boolean): () => void {
  guards.add(guard); return () => guards.delete(guard);
}
export function navigate(path: string, replace = false): void {
  const parsed = splitPath(path);
  const language = parsed.language ?? interfaceLanguage.value;
  const url = localizedPath(parsed.path, language);
  if (url === currentUrl) return;
  if (!replace && [...guards].some(guard => !guard())) return;
  if (new URL(url, location.origin).origin !== location.origin) { void leaveDomain(url, interfaceLanguage.value); return; }
  if (!replace) position++;
  history[replace ? 'replaceState' : 'pushState']({ calendarPosition: position }, '', url);
  currentUrl = url;
  applyingLocation = true;
  interfaceLanguage.value = language;
  routePath.value = parsed.path;
  applyingLocation = false;
}
watch(interfaceLanguage, (language, previous) => {
  if (applyingLocation || !isInterfaceLanguage(language)) return;
  const target = localizedPath(routePath.value, language) + location.search + location.hash;
  if (new URL(target, location.origin).origin !== location.origin) {
    if ([...guards].some(guard => !guard())) { applyingLocation = true; interfaceLanguage.value = previous; applyingLocation = false; return; }
    void leaveDomain(target, previous); return;
  }
  position++;
  currentUrl = localizedPath(routePath.value, language) + location.search + location.hash;
  history.pushState({ calendarPosition: position }, '', currentUrl);
}, { flush:'sync' });
window.addEventListener('popstate', event => {
  if (restoring) { restoring = false; return; }
  const nextPosition = Number(event.state?.calendarPosition ?? position);
  const parsed = splitPath(location.pathname);
  if (parsed.path !== routePath.value && [...guards].some(guard => !guard())) {
    if (nextPosition !== position) { restoring = true; history.go(position - nextPosition); }
    else history.replaceState({ calendarPosition: position }, '', currentUrl);
    return;
  }
  position = nextPosition;
  applyingLocation = true;
  interfaceLanguage.value = parsed.language ?? (location.hostname === 'kalender.georg-kloster.de' ? 'de' : 'ru');
  currentUrl = localizedPath(parsed.path) + location.search + location.hash;
  history.replaceState({ ...history.state, calendarPosition: position }, '', currentUrl);
  routePath.value = parsed.path;
  applyingLocation = false;
});
export function isPublicPath(path: string): boolean {
  return path !== '/' && !/^\/(?:account|login|admin|calendar)(?:\/|$)/.test(path);
}
export function pagePath(slug: string): string { return localizedPath('/' + encodeURIComponent(slug)); }
document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element)?.closest?.('a');
  if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin || url.search || url.hash) return;
  event.preventDefault(); navigate(url.pathname);
});
