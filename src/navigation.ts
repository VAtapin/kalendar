import { ref } from 'vue';

export const routePath = ref(window.location.pathname.replace(/\/$/, '') || '/');
const guards = new Set<() => boolean>();
let position = Number(window.history.state?.calendarPosition ?? 0);
window.history.replaceState({ ...window.history.state, calendarPosition: position }, '', window.location.href);
let restoring = false;
export function beforeNavigate(guard: () => boolean): () => void {
  guards.add(guard); return () => guards.delete(guard);
}
export function navigate(path: string, replace = false): void {
  if (path === routePath.value) return;
  if (!replace && [...guards].some(guard => !guard())) return;
  if (!replace) position++;
  window.history[replace ? 'replaceState' : 'pushState']({ calendarPosition: position }, '', path);
  routePath.value = path;
}
window.addEventListener('popstate', event => {
  if (restoring) { restoring = false; return; }
  const nextPosition = Number(event.state?.calendarPosition ?? position);
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if ([...guards].some(guard => !guard())) {
    if (nextPosition !== position) { restoring = true; window.history.go(position - nextPosition); }
    else window.history.replaceState({ calendarPosition: position }, '', routePath.value);
    return;
  }
  position = nextPosition;
  routePath.value = path;
});
export function isPublicPath(path: string): boolean {
  return path !== '/' && !/^\/(?:account|login|admin|calendar)(?:\/|$)/.test(path);
}
export function pagePath(slug: string): string { return '/' + encodeURIComponent(slug); }

// Preserve ordinary browser behaviour for modifier clicks and external links.
document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element)?.closest?.('a');
  if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin || url.search || url.hash) return;
  event.preventDefault(); navigate(url.pathname);
});
