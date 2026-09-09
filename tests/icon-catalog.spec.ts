import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createCalendarPublicApi, createOrthodoxCalendarApiFromXml } from '../src/calendar';
import { ICON_CATALOG, iconForEvent, isTheotokosIconCommemoration } from '../src/calendar/api/icon-catalog';

describe('reviewed icon catalogue', () => {
  it('recognizes both source forms for commemorations of the Mother of God icons', () => {
    expect(isTheotokosIconCommemoration('Сретение Владимирской иконы Пресвятой Богородицы')).toBe(true);
    expect(isTheotokosIconCommemoration('Владимирской иконы Божией Матери')).toBe(true);
    expect(isTheotokosIconCommemoration('Рождество Пресвятой Богородицы')).toBe(false);
    expect(isTheotokosIconCommemoration('Прп. Пимена Великого')).toBe(false);
  });
  it('links the same saint across years and languages, without confusing namesakes', () => {
    const engine = createOrthodoxCalendarApiFromXml(readFileSync('public/data/MemoryDays.xml', 'utf8'));
    for (const year of [2026, 2027]) {
      for (const language of ['ru', 'de'] as const) {
        const api = createCalendarPublicApi(engine, language);
        const day = api.getDay({ year, month: 9, day: 9 })!;
        const icon = day.icons.find(icon => icon.id === 'poemen-the-great')!;
        expect(icon.imageUrl).toBe('/assets/icons/poemen-the-great.jpg');
        expect(icon.title).toBe(day.events.find(event => event.id === icon.eventId)?.title);
        expect(icon.credit).toContain('Wikimedia Commons');
        expect(api.getDay({ year, month: 9, day: 10 })!.icons.some(icon => icon.id === 'poemen-the-great')).toBe(false);
      }
    }
    expect(iconForEvent({ sourceId: 'memory-day-0595', title: 'Прп. Пимена Печерского' })).toBeUndefined();
    for (const icon of ICON_CATALOG) {
      expect(existsSync(`public${icon.imageUrl}`)).toBe(true);
      expect(createHash('sha256').update(readFileSync(`public${icon.imageUrl}`)).digest('hex')).toBe(icon.sha256);
      expect(icon.localCachingAllowed).toBe(true);
    }
  });
});
