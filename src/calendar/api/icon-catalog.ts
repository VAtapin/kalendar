import type { ResolvedCalendarEvent } from '../types';

export function isTheotokosIconCommemoration(title: string): boolean {
  return /икон[а-яё]*\s+(?:(?:Пресвятой|Пречистой)\s+)?(?:Богородиц[а-яё]*|Богоматер[а-яё]*|(?:Божией|Божьей)\s+Матери)/iu.test(title);
}

/** Reviewed images only. Source ID and title must both match: XML numbering can change. */
export const ICON_CATALOG = [{
  id: 'poemen-the-great',
  sourceId: 'memory-day-0595',
  sourceTitle: 'Прп. Пимена Великого (ок. 450)',
  imageUrl: '/assets/icons/poemen-the-great.jpg',
  sha256: '9824ad5c14bdd42b9177e2bfbec66d9b55ce2f5ca1e45ed9dcdf203169b0caaa',
  localCachingAllowed: true,
  width: 261,
  height: 450,
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Saint_Poimen_Russian_Icon.jpg',
  license: 'Public domain',
  credit: 'Неизвестный иконописец, XIX век. Общественное достояние · Wikimedia Commons',
}] as const;

export function iconForEvent(event: Pick<ResolvedCalendarEvent, 'sourceId' | 'title'>) {
  return ICON_CATALOG.find(icon => icon.sourceId === event.sourceId && icon.sourceTitle === event.title);
}
