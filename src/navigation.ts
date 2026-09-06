import { ref, watch } from 'vue';
import { interfaceLanguage, isInterfaceLanguage, type InterfaceLanguage } from './i18n/interface-language';

function splitPath(path: string) {
  const match = /^\/(ru|de|en|uk)(?=\/|$)/i.exec(path);
  return { language: match?.[1]?.toLowerCase() as InterfaceLanguage | undefined,
    path: (match ? path.slice(match[0].length) : path).replace(/\/$/, '') || '/' };
}
// Internal routes omit the language; browser URLs always include it.
export const routePath = ref(splitPath(location.pathname).path);
export function localizedPath(path: string, language = interfaceLanguage.value): string {
  const clean = splitPath(path).path;
  return `/${language}${clean === '/' ? '/' : clean}`;
}
const guards = new Set<() => boolean>();
let position = Number(history.state?.calendarPosition ?? 0);
let restoring = false;
let applyingLocation = false;
let currentUrl = localizedPath(routePath.value) + location.search + location.hash;
history.replaceState({ ...history.state, calendarPosition: position }, '', currentUrl);
export function beforeNavigate(guard: () => boolean): () => void {
  guards.add(guard); return () => guards.delete(guard);
}
export function navigate(path: string, replace = false): void {
  const parsed = splitPath(path);
  const language = parsed.language ?? interfaceLanguage.value;
  const url = localizedPath(parsed.path, language);
  if (url === currentUrl) return;
  if (!replace && [...guards].some(guard => !guard())) return;
  if (!replace) position++;
  history[replace ? 'replaceState' : 'pushState']({ calendarPosition: position }, '', url);
  currentUrl = url;
  applyingLocation = true;
  interfaceLanguage.value = language;
  routePath.value = parsed.path;
  applyingLocation = false;
}
watch(interfaceLanguage, language => {
  if (applyingLocation || !isInterfaceLanguage(language)) return;
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
  if (parsed.language) interfaceLanguage.value = parsed.language;
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
