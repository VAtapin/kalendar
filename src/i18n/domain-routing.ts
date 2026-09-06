import type { InterfaceLanguage } from '../document/types';
export const RUSSIAN_HOST = 'kalender.georg-kloster.ru';
export const GERMAN_HOST = 'kalender.georg-kloster.de';
export function splitLanguagePath(path: string) {
  const match = /^\/(ru|de|en|uk)(?=\/|$)/i.exec(path);
  return { language: match?.[1]?.toLowerCase() as InterfaceLanguage | undefined,
    path: (match ? path.slice(match[0].length) : path).replace(/\/$/, '') || '/' };
}
export function domainRoute(path: string, language: InterfaceLanguage, origin: string): string {
  const base = new URL(origin);
  const production = [RUSSIAN_HOST, GERMAN_HOST].includes(base.hostname);
  const clean = splitLanguagePath(path).path;
  const prefix = language === 'en' || language === 'uk' || (!production && language === 'de') ? `/${language}` : '';
  const pathname = prefix + (clean === '/' ? '/' : clean);
  const target = production ? `https://${language === 'de' ? GERMAN_HOST : RUSSIAN_HOST}` : base.origin;
  return target === base.origin ? pathname : target + pathname;
}
