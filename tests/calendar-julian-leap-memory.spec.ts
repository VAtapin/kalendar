import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {createOrthodoxCalendarApiFromXml} from '../src/calendar/fasting/fasting-api';
import {julianToGregorian, toIsoDate} from '../src/calendar/date/calendar-date';

describe('reference parity for Julian 29 February memories', () => {
  const engine = createOrthodoxCalendarApiFromXml(readFileSync('public/data/MemoryDays.xml', 'utf8'));
  const ids = engine.dataset.records.filter(record => record.startMonth === 2 && record.startDate === 29).map(record => record.id);
  it.each([1900, 2026, 2027, 2028, 2100])('keeps all four memories on the explicit Julian date in %i', year => {
    expect(ids).toHaveLength(4);
    const expected = julianToGregorian({year, month: 2, day: year % 4 === 0 ? 29 : 28});
    const days = engine.getYear(year).days;
    for (const id of ids) {
      expect(days.filter(day => day.events.some(event => event.sourceId === id)).map(day => day.isoDate)).toEqual([toIsoDate(expected)]);
    }
  });
});
