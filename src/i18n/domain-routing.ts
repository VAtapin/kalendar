import type { InterfaceLanguage } from '../document/types';
export const RUSSIAN_ORIGIN = __APP_PUBLIC_URL__;
export const GERMAN_ORIGIN = __APP_GERMAN_PUBLIC_URL__;
export const RUSSIAN_HOST = new URL(RUSSIAN_ORIGIN).host;
export const GERMAN_HOST = new URL(GERMAN_ORIGIN).host;
export type PublicDomainOrigins = { russian: string; german: string };
export function splitLanguagePath(path: string) {
  const match = /^\/(ru|de|en|uk)(?=\/|$)/i.exec(path);
  return { language: match?.[1]?.toLowerCase() as InterfaceLanguage | undefined,
    path: (match ? path.slice(match[0].length) : path).replace(/\/$/, '') || '/' };
}
export function domainRoute(path: string, language: InterfaceLanguage, origin: string,
  domains: PublicDomainOrigins = {russian:RUSSIAN_ORIGIN,german:GERMAN_ORIGIN}): string {
  const base = new URL(origin);
  const russianHost = new URL(domains.russian).host;
  const germanHost = new URL(domains.german).host;
  const production = [russianHost, germanHost].includes(base.host);
  const clean = splitLanguagePath(path).path;
  const prefix = language === 'en' || language === 'uk' || (!production && language === 'de') ? `/${language}` : '';
  const pathname = prefix + (clean === '/' ? '/' : clean);
  const target = production ? (language === 'de' ? domains.german : domains.russian) : base.origin;
  return target === base.origin ? pathname : target + pathname;
}
